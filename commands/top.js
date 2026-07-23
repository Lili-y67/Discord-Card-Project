const { MessageFlags, SlashCommandBuilder } = require('discord.js');

const componentLifecycle = require("../functions/componentLifecycle");
const topFunctions = require("../functions/secondLayerTopFunctions");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("top")
        .setDescription("Afficher les classements")
        .setDMPermission(false),
    async execute(interaction) {
        const expiresAt = componentLifecycle.createExpiresAt();
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await interaction.editReply(topFunctions.getTopPickerReply(interaction.user, expiresAt));
        componentLifecycle.scheduleInteractionExpiration(interaction, "top", expiresAt);
    },
};
