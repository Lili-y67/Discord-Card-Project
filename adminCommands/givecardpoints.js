const { SlashCommandBuilder } = require('discord.js');
const apiDB = require("../functions/apiDB")


const transactionFunctions = require("../functions/secondLayerTransactionFunctions")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("givecardpoints")
        .setDescription("Give des points à un joueur")
        .addStringOption(option => option.setName("discordid").setDescription("L'id discord de l'utilisateur").setRequired(true))
        .addIntegerOption(option => option.setName("amount").setDescription("Amount").setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply();
        let requestedUserID = interaction.options.getString("discordid")
        let amount = interaction.options.getInteger("amount")
        await apiDB.prepareUser(requestedUserID)
        await transactionFunctions.giveCardPoints(requestedUserID, amount)
        await interaction.editReply(`${amount.toString()} pts ont été ajoutés à l'utilisateur ${requestedUserID}`)
    },
};