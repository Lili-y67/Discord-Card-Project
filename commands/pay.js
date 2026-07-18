const { SlashCommandBuilder } = require('discord.js');

const apiDB = require("../functions/apiDB")

const transactionFunctions = require("../functions/secondLayerTransactionFunctions")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("pay")
        .setDescription("Donner de l'argent à un utilisateur")
        .addUserOption(option => option.setName("user").setDescription("Celui recevant l'argent").setRequired(true))
        .addIntegerOption(option => option.setName("amount").setDescription("The user").setRequired(true))
        .setDMPermission(false),
    async execute(interaction) {
        await interaction.deferReply();


        //useless en théorie
        
        if(interaction.options.getUser("user", false) == null){
            await interaction.editReply("Veuillez préciser un utilisateur qui recevra la somme")
            return;
        }

        //useless en théorie

        if(interaction.options.getInteger("amount", false) == null){
            await interaction.editReply("Veuillez préciser le montant de la transaction")
            return;
        }
        

        let amount = interaction.options.getInteger("amount", false)

        await apiDB.prepareUser(interaction.user.id.toString(), interaction.user.username)

        if(!(await apiDB.hasEnoughMoney(interaction.user.id, amount))){
            await interaction.editReply("Vous n'avez pas l'argent nécessaire pour effectuer cette transaction")
            return;
        }

        let userReceiver = interaction.options.getUser("user", false)

        if(interaction.user.id == userReceiver.id){
            await interaction.editReply("En toute logique, vous ne pouvez pas vous verser de l'argent :)")
            return;
        }

        if(amount <= 0){
            await interaction.editReply("Petit malin... ça aurait presque pu fonctionner")
            return;
        }

        await apiDB.prepareUser(userReceiver.id.toString(), userReceiver.username)
        
        transactionFunctions.makeATransactionBetweenUsers(interaction.user.id, userReceiver.id, amount)

        await interaction.editReply({embeds:[transactionFunctions.getTransactionBetweenUsersCompletedEmbed(interaction.user, userReceiver, amount)]})
    },
};