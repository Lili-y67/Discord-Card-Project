const { SlashCommandBuilder } = require('discord.js');

const apiDB = require("../functions/apiDB")

const profileFunctions = require("../functions/secondLayerProfileFunctions")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("profil")
        .setDescription("Voir le profil d'un utilisateur")
        .addUserOption(option => option.setName("user").setDescription("The user"))
        .setDMPermission(false),
    async execute(interaction) {
        const userRequested = interaction.options.getUser("user", false) == null ? interaction.user : interaction.options.getUser("user", false)
        await apiDB.prepareUser(userRequested.id.toString(), userRequested.username)
        await apiDB.updateUserName(userRequested.id, userRequested.username)
        await interaction.reply(await profileFunctions.getProfileReply(userRequested, interaction.user))
    },
};
