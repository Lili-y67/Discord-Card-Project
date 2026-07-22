const {
	AttachmentBuilder,
	ContainerBuilder,
	EmbedBuilder,
	MediaGalleryBuilder,
	MediaGalleryItemBuilder,
	MessageFlags,
	SeparatorBuilder
} = require('discord.js');
const Canvas = require('canvas');
const fs = require('node:fs');
const path = require('node:path');

const apiDB = require("./apiDB");
const constants = require("../data/constants.js");
const cardDisplay = require("./cardDisplay");
const mentionSafety = require("./mentionSafety");

const IMAGES_STORAGE_GUILD_SETTING = "imagesStorageGuildID";
const IMAGES_STORAGE_CHANNEL_SETTING = "imagesStorageChannelID";

const CARD_FONT_FAMILY = 'Arial';

const CARD_WIDTH = 812;
const CARD_HEIGHT = 1224;
const MEMBER_IMAGE_WIDTH = 703;
const MEMBER_IMAGE_HEIGHT = 817;
// Keep the exact position used by the original 703x817 player images.
const MEMBER_IMAGE_X = (CARD_WIDTH - MEMBER_IMAGE_WIDTH) / 2 - 17;
const MEMBER_IMAGE_Y = (CARD_HEIGHT - MEMBER_IMAGE_HEIGHT) / 2 + 42;
const CARD_FRAMES_DIRECTORY = path.join(__dirname, '../assets');
const DISCORD_AVATAR_SIZE = 360;
const BLURRED_BACKGROUND_WIDTH = 48;
const BLURRED_BACKGROUND_HEIGHT = 56;

const getCardEmbed = async (clientBot, cardID, requestedByUser = null) => {
    let card = await apiDB.getACardFromID(cardID)
	if(!card){
		throw new Error(`Carte ${cardID} introuvable.`)
	}

	const playerID = card.playerID ?? "?"
	const playerDisplay = await getPlayerDisplay(clientBot, card)

	const creatorUser = await getUserDisplay(clientBot, card.creatorID)
	const ownerUser = await getUserDisplay(clientBot, card.ownerID)

	let cardEmbed = new EmbedBuilder()
	.setColor(card.embedColor)
	.setTitle(`Carte numéro ${cardID}`)
	.setImage(card.imageURL)
    .addFields(
	{
		name: "Joueur :",
		value: `${playerDisplay} (joueur ${playerID})`,
		inline: true
	},
	{
		name: "Rareté :",
		value: `${card.rarity} (${card.rarityValue})`,
		inline: true
	},
	{
		name: "Créateur :",
		value: creatorUser,
		inline: true
	},
	{
		name: "Possesseur :",
		value: ownerUser,
		inline: true
	},
	{
		name: `Statut :`,
		value: card.locked ? "Verrouillée" : "Déverrouillée",
		inline: true
	}
	)
    return cardEmbed
}

const getCardReply = async (clientBot, cardID, requestedByUser = null, ephemeral = false) => {
    const card = await apiDB.getACardFromID(cardID)
	if(!card){
		throw new Error(`Carte ${cardID} introuvable.`)
	}

	return mentionSafety.withSafeMentions({
		components: [await getCardContainer(clientBot, card, requestedByUser)],
		flags: ephemeral ? MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral : MessageFlags.IsComponentsV2
	})
}

const getCardContainer = async (clientBot, card, requestedByUser = null) => {
	const creatorDisplay = await getUserDisplay(clientBot, card.creatorID)
	const ownerDisplay = await getUserDisplay(clientBot, card.ownerID)
	const playerDisplay = await getPlayerDisplay(clientBot, card)

	const container = new ContainerBuilder()
		.setAccentColor(parseColor(card.embedColor))
		.addTextDisplayComponents(text => text.setContent(`## Carte numero ${card.cardID}`))
		.addSeparatorComponents(new SeparatorBuilder())
		.addTextDisplayComponents(text =>
			text.setContent([
				`**Joueur** ${playerDisplay} (joueur ${card.playerID ?? "?"})`,
				`**Rarete** ${mentionSafety.escapeMarkdown(card.rarity)} (${card.rarityValue})`,
				`**Createur** ${creatorDisplay}`,
				`**Possesseur** ${ownerDisplay}`,
				`**Statut** ${card.locked ? "Verrouillee" : "Deverrouillee"}`
			].join("\n"))
		)

	if(card.imageURL){
		container.addMediaGalleryComponents(
			new MediaGalleryBuilder().addItems(
				new MediaGalleryItemBuilder()
					.setURL(card.imageURL)
					.setDescription(`Carte ${card.cardID}`)
			)
		)
	}

	return container
}

const getUserDisplay = async (clientBot, userID) => {
	if(!userID) return "Aucun"
	const safeUserID = userID.toString()
	if(!/^\d{17,20}$/.test(safeUserID)) return mentionSafety.getDisplayName(safeUserID, "Aucun")

	try {
		const guildID = apiDB.getCurrentGuildID() || clientBot.mainGuildID
		const guild = guildID ? await clientBot.guilds.fetch(guildID) : null
		const member = guild ? await guild.members.fetch(safeUserID) : null
		if(member){
			return `${mentionSafety.escapeMarkdown(member.displayName || member.user.username)} (<@${safeUserID}>)`
		}
	} catch(error) {
		// Le membre peut avoir quitté le serveur : on tente alors le compte Discord global.
	}

	try {
		const user = await clientBot.users.fetch(safeUserID, { force: true })
		const name = user.globalName || user.username
		return `${mentionSafety.escapeMarkdown(name)} (\`${safeUserID}\`)`
	} catch(error) {
		try {
			const storedUser = await apiDB.getAUserFromDiscordID(safeUserID)
			if(storedUser?.name) return `${mentionSafety.escapeMarkdown(storedUser.name)} (\`${safeUserID}\`)`
		} catch(databaseError) {
			// La base peut ne plus contenir ce compte.
		}
		return `Utilisateur \`${safeUserID}\``
	}
}

const getRequestedByDisplay = (user) => {
	return mentionSafety.getUserMention(user?.id) || mentionSafety.getDisplayName(user?.username, "Utilisateur")
}

const getPlayerDisplay = async (clientBot, card) => {
	const discordID = card.playerData?.discordID?.toString()
	if(/^\d{17,20}$/.test(discordID || "")) return await getUserDisplay(clientBot, discordID)
	return mentionSafety.escapeMarkdown(getCardPlayerName(card))
}

const parseColor = (color) => {
	const normalizedColor = color?.toString().replace("#", "")
	const parsedColor = Number.parseInt(normalizedColor, 16)
	return Number.isFinite(parsedColor) ? parsedColor : 0xD72306
}

const generateCardImage = async (clientBot, cardID) => {
	let card = await apiDB.getACardFromID(cardID)
	if(!card){
		throw new Error(`Carte ${cardID} introuvable.`)
	}

	const cardCanvas = Canvas.createCanvas(CARD_WIDTH, CARD_HEIGHT)
	const ctx = cardCanvas.getContext('2d')
	const member = await findPlayerMember(clientBot, card)
	const avatarURL = await getPlayerAvatarURL(clientBot, card, member)
	const avatar = await Canvas.loadImage(avatarURL)

	drawBlurredAvatarBackground(ctx, avatar)
	drawDiscordAvatar(ctx, avatar, card)
	await drawCardFrame(ctx, card)
	drawCardText(ctx, card, cardID, getRenderablePlayerName(card, member))

	return new AttachmentBuilder(cardCanvas.toBuffer('image/png'), { name: `card-${cardID}.png` })
}

const generateCardPreviewImage = async (clientBot, playerData, rarityName) => {
	const rarity = constants.RARITY_BY_NAME[rarityName]
	if(!rarity){
		throw new Error(`Rareté ${rarityName} introuvable.`)
	}

	const previewCard = {
		cardID: 'PREVIEW',
		playerID: playerData.playerID,
		rarity: rarity.name,
		rarityValue: rarity.maxValue,
		playerData
	}
	const cardCanvas = Canvas.createCanvas(CARD_WIDTH, CARD_HEIGHT)
	const ctx = cardCanvas.getContext('2d')
	const member = await findPlayerMember(clientBot, previewCard)
	const avatarURL = await getPlayerAvatarURL(clientBot, previewCard, member)
	const avatar = await Canvas.loadImage(avatarURL)

	drawBlurredAvatarBackground(ctx, avatar)
	drawDiscordAvatar(ctx, avatar, previewCard)
	await drawCardFrame(ctx, previewCard)
	drawCardText(ctx, previewCard, 'PREVIEW', getRenderablePlayerName(previewCard, member))

	const safeRarityName = rarity.name.replace(/[^a-z0-9_-]/gi, '-').toLowerCase()
	return new AttachmentBuilder(cardCanvas.toBuffer('image/png'), { name: `preview-${playerData.playerID}-${safeRarityName}.png` })
}

const drawCardFrame = async (ctx, card) => {
	const framePath = path.join(CARD_FRAMES_DIRECTORY, `${card.rarity}.png`)
	if(!fs.existsSync(framePath)){
		throw new Error(`Cadre introuvable pour la rareté ${card.rarity}: ${framePath}`)
	}

	const frame = await Canvas.loadImage(framePath)
	ctx.drawImage(frame, 0, 0, CARD_WIDTH, CARD_HEIGHT)
}

const drawBlurredAvatarBackground = (ctx, avatar) => {
	const x = MEMBER_IMAGE_X
	const y = MEMBER_IMAGE_Y
	const reducedCanvas = Canvas.createCanvas(BLURRED_BACKGROUND_WIDTH, BLURRED_BACKGROUND_HEIGHT)
	const reducedCtx = reducedCanvas.getContext('2d')

	reducedCtx.imageSmoothingEnabled = true
	reducedCtx.imageSmoothingQuality = 'high'
	reducedCtx.drawImage(avatar, 0, 0, BLURRED_BACKGROUND_WIDTH, BLURRED_BACKGROUND_HEIGHT)

	ctx.save()
	ctx.beginPath()
	ctx.rect(x, y, MEMBER_IMAGE_WIDTH, MEMBER_IMAGE_HEIGHT)
	ctx.clip()
	ctx.imageSmoothingEnabled = true
	ctx.imageSmoothingQuality = 'high'
	ctx.globalAlpha = 0.13

	const spread = 18
	for(const offsetX of [-spread, 0, spread]){
		for(const offsetY of [-spread, 0, spread]){
			ctx.drawImage(
				reducedCanvas,
				x + offsetX - spread,
				y + offsetY - spread,
				MEMBER_IMAGE_WIDTH + spread * 2,
				MEMBER_IMAGE_HEIGHT + spread * 2
			)
		}
	}

	ctx.globalAlpha = 1
	ctx.fillStyle = 'rgba(8, 8, 12, 0.18)'
	ctx.fillRect(x, y, MEMBER_IMAGE_WIDTH, MEMBER_IMAGE_HEIGHT)
	ctx.restore()
}

const drawDiscordAvatar = (ctx, avatar, card) => {
	const x = MEMBER_IMAGE_X + Math.round((MEMBER_IMAGE_WIDTH - DISCORD_AVATAR_SIZE) / 2)
	const y = MEMBER_IMAGE_Y + Math.round((MEMBER_IMAGE_HEIGHT - DISCORD_AVATAR_SIZE) / 2)

	ctx.save()
	ctx.beginPath()
	ctx.arc(x + DISCORD_AVATAR_SIZE / 2, y + DISCORD_AVATAR_SIZE / 2, DISCORD_AVATAR_SIZE / 2, 0, Math.PI * 2)
	ctx.clip()
	drawImageCover(ctx, avatar, x, y, DISCORD_AVATAR_SIZE, DISCORD_AVATAR_SIZE)
	ctx.restore()

	ctx.strokeStyle = getCardTextFillStyle(ctx, card, x, y, DISCORD_AVATAR_SIZE)
	ctx.lineWidth = 12
	ctx.beginPath()
	ctx.arc(x + DISCORD_AVATAR_SIZE / 2, y + DISCORD_AVATAR_SIZE / 2, DISCORD_AVATAR_SIZE / 2, 0, Math.PI * 2)
	ctx.stroke()
}

const drawCardText = (ctx, card, cardID, playerName = getRenderablePlayerName(card)) => {
	const pseudo = playerName.toLocaleUpperCase('fr-FR')
	setCardFont(ctx, fitFontSize(ctx, pseudo, 50, 26, 560))
	let x = 353 - ctx.measureText(pseudo).width / 2
	ctx.fillStyle = getCardTextFillStyle(ctx, card, x, 130, ctx.measureText(pseudo).width)
	ctx.fillText(pseudo, x, 180)

	ctx.font = '45px sans-serif'
	let rarityValueText = `${card.rarityValue.toString()}/${constants.MAXCARDVALUEOVERALL}`
	ctx.fillStyle = getCardStatsFillStyle(ctx, card, 50, 1110, 690)
	ctx.fillText(rarityValueText, 50, 1157)
	x = 740 - ctx.measureText(cardID.toString()).width - 10
	ctx.fillText(cardID.toString(), x, 1157)
}

const getCardTextFillStyle = (ctx, card, x, y, width) => {
	if(card.rarity == constants.SPECIALNAME){
		return getRainbowGradient(ctx, x, y, width)
	}
	return constants.PLAYERNAMECOLORDICO[card.rarity] || '#000000'
}

const getCardStatsFillStyle = (ctx, card, x, y, width) => {
	if(card.rarity == constants.SPECIALNAME){
		return getRainbowGradient(ctx, x, y, width)
	}
	return constants.CARDSTATSCOLORDICO[card.rarity] || '#3A3B3D'
}

const getRainbowGradient = (ctx, x, y, width) => {
	const gradient = ctx.createLinearGradient(x, y, x + Math.max(width, 1), y)
	gradient.addColorStop(0, '#FF4D4D')
	gradient.addColorStop(0.18, '#FFB000')
	gradient.addColorStop(0.36, '#45C94A')
	gradient.addColorStop(0.54, '#12BFCF')
	gradient.addColorStop(0.72, '#307CFF')
	gradient.addColorStop(0.9, '#A84DFF')
	gradient.addColorStop(1, '#FF4DCD')
	return gradient
}

const getPlayerAvatarURL = async (clientBot, card, resolvedMember = null) => {
	const emoteID = cardDisplay.getPlayerEmojiID(card)
	if(emoteID){
		return `https://cdn.discordapp.com/emojis/${emoteID}.png?size=512&quality=lossless`
	}

	const member = resolvedMember || await findPlayerMember(clientBot, card)
	if(member){
		return member.displayAvatarURL({ extension: 'png', size: 512, forceStatic: true })
	}

	return constants.DEFAULTCARDIMAGEURL
}

const getCardPlayerName = (card) => {
	return cardDisplay.getPlayerDisplayName(card)
}

const getPlayerMention = (card) => {
	const discordID = card.playerData?.discordID?.toString()
	return /^\d{17,20}$/.test(discordID || '') ? `<@${discordID}>` : null
}

const getRenderablePlayerName = (card, member = null) => {
	const liveDiscordName = member?.nickname
		|| member?.user?.username
		|| member?.user?.globalName
	const sourceName = liveDiscordName || getCardPlayerName(card) || `JOUEUR ${card.playerID ?? '?'}`
	const cleanedName = sourceName.toString()
		.normalize('NFKC')
		.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '')
		.replace(/\p{Extended_Pictographic}/gu, '')
		.replace(/[^\p{L}\p{N} ._'-]/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim()
	return cleanedName || `JOUEUR ${card.playerID ?? '?'}`
}

const setCardFont = (ctx, size) => {
	ctx.font = `bold ${size}px "${CARD_FONT_FAMILY}", "Segoe UI Symbol", sans-serif`
}

const fitFontSize = (ctx, text, maximumSize, minimumSize, maximumWidth) => {
	let size = maximumSize
	setCardFont(ctx, size)
	while(size > minimumSize && ctx.measureText(text).width > maximumWidth){
		size -= 2
		setCardFont(ctx, size)
	}
	return size
}

const findPlayerMember = async (clientBot, card) => {
	const guildID = apiDB.getCurrentGuildID() || clientBot.mainGuildID
	if(!guildID) return null
	const playerName = getCardPlayerName(card)

	try {
		const guild = await clientBot.guilds.fetch(guildID)
		if(card.playerData?.discordID){
			return await guild.members.fetch(card.playerData.discordID)
		}

		const members = await guild.members.fetch({ query: playerName, limit: 10 })
		const normalizedPlayerName = normalizeName(playerName)
		return members.find(member => {
			return normalizeName(member.displayName) == normalizedPlayerName
				|| normalizeName(member.nickname) == normalizedPlayerName
				|| normalizeName(member.user.username) == normalizedPlayerName
				|| normalizeName(member.user.globalName) == normalizedPlayerName
		}) || null
	} catch (error) {
		console.log(`Impossible de récupérer l'avatar Discord de ${playerName}: ${error.message}`)
		return null
	}
}

const normalizeName = (value) => {
	return (value || '').toString().trim().toLowerCase()
}

const drawImageCover = (ctx, image, x, y, width, height) => {
	const scale = Math.max(width / image.width, height / image.height)
	const drawWidth = image.width * scale
	const drawHeight = image.height * scale
	const drawX = x + (width - drawWidth) / 2
	const drawY = y + (height - drawHeight) / 2
	ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight)
}

const roundedRect = (ctx, x, y, width, height, radius) => {
	ctx.beginPath()
	ctx.moveTo(x + radius, y)
	ctx.lineTo(x + width - radius, y)
	ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
	ctx.lineTo(x + width, y + height - radius)
	ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
	ctx.lineTo(x + radius, y + height)
	ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
	ctx.lineTo(x, y + radius)
	ctx.quadraticCurveTo(x, y, x + radius, y)
	ctx.closePath()
}

const getCardImageStorageChannel = async (clientBot) => {
	const storageGuildID = await apiDB.getPersistentTextSetting(IMAGES_STORAGE_GUILD_SETTING, clientBot.imagesStorageGuildID || "")
	const storageChannelID = await apiDB.getPersistentTextSetting(IMAGES_STORAGE_CHANNEL_SETTING, clientBot.imagesStorageChannelID || "")

	if(!storageGuildID || !storageChannelID){
		throw new Error("Configure un salon de stockage avec /config ou renseigne IMAGES_STORAGE_GUILD_ID et IMAGES_STORAGE_CHANNEL_ID dans .env")
	}

	try {
		const storageGuild = await clientBot.guilds.fetch(storageGuildID.toString())
		if(!storageGuild?.channels?.fetch){
			throw new Error(`serveur ${storageGuildID} introuvable ou inaccessible`)
		}

		const storageChannel = await storageGuild.channels.fetch(storageChannelID.toString())
		if(!storageChannel?.send){
			throw new Error(`salon ${storageChannelID} introuvable, inaccessible ou non textuel`)
		}

		return storageChannel
	} catch(error) {
		throw new Error(`Salon de stockage des images inaccessible. Reconfigure-le avec /config. Détail : ${error.message}`)
	}
}

const updateCardImageURL = async (clientBot, cardID, storageChannel = null) => {
	storageChannel = storageChannel || await getCardImageStorageChannel(clientBot)

	let cardImage = await generateCardImage(clientBot, cardID)
	console.log("Image pour la carte " + cardID.toString() + " générée " + Date.now().toString())
	let message = await storageChannel.send({files: [cardImage]})
	console.log("Message pour la carte " + cardID.toString() + " envoyé " + Date.now().toString())
	let imgUrl = message.attachments.first().url
    console.log("Lien pour la carte " + cardID.toString() + " récupéré " + Date.now().toString())

	await apiDB.setCardImageURL(cardID, imgUrl)
}

module.exports = {
	CARD_WIDTH,
	CARD_HEIGHT,
	MEMBER_IMAGE_WIDTH,
	MEMBER_IMAGE_HEIGHT,
	DISCORD_AVATAR_SIZE,
    getCardEmbed,
	getCardReply,
	getCardContainer,
	generateCardImage,
	generateCardPreviewImage,
	getRenderablePlayerName,
	getCardImageStorageChannel,
	updateCardImageURL
};
