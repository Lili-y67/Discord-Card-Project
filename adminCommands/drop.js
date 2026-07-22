const crypto = require("node:crypto");
const {
    ActionRowBuilder,
    MessageFlags,
    ModalBuilder,
    PermissionFlagsBits,
    SlashCommandBuilder,
    TextInputBuilder,
    TextInputStyle
} = require("discord.js");
const apiDB = require("../functions/apiDB");
const constants = require("../data/constants");
const dropFunctions = require("../functions/secondLayerDropFunctions");
const componentLifecycle = require("../functions/componentLifecycle");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("drop")
        .setDescription("Créer un drop à réclamer")
        .addStringOption(option => option.setName("type").setDescription("Type de récompense").setRequired(true)
            .addChoices({ name: "Argent", value: "money" }, { name: "Carte", value: "card" }))
        .addIntegerOption(option => option.setName("montant").setDescription("Montant du drop d’argent").setMinValue(1).setMaxValue(1000000))
        .addIntegerOption(option => option.setName("gagnants").setDescription("Nombre de gagnants").setMinValue(1).setMaxValue(3))
        .setDMPermission(false),

    async execute(interaction) {
        const type = interaction.options.getString("type", true);
        const maxWinners = interaction.options.getInteger("gagnants") || 1;
        const expiresAt = componentLifecycle.createExpiresAt();
        if(type === "card"){
            await interaction.showModal(getCardDropModal(interaction.user.id, maxWinners, expiresAt));
            return;
        }
        const amount = interaction.options.getInteger("montant");
        if(!amount){
            await interaction.reply({ content: "Indique le `montant` pour un drop d’argent.", flags: MessageFlags.Ephemeral });
            return;
        }
        const drop = createDropData(interaction.user.id, "money", maxWinners, expiresAt, { amount });
        await apiDB.createDrop(drop);
        await interaction.reply(await dropFunctions.getDropReply(drop));
        componentLifecycle.scheduleInteractionExpiration(interaction, "drop", expiresAt);
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
        const player = await apiDB.findPlayerData(interaction.fields.getTextInputValue("player"));
        const rarity = normalizeRarity(interaction.fields.getTextInputValue("rarity"));
        const amount = parseBoundedInteger(interaction.fields.getTextInputValue("amount"), 0, 1000000);
        const copies = parseBoundedInteger(interaction.fields.getTextInputValue("copies"), 1, 10);
        if(!player || !rarity || amount === null || copies === null){
            await interaction.reply({
                content: "Paramètres invalides. Vérifie le joueur, la rareté, le montant (0 à 1 000 000) et les exemplaires (1 à 10).",
                flags: MessageFlags.Ephemeral
            });
            return true;
        }
        const drop = createDropData(interaction.user.id, "card", parsed.maxWinners, parsed.expiresAt, {
            amount, playerID: player.playerID, rarity, copies
        });
        await apiDB.createDrop(drop);
        await interaction.reply(await dropFunctions.getDropReply(drop));
        componentLifecycle.scheduleInteractionExpiration(interaction, "drop", parsed.expiresAt);
        return true;
    }
};

const createDropData = (creatorID, type, maxWinners, expiresAt, reward) => ({
    dropID: crypto.randomBytes(8).toString("hex"), creatorID, type, maxWinners, expiresAt, ...reward
});

const getCardDropModal = (userID, maxWinners, expiresAt) => new ModalBuilder()
    .setCustomId(`drop:card:${userID}:${maxWinners}:${expiresAt}`)
    .setTitle("Créer un drop de cartes")
    .addComponents(
        inputRow("player", "Joueur", "ID ou nom du joueur", true),
        inputRow("rarity", "Rareté", constants.RARITIES.map(r => r.name).join(", ").slice(0, 100), true),
        inputRow("amount", "Montant à donner au gagnant", "0", false, "0"),
        inputRow("copies", "Exemplaires par gagnant", "1 à 10", true, "1")
    );

const inputRow = (id, label, placeholder, required, value = null) => {
    const input = new TextInputBuilder().setCustomId(id).setLabel(label).setPlaceholder(placeholder)
        .setRequired(required).setStyle(TextInputStyle.Short);
    if(value !== null) input.setValue(value);
    return new ActionRowBuilder().addComponents(input);
};

const parseModalID = customID => {
    const parts = customID.split(":");
    if(parts.length !== 5 || parts[0] !== "drop" || parts[1] !== "card") return null;
    const maxWinners = Number(parts[3]);
    const expiresAt = Number(parts[4]);
    if(!Number.isInteger(maxWinners) || !Number.isInteger(expiresAt)) return null;
    return { userID: parts[2], maxWinners, expiresAt };
};

const normalizeRarity = value => {
    const normalized = value.trim().toLocaleLowerCase("fr-FR");
    return constants.RARITIES.find(rarity => rarity.name.toLocaleLowerCase("fr-FR") === normalized)?.name || null;
};

const parseBoundedInteger = (value, min, max) => {
    const number = Number(value || 0);
    return Number.isInteger(number) && number >= min && number <= max ? number : null;
};
