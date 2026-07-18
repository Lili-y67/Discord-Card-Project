const { SlashCommandBuilder } = require('discord.js');

const pickFunctions = require("../functions/secondLayerPickFunctions")

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
			await interaction.editReply({ embeds: tryDaily.embeds});
		}
		else{
			await interaction.editReply(`Vous avez déjà effectué votre /daily aujourd'hui!`)
			//await interaction.editReply(`Il vous reste ${tryDaily.timeLeft.toString()} avant de pouvoir à nouveau effectuer un /daily`)
		}
	},
};