/**
 * Created by the STEM discord team 
 * @license LGPL-3.0
 */

const _ = require('lodash');
const path = require('path');
const Denque = require('denque');
const shortid = require('shortid');
const Promise = require('bluebird');
const Discord = require('discord.js');
const ExactTrie = require('exact-trie');

const Util = require('./Util');
const Server = require('./Server');
const JsonDictionary = require('./JsonDictionary');

const logger = Util.getLogger();

let botToken;

/**
 * @typedef Suspect
 * @property {string} id
 * @property {object} flags
 * @property {User} user
 */

const ActionType = {
    BanOnJoin: 0,
    UnbanOnVerification: 1,
};

class StemShield {

    /**
     * @param {object} data
     * @param {string} data.token Discord bot token.
     * @param {string} data.host
     * @param {number} data.port
     * @param {object} data.recaptcha
     * @param {string} data.recaptcha.siteKey
     * @param {string} data.recaptcha.secretKey
     * @param {string} data.dataDir Folder in which JSON data will be stored.
     */
    constructor(data) {
        botToken = data.token;
        this._dataDir = data.dataDir;
        this._baseUrl = `${data.host}`;

        this._guildInviteMap = {};
        this._verificationDict = new JsonDictionary({path: path.join(this._dataDir, 'verification.json')});
        this._whitelistDict = new JsonDictionary({path: path.join(this._dataDir, 'whitelist.json')});
        this._guildReportChannelDict = new JsonDictionary({path: path.join(this._dataDir, 'guild-report.json')});

        this._commandPrefix = '!ss';
        this._client = new Discord.Client();
        this._server = new Server({
            bot: this,
            port: data.port,
            recaptcha: data.recaptcha,
            viewDir: path.normalize(path.join(__dirname, '..', 'views')),
            verificationDict: this._verificationDict,
        });

        /**
         * @type {{[string]: Suspect[]}}
         * @private
         */
        this._guildSuspectMap = {};

        this._setupCommands();
        this._setupDiscordJs();
    }

    _setupCommands() {
        const guildCommandHandlerMap = {
            'help': ({message}) => this._showHelp({message}),
            'ping': ({message}) => message.reply('pong!'),
            'prepare': ({message, params}) => this._prepareList({guild: message.guild, message, params}),
            'list': ({message}) => this._showList({message}),
            'spare': ({message, params}) => this._spare({message, params}),
            'kick': ({message}) => this._kick({message}),
            'ban': ({message}) => this._ban({message}),
            'report-here': ({message}) => this._setReport({message, disable: false}),
            'no-report': ({message}) => this._setReport({message, disable: true}),
        };
        this._guildCommandTrie = new ExactTrie();
        for (const subCommand in guildCommandHandlerMap) {
            this._guildCommandTrie.put(`${subCommand}`, guildCommandHandlerMap[subCommand]);
        }
    }

    _setupDiscordJs() {
        const client = this._client;

        client.on('ready', () => {
            logger.info(`Bot logged in as ${client.user.tag}!`);

            const guilds = client.guilds.array();
            const promises = new Array(guilds.length);
            for (let i = 0; i < guilds.length; ++i) {
                const guild = guilds[i];
                const defChannel = Util.getDefaultChannel(guild);
                promises[i] = defChannel.createInvite({}, 'Invite for when the user will complete verification.')
                    .then(invite => this._guildInviteMap[guild.id] = invite);
            }
            Promise.all(promises)
                .catch(error => logger.error('Error occurred while preparing invites on startup:', error));
        });

        client.on('guildCreate', guild => {
            const defChannel = Util.getDefaultChannel(guild);
            defChannel.createInvite({}, 'Invite for when the user will complete verification.')
                .then(invite => this._guildInviteMap[guild.id] = invite)
                .catch(error => logger.error(`Error occurred while preparing invite for server ${guild.name}:`, error));
        });

        client.on('guildMemberAdd', member => {
            Promise.resolve()
                .then(() => this._processNewMember(member))
                .catch(error => logger.error('An error occurred while processing new member:\n', error));
        });

        client.on('message', /** @param {Message} message */message => {
            const content = message.content.trim();
            if (!content.startsWith(this._commandPrefix)) return;

            if (content === this._commandPrefix) {
                return this._showHelp({message});
            }

            const command = content.substring(this._commandPrefix.length).trim();

            let handler;
            if (message.guild) handler = this._guildCommandTrie.getWithCheckpoints(command, ' ');

            if (handler) {
                const params = command.split(' ');
                Promise.resolve()
                    .then(() => handler({message, params}))
                    .catch(error =>
                        message.reply(`an error occurred while fulfilling your request: \`${error.message}\``))
                ;
            }
        });
    }

    /**
     * @param {object} data
     * @param {string} data.guildId
     * @param {number} data.actionType
     * @param {string} [data.userId]
     * @param {object} [data.flags]
     * @param {string} [data.message]
     * @private
     */
    _reportAutomaticAction(data) {
        const channelId = this._guildReportChannelDict.get(data.guildId);
        if (!channelId) return;
        const guild = this._client.guilds.get(data.guildId);
        if (!guild) return;
        const channel = guild.channels.get(channelId);
        if (!channel) return;

        const promise = data.userId ? this._client.fetchUser(data.userId) : Promise.resolve(null);
        return promise
            .then(user => {
                const embed = new Discord.RichEmbed();
                embed.setTimestamp(new Date());

                if (user) {
                    embed.setFooter(`User ID: ${user.id}`);
                }

                if (data.actionType === ActionType.BanOnJoin) {

                    const score = Util.computeScoreFromFlags(data.flags);

                    let flagString;
                    const flagStrings = Util.convertFlagsToStrings(data.flags);
                    if (flagStrings.length === 0) flagString = 'No flags.\n';
                    else flagString = `[${flagStrings.join('] [')}]\n`;

                    let messageString = `<@${user.id}>\n`;
                    messageString += '```asciidoc\n';
                    messageString += `= ${user.tag} (score: ${score})\n`;
                    messageString += flagString;
                    messageString += '```';

                    embed.setAuthor('User was banned on join.', user.displayAvatarURL);
                    embed.setDescription(messageString);
                    embed.setColor('#ad2e27');
                } else if (data.actionType === ActionType.UnbanOnVerification) {
                    embed.setAuthor('User was unbanned after verification.', user.displayAvatarURL);
                    embed.setDescription(`<@${user.id}> ${user.tag}`);
                    embed.setColor('#44ad34');
                } else {
                    embed.setAuthor(data.message);
                    embed.setColor('#888');
                }

                return channel.send(embed);
            });

    }

    /**
     * @param {GuildMember} member
     * @private
     */
    _processNewMember(member) {
        const guild = member.guild;
        return Promise.resolve()
            .then(() => guild.fetchMember(member.user))
            .then(guildMember => {
                const user = guildMember.user;
                const verified = this._whitelistDict.get(user.id);
                if (!!verified) return;

                const flags = Util.computeUserFlags(user);
                const score = Util.computeScoreFromFlags(flags);
                if (score < 3) return;

                return this._banWithVerification(guildMember)
                    .then(() => this._reportAutomaticAction({
                        actionType: ActionType.BanOnJoin,
                        guildId: guild.id,
                        userId: user.id,
                        flags,
                    }));
            });
    }

    /**
     * @param {GuildMember} member
     * @private
     */
    _banWithVerification(member) {
        const {guild, user} = member;

        logger.info(`Banning user "${user.tag}"!`);
        const banId = shortid.generate();

        return Promise.resolve()
            .then(() => user.createDM())
            .then(dmChannel => {
                this._verificationDict.put(banId, {
                    banId,
                    userTag: user.tag,
                    userId: user.id,
                    guildId: guild.id,
                    date: new Date().getTime(),
                });

                const inviteUrl = this._guildInviteMap[guild.id].url;

                let banMessage = `You were banned from *${guild.name}* server for setting off too many security flags.`;
                banMessage += ` The ban will be lifted if you verify yourself on this page:\n\n`;
                banMessage += `${this._baseUrl}/verify/${banId}`;
                banMessage += `\n\nOnce you have verified yourself, you can rejoin the server using this link:\n`;
                banMessage += `${inviteUrl} (click on it even if it says "Invalid Invite")`;
                return Promise.resolve()
                    .then(() => dmChannel.send(banMessage))
                    .then(() => guild.ban(user, {days: 2, reason: 'User triggered too many security flags.'}));
            });
    }

    /**
     * @param {object} data
     * @param {Message} data.banId ID of the ban that needs to be lifted.
     */
    attemptVerification(data) {
        const {banId} = data;

        const ban = this._verificationDict.get(banId);
        if (!ban) throw new Error(`Ban with ${banId} could not be found`);

        const guild = this._client.guilds.get(ban.guildId);
        if (!guild) throw new Error('The guild you were banned from is not available');

        logger.info(`Unbanning user "${ban.userTag}"!`);
        return Promise.resolve()
            .then(() => guild.unban(ban.userId, 'User verified their account.'))
            .then(() => {
                this._verificationDict.delete(banId);
                this._whitelistDict.put(ban.userId, {
                    userId: ban.userId,
                    guildId: guild.id,
                    date: new Date().getTime(),
                });
            })
            .then(() => this._reportAutomaticAction({
                actionType: ActionType.UnbanOnVerification,
                guildId: guild.id,
                userId: ban.userId,
            }));
    }

    /**
     * @param {object} data
     * @param {Message} data.message Message that triggered the command.
     * @private
     */
    _showHelp(data) {
        const {message} = data;
        return message.channel.send(Util.getHelp());
    }

    /**
     * @param {object} data
     * @param {Message} data.message Message that triggered the command.
     * @param {boolean} data.disable If true, the report channel will be removed.
     * @private
     */
    _setReport(data) {
        const {message, disable} = data;
        const channel = message.channel;
        const guild = channel.guild;
        if (disable) {
            this._guildReportChannelDict.delete(guild.id);
            return channel.send('Automatic action reporting disabled.');
        } else {
            this._guildReportChannelDict.put(guild.id, channel.id);
            return channel.send('From now on, automatic actions will be reported to this channel.');
        }
    }

    /**
     * @param {object} data
     * @param {Guild} data.guild Guild based on which the list will be prepared.
     * @param {Message} [data.message] Message that triggered the command.
     * @param {string[]} [data.params] Command params
     * @private
     */
    _prepareList(data = {}) {
        const {guild, message, params} = data;
        const suspectQueue = new Denque();

        let threshold = 3;
        if (params && params.length >= 2) threshold = +params[1];

        logger.info(`Prepping list for guild "${guild.name}" with threshold ${threshold}. (params: ${JSON.stringify(params)})`);
        return Promise.resolve()
            .then(() => guild.fetchMembers())
            .then(() => {
                const members = guild.members.array();
                const potentialSpambots = members.filter(m => Util.isSpamBotName(m.user.username));
                const potentialSpambotUserIds = potentialSpambots.map(m => m.user.id);
                const userPromises = potentialSpambotUserIds.map(id => this._client.fetchUser(id));
                return Promise.all(userPromises);
            })
            .then(users => {
                users.sort((A, B) => A.username.localeCompare(B.username));
                // console.log(users.map(u => u.username));
                for (const user of users) {
                    const flags = Util.computeUserFlags(user);
                    const score = Util.computeScoreFromFlags(flags);
                    if (score >= threshold) {
                        suspectQueue.push({
                            id: user.id,
                            flags,
                            score,
                            user,
                        });
                    }
                }

                this._guildSuspectMap[guild.id] = suspectQueue.toArray();
                if (message) return message.channel.send(`Prepared suspect list with score threshold ${threshold}.`);
            })
            .then(() => {
                if (message) return this._showList({message});
            });
    }

    /**
     * @param {object} data
     * @param {Message} data.message Message that triggered the command.
     * @param {string[]} data.params Command params
     * @private
     */
    _spare(data) {
        const {message, params} = data;
        if (!params || params.length <= 1) return;

        const suspects = this._guildSuspectMap[message.channel.guild.id];
        if (!suspects || suspects.length === 0) {
            message.reply(`the suspect list is empty. use \`${this._commandPrefix} prepare\` to initialise the list.`);
            return;
        }

        const indicesString = params.slice(1).join('').replace(/\s+/g, '');
        const indices = indicesString.split(',').map(s => +s).filter(n => !isNaN(n));
        _.pullAt(suspects, indices);

        if (message) return this._showList({message});
    }

    /**
     * @param {object} data
     * @param {Message} data.message Message that triggered the command.
     * @private
     */
    _kick(data) {
        const {message} = data;
        const channel = message.channel;
        const guild = channel.guild;

        const suspects = this._guildSuspectMap[guild.id];
        if (!suspects || suspects.length === 0) {
            message.reply(`the suspect list is empty. use \`${this._commandPrefix} prepare\` to initialise the list.`);
            return;
        }

        const memberPromises = suspects.map(s => guild.fetchMember(s.user));
        return Promise.all(memberPromises)
            .then(members => Promise.all(members.map(m => m.kick('You set off too many security flags.'))))
            .then(() => channel.send(`Kicked ${suspects.length} members.`));
    }

    /**
     * @param {object} data
     * @param {Message} data.message Message that triggered the command.
     * @private
     */
    _ban(data) {
        const {message} = data;
        const channel = message.channel;
        const guild = channel.guild;

        const suspects = this._guildSuspectMap[guild.id];
        if (!suspects || suspects.length === 0) {
            message.reply(`the suspect list is empty. use \`${this._commandPrefix} prepare\` to initialise the list.`);
            return;
        }

        const memberPromises = suspects.map(s => guild.fetchMember(s.user));
        return Promise.all(memberPromises)
            .then(/** @param {GuildMember[]} members */members =>
                Promise.all(members.map(member => this._banWithVerification(member))))
            .then(() => channel.send(`Banned ${suspects.length} members (with verification).`));
    }

    /**
     * @param {object} data
     * @param {Message} data.message Message that triggered the command.
     * @private
     */
    _showList(data) {
        const {message} = data;
        const channel = message.channel;

        const suspects = this._guildSuspectMap[message.channel.guild.id];
        if (!suspects || suspects.length === 0) {
            message.reply(`the suspect list is empty. use \`${this._commandPrefix} prepare\` to initialise the list.`);
            return;
        }

        const count = suspects.length;
        let messageString = count === 1 ? `There is ${count} suspect:\n` : `There are ${count} suspects:\n`;
        messageString += '```asciidoc\n';
        const avatarList = new Array(suspects.length);
        for (let i = 0; i < suspects.length; ++i) {
            const {user, flags, score} = suspects[i];


            let flagString;
            const flagStrings = Util.convertFlagsToStrings(flags);
            if (flagStrings.length === 0) flagString = 'No flags.\n';
            else flagString = `[${flagStrings.join('] [')}]\n`;

            if (i !== 0) messageString += '\n';
            messageString += `= ${i}: ${user.tag} (score: ${score})\n`;
            messageString += flagString;

            avatarList[i] = {
                text: user.tag,
                url: user.displayAvatarURL,
            };
        }
        messageString += '```\n';

        return Promise.all([Util.combineAvatarsIntoImage(avatarList), channel.send(messageString)])
            .then(([avatarImage, _]) => channel.send({files: [avatarImage]}));
    }

    start() {
        return Promise.all([this._client.login(botToken)], this._server.start());
    }

}

module.exports = StemShield;
