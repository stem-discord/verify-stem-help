
// the configuration file
// the settings here will get passed to the render function
const path = require('path');

module.exports = {
  'dist': path.join(__dirname, '../dist'),

  // injected into pug pages
  // variables will cascade when loaded
  'views': {
    'index': {
      title: 'STEM Helpers & Students',
      oauth: 'https://google.com',
      work: 'spongebob',
    },
  },
};
