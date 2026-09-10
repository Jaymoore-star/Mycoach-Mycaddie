// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'dist/*',
      // Generated output. Linting it only produces warnings about the
      // generators' own eslint-disable headers, which would bury real ones.
      'convex/_generated/*',
      '.expo/*',
    ],
  },
]);
