const { SlashCommandBuilder } = require('discord.js');

const apiDB = require("../functions/apiDB")

const rankupFunctions = require("../functions/secondLayerRankupFunctions")

const constants = require("../data/constants")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("rankup")
        .setDescription("Passer au prochain rank")
        .setDMPermission(false),
    async execute(interaction) {
        
        await interaction.deferReply();

        await apiDB.prepareUser(interaction.user.id, interaction.user.username)

        let userDB = await apiDB.getAUserFromDiscordID(interaction.user.id)

        if(userDB.rankID >= constants.MAXRANKID){
            await interaction.editReply({ embeds: [rankupFunctions.getMaxedRankEmbed(interaction.user)]})
            return
        }

        let rankupEmbed = await rankupFunctions.getConfirmationRankupEmbed(interaction.user, userDB)

        let buttonsRow = await rankupFunctions.getRankupConfirmationButtons(interaction.client, interaction, interaction.user, userDB)

        await interaction.editReply({ embeds: [rankupEmbed], components: [buttonsRow]})
    },
};