const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const Canvas = require('canvas');
const fs = require('node:fs');
const path = require('node:path');

const apiDB = require("./apiDB");
const constants = require("../data/constants.js");
const cardDisplay = require("./cardDisplay");

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

const getCardEmbed = async (clientBot, cardID) => {
    let card = await apiDB.getACardFromID(cardID)
	if(!card){
		throw new Error(`Carte ${cardID} introuvable.`)
	}

	const playerName = getCardPlayerName(card)
	const playerID = card.playerID ?? "?"
	const playerMention = getPlayerMention(card)

	let creatorUser = card.creatorID == "" ? "Aucun" : clientBot.users.fetch(card.creatorID)
	let ownerUser = card.ownerID == "" ? "Aucun" : clientBot.users.fetch(card.ownerID)

	let cardEmbed = new EmbedBuilder()
	.setColor(card.embedColor)
	.setTitle(`Carte numéro ${cardID}`)
	.setImage(card.imageURL)
    .addFields(
	{
		name: "Joueur :",
		value: playerMention ? `${playerMention} (joueur ${playerID})` : `${playerName} (joueur ${playerID})`,
		inline: true
	},
	{
		name: "Rareté :",
		value: `${card.rarity} (${card.rarityValue})`,
		inline: true
	},
	{
		name: "Créateur :",
		value: ` ${await creatorUser}`,
		inline: true
	},
	{
		name: "Possesseur :",
		value: ` ${await ownerUser}`,
		inline: true
	},
	{
		name: `Statut :`,
		value: card.locked ? "Verrouillée" : "Déverrouillée",
		inline: true
	}
	)
    .setTimestamp()
    .setFooter({ text: `Carte créée le ${new Date(card.creationStamp).toLocaleDateString("fr-FR")}`});

    return cardEmbed
}

const generateCardImage = async (clientBot, cardID) => {
	let card = await apiDB.getACardFromID(cardID)
	if(!card){
		throw new Error(`Carte ${cardID} introuvable.`)
	}

	const cardCanvas = Canvas.createCanvas(CARD_WIDTH, CARD_HEIGHT)
	const ctx = cardCanvas.getContext('2d')
	const avatarURL = await getPlayerAvatarURL(clientBot, card)
	const avatar = await Canvas.loadImage(avatarURL)

	await drawCardFrame(ctx, card)
	drawBlurredAvatarBackground(ctx, avatar)
	drawDiscordAvatar(ctx, avatar, card)
	drawCardText(ctx, card, cardID)

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
	const avatarURL = await getPlayerAvatarURL(clientBot, previewCard)
	const avatar = await Canvas.loadImage(avatarURL)

	await drawCardFrame(ctx, previewCard)
	drawBlurredAvatarBackground(ctx, avatar)
	drawDiscordAvatar(ctx, avatar, previewCard)
	drawCardText(ctx, previewCard, 'PREVIEW')

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

const drawCardText = (ctx, card, cardID) => {
	const pseudo = getRenderablePlayerName(card).toUpperCase()
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

const getPlayerAvatarURL = async (clientBot, card) => {
	const emoteID = cardDisplay.getPlayerEmojiID(card)
	if(emoteID){
		return `https://cdn.discordapp.com/emojis/${emoteID}.png?size=512&quality=lossless`
	}

	const member = await findPlayerMember(clientBot, card)
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

const getRenderablePlayerName = (card) => {
	const playerName = getCardPlayerName(card).toString().normalize('NFKC')
	const cleanedName = playerName.replace(/[\u200B-\u200D\uFEFF]/g, '').trim()
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

const updateCardImageURL = async (clientBot, cardID) => {
	if(!clientBot.imagesStorageGuildID || !clientBot.imagesStorageChannelID){
		throw new Error("IMAGES_STORAGE_GUILD_ID et IMAGES_STORAGE_CHANNEL_ID doivent être renseignés dans .env")
	}

	let storageGuild = await clientBot.guilds.fetch(clientBot.imagesStorageGuildID)
	let storageChannel = await storageGuild.channels.fetch(clientBot.imagesStorageChannelID)

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
	generateCardImage,
	generateCardPreviewImage,
	updateCardImageURL
};
