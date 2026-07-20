const { EmbedBuilder } = require('discord.js');

const apiDB = require("./apiDB");
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

        await apiDB.updateQuickPickTime(discordID)
        let quickPickRes = await quickPick(client, discordID)
        await transactionFunctions.giveMoney(discordID, quickPickRes.givenMoney)
        return {picked:true, embeds: [await cardFunctions.getCardEmbed(client, quickPickRes.pickedCardID), transactionFunctions.getBalanceModificationEmbed(user, quickPickRes.givenMoney)]}

    }
    else{
        return {picked:false, nextPickTimestamp:await getNextQuickPickTimestamp(client, userDB)}
    }
}

const makeForcePick = async (client, user) => {
    if(!(await hasPickablePlayers())){
        return {picked:false, error:"Aucun joueur n'est configuré dans la base. Lancez node syncGuildPlayers.js pour synchroniser les membres du serveur."}
    }

    let quickPickRes = await quickPick(client, user.id)
    await transactionFunctions.giveMoney(user.id, quickPickRes.givenMoney)
    return {picked:true, embeds: [await cardFunctions.getCardEmbed(client, quickPickRes.pickedCardID), transactionFunctions.getBalanceModificationEmbed(user, quickPickRes.givenMoney)]}
}

const makeBuyPick = async (client, user) => {
    if(!(await hasPickablePlayers())){
        return {error:"Aucun joueur n'est configuré dans la base. Remplissez data/cards.json puis relancez node newDBinit.js."}
    }
    
    let discordID = user.id
    await transactionFunctions.subMoney(discordID, constants.BUYPICKPRICE)

    let cardID = (await anyPick(client, constants.MINCARDVALUEBUYPICK, constants.MAXCARDVALUEBUYPICK, discordID)).newCardID

    return {embeds:[await cardFunctions.getCardEmbed(client, cardID), transactionFunctions.getBalanceModificationEmbed(user, -constants.BUYPICKPRICE)]}
}

const makePickFor = async (client, discordID) => {
    if(!(await hasPickablePlayers())){
        return {picked:false, error:"Aucun joueur n'est configuré dans la base. Remplissez data/cards.json puis relancez node newDBinit.js."}
    }

    discordID = discordID.toString()
    let quickPickRes = await quickPick(client, discordID)
    await transactionFunctions.giveMoney(discordID, quickPickRes.givenMoney)
    return {picked:true, embeds: [await cardFunctions.getCardEmbed(client, quickPickRes.pickedCardID), transactionFunctions.getBalanceModificationEmbed(await client.users.fetch(discordID), quickPickRes.givenMoney)]}
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
    let cardInfos = await cardChooser(minValue, maxValue)
    let playerData = await apiDB.getPlayerDataFromID(cardInfos.playerID)
    if(!playerData){
        throw new Error(`Le joueur ${cardInfos.playerID} est introuvable dans playersData.`)
    }
    let wasAlreadyPicked =  await apiDB.isCardAlreadyPickedByUser(creatorID, cardInfos.playerID, cardInfos.rarity)
    let newCardID = await apiDB.createACard(cardInfos.playerID, cardInfos.rarity, cardInfos.rarityValue, creatorID)
    console.log("Carte " + newCardID.toString() + " créée " + Date.now().toString())
    await apiDB.changeCardOwnership(newCardID, creatorID)
    await cardFunctions.updateCardImageURL(client, newCardID)
    return {newCardID:newCardID, wasAlreadyPicked:wasAlreadyPicked}
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
        return {picked:true, embeds: [transactionFunctions.getBalanceModificationEmbed(user, givenMoney)]}

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


const getNotEnoughMoneyToBuyPickEmbed = (user) => {
    return new EmbedBuilder()
    .setColor('#D72306')
    .setTitle(`Erreur lors de l'achat du buypick`)
        .addFields({ name: "L'achat du buypick n'a pas pu être effectué", value: `Vous n'avez pas assez d'argent (prix : ${constants.BUYPICKPRICE.toString()}$)` })
    .setTimestamp()
    .setFooter({ text: `Fun fact : vous n'avez pas assez d'argent !`});
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
    getNotEnoughMoneyToBuyPickEmbed,
    tryDaily,
    getRarityFromRarityValue
};
