const { EmbedBuilder } = require('discord.js');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, MessageFlags, SeparatorBuilder } = require('discord.js');

const constants = require("../data/constants.js")
const apiDB = require("./apiDB");
const buttonCenter = require("../functions/buttonCenter")

const COLLECTION_ACCENT_COLOR = 0xD72306;
const HAS_MARK = "✓";
const HASNT_MARK = "✘";

const getCollectionReply = async (client, interaction, userCollection, currentPage, requestedUser) => {
    const buttonRows = await getSwitchPagesButtons(client, interaction, currentPage, userCollection, requestedUser);
    return {
        components: [await getCollectionContainer(userCollection, currentPage, requestedUser, buttonRows)],
        flags: MessageFlags.IsComponentsV2
    };
}

const getCollectionContainer = async (userCollection, currentPage, user, buttonRows) => {
    let playerIDs = Object.keys(userCollection).map(Number).sort((a, b) => a - b)
    let keysNumber = playerIDs.length
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

    let totalPageNumber = keysNumber%constants.PLAYERSPERCOLLECTIONPAGE != 0 ? parseInt(keysNumber/constants.PLAYERSPERCOLLECTIONPAGE) + 1 : parseInt(keysNumber/constants.PLAYERSPERCOLLECTIONPAGE)

    if(currentPage > totalPageNumber) return

    let playerDataList = []

    for(const playerID of playerIDs.slice(constants.PLAYERSPERCOLLECTIONPAGE * (currentPage - 1), constants.PLAYERSPERCOLLECTIONPAGE * currentPage)){
        playerDataList.push(apiDB.getPlayerDataFromID(playerID))
    }

    const resolvedPlayers = await Promise.all(playerDataList)
    for(const player of resolvedPlayers){
        container.addTextDisplayComponents(text =>
            text.setContent(`${getPlayerDisplay(player)}\n\`\`\`txt\n${getRarityHeaderLine()}\n${getPlayerRarityStatusLine(userCollection[player.playerID] || {})}\n\`\`\``)
        );
    }

    container
        .addTextDisplayComponents(text =>
            text.setContent(`-# Page ${currentPage.toString()} sur ${totalPageNumber.toString()}`)
        )
        .addActionRowComponents(buttonRows);

    return container;
}

const getCollectionEmbed = async (userCollection, currentPage, user) => {
    const container = await getCollectionContainer(userCollection, currentPage, user, new ActionRowBuilder());
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

const getSwitchPagesButtons = async (client, interaction, currentPage, userCollection, requestedUser) => {
    let buttonGroupID = await buttonCenter.registerAButtonGroup(client, expirationFunction, interaction, {})

    let nextPageButtonID = await buttonCenter.registerAButton(client, "NextPageCollection", buttonGroupID, nextPageFunction, {userCollection:userCollection, currentPage:currentPage, requestedUser:requestedUser}, false, [interaction.user.id])

    let previousPageButton = await buttonCenter.registerAButton(client, "PreviousPageCollection", buttonGroupID, preivousPageFunction, {userCollection:userCollection, currentPage:currentPage, requestedUser:requestedUser}, false, [interaction.user.id])

    let buttonRows = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
        .setCustomId(previousPageButton)
        .setStyle(ButtonStyle.Primary)
        .setEmoji("⬅️"),

        new ButtonBuilder()
            .setCustomId(nextPageButtonID)
            .setStyle(ButtonStyle.Primary)
            .setEmoji("➡️"),
    );

    if(currentPage == 1){
        buttonRows.components[0].setDisabled(true)
    }
    let keysNumber = Object.keys(userCollection).length
    const totalPageNumber = Math.max(1, keysNumber%constants.PLAYERSPERCOLLECTIONPAGE != 0 ? parseInt(keysNumber/constants.PLAYERSPERCOLLECTIONPAGE) + 1 : parseInt(keysNumber/constants.PLAYERSPERCOLLECTIONPAGE))
    if(currentPage >= totalPageNumber){
        buttonRows.components[1].setDisabled(true)
    }

    return buttonRows
}

const expirationFunction = async (client, genesisInteraction, customDataDictionary) => {
    //rien je suppose...
}

const nextPageFunction = async (client, currentInteraction, genesisInteraction, customDataDictionary) => {
    let buttonRows = await getSwitchPagesButtons(client, genesisInteraction, customDataDictionary.currentPage + 1, customDataDictionary.userCollection, customDataDictionary.requestedUser)
    await genesisInteraction.editReply({components:[await getCollectionContainer(customDataDictionary.userCollection, customDataDictionary.currentPage + 1, customDataDictionary.requestedUser, buttonRows)]})
    currentInteraction.deferUpdate()
}

const preivousPageFunction = async (client, currentInteraction, genesisInteraction, customDataDictionary) => {
    let buttonRows = await getSwitchPagesButtons(client, genesisInteraction, customDataDictionary.currentPage - 1, customDataDictionary.userCollection, customDataDictionary.requestedUser)
    await genesisInteraction.editReply({components:[await getCollectionContainer(customDataDictionary.userCollection, customDataDictionary.currentPage - 1, customDataDictionary.requestedUser, buttonRows)]})
    currentInteraction.deferUpdate()
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
        collection[cardData.playerID][cardData.rarity] = true
    })
    return collection
}

const getEmptyCollection = async () => {
    let collection = {}
    let lastPickablePlayerID = await apiDB.getLastPickablePlayerID()

    for(let playerID = 1; playerID<lastPickablePlayerID+1; playerID++){
        collection[playerID] = {}
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

const getPlayerRarityStatusLine = (playerCollection) => {
    return constants.RARITIES
        .map(rarity => centerText(playerCollection[rarity.name] ? HAS_MARK : HASNT_MARK, getRarityCellWidth(rarity)))
        .join(" ")
}

const getRarityHeaderLine = () => {
    return constants.RARITIES
        .map(rarity => centerText(rarity.shortName, getRarityCellWidth(rarity)))
        .join(" ")
}

const getRarityCellWidth = (rarity) => {
    return Math.max(rarity.shortName.length, 3)
}

const centerText = (value, width) => {
    const stringValue = value.toString()
    const leftPadding = Math.floor((width - stringValue.length) / 2)
    const rightPadding = width - stringValue.length - leftPadding
    return `${" ".repeat(leftPadding)}${stringValue}${" ".repeat(rightPadding)}`
}

const getPlayerDisplay = (playerData) => {
    return /^\d{17,20}$/.test(playerData?.discordID || "") ? `<@${playerData.discordID}>` : (playerData?.playerName || `Joueur ${playerData?.playerID ?? "?"}`)
}

const getUserDisplay = (user) => {
    return /^\d{17,20}$/.test(user?.id || "") ? `<@${user.id}>` : (user?.username || "cet utilisateur")
}

module.exports = {
    getCollectionOfAUser,
    getCollectionReply,
    getCollectionContainer,
    getCollectionEmbed,
    getSwitchPagesButtons,
    getEachRarityCardsNumbers,
    getCollectionStatsEmbed
};
