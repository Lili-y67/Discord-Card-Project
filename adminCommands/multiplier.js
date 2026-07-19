const { SlashCommandBuilder } = require('discord.js');

const apiDB = require('../functions/apiDB');

const OWNER_ID = '1147963951989149796';
const SETTING_NAMES = {
    daily: 'dailyMoneyMultiplier',
    cartes: 'cardMoneyMultiplier'
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
        if(interaction.user.id !== OWNER_ID){
            await interaction.reply({
                content: 'Cette commande est réservée au propriétaire du bot.',
                ephemeral: true
            });
            return;
        }

        const type = interaction.options.getString('type', true);
        const value = interaction.options.getNumber('valeur', true);
        const settingName = SETTING_NAMES[type];

        await apiDB.withGuild(getConfigGuildID(interaction), async () => {
            await apiDB.setPersistentSetting(settingName, value);
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
