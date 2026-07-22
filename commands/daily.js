const { SlashCommandBuilder } = require('discord.js');

const pickFunctions = require("../functions/secondLayerPickFunctions")
const questCore = require("../functions/questCore")

const apiDB = require("../functions/apiDB");

module.exports = {
	data: new SlashCommandBuilder()
		.setName('daily')
		.setDescription("Récompense journalière | ARGENT")
		.setDMPermission(false),
	async execute(interaction) {
		await interaction.deferReply();
		await apiDB.prepareUser(interaction.user.id, interaction.user.username)
		let tryDaily = await pickFunctions.tryDaily(interaction.user)
		if(tryDaily.picked){
			await apiDB.incrementDailyCount(interaction.user.id)
			await questCore.trackEvent(interaction.user.id, "daily_claimed")
			await interaction.editReply(await pickFunctions.getBalanceReply(interaction.user, tryDaily.balanceChange, "Récompense quotidienne"));
		}
		else{
			await interaction.editReply(`Vous avez déjà effectué votre </daily:${interaction.commandId}> aujourd'hui !`)
		}
	},
};
