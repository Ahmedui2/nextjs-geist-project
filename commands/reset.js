const { logEvent } = require('./logs_system');
const name = 'reset';

async function execute(message, args, { points, saveData, BOT_OWNERS, client }) {
  if (!BOT_OWNERS.includes(message.author.id)) {
    return message.reply('**هذا الأمر مخصص لمالكي البوت فقط!**');
  }

  for (const responsibility in points) {
    points[responsibility] = {};
  }
  saveData();

  logEvent(client, message.guild, {
    type: 'POINT_LOGS',
    title: 'Points Reset',
    description: 'All points have been reset.',
    user: message.author
  });

  await message.channel.send('**تم تصفير جميع النقاط بنجاح!**');
}

module.exports = { name, execute };