const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });

const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const guildIds = (process.env.GUILD_IDS || guildId || "")
	.split(",")
	.map(id => id.trim())
	.filter(Boolean);
const guildIdAdmin = process.env.GUILD_ID_ADMIN;
const token = process.env.DISCORD_TOKEN;

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);
	commands.push(command.data.toJSON());
}

const assertUniqueCommandNames = (commandList, sourceName) => {
	const seenCommands = new Map();
	for(const command of commandList){
		if(seenCommands.has(command.name)){
			throw new Error(`Commande doublon dans ${sourceName}: /${command.name}`);
		}
		seenCommands.set(command.name, true);
	}
}

assertUniqueCommandNames(commands, 'commands');


const rest = new REST({ version: '10' }).setToken(token);

(async () => {
	try {
		console.log('Started refreshing application (/) commands.');

		if(guildIds.length){
			for(const currentGuildID of guildIds){
				await rest.put(
					Routes.applicationGuildCommands(clientId, currentGuildID),
					{ body: commands },
				);
				console.log(`Successfully reloaded guild (/) commands for ${currentGuildID}.`);
			}
		}
		else{
			await rest.put(
				Routes.applicationCommands(clientId),
				{ body: commands },
			);
			console.log('Successfully reloaded global (/) commands.');
		}
	} catch (error) {
		console.error(error);
	}
})();


const commandsAdmin = [];
const commandsPathAdmin = path.join(__dirname, 'adminCommands');
const commandFilesAdmin = fs.readdirSync(commandsPathAdmin).filter(file => file.endsWith('.js'));

for (const file of commandFilesAdmin) {
	const filePath = path.join(commandsPathAdmin, file);
	const command = require(filePath);
	commandsAdmin.push(command.data.toJSON());
}

assertUniqueCommandNames(commandsAdmin, 'adminCommands');

const restAdmin = new REST({ version: '10' }).setToken(token);

(async () => {
	try {
		console.log('Started refreshing application (/) admin commands.');

		if(guildIdAdmin){
			await restAdmin.put(
				Routes.applicationGuildCommands(clientId, guildIdAdmin),
				{ body: commandsAdmin },
			);
		}

		console.log('Successfully reloaded application (/) admin commands.');
	} catch (error) {
		console.error(error);
	}
})();









/*
rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands })
	.then(() => console.log('Successfully registered application commands.'))
	.catch(console.error);
*/
