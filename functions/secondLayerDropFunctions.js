const {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder,
    MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags, SeparatorBuilder
} = require("discord.js");
const apiDB = require("./apiDB");
const cardFunctions = require("./secondLayerCardFunctions");
const pickFunctions = require("./secondLayerPickFunctions");
const mentionSafety = require("./mentionSafety");
const componentLifecycle = require("./componentLifecycle");

const ACCENT_COLOR = 0xF6A700;

const getDropReply = async drop => {
    const claims = await apiDB.getDropClaims(drop.dropID);
    const playerData = drop.type === "card" ? await apiDB.getPlayerDataFromID(drop.playerID) : null;
    return mentionSafety.withSafeMentions({
        components: [getDropContainer(drop, claims, playerData)],
        flags: MessageFlags.IsComponentsV2
    });
};

const getDropContainer = (drop, claims = [], playerData = null) => {
    const expired = drop.status === "expired" || Date.now() >= Number(drop.expiresAt);
    const complete = claims.length >= drop.maxWinners || drop.status === "complete";
    const playerDisplay = /^\d{17,20}$/.test(playerData?.discordID || "")
        ? `<@${playerData.discordID}>`
        : mentionSafety.escapeMarkdown(playerData?.playerName || `Joueur ${drop.playerID}`);
    const reward = drop.type === "money"
        ? `💰 **${drop.amount}$** par gagnant`
        : drop.type === "points"
        ? `✨ **${drop.amount} points** par gagnant`
        : `🃏 **${drop.copies}× ${drop.rarity}** — ${playerDisplay}${drop.amount ? `\n💰 Bonus : **${drop.amount}$**` : ""}`;
    const winners = claims.length
        ? claims.map((claim, index) => `${index + 1}. <@${claim.userID}>`).join("\n")
        : "Personne pour le moment — soyez le premier !";
    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`drop:claim:${drop.dropID}:${drop.expiresAt}`)
            .setStyle(complete || expired ? ButtonStyle.Secondary : ButtonStyle.Success)
            .setEmoji(complete ? "🏆" : expired ? "⏱️" : "🎁").setLabel(complete ? "Drop réclamé" : expired ? "Fin du drop" : "Réclamer").setDisabled(complete || expired)
    );
    if(drop.type === "card") actionRow.addComponents(
        new ButtonBuilder().setCustomId(`drop:preview:${drop.dropID}:${drop.expiresAt}`)
            .setStyle(ButtonStyle.Primary).setEmoji("🔍").setLabel("Aperçu")
            .setDisabled(expired)
    );
    return new ContainerBuilder().setAccentColor(complete ? 0x39B54A : ACCENT_COLOR)
        .addTextDisplayComponents(text => text.setContent(`## ${drop.title || "🎁 Un drop est disponible !"}\n${drop.description || "Réclamez la récompense avant la fin du temps imparti."}`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(text => text.setContent(`${complete ? "🎉 **Drop terminé — GG aux gagnants !**\n\n" : expired ? "⏱️ **Fin du drop !**\n\n" : ""}${reward}\n\n**Gagnants (${claims.length}/${drop.maxWinners})**\n${winners}`))
        .addSeparatorComponents(new SeparatorBuilder()).addActionRowComponents(actionRow);
};

const handleDropButton = async (client, interaction) => {
    const parts = interaction.customId.split(":");
    if(parts.length !== 4 || parts[0] !== "drop" || !["claim", "preview"].includes(parts[1])) return false;
    const action = parts[1], dropID = parts[2], expiresAt = Number(parts[3]);
    if(componentLifecycle.isExpired(expiresAt)){
        await interaction.deferUpdate().catch(() => {});
        await apiDB.expireDrop(dropID);
        const expiredDrop = await apiDB.getDrop(dropID);
        if(expiredDrop) await interaction.message.edit(await getDropReply(expiredDrop)).catch(() => {});
        return true;
    }
    if(action === "preview") return await showPreview(client, interaction, dropID);

    await apiDB.prepareUser(interaction.user.id, interaction.user.username);
    const result = await apiDB.claimDropSlot(dropID, interaction.user.id);
    if(!result.drop){ await interaction.reply({ content: "Ce drop n’existe plus.", flags: MessageFlags.Ephemeral }); return true; }
    if(!result.won){
        await interaction.reply({ content: result.alreadyClaimed ? "Tu as déjà réclamé ce drop." : "Toutes les places ont déjà été prises.", flags: MessageFlags.Ephemeral });
        if(!result.alreadyClaimed) await interaction.message.edit(await getDropReply(result.drop));
        return true;
    }
    await interaction.deferUpdate();
    try {
        let rewardText;
        if(result.drop.type === "money"){
            await apiDB.addMoneyToUser(interaction.user.id, result.drop.amount);
            rewardText = `Tu remportes **${result.drop.amount}$** !`;
        } else if(result.drop.type === "points"){
            await apiDB.addPointsToUser(interaction.user.id, result.drop.amount);
            rewardText = `Tu remportes **${result.drop.amount} points** !`;
        } else {
            const cardIDs = await pickFunctions.makeDropCards(client, interaction.user, result.drop.playerID, result.drop.rarity, result.drop.copies);
            if(result.drop.amount > 0) await apiDB.addMoneyToUser(interaction.user.id, result.drop.amount);
            rewardText = `Tu remportes ${cardIDs.length > 1 ? `les cartes **#${cardIDs.join(", #")}**` : `la carte **#${cardIDs[0]}**`}${result.drop.amount ? ` et **${result.drop.amount}$**` : ""} !`;
        }
        await interaction.message.edit(await getDropReply(await apiDB.getDrop(dropID)));
        await interaction.followUp({ content: `🎉 ${rewardText}`, flags: MessageFlags.Ephemeral });
    } catch(error) {
        await apiDB.releaseDropClaim(dropID, interaction.user.id);
        await interaction.followUp({ content: `Le gain n’a pas pu être créé : ${error.message}`, flags: MessageFlags.Ephemeral });
    }
    return true;
};

const showPreview = async (client, interaction, dropID) => {
    const drop = await apiDB.getDrop(dropID);
    if(!drop || drop.type !== "card"){ await interaction.reply({ content: "Aucun aperçu disponible.", flags: MessageFlags.Ephemeral }); return true; }
    try {
        const playerData = await apiDB.getPlayerDataFromID(drop.playerID);
        const preview = await cardFunctions.generateCardPreviewImage(client, playerData, drop.rarity);
        const fileName = preview.name;
        const playerDisplay = /^\d{17,20}$/.test(playerData?.discordID || "")
            ? `<@${playerData.discordID}>`
            : mentionSafety.escapeMarkdown(playerData?.playerName || `Joueur ${drop.playerID}`);
        const container = new ContainerBuilder().setAccentColor(ACCENT_COLOR)
            .addTextDisplayComponents(text => text.setContent(`## 🔍 Aperçu du drop\n${drop.rarity} — ${playerDisplay}`))
            .addMediaGalleryComponents(new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL(`attachment://${fileName}`).setDescription("Aperçu de la carte")
            ));
        await interaction.reply(mentionSafety.withSafeMentions({ components: [container], files: [preview], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral }));
    } catch(error) {
        await interaction.reply({ content: `Aperçu indisponible : ${error.message}`, flags: MessageFlags.Ephemeral });
    }
    return true;
};

const scheduleDropExpiration = (interaction, drop) => {
    setTimeout(async () => {
        await apiDB.withGuild(interaction.guildId, async () => {
            await apiDB.expireDrop(drop.dropID);
            const expiredDrop = await apiDB.getDrop(drop.dropID);
            if(expiredDrop) await interaction.editReply(await getDropReply(expiredDrop)).catch(() => {});
        });
    }, Math.max(drop.expiresAt - Date.now(), 0));
};

module.exports = { getDropReply, handleDropButton, scheduleDropExpiration };
