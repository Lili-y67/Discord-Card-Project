const { SlashCommandBuilder } = require('discord.js');

const apiDB = require("../functions/apiDB");
const componentLifecycle = require("../functions/componentLifecycle");
const inventoryFunctions = require("../functions/secondLayerInventoryFunctions");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("inv")
        .setDescription("Afficher votre inventaire de cartes")
        .setDMPermission(false),
    async execute(interaction) {
        await apiDB.prepareUser(interaction.user.id, interaction.user.username);
        const expiresAt = componentLifecycle.createExpiresAt();
        await interaction.reply(await inventoryFunctions.getInventoryReply(interaction.client, interaction.user, 1, expiresAt));
        componentLifecycle.scheduleInteractionExpiration(interaction, "inv", expiresAt);
    },
};
