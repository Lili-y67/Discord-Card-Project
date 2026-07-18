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

module.exports = {
    SAFE_ALLOWED_MENTIONS,
    withSafeMentions
};
