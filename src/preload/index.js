import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const inventoryApi = {
  getItems: () => ipcRenderer.invoke('items:get'),
  addItem: (item) => ipcRenderer.invoke('items:add', item),
  updateItem: (originalCode, item) =>
    ipcRenderer.invoke('items:update', originalCode, item),
  deleteItem: (code) =>
    ipcRenderer.invoke('items:delete', code),

  getClients: (clientType) =>
    ipcRenderer.invoke('clients:get', clientType),

  addClient: (clientType, client) =>
    ipcRenderer.invoke('clients:add', clientType, client),

  updateClient: (clientType, originalCode, client) =>
    ipcRenderer.invoke('clients:update', clientType, originalCode, client),

  deleteClient: (clientType, code) =>
    ipcRenderer.invoke('clients:delete', clientType, code),

  getTransactions: () =>
    ipcRenderer.invoke('transactions:get'),

  addTransaction: (transaction) =>
    ipcRenderer.invoke('transactions:add', transaction),

  cancelTransaction: (transactionNo, reason) =>
    ipcRenderer.invoke(
      'transactions:cancel',
      transactionNo,
      reason
    ),

  checkInventory: (referenceDate) =>
    ipcRenderer.invoke(
      'inventory:check',
      referenceDate
    ),

  createBackup: () =>
    ipcRenderer.invoke(
      'backup:create'
    ),

  getBackups: () =>
    ipcRenderer.invoke(
      'backup:list'
    ),

  restoreBackup: (fileName) =>
    ipcRenderer.invoke(
      'backup:restore',
      fileName
  ),

  getBackupSettings: () =>
    ipcRenderer.invoke(
      'backup:settings:get'
    ),

  saveBackupSettings: (settings) =>
    ipcRenderer.invoke(
      'backup:settings:save',
      settings
    ),

  openBackupFolder: () =>
    ipcRenderer.invoke(
      'backup:folder:open'
    ),

  createDataFile: () =>
    ipcRenderer.invoke('data-file:create'),

  importExistingExcel: () =>
    ipcRenderer.invoke(
      'existing-excel:import'
    ),

  importLegacyMasterData: () =>
    ipcRenderer.invoke('legacy-master-data:import'),

  importLegacyTransactions: () =>
    ipcRenderer.invoke('legacy-transactions:import')
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
