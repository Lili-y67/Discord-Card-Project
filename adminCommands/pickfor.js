const { SlashCommandBuilder } = require('discord.js');
const apiDB = require("../functions/apiDB")

const pickFunctions = require("../functions/secondLayerPickFunctions")



module.exports = {  //effectue un pick pour un utilisateur; n'intéragis JAMAIS avec le cooldown du /pick; donne l'argent et la carte comme un /pick
    data: new SlashCommandBuilder()
        .setName("pickfor")
        .setDescription("pick une carte pour un utilisateur")
        .addUserOption(option => option.setName("user").setDescription("Utilisateur ciblé").setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply();

        const requestedUser = interaction.options.getUser("user", true)
        let requestedUserID = requestedUser.id

        await apiDB.prepareUser(requestedUserID, requestedUser.username)

        let pickForRes = await pickFunctions.makePickFor(interaction.client, requestedUserID)
        if(pickForRes.error){
            await interaction.editReply(pickForRes.error)
            return;
        }

        await interaction.editReply({embeds:pickForRes.embeds})
    },
};
