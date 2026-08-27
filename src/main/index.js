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
const allowedTransactionTypes = ['입고', '출고', '출고반입']

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

function saveWorkbookSafely(workbook, filePath) {
  const tempFilePath = getLocalDataFilePath(tempDataFileName)

  if (existsSync(tempFilePath)) {
    unlinkSync(tempFilePath)
  }

  XLSX.writeFile(workbook, tempFilePath, { bookType: 'xlsx', cellDates: true })
  XLSX.readFile(tempFilePath, { cellDates: true })
  copyFileSync(tempFilePath, filePath)
  unlinkSync(tempFilePath)
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

  XLSX.writeFile(buildWorkbookWithDefaultSheets(), filePath, { bookType: 'xlsx' })

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
  const masterData = getLegacyMasterData()
  const workbook = XLSX.readFile(dataFilePath, { cellDates: true })

  replaceSheet(workbook, '품목', workbookHeaders['품목'], masterData.items)
  replaceSheet(workbook, '매출거래처', workbookHeaders['매출거래처'], masterData.salesClients)
  replaceSheet(workbook, '매입거래처', workbookHeaders['매입거래처'], masterData.purchaseClients)

  saveWorkbookSafely(workbook, dataFilePath)

  return {
    success: true,
    itemCount: masterData.items.length,
    salesClientCount: masterData.salesClients.length,
    purchaseClientCount: masterData.purchaseClients.length
  }
}

function readLegacyTransactionRows(legacyWorkbook) {
  const sheet = legacyWorkbook.Sheets['입출고내역']

  if (!sheet) {
    throw new Error('legacy 파일에 입출고내역 시트가 없습니다.')
  }

  return XLSX.utils
    .sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: true
    })
    .slice(2)
    .filter((row) => row.some((value) => value !== ''))
}

function parseTransactionNo(value) {
  const transactionNo = Number(value)

  if (!Number.isFinite(transactionNo)) {
    return null
  }

  return transactionNo
}

function parseLegacyDate(value, transactionNo) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }

  if (typeof value === 'number') {
    const parsedDate = XLSX.SSF.parse_date_code(value)

    if (parsedDate) {
      return new Date(parsedDate.y, parsedDate.m - 1, parsedDate.d)
    }
  }

  if (typeof value === 'string') {
    const match = value.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)

    if (match) {
      const year = Number(match[1])
      const month = Number(match[2])
      const day = Number(match[3])
      const date = new Date(year, month - 1, day)

      if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
        return date
      }
    }
  }

  throw new Error(`${transactionNo}번 거래의 일자가 올바르지 않습니다.`)
}

function parseRequiredNumber(value, transactionNo, columnName) {
  const numberValue = Number(value)

  if (value === '' || !Number.isFinite(numberValue)) {
    throw new Error(`${transactionNo}번 거래의 ${columnName} 값이 올바르지 않습니다.`)
  }

  return numberValue
}

function parseOptionalNumber(value, transactionNo, columnName) {
  if (value === '') {
    return ''
  }

  const numberValue = Number(value)

  if (!Number.isFinite(numberValue)) {
    throw new Error(`${transactionNo}번 거래의 ${columnName} 값이 올바르지 않습니다.`)
  }

  return numberValue
}

function getMasterCodeSets(workbook) {
  return {
    itemCodes: new Set(readSheetRows(workbook, '품목').map((row) => normalizeCode(row['코드']))),
    clientCodes: new Set([
      ...readSheetRows(workbook, '매출거래처').map((row) => normalizeCode(row['코드'])),
      ...readSheetRows(workbook, '매입거래처').map((row) => normalizeCode(row['코드']))
    ])
  }
}

function formatDateSheet(sheet) {
  const range = XLSX.utils.decode_range(sheet['!ref'])

  for (let row = 1; row <= range.e.r; row += 1) {
    const cellAddress = XLSX.utils.encode_cell({ r: row, c: 1 })

    if (sheet[cellAddress]) {
      sheet[cellAddress].z = 'yyyy-mm-dd'
    }
  }
}

function getLegacyTransactionData(masterWorkbook) {
  const legacyFilePath = getLocalDataFilePath(legacyFileName)
  const legacyWorkbook = XLSX.readFile(legacyFilePath, { cellDates: true })
  const legacyRows = readLegacyTransactionRows(legacyWorkbook)
  const transactionNos = new Set()
  const duplicateTransactionNos = new Set()
  const transactionTypeCounts = {
    입고: 0,
    출고: 0,
    출고반입: 0
  }
  const missingItemCodes = new Set()
  const missingClientCodes = new Set()
  const { itemCodes, clientCodes } = getMasterCodeSets(masterWorkbook)
  let maxTransactionNo = 0
  let normalizedReturnCount = 0

  const transactions = legacyRows.map((row) => {
    const transactionNo = parseTransactionNo(row[0])

    if (transactionNo === null) {
      throw new Error(`거래번호가 없거나 숫자가 아닌 행이 있습니다: ${row[0]}`)
    }

    if (transactionNos.has(transactionNo)) {
      duplicateTransactionNos.add(transactionNo)
    }

    transactionNos.add(transactionNo)
    maxTransactionNo = Math.max(maxTransactionNo, transactionNo)

    const transactionType = String(row[2] ?? '').trim()

    if (!allowedTransactionTypes.includes(transactionType)) {
      throw new Error(`${transactionNo}번 거래에 알 수 없는 구분이 있습니다: ${transactionType}`)
    }

    const quantity = parseRequiredNumber(row[10], transactionNo, '수량')
    let normalizedQuantity = quantity

    if (transactionType === '출고반입' && quantity < 0) {
      normalizedQuantity = Math.abs(quantity)
      normalizedReturnCount += 1
    } else if ((transactionType === '입고' || transactionType === '출고') && quantity < 0) {
      throw new Error(`${transactionNo}번 ${transactionType} 거래의 수량이 음수입니다.`)
    }

    const itemCode = normalizeCode(row[6])
    const clientCode = normalizeCode(row[3])

    if (itemCode && !itemCodes.has(itemCode)) {
      missingItemCodes.add(itemCode)
    }

    if (clientCode && !clientCodes.has(clientCode)) {
      missingClientCodes.add(clientCode)
    }

    transactionTypeCounts[transactionType] += 1

    return [
      transactionNo,
      parseLegacyDate(row[1], transactionNo),
      transactionType,
      row[3] ?? '',
      row[4] ?? '',
      row[6] ?? '',
      row[7] ?? '',
      normalizedQuantity,
      parseOptionalNumber(row[11], transactionNo, '단가'),
      parseOptionalNumber(row[12], transactionNo, '공급가액'),
      parseOptionalNumber(row[13], transactionNo, '부가세'),
      parseOptionalNumber(row[14], transactionNo, '합계'),
      'N',
      '',
      ''
    ]
  })

  if (duplicateTransactionNos.size > 0) {
    throw new Error(`중복 거래번호가 있습니다: ${Array.from(duplicateTransactionNos).join(', ')}`)
  }

  return {
    transactions,
    maxTransactionNo,
    transactionTypeCounts,
    normalizedReturnCount,
    missingItemCodes: Array.from(missingItemCodes),
    missingClientCodes: Array.from(missingClientCodes)
  }
}

function importLegacyTransactions() {
  const dataFilePath = createDataFileIfMissing()
  const workbook = XLSX.readFile(dataFilePath, { cellDates: true })
  const transactionData = getLegacyTransactionData(workbook)

  replaceSheet(workbook, '입출고내역', workbookHeaders['입출고내역'], transactionData.transactions)
  formatDateSheet(workbook.Sheets['입출고내역'])
  saveWorkbookSafely(workbook, dataFilePath)

  return {
    success: true,
    transactionCount: transactionData.transactions.length,
    maxTransactionNo: transactionData.maxTransactionNo,
    transactionTypeCounts: transactionData.transactionTypeCounts,
    normalizedReturnCount: transactionData.normalizedReturnCount,
    missingItemCodes: transactionData.missingItemCodes,
    missingClientCodes: transactionData.missingClientCodes
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
  ipcMain.handle('legacy-transactions:import', () => importLegacyTransactions())

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
