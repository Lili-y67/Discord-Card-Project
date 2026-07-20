const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, Partials, PermissionFlagsBits } = require('discord.js');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });

const token = process.env.DISCORD_TOKEN;
const guildId = process.env.GUILD_ID;
const imagesStorageGuildID = process.env.IMAGES_STORAGE_GUILD_ID;
const imagesStorageChannelID = process.env.IMAGES_STORAGE_CHANNEL_ID;

const buttonCenter = require("./functions/buttonCenter");
const guildPlayerSync = require('./functions/guildPlayerSync');
const inventoryFunctions = require('./functions/secondLayerInventoryFunctions');
const cardsListFunctions = require('./functions/secondLayerCardsListFunctions');
const guildCollectionFunctions = require('./functions/secondLayerGuildCollectionFunctions');
const topFunctions = require('./functions/secondLayerTopFunctions');
const collectionCardFunctions = require('./functions/secondLayerCollectionCardFunctions');
const apiDB = require("./functions/apiDB");
const mentionSafety = require("./functions/mentionSafety");
const questCore = require("./functions/questCore");

const logFilePath = "./logs.txt"
const ADMIN_OVERRIDE_USER_ID = process.env.ADMIN_OVERRIDE_USER_ID || '1147963951989149796';

const client = new Client({
	intents: Object.values(GatewayIntentBits),
	partials: Object.values(Partials),
	allowedMentions: mentionSafety.SAFE_ALLOWED_MENTIONS
});


client.commands = new Collection();
client.adminCommandNames = new Set();

client.buttonsDictionary = {}
client.buttonGroupsDictionary = {}
client.blockBot = false
client.quickPickTimeMultiplicator = 1.00
client.mainGuildID = guildId
client.imagesStorageGuildID = imagesStorageGuildID
client.imagesStorageChannelID = imagesStorageChannelID

client.once(Events.ClientReady, async () => {
	console.log('Ready!');
	try {
		const result = await guildPlayerSync.syncAllGuildPlayers(client);
		console.log(`Synchronisation au démarrage : ${result.guilds} serveur(s), ${result.added} ajouté(s), ${result.updated} mis à jour, ${result.removed} retiré(s), ${result.total} membre(s) au total.`);
	} catch(error) {
		console.error('Erreur pendant la synchronisation des membres au démarrage :', error);
	}
	guildPlayerSync.scheduleDailyGuildPlayerSync(client);
});

client.on('guildMemberAdd', async member => {
	await apiDB.withGuild(member.guild.id, async () => {
		if(member.user.bot) return;
		try {
			const result = await guildPlayerSync.syncGuildMember(member);
			if(result.added){
				console.log(`Nouveau joueur ajouté automatiquement sur ${member.guild.id} : ${member.displayName} (${member.id})`);
			}
		} catch(error) {
			console.error(`Impossible d'ajouter automatiquement ${member.id} sur ${member.guild.id} :`, error);
		}
	});
});

client.on('guildMemberRemove', async member => {
	await apiDB.withGuild(member.guild.id, async () => {
		if(member.user.bot) return;
		try {
			const result = await guildPlayerSync.removeGuildMember(member);
			if(result.removed){
				console.log(`Joueur retiré automatiquement sur ${member.guild.id} : ${result.playerName} (${member.id}) - playerID ${result.playerID}`);
			}
		} catch(error) {
			console.error(`Impossible de retirer automatiquement ${member.id} sur ${member.guild.id} :`, error);
		}
	});
});

client.on(Events.MessageCreate, async message => {
	if(!message.guildId || message.author?.bot) return;
	try {
		await questCore.trackMessage(message);
	} catch(error) {
		console.error(`Erreur pendant le suivi de quête message pour ${message.author?.id}:`, error);
	}
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);
	//console.log(command.permissions)
	client.commands.set(command.data.name, command);
	//console.log(client.commands["testadmin"])
}

const commandsPathAdmin = path.join(__dirname, 'adminCommands');
const commandFilesAdmin = fs.readdirSync(commandsPathAdmin).filter(file => file.endsWith('.js'));

for (const file of commandFilesAdmin) {
	const filePath = path.join(commandsPathAdmin, file);
	const command = require(filePath);
	//console.log(command.permissions)
	client.commands.set(command.data.name, command);
	client.adminCommandNames.add(command.data.name);
	//console.log(client.commands["testadmin"])
}


/*

client.commands.get("testadmin").defaultPermission = false

console.log(client.commands.get("testadmin"))

console.log(client.commands.get("testadmin").defaultPermission);


(async () => {

	var testo = client.guilds.cache.get('909489514991460433');
	console.log(testo)
	console.log("aaaa")
})();



*/

client.on('interactionCreate', async interaction => {
	await apiDB.withGuild(interaction.guildId, async () => {

	if(interaction.isModalSubmit()){
		if(await client.commands.get("config")?.handleConfigModal?.(client, interaction)){
			return;
		}
	}

	if(interaction.isButton()){
		if(await client.commands.get("config")?.handleConfigButton?.(client, interaction)){
			return;
		}
		if(await inventoryFunctions.handleInventoryButton(client, interaction)){
			return;
		}
		if(await cardsListFunctions.handleCardsButton(client, interaction)){
			return;
		}
		if(await guildCollectionFunctions.handleGuildCollectionButton(client, interaction)){
			return;
		}
		if(await topFunctions.handleTopButton(client, interaction)){
			return;
		}
		if(await collectionCardFunctions.handleCollectionCardButton(client, interaction)){
			return;
		}
		if(client.blockBot){
			interaction.deferUpdate()
			return;
		}
		buttonCenter.buttonRedirector(client, interaction)
	}

	if(interaction.isStringSelectMenu()){
		if(await client.commands.get("config")?.handleConfigSelect?.(client, interaction)){
			return;
		}
		if(await client.commands.get("aide")?.handleHelpSelect?.(client, interaction)){
			return;
		}
		if(await cardsListFunctions.handleCardsSelect(client, interaction)){
			return;
		}
		if(await guildCollectionFunctions.handleGuildCollectionSelect(client, interaction)){
			return;
		}
	}

	if(interaction.isChannelSelectMenu()){
		if(await client.commands.get("config")?.handleConfigChannelSelect?.(client, interaction)){
			return;
		}
	}

	//var testo = client.guilds.cache.get('909489514991460433');
	//console.log(testo.commands[0])

	if (!interaction.isChatInputCommand()) return;

	const command = client.commands.get(interaction.commandName);

	try {
		fs.writeFile(logFilePath, "\n" + interaction.commandName.toString() + " from " + interaction.user.username + " " + interaction.user.id.toString() + "\n" + JSON.stringify(interaction.options._hoistedOptions), { flag: 'a+' }, function (err) {
			if (err){
				console.log(err);
				console.log('Error writing logs for command');
			} 
		});
	} catch (error) {
		console.log("Error writing logs for command SECOND PROTECT LAYER")
	}

	let startingDate = Date.now()
	console.log(interaction.commandName.toString() + " from " + interaction.user.username + " " + interaction.user.id.toString() + " -- at " + Date.now().toString())
	console.log(interaction.options._hoistedOptions)


	if (!command) return;

	if(client.adminCommandNames.has(interaction.commandName) && !canUseAdminCommand(interaction)){
		await interaction.reply(mentionSafety.withSafeMentions({
			content: "Cette commande est réservée aux administrateurs.",
			ephemeral: true
		}));
		return;
	}

	if(client.blockBot&&interaction.commandName != "blockbot"){
		interaction.reply(mentionSafety.withSafeMentions({ content: "Le bot est actuellement en maintenance, merci de votre patience :)" }))
		return;
	}

	try {
		await command.execute(interaction);
		if(["collection", "collectioncard", "inv", "cards", "guildcollection"].includes(interaction.commandName)){
			await questCore.trackEvent(interaction.user.id, "collection_viewed");
		}
        console.log(interaction.commandName.toString() + " from " + interaction.user.username + " " + interaction.user.id.toString() + " -- ENDED at " + Date.now().toString() + " -- it took " + (Date.now()-startingDate).toString() + "ms")
	} catch (error) {

		try {
			fs.writeFile(logFilePath, `CRITICAL ERROR! CAUSE : ${interaction.commandName?.toString()} FROM ${interaction.user.id.toString()}` + "\n" + error.toString(), { flag: 'a+' } ,function (err) {
				if (err){
					console.log(err);
					console.log('Error writing logs for an error');
				}
			});
		} catch (error) {
			console.log("Error writing logs for an error SECOND PROTECT LAYER")
		}

		console.log(`CRITICAL ERROR! CAUSE : ${interaction.commandName?.toString()} FROM ${interaction.user.id.toString()}`)
		console.error(error);
		return;
		//await interaction.reply({ content: "Erreur lors de l'exécution de la commande", ephemeral: true });
	}
	});
});



client.login(token);

const canUseAdminCommand = (interaction) => {
	if(interaction.user.id == ADMIN_OVERRIDE_USER_ID) return true;
	return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) || false;
}
