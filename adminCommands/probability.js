const { MessageFlags, SlashCommandBuilder } = require('discord.js');

const apiDB = require("../functions/apiDB");
const constants = require("../data/constants.js");
const mentionSafety = require("../functions/mentionSafety");

const OWNER_ID = '1147963951989149796';

module.exports = {
    data: new SlashCommandBuilder()
        .setName("probability")
        .setDescription("Change la probabilité d'une rareté")
        .addStringOption(option => option
            .setName("rarete")
            .setDescription("Rareté à modifier")
            .setRequired(true)
            .addChoices(...constants.RARITIES.map(rarity => ({ name: rarity.name, value: rarity.name }))))
        .addNumberOption(option => option
            .setName("pourcentage")
            .setDescription("Nouvelle probabilité en %, entre 0.0001 et 75")
            .setRequired(true)
            .setMinValue(0.0001)
            .setMaxValue(75))
        .setDMPermission(false),

    async execute(interaction) {
        if(interaction.user.id !== OWNER_ID){
            await interaction.reply({
                content: 'Cette commande est réservée au propriétaire du bot.',
                flags: MessageFlags.Ephemeral,
                allowedMentions: mentionSafety.SAFE_ALLOWED_MENTIONS
            });
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const rarityName = interaction.options.getString("rarete", true);
        const probability = interaction.options.getNumber("pourcentage", true);

        const result = await apiDB.withGuild(getConfigGuildID(interaction), async () => {
            return await apiDB.setRarityProbability(rarityName, probability);
        });

        if(!result.ok){
            await interaction.editReply(result.error);
            return;
        }

        await interaction.editReply(`${rarityName} est maintenant à ${formatPercent(result.probability)}%. Les autres raretés se sont ajustées automatiquement.`);
    }
};

const getConfigGuildID = (interaction) => {
    return interaction.client.mainGuildID || interaction.guildId;
}

const formatPercent = (value) => {
    return Number(value || 0).toFixed(4).replace(/\.?0+$/, "");
}
