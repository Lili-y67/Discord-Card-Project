const { SlashCommandBuilder } = require('discord.js');
const apiDB = require("../functions/apiDB")


const cardFunctions = require("../functions/secondLayerCardFunctions")

module.exports = {  //permet de forcer l'unlock d'une carte
    data: new SlashCommandBuilder()
        .setName("forceunlock")
        .setDescription("unlock une card")
        .addIntegerOption(option => option.setName("cardid").setDescription("ID de la carte à unlock").setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply();
        let cardID = interaction.options.getInteger("cardid").toString()
        await apiDB.unlockACard(cardID)
        await interaction.editReply({embeds: [await cardFunctions.getCardEmbed(interaction.client, cardID)]})
    },
};