const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    MessageFlags,
    SeparatorBuilder,
    ThumbnailBuilder
} = require('discord.js');

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
    }
});

const getTopReply = async (user, type = "money", page = 1, expiresAt = componentLifecycle.createExpiresAt()) => {
    const topType = normalizeType(type);
    const rows = await TOP_TYPES[topType].getRows();
    const totalPages = getTotalPages(rows.length);
    const currentPage = clampPage(page, totalPages);

    return mentionSafety.withSafeMentions({
        components: [getTopContainer(user, topType, rows, currentPage, totalPages, expiresAt)],
        flags: MessageFlags.IsComponentsV2
    });
}

const getTopContainer = (user, type, rows, currentPage, totalPages, expiresAt) => {
    const topConfig = TOP_TYPES[type];
    const pageRows = rows.slice(constants.USERSPERBALTOPPAGE * (currentPage - 1), constants.USERSPERBALTOPPAGE * currentPage);
    const thumbnailURL = user?.displayAvatarURL?.({ extension: "png", size: 128, forceStatic: true });
    const container = new ContainerBuilder()
        .setAccentColor(TOP_ACCENT_COLOR)
        .addSectionComponents(section => {
            section.addTextDisplayComponents(text =>
                text.setContent(`## ${topConfig.title}\n-# Demande par ${mentionSafety.getUserMention(user?.id) || mentionSafety.getDisplayName(user?.username)}`)
            );
            if(thumbnailURL){
                section.setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnailURL));
            }
            return section;
        })
        .addSeparatorComponents(new SeparatorBuilder());

    if(pageRows.length == 0){
        container.addTextDisplayComponents(text => text.setContent("Aucun membre classe pour le moment."));
    }
    else{
        container.addTextDisplayComponents(text =>
            text.setContent(pageRows.map((row, index) => formatTopLine(row, index, currentPage, topConfig)).join("\n"))
        );
    }

    return container
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(getTopNavigationRow(user.id, type, currentPage, totalPages, expiresAt));
}

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
        await interaction.update(await getTopReply(user, parsedInteraction.type, parsedInteraction.page, parsedInteraction.expiresAt));
        return true;
    }

    await interaction.deferUpdate();
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
    getTopReply,
    handleTopButton
};
