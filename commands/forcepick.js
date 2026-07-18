const { SlashCommandBuilder } = require('discord.js');

const pickFunctions = require("../functions/secondLayerPickFunctions")
const apiDB = require("../functions/apiDB");

const OWNER_ID = "1147963951989149796";

module.exports = {
	data: new SlashCommandBuilder()
		.setName('forcepick')
		.setDescription("Tirer une carte sans attendre le cooldown")
		.setDMPermission(false),
	async execute(interaction) {
		await interaction.deferReply({ ephemeral: interaction.user.id !== OWNER_ID });

		if(interaction.user.id !== OWNER_ID){
			await interaction.editReply("Cette commande est réservée au propriétaire du bot.")
			return;
		}

		await apiDB.prepareUser(interaction.user.id, interaction.user.username)
		let forcePick = await pickFunctions.makeForcePick(interaction.client, interaction.user)
		if(forcePick.error){
			await interaction.editReply(forcePick.error)
			return;
		}

		await interaction.editReply({ embeds: forcePick.embeds});
	},
};
