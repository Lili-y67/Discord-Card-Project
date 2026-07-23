const Canvas = require("canvas");
const fs = require("node:fs");
const path = require("node:path");
const { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, FileUploadBuilder, LabelBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags, ModalBuilder, SeparatorBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require("discord.js");
const apiDB = require("./apiDB");
const constants = require("../data/constants");
const mentionSafety = require("./mentionSafety");
const componentLifecycle = require("./componentLifecycle");

const BACKGROUNDS = ["black", "navy", "purple", "forest", "discord", "custom"];
const SETTING_PREFIX = "profileBackground:";
const CUSTOM_BACKGROUND_SETTING_PREFIX = "profileBackgroundPath:";
const MAX_BACKGROUND_BYTES = 2 * 1024 * 1024;
const BACKGROUNDS_DIRECTORY = path.join(__dirname, "../data/profile-backgrounds");

const getProfileReply = async (profileUser, requestedByUser, expiresAt = componentLifecycle.createExpiresAt()) => {
    const userDB = await apiDB.getAUserFromDiscordID(profileUser.id);
    await apiDB.prepareQuestUser(profileUser.id);
    const questStats = await apiDB.getQuestUserStats(profileUser.id);
    const questNextXP = 100 + Math.max(1, Number(questStats.level) || 1) * 75;
    const data = {
        money: Number(userDB.money) || 0,
        points: Number(userDB.cardPoints) || 0,
        rank: constants.RANKIDTORANKNAMEDICO[userDB.rankID] || `Rang ${userDB.rankID}`,
        picked: await apiDB.getPickedCardsNumberOfAUser(profileUser.id),
        owned: await apiDB.getOwnedCardsNumberOfAUser(profileUser.id),
        questLevel: Number(questStats.level) || 1,
        questXP: Number(questStats.xp) || 0,
        questNextXP
    };
    const background = await getBackground(profileUser.id);
    const renderedUser = background === "discord"
        ? await profileUser.client.users.fetch(profileUser.id, { force: true }).catch(() => profileUser)
        : profileUser;
    const fileName = `profil-${profileUser.id}.png`;
    const image = await generateProfileImage(renderedUser, data, background);
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
        components: [container],
        attachments: [],
        files: [new AttachmentBuilder(image, { name: fileName })],
        flags: MessageFlags.IsComponentsV2
    });
};

const generateProfileImage = async (user, data, background) => {
    const canvas = Canvas.createCanvas(1100, 460);
    const ctx = canvas.getContext("2d");
    const imageBackground = ["custom", "discord"].includes(background);
    await drawBackground(ctx, canvas.width, canvas.height, background, user);
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
    ctx.fillStyle = "#e4ccff"; ctx.font = "600 18px Arial";
    ctx.fillText(`QUÊTES NIV. ${data.questLevel} · ${data.questXP}/${data.questNextXP} XP`, 45, 438);
    drawStat(ctx, 380, 95, "SOLDE", `${data.money.toLocaleString("fr-FR")}$`, "#ffb35c", imageBackground);
    drawStat(ctx, 720, 95, "POINTS", data.points.toLocaleString("fr-FR"), "#c997ff", imageBackground);
    drawStat(ctx, 380, 255, "CARTES PICK", data.picked.toLocaleString("fr-FR"), "#62c8ff", imageBackground);
    drawStat(ctx, 720, 255, "CARTES POSSÉDÉES", data.owned.toLocaleString("fr-FR"), "#7ce5a1", imageBackground);
    return canvas.toBuffer("image/png");
};

const drawBackground = async (ctx, width, height, background, user) => {
    const userID = user.id;
    if(background === "discord"){
        try {
            const bannerURL = user.bannerURL({ extension: "png", size: 2048 });
            if(bannerURL){
                const image = await Canvas.loadImage(bannerURL);
                drawImageCover(ctx, image, 0, 0, width, height);
                ctx.fillStyle = "rgba(0, 0, 0, 0.30)";
                ctx.fillRect(0, 0, width, height);
                return;
            }
        } catch(error) {
            console.error(`Bannière Discord indisponible pour ${userID}: ${error.message}`);
        }
        background = "black";
    }
    if(background === "custom"){
        const customPath = await apiDB.getPersistentTextSetting(`${CUSTOM_BACKGROUND_SETTING_PREFIX}${userID}`, "");
        if(customPath && fs.existsSync(customPath)){
            try {
                const image = await Canvas.loadImage(customPath);
                drawImageCover(ctx, image, 0, 0, width, height);
                ctx.fillStyle = "rgba(0, 0, 0, 0.30)";
                ctx.fillRect(0, 0, width, height);
                return;
            } catch(error) {
                console.error(`Fond personnalisé illisible pour ${userID}: ${error.message}`);
            }
        }
    }
    const colors = ({ black: ["#090909", "#242424"], navy: ["#07162f", "#123b68"], purple: ["#190d2d", "#63358b"], forest: ["#071f18", "#1f5943"] })[background] || ["#090909", "#242424"];
    const gradient = ctx.createLinearGradient(0, 0, width, height); gradient.addColorStop(0, colors[0]); gradient.addColorStop(1, colors[1]);
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
};
const drawImageCover = (ctx, image, x, y, width, height) => {
    const scale = Math.max(width / image.width, height / image.height);
    const drawWidth = image.width * scale, drawHeight = image.height * scale;
    ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
};
const drawStat = (ctx, x, y, label, value, color, transparent = false) => {
    if(!transparent){
        ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.beginPath(); ctx.roundRect(x, y, 300, 120, 20); ctx.fill();
    }
    ctx.shadowColor = transparent ? "rgba(0,0,0,0.95)" : "transparent";
    ctx.shadowBlur = transparent ? 8 : 0;
    ctx.shadowOffsetY = transparent ? 2 : 0;
    ctx.fillStyle = color; ctx.font = "700 19px Arial"; ctx.fillText(label, x + 24, y + 35);
    ctx.fillStyle = "#ffffff"; ctx.font = "700 40px Arial"; ctx.fillText(value, x + 24, y + 88);
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
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
    await interaction.showModal(getBackgroundModal(profileID, requesterID, background, expiresAt));
    return true;
};

const handleProfileModal = async (client, interaction) => {
    const parts = interaction.customId.split(":");
    if(parts.length !== 5 || parts[0] !== "profile" || parts[1] !== "bgmodal") return false;
    const profileID = parts[2], requesterID = parts[3], expiresAt = Number(parts[4]);
    if(componentLifecycle.isExpired(expiresAt)){
        const profileMention = await mentionSafety.getCommandMention(client, "profil", interaction.guildId);
        await interaction.reply({ content: `Ce panneau de profil a expiré. Relance ${profileMention}.`, flags: MessageFlags.Ephemeral });
        return true;
    }
    if(interaction.user.id !== profileID || interaction.user.id !== requesterID){
        await interaction.reply({ content: "Seul le propriétaire peut changer ce fond.", flags: MessageFlags.Ephemeral });
        return true;
    }

    let selectedBackground = interaction.fields.getStringSelectValues("profile_theme")[0] || "black";
    const uploadedFiles = interaction.fields.getUploadedFiles("profile_image", false);
    const upload = uploadedFiles?.first();
    if(upload){
        const validationError = validateBackgroundUpload(upload);
        if(validationError){
            await interaction.reply({ content: validationError, flags: MessageFlags.Ephemeral });
            return true;
        }
        try {
            const savedPath = await saveCustomBackground(upload, profileID);
            await apiDB.setPersistentTextSetting(`${CUSTOM_BACKGROUND_SETTING_PREFIX}${profileID}`, savedPath);
            selectedBackground = "custom";
        } catch(error) {
            await interaction.reply({ content: `Image refusée : ${error.message}`, flags: MessageFlags.Ephemeral });
            return true;
        }
    } else if(selectedBackground === "custom"){
        const currentPath = await apiDB.getPersistentTextSetting(`${CUSTOM_BACKGROUND_SETTING_PREFIX}${profileID}`, "");
        if(!currentPath || !fs.existsSync(currentPath)){
            await interaction.reply({ content: "Ajoute d’abord une image personnalisée dans le formulaire.", flags: MessageFlags.Ephemeral });
            return true;
        }
    }

    await apiDB.setPersistentTextSetting(`${SETTING_PREFIX}${profileID}`, selectedBackground);
    const user = await client.users.fetch(profileID, { force: true });
    const newExpiresAt = componentLifecycle.createExpiresAt();
    await interaction.update(await getProfileReply(user, user, newExpiresAt));
    componentLifecycle.scheduleInteractionExpiration(interaction, "profil", newExpiresAt);
    return true;
};

const getBackgroundModal = (profileID, requesterID, currentBackground, expiresAt) => new ModalBuilder()
    .setCustomId(`profile:bgmodal:${profileID}:${requesterID}:${expiresAt}`)
    .setTitle("Personnaliser le fond")
    .addLabelComponents(
        new LabelBuilder()
            .setLabel("Thème couleur")
            .setDescription("Utilisé si aucune nouvelle image n’est envoyée")
            .setStringSelectMenuComponent(new StringSelectMenuBuilder()
                .setCustomId("profile_theme")
                .setMinValues(1).setMaxValues(1)
                .addOptions(
                    themeOption("Noir", "black", currentBackground),
                    themeOption("Bleu nuit", "navy", currentBackground),
                    themeOption("Violet", "purple", currentBackground),
                    themeOption("Forêt", "forest", currentBackground),
                    themeOption("Bannière Discord", "discord", currentBackground),
                    themeOption("Image personnalisée actuelle", "custom", currentBackground)
                )),
        new LabelBuilder()
            .setLabel("Image personnalisée — 2 Mo maximum")
            .setDescription("PNG, JPEG, WebP ou GIF ; une nouvelle image remplace l’ancienne")
            .setFileUploadComponent(new FileUploadBuilder()
                .setCustomId("profile_image").setMinValues(0).setMaxValues(1).setRequired(false))
    );

const themeOption = (label, value, current) => new StringSelectMenuOptionBuilder()
    .setLabel(label).setValue(value).setDefault(value === current);

const validateBackgroundUpload = upload => {
    if(Number(upload.size) > MAX_BACKGROUND_BYTES) return "L’image dépasse la limite de **2 Mo**.";
    const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
    if(!allowedTypes.has(upload.contentType)) return "Format invalide : utilise une image PNG, JPEG, WebP ou GIF.";
    return null;
};

const saveCustomBackground = async (upload, profileID) => {
    const response = await fetch(upload.url);
    if(!response.ok) throw new Error("le téléchargement Discord a échoué");
    const buffer = Buffer.from(await response.arrayBuffer());
    if(buffer.length > MAX_BACKGROUND_BYTES) throw new Error("le fichier dépasse 2 Mo");
    const image = await Canvas.loadImage(buffer);
    if(image.width < 200 || image.height < 100) throw new Error("dimensions trop petites (minimum 200 × 100)");
    if(image.width * image.height > 40000000) throw new Error("dimensions trop grandes");
    const normalized = Canvas.createCanvas(1100, 460);
    drawImageCover(normalized.getContext("2d"), image, 0, 0, 1100, 460);
    const guildID = apiDB.getCurrentGuildID() || "global";
    const directory = path.join(BACKGROUNDS_DIRECTORY, guildID.toString());
    await fs.promises.mkdir(directory, { recursive: true });
    const destination = path.join(directory, `${profileID}.jpg`);
    await fs.promises.writeFile(destination, normalized.toBuffer("image/jpeg", { quality: 0.88 }));
    return destination;
};

const getBackground = async id => { const value = await apiDB.getPersistentTextSetting(`${SETTING_PREFIX}${id}`, "black"); return BACKGROUNDS.includes(value) ? value : "black"; };
const backgroundLabel = value => ({ black: "Noir", navy: "Bleu nuit", purple: "Violet", forest: "Forêt", discord: "Bannière Discord (noir si absente)", custom: "Image personnalisée" }[value] || "Noir");
module.exports = { getProfileReply, handleProfileButton, handleProfileModal, generateProfileImage, getBackgroundModal, validateBackgroundUpload };
