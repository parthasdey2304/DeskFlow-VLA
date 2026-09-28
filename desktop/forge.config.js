module.exports = {
  packagerConfig: { name: 'DeskFlow-VLA', executableName: 'deskflow' },
  makers: [
    { name: '@electron-forge/maker-squirrel', config: {} },
    { name: '@electron-forge/maker-zip', platforms: ['darwin', 'linux'] },
    { name: '@electron-forge/maker-deb', config: {} }
  ],
};
