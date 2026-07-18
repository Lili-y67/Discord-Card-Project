const { SlashCommandBuilder } = require('discord.js');

const apiDB = require("../functions/apiDB")

const transactionFunctions = require("../functions/secondLayerTransactionFunctions")
const tradeFunctions = require("../functions/secondLayerTradeFunctions")
const constants = require("../data/constants")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("trade")
        .setDescription("Échanger des cartes et ou de l'argent avec un autre joueur")
        .addUserOption(option => option.setName("user").setDescription("Personne à qui vous proposez l'échange").setRequired(true))
        .addIntegerOption(option => option.setName("argent_proposé").setDescription("Argent que vous proposez"))
        .addStringOption(option => option.setName("cartes_proposées").setDescription("Cartes que vous proposez | 36, 44, 23, 75 | 10 max"))
        .addIntegerOption(option => option.setName("argent_demandé").setDescription("Argent que vous demandez"))
        .addStringOption(option => option.setName("cartes_demandées").setDescription("Cartes que vous demandez | 163, 13, 96, 3 | 10 max"))
        .setDMPermission(false),
    async execute(interaction) {

        await interaction.deferReply();

        if(interaction.options.getUser("user", false) == null){
			await interaction.editReply(`Vous devez renseigner un partenaire d'échange`)
			return;
		}

        let proposedMoney

        if(interaction.options.getInteger("argent_proposé", false) == null){
            proposedMoney = 0
		}
        else{
            proposedMoney = interaction.options.getInteger("argent_proposé", false)
        }

        let proposedCardString

        if(interaction.options.getString("cartes_proposées", false) == null){
            proposedCardString = ""
		}
        else{
            proposedCardString = interaction.options.getString("cartes_proposées", false)
        }




        let askedMoney

        if(interaction.options.getInteger("argent_demandé", false) == null){
            askedMoney = 0
		}
        else{
            askedMoney = interaction.options.getInteger("argent_demandé", false)
        }

        let askedCardsString

        if(interaction.options.getString("cartes_demandées", false) == null){
            askedCardsString = ""
		}
        else{
            askedCardsString = interaction.options.getString("cartes_demandées", false)
        }


        if(proposedMoney < 0){
            await interaction.editReply(`La somme que vous avez proposée est invalide`)
            return;
        }

        if(askedMoney < 0){
            await interaction.editReply(`La somme que vous avez demandée est invalide`)
            return;
        }

        let payer = proposedMoney<askedMoney ? "asked" : proposedMoney==askedMoney ? "none" : "proposing"

        let amount = payer == "asked" ? askedMoney-proposedMoney : payer == "proposing" ? proposedMoney-askedMoney : 0

        let userRequested = interaction.options.getUser("user", false)

        if(userRequested.id == interaction.user.id){
            await interaction.editReply(`Non, vous ne pouvez pas faire d'échange avec vous même...`)
            return;
        }

        await apiDB.prepareUser(interaction.user.id.toString(), interaction.user.username)
        await apiDB.prepareUser(userRequested.id.toString(), userRequested.username)

        let proposedCardsIDListTest = tradeFunctions.turnCardsStringInCardsIDList(proposedCardString)
        let askedCardsIDListTest = tradeFunctions.turnCardsStringInCardsIDList(askedCardsString)

        if(!proposedCardsIDListTest.valid){
            await interaction.editReply(`Les cartes proposées sont invalides`)
            return;
        }

        if(!askedCardsIDListTest.valid){
            await interaction.editReply(`Les cartes demandées sont invalides`)
            return;
        }

        if(proposedCardsIDListTest.cardsIDList.length > constants.CARDSPERPAGE){
            await interaction.editReply(`Vous proposez trop de cartes à la fois`)
            return;
        }

        if(askedCardsIDListTest.cardsIDList.length > constants.CARDSPERPAGE){
            await interaction.editReply(`Vous demandez trop de cartes à la fois`)
            return;
        }


        if(!await tradeFunctions.doUserOwnEveryCardInList(proposedCardsIDListTest.cardsIDList, interaction.user.id)){
            await interaction.editReply(`Vous ne possédez pas toutes les cartes que vous avez proposées`)
            return;
        }

        if(!await tradeFunctions.doUserOwnEveryCardInList(askedCardsIDListTest.cardsIDList, userRequested.id)){
            await interaction.editReply(`Votre partenaire d'affaires ne possède pas toutes les cartes que vous avez demandées`)
            return;
        }

        if(await apiDB.bulkIsACardLocked(proposedCardsIDListTest.cardsIDList)){
            await interaction.editReply(`Au moins une des cartes que vous proposez est lock`)
            return;
        }

        if(await apiDB.bulkIsACardLocked(askedCardsIDListTest.cardsIDList)){
            await interaction.editReply(`Au moins une des cartes que vous demandez est lock`)
            return;
        }

        if(payer != "none"){
            if(payer == "asked"){
                if(!await apiDB.hasEnoughMoney(userRequested.id, amount)){
                    await interaction.editReply(`Votre partenaire d'affaires ne possède pas assez d'argent pour cet échange`)
                    return;
                }
            }
            else{
                if(!await apiDB.hasEnoughMoney(interaction.user.id, amount)){
                    await interaction.editReply(`Vous ne possédez pas assez d'argent pour cet échange`)
                    return;
                }
            }
        }

        if(amount == 0 && proposedCardsIDListTest.cardsIDList.length == 0 && askedCardsIDListTest.cardsIDList.length == 0){
            await interaction.editReply(`Ce trade me semble un peu inutile...`)
            return;
        }

        await apiDB.bulkLock(proposedCardsIDListTest.cardsIDList)
        await apiDB.bulkLock(askedCardsIDListTest.cardsIDList)

        let embedList = [await tradeFunctions.getTradeEmbed(interaction.user, userRequested, proposedCardsIDListTest.cardsIDList, askedCardsIDListTest.cardsIDList, payer, amount)]

        let buttonRows = await tradeFunctions.getTradeButtonsActionRow(interaction.client, interaction, interaction.user, userRequested, proposedCardsIDListTest.cardsIDList, askedCardsIDListTest.cardsIDList, payer, amount, embedList[0])

        await interaction.editReply({embeds: embedList, components: [buttonRows]})
    },
};