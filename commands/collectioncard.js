const { SlashCommandBuilder } = require('discord.js');

const apiDB = require("../functions/apiDB");
const collectionCardFunctions = require("../functions/secondLayerCollectionCardFunctions");
const componentLifecycle = require("../functions/componentLifecycle");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("collectioncard")
        .setDescription("Voir les cartes possedees concernant un utilisateur cible")
        .addUserOption(option => option
            .setName("user")
            .setDescription("Utilisateur cible sur les cartes")
            .setRequired(true))
        .addUserOption(option => option
            .setName("owner")
            .setDescription("Proprietaire de la collection"))
        .addIntegerOption(option => option.setName("page").setDescription("Page"))
        .setDMPermission(false),
    async execute(interaction) {
        const targetUser = interaction.options.getUser("user", true);
        const ownerUser = interaction.options.getUser("owner", false) || interaction.user;
        const page = interaction.options.getInteger("page", false) || 1;
        const expiresAt = componentLifecycle.createExpiresAt();

        await apiDB.prepareUser(ownerUser.id.toString(), ownerUser.username);
        await interaction.reply(await collectionCardFunctions.getCollectionCardReply(interaction.client, ownerUser, targetUser, page, expiresAt));
        componentLifecycle.scheduleInteractionExpiration(interaction, "collectioncard", expiresAt);
    },
};
