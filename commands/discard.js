const { SlashCommandBuilder } = require('discord.js');

const apiDB = require("../functions/apiDB")
const cardFunctions = require("../functions/secondLayerCardFunctions")
const sellFunctions = require("../functions/secondLayerSellFunctions");
const discardFunctions = require("../functions/secondLayerDiscardFunctions");

module.exports = {
	data: new SlashCommandBuilder()
		.setName('discard')
		.setDescription("Convertir une carte en point(s)")
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

        if(!(await apiDB.doesUserOwnThisCard(cardID, interaction.user.id))){
            await interaction.editReply('Vous ne possédez même pas la carte, bouffinos !')
            return
        }
        if(await apiDB.isACardLocked(cardID)){
            await interaction.editReply('Cette carte est actuellement lock!')
            return
        }


		await apiDB.lockACard(cardID)
		let cardEmbed = await cardFunctions.getCardEmbed(interaction.client, cardID)
		let discardEmbed = await discardFunctions.getConfirmationDiscardEmbed(cardID)
		let buttonsRow = await discardFunctions.getDiscardConfirmationButtons(interaction.client, interaction, cardID)

		await interaction.editReply({ embeds: [cardEmbed, discardEmbed], components: [buttonsRow]})
	},
};