const fs = require('node:fs');
const path = require('node:path');
const {
	REST,
	Routes
} = require('discord.js');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });

const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const guildIds = (process.env.GUILD_IDS || guildId || "")
	.split(",")
	.map(id => id.trim())
	.filter(Boolean);
const token = process.env.DISCORD_TOKEN;

const loadCommands = (directoryName, transform = commandJSON => commandJSON) => {
	const commands = [];
	const commandsPath = path.join(__dirname, directoryName);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		commands.push(transform(command.data.toJSON(), command));
	}

	return commands;
}

const publicCommands = loadCommands('commands');
const adminCommands = loadCommands('adminCommands');

const assertUniqueCommandNames = (commandList, sourceName) => {
	const seenCommands = new Map();
	for(const command of commandList){
		if(seenCommands.has(command.name)){
			throw new Error(`Commande doublon dans ${sourceName}: /${command.name}`);
		}
		seenCommands.set(command.name, true);
	}
}

assertUniqueCommandNames(publicCommands, 'commands');
assertUniqueCommandNames(adminCommands, 'adminCommands');
assertUniqueCommandNames([...publicCommands, ...adminCommands], 'commands + adminCommands');

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
	try {
		console.log('Started refreshing application (/) commands.');

		if(guildIds.length){
			for(const currentGuildID of guildIds){
				const deployedCommands = await rest.put(
					Routes.applicationGuildCommands(clientId, currentGuildID),
					{ body: [...publicCommands, ...adminCommands] },
				);
				console.log(`Successfully reloaded guild (/) commands for ${currentGuildID}.`);
				console.log('Admin commands are protected by the bot at runtime.');
			}
		}
		else{
			await rest.put(
				Routes.applicationCommands(clientId),
				{ body: publicCommands },
			);
			console.log('Successfully reloaded global public (/) commands. Admin commands require GUILD_ID or GUILD_IDS.');
		}
	} catch (error) {
		console.error(error);
	}
})();
