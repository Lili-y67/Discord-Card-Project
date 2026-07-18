const { SlashCommandBuilder } = require('discord.js');
const apiDB = require("../functions/apiDB")

const constants = require("../data/constants")

const cardFunctions = require("../functions/secondLayerCardFunctions")
const pickFunctions = require("../functions/secondLayerPickFunctions")


module.exports = {
    data: new SlashCommandBuilder()
        .setName("modif")
        .setDescription("Modifier une carte déjà existante")
        .addIntegerOption(option => option.setName("cardid").setDescription("L'id de la carte à modifier").setRequired(true))
        .addIntegerOption(option => option.setName("rarityvalue").setDescription("Nouvelle rarity value de la carte").setRequired(false))
        .addStringOption(option => option
            .setName("rarity")
            .setDescription("Nouvelle rarity de la carte")
            .setRequired(false)
            .addChoices(...constants.RARITIES.map(rarity => ({ name: rarity.name, value: rarity.name })))
        )
        .addIntegerOption(option => option.setName("playerid").setDescription("Nouveau playerid de la carte").setRequired(false)),
    async execute(interaction) {
        await interaction.deferReply();
        let cardID = interaction.options.getInteger("cardid")
        let newRarityValue = interaction.options.getInteger("rarityvalue", false) == null ? false : interaction.options.getInteger("rarityvalue", false)
        let newPlayerID = interaction.options.getInteger("playerid", false) == null ? false : interaction.options.getInteger("playerid", false)
        let newRarity = interaction.options.getString("rarity", false) == null ? false : interaction.options.getString("rarity", false)
        if(!(!(newRarityValue===false) || !(newPlayerID===false) || !(newRarity===false))){
            await interaction.editReply(`Aucune modification`)
            return;
        }


        if(!(await apiDB.isCardRegistered(cardID))){
            await interaction.editReply(`Carte inexistante.`)
            return;
        }

        if(!(newRarityValue===false)) {
            if(newRarityValue<constants.MINCARDVALUEQUICKPICK){
                await interaction.editReply(`Rarity value trop petite (minimum ${constants.MINCARDVALUEQUICKPICK})`)
                return;
            }
            
            else if ((newRarityValue>constants.MAXCARDVALUEOVERALL)) {
                await interaction.editReply(`Rarity value trop grande (maximum ${constants.MAXCARDVALUEOVERALL})`)
                return;
            } else {
                if(newRarity===false){
                    newRarity = pickFunctions.getRarityFromRarityValue(newRarityValue)
                }
            }
        }


        await apiDB.editACard(cardID, {rarityValue:newRarityValue, rarity:newRarity, playerID:newPlayerID})
        await cardFunctions.updateCardImageURL(interaction.client, cardID)
        await interaction.editReply({embeds:[await cardFunctions.getCardEmbed(interaction.client, cardID)]})
    },
};
