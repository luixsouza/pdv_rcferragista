const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // Expose APIs here if needed in the future
});
