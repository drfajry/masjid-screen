const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('masjidEnv', {
  isElectron: true,
  platform: process.platform
});
