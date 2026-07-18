const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} = require('discord.js');

const apiDB = require("./apiDB");
const cardFunctions = require("./secondLayerCardFunctions");
const cardDisplay = require("./cardDisplay");
const componentLifecycle = require("./componentLifecycle");
const constants = require("../data/constants.js");
const mentionSafety = require("./mentionSafety");

const CARDS_PER_PAGE = 25;
const SORT_NUMBER = "numero";
const SORT_RARITY = "rarete";

const getCardsReply = async (client, user, sort = SORT_NUMBER, page = 1, expiresAt = componentLifecycle.createExpiresAt()) => {
    const normalizedSort = normalizeSort(sort);
    const cards = await getSortedCards(normalizedSort);
    const totalPages = getTotalPages(cards.length);
    const currentPage = clampPage(page, totalPages);

    if(cards.length == 0){
        return {
            content: "Aucune carte n'est enregistrée pour le moment.",
            components: [],
            allowedMentions: mentionSafety.SAFE_ALLOWED_MENTIONS
        };
    }

    return {
        content: `Catalogue des cartes - tri par ${getSortLabel(normalizedSort)} - page ${currentPage}/${totalPages}`,
        components: [
            getCardsSelectRow(user.id, normalizedSort, currentPage, cards, expiresAt),
            getCardsNavigationRow(user.id, normalizedSort, currentPage, totalPages, expiresAt)
        ],
        allowedMentions: mentionSafety.SAFE_ALLOWED_MENTIONS
    };
}

const getSortedCards = async (sort) => {
    if(sort == SORT_RARITY){
        return apiDB.getRegisteredCards({ filter: "rarity", ascendant: false });
    }
    return apiDB.getRegisteredCards({ filter: "cardID", ascendant: true });
}

const getCardsSelectRow = (userID, sort, currentPage, cards, expiresAt) => {
    const pageCards = cards.slice(CARDS_PER_PAGE * (currentPage - 1), CARDS_PER_PAGE * currentPage);
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(getCardsCustomID("select", userID, sort, currentPage, expiresAt))
        .setPlaceholder("Choisir une carte à afficher")
        .addOptions(pageCards.map(getCardSelectOption));

    return new ActionRowBuilder().addComponents(selectMenu);
}

const getCardSelectOption = (card) => {
    const playerName = cardDisplay.getPlayerDisplayName(card);
    const sellPrice = getSellPriceLabel(card.rarity);
    const discardPoints = getDiscardPointsLabel(card.rarity);

    return new StringSelectMenuOptionBuilder()
        .setLabel(truncateString(`#${card.cardID} - ${playerName}`, 100))
        .setDescription(truncateString(`${card.rarity} ${card.rarityValue} | ${sellPrice} | ${discardPoints} | joueur ${card.playerID}`, 100))
        .setValue(card.cardID.toString());
}

const getCardsNavigationRow = (userID, sort, currentPage, totalPages, expiresAt) => {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(getCardsCustomID("page", userID, sort, currentPage - 1, expiresAt))
                .setStyle(ButtonStyle.Primary)
                .setEmoji("⬅️")
                .setDisabled(currentPage <= 1),
            new ButtonBuilder()
                .setCustomId(getCardsCustomID("noop", userID, sort, currentPage, expiresAt))
                .setStyle(ButtonStyle.Secondary)
                .setLabel(`Page ${currentPage}/${totalPages}`)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(getCardsCustomID("page", userID, sort, currentPage + 1, expiresAt))
                .setStyle(ButtonStyle.Primary)
                .setEmoji("➡️")
                .setDisabled(currentPage >= totalPages)
        );
}

const handleCardsButton = async (client, interaction) => {
    const parsedInteraction = parseCardsCustomID(interaction.customId);
    if(!parsedInteraction) return false;

    if(componentLifecycle.isExpired(parsedInteraction.expiresAt)){
        await componentLifecycle.expireInteractedMessage(interaction, "cards", interaction.commandId);
        return true;
    }

    if(!(await canUserInteract(interaction, parsedInteraction.userID))) return true;

    if(parsedInteraction.action == "page"){
        const user = await client.users.fetch(parsedInteraction.userID);
        await interaction.update(await getCardsReply(client, user, parsedInteraction.sort, parsedInteraction.page, parsedInteraction.expiresAt));
        return true;
    }

    await interaction.deferUpdate();
    return true;
}

const handleCardsSelect = async (client, interaction) => {
    const parsedInteraction = parseCardsCustomID(interaction.customId);
    if(!parsedInteraction) return false;

    if(componentLifecycle.isExpired(parsedInteraction.expiresAt)){
        await componentLifecycle.expireInteractedMessage(interaction, "cards", interaction.commandId);
        return true;
    }

    if(!(await canUserInteract(interaction, parsedInteraction.userID))) return true;

    const selectedCardID = Number(interaction.values[0]);
    if(!(await apiDB.isCardRegistered(selectedCardID))){
        const user = await client.users.fetch(parsedInteraction.userID);
        await interaction.update(await getCardsReply(client, user, parsedInteraction.sort, parsedInteraction.page, parsedInteraction.expiresAt));
        await interaction.followUp({
            content: `La carte numéro ${selectedCardID} n'existe plus.`,
            flags: MessageFlags.Ephemeral,
            allowedMentions: mentionSafety.SAFE_ALLOWED_MENTIONS
        });
        return true;
    }

    const user = await client.users.fetch(parsedInteraction.userID);
    await interaction.update(await getCardsReply(client, user, parsedInteraction.sort, parsedInteraction.page, parsedInteraction.expiresAt));
    await interaction.followUp({
        embeds: [await cardFunctions.getCardEmbed(client, selectedCardID)],
        flags: MessageFlags.Ephemeral,
        allowedMentions: mentionSafety.SAFE_ALLOWED_MENTIONS
    });
    return true;
}

const canUserInteract = async (interaction, userID) => {
    if(interaction.user.id == userID) return true;

    await interaction.reply({
        content: "Ce catalogue ne t'appartient pas.",
        flags: MessageFlags.Ephemeral,
        allowedMentions: mentionSafety.SAFE_ALLOWED_MENTIONS
    });
    return false;
}

const parseCardsCustomID = (customID) => {
    const parts = customID.split(":");
    if(parts.length != 6 || parts[0] != "cards") return null;

    const page = Number(parts[4]);
    const expiresAt = Number(parts[5]);
    if(!Number.isInteger(page) || !Number.isInteger(expiresAt)) return null;

    return {
        action: parts[1],
        userID: parts[2],
        sort: normalizeSort(parts[3]),
        page,
        expiresAt
    };
}

const getCardsCustomID = (action, userID, sort, page, expiresAt) => {
    return `cards:${action}:${userID}:${normalizeSort(sort)}:${page}:${expiresAt}`;
}

const normalizeSort = (sort) => {
    return sort == SORT_RARITY ? SORT_RARITY : SORT_NUMBER;
}

const getSortLabel = (sort) => {
    return sort == SORT_RARITY ? "rareté" : "numéro";
}

const getSellPriceLabel = (rarity) => {
    if(rarity == constants.GLITCHEDNAME){
        return `${constants.MINSELLPRICEGLITCHED}-${constants.MAXSELLPRICEGLITCHED}$`;
    }
    return `${constants.SELLPRICETABLE[rarity] ?? 0}$`;
}

const getDiscardPointsLabel = (rarity) => {
    if(rarity == constants.GLITCHEDNAME){
        return `${constants.MINDISCARDPOINTSGLITCHED}-${constants.MAXDISCARDPOINTSGLITCHED} pts`;
    }
    return `${constants.DISCARDPOINTSDICO[rarity] ?? 0} pts`;
}

const getTotalPages = (cardsNumber) => {
    return Math.max(1, Math.ceil(cardsNumber / CARDS_PER_PAGE));
}

const clampPage = (page, totalPages) => {
    return Math.min(Math.max(Number(page) || 1, 1), totalPages);
}

const truncateString = (value, maximumLength) => {
    const stringValue = value.toString();
    if(stringValue.length <= maximumLength) return stringValue;
    return stringValue.slice(0, maximumLength - 3) + "...";
}

module.exports = {
    SORT_NUMBER,
    SORT_RARITY,
    getCardsReply,
    handleCardsButton,
    handleCardsSelect
};
