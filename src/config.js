
// the configuration file
// the settings here will get passed to the render function
const path = require('path');

module.exports = {
  'dist': path.join(__dirname, '../dist'),

  // injected into pug pages
  // variables will cascade when loaded
  'views': {
    '.': {
      discordUrl: 'https://discord.gg/stem',
      title: 'STEM Helpers & Students',
      meta: {
        title: 'this is title',
        description: 'this is description',
      },
      oauth: 'https://google.com',
      work: 'spongebob',
    },
    '404': {
      o: 'placeholder',
    },
  },
};
