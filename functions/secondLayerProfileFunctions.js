const Canvas = require("canvas");
const { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags, SeparatorBuilder } = require("discord.js");
const apiDB = require("./apiDB");
const constants = require("../data/constants");
const mentionSafety = require("./mentionSafety");
const componentLifecycle = require("./componentLifecycle");

const BACKGROUNDS = ["black", "navy", "purple", "forest"];
const SETTING_PREFIX = "profileBackground:";

const getProfileReply = async (profileUser, requestedByUser, expiresAt = componentLifecycle.createExpiresAt()) => {
    const userDB = await apiDB.getAUserFromDiscordID(profileUser.id);
    const data = {
        money: Number(userDB.money) || 0,
        points: Number(userDB.cardPoints) || 0,
        rank: constants.RANKIDTORANKNAMEDICO[userDB.rankID] || `Rang ${userDB.rankID}`,
        picked: await apiDB.getPickedCardsNumberOfAUser(profileUser.id),
        owned: await apiDB.getOwnedCardsNumberOfAUser(profileUser.id)
    };
    const background = await getBackground(profileUser.id);
    const fileName = `profil-${profileUser.id}.png`;
    const image = await generateProfileImage(profileUser, data, background);
    const ownProfile = profileUser.id === requestedByUser.id;
    const container = new ContainerBuilder().setAccentColor(0xFC6600)
        .addTextDisplayComponents(text => text.setContent(`## Profil de ${mentionSafety.getUserMention(profileUser.id)}\n-# Fond : ${backgroundLabel(background)}`))
        .addMediaGalleryComponents(new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder().setURL(`attachment://${fileName}`).setDescription(`Profil de ${profileUser.username}`)
        ))
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`profile:bg:${profileUser.id}:${requestedByUser.id}:${background}:${expiresAt}`)
                .setStyle(ButtonStyle.Secondary).setEmoji("🎨").setLabel("Changer le fond").setDisabled(!ownProfile)
        ));
    return mentionSafety.withSafeMentions({
        components: [container], files: [new AttachmentBuilder(image, { name: fileName })], flags: MessageFlags.IsComponentsV2
    });
};

const generateProfileImage = async (user, data, background) => {
    const canvas = Canvas.createCanvas(1100, 460);
    const ctx = canvas.getContext("2d");
    drawBackground(ctx, canvas.width, canvas.height, background);
    ctx.globalAlpha = 0.12; ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(1060, -30, 260, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(980, 550, 210, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    const avatarURL = user.displayAvatarURL({ extension: "png", size: 512, forceStatic: true });
    try {
        const avatar = await Canvas.loadImage(avatarURL);
        ctx.save(); ctx.beginPath(); ctx.arc(175, 185, 112, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(avatar, 63, 73, 224, 224); ctx.restore();
        ctx.strokeStyle = "#ff7a18"; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(175, 185, 116, 0, Math.PI * 2); ctx.stroke();
    } catch(error) {
        ctx.fillStyle = "#ff7a18"; ctx.beginPath(); ctx.arc(175, 185, 112, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = "#ffffff"; ctx.font = "700 42px Arial";
    ctx.fillText(truncate(ctx, getRenderableProfileName(user), 330), 45, 365);
    ctx.fillStyle = "#ff9b54"; ctx.font = "600 23px Arial"; ctx.fillText(data.rank.toUpperCase(), 45, 405);
    drawStat(ctx, 380, 95, "SOLDE", `${data.money.toLocaleString("fr-FR")}$`, "#ffb35c");
    drawStat(ctx, 720, 95, "POINTS", data.points.toLocaleString("fr-FR"), "#c997ff");
    drawStat(ctx, 380, 255, "CARTES PICK", data.picked.toLocaleString("fr-FR"), "#62c8ff");
    drawStat(ctx, 720, 255, "CARTES POSSÉDÉES", data.owned.toLocaleString("fr-FR"), "#7ce5a1");
    return canvas.toBuffer("image/png");
};

const drawBackground = (ctx, width, height, background) => {
    const colors = ({ black: ["#090909", "#242424"], navy: ["#07162f", "#123b68"], purple: ["#190d2d", "#63358b"], forest: ["#071f18", "#1f5943"] })[background] || ["#090909", "#242424"];
    const gradient = ctx.createLinearGradient(0, 0, width, height); gradient.addColorStop(0, colors[0]); gradient.addColorStop(1, colors[1]);
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
};
const drawStat = (ctx, x, y, label, value, color) => {
    ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.beginPath(); ctx.roundRect(x, y, 300, 120, 20); ctx.fill();
    ctx.fillStyle = color; ctx.font = "700 19px Arial"; ctx.fillText(label, x + 24, y + 35);
    ctx.fillStyle = "#ffffff"; ctx.font = "700 40px Arial"; ctx.fillText(value, x + 24, y + 88);
};
const truncate = (ctx, text, width) => { let result = text; while(result.length > 1 && ctx.measureText(result).width > width) result = `${result.slice(0, -2)}…`; return result; };
const getRenderableProfileName = user => {
    const source = user.username || user.globalName || "Utilisateur";
    return source.toString().normalize("NFKC")
        .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, "")
        .replace(/\p{Extended_Pictographic}/gu, "")
        .replace(/[^\p{L}\p{N} ._'-]/gu, " ")
        .replace(/\s+/g, " ").trim() || "Utilisateur";
};

const handleProfileButton = async (client, interaction) => {
    const parts = interaction.customId.split(":");
    if(parts.length !== 6 || parts[0] !== "profile" || parts[1] !== "bg") return false;
    const profileID = parts[2], requesterID = parts[3], background = parts[4], expiresAt = Number(parts[5]);
    if(componentLifecycle.isExpired(expiresAt)){ await componentLifecycle.expireInteractedMessage(interaction, "profil", interaction.commandId); return true; }
    if(interaction.user.id !== profileID || interaction.user.id !== requesterID){
        await interaction.reply({ content: "Seul le propriétaire peut changer ce fond.", flags: MessageFlags.Ephemeral }); return true;
    }
    const next = BACKGROUNDS[(BACKGROUNDS.indexOf(background) + 1) % BACKGROUNDS.length];
    await apiDB.setPersistentTextSetting(`${SETTING_PREFIX}${profileID}`, next);
    const user = await client.users.fetch(profileID); const newExpiresAt = componentLifecycle.createExpiresAt();
    await interaction.update(await getProfileReply(user, user, newExpiresAt));
    componentLifecycle.scheduleInteractionExpiration(interaction, "profil", newExpiresAt); return true;
};

const getBackground = async id => { const value = await apiDB.getPersistentTextSetting(`${SETTING_PREFIX}${id}`, "black"); return BACKGROUNDS.includes(value) ? value : "black"; };
const backgroundLabel = value => ({ black: "Noir", navy: "Bleu nuit", purple: "Violet", forest: "Forêt" }[value] || "Noir");
module.exports = { getProfileReply, handleProfileButton, generateProfileImage };
