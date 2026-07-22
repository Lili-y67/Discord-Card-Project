const crypto = require("node:crypto");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, MessageFlags, SeparatorBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require("discord.js");
const apiDB = require("./apiDB");
const questCore = require("./questCore");
const transactionFunctions = require("./secondLayerTransactionFunctions");
const componentLifecycle = require("./componentLifecycle");
const mentionSafety = require("./mentionSafety");

const PAGE_SIZE = 10;
const states = new Map();

const createTrade = async (interaction, partner, proposedMoney = 0, askedMoney = 0) => {
    const payer = proposedMoney < askedMoney ? "partner" : proposedMoney > askedMoney ? "owner" : "none";
    const state = {
        id: crypto.randomBytes(6).toString("hex"), ownerID: interaction.user.id, partnerID: partner.id,
        ownerName: interaction.user.username, partnerName: partner.username,
        payer, amount: Math.abs(proposedMoney - askedMoney), ownCards: [], partnerCards: [],
        ownPage: 1, partnerPage: 1, status: "building", locked: false,
        expiresAt: componentLifecycle.createExpiresAt(), rootInteraction: interaction, guildID: interaction.guildId
    };
    states.set(state.id, state);
    return state;
};

const getReply = async state => mentionSafety.withSafeMentions({
    components: [await getContainer(state)], flags: MessageFlags.IsComponentsV2
});

const getContainer = async state => {
    if(state.status !== "building") return getFinalContainer(state);
    const ownInventory = await apiDB.getCardsFromOwnerID(state.ownerID, { filter: "cardID", ascendant: false });
    const partnerInventory = await apiDB.getCardsFromOwnerID(state.partnerID, { filter: "cardID", ascendant: false });
    const container = new ContainerBuilder().setAccentColor(0xD72306)
        .addTextDisplayComponents(text => text.setContent(`## Échange avec <@${state.partnerID}>\nSélectionne jusqu’à **10 cartes par côté**.`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(text => text.setContent(summary(state, ownInventory, partnerInventory)));
    addInventoryControls(container, state, "own", ownInventory);
    container.addSeparatorComponents(new SeparatorBuilder());
    addInventoryControls(container, state, "partner", partnerInventory);
    container.addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(id(state, "review")).setStyle(ButtonStyle.Success).setLabel("Proposer l’échange")
                .setDisabled(!state.ownCards.length && !state.partnerCards.length && !state.amount),
            new ButtonBuilder().setCustomId(id(state, "cancel")).setStyle(ButtonStyle.Danger).setLabel("Annuler")
        ));
    return container;
};

const addInventoryControls = (container, state, side, inventory) => {
    const pageKey = side === "own" ? "ownPage" : "partnerPage";
    const selected = side === "own" ? state.ownCards : state.partnerCards;
    const totalPages = Math.max(1, Math.ceil(inventory.length / PAGE_SIZE));
    state[pageKey] = Math.min(state[pageKey], totalPages);
    const pageCards = inventory.slice((state[pageKey] - 1) * PAGE_SIZE, state[pageKey] * PAGE_SIZE);
    const label = side === "own" ? `Tes cartes (${selected.length}/10)` : `Cartes de ${state.partnerName} (${selected.length}/10)`;
    container.addTextDisplayComponents(text => text.setContent(`### ${label}`));
    if(!pageCards.length){ container.addTextDisplayComponents(text => text.setContent("Aucune carte disponible.")); return; }
    container.addActionRowComponents(new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId(id(state, `${side}select`)).setPlaceholder("Choisir sur cette page")
            .setMinValues(0).setMaxValues(Math.min(10, pageCards.length))
            .addOptions(pageCards.map(card => new StringSelectMenuOptionBuilder()
                .setLabel(`#${card.cardID} · ${(card.playerData?.playerName || `Joueur ${card.playerID}`).slice(0, 60)}`)
                .setDescription(`${card.rarity} · ${card.rarityValue}`)
                .setValue(card.cardID.toString()).setDefault(selected.includes(card.cardID))))
    ));
    container.addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(id(state, `${side}prev`)).setStyle(ButtonStyle.Secondary).setEmoji("⬅️").setDisabled(state[pageKey] <= 1),
        new ButtonBuilder().setCustomId(id(state, `${side}noop`)).setStyle(ButtonStyle.Secondary).setLabel(`${state[pageKey]}/${totalPages}`).setDisabled(true),
        new ButtonBuilder().setCustomId(id(state, `${side}next`)).setStyle(ButtonStyle.Secondary).setEmoji("➡️").setDisabled(state[pageKey] >= totalPages)
    ));
};

const summary = (state, ownInventory, partnerInventory) => {
    const ownMap = new Map(ownInventory.map(card => [card.cardID, card]));
    const partnerMap = new Map(partnerInventory.map(card => [card.cardID, card]));
    const lines = ids => ids.length ? ids.map(cardID => { const c = ownMap.get(cardID) || partnerMap.get(cardID); return c ? `#${c.cardID} ${c.playerData?.playerName || "Carte"} (${c.rarity})` : `#${cardID}`; }).join(", ") : "Aucune";
    const money = state.payer === "owner" ? `${state.ownerName} donne **${state.amount}$**` : state.payer === "partner" ? `${state.partnerName} donne **${state.amount}$**` : "Aucun argent";
    return `**Tu proposes :** ${lines(state.ownCards)}\n**Tu demandes :** ${lines(state.partnerCards)}\n**Argent :** ${money}`;
};

const getFinalContainer = state => {
    const completed = state.status === "done", canceled = state.status === "canceled" || state.status === "expired";
    const title = completed ? "## ✅ Échange effectué" : canceled ? `## ${state.status === "expired" ? "⌛ Échange expiré" : "❌ Échange annulé"}` : "## 🤝 Proposition d’échange";
    const container = new ContainerBuilder().setAccentColor(completed ? 0x39B54A : canceled ? 0x666666 : 0xF6A700)
        .addTextDisplayComponents(text => text.setContent(`${title}\n<@${state.ownerID}> ↔ <@${state.partnerID}>`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(text => text.setContent(`**Cartes proposées :** ${state.ownCards.length ? state.ownCards.map(id => `#${id}`).join(", ") : "Aucune"}\n**Cartes demandées :** ${state.partnerCards.length ? state.partnerCards.map(id => `#${id}`).join(", ") : "Aucune"}\n**Argent :** ${state.payer === "owner" ? `${state.ownerName} donne ${state.amount}$` : state.payer === "partner" ? `${state.partnerName} donne ${state.amount}$` : "Aucun"}`));
    if(state.status === "pending") container.addSeparatorComponents(new SeparatorBuilder()).addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(id(state, "accept")).setStyle(ButtonStyle.Success).setLabel("Accepter"),
        new ButtonBuilder().setCustomId(id(state, "cancel")).setStyle(ButtonStyle.Danger).setLabel("Refuser / Annuler")
    ));
    return container;
};

const handleSelect = async (client, interaction) => {
    const parsed = parse(interaction.customId); if(!parsed || !parsed.action.endsWith("select")) return false;
    const state = states.get(parsed.stateID); if(!(await authorize(interaction, state, true))) return true;
    const side = parsed.action.startsWith("own") ? "own" : "partner";
    const inventory = await apiDB.getCardsFromOwnerID(side === "own" ? state.ownerID : state.partnerID, { filter: "cardID", ascendant: false });
    const page = side === "own" ? state.ownPage : state.partnerPage;
    const pageIDs = inventory.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(card => card.cardID);
    const key = side === "own" ? "ownCards" : "partnerCards";
    const preserved = state[key].filter(cardID => !pageIDs.includes(cardID));
    const next = [...preserved, ...interaction.values.map(Number)];
    if(next.length > 10){ await interaction.reply({ content: "Maximum 10 cartes par côté.", flags: MessageFlags.Ephemeral }); return true; }
    state[key] = next; await refresh(interaction, state); return true;
};

const handleButton = async (client, interaction) => {
    const parsed = parse(interaction.customId); if(!parsed || parsed.action.endsWith("select")) return false;
    const state = states.get(parsed.stateID); if(!state){ await interaction.reply({ content: "Cet échange a expiré.", flags: MessageFlags.Ephemeral }); return true; }
    if(parsed.action === "accept") return await accept(interaction, state);
    if(parsed.action === "cancel") return await cancel(interaction, state);
    if(!(await authorize(interaction, state, true))) return true;
    if(parsed.action === "review") return await review(interaction, state);
    if(parsed.action.endsWith("prev") || parsed.action.endsWith("next")){
        const side = parsed.action.startsWith("own") ? "own" : "partner"; const key = side === "own" ? "ownPage" : "partnerPage";
        state[key] += parsed.action.endsWith("next") ? 1 : -1; await refresh(interaction, state); return true;
    }
    await interaction.deferUpdate(); return true;
};

const review = async (interaction, state) => {
    if(!(await validateOwnership(state))){ await interaction.reply({ content: "Une carte sélectionnée n’est plus disponible.", flags: MessageFlags.Ephemeral }); return true; }
    if((state.ownCards.length && await apiDB.bulkIsACardLocked(state.ownCards)) || (state.partnerCards.length && await apiDB.bulkIsACardLocked(state.partnerCards))){ await interaction.reply({ content: "Une carte sélectionnée est déjà verrouillée.", flags: MessageFlags.Ephemeral }); return true; }
    if(state.ownCards.length) await apiDB.bulkLock(state.ownCards); if(state.partnerCards.length) await apiDB.bulkLock(state.partnerCards);
    state.locked = true; state.status = "pending"; await refresh(interaction, state); return true;
};

const accept = async (interaction, state) => {
    if(interaction.user.id !== state.partnerID){ await interaction.reply({ content: "Seul le partenaire peut accepter.", flags: MessageFlags.Ephemeral }); return true; }
    if(state.status !== "pending" || !(await validateOwnership(state))){ await interaction.reply({ content: "Cet échange n’est plus valide.", flags: MessageFlags.Ephemeral }); return true; }
    const payerID = state.payer === "owner" ? state.ownerID : state.payer === "partner" ? state.partnerID : null;
    if(payerID && !(await apiDB.hasEnoughMoney(payerID, state.amount))){ await interaction.reply({ content: "Le payeur n’a plus assez d’argent.", flags: MessageFlags.Ephemeral }); return true; }
    if(payerID){ const receiver = payerID === state.ownerID ? state.partnerID : state.ownerID; await transactionFunctions.subMoney(payerID, state.amount); await transactionFunctions.giveMoney(receiver, state.amount); }
    if(state.ownCards.length) await apiDB.bulkChangeCardOwnership(state.ownCards, state.partnerID);
    if(state.partnerCards.length) await apiDB.bulkChangeCardOwnership(state.partnerCards, state.ownerID);
    await unlock(state); state.status = "done"; await questCore.trackEvent(state.ownerID, "trade_completed"); await questCore.trackEvent(state.partnerID, "trade_completed");
    await interaction.update(await getReply(state)); states.delete(state.id); return true;
};

const cancel = async (interaction, state) => {
    if(![state.ownerID, state.partnerID].includes(interaction.user.id)){ await interaction.reply({ content: "Tu ne participes pas à cet échange.", flags: MessageFlags.Ephemeral }); return true; }
    await unlock(state); state.status = "canceled"; await interaction.update(await getReply(state)); states.delete(state.id); return true;
};
const validateOwnership = async state => (!state.ownCards.length || await ownsAll(state.ownCards, state.ownerID)) && (!state.partnerCards.length || await ownsAll(state.partnerCards, state.partnerID));
const ownsAll = async (ids, owner) => { const owned = new Set((await apiDB.getCardsFromOwnerID(owner)).map(card => card.cardID)); return ids.every(id => owned.has(id)); };
const unlock = async state => { if(!state.locked) return; if(state.ownCards.length) await apiDB.bulkUnlock(state.ownCards); if(state.partnerCards.length) await apiDB.bulkUnlock(state.partnerCards); state.locked = false; };
const authorize = async (interaction, state, ownerOnly) => { if(!state || Date.now() > state.expiresAt){ await interaction.reply({ content: "Cet échange a expiré.", flags: MessageFlags.Ephemeral }); return false; } if(!ownerOnly || interaction.user.id === state.ownerID) return true; await interaction.reply({ content: "Seul l’auteur configure cet échange.", flags: MessageFlags.Ephemeral }); return false; };
const refresh = async (interaction, state) => { state.expiresAt = componentLifecycle.createExpiresAt(); await interaction.update(await getReply(state)); schedule(state); };
const schedule = state => { const token = state.expiresAt; setTimeout(async()=>{ if(!states.has(state.id) || state.expiresAt !== token) return; await apiDB.withGuild(state.guildID, async()=>{ await unlock(state); state.status="expired"; try{ await state.rootInteraction.editReply(await getReply(state)); }catch{} states.delete(state.id); }); }, Math.max(token-Date.now(),0)); };
const id = (state, action) => `tradebuild:${state.id}:${action}`;
const parse = value => { const p=value.split(":"); return p.length===3&&p[0]==="tradebuild"?{stateID:p[1],action:p[2]}:null; };

module.exports = { createTrade, getReply, handleSelect, handleButton, schedule };
