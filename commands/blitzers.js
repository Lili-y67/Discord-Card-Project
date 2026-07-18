const { SlashCommandBuilder } = require('discord.js');


const apiDB = require("../functions/apiDB")
const constants = require("../data/constants.js")

const blitzersFunctions = require("../functions/secondLayerBlitzersFunctions")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("blitzers")
        .setDescription("Voir une liste paginée de cartes possédées")
        .addUserOption(option => option.setName("user").setDescription("Utilisateur"))
        .addIntegerOption(option => option.setName("page").setDescription("page"))
        .addStringOption(option => option.setName("filter").setDescription(`${constants.RARITYVALUEFILTER} | ${constants.PLAYERIDFILTER} | ${constants.CARDIDFILTER}`))
        .addBooleanOption(option => option.setName("ascendant").setDescription("ascendant/descendant (false par défaut)"))
        .setDMPermission(false),
    async execute(interaction) {
		console.log("BEFORE DELAY " + Date.now().toString())
        await interaction.deferReply();
		console.log("POST DELAY " + Date.now().toString())
        //récupère les options si il y en a
        let userRequested = interaction.options.getUser("user", false) == null ? interaction.user : interaction.options.getUser("user", false)
        let filter = interaction.options.getString("filter", false) == null ? "none" : interaction.options.getString("filter", false)
        let ascendant = interaction.options.getBoolean("ascendant", false) == null ? false : interaction.options.getBoolean("ascendant", false)
        let page = interaction.options.getInteger("page", false) == null ? 1 : interaction.options.getInteger("page", false)

        await apiDB.prepareUser(userRequested.id.toString(), userRequested.username)

        if(!(await apiDB.doesUserHaveCard(userRequested.id))){  //check si l'utilisateur demandé a au moins un carte
            await interaction.editReply({ embeds: [await blitzersFunctions.getNoCardYetEmbed(userRequested)]})
            return;
        }

        //récupère la liste de paquets (tas de [nombre de cartes max par page] de cartes)
        let cardIDPaquetListInitiator = await blitzersFunctions.getSortedCardIDPaquetListForBlitzersInitiation(userRequested.id, filter, ascendant)

        //check que la page demandée est valide
        if(page<1){
            page = 1
        }
        if(page>cardIDPaquetListInitiator.length){
            page = cardIDPaquetListInitiator.length
        }

        //génère la première page à afficher (celle du paquet numéro page)
        let firstPage = await blitzersFunctions.getEmbedFromCardIDPaquet(userRequested, page, cardIDPaquetListInitiator.length, cardIDPaquetListInitiator[page-1])

        if(cardIDPaquetListInitiator.length == 1){  //si il y a qu'une page, ne génère pas les boutons et affiche l'unique page
            await interaction.editReply({embeds:[firstPage]})
            return;
        }
        //dans le cas contraire génère les boutons
        let buttonRows = await blitzersFunctions.getSwitchPagesButtons(interaction.client, interaction, page, cardIDPaquetListInitiator, userRequested)

        await interaction.editReply({embeds:[firstPage], components: [buttonRows]}) //affiche la page demandée + les boutons
    },
};
