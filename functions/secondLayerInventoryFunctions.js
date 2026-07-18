const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    MessageFlags,
    SeparatorBuilder
} = require('discord.js');

const apiDB = require("./apiDB");
const cardFunctions = require("./secondLayerCardFunctions");
const cardDisplay = require("./cardDisplay");
const componentLifecycle = require("./componentLifecycle");
const constants = require("../data/constants.js");

const INVENTORY_CARDS_PER_PAGE = 5;
const INVENTORY_ACCENT_COLOR = 0xD72306;

const getInventoryReply = async (client, user, page = 1, expiresAt = componentLifecycle.createExpiresAt()) => {
    const cards = await apiDB.getCardsFromOwnerID(user.id, { filter: "lastCardOwnerChangeTime", ascendant: false });
    const totalPages = getTotalPages(cards.length);
    const currentPage = clampPage(page, totalPages);

    return {
        components: [await getInventoryContainer(client, user, cards, currentPage, totalPages, expiresAt)],
        flags: MessageFlags.IsComponentsV2
    };
}

const getInventoryContainer = async (client, user, cards, currentPage, totalPages, expiresAt) => {
    const pageCards = cards.slice(INVENTORY_CARDS_PER_PAGE * (currentPage - 1), INVENTORY_CARDS_PER_PAGE * currentPage);
    const container = new ContainerBuilder()
        .setAccentColor(INVENTORY_ACCENT_COLOR)
        .addTextDisplayComponents(text =>
            text.setContent(`Cartes de ${user.username}`)
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(text =>
            text.setContent(`Liste des cartes possédées :`)
        );

    if(pageCards.length == 0){
        container.addTextDisplayComponents(text =>
            text.setContent("Aucune carte possédée pour le moment.")
        );
    }
    else{
        container.addTextDisplayComponents(text =>
            text.setContent("Vos cartes affichent également leurs statistiques")
        );

        pageCards.forEach((card, index) => {
            const inventoryNumber = INVENTORY_CARDS_PER_PAGE * (currentPage - 1) + index + 1;
            container.addSectionComponents(section =>
                section
                    .addTextDisplayComponents(text =>
                        text.setContent(getInventoryCardLine(card, inventoryNumber))
                    )
                    .setButtonAccessory(button =>
                        button
                            .setCustomId(getInventoryButtonCustomID("view", user.id, card.cardID, expiresAt))
                            .setLabel("Voir la carte")
                            .setEmoji({ name: "🔎" })
                            .setStyle(ButtonStyle.Secondary)
                    )
            );
        });
    }

    container.addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(getInventoryNavigationRow(user.id, currentPage, totalPages, expiresAt));

    return container;
}

const getInventoryCardLine = (card, inventoryNumber) => {
    const playerName = getCardPlayerDisplay(card);
    const sellPrice = getSellPriceLabel(card.rarity);
    const discardPoints = getDiscardPointsLabel(card.rarity);

    return `${inventoryNumber} / ${playerName} / ${card.rarity} / ${sellPrice} / ${discardPoints} / ${card.rarityValue}`;
}

const getCardPlayerDisplay = (card) => {
    const discordID = card.playerData?.discordID?.toString();
    return /^\d{17,20}$/.test(discordID || "") ? `<@${discordID}>` : cardDisplay.getPlayerDisplayName(card);
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

const getInventoryNavigationRow = (userID, currentPage, totalPages, expiresAt) => {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(getInventoryButtonCustomID("page", userID, currentPage - 1, expiresAt))
                .setStyle(ButtonStyle.Primary)
                .setEmoji("⬅️")
                .setDisabled(currentPage <= 1),
            new ButtonBuilder()
                .setCustomId(getInventoryButtonCustomID("noop", userID, currentPage, expiresAt))
                .setStyle(ButtonStyle.Secondary)
                .setLabel(`Page ${currentPage}/${totalPages}`)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(getInventoryButtonCustomID("page", userID, currentPage + 1, expiresAt))
                .setStyle(ButtonStyle.Primary)
                .setEmoji("➡️")
                .setDisabled(currentPage >= totalPages)
        );
}

const handleInventoryButton = async (client, interaction) => {
    const parsedButton = parseInventoryButtonCustomID(interaction.customId);
    if(!parsedButton) return false;

    if(componentLifecycle.isExpired(parsedButton.expiresAt)){
        await componentLifecycle.expireInteractedMessage(interaction, "inv", interaction.commandId);
        return true;
    }

    if(interaction.user.id != parsedButton.userID){
        await interaction.reply({
            content: "Cet inventaire ne t'appartient pas.",
            flags: MessageFlags.Ephemeral
        });
        return true;
    }

    if(parsedButton.action == "view"){
        const card = await apiDB.getACardFromID(parsedButton.value);
        if(!card || card.ownerID != interaction.user.id){
            await interaction.reply({
                content: "Cette carte n'est plus dans ton inventaire.",
                flags: MessageFlags.Ephemeral
            });
            return true;
        }

        await interaction.reply({
            embeds: [await cardFunctions.getCardEmbed(client, parsedButton.value)],
            flags: MessageFlags.Ephemeral
        });
        return true;
    }

    if(parsedButton.action == "page"){
        const user = await client.users.fetch(parsedButton.userID);
        const inventoryReply = await getInventoryReply(client, user, parsedButton.value, parsedButton.expiresAt);
        await interaction.update({ components: inventoryReply.components });
        return true;
    }

    await interaction.deferUpdate();
    return true;
}

const parseInventoryButtonCustomID = (customID) => {
    const parts = customID.split(":");
    if(parts.length != 5 || parts[0] != "inv") return null;

    const value = Number(parts[3]);
    const expiresAt = Number(parts[4]);
    if(!Number.isInteger(value) || !Number.isInteger(expiresAt)) return null;

    return {
        action: parts[1],
        userID: parts[2],
        value,
        expiresAt
    };
}

const getInventoryButtonCustomID = (action, userID, value, expiresAt) => {
    return `inv:${action}:${userID}:${value}:${expiresAt}`;
}

const getTotalPages = (cardsNumber) => {
    return Math.max(1, Math.ceil(cardsNumber / INVENTORY_CARDS_PER_PAGE));
}

const clampPage = (page, totalPages) => {
    return Math.min(Math.max(Number(page) || 1, 1), totalPages);
}

module.exports = {
    getInventoryReply,
    handleInventoryButton
};
