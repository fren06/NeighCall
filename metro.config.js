const { getDefaultConfig } = require('expo/metro-config');
const { withNativewind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Polyfill buffer for react-native-svg
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  buffer: require.resolve('buffer'),
};

// Expo runs its build workers as threads in one process. On Windows that
// process can only hold ~8k open files, and with one worker per CPU core a
// cold web build can exceed it ("EMFILE: too many open files"). Four workers
// stays well under the limit. `--max-workers N` on the command line overrides.
config.maxWorkers = 4;

module.exports = withNativewind(config, { inlineRem: 16 });
