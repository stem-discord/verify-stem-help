/**
 * Created by the STEM discord team 
 * @license LGPL-3.0
 */

const Jimp = require('jimp');
const Long = require('long');
const sharp = require('sharp');
const fetch = require('node-fetch');

const Logger = require('./Logger');

const SpambotNameRegex = /^[A-Z][a-z]+[0-9]+$/;

const Flags = {
    SuspiciousUsername: 0,
    NoMessages: 1,
    NoAvatar: 2,
    AccountAgeBelow2Weeks: 3,
};

const FlagsTemplate = {
    [Flags.SuspiciousUsername]: false,
    [Flags.NoMessages]: false,
    [Flags.NoAvatar]: false,
    [Flags.AccountAgeBelow2Weeks]: false,
};

const FlagStrings = {
    [Flags.SuspiciousUsername]: 'suspicious username',
    [Flags.NoMessages]: 'no messages sent',
    [Flags.NoAvatar]: 'no profile picture',
    [Flags.AccountAgeBelow2Weeks]: 'account age below 2 weeks',
};

const FlagScores = {
    [Flags.SuspiciousUsername]: 1,
    [Flags.NoMessages]: 1,
    [Flags.NoAvatar]: 1,
    [Flags.AccountAgeBelow2Weeks]: 2,
};

class Util {

    static getLogger() {
        return Logger;
    }

    static getFlagsTemplate() {
        return {...FlagsTemplate};
    }

    /**
     * @param {string} name
     * @returns {boolean}
     */
    static isSpamBotName(name) {
        return SpambotNameRegex.test(name.trim());
    }

    /**
     * @param {Date} dateA
     * @param {Date} dateB
     * @returns {number}
     */
    static getDayDiff(dateA, dateB) {
        const diffTime = Math.abs(dateA.getTime() - dateB.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    // noinspection JSClosureCompilerSyntax
    /**
     * @param {'discord.js'.User} user
     */
    static computeUserFlags(user) {
        const today = new Date();
        const flags = Util.getFlagsTemplate();
        const spamBotName = Util.isSpamBotName(user.username);

        if (spamBotName) flags[Flags.SuspiciousUsername] = true;
        if (!user.avatarURL) flags[Flags.NoAvatar] = true;
        if (Util.getDayDiff(today, user.createdAt) < 12) flags[Flags.AccountAgeBelow2Weeks] = true;

        return flags;
    }

    /**
     * @param {{[string]: boolean}} flags
     * @returns {number}
     */
    static computeScoreFromFlags(flags) {
        let score = 0;
        for (const flag in flags) {
            if (!flags.hasOwnProperty(flag)) continue;
            if (!flags[flag]) continue;
            score += FlagScores[flag];
        }
        return score;
    }

    static convertFlagsToStrings(flags) {
        const strings = [];
        for (const flag in flags) {
            if (!flags.hasOwnProperty(flag)) continue;
            if (!flags[flag]) continue;
            strings.push(`${FlagStrings[flag]} +${FlagScores[flag]}`);
        }
        return strings;
    }

    /**
     * @param {{text: string, url: string}[]} avatarList
     */
    static combineAvatarsIntoImage(avatarList) {
        const imageSize = 160;
        const columnCount = 4;
        const rowCount = Math.ceil(avatarList.length / columnCount);

        return Promise.resolve()
            .then(() => {
                const imageFetcher = avatarData => fetch(avatarData.url).then(res => res.buffer());
                return Promise.all(avatarList.map(imageFetcher));
            })
            .then(imageBuffers => {
                const imageResizer = buffer => new Promise((resolve) =>
                    sharp(buffer)
                        .resize(imageSize)
                        .jpeg({quality: 80})
                        .toBuffer()
                        .then(resolve));
                return Promise.all(imageBuffers.map(imageResizer));
            })
            .then(imageBuffers => {
                const composites = new Array(imageBuffers.length);
                for (let i = 0; i < imageBuffers.length; ++i) {
                    const columnIndex = i % columnCount;
                    const rowindex = Math.floor(i / columnCount);
                    composites[i] = {
                        input: imageBuffers[i],
                        top: rowindex * imageSize,
                        left: columnIndex * imageSize,
                    };
                }

                const imagePromise = new Promise(resolve =>
                    sharp({
                        create: {
                            width: columnCount * imageSize,
                            height: rowCount * imageSize,
                            channels: 3,
                            background: {r: 50, g: 50, b: 50},
                        },
                    })
                        .composite(composites)
                        .jpeg({quality: 80})
                        .toBuffer()
                        .then(resolve))
                    .then(avatarImage => Jimp.read(avatarImage));
                return Promise.all([
                    imagePromise,
                    Jimp.loadFont(Jimp.FONT_SANS_16_BLACK),
                    Jimp.loadFont(Jimp.FONT_SANS_16_WHITE),
                ]);
            })
            .then(([image, blackFont, whiteFont]) => {
                for (let i = 0; i < avatarList.length; ++i) {
                    const text = avatarList[i].text;
                    const x = (i % columnCount) * imageSize + 10;
                    const y = Math.floor(i / columnCount) * imageSize + 10;
                    image.print(blackFont, x + 1, y + 1, text);
                    image.print(blackFont, x + 1, y - 1, text);
                    image.print(blackFont, x - 1, y - 1, text);
                    image.print(blackFont, x - 1, y + 1, text);
                    image.print(whiteFont, x, y, text);
                }
                return image.getBufferAsync(Jimp.MIME_JPEG);
            });
    }

    /**
     * @param {string} text
     * @returns {Promise<Buffer>}
     */
    static prepareVerificationImage(text) {
        return Promise.resolve()
            .then(() => {
                const imagePromise = new Promise(resolve =>
                    sharp({
                        create: {
                            width: 250,
                            height: 100,
                            channels: 3,
                            background: {r: 255, g: 255, b: 255},
                        },
                    })
                        .jpeg({quality: 80})
                        .toBuffer()
                        .then(resolve))
                    .then(avatarImage => Jimp.read(avatarImage));
                return Promise.all([
                    imagePromise,
                    Jimp.loadFont(Jimp.FONT_SANS_32_BLACK),
                ]);
            })
            .then(([image, font]) => {
                image.print(font, 10, 20, text);
                return image.getBufferAsync(Jimp.MIME_JPEG);
            });
    }

    static getDefaultChannel(guild) {
        // get "original" default channel
        if (guild.channels.has(guild.id))
            return guild.channels.get(guild.id);

        // Check for a "general" channel, which is often default chat
        const generalChannel = guild.channels.find(channel => channel.name === 'general');
        if (generalChannel)
            return generalChannel;
        // Now we get into the heavy stuff: first channel in order where the bot can speak
        // hold on to your hats!
        return guild.channels
            .filter(c => c.type === 'text' &&
                c.permissionsFor(guild.client.user).has('SEND_MESSAGES'))
            .sort((a, b) => a.position - b.position ||
                Long.fromString(a.id).sub(Long.fromString(b.id)).toNumber())
            .first();
    }

    static getHelp() {
        return `
\`\`\`markdown
Help
----
Commands used to show this message:

# !bb
# !bb help


Suspect list
------------
The bot maintains a list of suspects for each server. This list can be
used to kick or ban suspicious members. By default, the list is empty. 

# !bb prepare [threshold=3]
→ Initialises the list of suspects based on the list of current server
  members. Suspects with score less than the threshold are ignored.
  
# !bb spare <indices>
→ Removes users with specified indices from the suspect list. The
  indices have to be separated with commas.
  
# !bb kick
→ Kicks all of the users on the suspect list.

# !bb ban
→ Bans all of the users on the suspect list, sending each one a message
  with a verification link.
  
# !bb list
→ Shows the current list of suspects, indicating the score of each suspect.


Util
----

# !bb report-here
→ Makes the bot report all of its automatic actions (mostly bans and
  unbans) to the current channel.

# !bb no-report
→ Disables automatic reporting.
\`\`\`
`;
    }

}

module.exports = Util;
module.exports.Flags = Flags;
