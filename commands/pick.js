const { SlashCommandBuilder } = require('discord.js');

const pickFunctions = require("../functions/secondLayerPickFunctions")
const questCore = require("../functions/questCore")

const apiDB = require("../functions/apiDB");

module.exports = {
	data: new SlashCommandBuilder()
		.setName('pick')
		.setDescription("Tirer la carte d'un joueur")
		.setDMPermission(false),
	async execute(interaction) {
		await interaction.deferReply();
		await apiDB.prepareUser(interaction.user.id, interaction.user.username)
		let tryPick = await pickFunctions.tryQuickPick(interaction.client, interaction.user)
		if(tryPick.error){
			await interaction.editReply(tryPick.error)
			return;
		}
		if(tryPick.picked){
			await questCore.trackEvent(interaction.user.id, "card_picked")
			await interaction.editReply(await pickFunctions.getPickReply(interaction.client, interaction.user, tryPick.cardID, tryPick.balanceChange));
		}
		else{
			const nextPickUnix = Math.ceil(tryPick.nextPickTimestamp / 1000)
			await interaction.editReply(`Vous pourrez à nouveau tirer une carte le <t:${nextPickUnix}:F>.`)
		}
	},
};
