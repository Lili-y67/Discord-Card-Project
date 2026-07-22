const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    EmbedBuilder,
    MessageFlags,
    SeparatorBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} = require('discord.js');

const constants = require("../data/constants.js")
const apiDB = require("./apiDB");
const componentLifecycle = require("./componentLifecycle");
const mentionSafety = require("./mentionSafety");

const COLLECTION_ACCENT_COLOR = 0xD72306;
const COLLECTION_PLAYERS_PER_PAGE = Math.min(constants.PLAYERSPERCOLLECTIONPAGE, 7);
const HAS_MARK = "✅";
const HASNT_MARK = "❌";

const getCollectionReply = async (client, interaction, userCollection, currentPage, requestedUser, expiresAt = componentLifecycle.createExpiresAt(), selectedPlayerID = 0) => {
    return mentionSafety.withSafeMentions({
        components: [await getCollectionContainer(userCollection, currentPage, requestedUser, interaction.user.id, requestedUser.id, expiresAt, selectedPlayerID)],
        flags: MessageFlags.IsComponentsV2
    });
}

const getCollectionContainer = async (userCollection, currentPage, user, ownerID = user.id, requestedUserID = user.id, expiresAt = componentLifecycle.createExpiresAt(), selectedPlayerID = 0) => {
    let playerIDs = Object.keys(userCollection).map(Number).sort((a, b) => a - b)
    let keysNumber = playerIDs.length
    const totalPageNumber = getTotalPages(keysNumber)
    const page = clampPage(currentPage, totalPageNumber)
    const pagePlayerIDs = playerIDs.slice(COLLECTION_PLAYERS_PER_PAGE * (page - 1), COLLECTION_PLAYERS_PER_PAGE * page)
    const selectedID = Number(selectedPlayerID) || 0
    const shownPlayerIDs = selectedID ? [selectedID] : pagePlayerIDs

    const container = new ContainerBuilder()
        .setAccentColor(COLLECTION_ACCENT_COLOR)
        .addTextDisplayComponents(text =>
            text.setContent(`**Collection de ${getUserDisplay(user)}**`)
        )
        .addSeparatorComponents(new SeparatorBuilder());

    if(keysNumber == 0){
        return container.addTextDisplayComponents(text =>
            text.setContent('Aucun joueur synchronisé pour le moment.')
        );
    }

    const resolvedPlayers = await Promise.all(shownPlayerIDs.map(playerID => apiDB.getPlayerDataFromID(playerID)))
    for(const player of resolvedPlayers.filter(Boolean)){
        container.addTextDisplayComponents(text =>
            text.setContent(`${getPlayerDisplay(player)}\n${getPlayerRarityStatusText(userCollection[player.playerID] || {})}`)
        );
    }

    container.addTextDisplayComponents(text =>
        text.setContent(selectedID
            ? `-# Membre ciblé · Page ${page.toString()} sur ${totalPageNumber.toString()}`
            : `-# Page ${page.toString()} sur ${totalPageNumber.toString()}`)
    );

    return container
        .addActionRowComponents(getCollectionNavigationRow(ownerID, requestedUserID, page, totalPageNumber, selectedID, expiresAt))
        .addActionRowComponents(await getCollectionPlayerSelectRow(ownerID, requestedUserID, page, pagePlayerIDs, selectedID, expiresAt));
}

const getCollectionEmbed = async (userCollection, currentPage, user) => {
    const container = await getCollectionContainer(userCollection, currentPage, user);
    return new EmbedBuilder()
        .setColor('#D72306')
        .setTitle('Collection')
        .setDescription(container.toJSON().components.map(component => component.content).filter(Boolean).join("\n"));
}

const getCollectionStatsEmbed = async (userCollectionStats, user) => {

    let cardsNumberValue = constants.RARITIES
        .map(rarity => `${rarity.name} : ${userCollectionStats[rarity.name] || 0}`)
        .join("\n")

    return new EmbedBuilder()
    .setColor('#D72306')
    .setTitle(`Statistiques de collection`)
    .setDescription(`Collection de ${getUserDisplay(user)}`)
        .addFields({ name: 'Nombre de cartes pour chaque rareté :', value: cardsNumberValue, inline:true})

    .setTimestamp()
    .setFooter({ text: `Fun fact : collection en cours de consultation`});
}

const getCollectionNavigationRow = (ownerID, requestedUserID, currentPage, totalPages, selectedPlayerID, expiresAt) => {
    return new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId(getCollectionCustomID("page", ownerID, requestedUserID, currentPage - 1, selectedPlayerID, expiresAt))
            .setStyle(ButtonStyle.Primary)
            .setEmoji("⬅️")
            .setDisabled(currentPage <= 1),

        new ButtonBuilder()
            .setCustomId(getCollectionCustomID("clear", ownerID, requestedUserID, currentPage, 0, expiresAt))
            .setStyle(ButtonStyle.Secondary)
            .setLabel(selectedPlayerID ? "Réinitialiser" : `Page ${currentPage}/${totalPages}`)
            .setDisabled(!selectedPlayerID),

        new ButtonBuilder()
            .setCustomId(getCollectionCustomID("page", ownerID, requestedUserID, currentPage + 1, selectedPlayerID, expiresAt))
            .setStyle(ButtonStyle.Primary)
            .setEmoji("➡️")
            .setDisabled(currentPage >= totalPages),
    );
}

const getCollectionPlayerSelectRow = async (ownerID, requestedUserID, currentPage, playerIDs, selectedPlayerID, expiresAt) => {
    const players = (await Promise.all(playerIDs.map(playerID => apiDB.getPlayerDataFromID(playerID)))).filter(Boolean);
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(getCollectionCustomID("member", ownerID, requestedUserID, currentPage, selectedPlayerID, expiresAt))
        .setPlaceholder("Cibler un membre de cette page")
        .addOptions(players.map(player =>
            new StringSelectMenuOptionBuilder()
                .setLabel(getPlayerOptionLabel(player))
                .setDescription(`Voir uniquement cette collection`)
                .setValue(player.playerID.toString())
                .setDefault(Number(selectedPlayerID) == Number(player.playerID))
        ));

    return new ActionRowBuilder().addComponents(selectMenu);
}

const handleCollectionButton = async (client, interaction) => {
    const parsedInteraction = parseCollectionCustomID(interaction.customId);
    if(!parsedInteraction) return false;

    if(!(await canUseCollectionInteraction(interaction, parsedInteraction))) return true;

    const page = parsedInteraction.action == "page" ? parsedInteraction.page : parsedInteraction.page;
    const selectedPlayerID = ["clear", "page"].includes(parsedInteraction.action) ? 0 : parsedInteraction.selectedPlayerID;
    await updateCollectionInteraction(client, interaction, parsedInteraction, page, selectedPlayerID);
    return true;
}

const handleCollectionSelect = async (client, interaction) => {
    const parsedInteraction = parseCollectionCustomID(interaction.customId);
    if(!parsedInteraction || parsedInteraction.action != "member") return false;

    if(!(await canUseCollectionInteraction(interaction, parsedInteraction))) return true;

    await updateCollectionInteraction(client, interaction, parsedInteraction, parsedInteraction.page, Number(interaction.values[0]));
    return true;
}

const updateCollectionInteraction = async (client, interaction, parsedInteraction, page, selectedPlayerID) => {
    const requestedUser = await client.users.fetch(parsedInteraction.requestedUserID);
    const userCollection = await getCollectionOfAUser(requestedUser.id);
    const expiresAt = componentLifecycle.createExpiresAt();
    await interaction.update(await getCollectionReply(client, interaction, userCollection, page, requestedUser, expiresAt, selectedPlayerID));
    componentLifecycle.scheduleInteractionExpiration(interaction, "collection", expiresAt);
}

const canUseCollectionInteraction = async (interaction, parsedInteraction) => {
    if(componentLifecycle.isExpired(parsedInteraction.expiresAt)){
        await componentLifecycle.expireInteractedMessage(interaction, "collection", interaction.commandId);
        return false;
    }

    if(interaction.user.id == parsedInteraction.ownerID) return true;

    await interaction.reply({
        content: "Cette collection ne t'appartient pas.",
        flags: MessageFlags.Ephemeral,
        allowedMentions: mentionSafety.SAFE_ALLOWED_MENTIONS
    });
    return false;
}

const parseCollectionCustomID = (customID) => {
    const parts = customID.split(":");
    if(parts.length != 7 || parts[0] != "collection") return null;

    const page = Number(parts[4]);
    const selectedPlayerID = Number(parts[5]);
    const expiresAt = Number(parts[6]);
    if(!Number.isInteger(page) || !Number.isInteger(selectedPlayerID) || !Number.isInteger(expiresAt)) return null;

    return {
        action: parts[1],
        ownerID: parts[2],
        requestedUserID: parts[3],
        page,
        selectedPlayerID,
        expiresAt
    };
}

const getCollectionCustomID = (action, ownerID, requestedUserID, page, selectedPlayerID, expiresAt) => {
    return `collection:${action}:${ownerID}:${requestedUserID}:${page}:${selectedPlayerID || 0}:${expiresAt}`;
}

const getCollectionOfAUser = async (discordID) => {
    let userCollection = await getEmptyCollection()
    let distinctCardsList = await apiDB.getDistinctPlayerIDAndRarityInUserInventory(discordID)
    return fillCardsCollection(userCollection, distinctCardsList)
}

const fillCardsCollection = (collection, distinctCardsList) => {
    distinctCardsList.forEach((cardData) => {
        if(!collection[cardData.playerID]){
            collection[cardData.playerID] = {}
        }
        collection[cardData.playerID][cardData.rarity] = Math.max(1, Number(cardData.copies) || 1)
    })
    return collection
}

const getEmptyCollection = async () => {
    let collection = {}
    const activePlayers = await apiDB.getGuildPlayersList()
    for(const player of activePlayers){
        collection[player.playerID] = {}
    }

    return collection
}

const getEachRarityCardsNumbers = async (discordID) => {

    let distinctCardsList = await apiDB.getDistinctPlayerIDAndRarityInUserInventory(discordID)

    let collectionStats = {}

    for(const rarity of constants.RARITIES){
        collectionStats[rarity.name] = 0
    }

    for (let index = 0; index < distinctCardsList.length; index++) {
        collectionStats[distinctCardsList[index].rarity] = (collectionStats[distinctCardsList[index].rarity] || 0) + 1
    }

    return collectionStats

}

const getPlayerRarityStatusText = (playerCollection) => {
    const rarityStatusParts = constants.RARITIES.map(rarity => {
        const copies = Number(playerCollection[rarity.name]) || 0;
        return `**${rarity.shortName}** ${copies ? `${HAS_MARK}${getCopiesEmoji(copies)}` : HASNT_MARK}`
    })
    const splitIndex = Math.ceil(rarityStatusParts.length / 2)
    return `${rarityStatusParts.slice(0, splitIndex).join(" · ")}\n${rarityStatusParts.slice(splitIndex).join(" · ")}`
}

const COPY_EMOJIS = ["", "", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"];
const getCopiesEmoji = copies => copies > 1 ? ` ${COPY_EMOJIS[Math.min(copies, 9)]}` : "";

const getPlayerDisplay = (playerData) => {
    const name = mentionSafety.escapeMarkdown(playerData?.playerName || `Joueur ${playerData?.playerID ?? "?"}`)
    return /^\d{17,20}$/.test(playerData?.discordID || "") ? `**${name}** (<@${playerData.discordID}>)` : `**${name}**`
}

const getPlayerOptionLabel = (playerData) => {
    const label = playerData?.playerName || `Joueur ${playerData?.playerID ?? "?"}`;
    return label.slice(0, 100);
}

const getUserDisplay = (user) => {
    return /^\d{17,20}$/.test(user?.id || "") ? `<@${user.id}>` : (user?.username || "cet utilisateur")
}

const getTotalPages = (itemsNumber) => Math.max(1, Math.ceil(Number(itemsNumber || 0) / COLLECTION_PLAYERS_PER_PAGE));
const clampPage = (page, totalPages) => Math.min(Math.max(Number(page) || 1, 1), totalPages);

module.exports = {
    getCollectionOfAUser,
    getCollectionReply,
    getCollectionContainer,
    getCollectionEmbed,
    getEachRarityCardsNumbers,
    getCollectionStatsEmbed,
    handleCollectionButton,
    handleCollectionSelect
};
