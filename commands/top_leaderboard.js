const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const name = 'top';

async function execute(message, args, { points }) {
    let page = 0;
    const pageSize = 10;

    const userPoints = {};
    for (const responsibility in points) {
        for (const userId in points[responsibility]) {
            userPoints[userId] = (userPoints[userId] || 0) + points[responsibility][userId];
        }
    }

    const sorted = Object.entries(userPoints)
        .sort((a, b) => b[1] - a[1]);

    if (sorted.length === 0) return message.reply('**لا توجد نقاط بعد.**');

    const medals = ['🥇', '🥈', '🥉'];
    const badge = (points) => points >= 50 ? '🏆' : points >= 25 ? '⭐' : points >= 10 ? '🎖️' : '';

    function buildEmbed() {
        const current = sorted.slice(page * pageSize, (page + 1) * pageSize);
        const desc = current.map(([id, pts], idx) => {
            const rank = page * pageSize + idx + 1;
            const emoji = medals[rank - 1] || `${rank}.`;
            return `${emoji} <@${id}> - **${pts}** نقطة ${badge(pts)}`;
        }).join('\n');

        return new EmbedBuilder()
            .setTitle('🏅 أفضل المسؤولين بالنقاط')
            .setDescription(desc)
            .setColor('#0099ff');
    }

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('prev').setLabel('⬅️ السابق').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('next').setLabel('التالي ➡️').setStyle(ButtonStyle.Secondary)
    );

    const sent = await message.channel.send({ embeds: [buildEmbed()], components: [row] });

    const filter = i => i.user.id === message.author.id;
    const collector = message.channel.createMessageComponentCollector({ filter, time: 300000 });

    collector.on('collect', async interaction => {
        if (interaction.customId === 'next') page++;
        else if (interaction.customId === 'prev') page--;

        const maxPage = Math.ceil(sorted.length / pageSize) - 1;
        if (page < 0) page = 0;
        if (page > maxPage) page = maxPage;

        await interaction.update({ embeds: [buildEmbed()], components: [row] });
    });
}

module.exports = { name, execute };
