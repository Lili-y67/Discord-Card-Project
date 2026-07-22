const { SlashCommandBuilder } = require('discord.js');

const componentLifecycle = require("../functions/componentLifecycle");
const topFunctions = require("../functions/secondLayerTopFunctions");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("top")
        .setDescription("Afficher les classements")
        .addStringOption(option => option
            .setName("type")
            .setDescription("Classement a afficher")
            .setRequired(true)
            .addChoices(
                { name: "Argent", value: "money" },
                { name: "Points", value: "points" },
                { name: "Cartes possédées", value: "cards" },
                { name: "Picks effectués", value: "picks" },
                { name: "Dailies effectués", value: "dailies" }
            ))
        .setDMPermission(false),
    async execute(interaction) {
        const type = interaction.options.getString("type", true);
        const page = 1;
        const expiresAt = componentLifecycle.createExpiresAt();
        await interaction.reply(await topFunctions.getTopReply(interaction.user, type, page, expiresAt));
        componentLifecycle.scheduleInteractionExpiration(interaction, "top", expiresAt);
    },
};
