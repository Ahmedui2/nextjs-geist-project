const { Client, GatewayIntentBits, Partials, Collection, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const { logEvent } = require('./commands/logs_system');
const { startReminderSystem } = require('./commands/notifications');
const { checkCooldown, startCooldown } = require('./commands/cooldown');

dotenv.config();

const PREFIX = '.';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages],
  partials: [Partials.Channel]
});

const BOT_OWNERS = process.env.BOT_OWNERS ? process.env.BOT_OWNERS.split(',') : [];
const ADMIN_ROLES = process.env.ADMIN_ROLES ? process.env.ADMIN_ROLES.split(',') : [];

client.commands = new Collection();

// Load commands from the "commands" folder
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  try {
    const command = require(path.join(commandsPath, file));
    if ('name' in command && 'execute' in command) {
      client.commands.set(command.name, command);
      console.log(`Loaded command: ${command.name}`);
    }
  } catch (error) {
    console.error(`Error loading command ${file}:`, error);
  }
}

// Data storage
let responsibilities = {};
let points = {};

// Load data from JSON files if exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}
const responsibilitiesFile = path.join(dataDir, 'responsibilities.json');
const pointsFile = path.join(dataDir, 'points.json');
const logConfigFile = path.join(dataDir, 'logConfig.json');

if (fs.existsSync(responsibilitiesFile)) {
  responsibilities = JSON.parse(fs.readFileSync(responsibilitiesFile, 'utf8'));
}
if (fs.existsSync(pointsFile)) {
  points = JSON.parse(fs.readFileSync(pointsFile, 'utf8'));
}
if (fs.existsSync(logConfigFile)) {
  client.logConfig = JSON.parse(fs.readFileSync(logConfigFile, 'utf8'));
} else {
  client.logConfig = {
    settings: {}
  };
}

function saveData() {
  fs.writeFileSync(responsibilitiesFile, JSON.stringify(responsibilities, null, 2));
  fs.writeFileSync(pointsFile, JSON.stringify(points, null, 2));
  fs.writeFileSync(logConfigFile, JSON.stringify(client.logConfig, null, 2));
}

client.once('ready', () => {
  console.log('**بوت المسؤوليات جاهز للعمل!**');
  startReminderSystem(client, responsibilities);
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  const command = client.commands.get(commandName);
  if (!command) return;

  try {
    await command.execute(message, args, { responsibilities, points, saveData, BOT_OWNERS, ADMIN_ROLES, client });
  } catch (error) {
    console.error(error);
    message.reply('**حدث خطأ أثناء تنفيذ الأمر!**');
  }
});

// Store active tasks to prevent multiple claims
if (!client.activeTasks) {
  client.activeTasks = new Map();
}

// Global interaction handler
client.on('interactionCreate', async interaction => {
  try {
    // Handle log system interactions
    if (interaction.customId.startsWith('log_')) {
        const logCommand = client.commands.get('log');
        if (logCommand && logCommand.handleInteraction) {
            await logCommand.handleInteraction(interaction, client, saveData);
        }
        return;
    }

    // Handle cooldown system interactions
    if (interaction.customId.startsWith('cooldown_')) {
        const cooldownCommand = client.commands.get('cooldown');
        if (cooldownCommand && cooldownCommand.handleInteraction) {
            await cooldownCommand.handleInteraction(interaction);
        }
        return;
    }

    // Handle claim buttons
    if (interaction.isButton() && interaction.customId.startsWith('claim_task_')) {
      const parts = interaction.customId.split('_');
      const responsibilityName = parts[2];
      const timestamp = parts[3];
      const requesterId = parts[4];
      const taskId = `${responsibilityName}_${timestamp}`;

      // Check if task is already claimed
      if (client.activeTasks.has(taskId)) {
        const claimedBy = client.activeTasks.get(taskId);
        return interaction.reply({
          content: `**تم استلام هذه المهمة من قبل ${claimedBy}**`,
          flags: 64
        });
      }

      // Mark task as claimed
      const guild = client.guilds.cache.first();
      let displayName = interaction.user.username;
      if (guild) {
        try {
          const member = await guild.members.fetch(interaction.user.id);
          displayName = member.displayName || member.user.displayName || member.user.username;
        } catch (error) {
          console.error('Failed to fetch member:', error);
        }
      }
      
      client.activeTasks.set(taskId, displayName);

      // Add point to user
      if (!points[responsibilityName]) points[responsibilityName] = {};
      points[responsibilityName][interaction.user.id] = (points[responsibilityName][interaction.user.id] || 0) + 1;
      saveData();

      // Update message to remove button completely
      await interaction.update({
        content: `**تم استلام المهمة من قبل ${displayName}**`,
        components: []
      });

      // Send notification to requester
      try {
        const requester = await client.users.fetch(requesterId);
        await requester.send(`**تم استلام دعوتك من مسؤول الـ${responsibilityName} وهو ${displayName}**`);
      } catch (error) {
        console.error('Failed to send notification to requester:', error);
      }

      // Notify all other responsibles that task was claimed
      if (responsibilities[responsibilityName] && responsibilities[responsibilityName].responsibles) {
        const responsibles = responsibilities[responsibilityName].responsibles;
        for (const userId of responsibles) {
          if (userId !== interaction.user.id) {
            try {
              const user = await client.users.fetch(userId);
              await user.send(`**تم استلام المهمة الخاصة بـ${responsibilityName} من قبل ${displayName}**`);
            } catch (error) {
              console.error(`Failed to notify user ${userId}:`, error);
            }
          }
        }
      }

      // Log the task claimed event
      logEvent(client, guild, {
          type: 'TASK_LOGS',
          title: 'Task Claimed',
          description: `Responsibility: **${responsibilityName}**`,
          user: interaction.user,
          fields: [
              { name: 'Claimed By', value: `<@${interaction.user.id}> (${displayName})`, inline: true },
              { name: 'Requester', value: `<@${requesterId}>`, inline: true },
              { name: 'Channel', value: `<#${interaction.channelId}>`, inline: true }
          ]
      });

      return;
    }

    // Handle modal submissions for setup
    if (interaction.isModalSubmit() && interaction.customId.startsWith('setup_reason_modal_')) {
      const customIdParts = interaction.customId.replace('setup_reason_modal_', '').split('_');
      const responsibilityName = customIdParts[0];
      const target = customIdParts[1];
      const reason = interaction.fields.getTextInputValue('reason').trim();

      if (!responsibilities[responsibilityName]) {
        return interaction.reply({ content: '**المسؤولية غير موجودة!**', flags: 64 });
      }

      const responsibility = responsibilities[responsibilityName];
      const responsibles = responsibility.responsibles || [];

      if (responsibles.length === 0) {
        return interaction.reply({ content: '**لا يوجد مسؤولين معينين لهذه المسؤولية.**', flags: 64 });
      }

      // Check cooldown
      const cooldownTime = checkCooldown(interaction.user.id, responsibilityName);
      if (cooldownTime > 0) {
        return interaction.reply({
          content: `**لقد استخدمت هذا الأمر مؤخرًا. يرجى الانتظار ${Math.ceil(cooldownTime / 1000)} ثانية أخرى.**`,
          flags: 64
        });
      }

      // Start cooldown for user
      startCooldown(interaction.user.id, responsibilityName);

      // Get stored image URL for this user
      const storedImageUrl = client.setupImageData?.get(interaction.user.id);

      const embed = new EmbedBuilder()
        .setTitle(`**طلب مساعدة في المسؤولية: ${responsibilityName}**`)
        .setDescription(`**السبب:** ${reason}\n**من:** ${interaction.user}`)
        .setColor('#0099ff');

      // Add image if available
      if (storedImageUrl) {
        embed.setImage(storedImageUrl);
      }

      const claimButton = new ButtonBuilder()
        .setCustomId(`claim_task_${responsibilityName}_${Date.now()}_${interaction.user.id}`)
        .setLabel('استلام')
        .setStyle(ButtonStyle.Success);

      const buttonRow = new ActionRowBuilder().addComponents(claimButton);

      if (target === 'all') {
        // Send to all responsibles
        let sentCount = 0;
        for (const userId of responsibles) {
          try {
            const user = await client.users.fetch(userId);
            await user.send({ embeds: [embed], components: [buttonRow] });
            sentCount++;
          } catch (error) {
            console.error(`Failed to send DM to user ${userId}:`, error);
          }
        }
        await interaction.reply({ content: `**تم إرسال الطلب لـ ${sentCount} من المسؤولين.**`, flags: 64 });
      } else {
        // Send to specific user
        try {
          const user = await client.users.fetch(target);
          await user.send({ embeds: [embed], components: [buttonRow] });
          await interaction.reply({ content: `**تم إرسال الطلب إلى ${user.username}.**`, flags: 64 });
        } catch (error) {
          await interaction.reply({ content: '**فشل في إرسال الرسالة الخاصة.**', flags: 64 });
        }
      }

      // Log the task requested event
        logEvent(client, interaction.guild, {
            type: 'TASK_LOGS',
            title: 'Task Requested',
            description: `Responsibility: **${responsibilityName}**`,
            user: interaction.user,
            fields: [
                { name: 'Reason', value: reason, inline: false },
                { name: 'Target', value: target === 'all' ? 'All' : `<@${target}>`, inline: true }
            ]
        });
      return;
    }

  } catch (error) {
    console.error('Error in global interaction handler:', error);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '**حدث خطأ أثناء معالجة الطلب.**', flags: 64 });
      }
    } catch (replyError) {
      // Ignore error if interaction already acknowledged
      if (replyError.code !== 40060) {
        console.error('Failed to send error reply:', replyError);
      }
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
