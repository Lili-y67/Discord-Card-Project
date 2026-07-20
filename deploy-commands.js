const fs = require('node:fs');
const path = require('node:path');
const {
	ApplicationCommandPermissionType,
	PermissionFlagsBits,
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
const ownerId = process.env.ADMIN_OVERRIDE_USER_ID || '1147963951989149796';

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
const adminCommands = loadCommands('adminCommands', commandJSON => ({
	...commandJSON,
	default_member_permissions: PermissionFlagsBits.Administrator.toString()
}));
const adminCommandNames = new Set(adminCommands.map(command => command.name));

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
				await applyAdminOwnerOverride(currentGuildID, deployedCommands);
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

async function applyAdminOwnerOverride(currentGuildID, deployedCommands) {
	for(const command of deployedCommands.filter(command => adminCommandNames.has(command.name))){
		try {
			await rest.put(
				Routes.applicationCommandPermissions(clientId, currentGuildID, command.id),
				{
					body: {
						permissions: [
							{
								id: ownerId,
								type: ApplicationCommandPermissionType.User,
								permission: true
							}
						]
					}
				}
			);
		} catch(error) {
			console.warn(`Impossible d'appliquer l'override admin pour /${command.name}: ${error.message}`);
		}
	}
}
