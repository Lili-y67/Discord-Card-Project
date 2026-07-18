const { EmbedBuilder } = require('discord.js');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const apiDB = require("./apiDB");
const constants = require("../data/constants.js")
const cardFunctions = require("../functions/secondLayerCardFunctions")
const buttonCenter = require("../functions/buttonCenter")
const transactionFunctions = require("../functions/secondLayerTransactionFunctions")
const cardDisplay = require("./cardDisplay")

const getConfirmationSellEmbed = async (cardID) => {
    let card = await apiDB.getACardFromID(cardID)

	let sellConfirmationEmbed = new EmbedBuilder()
	.setColor('#D72306')
	.setTitle('Confirmation')
    .addFields({
		name: `Êtes-vous sûr de vouloir vendre ${cardDisplay.getPlayerDisplayName(card)} d'une rareté ${card.rarity} ?`,
		value:`Vous obtiendrez ${constants.SELLPRICETABLE[card.rarity]}$`

	})
    .setTimestamp()

    return sellConfirmationEmbed
}

const getSellConfirmationButtons = async (client, interaction, cardID) => {

	let buttonGroupID = await buttonCenter.registerAButtonGroup(client, expirationFunction, interaction, {cardID:cardID})

	let confirmButtonID = await buttonCenter.registerAButton(client, "SellConfirmation", buttonGroupID, confirmSell, {cardID:cardID}, false, [(await apiDB.getACardFromID(cardID)).ownerID])

	let cancelButtonID = await buttonCenter.registerAButton(client, "CancelSelling", buttonGroupID, cancelSell, {cardID:cardID}, false, [(await apiDB.getACardFromID(cardID)).ownerID])

	let buttonRows = new ActionRowBuilder()
	.addComponents(
		new ButtonBuilder()
		.setCustomId(confirmButtonID)
		.setLabel('Confirmer')
		.setStyle(ButtonStyle.Success),

		new ButtonBuilder()
			.setCustomId(cancelButtonID)
			.setLabel('Annuler')
			.setStyle(ButtonStyle.Danger),
	);

	return buttonRows

}

const expirationFunction = async (client, oldInteraction, customDataDictionary) => {
	await apiDB.unlockACard(customDataDictionary.cardID)
	try {
		await oldInteraction.editReply({embeds:[await cardFunctions.getCardEmbed(client, customDataDictionary.cardID), getCancelSellEmbed()]})
	} catch (error) {
		return;
	}
}

const confirmSell = async (client, currentInteraction, oldInteraction, customDataDictionary) => {

	let givenMoney = await sellACard(customDataDictionary.cardID)

	let components = buttonCenter.disableEveryButtonInActionRow(currentInteraction.message.components[0])

	await oldInteraction.editReply({embeds:[await cardFunctions.getCardEmbed(client, customDataDictionary.cardID) ,getSoldEmbed(givenMoney)], components:[components]})
	currentInteraction.deferUpdate()
}

const cancelSell = async (client, currentInteraction, oldInteraction, customDataDictionary) => {
	await apiDB.unlockACard(customDataDictionary.cardID)
	let components = buttonCenter.disableEveryButtonInActionRow(currentInteraction.message.components[0])
	await oldInteraction.editReply({embeds:[await cardFunctions.getCardEmbed(client, customDataDictionary.cardID), getCancelSellEmbed()], components:[components]})
	currentInteraction.deferUpdate()
}

const sellACard = async (cardID) => {
	let card = await apiDB.getACardFromID(cardID)
	let givenMoney = card.rarity == constants.GLITCHEDNAME ? Math.floor(Math.random()*(1+constants.MAXSELLPRICEGLITCHED-constants.MINSELLPRICEGLITCHED))+constants.MINSELLPRICEGLITCHED : constants.SELLPRICETABLE[card.rarity]

	await transactionFunctions.giveMoney(card.ownerID, givenMoney)
	await apiDB.changeCardOwnership(cardID, constants.CLIENTID)
	return givenMoney
}



const getSoldEmbed = (soldPrice) => {
	let sellConfirmationEmbed = new EmbedBuilder()
	.setColor('#D72306')
	.setTitle('Vente effectuée')
    .addFields({
		name: `Votre carte a bien été vendue`,
		value:`Vous avez obtenu ${soldPrice.toString()}$`
	})
	return sellConfirmationEmbed
}

const getCancelSellEmbed = () => {
	let cancelSell = new EmbedBuilder()
	.setColor('#D72306')
	.setTitle('Vente annulée')
    .addFields({
		name: `La carte n'a pas été vendue`,
		value:`t'es bizarre mon reuf`
	})
	return cancelSell
}




module.exports = {
    getConfirmationSellEmbed,
	getSellConfirmationButtons
};


