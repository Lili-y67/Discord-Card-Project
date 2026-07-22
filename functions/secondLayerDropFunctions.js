const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    MessageFlags,
    SeparatorBuilder
} = require("discord.js");
const apiDB = require("./apiDB");
const pickFunctions = require("./secondLayerPickFunctions");
const mentionSafety = require("./mentionSafety");
const componentLifecycle = require("./componentLifecycle");

const ACCENT_COLOR = 0xF6A700;

const getDropReply = async (drop) => {
    const claims = await apiDB.getDropClaims(drop.dropID);
    return mentionSafety.withSafeMentions({
        components: [getDropContainer(drop, claims)],
        flags: MessageFlags.IsComponentsV2
    });
};

const getDropContainer = (drop, claims = []) => {
    const complete = claims.length >= drop.maxWinners || drop.status === "complete";
    const reward = drop.type === "money"
        ? `💰 **${drop.amount}$** par gagnant`
        : `🃏 **${drop.copies}× ${drop.rarity}** — joueur ${drop.playerID}${drop.amount ? `\n💰 Bonus : **${drop.amount}$**` : ""}`;
    const winners = claims.length
        ? claims.map((claim, index) => `${index + 1}. <@${claim.userID}>`).join("\n")
        : "Personne pour le moment — soyez le premier !";

    return new ContainerBuilder()
        .setAccentColor(complete ? 0x39B54A : ACCENT_COLOR)
        .addTextDisplayComponents(text => text.setContent(complete ? "## 🎉 Drop terminé — GG aux gagnants !" : "## 🎁 Un drop est disponible !"))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(text => text.setContent(`${reward}\n\n**Gagnants (${claims.length}/${drop.maxWinners})**\n${winners}`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`drop:claim:${drop.dropID}:${drop.expiresAt}`)
                .setStyle(complete ? ButtonStyle.Secondary : ButtonStyle.Success)
                .setEmoji(complete ? "🏆" : "🎁")
                .setLabel(complete ? "Drop réclamé" : "Réclamer le drop")
                .setDisabled(complete)
        ));
};

const handleDropButton = async (client, interaction) => {
    const parts = interaction.customId.split(":");
    if(parts.length !== 4 || parts[0] !== "drop" || parts[1] !== "claim") return false;
    const [, , dropID, rawExpiresAt] = parts;
    const expiresAt = Number(rawExpiresAt);
    if(componentLifecycle.isExpired(expiresAt)){
        await componentLifecycle.expireInteractedMessage(interaction, "drop", interaction.commandId);
        return true;
    }

    await apiDB.prepareUser(interaction.user.id, interaction.user.username);
    const result = await apiDB.claimDropSlot(dropID, interaction.user.id);
    if(!result.drop){
        await interaction.reply({ content: "Ce drop n’existe plus.", flags: MessageFlags.Ephemeral });
        return true;
    }
    if(!result.won){
        await interaction.reply({
            content: result.alreadyClaimed ? "Tu as déjà réclamé ce drop." : "Toutes les places ont déjà été prises.",
            flags: MessageFlags.Ephemeral
        });
        if(!result.alreadyClaimed) await interaction.message.edit(await getDropReply(result.drop));
        return true;
    }

    await interaction.deferUpdate();
    try {
        let rewardText;
        if(result.drop.type === "money"){
            await apiDB.addMoneyToUser(interaction.user.id, result.drop.amount);
            rewardText = `Tu remportes **${result.drop.amount}$** !`;
        } else {
            const cardIDs = await pickFunctions.makeDropCards(client, interaction.user, result.drop.playerID, result.drop.rarity, result.drop.copies);
            if(result.drop.amount > 0) await apiDB.addMoneyToUser(interaction.user.id, result.drop.amount);
            rewardText = `Tu remportes ${cardIDs.length > 1 ? `les cartes **#${cardIDs.join(", #")}**` : `la carte **#${cardIDs[0]}**`}${result.drop.amount ? ` et **${result.drop.amount}$**` : ""} !`;
        }
        const refreshedDrop = await apiDB.getDrop(dropID);
        await interaction.message.edit(await getDropReply(refreshedDrop));
        await interaction.followUp({ content: `🎉 ${rewardText}`, flags: MessageFlags.Ephemeral });
    } catch(error) {
        await apiDB.releaseDropClaim(dropID, interaction.user.id);
        await interaction.followUp({ content: `Le gain n’a pas pu être créé : ${error.message}`, flags: MessageFlags.Ephemeral });
    }
    return true;
};

module.exports = { getDropReply, handleDropButton };
