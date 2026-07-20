const COMMAND_CHANNEL_SETTING = "commandsChannelID";

async function getCommandsChannelID(apiDB, defaultValue = "") {
    return await apiDB.getPersistentTextSetting(COMMAND_CHANNEL_SETTING, defaultValue);
}

async function setCommandsChannelID(apiDB, channelID) {
    await apiDB.setPersistentTextSetting(COMMAND_CHANNEL_SETTING, channelID || "");
}

module.exports = {
    COMMAND_CHANNEL_SETTING,
    getCommandsChannelID,
    setCommandsChannelID
};
