const { ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

const name = 'مسؤول';

async function execute(message, args, { responsibilities, points, saveData, ADMIN_ROLES, client }) {
  // Check if user has admin roles
  const member = await message.guild.members.fetch(message.author.id);
  const hasAdminRole = member.roles.cache.some(role => ADMIN_ROLES.includes(role.id));
  if (!hasAdminRole) {
    return message.reply('**هذا الأمر مخصص للإداريين فقط!**');
  }

  // Build select menu options from responsibilities
  const options = Object.keys(responsibilities).map(key => ({
    label: key,
    value: key
  }));

  if (options.length === 0) {
    return message.reply('**لا توجد مسؤوليات معرفة حتى الآن.**');
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('masoul_select_responsibility')
    .setPlaceholder('اختر مسؤولية')
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(selectMenu);

  const sentMessage = await message.channel.send({ content: '**اختر مسؤولية من القائمة:**', components: [row] });

  const filter = i => i.user.id === message.author.id && i.message.id === sentMessage.id;
  const collector = message.channel.createMessageComponentCollector({ filter, time: 600000 });

  collector.on('collect', async interaction => {
    if (interaction.customId === 'masoul_select_responsibility') {
      const selected = interaction.values[0];
      const responsibility = responsibilities[selected];
      if (!responsibility) {
        return interaction.reply({ content: '**المسؤولية غير موجودة!**', flags: 64 });
      }

      // Build buttons for each responsible with their nicknames
      const buttons = [];
      if (responsibility.responsibles && responsibility.responsibles.length > 0) {
        for (const userId of responsibility.responsibles) {
          try {
            const member = await message.guild.members.fetch(userId);
            const displayName = member.displayName || member.user.username;
            buttons.push(
              new ButtonBuilder()
                .setCustomId(`masoul_contact_${selected}_${userId}`)
                .setLabel(displayName)
                .setStyle(ButtonStyle.Primary)
            );
          } catch (error) {
            buttons.push(
              new ButtonBuilder()
                .setCustomId(`masoul_contact_${selected}_${userId}`)
                .setLabel(`User ${userId}`)
                .setStyle(ButtonStyle.Primary)
            );
          }
        }
      }

      const allButton = new ButtonBuilder()
        .setCustomId(`masoul_contact_${selected}_all`)
        .setLabel('الكل')
        .setStyle(ButtonStyle.Success);

      buttons.push(allButton);

      const buttonsRow = new ActionRowBuilder().addComponents(...buttons.slice(0, 5));
      const buttonsRow2 = buttons.length > 5 ? new ActionRowBuilder().addComponents(...buttons.slice(5, 10)) : null;

      const components = [buttonsRow];
      if (buttonsRow2) components.push(buttonsRow2);

      await interaction.reply({
        content: `**المسؤولية: ${selected}**`,
        components: components,
        flags: 64
      });

      // Update the main menu to refresh
      setTimeout(async () => {
        try {
          const newOptions = Object.keys(responsibilities).map(key => ({
            label: key,
            value: key
          }));

          const newSelectMenu = new StringSelectMenuBuilder()
            .setCustomId('masoul_select_responsibility')
            .setPlaceholder('اختر مسؤولية')
            .addOptions(newOptions);

          const newRow = new ActionRowBuilder().addComponents(newSelectMenu);

          await sentMessage.edit({ content: '**اختر مسؤولية من القائمة:**', components: [newRow] });
        } catch (error) {
          console.error('Failed to update menu:', error);
        }
      }, 2000);
    }
  });

  // Handle button clicks for contacting responsibles
  const buttonCollector = message.channel.createMessageComponentCollector({ 
    filter: i => i.user.id === message.author.id && i.customId.startsWith('masoul_contact_'), 
    time: 600000 
  });

  buttonCollector.on('collect', async interaction => {
    try {
      // Check cooldown
      if (!client.responsibilityCooldown) {
        client.responsibilityCooldown = { time: 0, users: {} };
      }

      const cooldownTime = client.responsibilityCooldown.time || 0;
      const userId = interaction.user.id;
      const now = Date.now();

      if (cooldownTime > 0 && client.responsibilityCooldown.users[userId]) {
        const timeLeft = client.responsibilityCooldown.users[userId] + cooldownTime - now;
        if (timeLeft > 0) {
          const secondsLeft = Math.ceil(timeLeft / 1000);
          return interaction.reply({ 
            content: `**يجب الانتظار ${secondsLeft} ثانية قبل إرسال طلب آخر.**`, 
            flags: 64 
          });
        }
      }

      const parts = interaction.customId.split('_');
      const responsibilityName = parts[2];
      const target = parts[3]; // userId or 'all'

      // Show modal to enter reason
      const modal = new ModalBuilder()
        .setCustomId(`masoul_reason_modal_${responsibilityName}_${target}_${Date.now()}`)
        .setTitle('أدخل سبب الحاجة للمسؤول');

      const reasonInput = new TextInputBuilder()
        .setCustomId('reason')
        .setLabel('السبب')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setPlaceholder('اكتب سبب الحاجة للمسؤول (اختياري)');

      const actionRow = new ActionRowBuilder().addComponents(reasonInput);
      modal.addComponents(actionRow);

      await interaction.showModal(modal);
    } catch (error) {
      console.error('Error in button collector:', error);
      try {
        await interaction.reply({ content: '**حدث خطأ أثناء معالجة الطلب.**', flags: 64 });
      } catch (replyError) {
        console.error('Failed to send error reply:', replyError);
      }
    }
  });
}

module.exports = { name, execute };