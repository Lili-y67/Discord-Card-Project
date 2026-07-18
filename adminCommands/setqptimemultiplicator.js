const { SlashCommandBuilder } = require('discord.js');


const buttonCenter = require("../functions/buttonCenter")

module.exports = {  //modifie le cooldown du /pick; le temps d'attente de chaque utilisateur sera multiplié par cette valeur ==> si valeur > 1, le temps sera donc plus grand que la normal et inversement
    data: new SlashCommandBuilder()
        .setName("setqptimemultiplicator")
        .setDescription("Mettre le bot en maintenance/le réactiver")
        .addNumberOption(option => option.setName("qptimemultiplicator").setDescription("Multiplicateur du temps nécessaire entre chaque pick").setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply();
        let multiplicator = interaction.options.getNumber("qptimemultiplicator")
        interaction.client.quickPickTimeMultiplicator = multiplicator
        console.log(`Le multiplicateur de temps entre chaque pick est maintenant : ${multiplicator}`)
        await interaction.editReply(`Le multiplicateur de temps entre chaque pick est maintenant : ${multiplicator}`)
    },
};