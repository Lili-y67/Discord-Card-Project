const {
    ActionRowBuilder,
    AttachmentBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags,
    SeparatorBuilder,
    SlashCommandBuilder
} = require("discord.js");

const apiDB = require("../functions/apiDB");
const componentLifecycle = require("../functions/componentLifecycle");
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
        await apiDB.prepareQuestUser(interaction.user.id);

        const questStats = await apiDB.getQuestUserStats(interaction.user.id);
        if(Number(questStats?.wheelTickets) <= 0){
            await interaction.editReply(mentionSafety.withSafeMentions({
                components: [new ContainerBuilder().setAccentColor(0xD72306)
                    .addTextDisplayComponents(text => text.setContent(
                        "## 🎡 Roue de la fortune\nTu n’as pas de ticket. Termine des quêtes pour en gagner."
                    ))],
                flags: MessageFlags.IsComponentsV2
            }));
            return;
        }

        const expiresAt = componentLifecycle.createExpiresAt();
        const geometry = wheelCanvas.getGeometry(questCore.WHEEL_REWARDS);
        const preview = wheelCanvas.drawWheelFrame(questCore.WHEEL_REWARDS, geometry, 0, 0, false).toBuffer("image/png");
        const fileName = `roue-apercu-${interaction.user.id}.png`;
        const container = new ContainerBuilder().setAccentColor(0xF4C542)
            .addTextDisplayComponents(text => text.setContent(
                `## 🎡 Roue de la fortune\n<@${interaction.user.id}>, clique sur **Lancer la roue** pour utiliser un ticket.`
            ))
            .addMediaGalleryComponents(new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL(`attachment://${fileName}`).setDescription("Roue de la fortune")
            ))
            .addSeparatorComponents(new SeparatorBuilder())
            .addActionRowComponents(new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`wheel:spin:${interaction.user.id}:${expiresAt}`)
                    .setLabel("Lancer la roue")
                    .setEmoji("🎟️")
                    .setStyle(ButtonStyle.Success)
            ));

        await interaction.editReply(mentionSafety.withSafeMentions({
            components: [container],
            files: [new AttachmentBuilder(preview, { name: fileName })],
            flags: MessageFlags.IsComponentsV2
        }));
        componentLifecycle.scheduleInteractionExpiration(interaction, "roue", expiresAt);
    },

    async handleButton(client, interaction) {
        const parts = interaction.customId.split(":");
        if(parts.length !== 4 || parts[0] !== "wheel" || parts[1] !== "spin") return false;

        const userID = parts[2];
        const expiresAt = Number(parts[3]);
        if(interaction.user.id !== userID){
            await interaction.reply({ content: "Cette roue ne t’appartient pas.", flags: MessageFlags.Ephemeral });
            return true;
        }
        if(componentLifecycle.isExpired(expiresAt)){
            await componentLifecycle.expireInteractedMessage(interaction, "roue", interaction.commandId);
            return true;
        }

        await interaction.deferUpdate();
        const result = await questCore.spinWheel(interaction.user.id);
        if(!result.ok){
            await interaction.editReply(mentionSafety.withSafeMentions({
                components: [new ContainerBuilder().setAccentColor(0xD72306)
                    .addTextDisplayComponents(text => text.setContent(
                        "## 🎡 Roue de la fortune\nTu n’as pas de ticket. Termine des quêtes pour en gagner."
                    ))],
                attachments: [],
                flags: MessageFlags.IsComponentsV2
            }));
            return true;
        }

        const animation = wheelCanvas.generateWheelAnimation(questCore.WHEEL_REWARDS, result.selectedIndex);
        const fileName = `roue-${interaction.user.id}.gif`;
        const container = new ContainerBuilder().setAccentColor(0xF4C542)
            .addTextDisplayComponents(text => text.setContent(`## 🎡 Roue de la fortune\nLa roue de <@${interaction.user.id}> est lancée !`))
            .addMediaGalleryComponents(new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL(`attachment://${fileName}`).setDescription("Roue de la fortune animée")
            ))
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(text => text.setContent(
                `### 🎉 Résultat\n||**${result.label}**\n${questCore.formatRewardSummary(result.rewards, result.levelResult)}||`
            ));
        await interaction.editReply(mentionSafety.withSafeMentions({
            components: [container],
            attachments: [],
            files: [new AttachmentBuilder(animation, { name: fileName })],
            flags: MessageFlags.IsComponentsV2
        }));
        return true;
    }
};
