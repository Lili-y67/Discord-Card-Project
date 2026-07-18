const { EmbedBuilder } = require('discord.js');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const constants = require("../data/constants.js")
const apiDB = require("./apiDB");
const buttonCenter = require("../functions/buttonCenter")
const utilsFunctions = require("../functions/utilsFunctions")
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


const getSimpleCardsStringPaquetsFromCardIDPaquetsList = async (cardIDPaquets) => { //deprecated
    let paquetList = []

    
    for(let currentPaquet = 0; currentPaquet<cardIDPaquets.length; currentPaquet++){

        paquetList.push([])

        for(let currentCardIndex = 0; currentCardIndex<cardIDPaquets[currentPaquet].length; currentCardIndex++){

            let currentCard = await apiDB.getACardFromID(DB, cardIDPaquets[currentPaquet][currentCardIndex].toString())

            let simpleCardText = `<:${await apiDB.getAPlayerEmoteByID(DB, currentCard.playerID.toString())}> • ${cardIDPaquets[currentPaquet][currentCardIndex].toString()} - ${currentCard.playerName} - ${currentCard.rarity} (${currentCard.rarityValue.toString()})`
            paquetList[currentPaquet].push(simpleCardText)
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


const getEmbedListFromSimpleCardsStringPaquetList = (simpleCardsStringPaquetList, user) => { //deprecated

    if(simpleCardsStringPaquetList.length == 0){
        let currentEmbed = new EmbedBuilder()
        .setColor('#D72306')
        .setTitle(`Carte de ${user.username}`)
                .addFields({ name: 'Liste des cartes :', value: "Vous n'avez pas encore aucune carte! Faites /pick" })
        .setTimestamp()
        .setFooter({ text: 'Utilise /pick pour tirer une carte !'});
        return [currentEmbed]
    }


    let embedList = []

    for(let currentEmbedIndex = 0; currentEmbedIndex<simpleCardsStringPaquetList.length; currentEmbedIndex++){

        let simpleCardsTextEmbedFormat = simpleCardsStringPaquetList[currentEmbedIndex][0]

        for(let currentSimpleCardIndex = 1; currentSimpleCardIndex<simpleCardsStringPaquetList[currentEmbedIndex].length; currentSimpleCardIndex++){
            simpleCardsTextEmbedFormat = simpleCardsTextEmbedFormat + "\n" + simpleCardsStringPaquetList[currentEmbedIndex][currentSimpleCardIndex]
        }

        const currentEmbed = new EmbedBuilder()
        .setColor('#D72306')
        .setTitle(`Carte de ${user.username}`)
                .addFields({ name: 'Liste des cartes :', value: simpleCardsTextEmbedFormat })
        .setTimestamp()
        .setFooter({ text: 'Utilise /pick pour tirer une carte !'});

        embedList.push(currentEmbed)

    }

    return embedList

}

const getEmbedFromCardIDPaquet = async (userRequested, pageNumber, totalPageNumber, cardIDPaquet) => {
    let simpleCardsTextList = await getSimpleCardsTextListFromACardIDPaquet(cardIDPaquet)

    let simpleCardsTextEmbedFormat = simpleCardsTextList[0]

    for(let currentSimpleCardTextIndex = 1; currentSimpleCardTextIndex<simpleCardsTextList.length; currentSimpleCardTextIndex++){
        simpleCardsTextEmbedFormat = simpleCardsTextEmbedFormat + "\n" + simpleCardsTextList[currentSimpleCardTextIndex]
    }

    return new EmbedBuilder()
    .setColor('#D72306')
    .setTitle(`Cartes de ${userRequested.username}`)
        .addFields({ name: 'Liste des cartes :', value: simpleCardsTextEmbedFormat })
    .setTimestamp()
    .setFooter({ text: `Page ${pageNumber.toString()} sur ${totalPageNumber.toString()}`});
}

const getSwitchPagesButtons = async (client, genesisInteraction, currentPage, cardIDPaquets, requestedUser) => {
    let buttonGroupID = await buttonCenter.registerAButtonGroup(client, expirationFunction, genesisInteraction, {cardIDPaquets:cardIDPaquets, currentPage:currentPage})

	let nextPageButtonID = await buttonCenter.registerAButton(client, "NextPageInv", buttonGroupID, nextPageFunction, {cardIDPaquets:cardIDPaquets, currentPage:currentPage, requestedUser:requestedUser}, false, [genesisInteraction.user.id])

	let previousPageButton = await buttonCenter.registerAButton(client, "PreviousPageInv", buttonGroupID, preivousPageFunction, {cardIDPaquets:cardIDPaquets, currentPage:currentPage, requestedUser:requestedUser}, false, [genesisInteraction.user.id])

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
    let buttonRows = await getSwitchPagesButtons(client, genesisInteraction, customDataDictionary.currentPage + 1, customDataDictionary.cardIDPaquets, customDataDictionary.requestedUser)
    await genesisInteraction.editReply({embeds:[await getEmbedFromCardIDPaquet(customDataDictionary.requestedUser, customDataDictionary.currentPage + 1, customDataDictionary.cardIDPaquets.length, customDataDictionary.cardIDPaquets[customDataDictionary.currentPage])], components:[buttonRows]})
    currentInteraction.deferUpdate()
}

const preivousPageFunction = async (client, currentInteraction, genesisInteraction, customDataDictionary) => {
    let buttonRows = await getSwitchPagesButtons(client, genesisInteraction, customDataDictionary.currentPage - 1, customDataDictionary.cardIDPaquets, customDataDictionary.requestedUser)
    await genesisInteraction.editReply({embeds:[await getEmbedFromCardIDPaquet(customDataDictionary.requestedUser, customDataDictionary.currentPage - 1, customDataDictionary.cardIDPaquets.length, customDataDictionary.cardIDPaquets[customDataDictionary.currentPage-2])], components:[buttonRows]})
    currentInteraction.deferUpdate()
}



const getNoCardYetEmbed = async (user) => {
    return new EmbedBuilder()
        .setColor('#D72306')
        .setTitle(`Carte de ${user.username}`)
                .addFields({ name: 'Liste des cartes :', value: "Vous n'avez pas encore de carte! Faites /pick" })
        .setTimestamp()
        .setFooter({ text: 'Utilise /pick pour tirer une carte !'});
}

const getSortedCardIDPaquetListForBlitzersInitiation = async (discordID, filter, ascendant) => {
    return getCardIDPaquetsListFromACardIDList(await apiDB.getCardsIDListHUB({ownerID:discordID.toString(), filter:filter, ascendant:ascendant}))
}


const getEmbedListForBlitzersCommand = async (user, filter, ascendant) => { //deprecated

    let userCardsIDList = await apiDB.getCardsListIDOfAUser(DB, user.id)

    userCardsIDList = utilsFunctions.interifyAList(userCardsIDList)

    let sortedCardsList = await sortCardListBy(userCardsIDList, filter, ascendant)

    let cardsIDPaquetsList = getCardIDPaquetsListFromACardIDList(sortedCardsList)

    let simpleCardsPaquetsList = await getSimpleCardsStringPaquetsFromCardIDPaquetsList(cardsIDPaquetsList)


    return getEmbedListFromSimpleCardsStringPaquetList(simpleCardsPaquetsList, user)
}


const sortCardListBy = async (cardIDList, filter, ascendant) => {   //deprecated
    let cardIDListSorted;
    switch (true){
        case(filter.toUpperCase()==constants.PLAYERIDFILTER.toUpperCase()):
            cardIDListSorted = await sortCardByPlayerID(cardIDList)
            break;
        case(filter.toUpperCase()==constants.RARITYVALUEFILTER.toUpperCase()):
            cardIDListSorted = await sortCardByRarityValue(cardIDList)
            break;
        case(filter.toUpperCase()==constants.CARDIDFILTER.toUpperCase()):
            cardIDListSorted = sortCardByID(cardIDList)
            break;
        default:
            cardIDListSorted = cardIDList.reverse()
    };



    cardIDListSorted = ascendant ? cardIDListSorted : cardIDListSorted.reverse()


    return cardIDListSorted

}


const sortCardByRarityValue = async (cardIDList) => {   //deprecated
    let cardIDListAndRarityValue = await getLinkedListCardIDRarityValue(cardIDList)
    cardIDListAndRarityValue = utilsFunctions.sortLinkedList(cardIDListAndRarityValue)
    return getCardIDListFromLinkedList(cardIDListAndRarityValue)
}

const sortCardByPlayerID = async (cardIDList) => {  //deprecated
    let cardIDListAndRarityValue = await getLinkedListCardIDPlayerID(cardIDList)
    cardIDListAndRarityValue = utilsFunctions.sortLinkedList(cardIDListAndRarityValue)
    return getCardIDListFromLinkedList(cardIDListAndRarityValue)
}

const sortCardByID = (cardIDlist) => {  //deprecated
    return cardIDlist.sort(function(a, b){return a - b});
}


const getLinkedListCardIDRarityValue = async (cardIDList) => {  //deprecated
    
    let linkedList = []

    for(var cardIDindex = 0; cardIDindex<cardIDList.length; cardIDindex++){
        linkedList.push([cardIDList[cardIDindex], parseInt((await apiDB.getACardFromID(DB, cardIDList[cardIDindex])).rarityValue)])
    }
    return linkedList
}

const getLinkedListCardIDPlayerID = async (cardIDList) => { //deprecated
    
    let linkedList = []

    for(var cardIDindex = 0; cardIDindex<cardIDList.length; cardIDindex++){
        linkedList.push([cardIDList[cardIDindex], parseInt((await apiDB.getACardFromID(DB, cardIDList[cardIDindex])).playerID)])
    }
    return linkedList
}

const getCardIDListFromLinkedList = (cardIDListAndFilterValue) => { //deprecated
    let cardIDList =  []
    for(let cardIDindex = 0; cardIDindex<cardIDListAndFilterValue.length; cardIDindex++){
        cardIDList.push(cardIDListAndFilterValue[cardIDindex][0])
    }
    return cardIDList
}




module.exports = {
    getEmbedListForBlitzersCommand,
    getSortedCardIDPaquetListForBlitzersInitiation,
    getNoCardYetEmbed,
    getEmbedFromCardIDPaquet,
    getSwitchPagesButtons,
    getSimpleCardsTextListFromACardIDPaquet,
    getCardIDPaquetsListFromACardIDList
};
