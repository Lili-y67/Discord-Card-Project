const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const HELP_COLOR = 0x6f52c8;

const helpPages = {
    debuter: {
        title: 'Bien démarrer',
        description: 'Les commandes essentielles pour commencer à jouer.',
        fields: [
            {
                name: '1. Obtenir une carte',
                value: '`/pick` tire une carte lorsqu\'aucun délai n\'est actif.\n`/buypick` permet d\'acheter un tirage supplémentaire.'
            },
            {
                name: '2. Récupérer de l\'argent',
                value: '`/daily` donne la récompense quotidienne.\nUn tirage peut également rapporter de l\'argent selon la rareté obtenue.'
            },
            {
                name: '3. Voir ses cartes',
                value: '`/inv` affiche votre inventaire.\n`/card cardid:<numéro>` affiche les informations complètes d\'une carte.'
            },
            {
                name: '4. Suivre sa progression',
                value: '`/profil` affiche votre argent, vos points et votre rang.\n`/rankup` permet de passer au rang suivant lorsque les conditions sont remplies.'
            }
        ]
    },
    cartes: {
        title: 'Cartes et tirages',
        description: 'Tout ce qui concerne l\'obtention et la gestion d\'une carte.',
        fields: [
            { name: '/pick', value: 'Tire une carte gratuite lorsque votre délai est terminé.' },
            { name: '/buypick', value: 'Achète immédiatement un tirage supplémentaire.' },
            { name: '/card cardid:<numéro>', value: 'Affiche le joueur, la rareté, la valeur, le propriétaire et le statut de la carte.' },
            { name: '/sell cardid:<numéro>', value: 'Vend une carte à la banque contre de l\'argent.' },
            { name: '/discard cardid:<numéro>', value: 'Détruit une carte pour recevoir des points de carte.' },
            { name: '/cardcolor cardid:<numéro> code_couleur:<hex>', value: 'Change la couleur de l\'embed, par exemple `#ff66aa`.' }
        ]
    },
    collection: {
        title: 'Inventaire et collection',
        description: 'Retrouvez vos cartes et suivez l\'avancement de votre collection.',
        fields: [
            { name: '/inv', value: 'Affiche votre inventaire avec un bouton pour voir chaque carte.' },
            { name: '/blitzers', value: 'Affiche une ancienne liste paginée. Utilisez `user`, `page`, `filter` ou `ascendant` pour préciser la liste.' },
            { name: '/collection', value: 'Affiche les joueurs et raretés déjà obtenus. L\'option `user` permet de consulter un autre membre.' },
            { name: '/collectionstats', value: 'Affiche les statistiques globales d\'une collection.' },
            { name: '/research', value: 'Recherche des cartes avec plusieurs critères : joueur, rareté, propriétaire, créateur, ordre et cartes vendues.' },
            { name: 'Où trouver le numéro ?', value: 'Le `cardid` est le numéro unique affiché dans `/inv`, `/research` et sur la carte.' }
        ]
    },
    economie: {
        title: 'Économie et progression',
        description: 'Gérez votre argent, vos points et votre rang.',
        fields: [
            { name: '/daily', value: 'Récupère votre récompense quotidienne.' },
            { name: '/profil', value: 'Affiche votre solde, vos points de carte et votre rang. Ajoutez `user` pour voir un autre membre.' },
            { name: '/pay user:<membre> amount:<montant>', value: 'Transfère de l\'argent à un autre membre.' },
            { name: '/rankup', value: 'Passe au rang suivant si vous avez assez d\'argent et de points.' },
            { name: '/baltop et /pointstop', value: 'Affichent les classements d\'argent et de points de carte.' }
        ]
    },
    echanges: {
        title: 'Échanger avec un membre',
        description: 'La commande `/trade` permet d\'échanger des cartes, de l\'argent, ou les deux.',
        fields: [
            { name: 'Commande minimale', value: '`/trade user:<membre>` puis ajoutez ce que vous proposez ou demandez.' },
            { name: 'Proposer des cartes', value: 'Dans `cartes_proposées`, séparez les numéros par des virgules : `36, 44, 23`.' },
            { name: 'Demander des cartes', value: 'Utilisez le même format dans `cartes_demandées`. Le maximum est de 10 cartes par côté.' },
            { name: 'Ajouter de l\'argent', value: 'Renseignez `argent_proposé` ou `argent_demandé` selon le sens du transfert.' },
            { name: 'Validation', value: 'Vérifiez attentivement le récapitulatif avant d\'accepter ou de refuser l\'échange.' }
        ]
    },
    classements: {
        title: 'Classements',
        description: 'Comparez votre progression avec celle des autres membres.',
        fields: [
            { name: '/baltop', value: 'Classement des membres selon leur argent. L\'option `page` permet de naviguer.' },
            { name: '/pointstop', value: 'Classement selon les points de carte obtenus avec `/discard`.' },
            { name: '/collectionstats', value: 'Statistiques de collection pour vous-même ou un membre choisi.' },
            { name: '/profil user:<membre>', value: 'Résumé individuel du solde, des points et du rang.' }
        ]
    }
};

const buildOverviewEmbed = () => new EmbedBuilder()
    .setColor(HELP_COLOR)
    .setTitle('Aide NewGenCard')
    .setDescription('Commencez avec ces commandes, puis choisissez une catégorie pour obtenir plus de détails.')
    .addFields(
        { name: 'Démarrage rapide', value: '`/pick` → `/daily` → `/inv` → `/profil`' },
        { name: 'Examiner une carte', value: '`/card cardid:<numéro>`' },
        { name: 'Catégories disponibles', value: '`débuter` · `cartes` · `collection` · `économie` · `échanges` · `classements`' },
        { name: 'Afficher une catégorie', value: 'Utilisez `/aide categorie:<catégorie>`.' }
    )
    .setFooter({ text: 'Les options proposées par Discord vous guident pendant la saisie.' });

const buildCategoryEmbed = (category) => {
    const page = helpPages[category];
    return new EmbedBuilder()
        .setColor(HELP_COLOR)
        .setTitle(page.title)
        .setDescription(page.description)
        .addFields(page.fields)
        .setFooter({ text: 'Utilisez /aide pour revenir au démarrage rapide.' });
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('aide')
        .setDescription('Explique les commandes et le fonctionnement du bot')
        .addStringOption(option => option
            .setName('categorie')
            .setDescription('Partie du bot pour laquelle vous avez besoin d’aide')
            .addChoices(
                { name: 'Bien démarrer', value: 'debuter' },
                { name: 'Cartes et tirages', value: 'cartes' },
                { name: 'Inventaire et collection', value: 'collection' },
                { name: 'Économie et progression', value: 'economie' },
                { name: 'Échanges', value: 'echanges' },
                { name: 'Classements', value: 'classements' }
            ))
        .setDMPermission(false),

    async execute(interaction) {
        const category = interaction.options.getString('categorie');
        const embed = category ? buildCategoryEmbed(category) : buildOverviewEmbed();
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
