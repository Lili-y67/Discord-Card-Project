const { SlashCommandBuilder } = require('discord.js');

const apiDB = require("../functions/apiDB")
const transactionFunctions = require("../functions/secondLayerTransactionFunctions")
const cardFunctions = require("../functions/secondLayerCardFunctions")
const utilsFunctions = require("../functions/utilsFunctions")
const constants = require("../data/constants")

module.exports = {
	data: new SlashCommandBuilder()
		.setName('cardcolor')
		.setDescription(`Changer la couleur de l'embed d'une carte pour ${constants.CHANGECARDEMBEDCOLORPRICE.toString()}$`)
		.addIntegerOption(option => option.setName("cardid").setDescription("Card ID").setRequired(true))
        .addStringOption(option => option.setName("code_couleur").setDescription("Code couleur hexadécimal").setRequired(true))
		.setDMPermission(false),
	async execute(interaction) {

		await interaction.deferReply();

		if(interaction.options.getInteger("cardid", false) == null){
			await interaction.editReply(`Erreur : veuillez préciser une card id`)
			return;
		}

        if(interaction.options.getString("code_couleur", false) == null){
			await interaction.editReply(`Erreur : veuillez préciser une couleur`)
			return;
		}

        let cardID = interaction.options.getInteger("cardid", true)

        if(!(await apiDB.doesUserOwnThisCard(cardID, interaction.user.id))){
            await interaction.editReply(`La carte renseignée ne vous appartient pas`)
			return;
        }

        if(!(await apiDB.hasEnoughMoney(interaction.user.id, constants.CHANGECARDEMBEDCOLORPRICE))){
            await interaction.editReply(`Vous n'avez pas assez d'argent pour effectuer cette action`)
			return;
        }

        let colorCode = interaction.options.getString("code_couleur", true).toUpperCase()


        if(!utilsFunctions.isStringAnHexadecimalColorCode(colorCode)){
            await interaction.editReply(`Le code couleur que vous avez renseigné est invalide`)
			return;
        }

		await apiDB.prepareUser(interaction.user.id, interaction.user.username)

        transactionFunctions.subMoney(interaction.user.id, constants.CHANGECARDEMBEDCOLORPRICE)
        await apiDB.setCardEmbedColorCode(cardID, "#" + colorCode)



        await interaction.editReply({embeds: [await cardFunctions.getCardEmbed(interaction.client, cardID), transactionFunctions.getBalanceModificationEmbed(interaction.user, -constants.CHANGECARDEMBEDCOLORPRICE)]})

	},
};