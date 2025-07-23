const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

const name = 'cooldown';
const cooldownsFile = path.join(__dirname, '..', 'cooldowns.json');

let cooldowns = {};
if (fs.existsSync(cooldownsFile)) {
    cooldowns = JSON.parse(fs.readFileSync(cooldownsFile, 'utf8'));
}

function saveCooldowns() {
    fs.writeFileSync(cooldownsFile, JSON.stringify(cooldowns, null, 2));
}

async function execute(message, args, { responsibilities }) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply('**This command is for administrators only!**');
    }

    const embed = new EmbedBuilder()
        .setTitle('Cooldown Settings')
        .setColor('#0099ff')
        .setDescription('Select a responsibility to configure its cooldown.');

    const menu = new StringSelectMenuBuilder()
        .setCustomId('cooldown_res_select')
        .setPlaceholder('Select a responsibility')
        .addOptions(
            { label: 'All', value: 'all' },
            ...Object.keys(responsibilities).map(res => ({
                label: res,
                value: res
            }))
        );

    const row = new ActionRowBuilder().addComponents(menu);
    await message.channel.send({ embeds: [embed], components: [row] });
}

async function handleInteraction(interaction) {
    const { customId } = interaction;

    if (interaction.isStringSelectMenu() && customId === 'cooldown_res_select') {
        const responsibility = interaction.values[0];
        const currentCooldown = cooldowns[responsibility] ? `${cooldowns[responsibility].time / 1000} seconds` : 'Not set';

        const embed = new EmbedBuilder()
            .setTitle(`Cooldown for ${responsibility}`)
            .setColor('#0099ff')
            .setDescription(`Current cooldown: **${currentCooldown}**`);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`cooldown_set_${responsibility}`)
                .setLabel('Set Cooldown')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`cooldown_remove_${responsibility}`)
                .setLabel('Remove Cooldown')
                .setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }

    if (interaction.isButton()) {
        const parts = customId.split('_');
        const action = parts[1];
        const responsibility = parts[2];

        if (action === 'set') {
            const modal = new ModalBuilder()
                .setCustomId(`cooldown_modal_${responsibility}`)
                .setTitle(`Set cooldown for ${responsibility}`);

            const timeInput = new TextInputBuilder()
                .setCustomId('cooldown_time')
                .setLabel('Cooldown time in seconds')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const row = new ActionRowBuilder().addComponents(timeInput);
            modal.addComponents(row);
            await interaction.showModal(modal);
        }

        if (action === 'remove') {
            delete cooldowns[responsibility];
            saveCooldowns();
            await interaction.reply({ content: `Cooldown for ${responsibility} removed.`, ephemeral: true });
        }
    }

    if (interaction.isModalSubmit()) {
        const parts = customId.split('_');
        const responsibility = parts[2];
        const time = parseInt(interaction.fields.getTextInputValue('cooldown_time'));

        if (isNaN(time)) {
            return interaction.reply({ content: 'Invalid time specified.', ephemeral: true });
        }

        cooldowns[responsibility] = { time: time * 1000, users: {} };
        saveCooldowns();
        await interaction.reply({ content: `Cooldown for ${responsibility} set to ${time} seconds.`, ephemeral: true });
    }
}

function checkCooldown(userId, roleId) {
    if (cooldowns[roleId] || cooldowns['all']) {
        const cooldown = cooldowns[roleId] || cooldowns['all'];
        if (cooldown.users[userId]) {
            const remaining = cooldown.users[userId] + cooldown.time - Date.now();
            if (remaining > 0) {
                return remaining;
            }
        }
    }
    return 0;
}

function startCooldown(userId, roleId) {
    if (cooldowns[roleId] || cooldowns['all']) {
        const cooldown = cooldowns[roleId] || cooldowns['all'];
        cooldown.users[userId] = Date.now();
        saveCooldowns();
    }
}

module.exports = {
    name,
    execute,
    handleInteraction,
    checkCooldown,
    startCooldown
};
