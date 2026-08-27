import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { copyFileSync, existsSync, mkdirSync, unlinkSync } from 'fs'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import * as XLSX from 'xlsx'

const itemColumnMap = {
  구분: 'type',
  코드: 'code',
  품목명: 'name',
  기초재고단가: 'initialPrice',
  매입단가: 'purchasePrice',
  매출단가: 'salesPrice',
  기초재고량: 'initialStock',
  현재재고량: 'currentStock',
  단위: 'unit',
  규격: 'spec',
  브랜드명: 'brand'
}

const dataFileName = '재고관리데이터.xlsx'
const legacyFileName = '재고관리 프로그램_v1.3.xlsm'
const tempDataFileName = '재고관리데이터.tmp.xlsx'
const masterSheetNames = ['품목', '매출거래처', '매입거래처']

const workbookHeaders = {
  입출고내역: [
    '거래번호',
    '일자',
    '구분',
    '거래처코드',
    '거래처명',
    '품목코드',
    '품목명',
    '수량',
    '단가',
    '공급가액',
    '부가세',
    '합계',
    '취소여부',
    '취소일시',
    '취소사유'
  ],
  품목: [
    '구분',
    '코드',
    '품목명',
    '기초재고단가',
    '매입단가',
    '매출단가',
    '기초재고량',
    '현재재고량',
    '단위',
    '규격',
    '브랜드명'
  ],
  매출거래처: ['코드', '거래처명'],
  매입거래처: ['코드', '거래처명'],
  설정: ['항목', '값']
}

function getLocalDataFilePath(fileName) {
  return join(process.cwd(), 'local-data', fileName)
}

function readSheetRows(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName]

  if (!sheet) {
    throw new Error(`${sheetName} 시트를 찾을 수 없습니다.`)
  }

  return XLSX.utils.sheet_to_json(sheet, {
    defval: '',
    raw: true
  })
}

function normalizeCode(value) {
  return String(value ?? '').trim()
}

function validateDuplicateCodes(rows, sheetName) {
  const seenCodes = new Set()
  const duplicateCodes = new Set()

  for (const row of rows) {
    const code = normalizeCode(row['코드'])

    if (!code) {
      continue
    }

    if (seenCodes.has(code)) {
      duplicateCodes.add(code)
    }

    seenCodes.add(code)
  }

  if (duplicateCodes.size > 0) {
    throw new Error(
      `${sheetName} 시트에 중복 코드가 있습니다: ${Array.from(duplicateCodes).join(', ')}`
    )
  }
}

function replaceSheet(workbook, sheetName, headers, rows) {
  if (!workbook.Sheets[sheetName]) {
    throw new Error(`${sheetName} 시트를 찾을 수 없습니다.`)
  }

  workbook.Sheets[sheetName] = XLSX.utils.aoa_to_sheet([headers, ...rows])
}

function readItemsFromExcel() {
  const filePath = getLocalDataFilePath(dataFileName)
  const workbook = XLSX.readFile(filePath, { cellDates: true })
  const itemSheet = workbook.Sheets['품목']

  if (!itemSheet) {
    throw new Error('품목 시트를 찾을 수 없습니다.')
  }

  const rows = XLSX.utils.sheet_to_json(itemSheet, {
    defval: '',
    raw: true
  })

  return rows
    .map((row) => {
      const item = {}

      for (const [sourceKey, targetKey] of Object.entries(itemColumnMap)) {
        item[targetKey] = row[sourceKey] ?? ''
      }

      return item
    })
    .filter((item) => item.code || item.name)
}

function createDataFile() {
  const filePath = getLocalDataFilePath(dataFileName)

  if (existsSync(filePath)) {
    return {
      success: true,
      created: false,
      filePath
    }
  }

  mkdirSync(join(process.cwd(), 'local-data'), { recursive: true })

  const workbook = XLSX.utils.book_new()

  for (const [sheetName, headers] of Object.entries(workbookHeaders)) {
    const worksheet = XLSX.utils.aoa_to_sheet([headers])
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  }

  XLSX.writeFile(workbook, filePath, { bookType: 'xlsx' })

  return {
    success: true,
    created: true,
    filePath
  }
}

function buildWorkbookWithDefaultSheets() {
  const workbook = XLSX.utils.book_new()

  for (const [sheetName, headers] of Object.entries(workbookHeaders)) {
    const worksheet = XLSX.utils.aoa_to_sheet([headers])
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  }

  return workbook
}

function createDataFileIfMissing() {
  const filePath = getLocalDataFilePath(dataFileName)

  if (existsSync(filePath)) {
    return filePath
  }

  mkdirSync(join(process.cwd(), 'local-data'), { recursive: true })
  XLSX.writeFile(buildWorkbookWithDefaultSheets(), filePath, { bookType: 'xlsx' })

  return filePath
}

function getLegacyMasterData() {
  const legacyFilePath = getLocalDataFilePath(legacyFileName)
  const legacyWorkbook = XLSX.readFile(legacyFilePath, { cellDates: true })

  for (const sheetName of masterSheetNames) {
    if (!legacyWorkbook.Sheets[sheetName]) {
      throw new Error(`legacy 파일에 ${sheetName} 시트가 없습니다.`)
    }
  }

  const itemRows = readSheetRows(legacyWorkbook, '품목').filter((row) => normalizeCode(row['코드']))
  const salesClientRows = readSheetRows(legacyWorkbook, '매출거래처').filter((row) =>
    normalizeCode(row['코드'])
  )
  const purchaseClientRows = readSheetRows(legacyWorkbook, '매입거래처').filter((row) =>
    normalizeCode(row['코드'])
  )

  validateDuplicateCodes(itemRows, '품목')
  validateDuplicateCodes(salesClientRows, '매출거래처')
  validateDuplicateCodes(purchaseClientRows, '매입거래처')

  return {
    items: itemRows.map((row) => workbookHeaders['품목'].map((header) => row[header] ?? '')),
    salesClients: salesClientRows.map((row) =>
      workbookHeaders['매출거래처'].map((header) => row[header] ?? '')
    ),
    purchaseClients: purchaseClientRows.map((row) =>
      workbookHeaders['매입거래처'].map((header) => row[header] ?? '')
    )
  }
}

function importLegacyMasterData() {
  const dataFilePath = createDataFileIfMissing()
  const tempFilePath = getLocalDataFilePath(tempDataFileName)
  const masterData = getLegacyMasterData()
  const workbook = XLSX.readFile(dataFilePath, { cellDates: true })

  replaceSheet(workbook, '품목', workbookHeaders['품목'], masterData.items)
  replaceSheet(workbook, '매출거래처', workbookHeaders['매출거래처'], masterData.salesClients)
  replaceSheet(workbook, '매입거래처', workbookHeaders['매입거래처'], masterData.purchaseClients)

  if (existsSync(tempFilePath)) {
    unlinkSync(tempFilePath)
  }

  XLSX.writeFile(workbook, tempFilePath, { bookType: 'xlsx' })
  XLSX.readFile(tempFilePath, { cellDates: true })
  copyFileSync(tempFilePath, dataFilePath)
  unlinkSync(tempFilePath)

  return {
    success: true,
    itemCount: masterData.items.length,
    salesClientCount: masterData.salesClients.length,
    purchaseClientCount: masterData.purchaseClients.length
  }
}

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('items:get', () => readItemsFromExcel())
  ipcMain.handle('data-file:create', () => createDataFile())
  ipcMain.handle('legacy-master-data:import', () => importLegacyMasterData())

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
