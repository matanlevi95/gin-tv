const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the entire monorepo so @gin-tv/shared changes are picked up.
config.watchFolders = [monorepoRoot];

// Allow Metro to walk up the directory tree (default behavior). We do NOT
// disable hierarchical lookup, because Expo's transitive deps (e.g.
// @react-native/virtualized-lists) live under node_modules/expo/node_modules
// after npm workspace hoisting.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Point @gin-tv/shared at the local workspace, not at a copy in node_modules.
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  "@gin-tv/shared": path.resolve(monorepoRoot, "shared"),
};

module.exports = config;
