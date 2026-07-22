const { SlashCommandBuilder } = require("discord.js");
const apiDB = require("../functions/apiDB");
const picker = require("../functions/cardActionPicker");
const componentLifecycle = require("../functions/componentLifecycle");

module.exports = {
    data: new SlashCommandBuilder().setName("sell").setDescription("Vendre une carte à la banque").setDMPermission(false),
    async execute(interaction) {
        await apiDB.prepareUser(interaction.user.id, interaction.user.username);
        const expiresAt = componentLifecycle.createExpiresAt();
        await interaction.reply(await picker.getPickerReply(interaction.user, "sell", 1, 0, expiresAt));
        componentLifecycle.scheduleInteractionExpiration(interaction, "sell", expiresAt);
    }
};
