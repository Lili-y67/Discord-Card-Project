const { SlashCommandBuilder } = require('discord.js');


const apiDB = require("../functions/apiDB")
const cardFunctions = require("../functions/secondLayerCardFunctions")

module.exports = {
	data: new SlashCommandBuilder()
		.setName('card')
		.setDescription("Voir les informations d'une carte")
		.addIntegerOption(option => option.setName("cardid").setDescription("Card ID").setRequired(true))
		.setDMPermission(false),
	async execute(interaction) {

		await interaction.deferReply();

		if(interaction.options.getInteger("cardid", false) == null){
			await interaction.editReply(`Erreur dans les options de la commande`)
			return;
		}

		let cardID = interaction.options.getInteger("cardid", true)

		if(await apiDB.isCardRegistered(cardID)){

			let cardEmbed = await cardFunctions.getCardEmbed(interaction.client, cardID)

			await interaction.editReply({ embeds: [cardEmbed] })
		}
		else{
			await interaction.editReply(`La carte numéro ${cardID} n'existe pas`)
		}
	},
};