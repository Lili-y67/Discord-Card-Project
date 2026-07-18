const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    MessageFlags,
    SeparatorBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} = require('discord.js');

const apiDB = require("./apiDB");
const cardFunctions = require("./secondLayerCardFunctions");
const componentLifecycle = require("./componentLifecycle");
const constants = require("../data/constants.js");
const mentionSafety = require("./mentionSafety");

const PLAYERS_PER_PAGE = 25;
const ACCENT_COLOR = 0xD72306;

const getGuildCollectionReply = async (user, page = 1, selectedPlayerID = null, expiresAt = componentLifecycle.createExpiresAt()) => {
    const players = await apiDB.getGuildPlayersList();
    const totalPages = getTotalPages(players.length);
    const currentPage = clampPage(page, totalPages);
    const selectedPlayer = selectedPlayerID ? players.find(player => player.playerID == selectedPlayerID) : null;

    return {
        components: [getGuildCollectionContainer(user.id, players, currentPage, totalPages, selectedPlayer, expiresAt)],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: mentionSafety.SAFE_ALLOWED_MENTIONS
    };
}

const getGuildCollectionContainer = (userID, players, currentPage, totalPages, selectedPlayer, expiresAt) => {
    const pagePlayers = players.slice(PLAYERS_PER_PAGE * (currentPage - 1), PLAYERS_PER_PAGE * currentPage);
    const container = new ContainerBuilder()
        .setAccentColor(ACCENT_COLOR)
        .addTextDisplayComponents(text =>
            text.setContent("Collection du serveur")
        )
        .addSeparatorComponents(new SeparatorBuilder());

    if(!players.length){
        return container.addTextDisplayComponents(text =>
            text.setContent("Aucun membre synchronisé pour ce serveur. Lance `npm run sync-members` sur le panel ou redémarre le bot pour remplir la liste.")
        );
    }

    container
        .addTextDisplayComponents(text =>
            text.setContent(`Membres disponibles : ${players.length}`)
        )
        .addActionRowComponents(getPlayerSelectRow(userID, currentPage, pagePlayers, expiresAt))
        .addActionRowComponents(getNavigationRow(userID, currentPage, totalPages, expiresAt));

    if(selectedPlayer){
        container
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(text =>
                text.setContent(`Aperçus pour ${getPlayerDisplay(selectedPlayer)}`)
            )
            .addActionRowComponents(getRaritySelectRow(userID, selectedPlayer.playerID, currentPage, expiresAt));
    }

    return container;
}

const getPlayerSelectRow = (userID, currentPage, players, expiresAt) => {
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(getGuildCollectionCustomID("member", userID, currentPage, 0, expiresAt))
        .setPlaceholder("Choisir un membre")
        .addOptions(players.map(player =>
            new StringSelectMenuOptionBuilder()
                .setLabel(truncateString(player.playerName || `Joueur ${player.playerID}`, 100))
                .setDescription(`Joueur ${player.playerID}`)
                .setValue(player.playerID.toString())
        ));

    return new ActionRowBuilder().addComponents(selectMenu);
}

const getRaritySelectRow = (userID, playerID, currentPage, expiresAt) => {
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(getGuildCollectionCustomID("rarity", userID, currentPage, playerID, expiresAt))
        .setPlaceholder("Choisir une rareté à prévisualiser")
        .addOptions(constants.RARITIES.map(rarity =>
            new StringSelectMenuOptionBuilder()
                .setLabel(rarity.name)
                .setDescription(`${(rarity.weight / constants.RARITY_CHANCE_TOTAL * 100).toFixed(3)}%`)
                .setValue(rarity.name)
        ));

    return new ActionRowBuilder().addComponents(selectMenu);
}

const getNavigationRow = (userID, currentPage, totalPages, expiresAt) => {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(getGuildCollectionCustomID("page", userID, currentPage - 1, 0, expiresAt))
                .setStyle(ButtonStyle.Primary)
                .setEmoji("⬅️")
                .setDisabled(currentPage <= 1),
            new ButtonBuilder()
                .setCustomId(getGuildCollectionCustomID("noop", userID, currentPage, 0, expiresAt))
                .setStyle(ButtonStyle.Secondary)
                .setLabel(`Page ${currentPage}/${totalPages}`)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(getGuildCollectionCustomID("page", userID, currentPage + 1, 0, expiresAt))
                .setStyle(ButtonStyle.Primary)
                .setEmoji("➡️")
                .setDisabled(currentPage >= totalPages)
        );
}

const handleGuildCollectionButton = async (client, interaction) => {
    const parsedInteraction = parseGuildCollectionCustomID(interaction.customId);
    if(!parsedInteraction) return false;

    if(componentLifecycle.isExpired(parsedInteraction.expiresAt)){
        await componentLifecycle.expireInteractedMessage(interaction, "guildcollection", interaction.commandId);
        return true;
    }

    if(!(await canUserInteract(interaction, parsedInteraction.userID))) return true;

    if(parsedInteraction.action == "page"){
        const user = await client.users.fetch(parsedInteraction.userID);
        await interaction.update(await getGuildCollectionReply(user, parsedInteraction.page, null, parsedInteraction.expiresAt));
        return true;
    }

    await interaction.deferUpdate();
    return true;
}

const handleGuildCollectionSelect = async (client, interaction) => {
    const parsedInteraction = parseGuildCollectionCustomID(interaction.customId);
    if(!parsedInteraction) return false;

    if(componentLifecycle.isExpired(parsedInteraction.expiresAt)){
        await componentLifecycle.expireInteractedMessage(interaction, "guildcollection", interaction.commandId);
        return true;
    }

    if(!(await canUserInteract(interaction, parsedInteraction.userID))) return true;

    const user = await client.users.fetch(parsedInteraction.userID);
    if(parsedInteraction.action == "member"){
        const selectedPlayerID = Number(interaction.values[0]);
        await interaction.update(await getGuildCollectionReply(user, parsedInteraction.page, selectedPlayerID, parsedInteraction.expiresAt));
        return true;
    }

    if(parsedInteraction.action == "rarity"){
        const rarityName = interaction.values[0];
        const playerData = await apiDB.getPlayerDataFromID(parsedInteraction.playerID);
        await interaction.update(await getGuildCollectionReply(user, parsedInteraction.page, parsedInteraction.playerID, parsedInteraction.expiresAt));
        const previewImage = await cardFunctions.generateCardPreviewImage(client, playerData, rarityName);
        await interaction.followUp({
            content: `Aperçu ${rarityName} de ${getPlayerDisplay(playerData)}`,
            files: [previewImage],
            flags: MessageFlags.Ephemeral,
            allowedMentions: mentionSafety.SAFE_ALLOWED_MENTIONS
        });
        return true;
    }

    return false;
}

const canUserInteract = async (interaction, userID) => {
    if(interaction.user.id == userID) return true;

    await interaction.reply({
        content: "Cette collection de serveur ne t'appartient pas.",
        flags: MessageFlags.Ephemeral,
        allowedMentions: mentionSafety.SAFE_ALLOWED_MENTIONS
    });
    return false;
}

const parseGuildCollectionCustomID = (customID) => {
    const parts = customID.split(":");
    if(parts.length != 6 || parts[0] != "guildcollection") return null;

    const page = Number(parts[3]);
    const playerID = Number(parts[4]);
    const expiresAt = Number(parts[5]);
    if(!Number.isInteger(page) || !Number.isInteger(playerID) || !Number.isInteger(expiresAt)) return null;

    return {
        action: parts[1],
        userID: parts[2],
        page,
        playerID,
        expiresAt
    };
}

const getGuildCollectionCustomID = (action, userID, page, playerID, expiresAt) => {
    return `guildcollection:${action}:${userID}:${page}:${playerID}:${expiresAt}`;
}

const getPlayerDisplay = (playerData) => {
    return /^\d{17,20}$/.test(playerData?.discordID || "") ? `<@${playerData.discordID}>` : (playerData?.playerName || `Joueur ${playerData?.playerID ?? "?"}`);
}

const getTotalPages = (playersNumber) => {
    return Math.max(1, Math.ceil(playersNumber / PLAYERS_PER_PAGE));
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
    getGuildCollectionReply,
    handleGuildCollectionButton,
    handleGuildCollectionSelect
};
