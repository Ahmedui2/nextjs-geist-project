const { EmbedBuilder } = require('discord.js');

function startReminderSystem(client, responsibilities) {
    setInterval(() => {
        const now = Date.now();

        for (const [name, data] of Object.entries(responsibilities)) {
            if (!data.lastRequestTime || !data.responsibles || data.responsibles.length === 0) continue;

            const minutesPassed = (now - data.lastRequestTime) / (1000 * 60);
            if (minutesPassed >= 10 && !data.reminded) { // مثال: 10 دقائق بدون استلام
                data.reminded = true;
                sendReminder(client, name, data);
            }
        }
    }, 60000); // كل دقيقة يفحص
}

async function sendReminder(client, responsibilityName, data) {
    const embed = new EmbedBuilder()
        .setColor('Orange')
        .setDescription(`⚠️ لم يتم استلام أي مهمة جديدة في مسؤولية **${responsibilityName}** منذ أكثر من 10 دقائق.`)
        .setTimestamp();

    for (const userId of data.responsibles) {
        try {
            const user = await client.users.fetch(userId);
            await user.send({ embeds: [embed] });
        } catch (err) {
            console.error(`فشل في إرسال التذكير إلى ${userId}`);
        }
    }
}

module.exports = { startReminderSystem };
