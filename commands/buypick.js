const { SlashCommandBuilder } = require('discord.js');

const pickFunctions = require("../functions/secondLayerPickFunctions")
const constants = require("../data/constants.js")

const apiDB = require("../functions/apiDB");




module.exports = {
	data: new SlashCommandBuilder()
		.setName('buypick')
		.setDescription("Acheter un tirage")
		.setDMPermission(false),
	async execute(interaction) {
		await interaction.deferReply();

		await apiDB.prepareUser(interaction.user.id, interaction.user.username)

        if(!await apiDB.hasEnoughMoney(interaction.user.id, constants.BUYPICKPRICE)){ //check si l'utilisateur a l'argent nécessaire
            await interaction.editReply({embeds:[pickFunctions.getNotEnoughMoneyToBuyPickEmbed(interaction.user)]})
            return;
        }

		let buyPick = await pickFunctions.makeBuyPick(interaction.client, interaction.user, interaction.user.id)
		if(buyPick.error){
			await interaction.editReply(buyPick.error)
			return;
		}
        await interaction.editReply({embeds:buyPick.embeds})
	},
};
