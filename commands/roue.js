const { MessageFlags, SlashCommandBuilder } = require('discord.js');

const apiDB = require("../functions/apiDB");
const mentionSafety = require("../functions/mentionSafety");
const questCore = require("../functions/questCore");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("roue")
        .setDescription("Tourner la roue fortune avec un ticket")
        .setDMPermission(false),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await apiDB.ensureDatabaseSchema();
        await apiDB.prepareUser(interaction.user.id, interaction.user.username);

        const result = await questCore.spinWheel(interaction.user.id);
        await interaction.editReply(mentionSafety.withSafeMentions({
            embeds: [questCore.createWheelEmbed(result)]
        }));
    }
};
