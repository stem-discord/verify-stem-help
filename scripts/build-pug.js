'use strict';
const upath = require('upath');
const path = require('path');
const sh = require('shelljs');
const renderPug = require('./render-pug');

const srcRoot = '../src';
const config = require(path.join(srcRoot, 'config.js'));

// overload variables in config so that variables will cascade
function getVariables(id) {
  const paths = id.split('/');
  // load variables from index
  let f = config.views['.'];
  for (let i = 1; i <= paths.length; i++) {
    const loc = paths.splice(0, i).join('/');
    console.log(`loading variables from config.views['${loc}']`);
    f = {
      ...f,
      ...config.views[loc],
    };
  }
  return f;
}

const srcPath = upath.resolve(upath.dirname(__filename), srcRoot);

sh.ls('-R', srcPath).forEach(_processFile);

function _processFile(filePath) {
  if (
    filePath.match(/\.pug$/) &&
        !filePath.match(/include/) &&
        !filePath.match(/mixin/) &&
        !filePath.match(/\/pug\/layouts\//)
  ) {
    const id = filePath.replace(/pug\//, '').replace(/\/?index\.pug$/, '') || '.';
    const variables = getVariables(id);
    if (variables) console.log(`loaded '${id}'`);
    renderPug(path.join(__dirname, srcRoot, filePath), {
      destPath: config?.dist ? path.join(config?.dist, filePath.replace(/^pug\//, '')).replace(/\.pug$/, '.html') : undefined,
      variables,
    });
  }
}
