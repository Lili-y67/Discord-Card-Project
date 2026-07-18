const { EmbedBuilder } = require('discord.js');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const apiDB = require("./apiDB");

const transactionFunctions = require("../functions/secondLayerTransactionFunctions")
const blitzerFunctions = require("../functions/secondLayerBlitzersFunctions")
const buttonCenter = require("../functions/buttonCenter")

const constants = require("../data/constants")

const autorisedChr =  "0123456789, ".split('')

const separatorChr = ", ".split('')

const turnCardsStringInCardsIDList = (cardsString) => {

    let cardsIDList = []

    let currentCardIDString = ""

    for(let chrIndex = 0; chrIndex<cardsString.length; chrIndex++){
        if(!autorisedChr.includes(cardsString[chrIndex])){
            return {valid:false}
        }
        
        if(separatorChr.includes(cardsString[chrIndex])){
            if(!(currentCardIDString == "")){
                if(cardsIDList.includes(parseInt(currentCardIDString))){
                    return {valid:false}
                }
                cardsIDList.push(parseInt(currentCardIDString))
                currentCardIDString = ""
            }
        }
        else{
            currentCardIDString = currentCardIDString + cardsString[chrIndex]
        }
    }

    if(currentCardIDString != ""){
        if(cardsIDList.includes(parseInt(currentCardIDString))){
            return {valid:false}
        }
        cardsIDList.push(parseInt(currentCardIDString))
    }

    return {valid:true, cardsIDList:cardsIDList}

}

const doUserOwnEveryCardInList = async (cardsIDList, discordID) => {

    let ownedCardIDList = await apiDB.getCardsIDListHUB({ownerID:discordID})

    for(let cardIDtestIndex = 0; cardIDtestIndex<cardsIDList.length; cardIDtestIndex++){
        if(!ownedCardIDList.includes(cardsIDList[cardIDtestIndex])){
            return false
        }
    }
    return true

}

const getTradeEmbed = async (proposingUser, askedUser, proposedCardsIDList, askedCardsIDList, payer, amount, tradeStatus="pending") => {


    let proposedSimpleCardsTextList = await blitzerFunctions.getSimpleCardsTextListFromACardIDPaquet(proposedCardsIDList)

    let proposedSimpleCardsTextEmbedFormat = ""

    for(let currentSimpleCardTextIndex = 0; currentSimpleCardTextIndex<proposedSimpleCardsTextList.length; currentSimpleCardTextIndex++){
        if(currentSimpleCardTextIndex == 0){
            proposedSimpleCardsTextEmbedFormat = proposedSimpleCardsTextEmbedFormat + proposedSimpleCardsTextList[currentSimpleCardTextIndex]
        }
        else{
            proposedSimpleCardsTextEmbedFormat = proposedSimpleCardsTextEmbedFormat + "\n" + proposedSimpleCardsTextList[currentSimpleCardTextIndex]
        }
    }

    let askedSimpleCardsTextList = await blitzerFunctions.getSimpleCardsTextListFromACardIDPaquet(askedCardsIDList)

    let askedSimpleCardsTextEmbedFormat = ""

    for(let currentSimpleCardTextIndex = 0; currentSimpleCardTextIndex<askedSimpleCardsTextList.length; currentSimpleCardTextIndex++){
        if(currentSimpleCardTextIndex == 0){
            askedSimpleCardsTextEmbedFormat = askedSimpleCardsTextEmbedFormat + askedSimpleCardsTextList[currentSimpleCardTextIndex]
        }
        else{
            askedSimpleCardsTextEmbedFormat = askedSimpleCardsTextEmbedFormat + "\n" + askedSimpleCardsTextList[currentSimpleCardTextIndex]
        }
    }
    
    proposedSimpleCardsTextEmbedFormat = proposedSimpleCardsTextEmbedFormat == "" ? "Aucune carte" : proposedSimpleCardsTextEmbedFormat
    askedSimpleCardsTextEmbedFormat = askedSimpleCardsTextEmbedFormat == "" ? "Aucune carte" : askedSimpleCardsTextEmbedFormat
    

    let tradeEmbed = new EmbedBuilder()
    .setColor(constants.PENDINGTRADEEMBEDCOLOR)
    if(tradeStatus == "done"){
        tradeEmbed.setTitle(`Ce trade entre ${proposingUser.username} et ${askedUser.username} a été effectué`)
    }
    if (tradeStatus == "canceled") {
        tradeEmbed.setTitle(`Ce trade entre ${proposingUser.username} et ${askedUser.username} a été annulé`)
    } else {
        tradeEmbed.setTitle(`Proposition d'échange de ${proposingUser.username} pour ${askedUser.username}`)
    }
    
    tradeEmbed.addFields({ name: `Cartes proposées par ${proposingUser.username}`, value: proposedSimpleCardsTextEmbedFormat, inline:payer == "proposing"})

    if(payer == "proposing"){
        tradeEmbed
        .addFields( {name: `Argent proposé par ${proposingUser.username}`, value: amount.toString(), inline:true})
    }

    tradeEmbed
    .addFields({ name: `Cartes demandées à ${askedUser.username}`, value: askedSimpleCardsTextEmbedFormat, inline:payer == "asked" })

    if(payer == "asked"){
        tradeEmbed
        .addFields( {name: `Argent demandé à ${askedUser.username}`, value: amount.toString(), inline:true})
    }

    tradeEmbed
    .setTimestamp()

    return tradeEmbed
}

const getTradeButtonsActionRow = async (client, currentInteraction, proposingUser, askedUser, proposedCardsIDList, askedCardsIDList, payer, amount, tradeEmbed) => {
    let buttonGroupID = await buttonCenter.registerAButtonGroup(client, expirationFunction, currentInteraction, {proposedCardsIDList:proposedCardsIDList, askedCardsIDList:askedCardsIDList, tradeEmbed:tradeEmbed, proposingUserName:proposingUser.username, askedUserName:askedUser.username})

	let confirmTradeButtonID = await buttonCenter.registerAButton(client, "confirmTrade", buttonGroupID, confirmTrade, {proposingUser:proposingUser, askedUser:askedUser, payer:payer, amount:amount, proposedCardsIDList:proposedCardsIDList, askedCardsIDList:askedCardsIDList}, false, [askedUser.id])

	let cancelTradeButtonID = await buttonCenter.registerAButton(client, "cancelTrade", buttonGroupID, cancelTrade, {proposingUser:proposingUser, askedUser:askedUser, proposedCardsIDList:proposedCardsIDList, askedCardsIDList:askedCardsIDList}, false, [proposingUser.id, askedUser.id])

	let buttonRows = new ActionRowBuilder()
	.addComponents(
		new ButtonBuilder()
		.setCustomId(confirmTradeButtonID)
		.setLabel('Confirmer')
		.setStyle(ButtonStyle.Success),

		new ButtonBuilder()
			.setCustomId(cancelTradeButtonID)
			.setLabel('Annuler')
			.setStyle(ButtonStyle.Danger),
	);

    return buttonRows
}


const expirationFunction = async (client, oldInteraction, customDataDictionary) => {
    await apiDB.bulkUnlock(customDataDictionary.proposedCardsIDList)
    await apiDB.bulkUnlock(customDataDictionary.askedCardsIDList)

    try {
		await oldInteraction.editReply({embeds:[customDataDictionary.tradeEmbed.setTitle(`Ce trade entre ${customDataDictionary.proposingUserName} et ${customDataDictionary.askedUserName} a expiré`).setColor(constants.EXPIREDTRADEEMBEDCOLOR)]})
	} catch (error) {
		return;
	}

}

const confirmTrade = async (client, currentInteraction, oldInteraction, customDataDictionary) => {

    let components = buttonCenter.disableEveryButtonInActionRow(currentInteraction.message.components[0])
    let newTradeEmbed;
    if(customDataDictionary.payer == "none" ? false : customDataDictionary.payer == "proposing" ? !(await apiDB.hasEnoughMoney(customDataDictionary.proposingUser.id, customDataDictionary.amount)) : !(await apiDB.hasEnoughMoney(customDataDictionary.askedUser.id, customDataDictionary.amount))){
        newTradeEmbed = currentInteraction.message.embeds[0].setTitle(`ERREUR durant le trade entre ${customDataDictionary.proposingUser.username} et ${customDataDictionary.askedUser.username} : manque d'argent`)
    }
    else{
        newTradeEmbed = currentInteraction.message.embeds[0].setTitle(`Ce trade entre ${customDataDictionary.proposingUser.username} et ${customDataDictionary.askedUser.username} a été effectué`).setColor(constants.CONFIRMEDTRADEEMBEDCOLOR)

        if(customDataDictionary.payer != "none"){
            transactionFunctions.subMoney(customDataDictionary.payer == "proposing" ? customDataDictionary.proposingUser.id : customDataDictionary.askedUser.id, customDataDictionary.amount)
            transactionFunctions.giveMoney(customDataDictionary.payer == "proposing" ? customDataDictionary.askedUser.id : customDataDictionary.proposingUser.id, customDataDictionary.amount)
        }

        await apiDB.bulkChangeCardOwnership(customDataDictionary.proposedCardsIDList, customDataDictionary.askedUser.id)
        await apiDB.bulkChangeCardOwnership(customDataDictionary.askedCardsIDList, customDataDictionary.proposingUser.id)
    }
    await apiDB.bulkUnlock(customDataDictionary.proposedCardsIDList)
    await apiDB.bulkUnlock(customDataDictionary.askedCardsIDList)
    await oldInteraction.editReply({embeds:[newTradeEmbed], components:[components]})
    currentInteraction.deferUpdate()
}

const cancelTrade = async (client, currentInteraction, oldInteraction, customDataDictionary) => {
    let canceledEmbed = currentInteraction.message.embeds[0].setTitle(`Ce trade entre ${customDataDictionary.proposingUser.username} et ${customDataDictionary.askedUser.username} a été annulé`).setColor(constants.CANCELTRADEEMBEDCOLOR)
    let components = buttonCenter.disableEveryButtonInActionRow(currentInteraction.message.components[0])

    await apiDB.bulkUnlock(customDataDictionary.proposedCardsIDList)
    await apiDB.bulkUnlock(customDataDictionary.askedCardsIDList)
    
    await oldInteraction.editReply({embeds:[canceledEmbed], components:[components]})
    currentInteraction.deferUpdate()
}

module.exports = {
    turnCardsStringInCardsIDList,
    doUserOwnEveryCardInList,
    getTradeEmbed,
    getTradeButtonsActionRow
};