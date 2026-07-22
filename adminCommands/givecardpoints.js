const { SlashCommandBuilder } = require('discord.js');
const apiDB = require("../functions/apiDB")


const transactionFunctions = require("../functions/secondLayerTransactionFunctions")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("givecardpoints")
        .setDescription("Give des points à un joueur")
        .addUserOption(option => option.setName("user").setDescription("Utilisateur ciblé").setRequired(true))
        .addIntegerOption(option => option.setName("amount").setDescription("Amount").setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply();
        const requestedUser = interaction.options.getUser("user", true)
        let requestedUserID = requestedUser.id
        let amount = interaction.options.getInteger("amount")
        await apiDB.prepareUser(requestedUserID, requestedUser.username)
        await transactionFunctions.giveCardPoints(requestedUserID, amount)
        await interaction.editReply(`${amount.toString()} pts ont été ajoutés à l'utilisateur ${requestedUserID}`)
    },
};
