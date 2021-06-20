'use strict';
const upath = require('upath');
const path = require('path');
const sh = require('shelljs');
const renderPug = require('./render-pug');

const srcRoot = '../src';
const config = require(path.join(srcRoot, 'config.js'));
const srcPath = upath.resolve(upath.dirname(__filename), srcRoot);

sh.ls('-R', srcPath).forEach(_processFile);

function _processFile(filePath) {
  if (
    filePath.match(/\.pug$/) &&
        !filePath.match(/include/) &&
        !filePath.match(/mixin/) &&
        !filePath.match(/\/pug\/layouts\//)
  ) {
    const id = filePath.replace(/pug\//, '').replace(/\.pug$/, '');
    const variables = config.views[id];
    if (variables) console.log(`loading variables '${id}'`);
    renderPug(path.join(__dirname, srcRoot, filePath), {
      destPath: config?.dist ? path.join(config?.dist, filePath.replace(/^pug\//, '')).replace(/\.pug$/, '.html') : undefined,
      variables,
    });
  }
}
