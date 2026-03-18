const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// pnpm symlinks node_modules to .pnpm at the monorepo root
// Metro needs to watch there to resolve them
config.watchFolders = [
  path.resolve(monorepoRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'packages'),
];

// Enable symlink resolution for pnpm
config.resolver.unstable_enableSymlinks = true;

// Resolve from both mobile and root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = config;
