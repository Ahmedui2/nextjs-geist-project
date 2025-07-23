const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { logEvent, EVENT_TYPES } = require('./logs_system');

const name = 'log';

const LOG_TYPES = Object.keys(EVENT_TYPES);

async function execute(message, args, { saveData, client, BOT_OWNERS }) {
  if (!BOT_OWNERS.includes(message.author.id)) {
    return message.reply('**This command is for bot owners only!**');
  }

  // Initialize logConfig if not present
  if (!client.logConfig) {
    client.logConfig = {};
  }
  if (!client.logConfig.settings) {
    client.logConfig.settings = {};
    for (const type of LOG_TYPES) {
      client.logConfig.settings[type] = { enabled: false, channelId: null };
    }
  }

  if (args.length === 0) {
    // Send a single embed summarizing all log types
    const embed = new EmbedBuilder()
      .setTitle('Log Settings Overview')
      .setColor('#0099ff');

    let description = '';
    for (const type of LOG_TYPES) {
      const setting = client.logConfig.settings[type];
      const eventName = EVENT_TYPES[type].name;
      const status = setting.enabled ? 'Enabled' : 'Disabled';
      const channelMention = setting.channelId ? `<#${setting.channelId}>` : 'No channel set';
      description += `**${eventName}:** ${status} | Channel: ${channelMention}\n`;
    }
    embed.setDescription(description);

    // Buttons for interaction (e.g., refresh, settings)
    const refreshButton = new ButtonBuilder()
      .setCustomId('refresh_logs')
      .setLabel('Refresh')
      .setStyle(ButtonStyle.Primary);

    const settingsButton = new ButtonBuilder()
      .setCustomId('settings_logs')
      .setLabel('Settings')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(refreshButton, settingsButton);

    await message.reply({ embeds: [embed], components: [row] });
    return;
  }

  // Additional subcommand handling can be added here
}

const { ChannelType } = require('discord.js');

async function handleInteraction(interaction, client, saveData) {
  if (!interaction.isButton()) return;

  const customId = interaction.customId;

  if (customId === 'auto_set') {
    await interaction.deferReply({ ephemeral: true });
    const guild = interaction.guild;
    let category = guild.channels.cache.find(c => c.name === 'res' && c.type === ChannelType.GuildCategory);
    if (!category) {
      category = await guild.channels.create({
        name: 'res',
        type: ChannelType.GuildCategory,
        reason: 'Category for bot logs'
      });
    }

    for (const type of LOG_TYPES) {
      client.logConfig.settings[type].enabled = true;
      let channel = guild.channels.cache.find(c => c.name === `logs-${type.toLowerCase()}` && c.parentId === category.id);
      if (!channel) {
        channel = await guild.channels.create({
          name: `logs-${type.toLowerCase()}`,
          type: ChannelType.GuildText,
          parent: category.id,
          reason: 'Auto created log channel'
        });
      }
      client.logConfig.settings[type].channelId = channel.id;
    }

    await saveData(client.points, client.responsibilities, client.logConfig);
    await interaction.editReply({ content: 'Log channels have been automatically set up under the "res" category.' });
    return;
  }

  if (customId === 'disable_all') {
    // Disable all log types and remove channels
    for (const type of LOG_TYPES) {
      client.logConfig.settings[type].enabled = false;
      // Delete the channel if exists
      if (client.logConfig.settings[type].channelId) {
        try {
          const channel = await interaction.guild.channels.fetch(client.logConfig.settings[type].channelId);
          if (channel) {
            await channel.delete('Disabling all log channels');
          }
        } catch (error) {
          console.error(`Failed to delete log channel for ${type}:`, error);
        }
      }
      client.logConfig.settings[type].channelId = null;
    }
    await saveData(client.points, client.responsibilities, client.logConfig);
    try {
      await interaction.update({ content: 'All log types disabled and channels deleted.', components: [], embeds: [] });
    } catch (error) {
      if (error.code === 10062 || error.code === 40060) {
        // Interaction already acknowledged or unknown interaction, ignore
      } else {
        console.error('Error updating interaction:', error);
      }
    }
    return;
  }

  if (customId.startsWith('toggle_')) {
    const type = customId.replace('toggle_', '');
    if (!LOG_TYPES.includes(type)) {
      await interaction.reply({ content: 'Unknown log type.', ephemeral: true });
      return;
    }
    // Toggle enabled state
    client.logConfig.settings[type].enabled = !client.logConfig.settings[type].enabled;
    await saveData(client.points, client.responsibilities, client.logConfig);

    // Update embed and buttons
    const embed = new EmbedBuilder()
      .setTitle('Log Settings Overview')
      .setColor('#0099ff');

    let description = '';
    for (const t of LOG_TYPES) {
      const setting = client.logConfig.settings[t];
      const eventName = EVENT_TYPES[t].name;
      const status = setting.enabled ? 'Enabled' : 'Disabled';
      const channelMention = setting.channelId ? `<#${setting.channelId}>` : 'No channel set';
      description += `**${eventName}:** ${status} | Channel: ${channelMention}\n`;
    }
    embed.setDescription(description);

    const buttons = [];
    for (const t of LOG_TYPES) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`toggle_${t}`)
          .setLabel(`${EVENT_TYPES[t].name}`)
          .setStyle(client.logConfig.settings[t].enabled ? ButtonStyle.Success : ButtonStyle.Secondary)
      );
    }
    buttons.push(
      new ButtonBuilder()
        .setCustomId('auto_set')
        .setLabel('Auto Set')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('disable_all')
        .setLabel('Disable All')
        .setStyle(ButtonStyle.Danger)
    );

    const rows = [];
    for (let i = 0; i < buttons.length; i += 5) {
      rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
    }

    await interaction.update({ embeds: [embed], components: rows });
    return;
  }

  if (customId.startsWith('set_channel_')) {
    const type = customId.replace('set_channel_', '');
    if (!LOG_TYPES.includes(type)) {
      await interaction.reply({ content: 'Unknown log type.', ephemeral: true });
      return;
    }
    // Prompt user to mention channel
    await interaction.reply({ content: `Please mention the channel to set for log type: ${EVENT_TYPES[type].name}`, ephemeral: true });

    const filter = m => m.author.id === interaction.user.id;
    const collector = interaction.channel.createMessageCollector({ filter, time: 60000, max: 1 });

    collector.on('collect', async msg => {
      let channel = null;
      if (msg.mentions.channels.size > 0) {
        channel = msg.mentions.channels.first();
      } else {
        try {
          channel = await interaction.guild.channels.fetch(msg.content.trim());
        } catch {
          await msg.reply('Channel not found. Please try again.');
          return;
        }
      }
      if (!channel || !channel.isTextBased()) {
        await msg.reply('Please mention a valid text channel or provide a valid channel ID.');
        return;
      }
      client.logConfig.settings[type].channelId = channel.id;
      await saveData(client.points, client.responsibilities, client.logConfig);
      await msg.reply(`Log channel for ${EVENT_TYPES[type].name} set to ${channel}.`);

      // Update the settings embed
      const embed = new EmbedBuilder()
        .setTitle('Log Settings Overview')
        .setColor('#0099ff');

      let description = '';
      for (const t of LOG_TYPES) {
        const setting = client.logConfig.settings[t];
        const eventName = EVENT_TYPES[t].name;
        const status = setting.enabled ? 'Enabled' : 'Disabled';
        const channelMention = setting.channelId ? `<#${setting.channelId}>` : 'No channel set';
        description += `**${eventName}:** ${status} | Channel: ${channelMention}\n`;
      }
      embed.setDescription(description);

      const buttons = [];
      for (const t of LOG_TYPES) {
        buttons.push(
          new ButtonBuilder()
            .setCustomId(`toggle_${t}`)
            .setLabel(`${EVENT_TYPES[t].name}`)
            .setStyle(client.logConfig.settings[t].enabled ? ButtonStyle.Success : ButtonStyle.Secondary)
        );
      }
      buttons.push(
        new ButtonBuilder()
          .setCustomId('auto_set')
          .setLabel('Auto Set')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('disable_all')
          .setLabel('Disable All')
          .setStyle(ButtonStyle.Danger)
      );

      const rows = [];
      for (let i = 0; i < buttons.length; i += 5) {
        rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
      }

      await interaction.editReply({ embeds: [embed], components: rows });
    });
    return;
  }
}

module.exports = { name, execute, handleInteraction };

client.login(process.env.DISCORD_TOKEN);
