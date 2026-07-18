const { EmbedBuilder } = require('discord.js');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const apiDB = require("./apiDB");
const buttonCenter = require("../functions/buttonCenter")

const constants = require("../data/constants")

const getStringLinePaquetsList = async() => {
    let baltopList = await apiDB.getCardPointstopRowsList()

    let paquetsList = []

    let totalPaquetNumber = baltopList.length%constants.USERSPERBALTOPPAGE != 0 ? parseInt(baltopList.length/constants.USERSPERBALTOPPAGE) + 1 : parseInt(baltopList.length/constants.USERSPERBALTOPPAGE)

    for(let currentPaquet = 0; currentPaquet<totalPaquetNumber; currentPaquet++){
        paquetsList.push([])
        for(let currentUserIndex = 0; currentUserIndex<constants.USERSPERBALTOPPAGE; currentUserIndex++){
            if(baltopList[currentPaquet*constants.USERSPERBALTOPPAGE+currentUserIndex] == undefined){
                break
            }
            paquetsList[currentPaquet].push(baltopList[currentPaquet*constants.USERSPERBALTOPPAGE+currentUserIndex])
        }
    }
    return paquetsList

}


const getEmbedFromPointstopPaquet = (guildIconUrl, currentPage, totalPageNumber, baltopPaquet) => {

    return new EmbedBuilder()
    .setColor('#D72306')
    .setTitle(`PointsTop`)
        .addFields({ name: 'Classement :', value: getEmbedFormatStringForPointstop(baltopPaquet, currentPage) })
    .setTimestamp()
    .setFooter({ text: `Page ${currentPage.toString()} sur ${totalPageNumber.toString()}`});
}


const getEmbedFormatStringForPointstop = (baltopPaquet, currentPage) => {

    if(!baltopPaquet.length) return "";
    
    let embedFormatString = `${((currentPage-1)*constants.USERSPERBALTOPPAGE + 1).toString()} • ${baltopPaquet[0].name}  -  ${baltopPaquet[0].cardPoints.toString()} pts`

    for(let currentUserIndex = 1; currentUserIndex<baltopPaquet.length; currentUserIndex++){
        embedFormatString = embedFormatString + `\n${((currentPage-1)*constants.USERSPERBALTOPPAGE + currentUserIndex + 1).toString()} • ${baltopPaquet[currentUserIndex].name}  -  ${baltopPaquet[currentUserIndex].cardPoints.toString()} pts`
    }

    return embedFormatString
}


const getSwitchPagesButtons = async (client, genesisInteraction, currentPage, pointstopPaquets, requestedUser) => {
    let buttonGroupID = await buttonCenter.registerAButtonGroup(client, expirationFunction, genesisInteraction, {pointstopPaquets:pointstopPaquets, currentPage:currentPage})

	let nextPageButtonID = await buttonCenter.registerAButton(client, "NextPagePointstop", buttonGroupID, nextPageFunction, {pointstopPaquets:pointstopPaquets, currentPage:currentPage, requestedUser:requestedUser}, false, [genesisInteraction.user.id])

	let previousPageButton = await buttonCenter.registerAButton(client, "PreviousPagePointstop", buttonGroupID, preivousPageFunction, {pointstopPaquets:pointstopPaquets, currentPage:currentPage, requestedUser:requestedUser}, false, [genesisInteraction.user.id])

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
    if(currentPage == pointstopPaquets.length){
        buttonRows.components[1].setDisabled(true)
    }

	return buttonRows
}


const expirationFunction = async (client, genesisInteraction, customDataDictionary) => {
    //rien je suppose...
}

const nextPageFunction = async (client, currentInteraction, genesisInteraction, customDataDictionary) => {
    let buttonRows = await getSwitchPagesButtons(client, genesisInteraction, customDataDictionary.currentPage + 1, customDataDictionary.pointstopPaquets, customDataDictionary.requestedUser)
    await genesisInteraction.editReply({embeds:[getEmbedFromPointstopPaquet(genesisInteraction.guild.iconURL(), customDataDictionary.currentPage + 1, customDataDictionary.pointstopPaquets.length, customDataDictionary.pointstopPaquets[customDataDictionary.currentPage])], components:[buttonRows]})
    currentInteraction.deferUpdate()
}

const preivousPageFunction = async (client, currentInteraction, genesisInteraction, customDataDictionary) => {
    let buttonRows = await getSwitchPagesButtons(client, genesisInteraction, customDataDictionary.currentPage - 1, customDataDictionary.pointstopPaquets, customDataDictionary.requestedUser)
    await genesisInteraction.editReply({embeds:[getEmbedFromPointstopPaquet(genesisInteraction.guild.iconURL(), customDataDictionary.currentPage - 1, customDataDictionary.pointstopPaquets.length, customDataDictionary.pointstopPaquets[customDataDictionary.currentPage-2])], components:[buttonRows]})
    currentInteraction.deferUpdate()
}







module.exports = {
    getStringLinePaquetsList,
    getEmbedFromPointstopPaquet,
    getSwitchPagesButtons
};
