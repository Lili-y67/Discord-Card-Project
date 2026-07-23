const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require("discord.js");
const apiDB = require("./apiDB");
const cardFunctions = require("./secondLayerCardFunctions");
const sellFunctions = require("./secondLayerSellFunctions");
const discardFunctions = require("./secondLayerDiscardFunctions");
const componentLifecycle = require("./componentLifecycle");
const mentionSafety = require("./mentionSafety");

const CARDS_PER_PAGE = 10;
const MODES = new Set(["sell", "discard", "card"]);

const getPickerReply = async (user, mode, page = 1, selectedCardID = 0, expiresAt = componentLifecycle.createExpiresAt()) => {
    const cards = await apiDB.getCardsFromOwnerID(user.id, { filter: "cardID", ascendant: false });
    const totalPages = Math.max(1, Math.ceil(cards.length / CARDS_PER_PAGE));
    const currentPage = Math.min(Math.max(Number(page) || 1, 1), totalPages);
    const pageCards = cards.slice((currentPage - 1) * CARDS_PER_PAGE, currentPage * CARDS_PER_PAGE);
    const selectedCard = cards.find(card => Number(card.cardID) === Number(selectedCardID));
    const title = mode === "sell" ? "Vendre une carte" : mode === "discard" ? "Défausser une carte" : "Aperçu d’une carte";
    const embed = new EmbedBuilder().setColor("#D72306").setTitle(title)
        .setDescription(selectedCard
            ? `Carte sélectionnée : **#${selectedCard.cardID} — ${selectedCard.playerData?.playerName || `Joueur ${selectedCard.playerID}`} — ${selectedCard.rarity}**`
            : cards.length ? "Choisis une carte dans la liste ci-dessous." : "Tu ne possèdes aucune carte.");
    const components = [];
    if(pageCards.length){
        components.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId(customID(mode, user.id, "select", currentPage, selectedCardID, expiresAt))
                .setPlaceholder("Choisir une carte")
                .addOptions(pageCards.map(card => new StringSelectMenuOptionBuilder()
                    .setLabel(`#${card.cardID} · ${(card.playerData?.playerName || `Joueur ${card.playerID}`).slice(0, 60)}`)
                    .setDescription(`${card.rarity} · valeur ${card.rarityValue}`.slice(0, 100))
                    .setValue(card.cardID.toString())
                    .setDefault(Number(card.cardID) === Number(selectedCardID))))
        ));
        components.push(...getActionRows(mode, user.id, currentPage, totalPages, selectedCardID, expiresAt));
    }
    return mentionSafety.withSafeMentions({ embeds: [embed], components });
};

const getActionRows = (mode, userID, page, totalPages, selectedCardID, expiresAt) => {
    const navigationRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(customID(mode, userID, "prev", page - 1, 0, expiresAt)).setStyle(ButtonStyle.Secondary).setEmoji("⬅️").setDisabled(page <= 1),
        new ButtonBuilder().setCustomId(customID(mode, userID, "page", page, 0, expiresAt)).setStyle(ButtonStyle.Secondary).setLabel(`${page}/${totalPages}`).setDisabled(true),
        new ButtonBuilder().setCustomId(customID(mode, userID, "next", page + 1, 0, expiresAt)).setStyle(ButtonStyle.Secondary).setEmoji("➡️").setDisabled(page >= totalPages)
    );
    // En mode /card, choisir une option affiche déjà la carte. Les boutons
    // "Aperçu" et "Annuler" n'apportaient donc aucune action supplémentaire.
    if(mode === "card") return [navigationRow];

    const actionRow = new ActionRowBuilder();
    if(mode !== "card") actionRow.addComponents(
        new ButtonBuilder().setCustomId(customID(mode, userID, "confirm", page, selectedCardID, expiresAt))
            .setStyle(mode === "sell" ? ButtonStyle.Success : ButtonStyle.Danger)
            .setEmoji(mode === "sell" ? "💰" : "♻️").setLabel(mode === "sell" ? "Vendre" : "Défausser").setDisabled(!selectedCardID)
    );
    actionRow.addComponents(
        new ButtonBuilder().setCustomId(customID(mode, userID, "preview", page, selectedCardID, expiresAt))
            .setStyle(ButtonStyle.Primary).setEmoji("🔍").setLabel("Aperçu").setDisabled(!selectedCardID),
        new ButtonBuilder().setCustomId(customID(mode, userID, "cancel", page, selectedCardID, expiresAt))
            .setStyle(ButtonStyle.Danger).setEmoji("✖️").setLabel("Annuler")
    );
    return [navigationRow, actionRow];
};

const handleSelect = async (client, interaction) => {
    const parsed = parse(interaction.customId);
    if(!parsed || parsed.action !== "select") return false;
    if(!(await canUse(interaction, parsed))) return true;
    const selectedCardID = Number(interaction.values[0]);
    if(parsed.mode === "card"){
        if(!(await apiDB.doesUserOwnThisCard(selectedCardID, interaction.user.id))){
            await refresh(interaction, parsed.mode, parsed.page, 0);
            await interaction.followUp({ content: "Cette carte ne t’appartient plus.", flags: MessageFlags.Ephemeral });
            return true;
        }

        // Reconstruire le sélecteur sans option par défaut le remet dans son
        // état initial, puis la carte choisie est affichée immédiatement.
        await refresh(interaction, parsed.mode, parsed.page, 0);
        await interaction.followUp(await cardFunctions.getCardReply(client, selectedCardID, interaction.user, true));
        return true;
    }
    await refresh(interaction, parsed.mode, parsed.page, selectedCardID);
    return true;
};

const handleButton = async (client, interaction) => {
    const parsed = parse(interaction.customId);
    if(!parsed || parsed.action === "select") return false;
    if(!(await canUse(interaction, parsed))) return true;
    if(parsed.action === "cancel"){
        await interaction.deferUpdate();
        if(interaction.message.deletable) await interaction.message.delete();
        return true;
    }
    if(["prev", "next"].includes(parsed.action)){
        await refresh(interaction, parsed.mode, parsed.page, 0);
        return true;
    }
    if(parsed.action === "preview"){
        if(!(await apiDB.doesUserOwnThisCard(parsed.selectedCardID, interaction.user.id))){
            await interaction.reply({ content: "Cette carte ne t’appartient plus.", flags: MessageFlags.Ephemeral }); return true;
        }
        await interaction.reply({ embeds: [await cardFunctions.getCardEmbed(client, parsed.selectedCardID)], flags: MessageFlags.Ephemeral });
        return true;
    }
    if(parsed.action === "confirm"){
        await startConfirmation(client, interaction, parsed);
        return true;
    }
    await interaction.deferUpdate();
    return true;
};

const startConfirmation = async (client, interaction, parsed) => {
    const cardID = parsed.selectedCardID;
    if(!cardID || !(await apiDB.doesUserOwnThisCard(cardID, interaction.user.id))){
        await interaction.reply({ content: "Cette carte ne t’appartient plus.", flags: MessageFlags.Ephemeral }); return;
    }
    if(await apiDB.isACardLocked(cardID)){
        await interaction.reply({ content: "Cette carte est actuellement verrouillée.", flags: MessageFlags.Ephemeral }); return;
    }
    await apiDB.lockACard(cardID);
    const cardEmbed = await cardFunctions.getCardEmbed(client, cardID);
    if(parsed.mode === "sell"){
        const confirmation = await sellFunctions.getConfirmationSellEmbed(cardID);
        const buttons = await sellFunctions.getSellConfirmationButtons(client, interaction, cardID);
        await interaction.update({ embeds: [cardEmbed, confirmation], components: [buttons] });
    } else {
        const confirmation = await discardFunctions.getConfirmationDiscardEmbed(cardID);
        const buttons = await discardFunctions.getDiscardConfirmationButtons(client, interaction, cardID);
        await interaction.update({ embeds: [cardEmbed, confirmation], components: [buttons] });
    }
};

const refresh = async (interaction, mode, page, selected) => {
    const expiresAt = componentLifecycle.createExpiresAt();
    await interaction.update(await getPickerReply(interaction.user, mode, page, selected, expiresAt));
    componentLifecycle.scheduleInteractionExpiration(interaction, mode, expiresAt);
};
const canUse = async (interaction, parsed) => {
    if(componentLifecycle.isExpired(parsed.expiresAt)){ await componentLifecycle.expireInteractedMessage(interaction, parsed.mode, interaction.commandId); return false; }
    if(interaction.user.id === parsed.userID) return true;
    await interaction.reply({ content: "Ce sélecteur ne t’appartient pas.", flags: MessageFlags.Ephemeral }); return false;
};
const customID = (mode, userID, action, page, selected, expiresAt) => `cardpicker:${mode}:${userID}:${action}:${page}:${selected || 0}:${expiresAt}`;
const parse = id => {
    const p = id.split(":"); if(p.length !== 7 || p[0] !== "cardpicker" || !MODES.has(p[1])) return null;
    const page = Number(p[4]), selectedCardID = Number(p[5]), expiresAt = Number(p[6]);
    if(!Number.isInteger(page) || !Number.isInteger(selectedCardID) || !Number.isInteger(expiresAt)) return null;
    return { mode: p[1], userID: p[2], action: p[3], page, selectedCardID, expiresAt };
};

module.exports = { getPickerReply, handleSelect, handleButton };
