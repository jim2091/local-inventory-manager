import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const inventoryApi = {
  getItems: () => ipcRenderer.invoke('items:get'),
  createDataFile: () => ipcRenderer.invoke('data-file:create'),
  importLegacyMasterData: () => ipcRenderer.invoke('legacy-master-data:import'),
  importLegacyTransactions: () => ipcRenderer.invoke('legacy-transactions:import')
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('inventoryApi', inventoryApi)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.inventoryApi = inventoryApi
}
