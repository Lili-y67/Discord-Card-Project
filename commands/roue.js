const { AttachmentBuilder, ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags, SeparatorBuilder, SlashCommandBuilder } = require('discord.js');

const apiDB = require("../functions/apiDB");
const mentionSafety = require("../functions/mentionSafety");
const questCore = require("../functions/questCore");
const wheelCanvas = require("../functions/wheelCanvas");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("roue")
        .setDescription("Tourner la roue fortune avec un ticket")
        .setDMPermission(false),

    async execute(interaction) {
        await interaction.deferReply();
        await apiDB.ensureDatabaseSchema();
        await apiDB.prepareUser(interaction.user.id, interaction.user.username);

        const result = await questCore.spinWheel(interaction.user.id);
        if(!result.ok){
            await interaction.editReply(mentionSafety.withSafeMentions({
                components: [new ContainerBuilder().setAccentColor(0xD72306)
                    .addTextDisplayComponents(text => text.setContent("## 🎡 Roue de la fortune\nTu n’as pas de ticket. Termine des quêtes pour en gagner."))],
                flags: MessageFlags.IsComponentsV2
            }));
            return;
        }
        const animation = wheelCanvas.generateWheelAnimation(questCore.WHEEL_REWARDS, result.selectedIndex);
        const fileName = `roue-${interaction.user.id}.gif`;
        const container = new ContainerBuilder().setAccentColor(0xF4C542)
            .addTextDisplayComponents(text => text.setContent(`## 🎡 Roue de la fortune\nLa roue de <@${interaction.user.id}> est lancée !`))
            .addMediaGalleryComponents(new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL(`attachment://${fileName}`).setDescription("Roue de la fortune animée")
            )).addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(text => text.setContent(`### 🎉 Résultat\n||**${result.label}**\n${questCore.formatRewardSummary(result.rewards, result.levelResult)}||`));
        await interaction.editReply(mentionSafety.withSafeMentions({
            components: [container], files: [new AttachmentBuilder(animation, { name: fileName })], flags: MessageFlags.IsComponentsV2
        }));
    }
};
