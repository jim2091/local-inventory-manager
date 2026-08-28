import { app, shell, BrowserWindow, ipcMain } from 'electron'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
  readdirSync,
  statSync,
  readFileSync,
  writeFileSync
} from 'fs'
import { join, basename } from 'path'
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
const settingsFileName = 'settings.json'
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

function readTransactionsFromExcel() {
  const dataFilePath = getLocalDataFilePath(dataFileName)

  if (!existsSync(dataFilePath)) {
    throw new Error('재고관리 데이터 파일이 없습니다.')
  }

  const workbook = XLSX.readFile(dataFilePath, {
    cellDates: true
  })

  const rows = readSheetRows(
    workbook,
    '입출고내역'
  )

  return rows
    .map((row) => {
      const dateValue = row['일자']

      let date = ''

      if (
        dateValue instanceof Date &&
        !Number.isNaN(dateValue.getTime())
      ) {
        const year = dateValue.getFullYear()
        const month = String(
          dateValue.getMonth() + 1
        ).padStart(2, '0')
        const day = String(
          dateValue.getDate()
        ).padStart(2, '0')

        date = `${year}-${month}-${day}`
      } else if (dateValue) {
        date = String(dateValue)
      }

      return {
        transactionNo:
          row['거래번호'] ?? '',

        date,

        type:
          row['구분'] ?? '',

        clientCode:
          row['거래처코드'] ?? '',

        clientName:
          row['거래처명'] ?? '',

        itemCode:
          row['품목코드'] ?? '',

        itemName:
          row['품목명'] ?? '',

        quantity:
          row['수량'] ?? '',

        unitPrice:
          row['단가'] ?? '',

        supplyAmount:
          row['공급가액'] ?? '',

        vat:
          row['부가세'] ?? '',

        totalAmount:
          row['합계'] ?? '',

        canceled:
          row['취소여부'] ?? 'N',

        canceledAt:
          row['취소일시'] ?? '',

        cancelReason:
          row['취소사유'] ?? ''
      }
    })
    .filter(
      (transaction) =>
        transaction.transactionNo !== ''
    )
    .sort(
      (a, b) =>
        Number(b.transactionNo) -
        Number(a.transactionNo)
    )
}

function addItem(item) {
  const dataFilePath = getLocalDataFilePath(dataFileName)

  if (!existsSync(dataFilePath)) {
    throw new Error('재고관리 데이터 파일이 없습니다.')
  }

  const workbook = XLSX.readFile(dataFilePath, { cellDates: true })
  const rows = readSheetRows(workbook, '품목')

  const code = normalizeCode(item.code)
  const name = String(item.name ?? '').trim()

  if (!code) {
    throw new Error('품목 코드를 입력해주세요.')
  }

  if (!name) {
    throw new Error('품목명을 입력해주세요.')
  }

  const duplicate = rows.some((row) => normalizeCode(row['코드']) === code)

  if (duplicate) {
    throw new Error(`이미 존재하는 품목 코드입니다: ${code}`)
  }

  const newItem = [
    String(item.type ?? '').trim(),
    code,
    name,
    item.initialPrice ?? '',
    item.purchasePrice ?? '',
    item.salesPrice ?? '',
    item.initialStock ?? '',
    item.currentStock ?? '',
    String(item.unit ?? '').trim(),
    String(item.spec ?? '').trim(),
    String(item.brand ?? '').trim()
  ]

  const existingRows = rows.map((row) =>
    workbookHeaders['품목'].map((header) => row[header] ?? '')
  )

  replaceSheet(workbook, '품목', workbookHeaders['품목'], [...existingRows, newItem])

  saveWorkbookSafely(workbook, dataFilePath)

  return {
    success: true,
    item: {
      type: newItem[0],
      code: newItem[1],
      name: newItem[2],
      initialPrice: newItem[3],
      purchasePrice: newItem[4],
      salesPrice: newItem[5],
      initialStock: newItem[6],
      currentStock: newItem[7],
      unit: newItem[8],
      spec: newItem[9],
      brand: newItem[10]
    }
  }
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

function updateItem(originalCode, item) {
  const dataFilePath = getLocalDataFilePath(dataFileName)

  if (!existsSync(dataFilePath)) {
    throw new Error('재고관리 데이터 파일이 없습니다.')
  }

  const workbook = XLSX.readFile(dataFilePath, { cellDates: true })
  const itemRows = readSheetRows(workbook, '품목')

  const oldCode = normalizeCode(originalCode)
  const newCode = normalizeCode(item.code)
  const name = String(item.name ?? '').trim()

  if (!oldCode) {
    throw new Error('수정할 품목 코드가 없습니다.')
  }

  if (!newCode) {
    throw new Error('품목 코드를 입력해주세요.')
  }

  if (!name) {
    throw new Error('품목명을 입력해주세요.')
  }

  const targetIndex = itemRows.findIndex(
    (row) => normalizeCode(row['코드']) === oldCode
  )

  if (targetIndex < 0) {
    throw new Error(`수정할 품목을 찾을 수 없습니다: ${oldCode}`)
  }

  const transactionRows = readSheetRows(workbook, '입출고내역')

  const usedInTransaction = transactionRows.some(
    (row) => normalizeCode(row['품목코드']) === oldCode
  )

  if (usedInTransaction && oldCode !== newCode) {
    throw new Error(
      '입출고내역에 사용된 품목은 코드를 변경할 수 없습니다.'
    )
  }

  const duplicate = itemRows.some(
    (row, index) =>
      index !== targetIndex &&
      normalizeCode(row['코드']) === newCode
  )

  if (duplicate) {
    throw new Error(`이미 존재하는 품목 코드입니다: ${newCode}`)
  }

  itemRows[targetIndex] = {
    구분: String(item.type ?? '').trim(),
    코드: newCode,
    품목명: name,
    기초재고단가: item.initialPrice ?? '',
    매입단가: item.purchasePrice ?? '',
    매출단가: item.salesPrice ?? '',
    기초재고량: item.initialStock ?? '',
    현재재고량: item.currentStock ?? '',
    단위: String(item.unit ?? '').trim(),
    규격: String(item.spec ?? '').trim(),
    브랜드명: String(item.brand ?? '').trim()
  }

  const rows = itemRows.map((row) =>
    workbookHeaders['품목'].map((header) => row[header] ?? '')
  )

  replaceSheet(workbook, '품목', workbookHeaders['품목'], rows)

  saveWorkbookSafely(workbook, dataFilePath)

  return {
    success: true,
    item: {
      type: itemRows[targetIndex]['구분'],
      code: itemRows[targetIndex]['코드'],
      name: itemRows[targetIndex]['품목명'],
      initialPrice: itemRows[targetIndex]['기초재고단가'],
      purchasePrice: itemRows[targetIndex]['매입단가'],
      salesPrice: itemRows[targetIndex]['매출단가'],
      initialStock: itemRows[targetIndex]['기초재고량'],
      currentStock: itemRows[targetIndex]['현재재고량'],
      unit: itemRows[targetIndex]['단위'],
      spec: itemRows[targetIndex]['규격'],
      brand: itemRows[targetIndex]['브랜드명']
    }
  }
}

function deleteItem(code) {
  const dataFilePath = getLocalDataFilePath(dataFileName)

  if (!existsSync(dataFilePath)) {
    throw new Error('재고관리 데이터 파일이 없습니다.')
  }

  const workbook = XLSX.readFile(dataFilePath, { cellDates: true })
  const itemRows = readSheetRows(workbook, '품목')

  const targetCode = normalizeCode(code)

  if (!targetCode) {
    throw new Error('삭제할 품목 코드가 없습니다.')
  }

  const targetIndex = itemRows.findIndex(
    (row) => normalizeCode(row['코드']) === targetCode
  )

  if (targetIndex < 0) {
    throw new Error(`삭제할 품목을 찾을 수 없습니다: ${targetCode}`)
  }

  const transactionRows = readSheetRows(workbook, '입출고내역')

  const usedInTransaction = transactionRows.some(
    (row) => normalizeCode(row['품목코드']) === targetCode
  )

  if (usedInTransaction) {
    throw new Error(
      '입출고내역에 사용된 품목은 삭제할 수 없습니다.'
    )
  }

  itemRows.splice(targetIndex, 1)

  const rows = itemRows.map((row) =>
    workbookHeaders['품목'].map((header) => row[header] ?? '')
  )

  replaceSheet(
    workbook,
    '품목',
    workbookHeaders['품목'],
    rows
  )

  saveWorkbookSafely(workbook, dataFilePath)

  return {
    success: true,
    code: targetCode
  }
}

function getClientSheetName(clientType) {
  if (clientType === 'sales') {
    return '매출거래처'
  }

  if (clientType === 'purchase') {
    return '매입거래처'
  }

  throw new Error('올바르지 않은 거래처 구분입니다.')
}

function readClientsFromExcel(clientType) {
  const dataFilePath = getLocalDataFilePath(dataFileName)

  if (!existsSync(dataFilePath)) {
    throw new Error('재고관리 데이터 파일이 없습니다.')
  }

  const workbook = XLSX.readFile(dataFilePath, { cellDates: true })
  const sheetName = getClientSheetName(clientType)
  const rows = readSheetRows(workbook, sheetName)

  return rows
    .map((row) => ({
      code: normalizeCode(row['코드']),
      name: String(row['거래처명'] ?? '').trim()
    }))
    .filter((client) => client.code || client.name)
}

function addClient(clientType, client) {
  const dataFilePath = getLocalDataFilePath(dataFileName)

  if (!existsSync(dataFilePath)) {
    throw new Error('재고관리 데이터 파일이 없습니다.')
  }

  const workbook = XLSX.readFile(dataFilePath, { cellDates: true })
  const sheetName = getClientSheetName(clientType)
  const rows = readSheetRows(workbook, sheetName)

  const code = normalizeCode(client.code)
  const name = String(client.name ?? '').trim()

  if (!code) {
    throw new Error('거래처 코드를 입력해주세요.')
  }

  if (!name) {
    throw new Error('거래처명을 입력해주세요.')
  }

  const duplicate = rows.some(
    (row) => normalizeCode(row['코드']) === code
  )

  if (duplicate) {
    throw new Error(`이미 존재하는 거래처 코드입니다: ${code}`)
  }

  const newRows = [
    ...rows.map((row) => [
      row['코드'] ?? '',
      row['거래처명'] ?? ''
    ]),
    [code, name]
  ]

  replaceSheet(
    workbook,
    sheetName,
    workbookHeaders[sheetName],
    newRows
  )

  saveWorkbookSafely(workbook, dataFilePath)

  return {
    success: true,
    client: {
      code,
      name
    }
  }
}

function isClientUsedInTransaction(transactionRows, clientType, code) {
  return transactionRows.some((row) => {
    const transactionClientCode = normalizeCode(row['거래처코드'])
    const transactionType = String(row['구분'] ?? '').trim()

    if (transactionClientCode !== code) {
      return false
    }

    if (clientType === 'sales') {
      return transactionType === '출고' || transactionType === '출고반입'
    }

    if (clientType === 'purchase') {
      return transactionType === '입고'
    }

    return false
  })
}

function updateClient(clientType, originalCode, client) {
  const dataFilePath = getLocalDataFilePath(dataFileName)

  if (!existsSync(dataFilePath)) {
    throw new Error('재고관리 데이터 파일이 없습니다.')
  }

  const workbook = XLSX.readFile(dataFilePath, { cellDates: true })
  const sheetName = getClientSheetName(clientType)
  const rows = readSheetRows(workbook, sheetName)

  const oldCode = normalizeCode(originalCode)
  const newCode = normalizeCode(client.code)
  const name = String(client.name ?? '').trim()

  if (!oldCode) {
    throw new Error('수정할 거래처 코드가 없습니다.')
  }

  if (!newCode) {
    throw new Error('거래처 코드를 입력해주세요.')
  }

  if (!name) {
    throw new Error('거래처명을 입력해주세요.')
  }

  const targetIndex = rows.findIndex(
    (row) => normalizeCode(row['코드']) === oldCode
  )

  if (targetIndex < 0) {
    throw new Error(`수정할 거래처를 찾을 수 없습니다: ${oldCode}`)
  }

  const transactionRows = readSheetRows(workbook, '입출고내역')

  const usedInTransaction = isClientUsedInTransaction(
    transactionRows,
    clientType,
    oldCode
  )

  if (usedInTransaction && oldCode !== newCode) {
    throw new Error(
      '입출고내역에 사용된 거래처는 코드를 변경할 수 없습니다.'
    )
  }

  const duplicate = rows.some(
    (row, index) =>
      index !== targetIndex &&
      normalizeCode(row['코드']) === newCode
  )

  if (duplicate) {
    throw new Error(`이미 존재하는 거래처 코드입니다: ${newCode}`)
  }

  rows[targetIndex] = {
    코드: newCode,
    거래처명: name
  }

  const newRows = rows.map((row) => [
    row['코드'] ?? '',
    row['거래처명'] ?? ''
  ])

  replaceSheet(
    workbook,
    sheetName,
    workbookHeaders[sheetName],
    newRows
  )

  saveWorkbookSafely(workbook, dataFilePath)

  return {
    success: true,
    client: {
      code: newCode,
      name
    }
  }
}

function deleteClient(clientType, code) {
  const dataFilePath = getLocalDataFilePath(dataFileName)

  if (!existsSync(dataFilePath)) {
    throw new Error('재고관리 데이터 파일이 없습니다.')
  }

  const workbook = XLSX.readFile(dataFilePath, { cellDates: true })
  const sheetName = getClientSheetName(clientType)
  const rows = readSheetRows(workbook, sheetName)

  const targetCode = normalizeCode(code)

  if (!targetCode) {
    throw new Error('삭제할 거래처 코드가 없습니다.')
  }

  const targetIndex = rows.findIndex(
    (row) => normalizeCode(row['코드']) === targetCode
  )

  if (targetIndex < 0) {
    throw new Error(`삭제할 거래처를 찾을 수 없습니다: ${targetCode}`)
  }

  const transactionRows = readSheetRows(workbook, '입출고내역')

  const usedInTransaction = isClientUsedInTransaction(
    transactionRows,
    clientType,
    targetCode
  )

  if (usedInTransaction) {
    throw new Error(
      '입출고내역에 사용된 거래처는 삭제할 수 없습니다.'
    )
  }

  rows.splice(targetIndex, 1)

  const newRows = rows.map((row) => [
    row['코드'] ?? '',
    row['거래처명'] ?? ''
  ])

  replaceSheet(
    workbook,
    sheetName,
    workbookHeaders[sheetName],
    newRows
  )

  saveWorkbookSafely(workbook, dataFilePath)

  return {
    success: true,
    code: targetCode
  }
}

function getNextTransactionNo(transactionRows) {
  let maxTransactionNo = 0

  for (const row of transactionRows) {
    const transactionNo = Number(row['거래번호'])

    if (Number.isFinite(transactionNo)) {
      maxTransactionNo = Math.max(maxTransactionNo, transactionNo)
    }
  }

  return maxTransactionNo + 1
}

function parsePositiveNumber(value, fieldName) {
  const numberValue = Number(value)

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    throw new Error(`${fieldName}은(는) 0보다 큰 숫자여야 합니다.`)
  }

  return numberValue
}

function parseNonNegativeNumber(value, fieldName) {
  const numberValue = Number(value)

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    throw new Error(`${fieldName}은(는) 0 이상의 숫자여야 합니다.`)
  }

  return numberValue
}

function parseTransactionDate(value) {
  if (!value) {
    throw new Error('거래 일자를 입력해주세요.')
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }

  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)

    if (match) {
      const year = Number(match[1])
      const month = Number(match[2])
      const day = Number(match[3])

      const date = new Date(year, month - 1, day)

      if (
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
      ) {
        return date
      }
    }
  }

  throw new Error('거래 일자가 올바르지 않습니다.')
}

function addTransaction(transaction) {
  const dataFilePath = getLocalDataFilePath(dataFileName)

  if (!existsSync(dataFilePath)) {
    throw new Error('재고관리 데이터 파일이 없습니다.')
  }

  runAutoBackupIfNeeded()

  const workbook = XLSX.readFile(dataFilePath, {
    cellDates: true
  })

  const transactionRows = readSheetRows(
    workbook,
    '입출고내역'
  )

  const itemRows = readSheetRows(
    workbook,
    '품목'
  )

  const transactionType =
    String(transaction.type ?? '').trim()

  if (!allowedTransactionTypes.includes(transactionType)) {
    throw new Error('올바른 입출고 구분을 선택해주세요.')
  }

  const itemCode = normalizeCode(transaction.itemCode)

  if (!itemCode) {
    throw new Error('품목을 선택해주세요.')
  }

  const itemIndex = itemRows.findIndex(
    (row) =>
      normalizeCode(row['코드']) === itemCode
  )

  if (itemIndex < 0) {
    throw new Error(
      `품목을 찾을 수 없습니다: ${itemCode}`
    )
  }

  const item = itemRows[itemIndex]

  const clientCode =
    normalizeCode(transaction.clientCode)

  if (!clientCode) {
    throw new Error('거래처를 선택해주세요.')
  }

  const clientSheetName =
    transactionType === '입고'
      ? '매입거래처'
      : '매출거래처'

  const clientRows =
    readSheetRows(workbook, clientSheetName)

  const client = clientRows.find(
    (row) =>
      normalizeCode(row['코드']) === clientCode
  )

  if (!client) {
    throw new Error(
      `거래처를 찾을 수 없습니다: ${clientCode}`
    )
  }

  const quantity = parsePositiveNumber(
    transaction.quantity,
    '수량'
  )

  const unitPrice = parseNonNegativeNumber(
    transaction.unitPrice,
    '단가'
  )

  const transactionDate =
    parseTransactionDate(transaction.date)

  const currentStockValue =
    item['현재재고량'] === ''
      ? 0
      : Number(item['현재재고량'])

  if (!Number.isFinite(currentStockValue)) {
    throw new Error(
      `${itemCode} 품목의 현재재고량이 올바르지 않습니다.`
    )
  }

  let newStock = currentStockValue

  if (
    transactionType === '입고' ||
    transactionType === '출고반입'
  ) {
    newStock += quantity
  } else if (transactionType === '출고') {
    newStock -= quantity
  }

  const supplyAmount =
    quantity * unitPrice

  const vat =
    Math.round(supplyAmount * 0.1)

  const totalAmount =
    supplyAmount + vat

  const transactionNo =
    getNextTransactionNo(transactionRows)

  const newTransaction = {
    거래번호: transactionNo,
    일자: transactionDate,
    구분: transactionType,
    거래처코드: clientCode,
    거래처명: client['거래처명'] ?? '',
    품목코드: itemCode,
    품목명: item['품목명'] ?? '',
    수량: quantity,
    단가: unitPrice,
    공급가액: supplyAmount,
    부가세: vat,
    합계: totalAmount,
    취소여부: 'N',
    취소일시: '',
    취소사유: ''
  }

  const newTransactionRows = [
    ...transactionRows.map((row) =>
      workbookHeaders['입출고내역'].map(
        (header) => row[header] ?? ''
      )
    ),
    workbookHeaders['입출고내역'].map(
      (header) => newTransaction[header] ?? ''
    )
  ]

  itemRows[itemIndex] = {
    ...itemRows[itemIndex],
    현재재고량: newStock
  }

  const newItemRows =
    itemRows.map((row) =>
      workbookHeaders['품목'].map(
        (header) => row[header] ?? ''
      )
    )

  replaceSheet(
    workbook,
    '입출고내역',
    workbookHeaders['입출고내역'],
    newTransactionRows
  )

  replaceSheet(
    workbook,
    '품목',
    workbookHeaders['품목'],
    newItemRows
  )

  formatDateSheet(
    workbook.Sheets['입출고내역']
  )

  saveWorkbookSafely(
    workbook,
    dataFilePath
  )

  return {
    success: true,

    transaction: {
      transactionNo,
      date: transactionDate,
      type: transactionType,

      clientCode,
      clientName:
        client['거래처명'] ?? '',

      itemCode,
      itemName:
        item['품목명'] ?? '',

      quantity,
      unitPrice,
      supplyAmount,
      vat,
      totalAmount
    },

    previousStock: currentStockValue,
    currentStock: newStock,

    stockWarning:
      transactionType === '출고' &&
      newStock < 0
  }
}

function cancelTransaction(transactionNo, reason = '') {
  const dataFilePath = getLocalDataFilePath(dataFileName)

  if (!existsSync(dataFilePath)) {
    throw new Error('재고관리 데이터 파일이 없습니다.')
  }

  const workbook = XLSX.readFile(dataFilePath, {
    cellDates: true
  })

  const transactionRows = readSheetRows(
    workbook,
    '입출고내역'
  )

  const itemRows = readSheetRows(
    workbook,
    '품목'
  )

  const targetTransactionNo = Number(transactionNo)

  if (!Number.isFinite(targetTransactionNo)) {
    throw new Error('올바른 거래번호가 아닙니다.')
  }

  const transactionIndex = transactionRows.findIndex(
    (row) =>
      Number(row['거래번호']) === targetTransactionNo
  )

  if (transactionIndex < 0) {
    throw new Error(
      `거래번호 ${targetTransactionNo}번을 찾을 수 없습니다.`
    )
  }

  const transaction = transactionRows[transactionIndex]

  if (
    String(transaction['취소여부'] ?? 'N').trim() === 'Y'
  ) {
    throw new Error('이미 취소된 거래입니다.')
  }

  const transactionType =
    String(transaction['구분'] ?? '').trim()

  if (!allowedTransactionTypes.includes(transactionType)) {
    throw new Error(
      `올바르지 않은 거래 구분입니다: ${transactionType}`
    )
  }

  const itemCode =
    normalizeCode(transaction['품목코드'])

  if (!itemCode) {
    throw new Error(
      '해당 거래의 품목코드가 없습니다.'
    )
  }

  const itemIndex = itemRows.findIndex(
    (row) =>
      normalizeCode(row['코드']) === itemCode
  )

  if (itemIndex < 0) {
    throw new Error(
      `현재 품목 목록에 ${itemCode} 품목이 없어 재고를 되돌릴 수 없습니다.`
    )
  }

  const quantity = Number(transaction['수량'])

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(
      `${targetTransactionNo}번 거래의 수량이 올바르지 않습니다.`
    )
  }

  const currentStock =
    itemRows[itemIndex]['현재재고량'] === ''
      ? 0
      : Number(itemRows[itemIndex]['현재재고량'])

  if (!Number.isFinite(currentStock)) {
    throw new Error(
      `${itemCode} 품목의 현재재고량이 올바르지 않습니다.`
    )
  }

  let newStock = currentStock

  if (transactionType === '출고') {
    newStock += quantity
  } else if (
    transactionType === '입고' ||
    transactionType === '출고반입'
  ) {
    newStock -= quantity
  }

  transactionRows[transactionIndex] = {
    ...transaction,
    취소여부: 'Y',
    취소일시: new Date(),
    취소사유: String(reason ?? '').trim()
  }

  itemRows[itemIndex] = {
    ...itemRows[itemIndex],
    현재재고량: newStock
  }

  const newTransactionRows =
    transactionRows.map((row) =>
      workbookHeaders['입출고내역'].map(
        (header) => row[header] ?? ''
      )
    )

  const newItemRows =
    itemRows.map((row) =>
      workbookHeaders['품목'].map(
        (header) => row[header] ?? ''
      )
    )

  replaceSheet(
    workbook,
    '입출고내역',
    workbookHeaders['입출고내역'],
    newTransactionRows
  )

  replaceSheet(
    workbook,
    '품목',
    workbookHeaders['품목'],
    newItemRows
  )

  formatDateSheet(
    workbook.Sheets['입출고내역']
  )

  saveWorkbookSafely(
    workbook,
    dataFilePath
  )

  return {
    success: true,
    transactionNo: targetTransactionNo,
    type: transactionType,
    itemCode,
    quantity,
    previousStock: currentStock,
    currentStock: newStock,
    stockWarning: newStock < 0
  }
}

function normalizeDateOnly(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()

    const match = trimmed.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    )

    if (match) {
      return trimmed
    }
  }

  return ''
}

function checkInventory(referenceDate) {
  const dataFilePath = getLocalDataFilePath(dataFileName)

  if (!existsSync(dataFilePath)) {
    throw new Error('재고관리 데이터 파일이 없습니다.')
  }

  const normalizedReferenceDate =
    normalizeDateOnly(referenceDate)

  if (!normalizedReferenceDate) {
    throw new Error('올바른 기준일을 입력해주세요.')
  }

  const workbook = XLSX.readFile(dataFilePath, {
    cellDates: true
  })

  const itemRows = readSheetRows(
    workbook,
    '품목'
  )

  const transactionRows = readSheetRows(
    workbook,
    '입출고내역'
  )

  const result = []

  for (const item of itemRows) {
    const itemCode =
      normalizeCode(item['코드'])

    if (!itemCode) {
      continue
    }

    const itemName =
      String(item['품목명'] ?? '').trim()

    const initialStock =
      item['기초재고량'] === ''
        ? 0
        : Number(item['기초재고량'])

    const currentStock =
      item['현재재고량'] === ''
        ? 0
        : Number(item['현재재고량'])

    if (!Number.isFinite(initialStock)) {
      throw new Error(
        `${itemCode} 품목의 기초재고량이 올바르지 않습니다.`
      )
    }

    if (!Number.isFinite(currentStock)) {
      throw new Error(
        `${itemCode} 품목의 현재재고량이 올바르지 않습니다.`
      )
    }

    let calculatedStock = initialStock

    let inQuantity = 0
    let outQuantity = 0
    let returnQuantity = 0

    for (const transaction of transactionRows) {
      if (
        normalizeCode(transaction['품목코드']) !==
        itemCode
      ) {
        continue
      }

      if (
        String(
          transaction['취소여부'] ?? 'N'
        ).trim() === 'Y'
      ) {
        continue
      }

      const transactionDate =
        normalizeDateOnly(transaction['일자'])

      if (!transactionDate) {
        continue
      }

      if (
        transactionDate <
        normalizedReferenceDate
      ) {
        continue
      }

      const type =
        String(transaction['구분'] ?? '').trim()

      const quantity =
        Number(transaction['수량'])

      if (
        !Number.isFinite(quantity) ||
        quantity < 0
      ) {
        throw new Error(
          `${transaction['거래번호']}번 거래의 수량이 올바르지 않습니다.`
        )
      }

      if (type === '입고') {
        calculatedStock += quantity
        inQuantity += quantity
      } else if (type === '출고') {
        calculatedStock -= quantity
        outQuantity += quantity
      } else if (type === '출고반입') {
        calculatedStock += quantity
        returnQuantity += quantity
      }
    }

    const difference =
      currentStock - calculatedStock

    if (difference !== 0) {
      result.push({
        code: itemCode,
        name: itemName,

        initialStock,
        inQuantity,
        outQuantity,
        returnQuantity,

        calculatedStock,
        currentStock,
        difference
      })
    }
  }

  return {
    success: true,
    referenceDate:
      normalizedReferenceDate,

    totalItemCount:
      itemRows.filter(
        (item) => normalizeCode(item['코드'])
      ).length,

    mismatchCount:
      result.length,

    mismatches:
      result
  }
}

function getBackupFolderPath() {
  return getLocalDataFilePath('backup')
}

function createBackupFileName(prefix = 'backup') {
  const now = new Date()

  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  const hour = String(now.getHours()).padStart(2, '0')
  const minute = String(now.getMinutes()).padStart(2, '0')
  const second = String(now.getSeconds()).padStart(2, '0')

  return `${prefix}_${year}${month}${day}_${hour}${minute}${second}.xlsx`
}

function createBackup(prefix = 'backup') {
  const dataFilePath =
    getLocalDataFilePath(dataFileName)

  if (!existsSync(dataFilePath)) {
    throw new Error(
      '백업할 재고관리 데이터 파일이 없습니다.'
    )
  }

  const backupFolderPath =
    getBackupFolderPath()

  mkdirSync(
    backupFolderPath,
    { recursive: true }
  )

  const backupFileName =
    createBackupFileName(prefix)

  const backupFilePath =
    join(
      backupFolderPath,
      backupFileName
    )

  copyFileSync(
    dataFilePath,
    backupFilePath
  )

  // 생성된 백업이 실제 Excel 파일로 읽히는지 확인
  XLSX.readFile(
    backupFilePath,
    { cellDates: true }
  )

  return {
    success: true,
    fileName: backupFileName,
    filePath: backupFilePath
  }
}

function getTodayDateKey() {
  const now = new Date()

  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  return `${year}${month}${day}`
}

function hasTodayAutoBackup() {
  const backupFolderPath = getBackupFolderPath()

  if (!existsSync(backupFolderPath)) {
    return false
  }

  const today = getTodayDateKey()

  return readdirSync(backupFolderPath).some(
    (fileName) =>
      fileName.startsWith(`auto_${today}_`) &&
      fileName.toLowerCase().endsWith('.xlsx')
  )
}

function cleanupOldBackups(maxCount = 30) {
  const backupFolderPath = getBackupFolderPath()

  if (!existsSync(backupFolderPath)) {
    return {
      success: true,
      deletedCount: 0
    }
  }

  const backupFiles = readdirSync(backupFolderPath)
    .filter((fileName) =>
      fileName.toLowerCase().endsWith('.xlsx')
    )
    .map((fileName) => {
      const filePath = join(
        backupFolderPath,
        fileName
      )

      const stat = statSync(filePath)

      return {
        fileName,
        filePath,
        modifiedAt: stat.mtime
      }
    })
    .sort(
      (a, b) =>
        b.modifiedAt.getTime() -
        a.modifiedAt.getTime()
    )

  if (backupFiles.length <= maxCount) {
    return {
      success: true,
      deletedCount: 0
    }
  }

  const filesToDelete =
    backupFiles.slice(maxCount)

  for (const file of filesToDelete) {
    unlinkSync(file.filePath)
  }

  return {
    success: true,
    deletedCount:
      filesToDelete.length
  }
}

function runAutoBackupIfNeeded() {
  const settings =
    getBackupSettings()

  if (!settings.autoBackup) {
    return {
      backupCreated: false,
      cleanupCount: 0
    }
  }

  let backupCreated = false

  if (!hasTodayAutoBackup()) {
    createBackup('auto')
    backupCreated = true
  }

  let cleanupCount = 0

  if (settings.autoCleanup) {
    const cleanupResult =
      cleanupOldBackups(30)

    cleanupCount =
      cleanupResult.deletedCount
  }

  return {
    backupCreated,
    cleanupCount
  }
}

function getBackupList() {
  const backupFolderPath =
    getBackupFolderPath()

  if (!existsSync(backupFolderPath)) {
    return []
  }

  return readdirSync(backupFolderPath)
    .filter((fileName) =>
      fileName.toLowerCase().endsWith('.xlsx')
    )
    .map((fileName) => {
      const filePath =
        join(
          backupFolderPath,
          fileName
        )

      const stat =
        statSync(filePath)

      return {
        fileName,
        size: stat.size,
        modifiedAt:
          stat.mtime.toISOString()
      }
    })
    .sort(
      (a, b) =>
        new Date(b.modifiedAt) -
        new Date(a.modifiedAt)
    )
}

function restoreBackup(fileName) {
  const safeFileName =
    basename(String(fileName ?? ''))

  if (!safeFileName) {
    throw new Error(
      '복원할 백업 파일을 선택해주세요.'
    )
  }

  const backupFilePath =
    join(
      getBackupFolderPath(),
      safeFileName
    )

  if (!existsSync(backupFilePath)) {
    throw new Error(
      '선택한 백업 파일을 찾을 수 없습니다.'
    )
  }

  const dataFilePath =
    getLocalDataFilePath(dataFileName)

  // 백업 파일이 정상 Excel인지 먼저 확인
  XLSX.readFile(
    backupFilePath,
    { cellDates: true }
  )

  // 현재 데이터가 있으면 복원 전에 자동 백업
  let beforeRestoreBackup = null

  if (existsSync(dataFilePath)) {
    beforeRestoreBackup =
      createBackup('before_restore')
  }

  const tempRestorePath =
    getLocalDataFilePath(
      '재고관리데이터.restore.tmp.xlsx'
    )

  if (existsSync(tempRestorePath)) {
    unlinkSync(tempRestorePath)
  }

  try {
    // 선택한 백업을 임시 파일로 복사
    copyFileSync(
      backupFilePath,
      tempRestorePath
    )

    // 임시 파일 검증
    XLSX.readFile(
      tempRestorePath,
      { cellDates: true }
    )

    // 검증 성공 후 실제 데이터 파일 교체
    copyFileSync(
      tempRestorePath,
      dataFilePath
    )

    // 복원된 실제 파일 다시 확인
    XLSX.readFile(
      dataFilePath,
      { cellDates: true }
    )

    unlinkSync(tempRestorePath)

    return {
      success: true,
      restoredFileName:
        safeFileName,

      beforeRestoreBackupFileName:
        beforeRestoreBackup?.fileName ?? ''
    }
  } catch (error) {
    if (existsSync(tempRestorePath)) {
      unlinkSync(tempRestorePath)
    }

    throw error
  }
}

function getSettingsFilePath() {
  return getLocalDataFilePath(settingsFileName)
}

function getDefaultSettings() {
  return {
    autoBackup: false,
    autoCleanup: false
  }
}

function getBackupSettings() {
  const settingsFilePath =
    getSettingsFilePath()

  if (!existsSync(settingsFilePath)) {
    return getDefaultSettings()
  }

  try {
    const text = readFileSync(
      settingsFilePath,
      'utf-8'
    )

    const savedSettings =
      JSON.parse(text)

    return {
      autoBackup:
        savedSettings.autoBackup === true,

      autoCleanup:
        savedSettings.autoCleanup === true
    }
  } catch (error) {
    console.error(
      '설정 파일을 읽지 못했습니다.',
      error
    )

    return getDefaultSettings()
  }
}

function saveBackupSettings(settings) {
  const settingsFilePath =
    getSettingsFilePath()

  mkdirSync(
    join(process.cwd(), 'local-data'),
    { recursive: true }
  )

  const newSettings = {
    autoBackup:
      Boolean(settings.autoBackup),

    autoCleanup:
      Boolean(settings.autoCleanup)
  }

  writeFileSync(
    settingsFilePath,
    JSON.stringify(
      newSettings,
      null,
      2
    ),
    'utf-8'
  )

  return {
    success: true,
    ...newSettings
  }
}

function openBackupFolder() {
  const backupFolderPath = getBackupFolderPath()

  mkdirSync(
    backupFolderPath,
    { recursive: true }
  )

  shell.openPath(backupFolderPath)

  return {
    success: true
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

  ipcMain.handle('data-file:create', () => createDataFile())
  ipcMain.handle('legacy-master-data:import', () => importLegacyMasterData())
  ipcMain.handle('legacy-transactions:import', () => importLegacyTransactions())
  ipcMain.handle('items:get', () => readItemsFromExcel())
  ipcMain.handle('items:add', (_, item) => addItem(item))
  ipcMain.handle('items:update', (_, originalCode, item) =>
    updateItem(originalCode, item)
  )
  ipcMain.handle('items:delete', (_, code) => deleteItem(code))

  ipcMain.handle('clients:get', (_, clientType) =>
    readClientsFromExcel(clientType)
  )

  ipcMain.handle('clients:add', (_, clientType, client) =>
    addClient(clientType, client)
  )

  ipcMain.handle(
    'clients:update',
    (_, clientType, originalCode, client) =>
      updateClient(clientType, originalCode, client)
  )

  ipcMain.handle('clients:delete', (_, clientType, code) =>
    deleteClient(clientType, code)
  )

  ipcMain.handle(
    'transactions:get',
    () => readTransactionsFromExcel()
  )
  
  ipcMain.handle(
    'transactions:add',
    (_, transaction) =>
      addTransaction(transaction)
  )

  ipcMain.handle(
    'transactions:cancel',
    (_, transactionNo, reason) =>
      cancelTransaction(transactionNo, reason)
  )

  ipcMain.handle(
    'inventory:check',
    (_, referenceDate) =>
      checkInventory(referenceDate)
  )

  ipcMain.handle(
    'backup:create',
    () => createBackup()
  )

  ipcMain.handle(
    'backup:list',
    () => getBackupList()
  )

  ipcMain.handle(
    'backup:restore',
    (_, fileName) =>
      restoreBackup(fileName)
  )

  ipcMain.handle(
    'backup:settings:get',
    () => getBackupSettings()
  )

  ipcMain.handle(
    'backup:settings:save',
    (_, settings) =>
      saveBackupSettings(settings)
  )

  ipcMain.handle(
    'backup:folder:open',
    () => openBackupFolder()
  )

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
