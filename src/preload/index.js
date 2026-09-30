import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

async function invokeInventory(channel, ...args) {
  let response
  try { response = await ipcRenderer.invoke(channel, ...args) }
  catch { throw new Error('프로그램과 연결하지 못했습니다. 다시 실행해 주세요.') }
  if (!response?.ok) throw new Error(response?.message || '작업을 완료하지 못했습니다.')
  return response.value
}

// Custom APIs for renderer
const inventoryApi = {
  getItems: () => invokeInventory('items:get'),
  addItem: (item) => invokeInventory('items:add', item),
  updateItem: (originalCode, item) =>
    invokeInventory('items:update', originalCode, item),
  deleteItem: (code) =>
    invokeInventory('items:delete', code),

  getClients: (clientType) =>
    invokeInventory('clients:get', clientType),

  addClient: (clientType, client) =>
    invokeInventory('clients:add', clientType, client),

  updateClient: (clientType, originalCode, client) =>
    invokeInventory('clients:update', clientType, originalCode, client),

  deleteClient: (clientType, code) =>
    invokeInventory('clients:delete', clientType, code),

  getTransactions: () =>
    invokeInventory('transactions:get'),

  addTransaction: (transaction) =>
    invokeInventory('transactions:add', transaction),

  cancelTransaction: (transactionNo, reason) =>
    invokeInventory(
      'transactions:cancel',
      transactionNo,
      reason
    ),

  exportTransactions: (
    transactions
  ) =>
    invokeInventory(
      'transactions:export',
      transactions
    ),

  openExportFolder: () =>
    invokeInventory(
      'export:folder:open'
    ),

  checkInventory: () =>
    invokeInventory(
      'inventory:check'
    ),

  getInventoryAdjustments: () =>
    invokeInventory(
      'inventory-adjustments:get'
    ),

  addInventoryAdjustment: (
    adjustment
  ) =>
    invokeInventory(
      'inventory-adjustments:add',
      adjustment
    ),

  createBackup: () =>
    invokeInventory(
      'backup:create'
    ),

  getBackups: () =>
    invokeInventory(
      'backup:list'
    ),

  restoreBackup: (fileName) =>
    invokeInventory(
      'backup:restore',
      fileName
  ),

  getBackupSettings: () =>
    invokeInventory(
      'backup:settings:get'
    ),

  saveBackupSettings: (settings) =>
    invokeInventory(
      'backup:settings:save',
      settings
    ),

  openBackupFolder: () =>
    invokeInventory(
      'backup:folder:open'
    ),

  recoverData: (kind) => invokeInventory('data-file:recover', kind),

  getDataStatus: () =>
    invokeInventory(
      'data-file:status'
    ),

  createDataFile: () =>
    invokeInventory('data-file:create'),

  importExistingExcel: () =>
    invokeInventory(
      'existing-excel:import'
    ),

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
