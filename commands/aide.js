const {
    ActionRowBuilder,
    EmbedBuilder,
    MessageFlags,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} = require('discord.js');

const HELP_COLOR = 0x6f52c8;
const HELP_CUSTOM_ID_PREFIX = 'help';
const OVERVIEW_VALUE = 'overview';

const categoryChoices = [
    { name: 'Bien démarrer', label: 'Bien démarrer', value: 'debuter', description: 'Les bases pour jouer tout de suite.' },
    { name: 'Cartes et tirages', label: 'Cartes et tirages', value: 'cartes', description: 'Tirages, vente, destruction et affichage.' },
    { name: 'Inventaire et collection', label: 'Inventaire et collection', value: 'collection', description: 'Voir les cartes et l’avancement.' },
    { name: 'Économie et progression', label: 'Économie et progression', value: 'economie', description: 'Argent, points, rangs et classements.' },
    { name: 'Échanges', label: 'Échanges', value: 'echanges', description: 'Faire un trade avec un membre.' },
    { name: 'Classements', label: 'Classements', value: 'classements', description: 'Comparer les soldes, points et collections.' },
    { name: 'Quêtes et roue', label: 'Quêtes et roue', value: 'quetes', description: 'Progression, tickets et roue fortune.' },
    { name: 'Commandes spéciales', label: 'Commandes spéciales', value: 'speciales', description: 'Outils réservés ou commandes de service.' }
];

const commandMentions = async (interaction) => {
    const mentions = new Map();
    const addCommands = (commands) => {
        commands?.forEach(command => {
            mentions.set(command.name, `</${command.name}:${command.id}>`);
        });
    };

    try {
        addCommands(await interaction.client.application.commands.fetch());
        if(interaction.guild){
            // Une commande enregistrée sur le serveur doit primer sur son
            // éventuelle version globale : son ID est celui que Discord attend ici.
            addCommands(await interaction.guild.commands.fetch());
        }
    } catch(error) {
        console.log('Impossible de récupérer les mentions des commandes pour /aide :', error);
    }

    return (name, syntax = '') => {
        const command = mentions.get(name) || `/${name}`;
        return syntax ? `${command} ${syntax}` : command;
    };
};

const helpPages = (cmd) => ({
    debuter: {
        title: 'Bien démarrer',
        description: 'Les commandes essentielles pour commencer à jouer.',
        fields: [
            {
                name: '1. Obtenir une carte',
                value: `${cmd('pick')} tire une carte lorsqu’aucun délai n’est actif.\n${cmd('buypick')} permet d’acheter un tirage supplémentaire.`
            },
            {
                name: '2. Récupérer de l’argent',
                value: `${cmd('daily')} donne la récompense quotidienne.\nUn tirage peut également rapporter de l’argent selon la rareté obtenue.`
            },
            {
                name: '3. Voir ses cartes',
                value: `${cmd('inv')} affiche votre inventaire.\n${cmd('card')} ouvre un sélecteur paginé pour afficher une carte.`
            },
            {
                name: '4. Suivre sa progression',
                value: `${cmd('profil')} affiche votre argent, vos points et votre rang.\n${cmd('rankup')} permet de passer au rang suivant lorsque les conditions sont remplies.`
            }
        ]
    },
    cartes: {
        title: 'Cartes et tirages',
        description: 'Tout ce qui concerne l’obtention et la gestion d’une carte.',
        fields: [
            { name: cmd('pick'), value: 'Tire une carte gratuite lorsque votre délai est terminé.' },
            { name: cmd('buypick'), value: 'Achète immédiatement un tirage supplémentaire.' },
            { name: cmd('card'), value: 'Choisissez une carte dans le menu paginé pour afficher son aperçu complet.' },
            { name: cmd('cards'), value: 'Parcourt toutes les cartes enregistrées avec un menu pour en afficher une.' },
            { name: cmd('sell'), value: 'Choisissez une carte puis confirmez sa vente à la banque.' },
            { name: cmd('discard'), value: 'Choisissez une carte puis confirmez sa conversion en points.' }
        ]
    },
    collection: {
        title: 'Inventaire et collection',
        description: 'Retrouvez vos cartes et suivez l’avancement de votre collection.',
        fields: [
            { name: cmd('inv'), value: 'Affiche votre inventaire avec un bouton pour voir chaque carte.' },
            { name: cmd('blitzers'), value: 'Affiche une ancienne liste paginée. Utilisez `user`, `page`, `filter` ou `ascendant` pour préciser la liste.' },
            { name: cmd('collection'), value: 'Affiche les joueurs et raretés déjà obtenus. L’option `user` permet de consulter un autre membre.' },
            { name: cmd('collectioncard', 'user:<membre>'), value: 'Affiche les cartes possédées concernant un membre ciblé, avec galerie d’images.' },
            { name: cmd('guildcollection'), value: 'Prévisualise les cartes possibles des membres du serveur.' },
            { name: 'Choix des cartes', value: 'Les commandes utilisent maintenant des menus paginés : aucun numéro de carte à recopier.' }
        ]
    },
    economie: {
        title: 'Économie et progression',
        description: 'Gérez votre argent, vos points et votre rang.',
        fields: [
            { name: cmd('daily'), value: 'Récupère votre récompense quotidienne.' },
            { name: cmd('profil'), value: 'Affiche votre solde, vos points de carte et votre rang. Ajoutez `user` pour voir un autre membre.' },
            { name: cmd('pay', 'user:<membre> amount:<montant>'), value: 'Transfère de l’argent à un autre membre.' },
            { name: cmd('rankup'), value: 'Passe au rang suivant si vous avez assez d’argent et de points.' },
            { name: cmd('top'), value: 'Ouvre un menu privé pour consulter les classements des cartes, de l’argent, des points, des picks ou des dailies.' }
        ]
    },
    echanges: {
        title: 'Échanger avec un membre',
        description: `La commande ${cmd('trade')} permet d’échanger des cartes, de l’argent, ou les deux.`,
        fields: [
            { name: 'Commande minimale', value: `${cmd('trade', 'user:<membre>')} puis ajoutez ce que vous proposez ou demandez.` },
            { name: 'Proposer des cartes', value: 'Sélectionnez jusqu’à 10 de vos cartes dans le menu paginé.' },
            { name: 'Demander des cartes', value: 'Sélectionnez jusqu’à 10 cartes du partenaire dans son menu.' },
            { name: 'Ajouter de l’argent', value: 'Renseignez `argent_proposé` ou `argent_demandé` selon le sens du transfert.' },
            { name: 'Validation', value: 'Vérifiez attentivement le récapitulatif avant d’accepter ou de refuser l’échange.' }
        ]
    },
    classements: {
        title: 'Classements',
        description: 'Comparez votre progression avec celle des autres membres.',
        fields: [
            { name: cmd('top'), value: 'Choisissez Argent, Points, Cartes possédées, Picks ou Dailies dans le menu. Les boutons permettent de changer de page.' },
            { name: 'Classement des points', value: `Les points de carte sont notamment obtenus avec ${cmd('discard')}. Changez de catégorie sans relancer la commande.` },
            { name: cmd('profil'), value: 'Affiche une carte de profil Canvas. Le propriétaire peut changer son fond avec le bouton.' },
            { name: cmd('collectioncard', 'user:<membre>'), value: 'Galerie des cartes possédées concernant le membre choisi.' },
            { name: cmd('profil', 'user:<membre>'), value: 'Résumé individuel du solde, des points et du rang.' }
        ]
    },
    quetes: {
        title: 'Quêtes et roue fortune',
        description: 'Progressez autrement que par les tirages.',
        fields: [
            { name: cmd('quetes'), value: 'Affiche les quêtes du jour, votre niveau de quête, vos tickets et les récompenses prêtes.' },
            { name: 'Bouton Réclamer', value: `Le bouton de ${cmd('quetes')} récupère les récompenses terminées et débloque les paliers suivants.` },
            { name: cmd('roue'), value: 'Consomme un ticket pour tourner la roue fortune.' },
            { name: 'Exemples de progression', value: 'Messages envoyés, /pick réussi, /daily récupéré, vente, défausse, trade validé, rankup.' }
        ]
    },
    speciales: {
        title: 'Commandes spéciales',
        description: 'Commandes utiles mais réservées ou plus ponctuelles.',
        fields: [
            { name: cmd('forcepick'), value: 'Tire une carte sans attendre le cooldown. Réservée au propriétaire du bot.' },
            { name: cmd('aide'), value: 'Affiche cette aide avec le menu de catégories.' }
        ]
    }
});

const buildOverviewEmbed = (cmd) => new EmbedBuilder()
    .setColor(HELP_COLOR)
    .setTitle('Aide NewGenCard')
    .setDescription('Commencez avec ces commandes, puis choisissez une catégorie dans le menu pour obtenir plus de détails.')
    .addFields(
        { name: 'Démarrage rapide', value: `${cmd('pick')} -> ${cmd('daily')} -> ${cmd('inv')} -> ${cmd('profil')}` },
        { name: 'Examiner une carte', value: cmd('card') },
        { name: 'Parcourir les cartes', value: `${cmd('cards')} ou ${cmd('guildcollection')}` },
        { name: 'Quêtes et roue', value: `${cmd('quetes')} puis ${cmd('roue')}` },
        { name: 'Catégories disponibles', value: categoryChoices.map(choice => `\`${choice.value}\``).join(' - ') }
    )
    .setFooter({ text: 'Le menu ci-dessous permet de changer de catégorie sans relancer /aide.' });

const buildCategoryEmbed = (category, cmd) => {
    const page = helpPages(cmd)[category];
    return new EmbedBuilder()
        .setColor(HELP_COLOR)
        .setTitle(page.title)
        .setDescription(page.description)
        .addFields(page.fields)
        .setFooter({ text: 'Sélectionnez une autre catégorie dans le menu, ou revenez à l’aperçu.' });
};

const buildHelpSelectRow = (userID, selectedValue = OVERVIEW_VALUE) => {
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`${HELP_CUSTOM_ID_PREFIX}:${userID}`)
        .setPlaceholder('Choisir une catégorie d’aide')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Aperçu')
                .setDescription('Revenir au démarrage rapide.')
                .setValue(OVERVIEW_VALUE)
                .setDefault(selectedValue == OVERVIEW_VALUE),
            ...categoryChoices.map(choice => new StringSelectMenuOptionBuilder()
                .setLabel(choice.label)
                .setDescription(choice.description)
                .setValue(choice.value)
                .setDefault(selectedValue == choice.value))
        );

    return new ActionRowBuilder().addComponents(selectMenu);
};

const buildHelpReply = async (interaction, category = null) => {
    const cmd = await commandMentions(interaction);
    const normalizedCategory = helpPages(cmd)[category] ? category : null;
    const embed = normalizedCategory ? buildCategoryEmbed(normalizedCategory, cmd) : buildOverviewEmbed(cmd);
    return {
        embeds: [embed],
        components: [buildHelpSelectRow(interaction.user.id, normalizedCategory || OVERVIEW_VALUE)]
    };
};

const handleHelpSelect = async (client, interaction) => {
    const parts = interaction.customId.split(':');
    if(parts.length != 2 || parts[0] != HELP_CUSTOM_ID_PREFIX) return false;

    const ownerID = parts[1];
    if(interaction.user.id != ownerID){
        await interaction.reply({
            content: 'Ce menu d’aide ne t’appartient pas.',
            flags: MessageFlags.Ephemeral
        });
        return true;
    }

    const selectedCategory = interaction.values[0] == OVERVIEW_VALUE ? null : interaction.values[0];
    await interaction.update(await buildHelpReply(interaction, selectedCategory));
    return true;
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('aide')
        .setDescription('Explique les commandes et le fonctionnement du bot')
        .addStringOption(option => option
            .setName('categorie')
            .setDescription('Partie du bot pour laquelle vous avez besoin d’aide')
            .addChoices(...categoryChoices.map(choice => ({ name: choice.name, value: choice.value }))))
        .setDMPermission(false),

    async execute(interaction) {
        const category = interaction.options.getString('categorie');
        await interaction.reply({
            ...(await buildHelpReply(interaction, category)),
            flags: MessageFlags.Ephemeral
        });
    },

    handleHelpSelect
};
