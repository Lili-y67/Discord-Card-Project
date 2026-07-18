const { SlashCommandBuilder } = require('discord.js');


const buttonCenter = require("../functions/buttonCenter")

module.exports = {  //commande de maintenance du bot
    data: new SlashCommandBuilder()
        .setName("blockbot")
        .setDescription("Mettre le bot en maintenance/le réactiver")
        .addBooleanOption(option => option.setName("mode").setDescription("True or False").setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply();
        let mode = interaction.options.getBoolean("mode")
        interaction.client.blockBot = mode
        await buttonCenter.forcePurgeClientDictionaries(interaction.client)
        console.log(`BlockBot mode : ${mode.toString()}`)
        await interaction.editReply(`BlockBot mode : ${mode.toString()}`)
    },
};