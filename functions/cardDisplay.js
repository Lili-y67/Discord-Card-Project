const getPlayerData = (card) => card?.playerData || {};

const getPlayerDisplayName = (card) => {
    const playerData = getPlayerData(card);
    const playerName = playerData.playerName?.toString().trim();
    return playerName || `Joueur ${card?.playerID ?? '?'}`;
};

const getPlayerEmojiID = (card) => {
    const rawEmoji = getPlayerData(card).playerEmote?.toString().trim();
    if(!rawEmoji) return null;

    const mentionMatch = rawEmoji.match(/^<a?:[^:]+:(\d{17,20})>$/);
    if(mentionMatch) return mentionMatch[1];

    const splitID = rawEmoji.split(':').pop();
    return /^\d{17,20}$/.test(splitID || '') ? splitID : null;
};

const getPlayerEmojiText = (card) => {
    const rawEmoji = getPlayerData(card).playerEmote?.toString().trim();
    if(!rawEmoji) return '';
    if(/^<a?:[^:]+:\d{17,20}>$/.test(rawEmoji)) return rawEmoji;
    if(/^[^:\s]+:\d{17,20}$/.test(rawEmoji)) return `<:${rawEmoji}>`;

    const emojiID = getPlayerEmojiID(card);
    return emojiID ? `<:player_${card?.playerID ?? 'card'}:${emojiID}>` : '';
};

const getCardListLine = (card) => {
    const emojiText = getPlayerEmojiText(card);
    const prefix = emojiText ? `${emojiText} • ` : '';
    return `${prefix}${card.cardID.toString()} - ${getPlayerDisplayName(card)} - ${card.rarity} (${card.rarityValue.toString()})`;
};

module.exports = {
    getCardListLine,
    getPlayerDisplayName,
    getPlayerEmojiID,
    getPlayerEmojiText
};
