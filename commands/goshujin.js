const { SlashCommandBuilder, MessageFlags } = require('discord.js');


module.exports = {
	data: new SlashCommandBuilder()
		.setName('master')
		.setDescription("OwO")
		.setDMPermission(false),
	async execute(interaction) {
        interaction.reply({content:`UwU 😎`,flags:MessageFlags.Ephemeral})
	},
};