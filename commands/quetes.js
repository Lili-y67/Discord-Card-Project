const { MessageFlags, SlashCommandBuilder } = require('discord.js');

const apiDB = require("../functions/apiDB");
const mentionSafety = require("../functions/mentionSafety");
const questCore = require("../functions/questCore");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("quetes")
        .setDescription("Afficher ou réclamer les quêtes NewGenCard")
        .addStringOption(option => option
            .setName("action")
            .setDescription("Action à effectuer")
            .addChoices(
                { name: "Voir les quêtes", value: "voir" },
                { name: "Réclamer les récompenses", value: "reclamer" }
            ))
        .setDMPermission(false),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await apiDB.ensureDatabaseSchema();
        await apiDB.prepareUser(interaction.user.id, interaction.user.username);

        const action = interaction.options.getString("action", false) || "voir";
        if(action == "reclamer"){
            const claimResult = await questCore.claimCompletedQuests(interaction.user.id);
            await interaction.editReply(mentionSafety.withSafeMentions({
                embeds: [questCore.createClaimEmbed(claimResult)]
            }));
            return;
        }

        await interaction.editReply(mentionSafety.withSafeMentions({
            embeds: [await questCore.createQuestEmbed(interaction.user)]
        }));
    }
};
