# NewGenCard

NewGenCard est un bot Discord de collection de cartes. Les membres d'un serveur deviennent des cartes à tirer, vendre, échanger, afficher et collectionner.

Le projet tourne avec `discord.js` v14, `sqlite3` et `canvas`. Chaque serveur Discord possède sa propre base SQLite, ce qui garde les inventaires, monnaies, rangs et collections séparés.

## Ce que fait le bot

- Tirage de cartes avec raretés, cooldowns et images générées.
- Inventaire, catalogue, collection personnelle et collection serveur.
- Économie interne avec vente, points de carte, paiements et échanges.
- Progression par rangs, bonus de gains et récompense quotidienne.
- Quêtes quotidiennes, XP de quête, tickets et roue de la fortune.
- Commandes admin pour gérer l'économie, les probabilités, la maintenance et les cartes.

## Prérequis

- Node.js 20 ou plus récent.
- Un bot Discord avec token et application ID.
- Les intents nécessaires activés dans le Discord Developer Portal, notamment `SERVER MEMBERS INTENT`.
- Les dépendances natives de `canvas` si le bot tourne sur Linux.

Sur Ubuntu/Debian :

```bash
sudo apt update
sudo apt install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
```

## Installation

```bash
npm ci
cp .env.example .env
```

Remplir ensuite le fichier `.env` :

```env
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_application_id

# Optionnel: serveur principal si GUILD_IDS n'est pas utilisé.
GUILD_ID=your_main_guild_id

# Optionnel: plusieurs serveurs, séparés par des virgules.
GUILD_IDS=your_first_guild_id,your_second_guild_id

# Optionnel: utilisateur qui garde l'accès admin même sans permission Administrator.
ADMIN_OVERRIDE_USER_ID=1147963951989149796

# Optionnel: salon utilisé pour stocker les images de cartes générées.
IMAGES_STORAGE_GUILD_ID=your_images_storage_guild_id
IMAGES_STORAGE_CHANNEL_ID=your_images_storage_channel_id
```

Variables obligatoires :

- `DISCORD_TOKEN`
- `CLIENT_ID`

Pour un déploiement de commandes sur serveur, renseigner `GUILD_IDS` ou `GUILD_ID`. Sans serveur cible, seules les commandes publiques sont déployées globalement.

## Lancement

Initialiser la base, déployer les commandes, puis démarrer le bot :

```bash
npm run init-db
npm run deploy
npm start
```

Commandes npm utiles :

| Script | Rôle |
|---|---|
| `npm start` | Lance `index.js`. |
| `npm run deploy` | Déploie les slash commands publiques et admin. |
| `npm run init-db` | Initialise ou met à jour les bases SQLite. |
| `npm run sync-members` | Synchronise les membres Discord dans les bases serveur. |
| `npm run check` | Vérifie rapidement la syntaxe de `index.js`. |
| `npm run start:vps` | Lance `vps-start.js` si ce fichier est présent sur l'installation. |

## Commandes publiques

| Commande | Rôle |
|---|---|
| `/aide` | Affiche l'aide du bot. |
| `/profil` | Affiche le profil d'un joueur. |
| `/daily` | Récupère la récompense quotidienne. |
| `/pick` | Tire une carte avec cooldown. |
| `/forcepick` | Tire une carte sans cooldown. |
| `/buypick` | Achète un tirage. |
| `/card` | Affiche une carte précise. |
| `/cards` | Parcourt le catalogue des cartes. |
| `/inv` | Affiche l'inventaire. |
| `/blitzers` | Liste les cartes possédées. |
| `/collection` | Affiche la collection d'un joueur. |
| `/collectioncard` | Affiche les cartes possédées pour un membre cible. |
| `/guildcollection` | Prévisualise les cartes possibles du serveur. |
| `/sell` | Vend une carte. |
| `/discard` | Convertit une carte en points. |
| `/pay` | Envoie de l'argent à un joueur. |
| `/trade` | Propose un échange. |
| `/top` | Affiche les classements. |
| `/rankup` | Passe au rang suivant. |
| `/quetes` | Affiche ou réclame les quêtes quotidiennes. |
| `/roue` | Utilise un ticket de roue. |

## Commandes admin

Les commandes admin sont dans `adminCommands/`. Elles sont déployées avec les autres commandes, puis protégées par le bot à l'exécution : seuls les administrateurs Discord et `ADMIN_OVERRIDE_USER_ID` peuvent les utiliser.

| Commande | Rôle |
|---|---|
| `/blockbot` | Active ou désactive la maintenance. |
| `/config` | Ouvre le panneau de configuration. |
| `/forcelock` / `/forceunlock` | Verrouille ou déverrouille une carte. |
| `/givemoney` / `/submoney` | Ajoute ou retire de l'argent. |
| `/givecardpoints` / `/subcardpoints` | Ajoute ou retire des points de carte. |
| `/modif` | Modifie une carte existante. |
| `/pickfor` | Tire une carte pour un joueur. |
| `/multiplier` | Modifie le multiplicateur de gains. |
| `/pick-timer` | Change le timer de base du `/pick`. |
| `/probability` | Change la probabilité d'une rareté. |
| `/setlastpickableplayerid` | Change le dernier joueur tirable. |
| `/setqptimemultiplicator` | Change le multiplicateur de cooldown. |
| `/updatecardimage` | Régénère l'image d'une carte. |

## Structure

```txt
NewGenCard/
|- adminCommands/       Commandes réservées aux admins
|- assets/              Cadres des cartes par rareté
|- commands/            Slash commands publiques
|- data/
|  |- constants.js      Raretés, prix, rangs, cooldowns
|  `- guilds/           Bases SQLite par serveur
|- functions/           Logique métier et helpers Discord
|- deploy-commands.js   Déploiement des commandes
|- deploy.js            Wrapper court pour déployer
|- index.js             Entrée principale du bot
|- newDBinit.js         Initialisation/migrations SQLite
|- syncGuildPlayers.js  Synchronisation des membres
`- package.json
```

## Données et assets

Les bases serveur sont stockées dans :

```txt
data/guilds/<ID_DU_SERVEUR>.db
```

Ces fichiers sont ignorés par Git. Sauvegarder `data/guilds/` avant toute migration, réinstallation ou reset.

Les cadres de cartes sont dans `assets/`. Le nom des fichiers doit correspondre aux raretés configurées dans `data/constants.js`, par exemple `Commun.png`, `Rare.png`, `Legendaire.png`, `Speciale.png`, `Error Code.png` et `Crystal.png`.

## Notes de fonctionnement

- Les bots Discord ne sont pas ajoutés comme cartes de membres.
- La synchronisation des membres se fait au démarrage, une fois par jour, quand un membre rejoint/quitte un serveur, ou avec `npm run sync-members`.
- Les interfaces avec boutons et menus expirent après une courte durée pour éviter les interactions trop anciennes.
- `/guildcollection` lit les membres déjà synchronisés afin d'éviter les récupérations massives et les rate limits Discord.
- Les raretés, prix de vente, points de discard, rangs et multiplicateurs sont centralisés dans `data/constants.js`.

## Dépannage rapide

Relancer les commandes slash si elles n'apparaissent pas :

```bash
npm run deploy
```

Resynchroniser les membres si une collection serveur est incomplète :

```bash
npm run sync-members
```

Vérifier `canvas`, les dépendances natives Linux et le dossier `assets/` si les images de cartes ne se génèrent pas.

En cas de reset complet d'un serveur, sauvegarder puis supprimer uniquement la base concernée dans `data/guilds/`, puis relancer :

```bash
npm run init-db
npm run sync-members
```

## Crédits

NewGenCard est une refonte et évolution d'un projet de bot de cartes Discord existant.

Projet d'origine : BlitzCards, développé par AlMiness.

Repository original :

```txt
https://github.com/AlMiness/BlitzCards
```

Repository actuel :

```txt
https://github.com/Lili-y67/Discord-Card-Project
```
