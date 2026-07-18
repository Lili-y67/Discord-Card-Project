const { SlashCommandBuilder } = require('discord.js');

const apiDB = require("../functions/apiDB")

const transactionFunctions = require("../functions/secondLayerTransactionFunctions")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("profil")
        .setDescription("Voir le profil d'un utilisateur")
        .addUserOption(option => option.setName("user").setDescription("The user"))
        .setDMPermission(false),
    async execute(interaction) {
        const userRequested = interaction.options.getUser("user", false) == null ? interaction.user : interaction.options.getUser("user", false)
        await apiDB.prepareUser(userRequested.id.toString(), userRequested.username)
        await apiDB.updateUserName(userRequested.id, userRequested.username)
        await interaction.reply({ embeds: [await transactionFunctions.getWalletEmbed(userRequested)]})
    },
};