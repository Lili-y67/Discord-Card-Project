const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, EmbedBuilder, MessageFlags, SeparatorBuilder } = require('discord.js');

const apiDB = require("./apiDB");
const constants = require("../data/constants.js");

const MESSAGE_XP_COOLDOWN_MS = 60000;
const MESSAGE_QUEST_COOLDOWN_MS = 30000;
const DAILY_QUESTS = [
    {
        id: "messages_10",
        title: "Discussion active",
        description: "Écrire 10 messages sur le serveur.",
        event: "message_sent",
        target: 10,
        reward: { xp: 60, money: 40 }
    },
    {
        id: "pick_1",
        title: "Tirage du jour",
        description: "Réussir un /pick.",
        event: "card_picked",
        target: 1,
        reward: { xp: 45, money: 35 }
    },
    {
        id: "daily_1",
        title: "Rituel quotidien",
        description: "Récupérer son /daily.",
        event: "daily_claimed",
        target: 1,
        reward: { xp: 35, cardPoints: 3 }
    },
    {
        id: "collection_1",
        title: "Inventaire propre",
        description: "Consulter /collection ou /inv.",
        event: "collection_viewed",
        target: 1,
        reward: { xp: 25, money: 20 }
    },
    {
        id: "sell_1",
        title: "Marchandage",
        description: "Vendre une carte.",
        event: "card_sold",
        target: 1,
        reward: { xp: 50, wheelTickets: 1 }
    },
    {
        id: "discard_1",
        title: "Recyclage",
        description: "Défausser une carte.",
        event: "card_discarded",
        target: 1,
        reward: { xp: 50, cardPoints: 8 }
    },
    {
        id: "rankup_1",
        title: "Ascension",
        description: "Passer un rang.",
        event: "rank_up",
        target: 1,
        reward: { xp: 120, wheelTickets: 2, pickBoost: { multiplier: 0.85, durationMs: 3600000 } }
    },
    {
        id: "trade_1",
        title: "Échange social",
        description: "Valider un échange.",
        event: "trade_completed",
        target: 1,
        reward: { xp: 80, money: 75, wheelTickets: 1 }
    }
];

const WHEEL_REWARDS = [
    { label: "75$", weight: 28, reward: { money: 75 } },
    { label: "150$", weight: 18, reward: { money: 150 } },
    { label: "10 points de carte", weight: 20, reward: { cardPoints: 10 } },
    { label: "25 points de carte", weight: 10, reward: { cardPoints: 25 } },
    { label: "1 ticket de roue", weight: 8, reward: { wheelTickets: 1 } },
    { label: "XP bonus", weight: 8, reward: { xp: 100 } },
    { label: "Cooldown /pick -25% pendant 1h", weight: 6, reward: { pickBoost: { multiplier: 0.75, durationMs: 3600000 } } },
    { label: "Jackpot 500$", weight: 2, reward: { money: 500, xp: 150 } }
];

const getQuestDate = () => new Date().toISOString().slice(0, 10);

const getXPForNextLevel = (level) => 100 + Math.max(1, Number(level) || 1) * 75;

const getDailyQuests = () => DAILY_QUESTS;

const getQuestByID = (questID) => DAILY_QUESTS.find(quest => quest.id == questID);

const getTierQuestID = (quest, tier) => tier === 1 ? quest.id : `${quest.id}_tier${tier}`;
const buildTierQuest = (quest, tier) => ({
    ...quest,
    id: getTierQuestID(quest, tier),
    tier,
    title: `${quest.title} · Palier ${tier}`,
    target: Math.max(1, Math.ceil(quest.target * (1 + (tier - 1) * 0.75))),
    reward: Object.fromEntries(Object.entries(quest.reward).map(([key, value]) =>
        [key, typeof value === "number" ? Math.ceil(value * (1 + (tier - 1) * 0.35)) : value]))
});

const getUserQuestState = async (discordID) => {
    await apiDB.prepareQuestUser(discordID);
    await normalizeLevel(discordID);
    const stats = await apiDB.getQuestUserStats(discordID);
    const progressRows = await apiDB.getDailyQuestProgressRows(discordID, getQuestDate());
    const progressByID = new Map(progressRows.map(row => [row.questID, row]));

    return {
        stats,
        questDate: getQuestDate(),
        quests: DAILY_QUESTS.map(quest => {
            let tier = 1;
            while(progressByID.get(getTierQuestID(quest, tier))?.claimed) tier += 1;
            const tierQuest = buildTierQuest(quest, tier);
            const row = progressByID.get(tierQuest.id);
            const progress = Math.min(Number(row?.progress) || 0, tierQuest.target);
            return {
                ...tierQuest,
                progress,
                completed: Boolean(row?.completed) || progress >= tierQuest.target,
                claimed: Boolean(row?.claimed)
            };
        })
    };
};

const trackMessage = async (message) => {
    if(!message.guildId || message.author?.bot) return null;
    return apiDB.withGuild(message.guildId, async () => {
        await apiDB.ensureDatabaseSchema();
        await apiDB.prepareUser(message.author.id, message.author.username);
        await apiDB.prepareQuestUser(message.author.id);
        const stats = await apiDB.getQuestUserStats(message.author.id);
        const now = Date.now();

        if(now - Number(stats.lastQuestMessageStamp || 0) < MESSAGE_QUEST_COOLDOWN_MS){
            return null;
        }

        await apiDB.incrementQuestMessages(message.author.id, now);
        if(now - Number(stats.lastMessageXpStamp || 0) >= MESSAGE_XP_COOLDOWN_MS){
            await apiDB.addQuestXP(message.author.id, 8);
            await apiDB.updateQuestUserStats(message.author.id, { lastMessageXpStamp: now });
            await normalizeLevel(message.author.id);
        }

        return trackEvent(message.author.id, "message_sent", 1);
    });
};

const trackEvent = async (discordID, eventName, amount = 1) => {
    await apiDB.ensureDatabaseSchema();
    await apiDB.prepareQuestUser(discordID);
    const questDate = getQuestDate();
    const updated = [];

    const state = await getUserQuestState(discordID);
    for(const quest of state.quests.filter(quest => quest.event == eventName)){
        const existing = await apiDB.getDailyQuestProgress(discordID, questDate, quest.id);
        if(existing?.claimed) continue;

        const currentProgress = Number(existing?.progress) || 0;
        const nextProgress = Math.min(quest.target, currentProgress + Math.max(1, Number(amount) || 1));
        const completed = nextProgress >= quest.target;
        await apiDB.upsertDailyQuestProgress(discordID, questDate, quest.id, nextProgress, completed, existing?.claimed || 0);
        updated.push({ quest, progress: nextProgress, completed });
    }

    return updated;
};

const claimCompletedQuests = async (discordID) => {
    const state = await getUserQuestState(discordID);
    const claimableQuests = state.quests.filter(quest => quest.completed && !quest.claimed);
    const rewards = createEmptyRewardSummary();

    for(const quest of claimableQuests){
        await applyReward(discordID, quest.reward, rewards);
        await apiDB.markDailyQuestClaimed(discordID, state.questDate, quest.id);
    }

    const levelResult = await normalizeLevel(discordID);
    return {
        claimedQuests: claimableQuests,
        rewards,
        levelResult
    };
};

const spinWheel = async (discordID) => {
    const consumed = await apiDB.consumeWheelTicket(discordID);
    if(!consumed){
        return { ok: false };
    }

    const wheelReward = chooseWeightedReward(WHEEL_REWARDS);
    const rewards = createEmptyRewardSummary();
    await applyReward(discordID, wheelReward.reward, rewards);
    const levelResult = await normalizeLevel(discordID);
    return {
        ok: true,
        label: wheelReward.label,
        rewards,
        levelResult
    };
};

const applyReward = async (discordID, reward, summary = createEmptyRewardSummary()) => {
    if(reward.money){
        await apiDB.addMoneyToUser(discordID, reward.money);
        summary.money += reward.money;
    }
    if(reward.cardPoints){
        await apiDB.addPointsToUser(discordID, reward.cardPoints);
        summary.cardPoints += reward.cardPoints;
    }
    if(reward.wheelTickets){
        await apiDB.addWheelTickets(discordID, reward.wheelTickets);
        summary.wheelTickets += reward.wheelTickets;
    }
    if(reward.xp){
        await apiDB.addQuestXP(discordID, reward.xp);
        summary.xp += reward.xp;
    }
    if(reward.pickBoost){
        const stats = await apiDB.getQuestUserStats(discordID);
        const until = Math.max(Date.now(), Number(stats.pickBoostUntil) || 0) + reward.pickBoost.durationMs;
        await apiDB.setPickBoost(discordID, reward.pickBoost.multiplier, until);
        summary.pickBoost = reward.pickBoost;
        summary.pickBoostUntil = until;
    }
    return summary;
};

const normalizeLevel = async (discordID) => {
    const stats = await apiDB.getQuestUserStats(discordID);
    let xp = Number(stats.xp) || 0;
    let level = Number(stats.level) || 1;
    let gainedLevels = 0;

    while(xp >= getXPForNextLevel(level)){
        xp -= getXPForNextLevel(level);
        level += 1;
        gainedLevels += 1;
    }

    if(gainedLevels > 0){
        await apiDB.updateQuestUserStats(discordID, { xp, level });
    }

    return { level, xp, gainedLevels, nextLevelXP: getXPForNextLevel(level) };
};

const getPickCooldownMultiplier = async (discordID) => {
    return await apiDB.getActivePickBoostMultiplier(discordID);
};

const createQuestEmbed = async (user) => {
    const state = await getUserQuestState(user.id);
    const levelResult = await normalizeLevel(user.id);
    const claimableCount = state.quests.filter(quest => quest.completed && !quest.claimed).length;
    const activeBoost = Number(state.stats.pickBoostUntil) > Date.now()
        ? `\nBoost /pick : x${Number(state.stats.pickBoostMultiplier).toFixed(2)} jusqu'à <t:${Math.floor(Number(state.stats.pickBoostUntil) / 1000)}:R>`
        : "";

    return new EmbedBuilder()
        .setColor(0xD72306)
        .setTitle("Quêtes NewGenCard")
        .setDescription(
            `Niveau quête : **${levelResult.level}** (${levelResult.xp}/${levelResult.nextLevelXP} XP)\n` +
            `Tickets roue : **${state.stats.wheelTickets || 0}**\n` +
            `Quêtes à réclamer : **${claimableCount}**${activeBoost}`
        )
        .addFields(state.quests.map(quest => ({
            name: `${quest.completed ? "✅" : "⌛"} ${quest.title}`,
            value: `${quest.description}\nProgression : **${quest.progress}/${quest.target}**${quest.claimed ? "\nRécompense déjà réclamée." : ""}`,
            inline: false
        })))
        .setFooter({ text: "Utilisez le bouton Réclamer pour récupérer les récompenses prêtes." });
};

const createClaimEmbed = (claimResult) => {
    if(!claimResult.claimedQuests.length){
        return new EmbedBuilder()
            .setColor(0xD72306)
            .setTitle("Aucune récompense prête")
            .setDescription("Continue les quêtes du jour, puis reviens réclamer.");
    }

    return new EmbedBuilder()
        .setColor(0x22A559)
        .setTitle(`${claimResult.claimedQuests.length} quête(s) réclamée(s)`)
        .setDescription(formatRewardSummary(claimResult.rewards, claimResult.levelResult));
};

const QUESTS_PER_PAGE = 4;
const getQuestReply = async (user, page = 1, expiresAt = Date.now() + 120000) => {
    const state = await getUserQuestState(user.id);
    const level = await normalizeLevel(user.id);
    const totalPages = Math.max(1, Math.ceil(state.quests.length / QUESTS_PER_PAGE));
    const currentPage = Math.min(Math.max(Number(page) || 1, 1), totalPages);
    const shown = state.quests.slice((currentPage - 1) * QUESTS_PER_PAGE, currentPage * QUESTS_PER_PAGE);
    const claimable = state.quests.filter(quest => quest.completed && !quest.claimed).length;
    const container = new ContainerBuilder().setAccentColor(0xD72306)
        .addTextDisplayComponents(text => text.setContent(
            `## 📜 Quêtes NewGenCard\n**Niveau ${level.level}** · ${level.xp}/${level.nextLevelXP} XP · 🎟️ ${state.stats.wheelTickets || 0}\n-# Chaque récompense réclamée débloque un palier plus difficile.`
        )).addSeparatorComponents(new SeparatorBuilder());
    for(const quest of shown){
        const percent = Math.min(10, Math.floor((quest.progress / quest.target) * 10));
        const bar = `${"▰".repeat(percent)}${"▱".repeat(10 - percent)}`;
        container.addTextDisplayComponents(text => text.setContent(
            `### ${quest.completed ? "✅" : "⏳"} ${quest.title}\n${quest.description}\n${bar} **${quest.progress}/${quest.target}**\n-# ${formatQuestReward(quest.reward)}`
        ));
    }
    return {
        components: [container.addSeparatorComponents(new SeparatorBuilder()).addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`quests:page:${user.id}:${currentPage - 1}:${expiresAt}`).setEmoji("⬅️").setStyle(ButtonStyle.Secondary).setDisabled(currentPage <= 1),
                new ButtonBuilder().setCustomId(`quests:claim:${user.id}:${currentPage}:${expiresAt}`).setEmoji("🎁").setLabel(`Réclamer${claimable ? ` (${claimable})` : ""}`).setStyle(ButtonStyle.Success).setDisabled(!claimable),
                new ButtonBuilder().setCustomId(`quests:page:${user.id}:${currentPage + 1}:${expiresAt}`).setEmoji("➡️").setStyle(ButtonStyle.Secondary).setDisabled(currentPage >= totalPages)
            ))],
        flags: MessageFlags.IsComponentsV2
    };
};

const handleQuestButton = async (client, interaction) => {
    const parts = interaction.customId.split(":");
    if(parts.length !== 5 || parts[0] !== "quests") return false;
    const [, action, userID, rawPage, rawExpires] = parts, page = Number(rawPage), expiresAt = Number(rawExpires);
    if(interaction.user.id !== userID){ await interaction.reply({ content: "Ce panneau de quêtes ne t’appartient pas.", flags: MessageFlags.Ephemeral }); return true; }
    if(Date.now() > expiresAt){
        const componentLifecycle = require("./componentLifecycle");
        await componentLifecycle.expireInteractedMessage(interaction, "quetes", interaction.commandId); return true;
    }
    if(action === "claim") await claimCompletedQuests(userID);
    const newExpiresAt = Date.now() + 120000;
    await interaction.update(await getQuestReply(interaction.user, page, newExpiresAt));
    require("./componentLifecycle").scheduleInteractionExpiration(interaction, "quetes", newExpiresAt);
    return true;
};

const formatQuestReward = reward => [
    reward.money && `${reward.money}$`, reward.cardPoints && `${reward.cardPoints} points`, reward.xp && `${reward.xp} XP`,
    reward.wheelTickets && `${reward.wheelTickets} ticket(s)`, reward.pickBoost && "Boost /pick"
].filter(Boolean).join(" · ");

const createWheelEmbed = (result) => {
    if(!result.ok){
        return new EmbedBuilder()
            .setColor(0xD72306)
            .setTitle("Roue fortune")
            .setDescription("Tu n'as pas de ticket de roue. Termine des quêtes pour en gagner.");
    }

    return new EmbedBuilder()
        .setColor(0xF4C542)
        .setTitle("Roue fortune")
        .setDescription(`Résultat : **${result.label}**\n\n${formatRewardSummary(result.rewards, result.levelResult)}`);
};

const formatRewardSummary = (rewards, levelResult) => {
    const lines = [];
    if(rewards.money) lines.push(`Argent : **+${rewards.money}$**`);
    if(rewards.cardPoints) lines.push(`Points de carte : **+${rewards.cardPoints}**`);
    if(rewards.wheelTickets) lines.push(`Tickets roue : **+${rewards.wheelTickets}**`);
    if(rewards.xp) lines.push(`XP : **+${rewards.xp}**`);
    if(rewards.pickBoost) lines.push(`Boost /pick : **x${rewards.pickBoost.multiplier}** jusqu'à <t:${Math.floor(rewards.pickBoostUntil / 1000)}:R>`);
    if(levelResult?.gainedLevels) lines.push(`Niveau quête : **+${levelResult.gainedLevels}**`);
    return lines.length ? lines.join("\n") : "Aucune récompense.";
};

const createEmptyRewardSummary = () => ({
    money: 0,
    cardPoints: 0,
    wheelTickets: 0,
    xp: 0,
    pickBoost: null,
    pickBoostUntil: 0
});

const chooseWeightedReward = (rewards) => {
    const totalWeight = rewards.reduce((total, reward) => total + reward.weight, 0);
    let roll = Math.random() * totalWeight;
    for(const reward of rewards){
        roll -= reward.weight;
        if(roll <= 0) return reward;
    }
    return rewards[rewards.length - 1];
};

module.exports = {
    getDailyQuests,
    getUserQuestState,
    trackMessage,
    trackEvent,
    claimCompletedQuests,
    spinWheel,
    createQuestEmbed,
    createClaimEmbed,
    createWheelEmbed,
    getPickCooldownMultiplier,
    getQuestReply,
    handleQuestButton
};
