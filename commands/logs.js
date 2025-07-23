const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionsBitField } = require('discord.js');
const { EVENT_TYPES } = require('./logs_system');
const fs = require('fs');
const path = require('path');

const name = 'log';
const logConfigFile = path.join(__dirname, '..', 'logConfig.json');

async function execute(message, args, { client, saveData }) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply('**This command is for administrators only!**');
    }

    await sendLogSettings(message.channel, client);
}

async function sendLogSettings(channel, client) {
    const logConfig = client.logConfig;

    const embed = new EmbedBuilder()
        .setTitle('Log Settings')
        .setColor('#0099ff')
        .setDescription('Here you can configure the logging system.');

    const fields = Object.keys(EVENT_TYPES).map(type => {
        const setting = logConfig.settings[type] || { enabled: false, channelId: null };
        const status = setting.enabled ? 'Enabled' : 'Disabled';
        const channelMention = setting.channelId ? `<#${setting.channelId}>` : 'Not set';
        return {
            name: EVENT_TYPES[type].name,
            value: `Status: **${status}**\nChannel: ${channelMention}`,
            inline: true
        };
    });

    embed.addFields(fields);

    const menu = new StringSelectMenuBuilder()
        .setCustomId('log_type_select')
        .setPlaceholder('Select a log type to configure')
        .addOptions(
            Object.keys(EVENT_TYPES).map(type => ({
                label: EVENT_TYPES[type].name,
                value: type
            }))
        );

    const row1 = new ActionRowBuilder().addComponents(menu);

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('auto_set_logs')
            .setLabel('Auto Set')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('disable_all_logs')
            .setLabel('Disable All')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('refresh_logs')
            .setLabel('Refresh')
            .setStyle(ButtonStyle.Primary)
    );

    await channel.send({ embeds: [embed], components: [row1, row2] });
}

async function handleInteraction(interaction, client, saveData) {
    const { customId } = interaction;

    if (customId === 'refresh_logs') {
        await interaction.message.delete();
        await sendLogSettings(interaction.channel, client);
        return interaction.reply({ content: 'Refreshed!', ephemeral: true });
    }

    if (customId === 'auto_set_logs') {
        await interaction.deferReply({ ephemeral: true });
        const guild = interaction.guild;
        let category = guild.channels.cache.find(c => c.name === 'res-logs' && c.type === ChannelType.GuildCategory);
        if (!category) {
            category = await guild.channels.create({
                name: 'res-logs',
                type: ChannelType.GuildCategory,
            });
        }

        for (const type of Object.keys(EVENT_TYPES)) {
            const channelName = EVENT_TYPES[type].name.toLowerCase().replace(/ /g, '-');
            let channel = guild.channels.cache.find(c => c.name === channelName && c.parentId === category.id);
            if (!channel) {
                channel = await guild.channels.create({
                    name: channelName,
                    type: ChannelType.GuildText,
                    parent: category.id,
                });
            }
            client.logConfig.settings[type] = { enabled: true, channelId: channel.id };
        }

        saveData();
        await interaction.message.delete();
        await sendLogSettings(interaction.channel, client);
        return interaction.editReply('Auto setup complete!');
    }

    if (customId === 'disable_all_logs') {
        await interaction.deferReply({ ephemeral: true });
        for (const type of Object.keys(EVENT_TYPES)) {
            client.logConfig.settings[type] = { enabled: false, channelId: null };
        }
        saveData();
        await interaction.message.delete();
        await sendLogSettings(interaction.channel, client);
        return interaction.editReply('All logs disabled!');
    }

    if (interaction.isStringSelectMenu() && customId === 'log_type_select') {
        const type = interaction.values[0];
        const channelSelect = new StringSelectMenuBuilder()
            .setCustomId(`log_channel_select_${type}`)
            .setPlaceholder('Select a channel')
            .addOptions(
                interaction.guild.channels.cache
                    .filter(c => c.type === ChannelType.GuildText)
                    .map(c => ({
                        label: c.name,
                        value: c.id
                    }))
            );
        const row = new ActionRowBuilder().addComponents(channelSelect);
        await interaction.reply({ content: `Select a channel for ${EVENT_TYPES[type].name}`, components: [row], ephemeral: true });
    }

    if (interaction.isStringSelectMenu() && customId.startsWith('log_channel_select_')) {
        const type = customId.replace('log_channel_select_', '');
        const channelId = interaction.values[0];
        client.logConfig.settings[type] = { enabled: true, channelId: channelId };
        saveData();
        await interaction.message.delete();
        await sendLogSettings(interaction.channel, client);
        await interaction.reply({ content: `Set channel for ${EVENT_TYPES[type].name}`, ephemeral: true });
    }
}

module.exports = { name, execute, handleInteraction };
