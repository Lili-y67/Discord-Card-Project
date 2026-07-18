const { SlashCommandBuilder } = require('discord.js');

const apiDB = require("../functions/apiDB");
const componentLifecycle = require("../functions/componentLifecycle");
const guildCollectionFunctions = require("../functions/secondLayerGuildCollectionFunctions");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("guildcollection")
        .setDescription("Prévisualiser les cartes possibles des membres du serveur")
        .setDMPermission(false),
    async execute(interaction) {
        await interaction.deferReply();
        await apiDB.ensureDatabaseSchema();
        const expiresAt = componentLifecycle.createExpiresAt();
        await interaction.editReply(await guildCollectionFunctions.getGuildCollectionReply(interaction.user, 1, null, expiresAt));
        componentLifecycle.scheduleInteractionExpiration(interaction, "guildcollection", expiresAt);
    },
};
