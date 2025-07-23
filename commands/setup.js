const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { logEvent } = require('./logs_system');
const { checkCooldown } = require('./cooldown');

const name = 'setup';

async function execute(message, args, { responsibilities, points, saveData, BOT_OWNERS, client }) {
  if (!BOT_OWNERS.includes(message.author.id)) {
    return message.reply('**هذا الأمر مخصص لمالكي البوت فقط!**');
  }

  // Show image source selection buttons
  const serverBannerButton = new ButtonBuilder()
    .setCustomId('setup_use_server_banner')
    .setLabel('استعمال بنر السيرفر')
    .setStyle(ButtonStyle.Primary);

  const customImageButton = new ButtonBuilder()
    .setCustomId('setup_use_custom_image')
    .setLabel('استعمال صورة أخرى')
    .setStyle(ButtonStyle.Secondary);

  const imageSourceRow = new ActionRowBuilder().addComponents(serverBannerButton, customImageButton);

  const initialEmbed = new EmbedBuilder()
    .setTitle('**إعداد المسؤوليات**')
    .setDescription('**اختر مصدر الصورة:**')
    .setColor('#0099ff');

  const sentMessage = await message.channel.send({ 
    embeds: [initialEmbed], 
    components: [imageSourceRow] 
  });

  // Handle image source selection
  const imageSourceFilter = i => i.user.id === message.author.id && i.message.id === sentMessage.id;
  const imageSourceCollector = message.channel.createMessageComponentCollector({ 
    filter: imageSourceFilter,
    time: 600000
  });

  imageSourceCollector.on('collect', async interaction => {
    try {
      if (interaction.customId === 'setup_use_server_banner') {
        // Use server banner
        let bannerUrl = null;
        try {
          const guild = message.guild;
          if (guild.banner) {
            bannerUrl = guild.bannerURL({ format: 'png', size: 1024 });
          }
        } catch (error) {
          console.error('Error fetching server banner:', error);
        }

        if (!bannerUrl) {
          return interaction.reply({ 
            content: '**لا يوجد بنر للسيرفر! يرجى اختيار صورة أخرى.**', 
            ephemeral: true 
          });
        }

        // Ask for text to display with banner
        await interaction.reply({ 
          content: '**هل تريد إضافة نص مع البنر؟ (اكتب النص المطلوب أو اكتب 0 إذا لم تريد نص)**', 
          ephemeral: true 
        });

        // Wait for text response
        const textFilter = m => m.author.id === message.author.id;
        const textCollector = message.channel.createMessageCollector({ 
          filter: textFilter, 
          time: 60000, 
          max: 1 
        });

        textCollector.on('collect', async (msg) => {
          try {
            await msg.delete().catch(() => {});
            const customText = msg.content.trim();
            const displayText = customText === '0' ? null : customText;
            
            try {
              logEvent(client, message.guild, {
                type: 'SETUP_TEXT_INPUT',
                description: 'تم إدخال نص للإعداد',
                user: { id: message.author.id },
                details: displayText || 'لا يوجد نص'
              });
            } catch (logError) {
              console.error('Failed to log text input:', logError);
            }

            // Setup channel collector
            const channelFilter = m => m.author.id === message.author.id;
            const channelCollector = message.channel.createMessageCollector({ 
              filter: channelFilter,
              time: 60000,
              max: 1
            });

            channelCollector.on('collect', async (channelMsg) => {
              try {
                let targetChannel = null;
                
                // Check if it's a channel mention
                if (channelMsg.mentions.channels.size > 0) {
                  targetChannel = channelMsg.mentions.channels.first();
                } else {
                  // Try to get channel by ID
                  const channelId = channelMsg.content.trim();
                  try {
                    targetChannel = await message.guild.channels.fetch(channelId);
                  } catch (error) {
                    await channelMsg.reply('**لم يتم العثور على الروم! يرجى المحاولة مرة أخرى.**');
                    return;
                  }
                }

                if (!targetChannel || !targetChannel.isTextBased()) {
                  await channelMsg.reply('**يرجى منشن روم نصي صحيح أو كتابة آي دي صحيح!**');
                  return;
                }

                // Create a fake interaction object for consistency
                const fakeInteraction = {
                  user: msg.author,
                  reply: async (options) => channelMsg.reply(options),
                  update: async (options) => sentMessage.edit(options)
                };
                await handleImageSelection(fakeInteraction, bannerUrl, responsibilities, message, client, displayText, targetChannel);
              } catch (error) {
                console.error('Error in channel collector:', error);
              }
            });

            channelCollector.on('end', (collected) => {
              try {
                if (collected.size === 0) {
                  message.channel.send('**انتهت مهلة انتظار الروم.**');
                }
              } catch (error) {
                console.error('Error in channel collector end:', error);
              }
            });
          } catch (error) {
            console.error('Error in text collector:', error);
          }
        });

        textCollector.on('end', (collected) => {
          if (collected.size === 0) {
            message.channel.send('**انتهت مهلة انتظار النص. سيتم استخدام البنر بدون نص.**');
            const fakeInteraction = {
              user: interaction.user,
              reply: async (options) => message.channel.send(options.content || 'تم المتابعة'),
              update: async (options) => sentMessage.edit(options)
            };
            handleImageSelection(fakeInteraction, bannerUrl, responsibilities, message, client, null);
          }
        });
        
      } else if (interaction.customId === 'setup_use_custom_image') {
        // Request custom image
        await interaction.reply({ 
          content: '**يرجى إرفاق صورة أو إرسال رابط الصورة:**', 
          flags: 64 
        });

        // Wait for image from user
        const imageFilter = m => m.author.id === message.author.id;
        const imageCollector = message.channel.createMessageCollector({ 
          filter: imageFilter, 
          time: 120000, 
          max: 1 
        });

        imageCollector.on('collect', async (msg) => {
          let imageUrl = null;
          
          if (msg.attachments.size > 0) {
            const attachment = msg.attachments.first();
            if (attachment.contentType && attachment.contentType.startsWith('image/')) {
              imageUrl = attachment.url;
            } else {
              return msg.reply('**يرجى إرفاق صورة صالحة!**');
            }
          } else if (msg.content.trim()) {
            const url = msg.content.trim();
            if (url.startsWith('http://') || url.startsWith('https://')) {
              // Basic URL validation for images
              if (url.match(/\.(jpeg|jpg|gif|png|webp)$/i) || url.includes('cdn.discordapp.com') || url.includes('media.discordapp.net')) {
                imageUrl = url;
              } else {
                return msg.reply('**يرجى إرسال رابط صورة صالح!**');
              }
            } else {
              return msg.reply('**يرجى إرسال رابط صحيح أو إرفاق صورة!**');
            }
          } else {
            return msg.reply('**يرجى إرفاق صورة أو إرسال رابط!**');
          }

          if (imageUrl) {
            // Ask for text to display with image
            await msg.reply('**هل تريد إضافة نص مع الصورة؟ (اكتب النص المطلوب أو اكتب 0 إذا لم تريد نص)**');

            // Wait for text response
            const textFilter = m => m.author.id === message.author.id;
            const textCollector = message.channel.createMessageCollector({ 
              filter: textFilter, 
              time: 60000, 
              max: 1 
            });

            textCollector.on('collect', async (textMsg) => {
              const customText = textMsg.content.trim();
              const displayText = customText === '0' ? null : customText;
              
              // Ask for channel to send menu
              await textMsg.reply('**منشن الروم أو اكتب آي دي الروم الذي تريد إرسال المنيو فيه:**');
              
              // Wait for channel response
              const channelFilter = m => m.author.id === message.author.id;
              const channelCollector = message.channel.createMessageCollector({ 
                filter: channelFilter, 
                time: 60000, 
                max: 1 
              });

              channelCollector.on('collect', async (channelMsg) => {
                let targetChannel = null;
                
                // Check if it's a channel mention
                if (channelMsg.mentions.channels.size > 0) {
                  targetChannel = channelMsg.mentions.channels.first();
                } else {
                  // Try to get channel by ID
                  const channelId = channelMsg.content.trim();
                  try {
                    targetChannel = await message.guild.channels.fetch(channelId);
                  } catch (error) {
                    return channelMsg.reply('**لم يتم العثور على الروم! يرجى المحاولة مرة أخرى.**');
                  }
                }

                if (!targetChannel || !targetChannel.isTextBased()) {
                  return channelMsg.reply('**يرجى منشن روم نصي صحيح أو كتابة آي دي صحيح!**');
                }

                // Create a fake interaction object for consistency
                const fakeInteraction = {
                  user: msg.author,
                  reply: async (options) => channelMsg.reply(options),
                  update: async (options) => sentMessage.edit(options)
                };
                await handleImageSelection(fakeInteraction, imageUrl, responsibilities, message, client, displayText, targetChannel);
              });

              channelCollector.on('end', (collected) => {
                if (collected.size === 0) {
                  message.channel.send('**انتهت مهلة انتظار الروم.**');
                }
              });
            });

            textCollector.on('end', (collected) => {
              if (collected.size === 0) {
                message.channel.send('**انتهت مهلة انتظار النص. سيتم استخدام الصورة بدون نص.**');
                const fakeInteraction = {
                  user: msg.author,
                  reply: async (options) => message.channel.send(options.content || 'تم المتابعة'),
                  update: async (options) => sentMessage.edit(options)
                };
                handleImageSelection(fakeInteraction, imageUrl, responsibilities, message, client, null);
              }
            });
          }
        });

        imageCollector.on('end', (collected) => {
          if (collected.size === 0) {
            message.channel.send('**انتهت مهلة انتظار الصورة.**');
          }
        });
      }
    } catch (error) {
      console.error('Error in image source selection:', error);
      try {
        await interaction.reply({ 
          content: '**حدث خطأ أثناء معالجة الطلب.**', 
          flags: 64 
        });
      } catch (replyError) {
        console.error('Failed to send error reply:', replyError);
      }
    }
  });
}

async function handleImageSelection(interaction, imageUrl, responsibilities, message, client, customText = null, targetChannel = null) {
  try {
    // Build select menu options from responsibilities
    const options = Object.keys(responsibilities).map(key => ({
      label: key,
      value: key
    }));

    if (options.length === 0) {
      return interaction.reply({ 
        content: '**لا توجد مسؤوليات معرفة حتى الآن.**', 
        flags: 64 
      });
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('setup_select_responsibility')
      .setPlaceholder('اختر مسؤولية')
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
      .setImage(imageUrl)
      .setColor('#0099ff');

    // Add custom text if provided
    if (customText) {
      embed.setDescription(`**${customText}**`);
    }

    // Send to target channel if specified, otherwise reply normally
    if (targetChannel) {
      try {
        await targetChannel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: `**تم إرسال المنيو إلى ${targetChannel}**`, flags: 64 });
      } catch (error) {
        console.error('Failed to send to target channel:', error);
        await interaction.reply({ content: '**فشل في إرسال المنيو للروم المحدد!**', flags: 64 });
        return;
      }
    } else {
      let updateOptions;
      if (interaction.update) {
        updateOptions = { embeds: [embed], components: [row] };
        await interaction.update(updateOptions);
      } else {
        updateOptions = { embeds: [embed], components: [row] };
        await interaction.reply(updateOptions);
      }
    }

    // Store the image URL for later use
    if (!client.setupImageData) {
      client.setupImageData = new Map();
    }
    client.setupImageData.set(message.author.id, imageUrl);

    // Collector for select menu
    const filter = i => i.user.id === message.author.id && i.customId === 'setup_select_responsibility';
    const collector = message.channel.createMessageComponentCollector({ filter, time: 600000 });

    collector.on('collect', async interaction => {
      try {
        const selected = interaction.values[0];
        const responsibility = responsibilities[selected];
        if (!responsibility) {
          return interaction.reply({ content: '**المسؤولية غير موجودة!**', flags: 64 });
        }

        const desc = responsibility.description && responsibility.description.toLowerCase() !== 'لا'
          ? responsibility.description
          : '**لا يوجد شرح**';

        // Build buttons for each responsible with their nicknames
        const buttons = [];
        if (responsibility.responsibles && responsibility.responsibles.length > 0) {
          for (const userId of responsibility.responsibles) {
            try {
              const member = await message.guild.members.fetch(userId);
              const displayName = member.displayName || member.user.username;
              buttons.push(
                new ButtonBuilder()
                  .setCustomId(`setup_contact_${selected}_${userId}`)
                  .setLabel(displayName)
                  .setStyle(ButtonStyle.Primary)
              );
            } catch (error) {
              console.error(`Failed to fetch member ${userId}:`, error);
              buttons.push(
                new ButtonBuilder()
                  .setCustomId(`setup_contact_${selected}_${userId}`)
                  .setLabel(`مستخدم ${userId}`)
                  .setStyle(ButtonStyle.Primary)
              );
            }
          }
        }

        const allButton = new ButtonBuilder()
          .setCustomId(`setup_contact_${selected}_all`)
          .setLabel('الكل')
          .setStyle(ButtonStyle.Success);

        buttons.push(allButton);

        const buttonsRow = new ActionRowBuilder().addComponents(...buttons.slice(0, 5));
        const buttonsRow2 = buttons.length > 5 ? new ActionRowBuilder().addComponents(...buttons.slice(5, 10)) : null;

        const components = [buttonsRow];
        if (buttonsRow2) components.push(buttonsRow2);

        await interaction.reply({
          content: `**المسؤولية:** ${selected}\n**الشرح:** ${desc}`,
          components: components,
          flags: 64
        });

        // Handle button clicks for contacting responsibles
        const buttonCollector = message.channel.createMessageComponentCollector({ 
          filter: i => i.user.id === message.author.id && i.customId.startsWith('setup_contact_'), 
          time: 600000 
        });

        buttonCollector.on('collect', async buttonInteraction => {
          try {
            const parts = buttonInteraction.customId.split('_');
            const responsibilityName = parts[2];
            const target = parts[3]; // userId or 'all'

            // Check cooldown before showing modal
            const cooldownTime = checkCooldown(buttonInteraction.user.id, responsibilityName);
            if (cooldownTime > 0) {
              return buttonInteraction.reply({
                content: `**لقد استخدمت هذا الأمر مؤخرًا. يرجى الانتظار ${Math.ceil(cooldownTime / 1000)} ثانية أخرى.**`,
                flags: 64
              });
            }

            // Show modal to enter reason only
            const modal = new ModalBuilder()
              .setCustomId(`setup_reason_modal_${responsibilityName}_${target}_${Date.now()}`)
              .setTitle('أدخل سبب الحاجة للمسؤول');

            const reasonInput = new TextInputBuilder()
              .setCustomId('reason')
              .setLabel('السبب')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
              .setPlaceholder('اكتب سبب الحاجة للمسؤول...')
              .setMaxLength(1000);

            const reasonRow = new ActionRowBuilder().addComponents(reasonInput);
            modal.addComponents(reasonRow);

            await buttonInteraction.showModal(modal);
          } catch (error) {
            console.error('Error in button collector:', error);
            try {
              await buttonInteraction.reply({ 
                content: '**حدث خطأ أثناء معالجة الطلب.**', 
                flags: 64 
              });
            } catch (replyError) {
              console.error('Failed to send error reply:', replyError);
            }
          }
        });

      } catch (error) {
        console.error('Error in responsibility selection:', error);
        try {
          await interaction.reply({ 
            content: '**حدث خطأ أثناء معالجة الطلب.**', 
            flags: 64 
          });
        } catch (replyError) {
          console.error('Failed to send error reply:', replyError);
        }
      }
    });

  } catch (error) {
    console.error('Error in handleImageSelection:', error);
    try {
      await interaction.reply({ 
        content: '**حدث خطأ أثناء معالجة الصورة.**', 
        flags: 64 
      });
    } catch (replyError) {
      console.error('Failed to send error reply:', replyError);
    }
  }
}

module.exports = { name, execute };
