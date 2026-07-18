const { SlashCommandBuilder } = require('discord.js');

const pointstopFunctions = require("../functions/secondLayerPointstopFunctions")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("pointstop")
        .setDescription("Affiche le top card points!")
        .addIntegerOption(option => option.setName("page").setDescription("page"))
        .setDMPermission(false),
    async execute(interaction) {
        await interaction.deferReply();

        var page = interaction.options.getInteger("page", false) == null ? 1 : interaction.options.getInteger("page", false)

        let pointstopPaquetsList = await pointstopFunctions.getStringLinePaquetsList()

        if(page<1){
            page = 1
        }
        if(page>pointstopPaquetsList.length){
            page = pointstopPaquetsList.length
        }

        let firstPage = pointstopFunctions.getEmbedFromPointstopPaquet(interaction.guild.iconURL(), page, pointstopPaquetsList.length, pointstopPaquetsList[page-1])

        if(pointstopPaquetsList.length == 1){
            await interaction.editReply({embeds:[firstPage]})
            return;
        }

        let buttonRows = await pointstopFunctions.getSwitchPagesButtons(interaction.client, interaction, page, pointstopPaquetsList, interaction.user)

        await interaction.editReply({embeds:[firstPage], components: [buttonRows]})
    },
};