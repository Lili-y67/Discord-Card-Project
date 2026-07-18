const { SlashCommandBuilder } = require('discord.js');

const apiDB = require("../functions/apiDB")
const cardFunctions = require("../functions/secondLayerCardFunctions")
const sellFunctions = require("../functions/secondLayerSellFunctions");

module.exports = {
	data: new SlashCommandBuilder()
		.setName('sell')
		.setDescription("Vendre une carte à la banque")
        .addIntegerOption(option => option.setName("cardid").setDescription("Card ID").setRequired(true))
		.setDMPermission(false),
	async execute(interaction) {
        await interaction.deferReply();
		if(interaction.options.getInteger("cardid", false) == null){
			await interaction.editReply(`Erreur dans les options de la commande`)
			return;
		}
        let cardID = interaction.options.getInteger("cardid", true)
		await apiDB.prepareUser(interaction.user.id, interaction.user.username)
        if(await apiDB.isCardRegistered(cardID)){
            if(await apiDB.doesUserOwnThisCard(cardID, interaction.user.id)){
				if(!await apiDB.isACardLocked(cardID)){
					await apiDB.lockACard(cardID)
					let cardEmbed = await cardFunctions.getCardEmbed(interaction.client, cardID)
					let sellEmbed = await sellFunctions.getConfirmationSellEmbed(cardID)
					let buttonsRow = await sellFunctions.getSellConfirmationButtons(interaction.client, interaction, cardID)

					interaction.editReply({ embeds: [cardEmbed, sellEmbed], components: [buttonsRow]})
				}
				else{
					interaction.editReply('Cette carte est actuellement lock!')
				}
            }
            else{
                interaction.editReply('Vous ne possédez même pas la carte, bouffinos !')
            }
		}
		else{
			interaction.editReply(`La carte numéro ${cardID} n'existe pas`)
		}
	},
};