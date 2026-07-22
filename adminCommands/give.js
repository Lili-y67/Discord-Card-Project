const {
    ActionRowBuilder, LabelBuilder, MessageFlags, ModalBuilder, PermissionFlagsBits, SlashCommandBuilder,
    StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder
} = require("discord.js");
const apiDB = require("../functions/apiDB");
const constants = require("../data/constants");
const pickFunctions = require("../functions/secondLayerPickFunctions");

module.exports = {
    data: new SlashCommandBuilder().setName("give").setDescription("Donner une récompense à un membre")
        .addStringOption(option => option.setName("type").setDescription("Récompense").setRequired(true).addChoices(
            { name: "Argent", value: "money" }, { name: "Points", value: "points" }, { name: "Carte", value: "card" }
        )).setDMPermission(false),
    async execute(interaction){
        const type = interaction.options.getString("type", true);
        await interaction.showModal(getGiveModal(type, interaction.user.id));
    },
    async handleGiveModal(client, interaction){
        const parts = interaction.customId.split(":");
        if(parts.length !== 3 || parts[0] !== "give" || !["money", "points", "card"].includes(parts[1])) return false;
        if(parts[2] !== interaction.user.id || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)){
            await interaction.reply({ content: "Ce formulaire est réservé aux administrateurs.", flags: MessageFlags.Ephemeral }); return true;
        }
        const target = interaction.fields.getSelectedUsers("give_target", true).first();
        if(!target || target.bot){ await interaction.reply({ content: "Choisis un membre humain.", flags: MessageFlags.Ephemeral }); return true; }
        await apiDB.prepareUser(target.id, target.username);
        if(parts[1] === "card"){
            const playerUser = interaction.fields.getSelectedUsers("give_player", true).first();
            if(playerUser) await apiDB.upsertGuildPlayer(playerUser.id, playerUser.username);
            const player = playerUser ? await apiDB.findPlayerData(playerUser.id) : null;
            const rarity = interaction.fields.getStringSelectValues("give_rarity")[0];
            const copies = Number(interaction.fields.getTextInputValue("give_amount"));
            if(!player || !rarity || !Number.isInteger(copies) || copies < 1 || copies > 10){
                await interaction.reply({ content: "Carte invalide ou exemplaires hors limite (1 à 10).", flags: MessageFlags.Ephemeral }); return true;
            }
            const ids = await pickFunctions.makeDropCards(client, target, player.playerID, rarity, copies);
            await interaction.reply({ content: `🃏 ${copies} carte(s) donnée(s) à <@${target.id}> : **#${ids.join(", #")}**.`, allowedMentions: { parse: [] } });
        } else {
            const amount = Number(interaction.fields.getTextInputValue("give_amount"));
            if(!Number.isInteger(amount) || amount < 1 || amount > 1000000){ await interaction.reply({ content: "Montant invalide.", flags: MessageFlags.Ephemeral }); return true; }
            if(parts[1] === "money") await apiDB.addMoneyToUser(target.id, amount); else await apiDB.addPointsToUser(target.id, amount);
            await interaction.reply({ content: `${parts[1] === "money" ? "💰" : "✨"} **${amount}${parts[1] === "money" ? "$" : " points"}** donnés à <@${target.id}>.`, allowedMentions: { parse: [] } });
        }
        return true;
    }
};

const getGiveModal = (type, ownerID) => {
    const modal = new ModalBuilder().setCustomId(`give:${type}:${ownerID}`).setTitle(type === "card" ? "Donner une carte" : type === "money" ? "Donner de l’argent" : "Donner des points")
        .addLabelComponents(new LabelBuilder().setLabel("Destinataire").setUserSelectMenuComponent(new UserSelectMenuBuilder().setCustomId("give_target").setMinValues(1).setMaxValues(1)));
    if(type === "card") modal.addLabelComponents(
        new LabelBuilder().setLabel("Joueur de la carte").setUserSelectMenuComponent(new UserSelectMenuBuilder().setCustomId("give_player").setMinValues(1).setMaxValues(1)),
        new LabelBuilder().setLabel("Rareté").setStringSelectMenuComponent(new StringSelectMenuBuilder().setCustomId("give_rarity").addOptions(constants.RARITIES.map(r => new StringSelectMenuOptionBuilder().setLabel(r.name).setValue(r.name))))
    );
    return modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("give_amount").setLabel(type === "card" ? "Exemplaires (1 à 10)" : "Montant").setStyle(TextInputStyle.Short).setRequired(true).setValue("1")));
};
