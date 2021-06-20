
// the configuration file
// the settings here will get passed to the render function
const path = require('path');

module.exports = {
  // please use directory/name when doing this.
  'dist': path.join(__dirname, '../dist'),

  // injected into pug pages
  'views': {
    'index': {
      work: 'spongebob',
    },
  },
};
