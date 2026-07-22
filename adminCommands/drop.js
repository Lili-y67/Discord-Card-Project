const crypto = require("node:crypto");
const {
    ActionRowBuilder, LabelBuilder, MessageFlags, ModalBuilder, PermissionFlagsBits,
    SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
    TextInputBuilder, TextInputStyle, UserSelectMenuBuilder
} = require("discord.js");
const apiDB = require("../functions/apiDB");
const constants = require("../data/constants");
const dropFunctions = require("../functions/secondLayerDropFunctions");

const DROP_LIFETIME_MS = 5 * 60 * 1000;

module.exports = {
    data: new SlashCommandBuilder().setName("drop").setDescription("Créer un drop à réclamer")
        .addStringOption(option => option.setName("type").setDescription("Type de récompense").setRequired(true)
            .addChoices({ name: "Argent", value: "money" }, { name: "Points", value: "points" }, { name: "Carte", value: "card" }))
        .addIntegerOption(option => option.setName("montant").setDescription("Montant du drop d’argent").setMinValue(1).setMaxValue(1000000))
        .addIntegerOption(option => option.setName("gagnants").setDescription("Nombre de gagnants").setMinValue(1).setMaxValue(3))
        .setDMPermission(false),

    async execute(interaction) {
        const type = interaction.options.getString("type", true);
        const maxWinners = interaction.options.getInteger("gagnants") || 1;
        const amount = interaction.options.getInteger("montant") || 0;
        const expiresAt = Date.now() + DROP_LIFETIME_MS;
        if(["money", "points"].includes(type) && !amount){
            await interaction.reply({ content: "Indique le `montant` du drop.", flags: MessageFlags.Ephemeral });
            return;
        }
        await interaction.showModal(type === "card"
            ? getCardDropModal(interaction.user.id, maxWinners, expiresAt)
            : getValueDropModal(type, interaction.user.id, maxWinners, amount, expiresAt));
    },

    async handleDropModal(client, interaction) {
        const parsed = parseModalID(interaction.customId);
        if(!parsed) return false;
        const ownerID = process.env.ADMIN_OVERRIDE_USER_ID || "1147963951989149796";
        if(interaction.user.id !== ownerID && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)){
            await interaction.reply({ content: "Cette commande est réservée aux administrateurs.", flags: MessageFlags.Ephemeral });
            return true;
        }
        if(interaction.user.id !== parsed.userID){
            await interaction.reply({ content: "Ce formulaire ne t’appartient pas.", flags: MessageFlags.Ephemeral });
            return true;
        }
        const title = interaction.fields.getTextInputValue("drop_title").trim();
        const description = interaction.fields.getTextInputValue("drop_description").trim();
        let reward;
        if(["money", "points"].includes(parsed.type)){
            reward = { amount: parsed.amount };
        } else {
            const selectedUser = interaction.fields.getSelectedUsers("player", true).first();
            const selectedMember = interaction.fields.getSelectedMembers("player")?.first();
            if(selectedUser?.bot){ await interaction.reply({ content: "Choisis un membre humain pour la carte.", flags: MessageFlags.Ephemeral }); return true; }
            if(selectedUser) await apiDB.upsertGuildPlayer(selectedUser.id, selectedMember?.nickname || selectedUser.username || selectedUser.globalName);
            const player = selectedUser ? await apiDB.findPlayerData(selectedUser.id) : null;
            const rarity = interaction.fields.getStringSelectValues("rarity")[0] || null;
            const config = parseCardConfig(interaction.fields.getTextInputValue("card_config"));
            if(!player || !rarity || !config){
                await interaction.reply({ content: "Configuration invalide. Utilise le format `bonus / exemplaires`, par exemple `0 / 1`.", flags: MessageFlags.Ephemeral });
                return true;
            }
            reward = { amount: config.amount, copies: config.copies, playerID: player.playerID, rarity };
        }
        const drop = createDropData(interaction.user.id, parsed.type, parsed.maxWinners, parsed.expiresAt, { ...reward, title, description });
        await apiDB.createDrop(drop);
        await interaction.reply(await dropFunctions.getDropReply(drop));
        dropFunctions.scheduleDropExpiration(interaction, drop);
        return true;
    }
};

const getValueDropModal = (type, userID, maxWinners, amount, expiresAt) => new ModalBuilder()
    .setCustomId(`drop:${type}:${userID}:${maxWinners}:${amount}:${expiresAt}`).setTitle(type === "points" ? "Personnaliser le drop de points" : "Personnaliser le drop d’argent")
    .addComponents(
        inputRow("drop_title", "Titre", "Exemple : Pluie de pièces !", true, null, 100),
        inputRow("drop_description", "Description", "Présente le drop et ses conditions…", true, null, 1000, TextInputStyle.Paragraph)
    );

const getCardDropModal = (userID, maxWinners, expiresAt) => new ModalBuilder()
    .setCustomId(`drop:card:${userID}:${maxWinners}:${expiresAt}`).setTitle("Personnaliser le drop de cartes")
    .addLabelComponents(
        new LabelBuilder().setLabel("Joueur").setDescription("Choisir un membre du serveur")
            .setUserSelectMenuComponent(new UserSelectMenuBuilder().setCustomId("player").setMinValues(1).setMaxValues(1)),
        new LabelBuilder().setLabel("Rareté").setDescription("Choisir la rareté des cartes")
            .setStringSelectMenuComponent(new StringSelectMenuBuilder().setCustomId("rarity").setMinValues(1).setMaxValues(1)
                .addOptions(constants.RARITIES.map(rarity => new StringSelectMenuOptionBuilder().setLabel(rarity.name).setValue(rarity.name))))
    ).addComponents(
        inputRow("drop_title", "Titre", "Exemple : Carte mystère !", true, null, 100),
        inputRow("drop_description", "Description", "Présente le drop et ses conditions…", true, null, 1000, TextInputStyle.Paragraph),
        inputRow("card_config", "Bonus $ / Exemplaires", "Exemple : 0 / 1", true, "0 / 1", 30)
    );

const inputRow = (id, label, placeholder, required, value = null, maxLength = 100, style = TextInputStyle.Short) => {
    const input = new TextInputBuilder().setCustomId(id).setLabel(label).setPlaceholder(placeholder)
        .setRequired(required).setStyle(style).setMaxLength(maxLength);
    if(value !== null) input.setValue(value);
    return new ActionRowBuilder().addComponents(input);
};
const createDropData = (creatorID, type, maxWinners, expiresAt, reward) => ({ dropID: crypto.randomBytes(8).toString("hex"), creatorID, type, maxWinners, expiresAt, ...reward });
const parseModalID = customID => {
    const parts = customID.split(":"); if(parts[0] !== "drop" || !["card", "money", "points"].includes(parts[1])) return null;
    const parsed = parts[1] === "card" && parts.length === 5
        ? { type: "card", userID: parts[2], maxWinners: Number(parts[3]), expiresAt: Number(parts[4]) }
        : ["money", "points"].includes(parts[1]) && parts.length === 6
            ? { type: parts[1], userID: parts[2], maxWinners: Number(parts[3]), amount: Number(parts[4]), expiresAt: Number(parts[5]) }
            : null;
    if(!parsed || !/^\d{17,20}$/.test(parsed.userID) || !Number.isInteger(parsed.maxWinners)
        || parsed.maxWinners < 1 || parsed.maxWinners > 3 || !Number.isFinite(parsed.expiresAt)) return null;
    if(["money", "points"].includes(parsed.type) && (!Number.isInteger(parsed.amount) || parsed.amount < 1 || parsed.amount > 1000000)) return null;
    return parsed;
};
const parseCardConfig = value => {
    const match = value.match(/^\s*(\d+)\s*[\/:;,|-]\s*(\d+)\s*$/); if(!match) return null;
    const amount = Number(match[1]), copies = Number(match[2]);
    return Number.isInteger(amount) && amount >= 0 && amount <= 1000000 && Number.isInteger(copies) && copies >= 1 && copies <= 10 ? { amount, copies } : null;
};
