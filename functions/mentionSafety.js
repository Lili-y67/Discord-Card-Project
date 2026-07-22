const SAFE_ALLOWED_MENTIONS = Object.freeze({
    parse: [],
    users: [],
    roles: [],
    repliedUser: false
});

const withSafeMentions = (payload = {}) => ({
    ...payload,
    allowedMentions: SAFE_ALLOWED_MENTIONS
});

const escapeMarkdown = (value) => {
    return (value ?? "")
        .toString()
        .replace(/\\/g, "\\\\")
        .replace(/([*_~`>|])/g, "\\$1");
}

const getUserMention = (userID) => {
    const safeID = userID?.toString();
    return /^\d{17,20}$/.test(safeID || "") ? `<@${safeID}>` : null;
}

const getDisplayName = (value, fallback = "Utilisateur") => {
    return escapeMarkdown(value || fallback);
}

const commandMentionCache = new Map();

const getCommandMention = async (client, commandName, guildID = null) => {
    const cacheKey = `${guildID || "global"}:${commandName}`;
    if(commandMentionCache.has(cacheKey)) return commandMentionCache.get(cacheKey);

    let command = null;
    try {
        const globalCommands = await client.application.commands.fetch();
        command = globalCommands.find(entry => entry.name === commandName) || null;
        if(guildID){
            const guild = client.guilds.cache.get(guildID) || await client.guilds.fetch(guildID).catch(() => null);
            const guildCommands = guild ? await guild.commands.fetch() : null;
            command = guildCommands?.find(entry => entry.name === commandName) || command;
        }
    } catch {}

    const mention = command ? `</${commandName}:${command.id}>` : `/${commandName}`;
    // Ne mémoriser que les résolutions réussies : un échec réseau temporaire
    // ne doit pas condamner les mentions jusqu'au prochain redémarrage.
    if(command) commandMentionCache.set(cacheKey, mention);
    return mention;
}

module.exports = {
    SAFE_ALLOWED_MENTIONS,
    withSafeMentions,
    escapeMarkdown,
    getUserMention,
    getDisplayName,
    getCommandMention
};
