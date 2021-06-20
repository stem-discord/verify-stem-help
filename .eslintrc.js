

module.exports = {
  extends: ['eslint:recommended', 'google'],
  parserOptions: {
    ecmaVersion: 2020,
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
