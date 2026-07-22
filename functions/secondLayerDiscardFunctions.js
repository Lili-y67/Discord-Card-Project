const { EmbedBuilder } = require('discord.js');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const apiDB = require("./apiDB");
const constants = require("../data/constants.js")
const cardFunctions = require("../functions/secondLayerCardFunctions")
const buttonCenter = require("../functions/buttonCenter")
const transactionFunctions = require("../functions/secondLayerTransactionFunctions")
const cardDisplay = require("./cardDisplay")
const questCore = require("./questCore")

const getConfirmationDiscardEmbed = async (cardID) => {
    let card = await apiDB.getACardFromID(cardID)

	let discardConfirmationEmbed = new EmbedBuilder()
	.setColor('#D72306')
	.setTitle('Confirmation')
    .addFields({
		name: `Êtes-vous sûr de vouloir défausser ${cardDisplay.getPlayerDisplayName(card)} d'une rareté ${card.rarity} ?`,
		value:`Vous obtiendrez ${constants.DISCARDPOINTSDICO[card.rarity]} points!`

	})
    .setTimestamp()

    return discardConfirmationEmbed
}

const getDiscardConfirmationButtons = async (client, interaction, cardID) => {

	let buttonGroupID = await buttonCenter.registerAButtonGroup(client, expirationFunction, interaction, {cardID:cardID})

	let confirmButtonID = await buttonCenter.registerAButton(client, "DiscardConfirmation", buttonGroupID, confirmDiscard, {cardID:cardID}, false, [(await apiDB.getACardFromID(cardID)).ownerID])

	let cancelButtonID = await buttonCenter.registerAButton(client, "CancelDiscard", buttonGroupID, cancelDiscard, {cardID:cardID}, false, [(await apiDB.getACardFromID(cardID)).ownerID])

	let buttonRows = new ActionRowBuilder()
	.addComponents(
		new ButtonBuilder()
		.setCustomId(confirmButtonID)
		.setEmoji('♻️')
		.setLabel('Confirmer')
		.setStyle(ButtonStyle.Success),

		new ButtonBuilder()
			.setCustomId(cancelButtonID)
			.setEmoji('✖️')
			.setLabel('Annuler')
			.setStyle(ButtonStyle.Danger),
	);

	return buttonRows

}

const expirationFunction = async (client, oldInteraction, customDataDictionary) => {
	await apiDB.unlockACard(customDataDictionary.cardID)
	try {
		await oldInteraction.editReply({embeds:[await cardFunctions.getCardEmbed(client, customDataDictionary.cardID), getDiscardedEmbed()]})
	} catch (error) {
		return;
	}
}

const confirmDiscard = async (client, currentInteraction, oldInteraction, customDataDictionary) => {

	const discardedCard = await apiDB.getACardFromID(customDataDictionary.cardID)
	let givenPoints = await discardACard(customDataDictionary.cardID)
	await oldInteraction.editReply({embeds:[await cardFunctions.getCardEmbed(client, customDataDictionary.cardID),getDiscardedEmbed(givenPoints)], components:[]})
	await questCore.trackEvent(discardedCard.ownerID, "card_discarded")
	currentInteraction.deferUpdate()
}

const cancelDiscard = async (client, currentInteraction, oldInteraction, customDataDictionary) => {
	await apiDB.unlockACard(customDataDictionary.cardID)
	let components = buttonCenter.disableEveryButtonInActionRow(currentInteraction.message.components[0])
	await oldInteraction.editReply({embeds:[await cardFunctions.getCardEmbed(client, customDataDictionary.cardID), getCancelDiscardEmbed()], components:[components]})
	currentInteraction.deferUpdate()
}

const discardACard = async (cardID) => {
	let card = await apiDB.getACardFromID(cardID)
	let givenPoints = card.rarity == constants.GLITCHEDNAME ? Math.floor(Math.random()*(1+constants.MAXDISCARDPOINTSGLITCHED-constants.MINDISCARDPOINTSGLITCHED))+constants.MINDISCARDPOINTSGLITCHED : constants.DISCARDPOINTSDICO[card.rarity]

	await transactionFunctions.giveCardPoints(card.ownerID, givenPoints)
	await apiDB.changeCardOwnership(cardID, constants.CLIENTID)
	return givenPoints
}



const getDiscardedEmbed = (givenPoints) => {
	let sellConfirmationEmbed = new EmbedBuilder()
	.setColor('#D72306')
	.setTitle('Défaussage effectué')
    .addFields({
		name: `Votre carte a bien été défaussée`,
		value:`Vous avez obtenu ${givenPoints.toString()} points`
	})
	return sellConfirmationEmbed
}

const getCancelDiscardEmbed = () => {
	let cancelSell = new EmbedBuilder()
	.setColor('#D72306')
	.setTitle('Défaussage annulé')
    .addFields({
		name: `La carte n'a pas été défaussée`,
		value:`t'es zarbi.e mon.a reuf.e`
	})
	return cancelSell
}




module.exports = {
    getConfirmationDiscardEmbed,
	getDiscardConfirmationButtons
};
