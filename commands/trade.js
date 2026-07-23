const { MessageFlags, SlashCommandBuilder } = require("discord.js");
const apiDB = require("../functions/apiDB");
const tradeBuilder = require("../functions/tradeBuilderFunctions");

module.exports = {
    data: new SlashCommandBuilder().setName("trade").setDescription("Créer un échange interactif")
        .addUserOption(option => option.setName("user").setDescription("Partenaire de l’échange").setRequired(true))
        .addIntegerOption(option => option.setName("argent_proposé").setDescription("Argent que vous proposez").setMinValue(0))
        .addIntegerOption(option => option.setName("argent_demandé").setDescription("Argent que vous demandez").setMinValue(0))
        .setDMPermission(false),
    async execute(interaction) {
        const partner = interaction.options.getUser("user", true);
        if(partner.id === interaction.user.id || partner.bot){ await interaction.reply({ content: "Choisis un autre membre humain.", flags: MessageFlags.Ephemeral }); return; }
        await apiDB.prepareUser(interaction.user.id, interaction.user.username); await apiDB.prepareUser(partner.id, partner.username);
        const state = await tradeBuilder.createTrade(interaction, partner, interaction.options.getInteger("argent_proposé") || 0, interaction.options.getInteger("argent_demandé") || 0);
        const reply = await tradeBuilder.getReply(state);
        reply.allowedMentions = { parse: [], users: [partner.id], roles: [], repliedUser: false };
        await interaction.reply(reply);
        tradeBuilder.schedule(state);
    }
};
