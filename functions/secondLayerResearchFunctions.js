const { EmbedBuilder } = require('discord.js');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const constants = require("../data/constants.js")
const apiDB = require("./apiDB");
const buttonCenter = require("../functions/buttonCenter")
const cardDisplay = require("./cardDisplay")


const getCardIDPaquetsListFromACardIDList = (cardIDlist) => {
    
    let paquetList = []

    let totalPaquetNumber = cardIDlist.length%constants.CARDSPERPAGE != 0 ? parseInt(cardIDlist.length/constants.CARDSPERPAGE) + 1 : parseInt(cardIDlist.length/constants.CARDSPERPAGE)

    for(let currentPaquet = 0; currentPaquet<totalPaquetNumber; currentPaquet++){
        paquetList.push([])
        for(let currentCardIndex = 0; currentCardIndex<constants.CARDSPERPAGE; currentCardIndex++){
            if(cardIDlist[currentPaquet*constants.CARDSPERPAGE+currentCardIndex] == undefined){
                break
            }
            paquetList[currentPaquet].push(cardIDlist[currentPaquet*constants.CARDSPERPAGE+currentCardIndex])
        }
    }
    return paquetList
}


const getSimpleCardsTextListFromACardIDPaquet = async (cardIDPaquet) => {
    let simpleCardsTextList = []

    for(let currentCardIDIndex = 0; currentCardIDIndex<cardIDPaquet.length; currentCardIDIndex++){
        let currentCard = await apiDB.getACardFromID(cardIDPaquet[currentCardIDIndex].toString())
        simpleCardsTextList.push(cardDisplay.getCardListLine(currentCard))
    }
    return simpleCardsTextList
}


const getEmbedFromCardIDPaquet = async (totalCardsNumber, pageNumber, totalPageNumber, cardIDPaquet) => {
    let simpleCardsTextList = await getSimpleCardsTextListFromACardIDPaquet(cardIDPaquet)

    let simpleCardsTextEmbedFormat = simpleCardsTextList[0]

    for(let currentSimpleCardTextIndex = 1; currentSimpleCardTextIndex<simpleCardsTextList.length; currentSimpleCardTextIndex++){
        simpleCardsTextEmbedFormat = simpleCardsTextEmbedFormat + "\n" + simpleCardsTextList[currentSimpleCardTextIndex]
    }

    return new EmbedBuilder()
    .setColor('#D72306')
    .setTitle(`Résultats de la recherche`)
    .addFields({ name: 'Liste des cartes :', value: simpleCardsTextEmbedFormat })
    .setTimestamp()
    .setFooter({ text: `Page ${pageNumber.toString()} sur ${totalPageNumber.toString()} -- ${totalCardsNumber.toString()} cartes au total!`});
}

const getSwitchPagesButtons = async (client, genesisInteraction, currentPage, cardIDPaquets, requestedUser, totalCardsNumber) => {
    let buttonGroupID = await buttonCenter.registerAButtonGroup(client, expirationFunction, genesisInteraction, {cardIDPaquets:cardIDPaquets, currentPage:currentPage})

	let nextPageButtonID = await buttonCenter.registerAButton(client, "NextPageInvResearch", buttonGroupID, nextPageFunction, {cardIDPaquets:cardIDPaquets, currentPage:currentPage, requestedUser:requestedUser, totalCardsNumber:totalCardsNumber}, false, [genesisInteraction.user.id])

	let previousPageButton = await buttonCenter.registerAButton(client, "PreviousPageInvResearch", buttonGroupID, preivousPageFunction, {cardIDPaquets:cardIDPaquets, currentPage:currentPage, requestedUser:requestedUser, totalCardsNumber:totalCardsNumber}, false, [genesisInteraction.user.id])

	let buttonRows = new ActionRowBuilder()
	.addComponents(
		new ButtonBuilder()
		.setCustomId(previousPageButton)
		.setStyle(ButtonStyle.Primary)
        .setEmoji("⬅️"),

		new ButtonBuilder()
			.setCustomId(nextPageButtonID)
			.setStyle(ButtonStyle.Primary)
            .setEmoji("➡️"),
	);

    if(currentPage == 1){
        buttonRows.components[0].setDisabled(true)
    }
    if(currentPage == cardIDPaquets.length){
        buttonRows.components[1].setDisabled(true)
    }

	return buttonRows
}


const expirationFunction = async (client, genesisInteraction, customDataDictionary) => {
    //rien je suppose...
}

const nextPageFunction = async (client, currentInteraction, genesisInteraction, customDataDictionary) => {
    let buttonRows = await getSwitchPagesButtons(client, genesisInteraction, customDataDictionary.currentPage + 1, customDataDictionary.cardIDPaquets, customDataDictionary.requestedUser, customDataDictionary.totalCardsNumber)
    await genesisInteraction.editReply({embeds:[await getEmbedFromCardIDPaquet(customDataDictionary.totalCardsNumber, customDataDictionary.currentPage + 1, customDataDictionary.cardIDPaquets.length, customDataDictionary.cardIDPaquets[customDataDictionary.currentPage])], components:[buttonRows]})
    currentInteraction.deferUpdate()
}

const preivousPageFunction = async (client, currentInteraction, genesisInteraction, customDataDictionary) => {
    let buttonRows = await getSwitchPagesButtons(client, genesisInteraction, customDataDictionary.currentPage - 1, customDataDictionary.cardIDPaquets, customDataDictionary.requestedUser, customDataDictionary.totalCardsNumber)
    await genesisInteraction.editReply({embeds:[await getEmbedFromCardIDPaquet(customDataDictionary.totalCardsNumber, customDataDictionary.currentPage - 1, customDataDictionary.cardIDPaquets.length, customDataDictionary.cardIDPaquets[customDataDictionary.currentPage-2])], components:[buttonRows]})
    currentInteraction.deferUpdate()
}



const getNoCardFoundEmbed = () => {
    return new EmbedBuilder()
        .setColor('#D72306')
        .setTitle(`Résultats non fructueux`)
        .addFields({ name: 'Aucune carte trouvée', value: "Il n'existe aucune carte avec ces caractéristiques" })
        .setTimestamp()
        .setFooter({ text: 'Vérifiez à nouveau les paramètres saisis !'});
}

const getSortedCardIDPaquetListForBlitzersInitiation = async (discordID, filter, ascendant) => {
    return getCardIDPaquetsListFromACardIDList(await apiDB.getCardsIDListHUB({ownerID:discordID.toString(), filter:filter, ascendant:ascendant}))
}




module.exports = {
    getSortedCardIDPaquetListForBlitzersInitiation,
    getNoCardFoundEmbed,
    getEmbedFromCardIDPaquet,
    getSwitchPagesButtons,
    getSimpleCardsTextListFromACardIDPaquet
};
