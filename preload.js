const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    printTicket: (ticketData) => ipcRenderer.send('print-ticket', ticketData)
});