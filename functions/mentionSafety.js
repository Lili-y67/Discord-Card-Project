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

module.exports = {
    SAFE_ALLOWED_MENTIONS,
    withSafeMentions,
    escapeMarkdown,
    getUserMention,
    getDisplayName
};
