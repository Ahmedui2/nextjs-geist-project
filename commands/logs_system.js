const { EmbedBuilder } = require('discord.js');

const name = 'logs';

const EVENT_TYPES = {
    RESPONSIBILITY_MANAGEMENT: { color: '#00ff00', name: 'Responsibility Management' },
    RESPONSIBLE_MEMBERS: { color: '#00ffff', name: 'Responsible Members' },
    TASK_LOGS: { color: '#0099ff', name: 'Task Logs' },
    POINT_LOGS: { color: '#00aa00', name: 'Point Logs' },
    SETTINGS_LOGS: { color: '#888888', name: 'Settings Logs' },
    CUSTOM: { color: '#0099ff', name: 'Custom Event' }
};

/**
 * Logs a structured event to the configured log channel
 * @param {Client} client - Discord client
 * @param {Guild} guild - Guild where event happened
 * @param {Object} eventData - Event data object
 * @param {string} eventData.type - Event type from EVENT_TYPES
 * @param {string} eventData.title - The title of the log entry
 * @param {string} eventData.description - Event description
 * @param {Object} [eventData.user] - User who triggered the event
 * @param {Object} [eventData.fields] - Additional fields to add to the embed
 */
function logEvent(client, guild, eventData) {
    if (!client.logConfig || !client.logConfig.settings) return;

    const eventType = EVENT_TYPES[eventData.type] || EVENT_TYPES.CUSTOM;
    const logSetting = client.logConfig.settings[eventData.type];

    if (!logSetting || !logSetting.enabled || !logSetting.channelId) return;

    guild.channels.fetch(logSetting.channelId)
        .then(channel => {
            if (!channel || !channel.isTextBased()) return;

            const embed = new EmbedBuilder()
                .setTitle(eventData.title)
                .setDescription(eventData.description)
                .setColor(eventType.color)
                .setTimestamp();

            if (eventData.user) {
                embed.addFields({
                    name: 'Triggered By',
                    value: `<@${eventData.user.id}> (${eventData.user.tag || eventData.user.username})`,
                    inline: false
                });
            }

            if (eventData.fields) {
                embed.addFields(eventData.fields);
            }

            embed.setFooter({
                text: `Server: ${guild.name}`,
                iconURL: guild.iconURL() || undefined
            });

            channel.send({ embeds: [embed] }).catch(console.error);
        })
        .catch(console.error);
}

module.exports = {
    name,
    logEvent,
    EVENT_TYPES
};
