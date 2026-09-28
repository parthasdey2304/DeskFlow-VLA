// squirrel-only.js — Squirrel installer from the manually packaged app dir.
// Usage: node squirrel-only.js   (requires out/DeskFlow-VLA-win32-x64 present)
const path = require('path');
const { MakerSquirrel } = require('@electron-forge/maker-squirrel');
(async () => {
  const maker = new MakerSquirrel({
    name: 'DeskFlow-VLA',
    authors: 'DeskFlow-VLA',
    description: 'DeskFlow-VLA desktop console — office workstation edge-link manager with E-stop',
  });
  const artifacts = await maker.make({
    dir: path.join(__dirname, 'out', 'DeskFlow-VLA-win32-x64'),
    makeDir: path.join(__dirname, 'out', 'make'),
    appName: 'DeskFlow-VLA',
    packageJSON: require('./package.json'),
    targetArch: 'x64',
    targetPlatform: 'win32',
    forgeConfig: require('./forge.config.js'),
  });
  console.log('SQUIRREL ARTIFACTS:', artifacts);
})().catch((e) => {
  console.error('SQUIRREL FAILED:', e && e.message ? e.message : e);
  process.exit(1);
});
