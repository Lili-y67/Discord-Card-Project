const { EmbedBuilder } = require('discord.js');

const apiDB = require("./apiDB");

const constants = require("../data/constants")

const giveMoney = async (discordID, amount) => {
	if(amount <= 0) return;
    await apiDB.addMoneyToUser(discordID, amount)
}

const subMoney = async (discordID, amount) => {

	amount = parseInt(amount)

	let currentMoney = await apiDB.getMoneyOfUser(discordID)

	if(currentMoney <= amount){
		amount = currentMoney
	}

	await apiDB.subMoneyToUser(discordID, amount)
}

const getBalanceModificationEmbed = (user, amount) => {

	let valueModif = amount >= 0 ? `+ ${amount.toString()} $` : `${amount.toString()} $`

	let cardEmbed = new EmbedBuilder()
	.setColor('#fc6600')
    .addFields(
	{
		name: "Modification du solde",
		value: valueModif,
		inline:true
	},
	)
    
    return cardEmbed
}

const giveCardPoints = async(discordID, amount) => {
	if(amount <= 0) return;
    await apiDB.addPointsToUser(discordID, amount)
}

const subCardPoints = async (discordID, amount) => {

	amount = parseInt(amount)

	let currentCardPoints = await apiDB.getCardPointsOfUser(discordID)

	if(currentCardPoints <= amount){
		amount = currentCardPoints
	}

	await apiDB.subPointsToUser(discordID, amount)
}

const getWalletEmbed = async (user) => {
	let userDB = await apiDB.getAUserFromDiscordID(user.id)
	return new EmbedBuilder()
	.setColor('#fc6600')
	.setTitle(`Portefeuille de ${user.username}`)
		//.addField('Argent :', `💰 ${userDB.money}$`, true)
	//.addField('Card points : ', `${userDB.cardPoints} points`, true)
	//.addField('Votre rank actuel', `${constants.RANKIDTORANKNAMEDICO[userDB.rankID]}`)
	//.addField('Cartes pick :', `${await apiDB.getPickedCardsNumberOfAUser(user.id)}`, true)
	//.addField('Cartes possédées :', `${await apiDB.getOwnedCardsNumberOfAUser(user.id)}`, true)

	.addFields({name:'Argent :', value:`💰 ${userDB.money}$`, inline:true}, {name:'Card points : ', value:`${userDB.cardPoints} points`, inline:true}, {name: 'Votre rank actuel', value: `${constants.RANKIDTORANKNAMEDICO[userDB.rankID]}`})
	.addFields({name: 'Cartes pick :', value: `${await apiDB.getPickedCardsNumberOfAUser(user.id)}`, inline:true}, {name: 'Cartes possédées :', value: `${await apiDB.getOwnedCardsNumberOfAUser(user.id)}`, inline:true})
	
	.setTimestamp()
	.setFooter({ text: "Vous pouvez gagner de l'argent en tirant des cartes!"});
}


const makeATransactionBetweenUsers = async (userGivingID, userReceivingID, amount) => {

	if(amount <= 0){
		return;
	}

	await apiDB.subMoneyToUser(userGivingID, amount)
	await apiDB.addMoneyToUser(userReceivingID, amount)

}

const getTransactionBetweenUsersCompletedEmbed = (userGiving, userReceiving, amount) => {
	return new EmbedBuilder()
	.setColor('#fc6600')
	.setTitle(`Félicitations`)
		.addFields({ name: `La transaction de ${userGiving.username} a bien été effectuée`, value: `${userReceiving} a reçu ${amount.toString()}$` })
	.setTimestamp()
	.setFooter({ text: "Bravo pour votre générosité!"});
}

module.exports = {
    giveMoney,
	subMoney,
	getBalanceModificationEmbed,
	giveCardPoints,
	subCardPoints,
	getWalletEmbed,
	makeATransactionBetweenUsers,
	getTransactionBetweenUsersCompletedEmbed
};