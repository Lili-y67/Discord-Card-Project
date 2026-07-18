const { SlashCommandBuilder } = require('discord.js');

const apiDB = require("../functions/apiDB")

const collectionFunctions = require("../functions/secondLayerCollectionFunctions")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("collection")
        .setDescription("Afficher la collection d'un utilisateur")
        .addUserOption(option => option.setName("user").setDescription("The user"))
        .setDMPermission(false),
    async execute(interaction) {
        const userRequested = interaction.options.getUser("user", false) == null ? interaction.user : interaction.options.getUser("user", false)
        await apiDB.prepareUser(userRequested.id.toString(), userRequested.username)

        let userCollection = await collectionFunctions.getCollectionOfAUser(userRequested.id)

        await interaction.reply(await collectionFunctions.getCollectionReply(interaction.client, interaction, userCollection, 1, userRequested))
    },
};
