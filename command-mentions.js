const path = require('node:path');
const { REST, Routes } = require('discord.js');

require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });

const token = process.env.DISCORD_TOKEN;
const clientID = process.env.CLIENT_ID;
const guildIDs = (process.env.GUILD_IDS || process.env.GUILD_ID || "")
    .split(",")
    .map(guildID => guildID.trim())
    .filter(Boolean);

if(!token || !clientID){
    console.error("DISCORD_TOKEN et CLIENT_ID sont requis dans .env.");
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

const getCommandMentions = (command) => {
    const options = command.options || [];
    const subcommands = [];

    for(const option of options){
        if(option.type == 1){
            subcommands.push(`${command.name} ${option.name}`);
        }

        if(option.type == 2){
            for(const subcommand of option.options || []){
                if(subcommand.type == 1){
                    subcommands.push(`${command.name} ${option.name} ${subcommand.name}`);
                }
            }
        }
    }

    const names = subcommands.length ? subcommands : [command.name];
    return names.map(name => `</${name}:${command.id}>`);
}

async function fetchCommands(label, route) {
    const commands = await rest.get(route);
    console.log(`\n${label}`);
    if(!commands.length){
        console.log("Aucune commande.");
        return;
    }

    commands
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach(command => {
            getCommandMentions(command).forEach(mention => console.log(mention));
        });
}

(async () => {
    await fetchCommands("Commandes globales", Routes.applicationCommands(clientID));

    for(const guildID of guildIDs){
        await fetchCommands(`Commandes serveur ${guildID}`, Routes.applicationGuildCommands(clientID, guildID));
    }
})().catch(error => {
    console.error(error);
    process.exit(1);
});
