const { MessageFlags, SlashCommandBuilder } = require('discord.js');

const apiDB = require("../functions/apiDB");
const constants = require("../data/constants.js");
const mentionSafety = require("../functions/mentionSafety");

const PICK_BASE_TIMER_SETTING = "pickBaseTimerMs";
const OWNER_ID = '1147963951989149796';

const TIMER_CHOICES = [
    { name: "15 minutes", value: 15 * 60 * 1000 },
    { name: "30 minutes", value: 30 * 60 * 1000 },
    { name: "45 minutes", value: 45 * 60 * 1000 },
    { name: "1 heure", value: 60 * 60 * 1000 },
    { name: "1 heure 30", value: 90 * 60 * 1000 },
    { name: "2 heures", value: 2 * 60 * 60 * 1000 },
    { name: "3 heures", value: 3 * 60 * 60 * 1000 },
    { name: "4 heures", value: 4 * 60 * 60 * 1000 },
    { name: "5 heures", value: 5 * 60 * 60 * 1000 },
    { name: "6 heures", value: 6 * 60 * 60 * 1000 }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("pick-timer")
        .setDescription("Change le timer de base du /pick")
        .addIntegerOption(option => option
            .setName("timer")
            .setDescription("Nouveau timer de base du /pick")
            .setRequired(true)
            .addChoices(...TIMER_CHOICES))
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

        await interaction.deferReply();
        const selectedTimer = interaction.options.getInteger("timer");
        await apiDB.withGuild(getConfigGuildID(interaction), async () => {
            await apiDB.setPersistentSetting(PICK_BASE_TIMER_SETTING, selectedTimer);
        });
        interaction.client.quickPickTimeMultiplicator = selectedTimer / constants.RANKIDTORANKQUICKPICKTIMEDICO[1];

        const selectedChoice = TIMER_CHOICES.find(choice => choice.value == selectedTimer);
        await interaction.editReply(`Le timer de base du /pick est maintenant : ${selectedChoice?.name || `${selectedTimer}ms`}.`);
    },
};

const getConfigGuildID = (interaction) => {
    return interaction.client.mainGuildID || interaction.guildId;
}
