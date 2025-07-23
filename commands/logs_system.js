const { EmbedBuilder } = require('discord.js');

const name = 'logs';

const EVENT_TYPES = {
    RESPONSIBILITY_CREATED: { color: '#00ff00', icon: '✅', name: 'Responsibility Created' },
    RESPONSIBILITY_DELETED: { color: '#ff0000', icon: '❌', name: 'Responsibility Deleted' },
    RESPONSIBILITY_UPDATED: { color: '#ffff00', icon: '✏️', name: 'Responsibility Updated' },
    RESPONSIBLE_ADDED: { color: '#00ffff', icon: '➕', name: 'Responsible Added' },
    RESPONSIBLE_REMOVED: { color: '#ff8800', icon: '➖', name: 'Responsible Removed' },
    TASK_CLAIMED: { color: '#0099ff', icon: '🎯', name: 'Task Claimed' },
    TASK_REQUESTED: { color: '#9900ff', icon: '📋', name: 'Task Requested' },
    POINTS_ADDED: { color: '#00aa00', icon: '⭐', name: 'Points Added' },
    POINTS_RESET: { color: '#aa0000', icon: '🔄', name: 'Points Reset' },
    COOLDOWN_CHANGED: { color: '#888888', icon: '⏰', name: 'Cooldown Changed' },
    ADMIN_ROLE_ADDED: { color: '#0066ff', icon: '🛡️', name: 'Admin Role Added' },
    ADMIN_ROLE_REMOVED: { color: '#ff6600', icon: '🚫', name: 'Admin Role Removed' },
    BOT_STATUS_CHANGED: { color: '#ff00ff', icon: '🤖', name: 'Bot Status Changed' },
    LOG_CHANNEL_SET: { color: '#666666', icon: '📝', name: 'Log Channel Set' },
    CUSTOM: { color: '#0099ff', icon: '📌', name: 'Custom Event' }
};

async function logEvent(client, guild, eventData) {
    if (!client.logConfig || !client.logConfig.settings) {
        return;
    }

    const setting = client.logConfig.settings[eventData.type];
    if (!setting || !setting.enabled || !setting.channelId) {
        return;
    }

    const eventType = EVENT_TYPES[eventData.type] || EVENT_TYPES.CUSTOM;

    try {
        const channel = await guild.channels.fetch(setting.channelId);
        if (!channel || !channel.isTextBased()) return;

        const embed = new EmbedBuilder()
            .setTitle(`${eventType.icon} ${eventType.name}`)
            .setDescription(eventData.description)
            .setColor(eventType.color)
            .setTimestamp();

        if (eventData.user) {
            embed.addFields({
                name: 'User',
                value: `<@${eventData.user.id}> (${eventData.user.tag || eventData.user.username})`,
                inline: true
            });
        }

        if (eventData.target) {
            let targetValue = '';
            if (eventData.target.type === 'user') {
                targetValue = `<@${eventData.target.id}>`;
            } else if (eventData.target.type === 'role') {
                targetValue = `<@&${eventData.target.id}>`;
            } else if (eventData.target.type === 'channel') {
                targetValue = `<#${eventData.target.id}>`;
            } else {
                targetValue = eventData.target.name || eventData.target.id;
            }
            embed.addFields({
                name: 'Target',
                value: targetValue,
                inline: true
            });
        }

        if (eventData.details) {
            embed.addFields({
                name: 'Details',
                value: eventData.details,
                inline: false
            });
        }

        if (eventData.before && eventData.after) {
            embed.addFields(
                { name: 'Before', value: String(eventData.before), inline: true },
                { name: 'After', value: String(eventData.after), inline: true }
            );
        }

        embed.setFooter({
            text: `Server: ${guild.name}`,
            iconURL: guild.iconURL() || undefined
        });

        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error(`Failed to send log for event ${eventData.type}:`, error);
    }
}

function quickLog(client, guild, description, color = '#0099ff') {
    logEvent(client, guild, {
        type: 'CUSTOM',
        description: description
    });
}

module.exports = {
    name,
    logEvent,
    quickLog,
    EVENT_TYPES
};
