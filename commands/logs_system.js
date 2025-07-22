const { EmbedBuilder } = require('discord.js');

const name = 'logs';

// Event types with their colors and icons
const EVENT_TYPES = {
    RESPONSIBILITY_CREATED: { color: '#00ff00', icon: '✅', name: 'إنشاء مسؤولية' },
    RESPONSIBILITY_DELETED: { color: '#ff0000', icon: '❌', name: 'حذف مسؤولية' },
    RESPONSIBILITY_UPDATED: { color: '#ffff00', icon: '✏️', name: 'تعديل مسؤولية' },
    RESPONSIBLE_ADDED: { color: '#00ffff', icon: '➕', name: 'إضافة مسؤول' },
    RESPONSIBLE_REMOVED: { color: '#ff8800', icon: '➖', name: 'إزالة مسؤول' },
    TASK_CLAIMED: { color: '#0099ff', icon: '🎯', name: 'استلام مهمة' },
    TASK_REQUESTED: { color: '#9900ff', icon: '📋', name: 'طلب مساعدة' },
    POINTS_ADDED: { color: '#00aa00', icon: '⭐', name: 'إضافة نقاط' },
    POINTS_RESET: { color: '#aa0000', icon: '🔄', name: 'إعادة تعيين النقاط' },
    COOLDOWN_CHANGED: { color: '#888888', icon: '⏰', name: 'تغيير الكولداون' },
    ADMIN_ROLE_ADDED: { color: '#0066ff', icon: '🛡️', name: 'إضافة رول إداري' },
    ADMIN_ROLE_REMOVED: { color: '#ff6600', icon: '🚫', name: 'إزالة رول إداري' },
    BOT_STATUS_CHANGED: { color: '#ff00ff', icon: '🤖', name: 'تغيير حالة البوت' },
    LOG_CHANNEL_SET: { color: '#666666', icon: '📝', name: 'تعيين قناة اللوق' },
    CUSTOM: { color: '#0099ff', icon: '📌', name: 'حدث مخصص' }
};

/**
 * Logs a structured event to the configured log channel
 * @param {Client} client - Discord client
 * @param {Guild} guild - Guild where event happened
 * @param {Object} eventData - Event data object
 * @param {string} eventData.type - Event type from EVENT_TYPES
 * @param {string} eventData.description - Event description
 * @param {Object} [eventData.user] - User who triggered the event
 * @param {Object} [eventData.target] - Target user/role/channel affected
 * @param {string} [eventData.details] - Additional details
 * @param {Object} [eventData.before] - Before state (for updates)
 * @param {Object} [eventData.after] - After state (for updates)
 */
function logEvent(client, guild, eventData) {
    if (!client.logConfig || !client.logConfig.logChannelId) return;
    
    const eventType = EVENT_TYPES[eventData.type] || EVENT_TYPES.CUSTOM;
    
    guild.channels.fetch(client.logConfig.logChannelId)
        .then(channel => {
            if (!channel || !channel.isTextBased()) return;
            
            const embed = new EmbedBuilder()
                .setTitle(`${eventType.icon} ${eventType.name}`)
                .setDescription(eventData.description)
                .setColor(eventType.color)
                .setTimestamp();

            // Add user field if provided
            if (eventData.user) {
                embed.addFields({
                    name: 'المستخدم',
                    value: `<@${eventData.user.id}> (${eventData.user.tag || eventData.user.username})`,
                    inline: true
                });
            }

            // Add target field if provided
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
                    name: 'الهدف',
                    value: targetValue,
                    inline: true
                });
            }

            // Add details if provided
            if (eventData.details) {
                embed.addFields({
                    name: 'التفاصيل',
                    value: eventData.details,
                    inline: false
                });
            }

            // Add before/after states for updates
            if (eventData.before && eventData.after) {
                embed.addFields(
                    {
                        name: 'قبل التغيير',
                        value: typeof eventData.before === 'object' ? JSON.stringify(eventData.before, null, 2) : eventData.before.toString(),
                        inline: true
                    },
                    {
                        name: 'بعد التغيير',
                        value: typeof eventData.after === 'object' ? JSON.stringify(eventData.after, null, 2) : eventData.after.toString(),
                        inline: true
                    }
                );
            }

            // Add footer with server info
            embed.setFooter({
                text: `السيرفر: ${guild.name}`,
                iconURL: guild.iconURL() || undefined
            });

            channel.send({ embeds: [embed] }).catch(console.error);
        })
        .catch(console.error);
}

/**
 * Quick log function for simple messages (backward compatibility)
 * @param {Client} client - Discord client
 * @param {Guild} guild - Guild where event happened
 * @param {string} description - Simple description
 * @param {string} color - Embed color
 */
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
