

module.exports = {
  extends: ['eslint:recommended', 'google'],
  parserOptions: {
    emcaVersion: 2018,
    ecmaVersion: 9,
    sourceType: 'module',
    ecmaFeatures: {
      'jsx': true,
      'experimentalObjectRestSpread': true,
    },
  },
  env: {
    browser: true,
    amd: true,
    node: true,
    es6: true,
  },
  rules: {
    'require-jsdoc': 0,
    'max-len': 0,
    'no-unused-vars': 1,
  },
};
