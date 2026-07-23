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
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} = require('discord.js');
const Canvas = require("canvas");

const apiDB = require("./apiDB");
const componentLifecycle = require("./componentLifecycle");
const constants = require("../data/constants");
const mentionSafety = require("./mentionSafety");

const TOP_ACCENT_COLOR = 0xD72306;
const TOP_TYPES = Object.freeze({
    money: {
        label: "Argent",
        title: "Classement argent",
        unit: "$",
        valueKey: "money",
        getRows: apiDB.getBaltopRowsList
    },
    points: {
        label: "Points",
        title: "Classement points",
        unit: "pts",
        valueKey: "cardPoints",
        getRows: apiDB.getCardPointstopRowsList
    },
    cards: {
        label: "Cartes possédées",
        title: "Classement des collectionneurs",
        unit: "cartes",
        valueKey: "ownedCards",
        getRows: apiDB.getOwnedCardTopRowsList
    },
    picks: {
        label: "Picks effectués",
        title: "Classement des picks",
        unit: "picks",
        valueKey: "pickCount",
        getRows: apiDB.getPickTopRowsList
    },
    dailies: {
        label: "Dailies effectués",
        title: "Classement des dailies",
        unit: "dailies",
        valueKey: "dailyCount",
        getRows: apiDB.getDailyTopRowsList
    }
});

const getTopPickerReply = (user, expiresAt = componentLifecycle.createExpiresAt()) => {
    const container = new ContainerBuilder()
        .setAccentColor(TOP_ACCENT_COLOR)
        .addTextDisplayComponents(text => text.setContent("## 🏆 Classements\nChoisis la catégorie que tu veux consulter."))
        .addActionRowComponents(getTopCategoryRow(user.id, null, expiresAt));
    return mentionSafety.withSafeMentions({
        components: [container],
        flags: MessageFlags.IsComponentsV2
    });
};

const getTopReply = async (user, type = "money", page = 1, expiresAt = componentLifecycle.createExpiresAt()) => {
    await apiDB.ensureDatabaseSchema();
    const topType = normalizeType(type);
    const rows = await TOP_TYPES[topType].getRows();
    const totalPages = getTotalPages(rows.length);
    const currentPage = clampPage(page, totalPages);

    const pageRows = rows.slice(constants.USERSPERBALTOPPAGE * (currentPage - 1), constants.USERSPERBALTOPPAGE * currentPage);
    const fileName = `top-${topType}-${currentPage}.png`;
    const image = await generateTopImage(user.client, topType, pageRows, currentPage, totalPages);
    return mentionSafety.withSafeMentions({
        components: [getTopContainer(user, topType, pageRows, currentPage, totalPages, expiresAt, fileName)],
        attachments: [],
        files: [new AttachmentBuilder(image, { name: fileName })],
        flags: MessageFlags.IsComponentsV2
    });
}

const getTopContainer = (user, type, pageRows, currentPage, totalPages, expiresAt, fileName) => {
    const topConfig = TOP_TYPES[type];
    const container = new ContainerBuilder()
        .setAccentColor(TOP_ACCENT_COLOR)
        .addTextDisplayComponents(text => text.setContent(`## 🏆 ${topConfig.title}`));

    if(pageRows.length == 0){
        container.addTextDisplayComponents(text => text.setContent("Aucun membre classe pour le moment."));
    }
    else{
        container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder().setURL(`attachment://${fileName}`).setDescription(topConfig.title)
        ));
    }

    return container
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(getTopCategoryRow(user.id, type, expiresAt))
        .addActionRowComponents(getTopNavigationRow(user.id, type, currentPage, totalPages, expiresAt));
}

const getTopCategoryRow = (userID, selectedType, expiresAt) => new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
        .setCustomId(getTopCustomID("select", userID, selectedType || "money", 1, expiresAt))
        .setPlaceholder("Choisir une catégorie")
        .addOptions(Object.entries(TOP_TYPES).map(([value, config]) =>
            new StringSelectMenuOptionBuilder()
                .setLabel(config.label)
                .setValue(value)
                .setDefault(value === selectedType)
        ))
);

const generateTopImage = async (client, type, pageRows, currentPage, totalPages) => {
    const config = TOP_TYPES[type];
    const width = 1100, rowHeight = 92, headerHeight = 150;
    const height = Math.max(340, headerHeight + Math.max(pageRows.length, 1) * rowHeight + 55);
    const canvas = Canvas.createCanvas(width, height), ctx = canvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#130b20"); gradient.addColorStop(0.52, "#28133d"); gradient.addColorStop(1, "#451421");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 0.10; ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(1040, 30, 230, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(30, height + 10, 180, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffffff"; ctx.font = "700 42px Arial"; ctx.fillText(cleanCanvasText(config.title), 52, 65);
    ctx.fillStyle = "#cba7ff"; ctx.font = "600 20px Arial"; ctx.fillText(`PAGE ${currentPage} / ${totalPages}`, 54, 104);

    for(let index = 0; index < pageRows.length; index++){
        const row = pageRows[index], rank = constants.USERSPERBALTOPPAGE * (currentPage - 1) + index + 1;
        const y = headerHeight + index * rowHeight;
        ctx.fillStyle = rank <= 3 ? "rgba(255,190,70,0.14)" : "rgba(255,255,255,0.07)";
        ctx.beginPath(); ctx.roundRect(42, y, width - 84, 72, 18); ctx.fill();
        ctx.fillStyle = rank === 1 ? "#ffd257" : rank === 2 ? "#dce3ed" : rank === 3 ? "#d99362" : "#bca9cc";
        ctx.font = "700 29px Arial"; ctx.fillText(`#${rank}`, 66, y + 46);
        await drawTopAvatar(ctx, client, row.discordID, 170, y + 36);
        ctx.fillStyle = "#ffffff"; ctx.font = "700 26px Arial";
        ctx.fillText(truncateCanvas(ctx, cleanCanvasText(row.name || "Utilisateur"), 520), 218, y + 45);
        const value = `${Number(row[config.valueKey] || 0).toLocaleString("fr-FR")} ${config.unit}`;
        ctx.font = "700 27px Arial"; ctx.fillStyle = "#ffad69";
        ctx.fillText(value, width - 70 - ctx.measureText(value).width, y + 45);
    }
    if(!pageRows.length){ ctx.fillStyle = "#ffffff"; ctx.font = "600 28px Arial"; ctx.fillText("Aucun membre classé pour le moment.", 52, 220); }
    return canvas.toBuffer("image/png");
};

const drawTopAvatar = async (ctx, client, discordID, x, y) => {
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, 27, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = "#55306f"; ctx.fillRect(x - 27, y - 27, 54, 54);
    if(/^\d{17,20}$/.test(discordID || "")){
        try {
            const user = await client.users.fetch(discordID);
            const avatar = await Canvas.loadImage(user.displayAvatarURL({ extension: "png", size: 128, forceStatic: true }));
            ctx.drawImage(avatar, x - 27, y - 27, 54, 54);
        } catch {}
    }
    ctx.restore();
};
const cleanCanvasText = value => (value || "").toString().normalize("NFKC")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "").replace(/[^\p{L}\p{N} ._'-]/gu, " ").replace(/\s+/g, " ").trim();
const truncateCanvas = (ctx, value, width) => { let text = value || "Utilisateur"; while(text.length > 1 && ctx.measureText(text).width > width) text = `${text.slice(0, -2)}…`; return text; };

const formatTopLine = (row, index, currentPage, topConfig) => {
    const rank = constants.USERSPERBALTOPPAGE * (currentPage - 1) + index + 1;
    const value = row[topConfig.valueKey] ?? 0;
    return `**${rank}.** ${mentionSafety.escapeMarkdown(row.name || "Utilisateur")} - **${value} ${topConfig.unit}**`;
}

const getTopNavigationRow = (userID, type, currentPage, totalPages, expiresAt) => {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(getTopCustomID("page", userID, type, currentPage - 1, expiresAt))
            .setStyle(ButtonStyle.Primary)
            .setEmoji("⬅️")
            .setDisabled(currentPage <= 1),
        new ButtonBuilder()
            .setCustomId(getTopCustomID("noop", userID, type, currentPage, expiresAt))
            .setStyle(ButtonStyle.Secondary)
            .setLabel(`Page ${currentPage}/${totalPages}`)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId(getTopCustomID("page", userID, type, currentPage + 1, expiresAt))
            .setStyle(ButtonStyle.Primary)
            .setEmoji("➡️")
            .setDisabled(currentPage >= totalPages)
    );
}

const handleTopButton = async (client, interaction) => {
    const parsedInteraction = parseTopCustomID(interaction.customId);
    if(!parsedInteraction) return false;

    if(componentLifecycle.isExpired(parsedInteraction.expiresAt)){
        await componentLifecycle.expireInteractedMessage(interaction, "top", interaction.commandId);
        return true;
    }

    if(interaction.user.id != parsedInteraction.userID){
        await interaction.reply({
            content: "Ce classement ne t'appartient pas.",
            flags: MessageFlags.Ephemeral,
            allowedMentions: mentionSafety.SAFE_ALLOWED_MENTIONS
        });
        return true;
    }

    if(parsedInteraction.action == "page"){
        const user = await client.users.fetch(parsedInteraction.userID);
        const expiresAt = componentLifecycle.createExpiresAt();
        // Le nouveau canvas et les avatars peuvent dépasser la fenêtre de
        // réponse Discord, y compris lors d'un changement de page.
        await interaction.deferUpdate();
        await interaction.editReply(await getTopReply(user, parsedInteraction.type, parsedInteraction.page, expiresAt));
        componentLifecycle.scheduleInteractionExpiration(interaction, "top", expiresAt);
        return true;
    }

    await interaction.deferUpdate();
    return true;
}

const handleTopSelect = async (client, interaction) => {
    const parsedInteraction = parseTopCustomID(interaction.customId);
    if(!parsedInteraction || parsedInteraction.action !== "select") return false;

    if(componentLifecycle.isExpired(parsedInteraction.expiresAt)){
        await componentLifecycle.expireInteractedMessage(interaction, "top", interaction.commandId);
        return true;
    }

    if(interaction.user.id !== parsedInteraction.userID){
        await interaction.reply({
            content: "Ce classement ne t'appartient pas.",
            flags: MessageFlags.Ephemeral,
            allowedMentions: mentionSafety.SAFE_ALLOWED_MENTIONS
        });
        return true;
    }

    const type = normalizeType(interaction.values[0]);
    const expiresAt = componentLifecycle.createExpiresAt();
    await interaction.deferUpdate();
    await interaction.editReply(await getTopReply(interaction.user, type, 1, expiresAt));
    componentLifecycle.scheduleInteractionExpiration(interaction, "top", expiresAt);
    return true;
}

const parseTopCustomID = (customID) => {
    const parts = customID.split(":");
    if(parts.length != 6 || parts[0] != "top") return null;

    const page = Number(parts[4]);
    const expiresAt = Number(parts[5]);
    if(!Number.isInteger(page) || !Number.isInteger(expiresAt)) return null;

    return {
        action: parts[1],
        userID: parts[2],
        type: normalizeType(parts[3]),
        page,
        expiresAt
    };
}

const getTopCustomID = (action, userID, type, page, expiresAt) => {
    return `top:${action}:${userID}:${normalizeType(type)}:${page}:${expiresAt}`;
}

const normalizeType = (type) => TOP_TYPES[type] ? type : "money";
const getTotalPages = (rowsNumber) => Math.max(1, Math.ceil(rowsNumber / constants.USERSPERBALTOPPAGE));
const clampPage = (page, totalPages) => Math.min(Math.max(Number(page) || 1, 1), totalPages);

module.exports = {
    TOP_TYPES,
    getTopPickerReply,
    getTopReply,
    handleTopButton,
    handleTopSelect,
    generateTopImage
};
