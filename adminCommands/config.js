const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelSelectMenuBuilder,
    ChannelType,
    ContainerBuilder,
    MessageFlags,
    ModalBuilder,
    PermissionFlagsBits,
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

const OWNER_ID = process.env.ADMIN_OVERRIDE_USER_ID || '1147963951989149796';
const ACCENT_COLOR = 0xD72306;
const CARD_MONEY_MULTIPLIER_SETTING = "cardMoneyMultiplier";
const DAILY_MONEY_MULTIPLIER_SETTING = "dailyMoneyMultiplier";
const CARD_MONEY_MULTIPLIER_UNTIL_SETTING = "cardMoneyMultiplierUntil";
const DAILY_MONEY_MULTIPLIER_UNTIL_SETTING = "dailyMoneyMultiplierUntil";
const CARD_MONEY_MULTIPLIER_DURATION_SETTING = "cardMoneyMultiplierDurationMs";
const DAILY_MONEY_MULTIPLIER_DURATION_SETTING = "dailyMoneyMultiplierDurationMs";
const PICK_BASE_TIMER_SETTING = "pickBaseTimerMs";
const IMAGES_STORAGE_GUILD_SETTING = "imagesStorageGuildID";
const IMAGES_STORAGE_CHANNEL_SETTING = "imagesStorageChannelID";

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

const BOOST_DURATION_CHOICES = [
    { name: "1 heure", value: 60 * 60 * 1000 },
    { name: "3 heures", value: 3 * 60 * 60 * 1000 },
    { name: "6 heures", value: 6 * 60 * 60 * 1000 },
    { name: "12 heures", value: 12 * 60 * 60 * 1000 },
    { name: "24 heures", value: 24 * 60 * 60 * 1000 },
    { name: "Custom", value: "custom" }
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
    handleConfigChannelSelect,
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
                `Boost cartes : ${formatMultiplier(settings.cardMoneyMultiplier)} ${formatBoostUntil(settings.cardMoneyMultiplierUntil, settings.cardMoneyMultiplier)}`,
                `Boost daily : ${formatMultiplier(settings.dailyMoneyMultiplier)} ${formatBoostUntil(settings.dailyMoneyMultiplierUntil, settings.dailyMoneyMultiplier)}`,
                `Storage images : ${settings.imagesStorageChannelID ? `<#${settings.imagesStorageChannelID}>` : "non configuré"}`
            ].join("\n"))
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(text => text.setContent("Cooldown"))
        .addActionRowComponents(getPickTimerSelectRow(userID, expiresAt, settings.pickBaseTimerMs))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(text => text.setContent("Boost gains cartes"))
        .addActionRowComponents(getMultiplierSelectRow("cards", userID, expiresAt, settings.cardMoneyMultiplier))
        .addActionRowComponents(getBoostDurationSelectRow("cardsduration", userID, expiresAt, settings.cardMoneyMultiplierDurationMs))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(text => text.setContent("Boost gains daily"))
        .addActionRowComponents(getMultiplierSelectRow("daily", userID, expiresAt, settings.dailyMoneyMultiplier))
        .addActionRowComponents(getBoostDurationSelectRow("dailyduration", userID, expiresAt, settings.dailyMoneyMultiplierDurationMs))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(text => text.setContent("Stockage des images"))
        .addActionRowComponents(getStorageChannelSelectRow(userID, expiresAt))
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
        dailyMoneyMultiplier: await apiDB.getPersistentSetting(DAILY_MONEY_MULTIPLIER_SETTING, 1),
        cardMoneyMultiplierUntil: await apiDB.getPersistentSetting(CARD_MONEY_MULTIPLIER_UNTIL_SETTING, 0),
        dailyMoneyMultiplierUntil: await apiDB.getPersistentSetting(DAILY_MONEY_MULTIPLIER_UNTIL_SETTING, 0),
        cardMoneyMultiplierDurationMs: await apiDB.getPersistentSetting(CARD_MONEY_MULTIPLIER_DURATION_SETTING, 24 * 60 * 60 * 1000),
        dailyMoneyMultiplierDurationMs: await apiDB.getPersistentSetting(DAILY_MONEY_MULTIPLIER_DURATION_SETTING, 24 * 60 * 60 * 1000),
        imagesStorageGuildID: await apiDB.getPersistentTextSetting(IMAGES_STORAGE_GUILD_SETTING, client.imagesStorageGuildID || ""),
        imagesStorageChannelID: await apiDB.getPersistentTextSetting(IMAGES_STORAGE_CHANNEL_SETTING, client.imagesStorageChannelID || "")
    };
}

function getPickTimerSelectRow(userID, expiresAt, currentTimer) {
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(getConfigCustomID("picktimer", userID, expiresAt))
        .setPlaceholder("Timer de base du /pick")
        .addOptions(PICK_TIMER_CHOICES.map(choice =>
            new StringSelectMenuOptionBuilder()
                .setLabel(choice.name)
                .setDescription("Base avant réductions de rang et boosts")
                .setValue(choice.value.toString())
                .setDefault(Number(currentTimer) == choice.value)
        ));

    return new ActionRowBuilder().addComponents(selectMenu);
}

function getBoostDurationSelectRow(action, userID, expiresAt, currentDuration) {
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(getConfigCustomID(action, userID, expiresAt))
        .setPlaceholder(action == "cardsduration" ? "Durée du boost cartes" : "Durée du boost daily")
        .addOptions(BOOST_DURATION_CHOICES.map(choice =>
            new StringSelectMenuOptionBuilder()
                .setLabel(choice.name)
                .setDescription(choice.value == "custom" ? "Renseigner jours, heures et minutes" : "Activer le boost pendant cette durée")
                .setValue(choice.value.toString())
                .setDefault(Number(currentDuration) == choice.value)
        ));

    return new ActionRowBuilder().addComponents(selectMenu);
}

function getStorageChannelSelectRow(userID, expiresAt) {
    const selectMenu = new ChannelSelectMenuBuilder()
        .setCustomId(getConfigCustomID("storagechannel", userID, expiresAt))
        .setPlaceholder("Choisir le salon de stockage")
        .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);

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
        if(parsedInteraction.action == "picktimer"){
            const timerMs = Number(interaction.values[0]);
            await apiDB.setPersistentSetting(PICK_BASE_TIMER_SETTING, timerMs);
            interaction.client.quickPickTimeMultiplicator = timerMs / constants.RANKIDTORANKQUICKPICKTIMEDICO[1];
        }

        if(parsedInteraction.action == "cards"){
            await saveBoostSettings("cards", Number(interaction.values[0]));
        }

        if(parsedInteraction.action == "daily"){
            await saveBoostSettings("daily", Number(interaction.values[0]));
        }

        if(["cardsduration", "dailyduration"].includes(parsedInteraction.action)){
            if(interaction.values[0] == "custom"){
                await interaction.showModal(getBoostDurationModal(parsedInteraction.userID, parsedInteraction.action, parsedInteraction.expiresAt));
                return null;
            }

            await saveBoostDuration(parsedInteraction.action, Number(interaction.values[0]));
        }

        return [await getConfigContainer(client, parsedInteraction.userID, parsedInteraction.expiresAt)];
    });

    if(!components) return true;

    await interaction.update(mentionSafety.withSafeMentions({ components }));
    return true;
}

async function handleConfigChannelSelect(client, interaction) {
    const parsedInteraction = parseConfigCustomID(interaction.customId);
    if(!parsedInteraction || parsedInteraction.action != "storagechannel") return false;

    if(!(await canUseConfigInteraction(interaction, parsedInteraction))) return true;

    const channelID = interaction.values[0];
    const channel = await interaction.guild.channels.fetch(channelID);
    const components = await apiDB.withGuild(getConfigGuildID(interaction), async () => {
        await apiDB.setPersistentTextSetting(IMAGES_STORAGE_GUILD_SETTING, interaction.guildId);
        await apiDB.setPersistentTextSetting(IMAGES_STORAGE_CHANNEL_SETTING, channelID);
        interaction.client.imagesStorageGuildID = interaction.guildId;
        interaction.client.imagesStorageChannelID = channelID;
        return [await getConfigContainer(client, parsedInteraction.userID, parsedInteraction.expiresAt)];
    });

    await interaction.update(mentionSafety.withSafeMentions({ components }));
    return true;
}

async function handleConfigModal(client, interaction) {
    const parsedInteraction = parseConfigCustomID(interaction.customId);
    if(!parsedInteraction || !["probabilitysubmit", "boostdurationsubmit"].includes(parsedInteraction.action)) return false;

    if(!(await canUseConfigInteraction(interaction, parsedInteraction))) return true;

    if(parsedInteraction.action == "boostdurationsubmit"){
        const durationMs = getModalDurationMs(interaction);
        if(durationMs <= 0){
            await interaction.reply({
                content: "Durée invalide. Renseigne au moins une minute.",
                flags: MessageFlags.Ephemeral,
                allowedMentions: mentionSafety.SAFE_ALLOWED_MENTIONS
            });
            return true;
        }

        const components = await apiDB.withGuild(getConfigGuildID(interaction), async () => {
            await saveBoostDuration(parsedInteraction.rarityName, durationMs);
            return [await getConfigContainer(client, parsedInteraction.userID, parsedInteraction.expiresAt)];
        });

        await interaction.update(mentionSafety.withSafeMentions({ components }));
        return true;
    }

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
    if(interaction.user.id == OWNER_ID || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;

    await interaction.reply({
        content: "Cette commande est réservée aux administrateurs.",
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

    if(interaction.user.id == parsedInteraction.userID && (interaction.user.id == OWNER_ID || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator))) return true;

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
    return interaction.guildId || interaction.client.mainGuildID;
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

function getBoostDurationModal(userID, action, expiresAt) {
    return new ModalBuilder()
        .setCustomId(getConfigCustomID("boostdurationsubmit", userID, expiresAt, action))
        .setTitle(action == "cardsduration" ? "Durée boost cartes" : "Durée boost daily")
        .addComponents(
            getDurationInputRow("days", "Jours", "0"),
            getDurationInputRow("hours", "Heures", "0"),
            getDurationInputRow("minutes", "Minutes", "0")
        );
}

function getDurationInputRow(customID, label, placeholder) {
    return new ActionRowBuilder().addComponents(
        new TextInputBuilder()
            .setCustomId(customID)
            .setLabel(label)
            .setPlaceholder(placeholder)
            .setRequired(false)
            .setStyle(TextInputStyle.Short)
    );
}

function getModalDurationMs(interaction) {
    const days = Number(interaction.fields.getTextInputValue("days") || 0);
    const hours = Number(interaction.fields.getTextInputValue("hours") || 0);
    const minutes = Number(interaction.fields.getTextInputValue("minutes") || 0);
    if([days, hours, minutes].some(value => !Number.isFinite(value) || value < 0)) return 0;
    return Math.trunc(((days * 24 + hours) * 60 + minutes) * 60 * 1000);
}

async function saveBoostSettings(type, multiplier) {
    const settingName = type == "cards" ? CARD_MONEY_MULTIPLIER_SETTING : DAILY_MONEY_MULTIPLIER_SETTING;
    const durationSettingName = type == "cards" ? CARD_MONEY_MULTIPLIER_DURATION_SETTING : DAILY_MONEY_MULTIPLIER_DURATION_SETTING;
    const untilSettingName = type == "cards" ? CARD_MONEY_MULTIPLIER_UNTIL_SETTING : DAILY_MONEY_MULTIPLIER_UNTIL_SETTING;
    const durationMs = Number(await apiDB.getPersistentSetting(durationSettingName, 24 * 60 * 60 * 1000));
    await apiDB.setPersistentSetting(settingName, multiplier);
    await apiDB.setPersistentSetting(untilSettingName, Date.now() + durationMs);
}

async function saveBoostDuration(action, durationMs) {
    const type = action == "cardsduration" ? "cards" : "daily";
    const durationSettingName = type == "cards" ? CARD_MONEY_MULTIPLIER_DURATION_SETTING : DAILY_MONEY_MULTIPLIER_DURATION_SETTING;
    await apiDB.setPersistentSetting(durationSettingName, durationMs);

    const multiplierSettingName = type == "cards" ? CARD_MONEY_MULTIPLIER_SETTING : DAILY_MONEY_MULTIPLIER_SETTING;
    const multiplier = Number(await apiDB.getPersistentSetting(multiplierSettingName, 1));
    await saveBoostSettings(type, multiplier);
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

function formatBoostUntil(until, multiplier = 1) {
    const untilTimestamp = Number(until || 0);
    if(untilTimestamp <= 0) return Number(multiplier) == 1 ? "(inactif)" : "(permanent)";
    if(untilTimestamp <= Date.now()) return "(inactif)";
    return `jusqu'au ${new Date(untilTimestamp).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}`;
}

function formatPercent(value) {
    return Number(value || 0).toFixed(4).replace(/\.?0+$/, "");
}

function formatProbabilitySummary(probabilities) {
    return probabilities
        .map(row => `${row.shortName} ${formatPercent(row.probability)}%`)
        .join(" / ");
}
