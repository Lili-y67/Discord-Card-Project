const constants = require("../data/constants.js")
const path = require('node:path');
const fs = require('node:fs');
const { AsyncLocalStorage } = require('node:async_hooks');

const SQP = require("../functions/sqlite3-promisify");


const legacyDBPath = path.join(__dirname, '../data/blitzcordDB.db');
const guildsDBDirectory = path.join(__dirname, '../data/guilds');
const mainGuildID = process.env.GUILD_ID;
const guildDBContext = new AsyncLocalStorage();
const dbCache = new Map();
const schemaReady = new Set();

const getSafeGuildID = (guildID) => {
    const stringGuildID = guildID?.toString();
    return /^\d{17,20}$/.test(stringGuildID || '') ? stringGuildID : null;
}

const getCurrentGuildID = () => {
    return getSafeGuildID(guildDBContext.getStore()?.guildID);
}

const withGuild = async (guildID, operation) => {
    const safeGuildID = getSafeGuildID(guildID);
    return guildDBContext.run({ guildID: safeGuildID }, operation);
}

const getDBPathForGuild = (guildID = getCurrentGuildID()) => {
    const safeGuildID = getSafeGuildID(guildID);
    if(!safeGuildID) return legacyDBPath;
    return path.join(guildsDBDirectory, `${safeGuildID}.db`);
}

const prepareGuildDBFile = (guildID, guildDBPath) => {
    fs.mkdirSync(path.dirname(guildDBPath), { recursive: true });
    if(guildID == mainGuildID && !fs.existsSync(guildDBPath) && fs.existsSync(legacyDBPath) && fs.statSync(legacyDBPath).size > 0){
        fs.copyFileSync(legacyDBPath, guildDBPath);
        console.log(`Base principale migrée vers ${guildDBPath}`);
    }
}

const getDBForGuild = (guildID = getCurrentGuildID()) => {
    const safeGuildID = getSafeGuildID(guildID);
    const currentDBPath = getDBPathForGuild(safeGuildID);
    if(!dbCache.has(currentDBPath)){
        prepareGuildDBFile(safeGuildID, currentDBPath);
        dbCache.set(currentDBPath, new SQP(currentDBPath));
    }
    return dbCache.get(currentDBPath);
}

const DB = {
    get: (...args) => getDBForGuild().get(...args),
    all: (...args) => getDBForGuild().all(...args),
    run: (...args) => getDBForGuild().run(...args),
    serialize: (...args) => getDBForGuild().serialize(...args),
    close: (...args) => getDBForGuild().close(...args)
}

const usersDataTB = "usersData"
const cardsDataTB = "cardsData"
const otherTB = "other"
const playersDataTB = "playersData"
const questUserStatsTB = "questUserStats"
const questDailyProgressTB = "questDailyProgress"
const dropsTB = "drops"
const dropClaimsTB = "dropClaims"
const sqliteSequence = "sqlite_sequence"
const TEXT_SETTING_PREFIX = "__text__:"
const legacyRarityMap = {
    Commune: constants.COMMONNAME,
    Glitched: constants.ERRORCODENAME,
    Parfaite: constants.SPECIALNAME
}

const ensureDatabaseSchema = async () => {
    const schemaKey = getDBPathForGuild()
    if(schemaReady.has(schemaKey)) return

    await DB.run(`CREATE TABLE IF NOT EXISTS "${usersDataTB}"(
        "discordID" TEXT NOT NULL UNIQUE,
        "name" TEXT,
        "money" INTEGER DEFAULT 0,
        "creationStamp" INTEGER,
        "lastQuickPick" TEXT,
        "lastDailyPick" TEXT,
        "wantNotifications" INTEGER,
        "notificationsChannel" TEXT,
        "gotNotificationYet" INTEGER,
        "rankID" INTEGER,
        "cardPoints" INTEGER,
        "dailyCount" INTEGER DEFAULT 0,
        PRIMARY KEY("discordID")
    )`)

    await DB.run(`CREATE TABLE IF NOT EXISTS "${cardsDataTB}" (
        "cardID" INTEGER NOT NULL UNIQUE,
        "playerID" INTEGER,
        "playerDiscordID" TEXT,
        "playerNameSnapshot" TEXT,
        "rarityValue" INTEGER,
        "rarity" TEXT,
        "creatorID" TEXT,
        "creationStamp" INTEGER,
        "ownerID" TEXT,
        "lastOwnerChangeStamp" INTEGER,
        "imageURL" TEXT,
        "embedColor" TEXT,
        "locked" INTEGER DEFAULT 0,
        "userLocked" INTEGER DEFAULT 0,
        PRIMARY KEY("cardID" AUTOINCREMENT)
    )`)

    await DB.run(`CREATE TABLE IF NOT EXISTS "${otherTB}" (
        "dataName" TEXT,
        "data" INTEGER
    )`)

    await DB.run(`CREATE TABLE IF NOT EXISTS "${playersDataTB}" (
        "playerID" INTEGER NOT NULL UNIQUE,
        "discordID" TEXT,
        "playerName" TEXT,
        "playerEmote" TEXT,
        "active" INTEGER DEFAULT 1,
        PRIMARY KEY("playerID" AUTOINCREMENT)
    )`)

    await DB.run(`CREATE TABLE IF NOT EXISTS "${questUserStatsTB}" (
        "discordID" TEXT NOT NULL UNIQUE,
        "xp" INTEGER DEFAULT 0,
        "level" INTEGER DEFAULT 1,
        "totalMessages" INTEGER DEFAULT 0,
        "lastMessageXpStamp" INTEGER DEFAULT 0,
        "lastQuestMessageStamp" INTEGER DEFAULT 0,
        "wheelTickets" INTEGER DEFAULT 0,
        "pickBoostUntil" INTEGER DEFAULT 0,
        "pickBoostMultiplier" REAL DEFAULT 1,
        PRIMARY KEY("discordID")
    )`)

    await DB.run(`CREATE TABLE IF NOT EXISTS "${questDailyProgressTB}" (
        "discordID" TEXT NOT NULL,
        "questDate" TEXT NOT NULL,
        "questID" TEXT NOT NULL,
        "progress" INTEGER DEFAULT 0,
        "completed" INTEGER DEFAULT 0,
        "claimed" INTEGER DEFAULT 0,
        PRIMARY KEY("discordID", "questDate", "questID")
    )`)

    await DB.run(`CREATE TABLE IF NOT EXISTS "${dropsTB}" (
        "dropID" TEXT NOT NULL UNIQUE,
        "type" TEXT NOT NULL,
        "creatorID" TEXT NOT NULL,
        "title" TEXT,
        "description" TEXT,
        "amount" INTEGER DEFAULT 0,
        "playerID" INTEGER,
        "rarity" TEXT,
        "copies" INTEGER DEFAULT 1,
        "maxWinners" INTEGER DEFAULT 1,
        "expiresAt" INTEGER NOT NULL,
        "status" TEXT DEFAULT 'open',
        PRIMARY KEY("dropID")
    )`)
    await DB.run(`CREATE TABLE IF NOT EXISTS "${dropClaimsTB}" (
        "dropID" TEXT NOT NULL,
        "userID" TEXT NOT NULL,
        "claimedStamp" INTEGER NOT NULL,
        PRIMARY KEY("dropID", "userID")
    )`)

    await addColumnIfMissing(questUserStatsTB, "lastQuestMessageStamp", "INTEGER DEFAULT 0")
    await addColumnIfMissing(questUserStatsTB, "pickBoostUntil", "INTEGER DEFAULT 0")
    await addColumnIfMissing(questUserStatsTB, "pickBoostMultiplier", "REAL DEFAULT 1")
    await addColumnIfMissing(usersDataTB, "dailyCount", "INTEGER DEFAULT 0")
    await addColumnIfMissing(cardsDataTB, "playerDiscordID", "TEXT")
    await addColumnIfMissing(cardsDataTB, "playerNameSnapshot", "TEXT")
    await addColumnIfMissing(playersDataTB, "active", "INTEGER DEFAULT 1")
    await addColumnIfMissing(dropsTB, "title", "TEXT")
    await addColumnIfMissing(dropsTB, "description", "TEXT")
    await DB.run(`UPDATE ${cardsDataTB}
        SET playerDiscordID = (SELECT discordID FROM ${playersDataTB} WHERE playersData.playerID = cardsData.playerID)
        WHERE playerDiscordID IS NULL`)
    await DB.run(`UPDATE ${cardsDataTB}
        SET playerNameSnapshot = (SELECT playerName FROM ${playersDataTB} WHERE playersData.playerID = cardsData.playerID)
        WHERE playerNameSnapshot IS NULL`)
    schemaReady.add(schemaKey)
}

const addColumnIfMissing = async (tableName, columnName, definition) => {
    const columns = await DB.all(`PRAGMA table_info("${tableName}")`)
    if(columns.some(column => column.name == columnName)) return
    await DB.run(`ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${definition}`)
}


//cards managements<

const createACard = async (playerID, rarity, rarityValue, creatorID) => {
    const embedColor = constants.CARDSTATSCOLORDICO[rarity] || constants.DEFAULTCARDEMBEDCOLOR
    const playerData = await getPlayerDataFromID(playerID)
    let createACardQuery = `INSERT INTO ${cardsDataTB} (playerID, playerDiscordID, playerNameSnapshot, rarityValue, rarity, creatorID, creationStamp, ownerID, lastOwnerChangeStamp, imageURL, embedColor, locked, userLocked) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`
    await DB.run(createACardQuery, [playerID, playerData?.discordID || null, playerData?.playerName || null, rarityValue, rarity, creatorID, Date.now(), creatorID, Date.now(), constants.DEFAULTCARDIMAGEURL, embedColor, 0, 0])
    let requestLastCardQuery = `SELECT seq FROM ${sqliteSequence} WHERE name='cardsData'`
    return (await DB.get(requestLastCardQuery)).seq
}


const isCardRegistered = async (cardID) => {
    let isCardRegisteredQuery = `SELECT cardID FROM ${cardsDataTB} WHERE cardID=${cardID.toString()}`
    return await DB.get(isCardRegisteredQuery) ? true : false
}

const getACardFromID = async (cardID) => {
    let getCardQuery = `SELECT * FROM ${cardsDataTB} WHERE cardID=${cardID.toString()}`

    let resp = await DB.get(getCardQuery)
    if(!resp) return null
    normalizeCardRarity(resp)
    resp.playerData = await getCardPlayerData(resp)
    return resp
}

const hydrateCardsWithPlayerData = async (cards) => {
    for(const card of cards){
        normalizeCardRarity(card)
        card.playerData = await getCardPlayerData(card)
    }
    return cards
}

const getCardPlayerData = async card => {
    const currentPlayer = await getPlayerDataFromID(card.playerID)
    return {
        ...currentPlayer,
        playerID: card.playerID,
        discordID: card.playerDiscordID || currentPlayer?.discordID || null,
        playerName: card.playerNameSnapshot || currentPlayer?.playerName || `Joueur ${card.playerID}`
    }
}

const normalizeCardRarity = (card) => {
    if(card?.rarity && legacyRarityMap[card.rarity]){
        card.rarity = legacyRarityMap[card.rarity]
    }
    return card
}

const getCardsFromOwnerID = async (discordID, args={filter:"lastCardOwnerChangeTime", ascendant:false}) => {
    let baseQuery = `SELECT * FROM ${cardsDataTB} WHERE ownerID = ?`

    switch (args.filter?.toUpperCase()) {
        case "PLAYERID":
            baseQuery = baseQuery + ` ORDER BY playerID`
            break;
        case "CARDID":
            baseQuery = baseQuery + ` ORDER BY cardID`
            break;
        case "RARITY":
            baseQuery = baseQuery + ` ORDER BY rarityValue`
            break;
        default:
            baseQuery = baseQuery + ` ORDER BY lastOwnerChangeStamp`
            break;
    }

    if(!args.ascendant) baseQuery = baseQuery + ` DESC`

    const cards = await DB.all(baseQuery, [discordID.toString()])
    return hydrateCardsWithPlayerData(cards)
}

const getRegisteredCards = async (args={filter:"cardID", ascendant:true}) => {
    let baseQuery = `SELECT * FROM ${cardsDataTB}`

    switch (args.filter?.toUpperCase()) {
        case "RARITY":
            baseQuery = baseQuery + ` ORDER BY rarityValue`
            break;
        case "PLAYERID":
            baseQuery = baseQuery + ` ORDER BY playerID`
            break;
        default:
            baseQuery = baseQuery + ` ORDER BY cardID`
            break;
    }

    if(!args.ascendant) baseQuery = baseQuery + ` DESC`

    const cards = await DB.all(baseQuery)
    return hydrateCardsWithPlayerData(cards)
}

const getOwnerOfACard = async (cardID) => {
    let getOwnerOfACardQuery = `SELECT ownerID FROM ${cardsDataTB} WHERE cardID=${cardID.toString()}`
    return (await DB.get(getOwnerOfACardQuery)).ownerID
}

const setCardImageURL = async (cardID, imageURL) => {
    let setCardImageURLQuery = `UPDATE ${cardsDataTB} SET 'imageURL' = '${imageURL}' WHERE cardID=${cardID.toString()}`
    await DB.run(setCardImageURLQuery)
}

const changeCardOwnership = async (cardID, newOwnerID) => {
    await setCardOwnerID(cardID, newOwnerID)
    await updateLastCardOwnerChangeTime(cardID)
}

const bulkChangeCardOwnership = async (cardsIDList, newOwnerID) => {

    if(!cardsIDList.length) return;
    const placeholders = cardsIDList.map(() => "?").join(", ")
    await DB.run(
        `UPDATE ${cardsDataTB} SET ownerID = ?, lastOwnerChangeStamp = ? WHERE cardID IN (${placeholders})`,
        [newOwnerID.toString(), Date.now(), ...cardsIDList]
    )
}

const setCardOwnerID = async (cardID, newOwnerID) => {
    await DB.run(`UPDATE ${cardsDataTB} SET ownerID = ? WHERE cardID = ?`, [newOwnerID.toString(), cardID])
}

const updateLastCardOwnerChangeTime = async (cardID) => {
    let updateLastCardOwnerChangeTimeQuery = `UPDATE ${cardsDataTB} SET 'lastOwnerChangeStamp' = ${Date.now().toString()} WHERE cardID=${cardID.toString()}`
    await DB.run(updateLastCardOwnerChangeTimeQuery)
}

const doesUserOwnThisCard = async (cardID, discordID) => {
    return (await DB.get(`SELECT cardID FROM ${cardsDataTB} WHERE cardID = ? AND ownerID = ?`, [cardID, discordID.toString()])) ? true : false
}

const lockACard = async (cardID) => {
    let lockACardQuery = `UPDATE ${cardsDataTB} SET 'locked' = 1 WHERE cardID=${cardID.toString()}`
    await DB.run(lockACardQuery)
}

const bulkLock = async (cardsIDList) => {

    if(!cardsIDList.length) return;

    let bulkLockQuery = `UPDATE cardsData SET 'locked' = 1 WHERE cardID=${cardsIDList[0]}`

    for(let cardIndex = 1; cardIndex<cardsIDList.length; cardIndex++){
        bulkLockQuery = bulkLockQuery + ` OR cardID=${cardsIDList[cardIndex]}`
    }

    await DB.run(bulkLockQuery)
}

const unlockACard = async (cardID) => {
    let unlockACardQuery = `UPDATE ${cardsDataTB} SET 'locked' = 0 WHERE cardID=${cardID.toString()}`
    await DB.run(unlockACardQuery)
}

const bulkUnlock = async (cardsIDList) => {

    if(!cardsIDList.length) return;

    let bulkUnlockQuery = `UPDATE cardsData SET 'locked' = 0 WHERE cardID=${cardsIDList[0]}`

    for(let cardIndex = 1; cardIndex<cardsIDList.length; cardIndex++){
        bulkUnlockQuery = bulkUnlockQuery + ` OR cardID=${cardsIDList[cardIndex]}`
    }

    await DB.run(bulkUnlockQuery)
}

const isACardLocked = async (cardID) => {
    let isACardLockedQuery = `SELECT locked FROM ${cardsDataTB} WHERE cardID=${cardID.toString()}`
    return (await DB.get(isACardLockedQuery)).locked ? true : false
}

const bulkIsACardLocked = async (cardsIDList) => { //renvoie true si au moins une des cartes est lock
    if(!cardsIDList.length) return false

    let bulkIsACardLockedQuery = `SELECT locked FROM ${cardsDataTB} WHERE cardID=${cardsIDList[0]}`

    for(let cardIndex = 1; cardIndex<cardsIDList.length; cardIndex++){
        bulkIsACardLockedQuery = bulkIsACardLockedQuery + ` OR cardID=${cardsIDList[cardIndex]}`
    }

    let DBresp = await DB.all(bulkIsACardLockedQuery)

    for(let respIndex = 0; respIndex<DBresp.length; respIndex++){
        if(DBresp[respIndex].locked) return true
    }
    return false
}

const setCardEmbedColorCode = async (cardID, colorCode) => {
    let setCardEmbedColorCodeQuery = `UPDATE ${cardsDataTB} SET 'embedColor' = '${colorCode}' WHERE cardID=${cardID.toString()}`
    await DB.run(setCardEmbedColorCodeQuery)
}

const getCardsIDListHUB = async (args={ownerID:false, creatorID:false, excludedUserID:false, playerID:false, rarity:false, includesSold:false, filter:"lastCardOwnerChangeTime", ascendant:true}) => {   //centre de recherche de cartes dans la DB


    let baseQuery = `SELECT cardID FROM ${cardsDataTB}`

    let isThereAWhere = false
    if(args.ownerID){
        if(args.ownerID==constants.CLIENTID) args.includesSold = true
        if(args.ownerID==args.excludedUserID) args.excludedUserID = false
        baseQuery = isThereAWhere ? baseQuery + ` AND ownerID='${args.ownerID.toString()}'` : baseQuery + ` WHERE ownerID='${args.ownerID.toString()}'`
        isThereAWhere = true
    }

    if(args.creatorID){
        baseQuery = isThereAWhere ? baseQuery + ` AND creatorID='${args.creatorID.toString()}'` : baseQuery + ` WHERE creatorID='${args.creatorID.toString()}'`
        isThereAWhere = true
    }

    if(args.excludedUserID){
        baseQuery = isThereAWhere ? baseQuery + ` AND ownerID <> '${args.excludedUserID.toString()}'` : baseQuery + ` WHERE ownerID <> '${args.excludedUserID.toString()}'`
        isThereAWhere = true
    }

    if(args.playerID){
        baseQuery = isThereAWhere ? baseQuery + ` AND playerID=${args.playerID}` : baseQuery + ` WHERE playerID=${args.playerID}`
        isThereAWhere = true
    }

    if(args?.rarity){
        baseQuery = isThereAWhere ? baseQuery + ` AND rarity='${args.rarity}'` : baseQuery + ` WHERE rarity='${args.rarity}'`
        isThereAWhere = true
    }

    if(!args.includesSold){
        baseQuery = isThereAWhere ? baseQuery + ` AND ownerID <> '${constants.CLIENTID}'` : baseQuery + ` WHERE ownerID <> '${constants.CLIENTID}'`
        isThereAWhere = true
    }

    switch (args.filter?.toUpperCase()) {
        case "PLAYERID":
            baseQuery = baseQuery + ` ORDER BY playerID`
            break;
        case "CARDID":
            baseQuery = baseQuery + ` ORDER BY cardID`
            break;
        case "RARITY":
            baseQuery = baseQuery + ` ORDER BY rarityValue`
            break;
        default:
            baseQuery = baseQuery + ` ORDER BY lastOwnerChangeStamp`
            break;
    }

    if(!args.ascendant) baseQuery = baseQuery + ` DESC`


    let respDB = await DB.all(baseQuery)
    let cardsIDList = []
    for(let respIndex = 0; respIndex<respDB.length; respIndex++){
        cardsIDList.push(respDB[respIndex].cardID)
    }
    return cardsIDList
}

const getDistinctPlayerIDAndRarityInUserInventory = async (discordID) => {
    const cards = await DB.all(`SELECT playerID, rarity, COUNT(*) AS copies FROM ${cardsDataTB}
        WHERE ownerID = ? GROUP BY playerID, rarity`, [discordID.toString()])
    return cards.map(normalizeCardRarity)
}

const getPickedCardsNumberOfAUser = async (discordID) => {
    const row = await DB.get(`SELECT COUNT(*) AS total FROM ${cardsDataTB} WHERE creatorID = ?`, [discordID.toString()])
    return Number(row?.total) || 0
}

const getOwnedCardsNumberOfAUser = async (discordID) => {
    const row = await DB.get(`SELECT COUNT(*) AS total FROM ${cardsDataTB} WHERE ownerID = ?`, [discordID.toString()])
    return Number(row?.total) || 0
}

const editACard = async (cardID, args={rarityValue:false, rarity:false, playerID:false}) => {

    let editACardQuery = `UPDATE ${cardsDataTB}` + (!(args.rarityValue===false) || (!(args.rarity===false) || !(args.playerID===false)) ? ` SET ` : ``) + (!(args.rarityValue===false) ? `'rarityValue' = ${args.rarityValue}` : ``) + (!(args.rarityValue===false) && (!(args.rarity===false) || !(args.playerID===false)) ? `,` : ``) + (!(args.rarity===false) ? `'rarity' = '${args.rarity}'` : ``) + (!(args.rarity===false) && !(args.playerID===false) ? `,` : ``) + (!(args.playerID===false) ? `'playerID' = ${args.playerID}` : ``) + ` WHERE cardID=${cardID}`

    await DB.run(editACardQuery)
    if(!(args.playerID === false)){
        const playerData = await getPlayerDataFromID(args.playerID)
        await DB.run(`UPDATE ${cardsDataTB} SET playerDiscordID = ?, playerNameSnapshot = ? WHERE cardID = ?`, [
            playerData?.discordID || null,
            playerData?.playerName || `Joueur ${args.playerID}`,
            cardID
        ])
    }
}


//>cards managements






//playersNames<

const getPlayerDataFromID = async (playerID) => {
    let getPlayerDataFromIDQuery = `SELECT * FROM ${playersDataTB} WHERE playerID=${playerID.toString()}`
    const playerData = await DB.get(getPlayerDataFromIDQuery)
    return playerData || {
        playerID,
        discordID: null,
        playerName: `Joueur ${playerID}`,
        playerEmote: null
    }
}

const getGuildPlayersList = async () => {
    return await DB.all(
        `SELECT * FROM ${playersDataTB}
         WHERE discordID IS NOT NULL AND COALESCE(active, 1) = 1
         ORDER BY playerName COLLATE NOCASE, playerID`
    )
}

const getRandomPickablePlayerID = async () => {
    const row = await DB.get(
        `SELECT playerID FROM ${playersDataTB}
         WHERE discordID IS NOT NULL AND COALESCE(active, 1) = 1
         ORDER BY RANDOM()
         LIMIT 1`
    )
    return row ? row.playerID : 0
}

const findPlayerData = async (query) => {
    const normalized = query?.toString().trim()
    if(!normalized) return null
    if(/^\d+$/.test(normalized)){
        const byID = await DB.get(`SELECT * FROM ${playersDataTB} WHERE playerID = ? OR discordID = ? LIMIT 1`, [Number(normalized), normalized])
        if(byID) return byID
    }
    return await DB.get(`SELECT * FROM ${playersDataTB} WHERE playerName LIKE ? COLLATE NOCASE ORDER BY playerName LIMIT 1`, [`%${normalized}%`])
}

const createDrop = async (drop) => {
    await ensureDatabaseSchema()
    await DB.run(`INSERT INTO ${dropsTB} (dropID, type, creatorID, title, description, amount, playerID, rarity, copies, maxWinners, expiresAt, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')`, [drop.dropID, drop.type, drop.creatorID, drop.title || null, drop.description || null, drop.amount || 0, drop.playerID || null, drop.rarity || null, drop.copies || 1, drop.maxWinners, drop.expiresAt])
}

const getDrop = async (dropID) => {
    await ensureDatabaseSchema()
    return await DB.get(`SELECT * FROM ${dropsTB} WHERE dropID = ?`, [dropID])
}

const getDropClaims = async (dropID) => {
    await ensureDatabaseSchema()
    return await DB.all(`SELECT * FROM ${dropClaimsTB} WHERE dropID = ? ORDER BY claimedStamp`, [dropID])
}

const claimDropSlot = async (dropID, userID) => {
    await ensureDatabaseSchema()
    const token = Date.now() * 1000 + Math.floor(Math.random() * 1000)
    await DB.run(`INSERT OR IGNORE INTO ${dropClaimsTB} (dropID, userID, claimedStamp)
        SELECT d.dropID, ?, ? FROM ${dropsTB} d
        WHERE d.dropID = ? AND d.status = 'open' AND d.expiresAt > ?
          AND (SELECT COUNT(*) FROM ${dropClaimsTB} c WHERE c.dropID = d.dropID) < d.maxWinners`,
        [userID.toString(), token, dropID, Date.now()])
    const claim = await DB.get(`SELECT claimedStamp FROM ${dropClaimsTB} WHERE dropID = ? AND userID = ?`, [dropID, userID.toString()])
    const drop = await getDrop(dropID)
    const claims = await getDropClaims(dropID)
    if(drop && claims.length >= drop.maxWinners) await DB.run(`UPDATE ${dropsTB} SET status = 'complete' WHERE dropID = ?`, [dropID])
    return { won: claim?.claimedStamp === token, alreadyClaimed: Boolean(claim) && claim.claimedStamp !== token, drop, claims }
}

const releaseDropClaim = async (dropID, userID) => {
    await DB.run(`DELETE FROM ${dropClaimsTB} WHERE dropID = ? AND userID = ?`, [dropID, userID.toString()])
    await DB.run(`UPDATE ${dropsTB} SET status = 'open' WHERE dropID = ?`, [dropID])
}

const expireDrop = async dropID => {
    await ensureDatabaseSchema()
    await DB.run(`UPDATE ${dropsTB} SET status = 'expired' WHERE dropID = ? AND status = 'open'`, [dropID])
}

//>playersNames



//money managements<

const addMoneyToUser = async (discordID, amount) => {
    let addMoneyToUserQuery = `UPDATE ${usersDataTB} SET 'money' = money + ${amount} WHERE discordID = '${discordID.toString()}'`
    await DB.run(addMoneyToUserQuery)
}

const subMoneyToUser = async (discordID, amount) => {
    let subMoneyToUserQuery = `UPDATE ${usersDataTB} SET 'money' = money - ${amount} WHERE discordID = '${discordID.toString()}'`
    await DB.run(subMoneyToUserQuery)
}

const setMoneyForUser = async (discordID, money) => {
    let setMoneyForUserQuery = `UPDATE ${usersDataTB} SET 'money' = ${money} WHERE discordID = '${discordID.toString()}'`
    await DB.run(setMoneyForUserQuery)
}

const getMoneyOfUser = async (discordID) => {
    let getMoneyOfUserQuery = `SELECT money FROM ${usersDataTB} WHERE discordID='${discordID}'`
    return (await DB.get(getMoneyOfUserQuery)).money
}

const hasEnoughMoney = async (discordID, amount) => {
    return amount <= await getMoneyOfUser(discordID)
}

const getBaltopRowsList = async() => {
    let getBaltopRowsListQuery = `SELECT discordID, name, money FROM ${usersDataTB} ORDER BY money DESC`
    return await DB.all(getBaltopRowsListQuery)
}

//>money managements


//cardPoints managements<

const addPointsToUser = async (discordID, amount) => {
    let addPointsToUserQuery = `UPDATE ${usersDataTB} SET 'cardPoints' = cardPoints + ${amount} WHERE discordID = '${discordID.toString()}'`
    await DB.run(addPointsToUserQuery)
}

const subPointsToUser = async (discordID, amount) => {
    let subPointsToUserQuery = `UPDATE ${usersDataTB} SET 'cardPoints' = cardPoints - ${amount} WHERE discordID = '${discordID.toString()}'`
    await DB.run(subPointsToUserQuery)
}

const getCardPointsOfUser = async (discordID) => {
    let getCardPointsOfUserQuery = `SELECT cardPoints FROM ${usersDataTB} WHERE discordID='${discordID}'`
    return (await DB.get(getCardPointsOfUserQuery)).cardPoints
}

const hasEnoughCardPoints = async (discordID, amount) => {
    return amount <= await getCardPointsOfUser(discordID)
}

const getCardPointstopRowsList = async() => {
    let getCardPointstopRowsListQuery = `SELECT discordID, name, cardPoints FROM ${usersDataTB} ORDER BY cardPoints DESC`
    return await DB.all(getCardPointstopRowsListQuery)
}

const getOwnedCardTopRowsList = async() => {
    return await DB.all(`SELECT u.discordID, u.name, COUNT(c.cardID) AS ownedCards
        FROM ${usersDataTB} u LEFT JOIN ${cardsDataTB} c ON c.ownerID = u.discordID
        GROUP BY u.discordID, u.name ORDER BY ownedCards DESC, u.name COLLATE NOCASE`)
}

const getPickTopRowsList = async() => {
    return await DB.all(`SELECT u.discordID, u.name, COUNT(c.cardID) AS pickCount
        FROM ${usersDataTB} u LEFT JOIN ${cardsDataTB} c ON c.creatorID = u.discordID
        GROUP BY u.discordID, u.name ORDER BY pickCount DESC, u.name COLLATE NOCASE`)
}

const getDailyTopRowsList = async() => {
    return await DB.all(`SELECT discordID, name, COALESCE(dailyCount, 0) AS dailyCount
        FROM ${usersDataTB} ORDER BY dailyCount DESC, name COLLATE NOCASE`)
}

const incrementDailyCount = async (discordID) => {
    await DB.run(`UPDATE ${usersDataTB} SET dailyCount = COALESCE(dailyCount, 0) + 1 WHERE discordID = ?`, [discordID.toString()])
}

//>cardPoints managements




//user managements<


const createAUser = async (discordID, name) => {
    let createAUserQuery = `INSERT INTO ${usersDataTB} (discordID, name, money, creationStamp, lastQuickPick, lastDailyPick, wantNotifications, notificationsChannel, gotNotificationYet, rankID, cardPoints) VALUES(?,?,?,?,?,?,?,?,?,?,?)`
    await DB.run(createAUserQuery, [discordID, name, 0, Date.now(), "0", "0", constants.DEFAULTWANTNOTIFICATION, "reload", 0, 1, 0])
}

const getAUserFromDiscordID = async (discordID) => {
    return await DB.get(`SELECT * FROM ${usersDataTB} WHERE discordID = ?`, [discordID.toString()])
}

const isUserRegistered = async (discordID) => {
    let isUserRegisteredQuery = `SELECT discordID FROM ${usersDataTB} WHERE discordID='${discordID.toString()}'`
    return await DB.get(isUserRegisteredQuery) ? true : false
}

const prepareUser = async (discordID, name) => {
    await ensureDatabaseSchema()
    if(!(await isUserRegistered(discordID))){
        await createAUser(discordID, name)
    }
}

const doesUserHaveCard = async (discordID) => {
    let doesUserHaveCardQuery = `SELECT cardID FROM ${cardsDataTB} WHERE ownerID='${discordID.toString()}'`
    return (await DB.get(doesUserHaveCardQuery)) ? true : false
}

const isCardAlreadyPickedByUser = async (discordID, playerID, rarity) => {
    let isCardAlreadyPickedByUserQuery = `SELECT cardID FROM ${cardsDataTB} WHERE creatorID='${discordID.toString()}' AND playerID=${playerID} AND rarity='${rarity}'`
    return (await DB.get(isCardAlreadyPickedByUserQuery)) ? true : false
}

const updateUserName = async (discordID, name) => {
    name = name.replace("'", "").replace("`", "").replace('"', "")
    let updateUserNameQuery = `UPDATE ${usersDataTB} SET 'name' = '${name}' WHERE discordID = '${discordID.toString()}'`
    await DB.run(updateUserNameQuery)
}

const rankupAUser = async (discordID) => {
    let rankupAUserQuery = `UPDATE ${usersDataTB} SET 'rankID' = rankID + ${1} WHERE discordID = '${discordID.toString()}'`
    await DB.run(rankupAUserQuery)
}

//>user managements

//quest managements<

const prepareQuestUser = async (discordID) => {
    await DB.run(
        `INSERT INTO ${questUserStatsTB} (discordID)
         SELECT ?
         WHERE NOT EXISTS (SELECT 1 FROM ${questUserStatsTB} WHERE discordID = ?)`,
        [discordID.toString(), discordID.toString()]
    )
}

const getQuestUserStats = async (discordID) => {
    await prepareQuestUser(discordID)
    return await DB.get(`SELECT * FROM ${questUserStatsTB} WHERE discordID = ?`, [discordID.toString()])
}

const updateQuestUserStats = async (discordID, fields) => {
    const entries = Object.entries(fields)
    if(!entries.length) return
    const setClause = entries.map(([field]) => `"${field}" = ?`).join(", ")
    await DB.run(
        `UPDATE ${questUserStatsTB} SET ${setClause} WHERE discordID = ?`,
        [...entries.map(([, value]) => value), discordID.toString()]
    )
}

const addQuestXP = async (discordID, amount) => {
    await prepareQuestUser(discordID)
    await DB.run(`UPDATE ${questUserStatsTB} SET xp = xp + ? WHERE discordID = ?`, [Number(amount) || 0, discordID.toString()])
}

const incrementQuestMessages = async (discordID, timestamp) => {
    await prepareQuestUser(discordID)
    await DB.run(
        `UPDATE ${questUserStatsTB}
         SET totalMessages = totalMessages + 1, lastQuestMessageStamp = ?
         WHERE discordID = ?`,
        [Number(timestamp) || Date.now(), discordID.toString()]
    )
}

const addWheelTickets = async (discordID, amount) => {
    await prepareQuestUser(discordID)
    await DB.run(`UPDATE ${questUserStatsTB} SET wheelTickets = MAX(wheelTickets + ?, 0) WHERE discordID = ?`, [Number(amount) || 0, discordID.toString()])
}

const consumeWheelTicket = async (discordID) => {
    const stats = await getQuestUserStats(discordID)
    if(Number(stats.wheelTickets) <= 0) return false
    await addWheelTickets(discordID, -1)
    return true
}

const setPickBoost = async (discordID, multiplier, untilTimestamp) => {
    await prepareQuestUser(discordID)
    await updateQuestUserStats(discordID, {
        pickBoostMultiplier: Number(multiplier) || 1,
        pickBoostUntil: Number(untilTimestamp) || 0
    })
}

const getActivePickBoostMultiplier = async (discordID) => {
    const stats = await getQuestUserStats(discordID)
    if(Number(stats.pickBoostUntil) > Date.now()){
        return Math.max(Number(stats.pickBoostMultiplier) || 1, 0.05)
    }
    if(Number(stats.pickBoostUntil) > 0 || Number(stats.pickBoostMultiplier) != 1){
        await setPickBoost(discordID, 1, 0)
    }
    return 1
}

const getDailyQuestProgressRows = async (discordID, questDate) => {
    return await DB.all(
        `SELECT * FROM ${questDailyProgressTB} WHERE discordID = ? AND questDate = ?`,
        [discordID.toString(), questDate]
    )
}

const getClaimedQuestIDs = async (discordID) => {
    const rows = await DB.all(
        `SELECT DISTINCT questID FROM ${questDailyProgressTB} WHERE discordID = ? AND claimed = 1`,
        [discordID.toString()]
    )
    return rows.map(row => row.questID)
}

const getDailyQuestProgress = async (discordID, questDate, questID) => {
    return await DB.get(
        `SELECT * FROM ${questDailyProgressTB} WHERE discordID = ? AND questDate = ? AND questID = ?`,
        [discordID.toString(), questDate, questID]
    )
}

const upsertDailyQuestProgress = async (discordID, questDate, questID, progress, completed = 0, claimed = 0) => {
    await DB.run(
        `INSERT INTO ${questDailyProgressTB} (discordID, questDate, questID, progress, completed, claimed)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(discordID, questDate, questID)
         DO UPDATE SET progress = excluded.progress, completed = excluded.completed, claimed = excluded.claimed`,
        [discordID.toString(), questDate, questID, Number(progress) || 0, completed ? 1 : 0, claimed ? 1 : 0]
    )
}

const markDailyQuestClaimed = async (discordID, questDate, questID) => {
    await DB.run(
        `UPDATE ${questDailyProgressTB}
         SET claimed = 1
         WHERE discordID = ? AND questDate = ? AND questID = ?`,
        [discordID.toString(), questDate, questID]
    )
}

const setQuestLevel = async (discordID, level) => {
    await prepareQuestUser(discordID)
    await DB.run(`UPDATE ${questUserStatsTB} SET level = ? WHERE discordID = ?`, [Number(level) || 1, discordID.toString()])
}

//>quest managements



//time managements<

const getLastQuickPickTime = async (discordID) => {
    let getLastQuickPickTimeQuery = `SELECT lastQuickPick FROM ${usersDataTB} WHERE discordID='${discordID.toString()}'`
    console.log((await DB.get(getLastQuickPickTimeQuery)).lastQuickPick)
    return (await DB.get(getLastQuickPickTimeQuery)).lastQuickPick
}

const updateQuickPickTime = async (discordID) => {
    let updateQuickPickTimeQuery = `UPDATE ${usersDataTB} SET 'lastQuickPick' = ${Date.now().toString()} WHERE discordID='${discordID.toString()}'`
    await DB.run(updateQuickPickTimeQuery)
}

const getLastSlowPickTime = async (discordID) => {
    let getLastSlowPickTimeQuery = `SELECT lastDailyPick FROM ${usersDataTB} WHERE discordID='${discordID.toString()}'`
    return (await DB.get(getLastSlowPickTimeQuery)).lastDailyPick
}

const updateSlowPickTime = async (discordID) => {
    let updateSlowPickTimeQuery = `UPDATE ${usersDataTB} SET 'lastDailyPick' = '${Date.now().toString()}' WHERE discordID='${discordID.toString()}'`
    await DB.run(updateSlowPickTimeQuery)
}

//>time managements



//zones des compteurs<

const getLastPickablePlayerID = async () =>{
    let getOwnerOfACardQuery = `SELECT data FROM ${otherTB} WHERE dataName='lastPickablePlayerID'`
    let row = await DB.get(getOwnerOfACardQuery)
    return row ? row.data : 0
}

const setLastPickablePlayerID = async(newPlayerID) => {
    let setLastPickablePlayerIDQuery = `UPDATE ${otherTB} SET 'data' = ${newPlayerID} WHERE dataName='lastPickablePlayerID'`
    await DB.run(setLastPickablePlayerIDQuery)
}

const getPersistentSetting = async (dataName, defaultValue = 1) => {
    const row = await DB.get(`SELECT data FROM ${otherTB} WHERE dataName = ?`, [dataName])
    if(!row) return defaultValue
    if(typeof defaultValue == "string"){
        return row.data == null ? defaultValue : row.data.toString()
    }

    const value = Number(row?.data)
    return Number.isFinite(value) ? value : defaultValue
}

const setPersistentSetting = async (dataName, value) => {
    await DB.run(`UPDATE ${otherTB} SET data = ? WHERE dataName = ?`, [value, dataName])
    await DB.run(
        `INSERT INTO ${otherTB} (dataName, data)
         SELECT ?, ?
         WHERE NOT EXISTS (SELECT 1 FROM ${otherTB} WHERE dataName = ?)`,
        [dataName, value, dataName]
    )
}

const getPersistentTextSetting = async (dataName, defaultValue = "") => {
    const row = await DB.get(`SELECT data FROM ${otherTB} WHERE dataName = ?`, [dataName])
    if(!row || row.data == null) return defaultValue

    const value = row.data.toString()
    if(value.startsWith(TEXT_SETTING_PREFIX)){
        return value.slice(TEXT_SETTING_PREFIX.length)
    }

    if(/^\d{17,20}$/.test(value)){
        return defaultValue
    }

    return defaultValue || value
}

const setPersistentTextSetting = async (dataName, value) => {
    await setPersistentSetting(dataName, `${TEXT_SETTING_PREFIX}${value?.toString() || ""}`)
}

const getRarityWeightSettingName = (rarityName) => {
    return `rarityWeight:${rarityName}`
}

const getRarityWeightRows = async () => {
    const rows = await Promise.all(constants.RARITIES.map(async rarity => ({
        rarity,
        weight: await getPersistentSetting(getRarityWeightSettingName(rarity.name), rarity.weight)
    })))
    return rows.map(row => ({
        ...row,
        weight: Number(row.weight) > 0 ? Number(row.weight) : row.rarity.weight
    }))
}

const getRarityProbabilityRows = async () => {
    const rows = await getRarityWeightRows()
    const totalWeight = rows.reduce((total, row) => total + row.weight, 0)
    return rows.map(row => ({
        name: row.rarity.name,
        shortName: row.rarity.shortName,
        weight: row.weight,
        probability: totalWeight > 0 ? row.weight / totalWeight * 100 : 0
    }))
}

const setRarityProbability = async (rarityName, probabilityPercent) => {
    const rarity = constants.RARITY_BY_NAME[rarityName]
    const probability = Number(probabilityPercent)
    if(!rarity){
        return { ok: false, error: "Rareté inconnue." }
    }
    if(!Number.isFinite(probability) || probability <= 0 || probability > 75){
        return { ok: false, error: "La probabilité doit être un nombre entre 0.0001 et 75%." }
    }

    const rows = await getRarityWeightRows()
    const targetRow = rows.find(row => row.rarity.name == rarityName)
    const otherWeight = rows
        .filter(row => row.rarity.name != rarityName)
        .reduce((total, row) => total + row.weight, 0)

    if(!targetRow || otherWeight <= 0){
        return { ok: false, error: "Impossible de recalculer les poids des raretés." }
    }

    const probabilityRatio = probability / 100
    const newWeight = probabilityRatio * otherWeight / (1 - probabilityRatio)
    await setPersistentSetting(getRarityWeightSettingName(rarityName), newWeight)

    const updatedRows = await getRarityProbabilityRows()
    const updatedRow = updatedRows.find(row => row.name == rarityName)
    return { ok: true, rarityName, probability: updatedRow?.probability ?? probability, weight: newWeight }
}

const upsertGuildPlayer = async (discordID, playerName) => {
    const existingPlayer = await DB.get(
        `SELECT playerID, playerName FROM ${playersDataTB} WHERE discordID = ? LIMIT 1`,
        [discordID]
    )

    if(existingPlayer){
        const wasUpdated = existingPlayer.playerName !== playerName
        if(wasUpdated){
            await DB.run(
                `UPDATE ${playersDataTB} SET playerName = ?, active = 1 WHERE playerID = ?`,
                [playerName, existingPlayer.playerID]
            )
        }
        else{
            await DB.run(`UPDATE ${playersDataTB} SET active = 1 WHERE playerID = ?`, [existingPlayer.playerID])
        }
        return { added: false, updated: wasUpdated, playerID: existingPlayer.playerID }
    }

    const legacyPlayer = await DB.get(
        `SELECT playerID FROM ${playersDataTB} WHERE discordID IS NULL AND playerName = ? LIMIT 1`,
        [playerName]
    )
    if(legacyPlayer){
        await DB.run(
            `UPDATE ${playersDataTB} SET discordID = ?, playerName = ?, active = 1 WHERE playerID = ?`,
            [discordID, playerName, legacyPlayer.playerID]
        )
        return { added: false, updated: true, playerID: legacyPlayer.playerID }
    }

    await DB.run(
        `INSERT INTO ${playersDataTB} (discordID, playerName, playerEmote, active) VALUES (?, ?, NULL, 1)`,
        [discordID, playerName]
    )
    const insertedPlayer = await DB.get(
        `SELECT playerID FROM ${playersDataTB} WHERE discordID = ? ORDER BY playerID DESC LIMIT 1`,
        [discordID]
    )
    return { added: true, updated: false, playerID: insertedPlayer.playerID }
}

const removeGuildPlayerByDiscordID = async (discordID) => {
    const existingPlayer = await DB.get(
        `SELECT playerID, playerName FROM ${playersDataTB} WHERE discordID = ? LIMIT 1`,
        [discordID.toString()]
    )
    if(!existingPlayer) return { removed: false, playerID: null, playerName: null }

    await DB.run(`UPDATE ${playersDataTB} SET active = 0 WHERE playerID = ?`, [existingPlayer.playerID])
    return { removed: true, playerID: existingPlayer.playerID, playerName: existingPlayer.playerName }
}

const refreshLastPickablePlayerID = async () => {
    const row = await DB.get(`SELECT MAX(playerID) AS lastPlayerID FROM ${playersDataTB}`)
    const lastPlayerID = Number(row?.lastPlayerID) || 0
    await setPersistentSetting('lastPickablePlayerID', lastPlayerID)
    return lastPlayerID
}

//>zones des compteurs




module.exports = {
    withGuild,
    getCurrentGuildID,
    getDBPathForGuild,
    createAUser,
    prepareUser,
    createACard,
    editACard,
    changeCardOwnership,
    bulkChangeCardOwnership,
    setCardImageURL,
    isCardRegistered,
    isUserRegistered,
    getLastQuickPickTime,
    updateQuickPickTime,
    getLastSlowPickTime,
    updateSlowPickTime,
    doesUserHaveCard,
    isCardAlreadyPickedByUser,
    doesUserOwnThisCard,
    getACardFromID,
    getCardsFromOwnerID,
    getRegisteredCards,
    getCardsIDListHUB,
    getDistinctPlayerIDAndRarityInUserInventory,
    getOwnerOfACard,
    addMoneyToUser,
    subMoneyToUser,
    setMoneyForUser,
    getBaltopRowsList,
    getMoneyOfUser,
    hasEnoughMoney,
    lockACard,
    bulkLock,
    unlockACard,
    bulkUnlock,
    isACardLocked,
    bulkIsACardLocked,
    setCardEmbedColorCode,
    getLastPickablePlayerID,
    setLastPickablePlayerID,
    getPersistentSetting,
    setPersistentSetting,
    getPersistentTextSetting,
    setPersistentTextSetting,
    getRarityWeightRows,
    getRarityProbabilityRows,
    setRarityProbability,
    ensureDatabaseSchema,
    upsertGuildPlayer,
    removeGuildPlayerByDiscordID,
    refreshLastPickablePlayerID,
    updateUserName,
    addPointsToUser,
    subPointsToUser,
    getCardPointsOfUser,
    hasEnoughCardPoints,
    getCardPointstopRowsList,
    getOwnedCardTopRowsList,
    getPickTopRowsList,
    getDailyTopRowsList,
    incrementDailyCount,
    getAUserFromDiscordID,
    getPickedCardsNumberOfAUser,
    getOwnedCardsNumberOfAUser,
    rankupAUser,
    getPlayerDataFromID,
    getGuildPlayersList,
    getRandomPickablePlayerID,
    findPlayerData,
    createDrop,
    getDrop,
    getDropClaims,
    claimDropSlot,
    releaseDropClaim,
    expireDrop,
    prepareQuestUser,
    getQuestUserStats,
    updateQuestUserStats,
    addQuestXP,
    incrementQuestMessages,
    addWheelTickets,
    consumeWheelTicket,
    setPickBoost,
    getActivePickBoostMultiplier,
    getDailyQuestProgressRows,
    getClaimedQuestIDs,
    getDailyQuestProgress,
    upsertDailyQuestProgress,
    markDailyQuestClaimed,
    setQuestLevel
};
