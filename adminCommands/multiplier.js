const { SlashCommandBuilder } = require('discord.js');

const apiDB = require('../functions/apiDB');

const SETTING_NAMES = {
    daily: 'dailyMoneyMultiplier',
    cartes: 'cardMoneyMultiplier'
};
const UNTIL_SETTING_NAMES = {
    daily: 'dailyMoneyMultiplierUntil',
    cartes: 'cardMoneyMultiplierUntil'
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('multiplier')
        .setDescription('Modifie le multiplicateur des gains')
        .addStringOption(option => option
            .setName('type')
            .setDescription('Gain à modifier')
            .setRequired(true)
            .addChoices(
                { name: 'Daily', value: 'daily' },
                { name: 'Cartes', value: 'cartes' }
            ))
        .addNumberOption(option => option
            .setName('valeur')
            .setDescription('Exemple : 0.5 divise par deux, 2 double les gains')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(100))
        .setDMPermission(false),

    async execute(interaction) {
        const type = interaction.options.getString('type', true);
        const value = interaction.options.getNumber('valeur', true);
        const settingName = SETTING_NAMES[type];

        await apiDB.withGuild(getConfigGuildID(interaction), async () => {
            await apiDB.setPersistentSetting(settingName, value);
            await apiDB.setPersistentSetting(UNTIL_SETTING_NAMES[type], 0);
        });
        await interaction.reply({
            content: `Le multiplicateur des gains ${type === 'daily' ? 'du /daily' : 'des cartes'} est maintenant de x${value}.`,
            ephemeral: true
        });
    }
};

const getConfigGuildID = (interaction) => {
    return interaction.client.mainGuildID || interaction.guildId;
}
