# NewGenCard

Bot Discord de collection de cartes, construit avec `discord.js` v14, `sqlite3` et `canvas`.

Le bot permet aux membres d'un serveur de tirer des cartes représentant les membres du serveur, de les vendre, les échanger, les afficher, compléter une collection par rareté, gagner de l'argent, monter en rang et consulter les classements.

## Fonctionnement général

NewGenCard repose sur trois idées principales :

- Chaque serveur Discord possède sa propre base SQLite.
- Les cartes sont générées à partir des membres synchronisés du serveur.
- Les raretés, prix, points et couleurs sont centralisés dans `data/constants.js`.

Le bot utilise les composants Discord récents, notamment les containers Components V2 pour certaines interfaces comme `/inv`, `/cards`, `/collection` et `/guildcollection`.

## Structure du projet

```txt
NewGenCard/
├─ adminCommands/              Commandes administrateur
├─ assets/                     Cadres des cartes par rareté
├─ commands/                   Commandes slash publiques
├─ data/
│  ├─ constants.js             Raretés, prix, rangs, cooldowns, couleurs
│  └─ guilds/                  Bases SQLite par serveur
├─ functions/                  Logique métier du bot
├─ deploy-commands.js          Déploiement des slash commands
├─ deploy.js                   Wrapper court pour Pterodactyl
├─ index.js                    Entrée principale du bot
├─ newDBinit.js                Initialisation/migration DB
├─ syncGuildPlayers.js         Synchronisation des membres
└─ package.json
```

## Prérequis

Node.js 20 ou plus récent est recommandé.

Le projet dépend de `canvas`, donc sur Linux il faut installer les bibliothèques natives nécessaires.

Ubuntu/Debian :

```bash
sudo apt update
sudo apt install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
```

Installation Node :

```bash
npm ci
```

Sur un serveur de production ou un panel Pterodactyl, `npm ci --omit=dev` suffit si les dépendances de dev ne sont pas utilisées.

## Variables d'environnement

Créer un fichier `.env` à la racine du projet.

Exemple :

```env
DISCORD_TOKEN=token_du_bot
CLIENT_ID=id_application_discord

# Serveur principal historique, utilisé si GUILD_IDS n'est pas renseigné.
GUILD_ID=id_du_serveur

# Plusieurs serveurs de test/production, séparés par des virgules.
GUILD_IDS=id_serveur_1,id_serveur_2

# Serveur où les commandes admin sont déployées.
GUILD_ID_ADMIN=id_du_serveur_admin

# Salon où le bot peut envoyer/stocker les images générées.
IMAGES_STORAGE_GUILD_ID=id_du_serveur_stockage
IMAGES_STORAGE_CHANNEL_ID=id_du_salon_stockage
```

Notes :

- `DISCORD_TOKEN` et `CLIENT_ID` sont obligatoires.
- `GUILD_IDS` permet de déployer rapidement les commandes sur plusieurs serveurs.
- Si `GUILD_IDS` est vide mais `GUILD_ID` est rempli, les commandes publiques sont déployées sur `GUILD_ID`.
- Si aucun serveur n'est renseigné pour les commandes publiques, elles sont déployées globalement.
- `GUILD_ID_ADMIN` sert uniquement aux commandes admin.

## Scripts npm

```bash
npm start
```

Démarre le bot avec `node index.js`.

```bash
npm run deploy
```

Déploie les commandes slash publiques et admin.

```bash
npm run init-db
```

Initialise ou met à jour la structure des bases SQLite.

```bash
npm run sync-members
```

Synchronise les membres des serveurs accessibles par le bot.

```bash
npm run check
```

Vérifie rapidement la syntaxe de `index.js`.

## Installation propre

Pour une installation propre sur un serveur :

```bash
npm ci --omit=dev
npm run init-db
npm run deploy
npm start
```

Si vous repartez d'une installation existante, sauvegardez avant de supprimer quoi que ce soit :

```txt
data/
.env
assets/
```

Les bases serveur sont dans `data/guilds/`. Les supprimer remet les collections, cartes, monnaies et rangs à zéro pour les serveurs concernés.

## Pterodactyl

Startup recommandé :

```bash
node index.js
```

Pour déployer les commandes depuis Pterodactyl, le fichier `deploy.js` existe uniquement comme wrapper court :

```bash
node deploy.js
```

Il appelle `deploy-commands.js`. C'est pratique si le panel limite la longueur du nom de startup ou de commande.

## Multi-serveur

Chaque serveur a sa propre base SQLite :

```txt
data/guilds/<ID_DU_SERVEUR>.db
```

Conséquences :

- Les cartes d'un serveur ne sont pas mélangées avec celles d'un autre serveur.
- Un membre synchronisé sur le serveur A ne devient pas automatiquement une carte sur le serveur B.
- Les monnaies, inventaires, rangs et collections sont séparés par serveur.
- Le contexte serveur est choisi automatiquement via `interaction.guildId`.

Le bot synchronise les membres au démarrage et lorsqu'un membre rejoint le serveur.

Important : les bots ne sont pas comptés comme cartes de membres.

## Assets des cartes

Les cadres sont dans `assets/`.

Noms actuellement attendus :

```txt
Artefact.png
Commun.png
Crystal.png
Dore.png
Epique.png
Error Code.png
Legendaire.png
Mythique.png
Peu Commun.png
Rare.png
Speciale.png
Tres Rare.png
```

Les noms doivent correspondre aux raretés définies dans `data/constants.js`.

## Raretés

Les raretés sont configurées dans `data/constants.js`.

| Rareté | Prix de vente | Points de discard | Note |
|---|---:|---:|---|
| Commun | 5$ | 1 | Très fréquent |
| Peu Commun | 10$ | 2 | Fréquent |
| Rare | 20$ | 4 | Correct |
| Tres Rare | 25$ | 5 | Plus rare |
| Epique | 35$ | 7 | Rare |
| Legendaire | 100$ | 20 | Très rare |
| Dore | 150$ | 30 | Très rare |
| Mythique | 250$ | 50 | Ultra rare |
| Artefact | 500$ | 100 | Très haut rang |
| Speciale | 1000$ | 200 | Cadre spécial multicolore |
| Error Code | 1000$ à 5000$ | 250 à 1000 | Gain aléatoire |
| Crystal | 5000$ | 1000 | 0.001% |

Le tirage est basé sur les plages `minValue` / `maxValue` et `weight`.

## Rangs

Les rangs sont configurés dans `data/constants.js`.

Ils jouent sur :

- le coût du prochain rankup ;
- les points nécessaires ;
- le cooldown de `/pick` ;
- le multiplicateur des gains de carte ;
- le multiplicateur du `/daily`.

Rangs actuels :

```txt
1. Iron
2. Bronze
3. Silver
4. Gold
5. Platinium
6. Diamond
7. Master
8. Grand Master
```

Bonus actuels :

| Rang | Bonus cartes | Bonus daily |
|---:|---:|---:|
| 1 | x1 | x1 |
| 2 | x1.05 | x1.08 |
| 3 | x1.10 | x1.16 |
| 4 | x1.18 | x1.28 |
| 5 | x1.28 | x1.42 |
| 6 | x1.40 | x1.58 |
| 7 | x1.55 | x1.78 |
| 8 | x1.75 | x2 |

## Commandes publiques

### Aide et profil

| Commande | Description |
|---|---|
| `/aide` | Explique les commandes et le fonctionnement du bot |
| `/profil` | Affiche le profil d'un utilisateur |
| `/daily` | Donne la récompense journalière |
| `/rankup` | Permet de passer au rang suivant |

### Tirage et cartes

| Commande | Description |
|---|---|
| `/pick` | Tire une carte en respectant le cooldown |
| `/forcepick` | Tire une carte sans attendre le cooldown |
| `/buypick` | Achète un tirage |
| `/card` | Affiche une carte par ID |
| `/cards` | Parcourt le catalogue des cartes avec menu et pagination |
| `/cardcolor` | Change la couleur de l'embed d'une carte |
| `/inv` | Affiche l'inventaire de cartes |
| `/blitzers` | Liste paginée de cartes possédées |
| `/research` | Recherche avancée dans les cartes |

### Collection

| Commande | Description |
|---|---|
| `/collection` | Affiche la collection d'un utilisateur |
| `/collectionstats` | Affiche les statistiques de collection |
| `/guildcollection` | Prévisualise les cartes possibles des membres du serveur |

### Économie et échanges

| Commande | Description |
|---|---|
| `/sell` | Vend une carte à la banque |
| `/discard` | Convertit une carte en points |
| `/pay` | Donne de l'argent à un utilisateur |
| `/trade` | Échange cartes et argent avec un autre joueur |
| `/baltop` | Classement argent |
| `/pointstop` | Classement points |

### Autres

| Commande | Description |
|---|---|
| `/master` | Commande spéciale |
| `/multiplier` | Modifie le multiplicateur des gains |

## Commandes admin

Les commandes admin sont dans `adminCommands/` et sont déployées sur `GUILD_ID_ADMIN`.

| Commande | Description |
|---|---|
| `/blockbot` | Active/désactive le mode maintenance |
| `/forcelock` | Verrouille une carte |
| `/forceunlock` | Déverrouille une carte |
| `/givecardpoints` | Ajoute des points à un joueur |
| `/subcardpoints` | Retire des points à un joueur |
| `/givemoney` | Ajoute de l'argent à un joueur |
| `/submoney` | Retire de l'argent à un joueur |
| `/modif` | Modifie une carte existante |
| `/pickfor` | Tire une carte pour un utilisateur |
| `/setlastpickableplayerid` | Change l'ID du dernier joueur tirable |
| `/setqptimemultiplicator` | Change le multiplicateur de cooldown pick |
| `/updatecardimage` | Régénère l'image d'une carte |

## Interfaces avec boutons et menus

Les interfaces interactives ont une validité courte pour éviter les interactions anciennes :

- les boutons et menus sont réservés à la personne qui a lancé la commande ;
- après expiration, les composants sont désactivés ;
- l'utilisateur doit relancer la commande pour obtenir une interface fraîche.

Cela concerne notamment :

- `/cards`
- `/inv`
- `/collection`
- `/guildcollection`

## Images générées

La génération d'image utilise `canvas`.

Les fonctions principales sont dans :

```txt
functions/secondLayerCardFunctions.js
```

Le bot génère notamment :

- l'image finale d'une carte ;
- les previews de `/guildcollection` ;
- les rendus avec cadre selon la rareté ;
- le rendu spécial multicolore pour `Speciale`.

## Synchronisation des membres

Le bot utilise l'intent `GuildMembers`.

À vérifier dans le portail Discord Developer :

- `SERVER MEMBERS INTENT` activé ;
- bot invité avec les permissions nécessaires ;
- bot présent sur les serveurs ciblés.

La synchronisation se fait :

- au démarrage du bot ;
- une fois par jour via le scheduler interne ;
- quand un membre rejoint un serveur ;
- manuellement avec `npm run sync-members`.

Pour éviter les rate limits Discord, `/guildcollection` ne force pas une resynchronisation massive à chaque appel. Il lit les membres déjà enregistrés en base.

## Déploiement des commandes

Commande :

```bash
npm run deploy
```

Ou sur Pterodactyl :

```bash
node deploy.js
```

Si Discord renvoie :

```txt
APPLICATION_COMMANDS_DUPLICATE_NAME
```

Cela veut dire que deux fichiers de commandes déclarent le même nom slash. Le script vérifie déjà les doublons et affiche une erreur du style :

```txt
Commande doublon dans commands: /nom
```

À vérifier :

- deux fichiers dans `commands/` avec le même `.setName(...)` ;
- deux fichiers dans `adminCommands/` avec le même `.setName(...)` ;
- une commande publique et une commande admin déployées dans le même serveur avec le même nom.

## Base de données

La couche SQLite est dans :

```txt
functions/apiDB.js
```

Les bases serveur sont ignorées par Git grâce à `.gitignore` :

```txt
*.db
*.db-*
```

Avant une migration ou un reset, faire une sauvegarde de :

```txt
data/guilds/
```

Un reset complet de la progression d'un serveur consiste à supprimer sa base :

```txt
data/guilds/<ID_DU_SERVEUR>.db
```

Puis relancer :

```bash
npm run init-db
npm run sync-members
```

## Dépannage rapide

### Le bot démarre mais aucune commande n'apparaît

Relancer :

```bash
npm run deploy
```

Puis attendre quelques secondes si les commandes sont en serveur. Les commandes globales peuvent prendre beaucoup plus de temps à apparaître.

### Les cartes ne se génèrent pas

Vérifier :

- que `canvas` est bien installé ;
- que les dépendances Linux de `canvas` sont installées ;
- que les fichiers dans `assets/` existent ;
- que le salon de stockage d'images est configuré.

### `/guildcollection` ne montre pas tous les membres

Relancer :

```bash
npm run sync-members
```

Vérifier aussi que l'intent `GuildMembers` est activé côté Discord Developer Portal.

### Erreur de rate limit opcode 8

Cela vient généralement d'une récupération massive des membres Discord. Le bot évite maintenant de le faire dans `/guildcollection`; il faut préférer la synchronisation au démarrage ou `npm run sync-members`.

### Le bot est bloqué en maintenance

Utiliser :

```txt
/blockbot mode:false
```

Ou redémarrer le bot si nécessaire.

## Checklist avant mise en production

- `.env` rempli correctement.
- `DISCORD_TOKEN` valide.
- `CLIENT_ID` valide.
- `GUILD_IDS` renseigné pour les serveurs ciblés.
- `GUILD_ID_ADMIN` renseigné pour les commandes admin.
- Intents Discord activés.
- `assets/` complet.
- `npm ci --omit=dev` effectué.
- `npm run init-db` effectué.
- `npm run deploy` effectué.
- `npm start` fonctionne sans erreur critique.

## Idées prévues

Fonctionnalités possibles pour plus tard :

- roue de la fortune ;
- événements temporaires ;
- bonus de serveur ;
- collections spéciales ;
- badges ou succès ;
- logs admin plus complets ;
- panneau web de gestion.

## Crédits

NewGenCard / Discord Card Project est une refonte et une évolution d'un projet de bot de cartes Discord existant.

Projet provenant de BlitzCard développé par molo & Alminess que je remercie pour ce code & leur accord pour la modification.

Projet original :

```txt
https://github.com/AlMiness/BlitzCards
```

Repository actuel :

```txt
https://github.com/Lili-y67/Discord-Card-Project
```
