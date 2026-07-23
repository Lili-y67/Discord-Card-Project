const { SlashCommandBuilder } = require('discord.js');

const pickFunctions = require("../functions/secondLayerPickFunctions")
const constants = require("../data/constants.js")
const questCore = require("../functions/questCore")

const apiDB = require("../functions/apiDB");




module.exports = {
	data: new SlashCommandBuilder()
		.setName('buypick')
		.setDescription("Acheter un tirage")
		.setDMPermission(false),
	async execute(interaction) {
		await interaction.deferReply();

		await apiDB.prepareUser(interaction.user.id, interaction.user.username)
		const userDB = await apiDB.getAUserFromDiscordID(interaction.user.id)
		if(!await apiDB.hasEnoughMoney(interaction.user.id, constants.BUYPICKPRICE)){
			await interaction.editReply(pickFunctions.getNotEnoughMoneyToBuyPickReply(interaction.user, userDB?.money))
			return;
		}

		let buyPick = await pickFunctions.makeBuyPick(interaction.client, interaction.user, interaction.user.id)
		if(buyPick.error){
			await interaction.editReply(buyPick.error)
			return;
		}
        await questCore.trackCardPick(interaction.user.id, buyPick.cardID)
        await interaction.editReply(await pickFunctions.getPickReply(interaction.client, interaction.user, buyPick.cardID, buyPick.balanceChange))
	},
};
