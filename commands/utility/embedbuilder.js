// commands/utility/embed.js

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, ChannelType, ComponentType } = require('discord.js');
const { EMOJIS } = require('../../gameConfig');

// --- Intérprete de Variables Dinámicas ---
const parseVariables = (text, interaction) => {
    if (!text) return text;
    const user = interaction.user;
    const guild = interaction.guild;
    const channel = interaction.channel;
    const clientUser = interaction.client.user;

    const serverIconURL = guild.iconURL();

    return text
        .replace(/{user.mention}/gi, user.toString())
        .replace(/{user.tag}/gi, user.tag)
        .replace(/{user}/gi, user.username)
        .replace(/{user:(\d{17,19})}/gi, (match, userId) => `<@${userId}>`)
        .replace(/{bot}/gi, clientUser.username)
        .replace(/{server.name}/gi, guild.name)
        .replace(/{server.icon}/gi, serverIconURL || '')
        .replace(/{server.membercount}/gi, guild.memberCount.toString())
        .replace(/{channel.name}/gi, channel.name)
        .replace(/{channel.mention}/gi, channel.toString())
        // --- NUEVO: Añadimos la variable para mencionar canales por ID ---
        .replace(/{channel:(\d{17,19})}/gi, (match, channelId) => `<#${channelId}>`)
        .replace(/{role:(\d{17,19})}/gi, (match, roleId) => `<@&${roleId}>`)
        .replace(/{time}/gi, new Date().toLocaleTimeString(interaction.locale, { hour: '2-digit', minute: '2-digit' }))
        .replace(/{date}/gi, new Date().toLocaleDateString(interaction.locale));
};

const parseUrlVariable = (text, interaction) => {
    if (!text) return undefined;
    const lowerText = text.toLowerCase();
    if (lowerText === '{user}') return interaction.user.displayAvatarURL();
    if (lowerText === '{bot}') return interaction.client.user.displayAvatarURL();
    if (lowerText === '{server.icon}') return interaction.guild.iconURL();
    if (text.startsWith('http://') || text.startsWith('https://')) return text;
    return undefined;
};


module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Open a GUI to create a custom embed message and send it to a channel of your choice.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        let embedData = {
            color: 0x5865F2,
            title: 'Welcome to the embed builder',
            description: 'You can edit this embed with the buttons at the bottom, each one will edit certain parts of this embed. While you customize the embed, you will see a live preview of it.\n\n> For further questions just type `/help` and select the command to see all the options you have.',
            footer: { text: 'You have 10 minutes to finish your embed' },
        };

        const generateUI = () => {
            const parsedData = JSON.parse(JSON.stringify(embedData));
            
            if (parsedData.title) parsedData.title = parseVariables(parsedData.title, interaction);
            if (parsedData.description) parsedData.description = parseVariables(parsedData.description, interaction);
            if (parsedData.footer?.text) parsedData.footer.text = parseVariables(parsedData.footer.text, interaction);
            if (parsedData.author?.name) parsedData.author.name = parseVariables(parsedData.author.name, interaction);
            if (parsedData.author?.icon_url) parsedData.author.icon_url = parseUrlVariable(parsedData.author.icon_url, interaction);
            if (parsedData.thumbnail?.url) parsedData.thumbnail.url = parseUrlVariable(parsedData.thumbnail.url, interaction);
            if (parsedData.image?.url) parsedData.image.url = parseUrlVariable(parsedData.image.url, interaction);
            if (parsedData.footer?.icon_url) parsedData.footer.icon_url = parseUrlVariable(parsedData.footer.icon_url, interaction);
            
            if (parsedData.fields) {
                parsedData.fields.forEach(field => {
                    field.name = parseVariables(field.name, interaction);
                    field.value = parseVariables(field.value, interaction);
                });
            }

            const currentEmbed = new EmbedBuilder(parsedData);
            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('edit_main').setLabel('Main text').setEmoji(EMOJIS.pen.id).setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('edit_author').setLabel('Author').setEmoji(EMOJIS.pen.id).setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('edit_images').setLabel('Style').setEmoji(EMOJIS.pen.id).setStyle(ButtonStyle.Secondary)
            );
            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('add_field').setLabel('Add field').setEmoji(EMOJIS.pen.id).setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('remove_field').setLabel('Remove field').setEmoji(EMOJIS.pen.id).setStyle(ButtonStyle.Secondary).setDisabled(!embedData.fields || embedData.fields.length === 0),
                new ButtonBuilder().setCustomId('edit_footer').setLabel('Footer').setEmoji(EMOJIS.pen.id).setStyle(ButtonStyle.Secondary)
            );
            const row3 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('publish_embed').setLabel('Send').setEmoji(EMOJIS.paperplane.id).setStyle(ButtonStyle.Success)
            );
            return { embeds: [currentEmbed], components: [row1, row2, row3] };
        };

        const reply = await interaction.editReply(generateUI());
        const message = await interaction.fetchReply();

        const collector = message.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 600000
        });

        collector.on('collect', async i => {
            try {
                if (i.isButton()) {
                    const modalId = `${i.customId}_modal_${i.id}`;
                    let modal;

                    switch (i.customId) {
                        case 'edit_main':
                            modal = new ModalBuilder().setCustomId(modalId).setTitle('Edit main text');
                            modal.addComponents(
                                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel('Title').setStyle(TextInputStyle.Short).setValue(embedData.title || '').setPlaceholder('Make some interesting title').setRequired(false)),
                                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('description').setLabel('Description').setStyle(TextInputStyle.Paragraph).setValue(embedData.description || '').setPlaceholder('You can use variables here...').setRequired(false))
                            );
                            break;
                        case 'edit_author':
                             modal = new ModalBuilder().setCustomId(modalId).setTitle('Edit author');
                            modal.addComponents(
                                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('author_name').setLabel('Author name').setStyle(TextInputStyle.Short).setValue(embedData.author?.name || '').setPlaceholder('Use {user}, {bot}, {role:ID}, etc.').setRequired(false)),
                                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('author_icon').setLabel('Author URL icon').setStyle(TextInputStyle.Short).setValue(embedData.author?.icon_url || '').setPlaceholder('Use {user}, {bot}, o {server.icon}').setRequired(false))
                            );
                            break;
                        case 'edit_images':
                            modal = new ModalBuilder().setCustomId(modalId).setTitle('Edit style');
                             modal.addComponents(
                                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('color').setLabel('Color (Código HEX, ej: #FF5733)').setStyle(TextInputStyle.Short).setValue(typeof embedData.color === 'number' ? `#${embedData.color.toString(16).padStart(6, '0')}` : '').setRequired(false)),
                                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('thumbnail').setLabel('Thumbnail URL').setStyle(TextInputStyle.Short).setValue(embedData.thumbnail?.url || '').setPlaceholder('http:// | https:// | Variables').setRequired(false)),
                                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('image').setLabel('Image URL').setStyle(TextInputStyle.Short).setValue(embedData.image?.url || '').setPlaceholder('http:// | https:// | Variables').setRequired(false))
                            );
                            break;
                        case 'add_field':
                            modal = new ModalBuilder().setCustomId(modalId).setTitle('Add new field');
                            modal.addComponents(
                                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('field_name').setLabel('Field name').setStyle(TextInputStyle.Short).setPlaceholder('Ummm, well, the field name').setRequired(true)),
                                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('field_value').setLabel('Field value').setStyle(TextInputStyle.Paragraph).setPlaceholder('The description of the field').setRequired(true)),
                                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('field_inline').setLabel('Inline? (true/false)').setStyle(TextInputStyle.Short).setValue('false').setRequired(false))
                            );
                            break;
                        case 'edit_footer':
                            modal = new ModalBuilder().setCustomId(modalId).setTitle('Edit footer');
                            modal.addComponents(
                                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('footer_text').setLabel('Footer text').setStyle(TextInputStyle.Short).setValue(embedData.footer?.text || '').setPlaceholder('Anything you want to type in the footer').setRequired(false)),
                                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('footer_icon').setLabel('Footer icon').setStyle(TextInputStyle.Short).setValue(embedData.footer?.icon_url || '').setPlaceholder('URL | Variables').setRequired(false))
                            );
                            break;
                        case 'remove_field':
                        case 'publish_embed':
                            break; 
                        default:
                            await i.deferUpdate();
                            return;
                    }
                    
                    if (modal) {
                        await i.showModal(modal);
                        const modalSubmit = await i.awaitModalSubmit({ filter: mi => mi.customId === modalId, time: 120000 }).catch(() => null);
                        if (!modalSubmit) return;
                        
                        await modalSubmit.deferUpdate();

                        switch (modalSubmit.customId.split('_')[1]) {
                            case 'main':
                                embedData.title = modalSubmit.fields.getTextInputValue('title') || undefined;
                                embedData.description = modalSubmit.fields.getTextInputValue('description') || undefined;
                                break;
                            case 'author':
                                embedData.author = { 
                                    name: modalSubmit.fields.getTextInputValue('author_name') || undefined,
                                    icon_url: modalSubmit.fields.getTextInputValue('author_icon') || undefined
                                };
                                break;
                            case 'images':
                                const color = modalSubmit.fields.getTextInputValue('color');
                                if (color && /^#[0-9A-F]{6}$/i.test(color)) embedData.color = parseInt(color.replace('#', ''), 16);
                                else if (!color) embedData.color = undefined;
                                
                                embedData.thumbnail = { url: modalSubmit.fields.getTextInputValue('thumbnail') || undefined };
                                embedData.image = { url: modalSubmit.fields.getTextInputValue('image') || undefined };
                                break;
                            case 'field':
                                const name = modalSubmit.fields.getTextInputValue('field_name');
                                const value = modalSubmit.fields.getTextInputValue('field_value');
                                const inline = modalSubmit.fields.getTextInputValue('field_inline')?.toLowerCase() === 'true';
                                if (!embedData.fields) embedData.fields = [];
                                embedData.fields.push({ name, value, inline });
                                break;
                            case 'footer':
                                embedData.footer = { 
                                    text: modalSubmit.fields.getTextInputValue('footer_text') || undefined,
                                    icon_url: modalSubmit.fields.getTextInputValue('footer_icon') || undefined
                                };
                                break;
                        }
                    }
                }

                if (i.customId === 'remove_field' || i.customId === 'publish_embed') {
                    await i.deferUpdate();
                    let menu;
                    if (i.customId === 'remove_field') {
                        if (!embedData.fields || embedData.fields.length === 0) return;
                        menu = new StringSelectMenuBuilder().setCustomId('remove_field_select').setPlaceholder('Select a field to delete...').addOptions(embedData.fields.map((field, index) => ({ label: field.name.substring(0, 100), value: index.toString() })));
                    } else {
                        menu = new StringSelectMenuBuilder().setCustomId('publish_channel_select').setPlaceholder('Select a channel to publish...').addOptions(interaction.guild.channels.cache.filter(c => c.type === ChannelType.GuildText).map(c => ({ label: c.name, value: c.id })));
                    }
                    await interaction.editReply({ components: [new ActionRowBuilder().addComponents(menu)] });
                    
                    const menuSubmit = await reply.awaitMessageComponent({ filter: mi => mi.user.id === i.user.id, componentType: ComponentType.StringSelect, time: 60000 }).catch(() => null);
                    if (!menuSubmit) {
                        await interaction.editReply(generateUI());
                        return;
                    }
                    
                    if (menuSubmit.customId === 'remove_field_select') {
                        embedData.fields.splice(parseInt(menuSubmit.values[0]), 1);
                        await menuSubmit.update(generateUI());
                    } else {
                        const channelId = menuSubmit.values[0];
                        const channel = await interaction.guild.channels.fetch(channelId);
                        if (channel) {
                            const finalEmbed = new EmbedBuilder(generateUI().embeds[0]);
                            await channel.send({ embeds: [finalEmbed] });
                            const embed = new EmbedBuilder().setColor(0x2ECC71).setDescription(`${EMOJIS.check.text} The embed has been sent successfully in ${channel}.`).setTimestamp();
                            await menuSubmit.update({ embeds: [embed], components: [] });
                            return collector.stop();
                        }
                    }
                }

                await interaction.editReply(generateUI());

            } catch (error) {
                console.error("Error en el colector del embed builder:", error);
            }
        });

        collector.on('end', () => {
            const closeEmbed = new EmbedBuilder().setColor(0xED4245).setTitle('Session Expired').setDescription('The Embed Builder session has expired and is no longer active because of inactivity.\n\nUse the command again with `/embed`.').setFooter({ text: 'Use your time wisely' });
            interaction.editReply({ embeds: [closeEmbed], components: [] }).catch(() => {});
        });
    },
};
