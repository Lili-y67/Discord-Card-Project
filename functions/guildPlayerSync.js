const apiDB = require('./apiDB');

let syncQueue = Promise.resolve();

const enqueueSync = (operation) => {
    const result = syncQueue.then(operation, operation);
    syncQueue = result.catch(() => {});
    return result;
};

const syncGuildMember = (member) => enqueueSync(async () => apiDB.withGuild(member.guild.id, async () => {
    if(member.user.bot) return { added: 0, updated: 0 };

    await apiDB.ensureDatabaseSchema();
    const playerName = member.displayName || member.user.username;
    const result = await apiDB.upsertGuildPlayer(member.id, playerName);
    await apiDB.refreshLastPickablePlayerID();
    return {
        added: result.added ? 1 : 0,
        updated: result.updated ? 1 : 0
    };
}));

const removeGuildMember = (member) => enqueueSync(async () => apiDB.withGuild(member.guild.id, async () => {
    if(member.user.bot) return { removed: 0 };

    await apiDB.ensureDatabaseSchema();
    const result = await apiDB.removeGuildPlayerByDiscordID(member.id);
    await apiDB.refreshLastPickablePlayerID();
    return {
        removed: result.removed ? 1 : 0,
        playerID: result.playerID,
        playerName: result.playerName
    };
}));

const syncGuildPlayers = (client, guildID = client.mainGuildID) => enqueueSync(async () => {
    if(!guildID){
        throw new Error('Aucun serveur à synchroniser.');
    }

    return apiDB.withGuild(guildID, async () => {
        await apiDB.ensureDatabaseSchema();
        const guild = await client.guilds.fetch(guildID);
        const members = await guild.members.fetch();
        let added = 0;
        let updated = 0;
        let removed = 0;
        let total = 0;
        const currentMemberIDs = new Set();

        for(const member of members.values()){
            if(member.user.bot) continue;
            currentMemberIDs.add(member.id);
            total += 1;
            const playerName = member.displayName || member.user.username;
            const result = await apiDB.upsertGuildPlayer(member.id, playerName);
            if(result.added) added += 1;
            if(result.updated) updated += 1;
        }

        const storedPlayers = await apiDB.getGuildPlayersList();
        for(const player of storedPlayers){
            if(currentMemberIDs.has(player.discordID?.toString())) continue;
            const result = await apiDB.removeGuildPlayerByDiscordID(player.discordID);
            if(result.removed) removed += 1;
        }

        const lastPlayerID = await apiDB.refreshLastPickablePlayerID();
        return { guildID, total, added, updated, removed, lastPlayerID };
    });
});

const getClientGuildIDs = async (client) => {
    const guilds = await client.guilds.fetch();
    return [...guilds.keys()];
}

const syncAllGuildPlayers = async (client) => {
    const guildIDs = await getClientGuildIDs(client);
    let added = 0;
    let updated = 0;
    let removed = 0;
    let total = 0;
    const guildResults = [];

    for(const guildID of guildIDs){
        try {
            const result = await syncGuildPlayers(client, guildID);
            added += result.added;
            updated += result.updated;
            removed += result.removed;
            total += result.total;
            guildResults.push(result);
        } catch(error) {
            console.error(`Erreur pendant la synchronisation du serveur ${guildID} :`, error);
        }
    }

    return { guilds: guildResults.length, total, added, updated, removed, guildResults };
}

const scheduleDailyGuildPlayerSync = (client) => {
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);
    const delay = nextMidnight.getTime() - now.getTime();

    console.log(`Prochaine synchronisation des membres : ${nextMidnight.toLocaleString('fr-FR')}`);
    return setTimeout(async () => {
        try {
            const result = await syncAllGuildPlayers(client);
            console.log(`Synchronisation quotidienne : ${result.guilds} serveur(s), ${result.added} ajouté(s), ${result.updated} mis à jour, ${result.removed} retiré(s), ${result.total} membre(s) au total.`);
        } catch(error) {
            console.error('Erreur pendant la synchronisation quotidienne des membres :', error);
        } finally {
            scheduleDailyGuildPlayerSync(client);
        }
    }, delay);
};

module.exports = {
    syncGuildMember,
    removeGuildMember,
    syncGuildPlayers,
    syncAllGuildPlayers,
    scheduleDailyGuildPlayerSync
};
