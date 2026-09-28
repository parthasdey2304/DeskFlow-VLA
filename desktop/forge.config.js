module.exports = {
  packagerConfig: { name: 'DeskFlow-VLA', executableName: 'deskflow', asar: true },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'DeskFlow-VLA',
        authors: 'DeskFlow-VLA',
        description: 'DeskFlow-VLA desktop console — office workstation edge-link manager with E-stop',
      },
    },
    { name: '@electron-forge/maker-zip', platforms: ['darwin', 'linux'] },
    { name: '@electron-forge/maker-deb', config: {} }
  ],
  plugins: [
    // Unpacks N-API natives (serialport) from asar so the link manager works in the shipped app.
    { name: '@electron-forge/plugin-auto-unpack-natives', config: {} },
  ],
};
