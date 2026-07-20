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
const constants = require("../data/constants");
const mentionSafety = require("./mentionSafety");

const PROFILE_ACCENT_COLOR = 0xfc6600;

const getProfileReply = async (profileUser, requestedByUser) => {
    const userDB = await apiDB.getAUserFromDiscordID(profileUser.id);
    const pickedCards = await apiDB.getPickedCardsNumberOfAUser(profileUser.id);
    const ownedCards = await apiDB.getOwnedCardsNumberOfAUser(profileUser.id);
    const rankName = constants.RANKIDTORANKNAMEDICO[userDB.rankID] || `Rang ${userDB.rankID}`;

    return mentionSafety.withSafeMentions({
        components: [getProfileContainer(profileUser, requestedByUser, userDB, pickedCards, ownedCards, rankName)],
        flags: MessageFlags.IsComponentsV2
    });
}

const getProfileContainer = (profileUser, requestedByUser, userDB, pickedCards, ownedCards, rankName) => {
    const thumbnailURL = requestedByUser?.displayAvatarURL?.({ extension: "png", size: 128, forceStatic: true });
    const profileDisplay = mentionSafety.getUserMention(profileUser.id) || mentionSafety.getDisplayName(profileUser.username);
    const requestedByDisplay = mentionSafety.getUserMention(requestedByUser?.id) || mentionSafety.getDisplayName(requestedByUser?.username);

    const container = new ContainerBuilder()
        .setAccentColor(PROFILE_ACCENT_COLOR)
        .addSectionComponents(section => {
            section.addTextDisplayComponents(text =>
                text.setContent(`## Profil de ${profileDisplay}\n-# Demande par ${requestedByDisplay}`)
            );
            if(thumbnailURL){
                section.setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnailURL));
            }
            return section;
        })
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(text =>
            text.setContent([
                `**Argent** ${userDB.money}$`,
                `**Card points** ${userDB.cardPoints} pts`,
                `**Rang actuel** ${mentionSafety.escapeMarkdown(rankName)}`,
                `**Cartes pick** ${pickedCards}`,
                `**Cartes possedees** ${ownedCards}`
            ].join("\n"))
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(getProfileMenuRow());

    return container;
}

const getProfileMenuRow = () => {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("profile-menu-collection")
            .setStyle(ButtonStyle.Secondary)
            .setLabel("/collection")
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId("profile-menu-rankup")
            .setStyle(ButtonStyle.Secondary)
            .setLabel("/rankup")
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId("profile-menu-top")
            .setStyle(ButtonStyle.Secondary)
            .setLabel("/top")
            .setDisabled(true)
    );
}

module.exports = {
    getProfileReply
};
