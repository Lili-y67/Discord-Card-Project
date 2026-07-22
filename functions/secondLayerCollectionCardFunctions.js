const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags,
    SeparatorBuilder
} = require('discord.js');

const apiDB = require("./apiDB");
const componentLifecycle = require("./componentLifecycle");
const mentionSafety = require("./mentionSafety");

const COLLECTION_CARD_ACCENT_COLOR = 0xD72306;
const CARDS_PER_PAGE = 5;

const getCollectionCardReply = async (client, ownerUser, targetUser, page = 1, expiresAt = componentLifecycle.createExpiresAt()) => {
    const targetPlayer = await getPlayerForUser(targetUser);
    const cards = targetPlayer
        ? (await apiDB.getCardsFromOwnerID(ownerUser.id, { filter: "rarity", ascendant: false }))
            .filter(card => Number(card.playerID) == Number(targetPlayer.playerID))
        : [];
    const totalPages = getTotalPages(cards.length);
    const currentPage = clampPage(page, totalPages);

    return mentionSafety.withSafeMentions({
        components: [getCollectionCardContainer(ownerUser, targetUser, targetPlayer, cards, currentPage, totalPages, expiresAt)],
        flags: MessageFlags.IsComponentsV2
    });
}

const getCollectionCardContainer = (ownerUser, targetUser, targetPlayer, cards, currentPage, totalPages, expiresAt) => {
    const pageCards = cards.slice(CARDS_PER_PAGE * (currentPage - 1), CARDS_PER_PAGE * currentPage);
    const ownerDisplay = mentionSafety.getUserMention(ownerUser.id) || mentionSafety.getDisplayName(ownerUser.username);
    const targetDisplay = mentionSafety.getUserMention(targetUser.id) || mentionSafety.getDisplayName(targetUser.username);
    const container = new ContainerBuilder()
        .setAccentColor(COLLECTION_CARD_ACCENT_COLOR)
        .addTextDisplayComponents(text =>
            text.setContent(`## Collection card\n${ownerDisplay} possede **${cards.length}** carte(s) de ${targetDisplay}`)
        )
        .addSeparatorComponents(new SeparatorBuilder());

    if(!targetPlayer){
        return container.addTextDisplayComponents(text =>
            text.setContent("Ce membre n'est pas encore synchronise comme joueur de cartes.")
        );
    }

    if(pageCards.length == 0){
        container.addTextDisplayComponents(text =>
            text.setContent("Aucune carte trouvee pour cette combinaison.")
        );
    }
    else{
        container.addTextDisplayComponents(text =>
            text.setContent(pageCards.map(formatCardLine).join("\n"))
        );

        const galleryItems = pageCards
            .filter(card => Boolean(card.imageURL))
            .map(card => new MediaGalleryItemBuilder()
                .setURL(card.imageURL)
                .setDescription(`Carte ${card.cardID} - ${card.rarity}`));

        if(galleryItems.length){
            container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(galleryItems));
        }
    }

    return container
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(getNavigationRow(ownerUser.id, targetUser.id, currentPage, totalPages, expiresAt));
}

const formatCardLine = (card) => {
    return `**#${card.cardID}** - ${mentionSafety.escapeMarkdown(card.rarity)} (${card.rarityValue}) - ${card.locked ? "verrouillee" : "deverrouillee"}`;
}

const getNavigationRow = (ownerID, targetID, currentPage, totalPages, expiresAt) => {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(getCollectionCardCustomID("page", ownerID, targetID, currentPage - 1, expiresAt))
            .setStyle(ButtonStyle.Primary)
            .setEmoji("⬅️")
            .setDisabled(currentPage <= 1),
        new ButtonBuilder()
            .setCustomId(getCollectionCardCustomID("noop", ownerID, targetID, currentPage, expiresAt))
            .setStyle(ButtonStyle.Secondary)
            .setLabel(`Page ${currentPage}/${totalPages}`)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId(getCollectionCardCustomID("page", ownerID, targetID, currentPage + 1, expiresAt))
            .setStyle(ButtonStyle.Primary)
            .setEmoji("➡️")
            .setDisabled(currentPage >= totalPages)
    );
}

const handleCollectionCardButton = async (client, interaction) => {
    const parsedInteraction = parseCollectionCardCustomID(interaction.customId);
    if(!parsedInteraction) return false;

    if(componentLifecycle.isExpired(parsedInteraction.expiresAt)){
        await componentLifecycle.expireInteractedMessage(interaction, "collectioncard", interaction.commandId);
        return true;
    }

    if(interaction.user.id != parsedInteraction.ownerID){
        await interaction.reply({
            content: "Cette collection card ne t'appartient pas.",
            flags: MessageFlags.Ephemeral,
            allowedMentions: mentionSafety.SAFE_ALLOWED_MENTIONS
        });
        return true;
    }

    if(parsedInteraction.action == "page"){
        const ownerUser = await client.users.fetch(parsedInteraction.ownerID);
        const targetUser = await client.users.fetch(parsedInteraction.targetID);
        await interaction.update(await getCollectionCardReply(client, ownerUser, targetUser, parsedInteraction.page, parsedInteraction.expiresAt));
        return true;
    }

    await interaction.deferUpdate();
    return true;
}

const getPlayerForUser = async (user) => {
    const players = await apiDB.getGuildPlayersList();
    return players.find(player => player.discordID == user.id) || null;
}

const parseCollectionCardCustomID = (customID) => {
    const parts = customID.split(":");
    if(parts.length != 6 || parts[0] != "collectioncard") return null;

    const page = Number(parts[4]);
    const expiresAt = Number(parts[5]);
    if(!Number.isInteger(page) || !Number.isInteger(expiresAt)) return null;

    return {
        action: parts[1],
        ownerID: parts[2],
        targetID: parts[3],
        page,
        expiresAt
    };
}

const getCollectionCardCustomID = (action, ownerID, targetID, page, expiresAt) => {
    return `collectioncard:${action}:${ownerID}:${targetID}:${page}:${expiresAt}`;
}

const getTotalPages = (cardsNumber) => Math.max(1, Math.ceil(cardsNumber / CARDS_PER_PAGE));
const clampPage = (page, totalPages) => Math.min(Math.max(Number(page) || 1, 1), totalPages);

module.exports = {
    getCollectionCardReply,
    handleCollectionCardButton
};
