const path = require('node:path');
const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });

const { syncAllGuildPlayers, syncGuildPlayers } = require('./functions/guildPlayerSync');

const token = process.env.DISCORD_TOKEN;
const guildId = process.env.GUILD_ID;

if(!token){
    console.error('DISCORD_TOKEN doit être renseigné dans .env');
    process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
client.mainGuildID = guildId;

const run = async () => {
    await client.login(token);
    const result = guildId ? await syncGuildPlayers(client, guildId) : await syncAllGuildPlayers(client);
    const guildCount = result.guilds ?? 1;
    console.log(`Synchronisation terminée : ${guildCount} serveur(s), ${result.added} ajouté(s), ${result.updated} mis à jour, ${result.total} membre(s) au total.`);
    client.destroy();
    process.exit(0);
};

run().catch(error => {
    client.destroy();
    console.error(error);
    process.exit(1);
});
