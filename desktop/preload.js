const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('deskflow', {
  getStatus: () => ipcRenderer.invoke('deskflow:status'),
  onStatus: (cb) => ipcRenderer.on('robot-status', (_e, s) => cb(s)),
  estop: (source) => ipcRenderer.invoke('deskflow:estop', source || 'button'),
  rescan: () => ipcRenderer.send('deskflow:rescan'),
  getLink: () => ipcRenderer.invoke('deskflow:link'),
  onLink: (cb) => ipcRenderer.on('deskflow:link', (_e, l) => cb(l)),
  lastTelemetry: () => ipcRenderer.invoke('deskflow:telemetry-last'),
  onTelemetry: (cb) => ipcRenderer.on('deskflow:telemetry', (_e, t) => cb(t)),
  onLog: (cb) => ipcRenderer.on('deskflow:log', (_e, line) => cb(line)),
});
