const { SlashCommandBuilder } = require('discord.js');
const apiDB = require("../functions/apiDB")


const transactionFunctions = require("../functions/secondLayerTransactionFunctions")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("submoney")
        .setDescription("Enlever de l'argent à un joueur")
        .addStringOption(option => option.setName("discordid").setDescription("L'id discord de l'utilisateur").setRequired(true))
        .addIntegerOption(option => option.setName("amount").setDescription("Amount").setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply();
        let requestedUserID = interaction.options.getString("discordid")
        let amount = interaction.options.getInteger("amount")
        await apiDB.prepareUser(requestedUserID)
        await transactionFunctions.subMoney(requestedUserID, amount)
        await interaction.editReply(`${amount.toString()}$ ont été retirés à l'utilisateur ${requestedUserID}`)
    },
};