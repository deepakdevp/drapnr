const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the monorepo root for changes in shared packages
config.watchFolders = [monorepoRoot];

// Ensure Metro can resolve packages from the monorepo root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Disable hierarchical lookup to avoid duplicates
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
