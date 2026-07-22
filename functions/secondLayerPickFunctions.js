

const apiDB = require("./apiDB");
const { ContainerBuilder, MessageFlags, SeparatorBuilder, ThumbnailBuilder } = require('discord.js');
const constants = require("../data/constants.js")

const cardFunctions = require("../functions/secondLayerCardFunctions")
const transactionFunctions = require("../functions/secondLayerTransactionFunctions")
const questCore = require("./questCore")

const CARD_MONEY_MULTIPLIER_SETTING = "cardMoneyMultiplier"
const DAILY_MONEY_MULTIPLIER_SETTING = "dailyMoneyMultiplier"
const PICK_BASE_TIMER_SETTING = "pickBaseTimerMs"
const CARD_MONEY_MULTIPLIER_UNTIL_SETTING = "cardMoneyMultiplierUntil"
const DAILY_MONEY_MULTIPLIER_UNTIL_SETTING = "dailyMoneyMultiplierUntil"

const tryQuickPick = async (client, user) => {

    let discordID = user.id
    let userDB = await apiDB.getAUserFromDiscordID(discordID)
    if(!(await hasPickablePlayers())){
        return {picked:false, error:"Aucun joueur n'est configuré dans la base. Remplissez data/cards.json puis relancez node newDBinit.js."}
    }

    if(await isLateEnoughQuickPick(client, userDB)){

        let quickPickRes = await tryPickOperation(() => quickPick(client, discordID))
        if(quickPickRes.error) return {picked:false, error:quickPickRes.error}
        await apiDB.updateQuickPickTime(discordID)
        await transactionFunctions.giveMoney(discordID, quickPickRes.givenMoney)
        return {picked:true, cardID: quickPickRes.pickedCardID, balanceChange: quickPickRes.givenMoney}

    }
    else{
        return {picked:false, nextPickTimestamp:await getNextQuickPickTimestamp(client, userDB)}
    }
}

const makeForcePick = async (client, user) => {
    if(!(await hasPickablePlayers())){
        return {picked:false, error:"Aucun joueur n'est configuré dans la base. Lancez node syncGuildPlayers.js pour synchroniser les membres du serveur."}
    }

    let quickPickRes = await tryPickOperation(() => quickPick(client, user.id))
    if(quickPickRes.error) return {picked:false, error:quickPickRes.error}
    await transactionFunctions.giveMoney(user.id, quickPickRes.givenMoney)
    return {picked:true, embeds: [await cardFunctions.getCardEmbed(client, quickPickRes.pickedCardID, user), transactionFunctions.getBalanceModificationEmbed(user, quickPickRes.givenMoney)]}
}

const makeBuyPick = async (client, user) => {
    if(!(await hasPickablePlayers())){
        return {error:"Aucun joueur n'est configuré dans la base. Remplissez data/cards.json puis relancez node newDBinit.js."}
    }
    
    let discordID = user.id

    const pickResult = await tryPickOperation(() => anyPick(client, constants.MINCARDVALUEBUYPICK, constants.MAXCARDVALUEBUYPICK, discordID))
    if(pickResult.error) return {error:pickResult.error}

    let cardID = pickResult.newCardID
    await transactionFunctions.subMoney(discordID, constants.BUYPICKPRICE)

    return {cardID, balanceChange: -constants.BUYPICKPRICE}
}

const makePickFor = async (client, discordID) => {
    if(!(await hasPickablePlayers())){
        return {picked:false, error:"Aucun joueur n'est configuré dans la base. Remplissez data/cards.json puis relancez node newDBinit.js."}
    }

    discordID = discordID.toString()
    let quickPickRes = await tryPickOperation(() => quickPick(client, discordID))
    if(quickPickRes.error) return {picked:false, error:quickPickRes.error}
    await transactionFunctions.giveMoney(discordID, quickPickRes.givenMoney)
    const requestedUser = await client.users.fetch(discordID)
    return {picked:true, embeds: [await cardFunctions.getCardEmbed(client, quickPickRes.pickedCardID, requestedUser), transactionFunctions.getBalanceModificationEmbed(requestedUser, quickPickRes.givenMoney)]}
}

const makeDropCards = async (client, user, playerID, rarityName, copies = 1) => {
    const rarity = constants.RARITIES.find(entry => entry.name === rarityName)
    if(!rarity) throw new Error("Rareté invalide.")
    const storageChannel = await cardFunctions.getCardImageStorageChannel(client)
    const cardIDs = []
    for(let index = 0; index < copies; index++){
        const rarityValue = Math.floor(Math.random() * (rarity.maxValue - rarity.minValue + 1)) + rarity.minValue
        const cardID = await apiDB.createACard(playerID, rarity.name, rarityValue, user.id)
        await apiDB.changeCardOwnership(cardID, user.id)
        try {
            await cardFunctions.updateCardImageURL(client, cardID, storageChannel)
        } catch(error) {
            console.error(`Image du drop introuvable pour la carte ${cardID}: ${error.message}`)
        }
        cardIDs.push(cardID)
    }
    return cardIDs
}


const quickPick = async (client, discordID) => {

    let anyPickRes = await anyPick(client, constants.MINCARDVALUEQUICKPICK, constants.MAXCARDVALUEQUICKPICK, discordID)

    let card = await apiDB.getACardFromID(anyPickRes.newCardID)
    let userDB = await apiDB.getAUserFromDiscordID(discordID)

    let givenMoney

    if(card.rarity == constants.GLITCHEDNAME){
        givenMoney =  Math.floor(Math.random()*(1+constants.BASEMAXMONEYGLITCHED-constants.BASEMINMONEYGLITCHED))+constants.BASEMINMONEYGLITCHED
    }
    else{
        givenMoney = anyPickRes.wasAlreadyPicked ? constants.BASEMONEYLOOTTABLE[card.rarity]/2 : constants.BASEMONEYLOOTTABLE[card.rarity]
    }

    const cardMoneyMultiplier = await getActiveMoneyMultiplier(CARD_MONEY_MULTIPLIER_SETTING, CARD_MONEY_MULTIPLIER_UNTIL_SETTING)
    givenMoney = Math.floor(givenMoney * getRankCardMoneyMultiplier(userDB?.rankID) * cardMoneyMultiplier)

    return {pickedCardID:anyPickRes.newCardID, givenMoney:givenMoney}
}

const isLateEnoughQuickPick = async (client, userDB) => { //required time en ms
    return await getNextQuickPickTimestamp(client, userDB) < Date.now() ? true : false
}

const getNextQuickPickTimestamp = async (client, userDB) => {
    const questPickMultiplier = await questCore.getPickCooldownMultiplier(userDB.discordID)
    const rankBaseTimer = constants.RANKIDTORANKQUICKPICKTIMEDICO[1] * client.quickPickTimeMultiplicator
    const configuredBaseTimer = await apiDB.getPersistentSetting(PICK_BASE_TIMER_SETTING, rankBaseTimer)
    if(Number(configuredBaseTimer) === 0) return 0
    const rankTimerRatio = (constants.RANKIDTORANKQUICKPICKTIMEDICO[userDB.rankID] || constants.RANKIDTORANKQUICKPICKTIMEDICO[1]) / constants.RANKIDTORANKQUICKPICKTIMEDICO[1]
    return parseInt(userDB.lastQuickPick) + Math.trunc(configuredBaseTimer * rankTimerRatio * questPickMultiplier)
}



const cardChooser = async (minValue, maxValue) => {

    let randomPlayerID = await apiDB.getRandomPickablePlayerID()
    if(!randomPlayerID){
        throw new Error("Aucun joueur n'est configuré dans la base.")
    }

    const rarityRows = await apiDB.getRarityWeightRows()
    const eligibleRows = rarityRows.filter(row =>
        row.rarity.maxValue >= minValue && row.rarity.minValue <= maxValue
    )
    const chosenRow = chooseWeightedRarity(eligibleRows.length ? eligibleRows : rarityRows)
    const rarityMinValue = Math.max(chosenRow.rarity.minValue, minValue)
    const rarityMaxValue = Math.min(chosenRow.rarity.maxValue, maxValue)
    let rarityValue = Math.floor(Math.random()*(1+rarityMaxValue-rarityMinValue))+rarityMinValue
    let rarity = chosenRow.rarity.name;

    return {playerID:randomPlayerID, rarity:rarity, rarityValue:rarityValue}
}

const chooseWeightedRarity = (rarityRows) => {
    const totalWeight = rarityRows.reduce((total, row) => total + Math.max(Number(row.weight) || 0, 0), 0)
    if(totalWeight <= 0) return { rarity: constants.RARITIES[0], weight: constants.RARITIES[0].weight }

    let randomWeight = Math.random() * totalWeight
    for(const row of rarityRows){
        randomWeight -= Math.max(Number(row.weight) || 0, 0)
        if(randomWeight <= 0) return row
    }
    return rarityRows[rarityRows.length - 1]
}


const getRarityFromRarityValue = (rarityValue) => {
    const rarity = constants.RARITIES.find(rarityData => rarityValue >= rarityData.minValue && rarityValue <= rarityData.maxValue)
    return rarity?.name || constants.COMMONNAME
}


const anyPick = async (client, minValue, maxValue, creatorID) => {
    console.log("Creating card...")
    const storageChannel = await cardFunctions.getCardImageStorageChannel(client)
    let cardInfos = await cardChooser(minValue, maxValue)
    let playerData = await apiDB.getPlayerDataFromID(cardInfos.playerID)
    if(!playerData){
        throw new Error(`Le joueur ${cardInfos.playerID} est introuvable dans playersData.`)
    }
    let wasAlreadyPicked =  await apiDB.isCardAlreadyPickedByUser(creatorID, cardInfos.playerID, cardInfos.rarity)
    let newCardID = await apiDB.createACard(cardInfos.playerID, cardInfos.rarity, cardInfos.rarityValue, creatorID)
    console.log("Carte " + newCardID.toString() + " créée " + Date.now().toString())
    await apiDB.changeCardOwnership(newCardID, creatorID)
    await cardFunctions.updateCardImageURL(client, newCardID, storageChannel)
    return {newCardID:newCardID, wasAlreadyPicked:wasAlreadyPicked}
}

const tryPickOperation = async (operation) => {
    try {
        return await operation()
    } catch(error) {
        return {error:error.message || "Erreur pendant le tirage de la carte."}
    }
}

const hasPickablePlayers = async () => {
    let playerNumber = await apiDB.getLastPickablePlayerID()
    return Number.isInteger(Number(playerNumber)) && Number(playerNumber) > 0
}

const tryDaily = async (user) => {
    let discordID = user.id
    let userDB = await apiDB.getAUserFromDiscordID(discordID)

    if(await isLateEnoughDaily(userDB)){

        await apiDB.updateSlowPickTime(discordID)
        let givenMoney = await daily(discordID)
        return {picked:true, balanceChange: givenMoney}

    }
    else{
        return {picked:false}
    }
}

const isLateEnoughDaily = async (userDB) => { //required time en ms
    return !(new Date().setHours(0,0,0,0) == new Date(parseInt(userDB.lastDailyPick)).setHours(0,0,0,0))
}

const daily = async (discordID) => {
    let givenMoney = dailyGivenValue(Math.random()*constants.DAILYRANDOMMULTIPLICATOR)
    let userDB = await apiDB.getAUserFromDiscordID(discordID)
    const dailyMoneyMultiplier = await getActiveMoneyMultiplier(DAILY_MONEY_MULTIPLIER_SETTING, DAILY_MONEY_MULTIPLIER_UNTIL_SETTING)
    givenMoney = Math.floor(givenMoney * getRankDailyMoneyMultiplier(userDB?.rankID) * dailyMoneyMultiplier)
    await transactionFunctions.giveMoney(discordID, givenMoney)
    return givenMoney
}

const getActiveMoneyMultiplier = async (multiplierSetting, untilSetting) => {
    const multiplier = Number(await apiDB.getPersistentSetting(multiplierSetting, 1)) || 1
    const until = Number(await apiDB.getPersistentSetting(untilSetting, 0)) || 0
    if(until > 0 && until <= Date.now()) return 1
    return multiplier
}

const getRankCardMoneyMultiplier = (rankID) => {
    return constants.RANKIDTOCARDMONEYMULTIPLIERDICO[rankID] || 1
}

const getRankDailyMoneyMultiplier = (rankID) => {
    return constants.RANKIDTODAILYMONEYMULTIPLIERDICO[rankID] || 1
}


const dailyGivenValue = (randomNumber) => {
    return Math.trunc(Math.exp(randomNumber/50+2)/100 + randomNumber/10 + 25)
}


const getNotEnoughMoneyToBuyPickReply = (user, currentMoney = 0) => {
    const balance = Number(currentMoney) || 0
    const missingMoney = Math.max(constants.BUYPICKPRICE - balance, 0)
    const container = new ContainerBuilder().setAccentColor(0xD72306)
        .addTextDisplayComponents(text => text.setContent("## Achat impossible"))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(text => text.setContent([
            `Le buypick coûte **${constants.BUYPICKPRICE}$**.`,
            `💰 Votre solde : **${balance}$**`,
            `Il vous manque **${missingMoney}$**.`
        ].join("\n")))
    const avatarURL = user?.displayAvatarURL?.({ extension: "png", size: 128, forceStatic: true })
    if(avatarURL) container.addSectionComponents(section => section
        .addTextDisplayComponents(text => text.setContent(`-# Solde de ${user.username}`))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarURL)))
    return { components: [container], flags: MessageFlags.IsComponentsV2 }
}

const getPickReply = async (client, user, cardID, balanceChange) => {
    const card = await apiDB.getACardFromID(cardID)
    const container = await cardFunctions.getCardContainer(client, card, user)
    const balance = await apiDB.getMoneyOfUser(user.id)
    const sign = balanceChange >= 0 ? "+" : ""
    container.addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(text => text.setContent(
            `### Portefeuille\nVariation : **${sign}${balanceChange}$**\n💰 Solde total : **${balance}$**`
        ))
    return { components: [container], flags: MessageFlags.IsComponentsV2 }
}

const getBalanceReply = async (user, balanceChange, title = "Solde modifié") => {
    const balance = await apiDB.getMoneyOfUser(user.id)
    const sign = balanceChange >= 0 ? "+" : ""
    const container = new ContainerBuilder().setAccentColor(0xFC6600)
        .addTextDisplayComponents(text => text.setContent(`## ${title}`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(text => text.setContent(
            `Variation : **${sign}${balanceChange}$**\n💰 Solde total : **${balance}$**`
        ))
    return { components: [container], flags: MessageFlags.IsComponentsV2 }
}











//BULK PICK

/*
  //POUR TIRER DE MULTIPLES CARTES EN UN /PICK
    //ATTENTION CA FAIT CRASH LE BOT

const anyPick = async (client, minValue, maxValue, creatorID) => {
    let cardGeneratedNumber = 10
    for(let i =0; i<cardGeneratedNumber; i++){
        let cardInfos = await cardChooser(minValue, maxValue)
        let newCardID = await apiDB.createACard(DB, cardInfos.playerID, cardInfos.name, cardInfos.rarity, cardInfos.rarityValue, creatorID, creatorID)

        await apiDB.addCardToUser(DB, creatorID, newCardID)
        let wasAlreadyPicked = await apiDB.addCardToAlreadyPicked(DB, creatorID, cardInfos.playerID, cardInfos.rarity)    }
    console.log(cardGeneratedNumber.toString() + " ont été générées pour " + creatorID.toString())
    let cardInfos = await cardChooser(minValue, maxValue)
    let newCardID = await apiDB.createACard(DB, cardInfos.playerID, cardInfos.name, cardInfos.rarity, cardInfos.rarityValue, creatorID, creatorID)
    await apiDB.addCardToUser(DB, creatorID, newCardID)    let wasAlreadyPicked = await apiDB.addCardToAlreadyPicked(DB, creatorID, cardInfos.playerID, cardInfos.rarity)
    return {newCardID:newCardID, wasAlreadyPicked:wasAlreadyPicked}
}

*/


module.exports = {
    tryQuickPick,
    makeForcePick,
    makeBuyPick,
    makePickFor,
    makeDropCards,
    getNotEnoughMoneyToBuyPickReply,
    getPickReply,
    getBalanceReply,
    tryDaily,
    getRarityFromRarityValue
};
