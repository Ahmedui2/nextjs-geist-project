const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, ActivityType } = require('discord.js');

const name = 'vip';

async function execute(message, args, { BOT_OWNERS, client, responsibilities, points, saveData }) {
    console.log('Executing VIP command.');
    if (!BOT_OWNERS.includes(message.author.id)) {
        console.log('User is not a bot owner.');
        return message.reply('**هذا الأمر مخصص لمالكي البوت فقط!**');
    }

    let isPaused = client.isPaused || false;

    const getStatsEmbed = () => new EmbedBuilder()
        .setTitle(' تحكم البوت')
        .setDescription('**اختر ما تريد فعله من الأزرار أدناه.**')
        .setColor('#0099ff')
        .addFields(
            { name: 'عدد المسؤوليات', value: `${Object.keys(responsibilities).length}`, inline: true },
            { name: 'عدد الأعضاء بالنقاط', value: `${Object.keys(points).length}`, inline: true },
            { name: 'الحالة', value: isPaused ? ' موقوف مؤقتاً' : 'نشط', inline: true },
            { name: 'الـ Uptime', value: `${Math.floor(process.uptime() / 60)} دقيقة`, inline: true },
            { name: 'عدد السيرفرات', value: `${client.guilds.cache.size}`, inline: true }
        );

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('vip_stats').setLabel(' الحالة العامة').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('vip_prefix').setLabel('تغيير البريفكس').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('vip_pause').setLabel(isPaused ? ' تشغيل البوت' : 'إيقاف مؤقت').setStyle(ButtonStyle.Danger)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('vip_status').setLabel('حالة البوت').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('vip_playing').setLabel(' نشاط البوت').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('vip_avatar').setLabel('صورة الأفتار').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('vip_banner').setLabel(' البنر (بروفايل)').setStyle(ButtonStyle.Primary)
    );

    const sentMessage = await message.channel.send({ embeds: [getStatsEmbed()], components: [row1, row2] });
    console.log('VIP panel sent.');

    const filter = i => i.user.id === message.author.id;
    const collector = message.channel.createMessageComponentCollector({ filter, time: 600000 });

    collector.on('collect', async interaction => {
        console.log(`Button pressed: ${interaction.customId}`);
        if (interaction.customId === 'vip_stats') {
            await interaction.update({ embeds: [getStatsEmbed()] });
        }

        if (interaction.customId === 'vip_prefix') {
            await interaction.reply({ content: '**أرسل البريفكس الجديد الآن:**', ephemeral: true });
            const msgCollector = interaction.channel.createMessageCollector({ filter, time: 60000, max: 1 });
            msgCollector.on('collect', async msg => {
                console.log(`Prefix changed to: ${msg.content.trim()}`);
                client.prefix = msg.content.trim();
                await msg.reply(`**تم تغيير البريفكس إلى: \`${client.prefix}\`**`);
            });
        }

        if (interaction.customId === 'vip_pause') {
            isPaused = !isPaused;
            client.isPaused = isPaused;
            console.log(`Bot pause status changed: ${isPaused}`);
            await interaction.update({ content: `**تم ${isPaused ? 'إيقاف البوت مؤقتاً ' : 'تشغيل البوت '}**`, embeds: [], components: [] });
        }

        if (interaction.customId === 'vip_status') {
            // Show buttons for status options instead of text input
            const statusRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('status_online').setLabel('Online').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('status_idle').setLabel('Idle').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('status_dnd').setLabel('Do Not Disturb').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('status_streaming').setLabel('Streaming').setStyle(ButtonStyle.Primary)
            );
            await interaction.reply({ content: '**اختر الحالة التي تريد تعيينها:**', components: [statusRow], ephemeral: true });
        } else if (['status_online', 'status_idle', 'status_dnd', 'status_streaming'].includes(interaction.customId)) {
            // Show modal to enter custom status text
            const modal = new ModalBuilder()
                .setCustomId(`vip_status_modal_${interaction.customId}`)
                .setTitle('أدخل نص الحالة');

            const statusInput = new TextInputBuilder()
                .setCustomId('status_text')
                .setLabel('النص الذي سيظهر مع الحالة')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setPlaceholder('اكتب النص هنا');

            const actionRow = new ActionRowBuilder().addComponents(statusInput);
            modal.addComponents(actionRow);

            await interaction.showModal(modal);
        }

        if (interaction.customId === 'vip_playing') {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('play').setLabel('Playing').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('watch').setLabel('Watching').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('listen').setLabel('Listening').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('stream').setLabel('Streaming').setStyle(ButtonStyle.Secondary)
            );

            await interaction.reply({ content: '**Choose activity type:**', components: [row], ephemeral: true });

            const activityCollector = interaction.channel.createMessageComponentCollector({ filter, time: 30000 });

            activityCollector.on('collect', async actInteraction => {
                console.log(`Activity button pressed: ${actInteraction.customId}`);
                if (!['play', 'watch', 'listen', 'stream'].includes(actInteraction.customId)) return;
                const typeMap = {
                    play: ActivityType.Playing,
                    watch: ActivityType.Watching,
                    listen: ActivityType.Listening,
                    stream: ActivityType.Streaming
                };

                await actInteraction.reply({ content: '**Send the text you want to display:**', ephemeral: true });
                const msgCollector = interaction.channel.createMessageCollector({ filter, time: 60000, max: 1 });

                msgCollector.on('collect', async msg => {
                    console.log(`Activity set to ${actInteraction.customId} with text: ${msg.content}`);
                    const options = { type: typeMap[actInteraction.customId] };
                    if (actInteraction.customId === 'stream' || actInteraction.customId === 'watch') {
                        options.url = 'https://www.twitch.tv/twitch';
                    }
                    client.user.setActivity(msg.content, options);
                    await msg.reply('**Bot activity updated.**');
                });
            });
        }

        if (interaction.customId === 'vip_avatar') {
            await interaction.reply({ content: '**أرسل الآن رابط الصورة أو أرفق صورة:**', ephemeral: true });
            const msgCollector = interaction.channel.createMessageCollector({ filter, time: 60000, max: 1 });
            msgCollector.on('collect', async msg => {
                const url = msg.attachments.first()?.url || msg.content;
                console.log(`Avatar URL received: ${url}`);
                if (!url.startsWith('http')) return msg.reply('**رابط غير صحيح!**');
                await client.user.setAvatar(url);
                await msg.reply('**تم تغيير صورة البوت.**');
            });
        }

        if (interaction.customId === 'vip_banner') {
            await interaction.reply({ content: '**أرسل الآن رابط صورة للبنر أو أرفق صورة:**', ephemeral: true });
            const msgCollector = interaction.channel.createMessageCollector({ filter, time: 60000, max: 1 });
            msgCollector.on('collect', async msg => {
                const url = msg.attachments.first()?.url || msg.content;
                console.log(`Banner URL received: ${url}`);
                if (!url.startsWith('http')) return msg.reply('**رابط غير صحيح!**');
                try {
                    await client.user.setBanner(url);
                    await msg.reply('**تم تغيير البنر.**');
                } catch (err) {
                    console.error('Failed to set banner:', err);
                    await msg.reply('**بعض الحسابات لا تدعم البنر في ديسكورد.**');
                }
            });
        }
    });
}

module.exports = { name, execute };
