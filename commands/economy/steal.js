// commands/economy/steal.js

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Profile = require('../../models/Profile');
const { STEAL_CONFIG, EMOJIS } = require('../../gameConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('steal')
        .setDescription('Try to steal from another user by choosing a tactical plan.')
        .addUserOption(option => option.setName('victim').setDescription('The target of your heist.').setRequired(true)),

    async execute(interaction) {
        const attacker = interaction.user;
        const victim = interaction.options.getUser('victim');
        const guildId = interaction.guild.id;

        if (victim.id === attacker.id) {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setDescription('You cannot steal from yourself.');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        if (victim.bot) {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setDescription('You cannot steal from a bot.');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const [attackerProfile, victimProfile] = await Promise.all([
            Profile.findOne({ userId: attacker.id, guildId }),
            Profile.findOne({ userId: victim.id, guildId })
        ]);

        if (!attackerProfile) return interaction.editReply('You need a profile to perform heists.');
        if (!victimProfile || victimProfile.wallet < STEAL_CONFIG.min_wallet) return interaction.editReply(`${victim.username} does not have enough money in their wallet to make the risk worthwhile.`);

        if (attackerProfile.lastSteal && Date.now() - attackerProfile.lastSteal.getTime() < STEAL_CONFIG.cooldown) {
            const remaining = new Date(attackerProfile.lastSteal.getTime() + STEAL_CONFIG.cooldown);
            return interaction.editReply(`You need to wait before your next heist. You can try again <t:${Math.floor(remaining.getTime() / 1000)}:R>.`);
        }
        if (victimProfile.stealProtection && Date.now() - victimProfile.stealProtection.getTime() < STEAL_CONFIG.protection) {
            return interaction.editReply(`${victim.username} is on high alert and cannot be robbed at this time.`);
        }

        const planEmbed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle('Tactical Heist Panel')
            .setDescription(`You are sizing up **${victim.username}**. Their wallet holds **${victimProfile.wallet.toLocaleString()}** ${EMOJIS.coin.text}.\n\nChoose your plan of attack.`)
            .addFields(
                { name: `${STEAL_CONFIG.plans.stealth.name}`, value: STEAL_CONFIG.plans.stealth.description, inline: false },
                { name: `${STEAL_CONFIG.plans.balanced.name}`, value: STEAL_CONFIG.plans.balanced.description, inline: false },
                { name: `${STEAL_CONFIG.plans.aggressive.name}`, value: STEAL_CONFIG.plans.aggressive.description, inline: false }
            );
        
        const components = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('stealth').setLabel('Stealth').setStyle(ButtonStyle.Secondary).setEmoji(EMOJIS.thieft1.id),
            new ButtonBuilder().setCustomId('balanced').setLabel('Balanced').setStyle(ButtonStyle.Secondary).setEmoji(EMOJIS.thieft2.id),
            new ButtonBuilder().setCustomId('aggressive').setLabel('Aggressive').setStyle(ButtonStyle.Danger).setEmoji(EMOJIS.thieft3.id)
        );

        const reply = await interaction.editReply({ embeds: [planEmbed], components: [components] });

        try {
            const confirmation = await reply.awaitMessageComponent({ filter: i => i.user.id === attacker.id, time: 60000 });
            await confirmation.deferUpdate();

            const chosenPlan = STEAL_CONFIG.plans[confirmation.customId];
            attackerProfile.lastSteal = new Date();
            const roll = Math.random();

            if (roll < chosenPlan.successChance) {
                // --- ÉXITO ---
                const amountStolen = Math.floor(victimProfile.wallet * chosenPlan.stealPercent);
                attackerProfile.wallet += amountStolen;
                victimProfile.wallet -= amountStolen;
                
                await Promise.all([attackerProfile.save(), victimProfile.save()]);

                const successEmbed = new EmbedBuilder().setColor(0x57F287).setTitle(`${EMOJIS.done.text} Heist Successful`).setDescription(`Your **${chosenPlan.name}** paid off! You slipped past their defenses and stole **${amountStolen.toLocaleString()}** ${EMOJIS.coin.text} from ${victim.username}.`);
                await interaction.editReply({ embeds: [successEmbed], components: [] });

                const victimDM = new EmbedBuilder().setColor(0xED4245).setTitle('You\'ve Been Robbed!').setDescription(`Someone ambushed you and stole **${amountStolen.toLocaleString()}** ${EMOJIS.coin.text} from your wallet!`);
                await victim.send({ embeds: [victimDM] }).catch(() => {});

            } else {
                // --- FRACASO ---
                if (Math.random() < chosenPlan.caughtChance) {
                    // Atrapado
                    const penaltyAmount = Math.floor(attackerProfile.wallet * chosenPlan.penaltyPercent);
                    attackerProfile.wallet -= penaltyAmount;
                    victimProfile.stealProtection = new Date();
                    
                    await Promise.all([attackerProfile.save(), victimProfile.save()]);

                    const caughtEmbed = new EmbedBuilder().setColor(0xED4245).setTitle(`${EMOJIS.error.text} Busted!`).setDescription(`Your **${chosenPlan.name}** was too reckless! ${victim.username} caught you in the act. You managed to escape, but lost **${penaltyAmount.toLocaleString()}** ${EMOJIS.coin.text} in the process.`);
                    await interaction.editReply({ embeds: [caughtEmbed], components: [] });
                    
                    const victimDM = new EmbedBuilder().setColor(0x57F287).setTitle('Robbery Thwarted!').setDescription(`You caught someone trying to rob you! They fled, and you'll be on high alert for a while.`);
                    await victim.send({ embeds: [victimDM] }).catch(() => {});

                } else {
                    // Escapó
                    await attackerProfile.save();
                    const escapeEmbed = new EmbedBuilder().setColor(0xFEE75C).setTitle('Close Call...').setDescription(`Your **${chosenPlan.name}** failed, but you managed to escape without being seen. You got nothing, but at least you didn't lose anything.`);
                    await interaction.editReply({ embeds: [escapeEmbed], components: [] });
                }
            }
        } catch (err) {
            await interaction.editReply({ content: 'You took too long to choose a plan. The opportunity was lost.', embeds: [], components: [] });
        }
    },
};
