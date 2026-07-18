const { SlashCommandBuilder } = require('discord.js');


const apiDB = require("../functions/apiDB")
const constants = require("../data/constants.js")

const blitzersFunctions = require("../functions/secondLayerBlitzersFunctions")
const researchFunctions = require("../functions/secondLayerResearchFunctions");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("research")
        .setDescription("Voir son inventaire de cartes")
        .addIntegerOption(option => option.setName("playerid").setDescription("playerID du joueur recherché"))
        .addStringOption(option => option
            .setName("rarity")
            .setDescription("Rareté recherchée")
            .addChoices(...constants.RARITIES.map(rarity => ({ name: rarity.name, value: rarity.name })))
        )
        .addBooleanOption(option => option.setName("includes_sold").setDescription("Inclure les cartes vendues dans la recherche (false par défaut)"))
        .addUserOption(option => option.setName("owner").setDescription("Parmi les cartes possédées par l'utilisateur"))
        .addUserOption(option => option.setName("creator").setDescription("Parmi les cartes créées par l'utilisateur"))
        .addUserOption(option => option.setName("excludes_user").setDescription("Ne pas afficher les cartes possédées par cet utilisateur"))
        .addIntegerOption(option => option.setName("page").setDescription("page"))
        .addStringOption(option => option.setName("filter").setDescription(`${constants.RARITYVALUEFILTER} | ${constants.PLAYERIDFILTER} | ${constants.CARDIDFILTER}`))
        .addBooleanOption(option => option.setName("ascendant").setDescription("ascendant/descendant (false par défaut)"))
        .setDMPermission(false),
    async execute(interaction) {

        await interaction.deferReply();

        let playerID = interaction.options.getInteger("playerid", false) == null ? false : interaction.options.getInteger("playerid", false)
        let rarity = interaction.options.getString("rarity", false) == null ? false : interaction.options.getString("rarity", false)
        let includesSold = interaction.options.getBoolean("includes_sold", false) == null ? false : interaction.options.getBoolean("includes_sold", false)
        let userRequested = interaction.options.getUser("owner", false) == null ? false : interaction.options.getUser("owner", false)
        let creatorUser = interaction.options.getUser("creator", false) == null ? false : interaction.options.getUser("creator", false)
        let excludedUser = interaction.options.getUser("excludes_user", false) == null ? false : interaction.options.getUser("excludes_user", false)
        let filter = interaction.options.getString("filter", false) == null ? "none" : interaction.options.getString("filter", false)
        let ascendant = interaction.options.getBoolean("ascendant", false) == null ? false : interaction.options.getBoolean("ascendant", false)
        let page = interaction.options.getInteger("page", false) == null ? 1 : interaction.options.getInteger("page", false)

        console.log(creatorUser)

        if(playerID){
            if(playerID<=0){
                await interaction.editReply("*Espèce de gros fdp tu sais pas combien de temps ça prends de faire des conditions* - Choixpeau, 21 juillet 2022")
                return;
            }
        }

        if(userRequested){
            await apiDB.prepareUser(userRequested.id.toString(), userRequested.username)
        }

        if(creatorUser){
            await apiDB.prepareUser(creatorUser.id.toString(), creatorUser.username)
        }

        
        if(rarity) {
            rarity = rarity.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            if(constants.EVERYRARITYNAMELISTUPPERCASE.includes(rarity.toUpperCase())){
                rarity = constants.EVERYRARITYNAMEUPPERTONORMALDICO[rarity.toUpperCase()]
            }
            else{
                rarity = false
            }
        }

        let cardIDsFoundList = await apiDB.getCardsIDListHUB({ownerID:userRequested?.id?.toString(), creatorID:creatorUser?.id?.toString(), excludedUserID:excludedUser?.id?.toString(), playerID:playerID, rarity:rarity, includesSold:includesSold, filter:filter, ascendant:ascendant})

        if(!cardIDsFoundList.length){
            await interaction.editReply({embeds:[researchFunctions.getNoCardFoundEmbed()]})
            return
        }

        let cardIDPaquetListInitiator = blitzersFunctions.getCardIDPaquetsListFromACardIDList(cardIDsFoundList)

        if(page<1){
            page = 1
        }
        if(page>cardIDPaquetListInitiator.length){
            page = cardIDPaquetListInitiator.length
        }

        let firstPage = await researchFunctions.getEmbedFromCardIDPaquet(cardIDsFoundList.length, page, cardIDPaquetListInitiator.length, cardIDPaquetListInitiator[page-1])

        if(cardIDPaquetListInitiator.length == 1){
            await interaction.editReply({embeds:[firstPage]})
            return;
        }

        let buttonRows = await researchFunctions.getSwitchPagesButtons(interaction.client, interaction, page, cardIDPaquetListInitiator, userRequested, cardIDsFoundList.length)

        await interaction.editReply({embeds:[firstPage], components: [buttonRows]})
    },
};
