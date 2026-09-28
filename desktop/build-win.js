// build-win.js — direct Windows build (bypasses `electron-forge make` orchestration).
// Usage: node build-win.js
// Steps: electron-packager (win32/x64, asar, devDeps pruned, *.node unpacked)
//        -> MakerSquirrel installer. Exits non-zero with the REAL error on failure.
const path = require('path');
const packager = require('electron-packager');
const { MakerSquirrel } = require('@electron-forge/maker-squirrel');

(async () => {
  console.log('[1/3] packaging with electron-packager...');
  const appPaths = await packager({
    dir: __dirname,
    out: path.join(__dirname, 'out'),
    name: 'DeskFlow-VLA',
    executableName: 'deskflow',
    platform: 'win32',
    arch: 'x64',
    electronVersion: '33.4.11',
    overwrite: true,
    prune: true,
    asar: { unpack: '**/*.node' }, // N-API natives (serialport) must live outside asar
  });
  console.log('packaged:', appPaths);

  console.log('[2/3] building Squirrel installer...');
  const maker = new MakerSquirrel({ name: 'DeskFlow-VLA' });
  const artifacts = await maker.make({
    dir: appPaths[0],
    makeDir: path.join(__dirname, 'out', 'make'),
    appName: 'DeskFlow-VLA',
    packageJSON: require('./package.json'),
    targetArch: 'x64',
    targetPlatform: 'win32',
    forgeConfig: require('./forge.config.js'),
  });
  console.log('[3/3] artifacts:', artifacts);
})().catch((e) => {
  console.error('BUILD FAILED:', e && e.message ? e.message : e);
  process.exit(1);
});
