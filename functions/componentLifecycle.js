const COMPONENT_LIFETIME_MS = 120000;
const DELETE_EXPIRED_MESSAGE_DELAY_MS = 60000;
const mentionSafety = require("./mentionSafety");

const createExpiresAt = () => Date.now() + COMPONENT_LIFETIME_MS;

const isExpired = (expiresAt) => {
    return Number(expiresAt) > 0 && Date.now() > Number(expiresAt);
}

const getCommandMention = (commandName, commandID) => {
    return commandName && commandID ? `</${commandName}:${commandID}>` : `/${commandName || "la commande"}`;
}

const getExpiredNotice = (commandName, commandID) => {
    return `-# Interaction expirée, refaites ${getCommandMention(commandName, commandID)} pour réafficher.`;
}

const disableComponents = (components) => {
    return components.map(component => disableComponent(component));
}

const disableComponent = (component) => {
    const rawComponent = typeof component.toJSON == "function" ? component.toJSON() : JSON.parse(JSON.stringify(component));
    if([2, 3, 5, 6, 7, 8].includes(rawComponent.type)){
        rawComponent.disabled = true;
    }
    if(rawComponent.type == 2 && !rawComponent.label && !rawComponent.emoji){
        rawComponent.emoji = { name: "⏹️" };
    }
    if(Array.isArray(rawComponent.components)){
        rawComponent.components = disableComponents(rawComponent.components);
    }
    if(rawComponent.accessory){
        rawComponent.accessory = disableComponent(rawComponent.accessory);
    }
    return rawComponent;
}

const appendExpiredNotice = (components, commandName, commandID) => {
    const notice = getExpiredNotice(commandName, commandID);
    return components.map(component => {
        const rawComponent = typeof component.toJSON == "function" ? component.toJSON() : JSON.parse(JSON.stringify(component));
        if(rawComponent.type == 17){
            const alreadyHasNotice = rawComponent.components?.some(child => child.type == 10 && child.content == notice);
            if(!alreadyHasNotice){
                rawComponent.components = [...(rawComponent.components || []), { type: 10, content: notice }];
            }
        }
        return rawComponent;
    });
}

const expireComponents = (components, commandName, commandID) => {
    return appendExpiredNotice(disableComponents(components), commandName, commandID);
}

const scheduleExpiredMessageDeletion = (interaction) => {
    setTimeout(async () => {
        try {
            await interaction.fetchReply();
            await interaction.deleteReply();
        } catch(error) {
            try {
                if(interaction.message?.deletable){
                    await interaction.message.delete();
                }
            } catch(deleteError) {
                return;
            }
        }
    }, DELETE_EXPIRED_MESSAGE_DELAY_MS);
}

const scheduleInteractionExpiration = (interaction, commandName, expiresAt) => {
    const delay = Math.max(Number(expiresAt) - Date.now(), 0);
    setTimeout(async () => {
        try {
            const reply = await interaction.fetchReply();
            await interaction.editReply({
                components: expireComponents(reply.components, commandName, interaction.commandId),
                allowedMentions: mentionSafety.SAFE_ALLOWED_MENTIONS
            });
            scheduleExpiredMessageDeletion(interaction);
        } catch(error) {
            return;
        }
    }, delay);
}

const expireInteractedMessage = async (interaction, commandName, commandID) => {
    await interaction.update({
        components: expireComponents(interaction.message.components, commandName, commandID),
        allowedMentions: mentionSafety.SAFE_ALLOWED_MENTIONS
    });
    scheduleExpiredMessageDeletion(interaction);
}

module.exports = {
    COMPONENT_LIFETIME_MS,
    DELETE_EXPIRED_MESSAGE_DELAY_MS,
    createExpiresAt,
    isExpired,
    scheduleInteractionExpiration,
    expireInteractedMessage,
    expireComponents,
    scheduleExpiredMessageDeletion
};
