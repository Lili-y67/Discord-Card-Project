const { SlashCommandBuilder } = require('discord.js');

const cardsListFunctions = require("../functions/secondLayerCardsListFunctions");
const componentLifecycle = require("../functions/componentLifecycle");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("cards")
        .setDescription("Parcourir les cartes enregistrées")
        .addStringOption(option =>
            option
                .setName("tri")
                .setDescription("Ordre d'affichage des cartes")
                .addChoices(
                    { name: "Numéro", value: cardsListFunctions.SORT_NUMBER },
                    { name: "Rareté", value: cardsListFunctions.SORT_RARITY }
                )
        )
        .setDMPermission(false),
    async execute(interaction) {
        const sort = interaction.options.getString("tri", false) || cardsListFunctions.SORT_NUMBER;
        const expiresAt = componentLifecycle.createExpiresAt();
        await interaction.reply(await cardsListFunctions.getCardsReply(interaction.client, interaction.user, sort, 1, expiresAt));
        componentLifecycle.scheduleInteractionExpiration(interaction, "cards", expiresAt);
    },
};
