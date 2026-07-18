const { SlashCommandBuilder } = require('discord.js');

const baltopFunctions = require("../functions/secondLayerBaltopFunctions")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("baltop")
        .setDescription("Affiche le top money!")
        .addIntegerOption(option => option.setName("page").setDescription("page"))
        .setDMPermission(false),
    async execute(interaction) {
        await interaction.deferReply();

        var page = interaction.options.getInteger("page", false) == null ? 1 : interaction.options.getInteger("page", false)

        let baltopPaquetsList = await baltopFunctions.getStringLinePaquetsList()
        
        //check que la page demandée est correcte
        if(page<1){
            page = 1
        }
        if(page>baltopPaquetsList.length){
            page = baltopPaquetsList.length
        }

        let firstPage = baltopFunctions.getEmbedFromBaltopPaquet(interaction.guild.iconURL(), page, baltopPaquetsList.length, baltopPaquetsList[page-1])

        if(baltopPaquetsList.length == 1){ //si il y a qu'une page, ne génère pas les boutons et affiche l'unique page
            await interaction.editReply({embeds:[firstPage]})
            return;
        }
        //dans le cas contraire génère les boutons
        let buttonRows = await baltopFunctions.getSwitchPagesButtons(interaction.client, interaction, page, baltopPaquetsList, interaction.user)

        await interaction.editReply({embeds:[firstPage], components: [buttonRows]}) //affiche la page demandée + les boutons
    },
};