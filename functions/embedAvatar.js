const getMemberAvatarURL = (user) => user?.displayAvatarURL?.({
    extension: 'png',
    size: 128,
    forceStatic: true
});

const getMemberDisplayName = (user) => user?.globalName || user?.displayName || user?.username || 'Membre';

const addMemberAvatar = (embed, user, label = null) => {
    const iconURL = getMemberAvatarURL(user);
    if(!iconURL) return embed;

    return embed.setAuthor({
        name: label || getMemberDisplayName(user),
        iconURL
    });
};

module.exports = {
    addMemberAvatar,
    getMemberAvatarURL,
    getMemberDisplayName
};
