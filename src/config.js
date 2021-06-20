const {execSync} = require('child_process');

// the configuration file
// the settings here will get passed to the render function
const path = require('path');

module.exports = {
  'dist': path.join(__dirname, '../dist'),

  // injected into pug pages
  // variables will cascade when loaded
  // EVERY VARIABLE WILL BE LOADED IN THE OPTIONS SCOPE AS WELL.
  // BE CAREFUL NOT TO OVERRIDE SPECIFIC VARIABLES USED BY THE PUG ENGINE
  // https://pugjs.org/api/reference.html
  'views': {
    '.': {
      git: {
        commitHash: (() => {
          try {
            return execSync(`git log --format=%H -n 1`);
          } catch (e) {
            console.log(e);
            return 'ERROR';
          }
        })(),
      },
      discordUrl: 'https://discord.gg/stem',
      supportDiscordUrl: 'https://discord.gg/nWhQbGuB',
      title: 'STEM Helpers & Students',
      meta: {
        title: 'this is title',
        description: 'this is description',
      },
      oauth: '/flow/redirect',
      work: 'spongebob',
    },
    '404': {
      o: 'placeholder',
    },
  },
};
