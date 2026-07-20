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
        if(interaction.guild){
            addCommands(await interaction.guild.commands.fetch());
        }
        addCommands(await interaction.client.application.commands.fetch());
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
                value: `${cmd('inv')} affiche votre inventaire.\n${cmd('card', 'cardid:<numéro>')} affiche les informations complètes d’une carte.`
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
            { name: cmd('card', 'cardid:<numéro>'), value: 'Affiche le joueur, la rareté, la valeur, le propriétaire, le statut et l’image de la carte.' },
            { name: cmd('cards'), value: 'Parcourt toutes les cartes enregistrées avec un menu pour en afficher une.' },
            { name: cmd('sell', 'cardid:<numéro>'), value: 'Vend une carte à la banque contre de l’argent.' },
            { name: cmd('discard', 'cardid:<numéro>'), value: 'Détruit une carte pour recevoir des points de carte.' }
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
            { name: 'Où trouver le numéro ?', value: `Le \`cardid\` est le numéro unique affiché dans ${cmd('inv')}, ${cmd('cards')} et sur la carte.` }
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
            { name: cmd('top', 'type:<argent|points>'), value: 'Affiche les classements d’argent ou de points de carte.' }
        ]
    },
    echanges: {
        title: 'Échanger avec un membre',
        description: `La commande ${cmd('trade')} permet d’échanger des cartes, de l’argent, ou les deux.`,
        fields: [
            { name: 'Commande minimale', value: `${cmd('trade', 'user:<membre>')} puis ajoutez ce que vous proposez ou demandez.` },
            { name: 'Proposer des cartes', value: 'Dans `cartes_proposées`, séparez les numéros par des virgules : `36, 44, 23`.' },
            { name: 'Demander des cartes', value: 'Utilisez le même format dans `cartes_demandées`. Le maximum est de 10 cartes par côté.' },
            { name: 'Ajouter de l’argent', value: 'Renseignez `argent_proposé` ou `argent_demandé` selon le sens du transfert.' },
            { name: 'Validation', value: 'Vérifiez attentivement le récapitulatif avant d’accepter ou de refuser l’échange.' }
        ]
    },
    classements: {
        title: 'Classements',
        description: 'Comparez votre progression avec celle des autres membres.',
        fields: [
            { name: cmd('top', 'type:Argent'), value: 'Classement des membres selon leur argent. L’option `page` permet de naviguer.' },
            { name: cmd('top', 'type:Points'), value: `Classement selon les points de carte obtenus avec ${cmd('discard')}.` },
            { name: cmd('collectioncard', 'user:<membre>'), value: 'Galerie des cartes possédées concernant le membre choisi.' },
            { name: cmd('profil', 'user:<membre>'), value: 'Résumé individuel du solde, des points et du rang.' }
        ]
    },
    quetes: {
        title: 'Quêtes et roue fortune',
        description: 'Progressez autrement que par les tirages.',
        fields: [
            { name: cmd('quetes'), value: 'Affiche les quêtes du jour, votre niveau de quête, vos tickets et les récompenses prêtes.' },
            { name: cmd('quetes', 'action:reclamer'), value: 'Récupère les récompenses des quêtes terminées.' },
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
        { name: 'Examiner une carte', value: cmd('card', 'cardid:<numéro>') },
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
