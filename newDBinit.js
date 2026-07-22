const sqlite3 = require("sqlite3").verbose();
const path = require('node:path');
const fs = require('fs');

const dbpath = path.join(__dirname, 'data/blitzcordDB.db');
const cardJSONPath = path.join(__dirname, 'data/cards.json');

const DB = new sqlite3.Database(dbpath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if(err) return console.error("Erreur lors de l'ouverture de la base de données", err)
})

const createUserTB = 'CREATE TABLE IF NOT EXISTS "usersData"("discordID" TEXT NOT NULL UNIQUE, "name" TEXT, "money" INTEGER DEFAULT 0, "creationStamp" INTEGER, "lastQuickPick" TEXT, "lastDailyPick" TEXT, "wantNotifications" INTEGER, "notificationsChannel" TEXT, "gotNotificationYet" INTEGER, "rankID" INTEGER, "cardPoints" INTEGER, "dailyCount" INTEGER DEFAULT 0, PRIMARY KEY("discordID"))'

const createCardsDataTB = `CREATE TABLE IF NOT EXISTS "cardsData" (
	"cardID"	INTEGER NOT NULL UNIQUE,
	"playerID"	INTEGER,
	"playerDiscordID" TEXT,
	"playerNameSnapshot" TEXT,
	"rarityValue"	INTEGER,
	"rarity"	TEXT,
	"creatorID"	TEXT,
	"creationStamp" INTEGER,
	"ownerID"	TEXT,
	"lastOwnerChangeStamp" INTEGER,
	"imageURL"	TEXT,
	"embedColor"	TEXT,
	"locked"	INTEGER DEFAULT 0,
	"userLocked"	INTEGER DEFAULT 0,
	PRIMARY KEY("cardID" AUTOINCREMENT)
);`

const createOtherTB = `CREATE TABLE IF NOT EXISTS "other" (
	"dataName"	TEXT,
	"data"	INTEGER
);`

const createPlayerDataTB = `CREATE TABLE IF NOT EXISTS "playersData" (
	"playerID"	INTEGER NOT NULL UNIQUE,
	"discordID"	TEXT,
	"playerName"	TEXT,
	"playerEmote"	TEXT,
	"active"	INTEGER DEFAULT 1,
	PRIMARY KEY("playerID" AUTOINCREMENT)
);`;

const createQuestUserStatsTB = `CREATE TABLE IF NOT EXISTS "questUserStats" (
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
);`;

const createQuestDailyProgressTB = `CREATE TABLE IF NOT EXISTS "questDailyProgress" (
    "discordID" TEXT NOT NULL,
    "questDate" TEXT NOT NULL,
    "questID" TEXT NOT NULL,
    "progress" INTEGER DEFAULT 0,
    "completed" INTEGER DEFAULT 0,
    "claimed" INTEGER DEFAULT 0,
    PRIMARY KEY("discordID", "questDate", "questID")
);`;

const readPlayersDataJSON = () => {
    if(!fs.existsSync(cardJSONPath)){
        return { playerData: {} }
    }

    const rawJSON = fs.readFileSync(cardJSONPath, 'utf8').replace(/^\uFEFF/, '').trim();
    if(!rawJSON){
        return { playerData: {} }
    }

    return JSON.parse(rawJSON);
}

const playersDataJSON = readPlayersDataJSON();
const playersData = playersDataJSON.playerData || {};
const playerIDs = Object.keys(playersData).sort((a, b) => Number(a) - Number(b));

DB.serialize(() => {
    DB.run(createUserTB);
    DB.run(createCardsDataTB);
    DB.run(createOtherTB);
    DB.run(createPlayerDataTB);
    DB.run(createQuestUserStatsTB);
    DB.run(createQuestDailyProgressTB);

    DB.run(`ALTER TABLE "playersData" ADD COLUMN "discordID" TEXT`, () => {});
    DB.run(`ALTER TABLE "playersData" ADD COLUMN "active" INTEGER DEFAULT 1`, () => {});
    DB.run(`ALTER TABLE "questUserStats" ADD COLUMN "lastQuestMessageStamp" INTEGER DEFAULT 0`, () => {});
    DB.run(`ALTER TABLE "questUserStats" ADD COLUMN "pickBoostUntil" INTEGER DEFAULT 0`, () => {});
    DB.run(`ALTER TABLE "questUserStats" ADD COLUMN "pickBoostMultiplier" REAL DEFAULT 1`, () => {});
    DB.run(`ALTER TABLE "usersData" ADD COLUMN "dailyCount" INTEGER DEFAULT 0`, () => {});
    DB.run(`ALTER TABLE "cardsData" ADD COLUMN "playerDiscordID" TEXT`, () => {});
    DB.run(`ALTER TABLE "cardsData" ADD COLUMN "playerNameSnapshot" TEXT`, () => {});

	const playerDataInsert = DB.prepare('INSERT OR REPLACE INTO "playersData" (playerID, discordID, playerName, playerEmote) VALUES(?,?,?,?)');
	for (const id of playerIDs) {
        const player = playersData[id];
        playerDataInsert.run([Number(id), player.discordID || player.playerDiscordID || null, player.playerName, player.playerEmote || null]);
	}
	playerDataInsert.finalize();

    DB.run('DELETE FROM "other" WHERE dataName = ?', ["lastPickablePlayerID"]);
    DB.run('INSERT INTO "other" (dataName, data) VALUES(?,?)', ["lastPickablePlayerID", playerIDs.length]);
});

DB.close((err) => {
    if(err) return console.error("Erreur lors de la fermeture de la base de données", err)
    console.log(`Base de données initialisée avec ${playerIDs.length} joueur(s).`)
});
