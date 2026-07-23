const {
    ActionRowBuilder,
    LabelBuilder,
    MessageFlags,
    ModalBuilder,
    PermissionFlagsBits,
    SlashCommandBuilder,
    TextInputBuilder,
    TextInputStyle,
    UserSelectMenuBuilder
} = require("discord.js");

const apiDB = require("../functions/apiDB");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ungive")
        .setDescription("Retirer de l’argent ou des points à un membre")
        .addStringOption(option => option
            .setName("type")
            .setDescription("Ressource à retirer")
            .setRequired(true)
            .addChoices(
                { name: "Argent", value: "money" },
                { name: "Points", value: "points" }
            ))
        .setDMPermission(false),

    async execute(interaction) {
        const type = interaction.options.getString("type", true);
        await interaction.showModal(getUngiveModal(type, interaction.user.id));
    },

    async handleUngiveModal(client, interaction) {
        const parts = interaction.customId.split(":");
        if(parts.length !== 3 || parts[0] !== "ungive" || !["money", "points"].includes(parts[1])) return false;
        if(parts[2] !== interaction.user.id || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)){
            await interaction.reply({ content: "Ce formulaire est réservé aux administrateurs.", flags: MessageFlags.Ephemeral });
            return true;
        }

        const target = interaction.fields.getSelectedUsers("ungive_target", true).first();
        const requestedAmount = Number(interaction.fields.getTextInputValue("ungive_amount"));
        if(!target || target.bot){
            await interaction.reply({ content: "Choisis un membre humain.", flags: MessageFlags.Ephemeral });
            return true;
        }
        if(!Number.isInteger(requestedAmount) || requestedAmount < 1 || requestedAmount > 1000000){
            await interaction.reply({ content: "Montant invalide (1 à 1 000 000).", flags: MessageFlags.Ephemeral });
            return true;
        }

        await apiDB.prepareUser(target.id, target.username);
        const user = await apiDB.getAUserFromDiscordID(target.id);
        const currentBalance = Math.max(0, Number(parts[1] === "money" ? user?.money : user?.cardPoints) || 0);
        const removedAmount = Math.min(requestedAmount, currentBalance);

        if(parts[1] === "money"){
            await apiDB.subMoneyToUser(target.id, removedAmount);
        } else {
            await apiDB.subPointsToUser(target.id, removedAmount);
        }

        const unit = parts[1] === "money" ? "$" : " points";
        const icon = parts[1] === "money" ? "💸" : "✨";
        const adjustment = removedAmount < requestedAmount
            ? `\n-# Retrait limité au solde disponible (${currentBalance}${unit}) pour éviter un solde négatif.`
            : "";
        await interaction.reply({
            content: `${icon} **${removedAmount}${unit}** retirés à <@${target.id}>.${adjustment}`,
            allowedMentions: { parse: [] }
        });
        return true;
    }
};

const getUngiveModal = (type, ownerID) => new ModalBuilder()
    .setCustomId(`ungive:${type}:${ownerID}`)
    .setTitle(type === "money" ? "Retirer de l’argent" : "Retirer des points")
    .addLabelComponents(
        new LabelBuilder()
            .setLabel("Membre ciblé")
            .setUserSelectMenuComponent(new UserSelectMenuBuilder()
                .setCustomId("ungive_target")
                .setMinValues(1)
                .setMaxValues(1))
    )
    .addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder()
            .setCustomId("ungive_amount")
            .setLabel("Montant à retirer")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue("1")
    ));
