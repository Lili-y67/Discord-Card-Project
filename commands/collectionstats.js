const { SlashCommandBuilder } = require('discord.js');

const apiDB = require("../functions/apiDB")

const collectionFunctions = require("../functions/secondLayerCollectionFunctions")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("collectionstats")
        .setDescription("Afficher les statistiques de collection d'un utilisateur")
        .addUserOption(option => option.setName("user").setDescription("The user"))
        .setDMPermission(false),
    async execute(interaction) {
        const userRequested = interaction.options.getUser("user", false) == null ? interaction.user : interaction.options.getUser("user", false)
        await apiDB.prepareUser(userRequested.id.toString(), userRequested.username)

        let userCollectionStats = await collectionFunctions.getEachRarityCardsNumbers(userRequested.id)

        let collectionStatsEmbed = await collectionFunctions.getCollectionStatsEmbed(userCollectionStats, userRequested)
        
        await interaction.reply({ embeds: [collectionStatsEmbed]})
    },
};