const { SlashCommandBuilder } = require('discord.js');
const apiDB = require("../functions/apiDB")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("setlastpickableplayerid")
        .setDescription("Change l'id du dernier joueur tirable")
        .addIntegerOption(option => option.setName("playerid").setDescription("Nouvel ID du dernier joueur tirable").setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply();
        let playerID = interaction.options.getInteger("playerid")
        await apiDB.setLastPickablePlayerID(playerID)
        console.log(`L'id du dernier joueur tirable est à présent : ${playerID}`)
        await interaction.editReply(`L'id du dernier joueur tirable est à présent : ${playerID}`)
    },
};