const { SlashCommandBuilder } = require('discord.js');

const apiDB = require("../functions/apiDB");
const mentionSafety = require("../functions/mentionSafety");
const questCore = require("../functions/questCore");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("quetes")
        .setDescription("Afficher les quêtes NewGenCard")
        .setDMPermission(false),

    async execute(interaction) {
        await interaction.deferReply();
        await apiDB.ensureDatabaseSchema();
        await apiDB.prepareUser(interaction.user.id, interaction.user.username);

        const componentLifecycle = require("../functions/componentLifecycle");
        const expiresAt = componentLifecycle.createExpiresAt();
        await interaction.editReply(mentionSafety.withSafeMentions(await questCore.getQuestReply(interaction.user, 1, expiresAt)));
        componentLifecycle.scheduleInteractionExpiration(interaction, "quetes", expiresAt);
    }
};
