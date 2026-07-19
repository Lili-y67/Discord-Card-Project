const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    MessageFlags,
    ModalBuilder,
    SeparatorBuilder,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

const apiDB = require("../functions/apiDB");
const componentLifecycle = require("../functions/componentLifecycle");
const constants = require("../data/constants.js");
const mentionSafety = require("../functions/mentionSafety");

const OWNER_ID = '1147963951989149796';
const ACCENT_COLOR = 0xD72306;
const CARD_MONEY_MULTIPLIER_SETTING = "cardMoneyMultiplier";
const DAILY_MONEY_MULTIPLIER_SETTING = "dailyMoneyMultiplier";
const PICK_BASE_TIMER_SETTING = "pickBaseTimerMs";

const PICK_TIMER_CHOICES = [
    { name: "15 minutes", value: 15 * 60 * 1000 },
    { name: "30 minutes", value: 30 * 60 * 1000 },
    { name: "45 minutes", value: 45 * 60 * 1000 },
    { name: "1 heure", value: 60 * 60 * 1000 },
    { name: "1 heure 30", value: 90 * 60 * 1000 },
    { name: "2 heures", value: 2 * 60 * 60 * 1000 },
    { name: "3 heures", value: 3 * 60 * 60 * 1000 },
    { name: "4 heures", value: 4 * 60 * 60 * 1000 },
    { name: "5 heures", value: 5 * 60 * 60 * 1000 },
    { name: "6 heures", value: 6 * 60 * 60 * 1000 }
];

const MULTIPLIER_CHOICES = [
    { name: "x0.25", value: "0.25" },
    { name: "x0.5", value: "0.5" },
    { name: "x0.75", value: "0.75" },
    { name: "x1", value: "1" },
    { name: "x1.25", value: "1.25" },
    { name: "x1.5", value: "1.5" },
    { name: "x2", value: "2" },
    { name: "x3", value: "3" },
    { name: "x5", value: "5" },
    { name: "x10", value: "10" }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("config")
        .setDescription("Ouvre le panneau de configuration admin")
        .setDMPermission(false),

    async execute(interaction) {
        if(!(await canOpenConfig(interaction))) return;

        const expiresAt = componentLifecycle.createExpiresAt();
        const reply = await apiDB.withGuild(getConfigGuildID(interaction), async () => {
            return await getConfigReply(interaction.client, interaction.user.id, expiresAt);
        });
        await interaction.reply(reply);
        componentLifecycle.scheduleInteractionExpiration(interaction, "config", expiresAt);
    },

    handleConfigButton,
    handleConfigSelect,
    handleConfigModal
};

async function getConfigReply(client, userID, expiresAt) {
    return {
        components: [await getConfigContainer(client, userID, expiresAt)],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: mentionSafety.SAFE_ALLOWED_MENTIONS
    };
}

async function getConfigContainer(client, userID, expiresAt) {
    const settings = await getCurrentSettings(client);
    const probabilities = await apiDB.getRarityProbabilityRows();
    return new ContainerBuilder()
        .setAccentColor(ACCENT_COLOR)
        .addTextDisplayComponents(text =>
            text.setContent("Configuration NewGenCard")
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(text =>
            text.setContent([
                `Timer de base /pick : ${formatDuration(settings.pickBaseTimerMs)}`,
                `Gains cartes : ${formatMultiplier(settings.cardMoneyMultiplier)}`,
                `Gains daily : ${formatMultiplier(settings.dailyMoneyMultiplier)}`
            ].join("\n"))
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(text =>
            text.setContent("Réglages rapides")
        )
        .addActionRowComponents(getPickTimerSelectRow(userID, expiresAt, settings.pickBaseTimerMs))
        .addActionRowComponents(getMultiplierSelectRow("cards", userID, expiresAt, settings.cardMoneyMultiplier))
        .addActionRowComponents(getMultiplierSelectRow("daily", userID, expiresAt, settings.dailyMoneyMultiplier))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(text =>
            text.setContent(`Probabilités : ${formatProbabilitySummary(probabilities)}`)
        )
        .addActionRowComponents(getProbabilitySelectRow(userID, expiresAt, probabilities))
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(getActionRow(userID, expiresAt));
}

async function getCurrentSettings(client) {
    const defaultPickBaseTimer = constants.RANKIDTORANKQUICKPICKTIMEDICO[1] * client.quickPickTimeMultiplicator;
    return {
        pickBaseTimerMs: await apiDB.getPersistentSetting(PICK_BASE_TIMER_SETTING, defaultPickBaseTimer),
        cardMoneyMultiplier: await apiDB.getPersistentSetting(CARD_MONEY_MULTIPLIER_SETTING, 1),
        dailyMoneyMultiplier: await apiDB.getPersistentSetting(DAILY_MONEY_MULTIPLIER_SETTING, 1)
    };
}

function getPickTimerSelectRow(userID, expiresAt, currentTimer) {
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(getConfigCustomID("timer", userID, expiresAt))
        .setPlaceholder("Timer de base du /pick")
        .addOptions(PICK_TIMER_CHOICES.map(choice =>
            new StringSelectMenuOptionBuilder()
                .setLabel(choice.name)
                .setDescription(`Base avant réductions de rang et boosts`)
                .setValue(choice.value.toString())
                .setDefault(Number(currentTimer) == choice.value)
        ));

    return new ActionRowBuilder().addComponents(selectMenu);
}

function getMultiplierSelectRow(type, userID, expiresAt, currentMultiplier) {
    const isCards = type == "cards";
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(getConfigCustomID(type, userID, expiresAt))
        .setPlaceholder(isCards ? "Multiplicateur gains cartes" : "Multiplicateur gains daily")
        .addOptions(MULTIPLIER_CHOICES.map(choice =>
            new StringSelectMenuOptionBuilder()
                .setLabel(choice.name)
                .setDescription(isCards ? "Argent gagné par les cartes" : "Argent gagné par le daily")
                .setValue(choice.value)
                .setDefault(Number(currentMultiplier) == Number(choice.value))
        ));

    return new ActionRowBuilder().addComponents(selectMenu);
}

function getProbabilitySelectRow(userID, expiresAt, probabilities) {
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(getConfigCustomID("probability", userID, expiresAt))
        .setPlaceholder("Changer la probabilité d'une rareté")
        .addOptions(constants.RARITIES.map(rarity => {
            const probability = probabilities.find(row => row.name == rarity.name)?.probability || 0;
            return new StringSelectMenuOptionBuilder()
                .setLabel(rarity.name)
                .setDescription(`${formatPercent(probability)} actuellement`)
                .setValue(rarity.name);
        }));

    return new ActionRowBuilder().addComponents(selectMenu);
}

function getActionRow(userID, expiresAt) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(getConfigCustomID("refresh", userID, expiresAt))
                .setStyle(ButtonStyle.Secondary)
                .setEmoji("🔄")
                .setLabel("Actualiser")
        );
}

async function handleConfigButton(client, interaction) {
    const parsedInteraction = parseConfigCustomID(interaction.customId);
    if(!parsedInteraction) return false;

    if(!(await canUseConfigInteraction(interaction, parsedInteraction))) return true;

    const components = await apiDB.withGuild(getConfigGuildID(interaction), async () => {
        return [await getConfigContainer(client, parsedInteraction.userID, parsedInteraction.expiresAt)];
    });
    await interaction.update(mentionSafety.withSafeMentions({ components }));
    return true;
}

async function handleConfigSelect(client, interaction) {
    const parsedInteraction = parseConfigCustomID(interaction.customId);
    if(!parsedInteraction) return false;

    if(!(await canUseConfigInteraction(interaction, parsedInteraction))) return true;

    if(parsedInteraction.action == "probability"){
        const rarityName = interaction.values[0];
        const probabilities = await apiDB.withGuild(getConfigGuildID(interaction), async () => {
            return await apiDB.getRarityProbabilityRows();
        });
        const probability = probabilities.find(row => row.name == rarityName)?.probability || 0;
        await interaction.showModal(getProbabilityModal(parsedInteraction.userID, rarityName, parsedInteraction.expiresAt, probability));
        return true;
    }

    const components = await apiDB.withGuild(getConfigGuildID(interaction), async () => {
        if(parsedInteraction.action == "timer"){
            const timerMs = Number(interaction.values[0]);
            await apiDB.setPersistentSetting(PICK_BASE_TIMER_SETTING, timerMs);
            interaction.client.quickPickTimeMultiplicator = timerMs / constants.RANKIDTORANKQUICKPICKTIMEDICO[1];
        }

        if(parsedInteraction.action == "cards"){
            await apiDB.setPersistentSetting(CARD_MONEY_MULTIPLIER_SETTING, Number(interaction.values[0]));
        }

        if(parsedInteraction.action == "daily"){
            await apiDB.setPersistentSetting(DAILY_MONEY_MULTIPLIER_SETTING, Number(interaction.values[0]));
        }

        return [await getConfigContainer(client, parsedInteraction.userID, parsedInteraction.expiresAt)];
    });

    await interaction.update(mentionSafety.withSafeMentions({ components }));
    return true;
}

async function handleConfigModal(client, interaction) {
    const parsedInteraction = parseConfigCustomID(interaction.customId);
    if(!parsedInteraction || parsedInteraction.action != "probabilitysubmit") return false;

    if(!(await canUseConfigInteraction(interaction, parsedInteraction))) return true;

    const rawValue = interaction.fields.getTextInputValue("probability").replace(",", ".");
    const result = await apiDB.withGuild(getConfigGuildID(interaction), async () => {
        return await apiDB.setRarityProbability(parsedInteraction.rarityName, Number(rawValue));
    });

    if(!result.ok){
        await interaction.reply({
            content: result.error,
            flags: MessageFlags.Ephemeral,
            allowedMentions: mentionSafety.SAFE_ALLOWED_MENTIONS
        });
        return true;
    }

    const components = await apiDB.withGuild(getConfigGuildID(interaction), async () => {
        return [await getConfigContainer(client, parsedInteraction.userID, parsedInteraction.expiresAt)];
    });

    await interaction.update(mentionSafety.withSafeMentions({ components }));
    return true;
}

async function canOpenConfig(interaction) {
    if(interaction.user.id == OWNER_ID) return true;

    await interaction.reply({
        content: "Cette commande est réservée au propriétaire du bot.",
        flags: MessageFlags.Ephemeral,
        allowedMentions: mentionSafety.SAFE_ALLOWED_MENTIONS
    });
    return false;
}

async function canUseConfigInteraction(interaction, parsedInteraction) {
    if(componentLifecycle.isExpired(parsedInteraction.expiresAt)){
        await componentLifecycle.expireInteractedMessage(interaction, "config", interaction.commandId);
        return false;
    }

    if(interaction.user.id == OWNER_ID && interaction.user.id == parsedInteraction.userID) return true;

    await interaction.reply({
        content: "Ce panneau de configuration ne t'appartient pas.",
        flags: MessageFlags.Ephemeral,
        allowedMentions: mentionSafety.SAFE_ALLOWED_MENTIONS
    });
    return false;
}

function parseConfigCustomID(customID) {
    const parts = customID.split(":");
    if(parts[0] != "config" || ![4, 5].includes(parts.length)) return null;

    const expiresAt = Number(parts[parts.length - 1]);
    if(!Number.isInteger(expiresAt)) return null;

    return {
        action: parts[1],
        userID: parts[2],
        rarityName: parts.length == 5 ? parts[3] : null,
        expiresAt
    };
}

function getConfigCustomID(action, userID, expiresAt, rarityName = null) {
    return rarityName
        ? `config:${action}:${userID}:${rarityName}:${expiresAt}`
        : `config:${action}:${userID}:${expiresAt}`;
}

function getConfigGuildID(interaction) {
    return interaction.client.mainGuildID || interaction.guildId;
}

function getProbabilityModal(userID, rarityName, expiresAt, currentProbability) {
    return new ModalBuilder()
        .setCustomId(getConfigCustomID("probabilitysubmit", userID, expiresAt, rarityName))
        .setTitle(`Probabilité ${rarityName}`)
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("probability")
                    .setLabel("Nouvelle probabilité en %")
                    .setPlaceholder("Exemple : 0.001, 2.5, 15")
                    .setValue(formatPercent(currentProbability))
                    .setRequired(true)
                    .setStyle(TextInputStyle.Short)
            )
        );
}

function formatDuration(milliseconds) {
    const minutes = Math.round(Number(milliseconds) / 60000);
    if(minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes ? `${hours} h ${remainingMinutes} min` : `${hours} h`;
}

function formatMultiplier(value) {
    return `x${Number(value || 1).toFixed(2).replace(/\.?0+$/, "")}`;
}

function formatPercent(value) {
    return Number(value || 0).toFixed(4).replace(/\.?0+$/, "");
}

function formatProbabilitySummary(probabilities) {
    return probabilities
        .map(row => `${row.shortName} ${formatPercent(row.probability)}%`)
        .join(" / ");
}
