const { EmbedBuilder } = require('discord.js');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const apiDB = require("./apiDB");
const constants = require("../data/constants.js")
const cardFunctions = require("../functions/secondLayerCardFunctions")
const buttonCenter = require("../functions/buttonCenter")
const transactionFunctions = require("../functions/secondLayerTransactionFunctions")

const getConfirmationRankupEmbed = async (user, userDB) => {
    
	let rankupConfirmationEmbed = new EmbedBuilder()
	.setColor('#D72306')
    	.setTitle('Confirmation du rankup!')
    .addFields({
		name: `Coût du rankup :`,
		value:`${userDB.money>=constants.RANKIDTORANKPRICEDICO[userDB.rankID+1] ? "✅" : "❌"} ${userDB.money}/${constants.RANKIDTORANKPRICEDICO[userDB.rankID+1]}$`
	},
    {
        name: `Points pour rankup :`,
		value:`${userDB.cardPoints>=constants.RANKIDTORANKPOINTSDICO[userDB.rankID+1] ? "✅" : "❌"} ${userDB.cardPoints}/${constants.RANKIDTORANKPOINTSDICO[userDB.rankID+1]} points`
    },
    {
        name: `Bonus actuel :`,
        value:`Cartes x${formatMultiplier(constants.RANKIDTOCARDMONEYMULTIPLIERDICO[userDB.rankID])} • Daily x${formatMultiplier(constants.RANKIDTODAILYMONEYMULTIPLIERDICO[userDB.rankID])}`
    },
    {
        name: `Bonus après rankup :`,
        value:`Cartes x${formatMultiplier(constants.RANKIDTOCARDMONEYMULTIPLIERDICO[userDB.rankID+1])} • Daily x${formatMultiplier(constants.RANKIDTODAILYMONEYMULTIPLIERDICO[userDB.rankID+1])}`
    })
    .setTimestamp()

    return rankupConfirmationEmbed
}

const getRankupConfirmationButtons = async (client, interaction, user, userDB) => {

    let canRankup = (userDB.cardPoints>=constants.RANKIDTORANKPOINTSDICO[userDB.rankID+1] && userDB.money>=constants.RANKIDTORANKPRICEDICO[userDB.rankID+1]) ? false : true

	let buttonGroupID = await buttonCenter.registerAButtonGroup(client, expirationFunction, interaction, {})

	let confirmButtonID = await buttonCenter.registerAButton(client, "DiscardConfirmation", buttonGroupID, confirmRankup, {user:user}, false, [user.id])

	let cancelButtonID = await buttonCenter.registerAButton(client, "CancelDiscard", buttonGroupID, cancelRankup, {user:user}, false, [user.id])

	let buttonRows = new ActionRowBuilder()
	.addComponents(
		new ButtonBuilder()
		.setCustomId(confirmButtonID)
		.setLabel('Rankup')
		.setStyle(ButtonStyle.Success)
        .setDisabled(canRankup),

		new ButtonBuilder()
			.setCustomId(cancelButtonID)
			.setLabel('Annuler')
			.setStyle(ButtonStyle.Danger),
	);

	return buttonRows

}

const expirationFunction = async (client, oldInteraction, customDataDictionary) => {
    //rien je suppose
}

const confirmRankup = async (client, currentInteraction, oldInteraction, customDataDictionary) => {

    let userDB = await apiDB.getAUserFromDiscordID(customDataDictionary.user.id)

    let components = buttonCenter.disableEveryButtonInActionRow(currentInteraction.message.components[0])

    if(userDB.money < constants.RANKIDTORANKPRICEDICO[userDB.rankID+1]){
        await oldInteraction.editReply({embeds:[(await getConfirmationRankupEmbed(customDataDictionary.user, userDB)).setTitle("Rankup annulé; manque d'argent")], components:[components]})
        currentInteraction.deferUpdate()
        return
    }

    if(userDB.cardPoints < constants.RANKIDTORANKPOINTSDICO[userDB.rankID+1]){
        await oldInteraction.editReply({embeds:[(await getConfirmationRankupEmbed(customDataDictionary.user, userDB)).setTitle("Rankup annulé; manque de points")], components:[components]})
        currentInteraction.deferUpdate()
        return
    }

	if(userDB.rankID >= constants.MAXRANKID){
        await oldInteraction.editReply({embeds:[(await getConfirmationRankupEmbed(customDataDictionary.user, userDB)).setTitle("Rankup annulé; rank max déjà atteint")], components:[components]})
        currentInteraction.deferUpdate()
        return
    }


    await transactionFunctions.subMoney(customDataDictionary.user.id, constants.RANKIDTORANKPRICEDICO[userDB.rankID+1])
	await apiDB.rankupAUser(customDataDictionary.user.id)
	await oldInteraction.editReply({embeds:[(await getConfirmationRankupEmbed(customDataDictionary.user, userDB)).setTitle("Rankup effectué!")], components:[components]})
	currentInteraction.deferUpdate()
    return
}

const cancelRankup = async (client, currentInteraction, oldInteraction, customDataDictionary) => {

	let userDB = await apiDB.getAUserFromDiscordID(customDataDictionary.user.id)

	let components = buttonCenter.disableEveryButtonInActionRow(currentInteraction.message.components[0])
	await oldInteraction.editReply({embeds:[(await getConfirmationRankupEmbed(customDataDictionary.user, userDB)).setTitle("Rankup annulé")], components:[components]})
	currentInteraction.deferUpdate()
}


const getMaxedRankEmbed = (user) => {
	let rankupConfirmationEmbed = new EmbedBuilder()
	.setColor('#D72306')
    	.setTitle('Vous ne pouvez plus rankup')
    .addFields({
		name: `Vous avez déjà atteint le rank maximum`,
		value:`Bravo à vous!!!`
	})
    .setTimestamp()
    .setFooter({ text: "PS: n'oubliez pas de vous laver quand même..."})

    return rankupConfirmationEmbed
}

const formatMultiplier = (multiplier) => {
    return (multiplier || 1).toFixed(2).replace(/\.?0+$/, "")
}




module.exports = {
    getConfirmationRankupEmbed,
	getRankupConfirmationButtons,
    getMaxedRankEmbed
};


