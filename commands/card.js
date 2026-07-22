const { SlashCommandBuilder } = require("discord.js");
const apiDB = require("../functions/apiDB");
const picker = require("../functions/cardActionPicker");
const componentLifecycle = require("../functions/componentLifecycle");

module.exports = {
    data: new SlashCommandBuilder().setName("card").setDescription("Voir les informations d’une carte").setDMPermission(false),
    async execute(interaction) {
        await apiDB.prepareUser(interaction.user.id, interaction.user.username);
        const expiresAt = componentLifecycle.createExpiresAt();
        await interaction.reply(await picker.getPickerReply(interaction.user, "card", 1, 0, expiresAt));
        componentLifecycle.scheduleInteractionExpiration(interaction, "card", expiresAt);
    }
};
