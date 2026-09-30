import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  dialog
} from 'electron'
import {
  copyFileSync,
  renameSync,
  openSync,
  closeSync,
  fsyncSync,
  existsSync,
  mkdirSync,
  unlinkSync,
  readdirSync,
  statSync,
  readFileSync,
  writeFileSync
} from 'fs'
import { join, basename, dirname, resolve } from 'path'
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

const clientColumnMap = {
  코드: 'code',
  구분: 'category',
  유형: 'type',
  거래처명: 'name',
  '사업자(주민)번호': 'businessNumber',
  대표자명: 'representative',
  사업장주소1: 'businessAddress',
  업태: 'businessType',
  종목: 'businessItem',
  전화: 'phone',
  팩스: 'fax',
  휴대폰: 'mobile',
  홈페이지주소: 'homepage',
  실제주소1: 'actualAddress'
}

const dataFileName = '재고관리데이터.xlsx'
const tempDataFileName = '재고관리데이터.tmp.xlsx'
let backupSequence = 0
const previousDataFileName = '재고관리데이터.prev.xlsx'
const settingsFileName = 'settings.json'
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
    '규격',
    '단위',
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
  매출거래처: [
    '코드',
    '구분',
    '유형',
    '거래처명',
    '사업자(주민)번호',
    '대표자명',
    '사업장주소1',
    '업태',
    '종목',
    '전화',
    '팩스',
    '휴대폰',
    '홈페이지주소',
    '실제주소1'
  ],

  매입거래처: [
    '코드',
    '구분',
    '유형',
    '거래처명',
    '사업자(주민)번호',
    '대표자명',
    '사업장주소1',
    '업태',
    '종목',
    '전화',
    '팩스',
    '휴대폰',
    '홈페이지주소',
    '실제주소1'
  ],
  재고조정: [
    '조정번호',
    '일자',
    '품목코드',
    '품목명',
    '조정전재고',
    '조정수량',
    '조정후재고',
    '사유',
    '등록일시'
  ],

  설정: ['항목', '값']
}

function getDataFolderPath() {
  return join(
    app.getPath('documents'),
    '재고관리 프로그램'
  )
}

function getDataFilePath(fileName) {
  return join(
    getDataFolderPath(),
    fileName
  )
}

function ensureDataFolders() {
  const dataFolderPath =
    getDataFolderPath()

  mkdirSync(
    dataFolderPath,
    { recursive: true }
  )

  mkdirSync(
    join(dataFolderPath, 'backup'),
    { recursive: true }
  )

  mkdirSync(
    join(dataFolderPath, 'export'),
    { recursive: true }
  )

  return dataFolderPath
}

function readSheetRows(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName]

  if (!sheet) {
    throw userError(`${sheetName} 시트를 찾을 수 없습니다.`)
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
    throw userError(
      `${sheetName} 시트에 중복 코드가 있습니다: ${Array.from(duplicateCodes).join(', ')}`
    )
  }
}

function replaceSheet(workbook, sheetName, headers, rows) {
  if (!workbook.Sheets[sheetName]) {
    throw userError(`${sheetName} 시트를 찾을 수 없습니다.`)
  }

  workbook.Sheets[sheetName] = XLSX.utils.aoa_to_sheet([headers, ...rows])
}

function ensureWorkbookSheet(
  workbook,
  sheetName
) {
  if (workbook.Sheets[sheetName]) {
    return
  }

  const headers =
    workbookHeaders[sheetName]

  if (!headers) {
    throw userError(
      `알 수 없는 시트입니다: ${sheetName}`
    )
  }

  const sheet =
    XLSX.utils.aoa_to_sheet([
      headers
    ])

  XLSX.utils.book_append_sheet(
    workbook,
    sheet,
    sheetName
  )
}

function isFileAccessError(error) {
  const code =
    String(
      error?.code ?? ''
    )

  const message =
    String(
      error?.message ?? error ?? ''
    )

  return (
    code === 'EBUSY' ||
    code === 'EPERM' ||
    code === 'EACCES' ||
    message.includes('EBUSY') ||
    message.includes('EPERM') ||
    message.includes('EACCES') ||
    message.includes('resource busy or locked')
  )
}

function saveWorkbookSafely(workbook, filePath, { recovery = false } = {}) {
  ensureDataFolders()
  assertWorkbook(workbook)
  const folder = dirname(filePath)
  const tempPath = join(folder, tempDataFileName)
  const previousPath = join(folder, previousDataFileName)
  const previousStage = join(folder, '재고관리데이터.prev.pending.xlsx')
  let liveReplacementStarted = false
  let liveReplaced = false
  let previousReady = false

  try {
    // Preserve an interrupted save candidate before reusing the temporary name.
    if (existsSync(tempPath)) archiveRecoveryFile(tempPath)
    XLSX.writeFile(workbook, tempPath, { bookType: 'xlsx', cellDates: true })
    flushFile(tempPath)
    assertWorkbook(XLSX.readFile(tempPath, { cellDates: true }))

    if (existsSync(filePath)) {
      const old = inspectDataFile(filePath)
      if (old.valid) {
        copyFileSync(filePath, previousStage)
        flushFile(previousStage)
        assertWorkbook(XLSX.readFile(previousStage, { cellDates: true }), true)
        renameSync(previousStage, previousPath)
        previousReady = true
      } else if (recovery) {
        // Keep damaged data for diagnosis; never replace a good previous copy with it.
        archiveRecoveryFile(filePath)
      } else {
        throw userError('현재 데이터에 오류가 있습니다. 데이터 복구 화면에서 먼저 확인해 주세요.')
      }
    }

    liveReplacementStarted = true
    // Same-directory rename: a locked Windows destination fails without truncation.
    renameSync(tempPath, filePath)
    liveReplaced = true
    assertWorkbook(XLSX.readFile(filePath, { cellDates: true }))
  } catch (error) {
    // A temporary-write or previous-copy failure must NEVER restore an old previous file.
    if (liveReplacementStarted && liveReplaced && previousReady) {
      try {
        if (existsSync(filePath)) archiveRecoveryFile(filePath)
        const rollbackPath = join(folder, '재고관리데이터.rollback.tmp.xlsx')
        copyFileSync(previousPath, rollbackPath)
        flushFile(rollbackPath)
        assertWorkbook(XLSX.readFile(rollbackPath, { cellDates: true }), true)
        renameSync(rollbackPath, filePath)
        assertWorkbook(XLSX.readFile(filePath, { cellDates: true }), true)
      } catch (rollbackError) {
        console.error('이전 데이터 복원 실패', rollbackError)
        throw userError('저장을 완료하지 못했습니다. 프로그램을 다시 열어 이전 데이터로 복구해 주세요.')
      }
    }
    // Leave valid recovery candidates intact on failure.
    throw userError(toUserMessage(error, '재고 데이터를 저장하지 못했습니다. 다시 실행하여 데이터를 확인해 주세요.'))
  }
}

function readItemsFromExcel() {
  const filePath = getDataFilePath(dataFileName)
  const workbook = readManagedWorkbook(filePath)
  const itemSheet = workbook.Sheets['품목']

  if (!itemSheet) {
    throw userError('품목 시트를 찾을 수 없습니다.')
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
  const dataFilePath = getDataFilePath(dataFileName)

  if (!existsSync(dataFilePath)) {
    throw userError('재고관리 데이터 파일이 없습니다.')
  }

  const workbook = readManagedWorkbook(dataFilePath)

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

        spec: row['규격'] ?? '',
        unit: row['단위'] ?? '',

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
  validateItemPrices(item)
  const dataFilePath = getDataFilePath(dataFileName)

  if (!existsSync(dataFilePath)) {
    throw userError('재고관리 데이터 파일이 없습니다.')
  }

  const workbook = readManagedWorkbook(dataFilePath)
  const rows = readSheetRows(workbook, '품목')

  const code = normalizeCode(item.code)
  const name = String(item.name ?? '').trim()

  if (!code) {
    throw userError('품목 코드를 입력해주세요.')
  }

  if (!name) {
    throw userError('품목명을 입력해주세요.')
  }

  const duplicate = rows.some((row) => normalizeCode(row['코드']) === code)

  if (duplicate) {
    throw userError(`이미 존재하는 품목 코드입니다: ${code}`)
  }

  const initialStock =
    item.initialStock === '' ||
    item.initialStock === null ||
    item.initialStock === undefined
      ? 0
      : Number(
          item.initialStock
        )

  if (
    !Number.isFinite(
      initialStock
    ) ||
    !Number.isInteger(
      initialStock
    ) ||
    initialStock < 0
  ) {
    throw userError(
      '기초재고량은 0 이상의 정수여야 합니다.'
    )
  }

  const newItem = [
    String(item.type ?? '').trim(),
    code,
    name,
    item.initialPrice ?? '',
    item.purchasePrice ?? '',
    item.salesPrice ?? '',

    // 신규 품목은 둘이 반드시 동일
    initialStock,
    initialStock,

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
  const filePath = getDataFilePath(dataFileName)

  if (existsSync(filePath)) {
    return {
      success: true,
      created: false,
      filePath
    }
  }

  ensureDataFolders()

  const status = getDataStatus()
  if (status.recoveryRequired || status.blocked) {
    throw userError('복구할 데이터가 있습니다. 먼저 데이터 복구 화면을 확인해 주세요.')
  }
  saveWorkbookSafely(buildWorkbookWithDefaultSheets(), filePath)

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


function readLegacyTransactionRows(legacyWorkbook) {
  const sheet = legacyWorkbook.Sheets['입출고내역']

  if (!sheet) {
    throw userError('legacy 파일에 입출고내역 시트가 없습니다.')
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

function validateExistingExcelWorkbook(workbook) {
  const requiredSheets = [
    '입출고내역',
    '품목',
    '매출거래처',
    '매입거래처'
  ]

  for (const sheetName of requiredSheets) {
    if (!workbook.Sheets[sheetName]) {
      throw userError(
        `필수 시트가 없습니다: ${sheetName}`
      )
    }
  }

  // 품목 시트 검사
  const itemRows = XLSX.utils.sheet_to_json(
    workbook.Sheets['품목'],
    {
      header: 1,
      defval: '',
      raw: true
    }
  )

  const itemHeaders =
    itemRows[0]?.map((value) =>
      String(value ?? '').trim()
    ) ?? []

  const requiredItemHeaders = [
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
  ]

  for (const header of requiredItemHeaders) {
    if (!itemHeaders.includes(header)) {
      throw userError(
        `품목 시트에 필요한 열이 없습니다: ${header}`
      )
    }
  }

  // 거래처 시트 검사
  for (const sheetName of [
    '매출거래처',
    '매입거래처'
  ]) {
    const rows = XLSX.utils.sheet_to_json(
      workbook.Sheets[sheetName],
      {
        header: 1,
        defval: '',
        raw: true
      }
    )

    const headers =
      rows[0]?.map((value) =>
        String(value ?? '').trim()
      ) ?? []

    if (!headers.includes('코드')) {
      throw userError(
        `${sheetName} 시트에 코드 열이 없습니다.`
      )
    }

    if (!headers.includes('거래처명')) {
      throw userError(
        `${sheetName} 시트에 거래처명 열이 없습니다.`
      )
    }
  }

  // 기존 입출고내역 형식 검사
  const transactionRows =
    XLSX.utils.sheet_to_json(
      workbook.Sheets['입출고내역'],
      {
        header: 1,
        defval: '',
        raw: true
      }
    )

  if (transactionRows.length < 2) {
    throw userError(
      '입출고내역 시트 형식이 올바르지 않습니다.'
    )
  }

  const firstHeaderRow =
    transactionRows[0]

  const secondHeaderRow =
    transactionRows[1]

  if (
    String(firstHeaderRow?.[0] ?? '').trim() !== '키' ||
    String(firstHeaderRow?.[1] ?? '').trim() !== '일자' ||
    String(firstHeaderRow?.[2] ?? '').trim() !== '구분'
  ) {
    throw userError(
      '입출고내역 시트의 기본 형식이 기존 프로그램과 다릅니다.'
    )
  }

  if (
    String(secondHeaderRow?.[3] ?? '').trim() !== '코드' ||
    String(secondHeaderRow?.[4] ?? '').trim() !== '거래처명' ||
    String(secondHeaderRow?.[6] ?? '').trim() !== '코드' ||
    String(secondHeaderRow?.[7] ?? '').trim() !== '품목명'
  ) {
    throw userError(
      '입출고내역 시트의 거래처/품목 열 구조가 올바르지 않습니다.'
    )
  }

  for (const [index, header] of [[8, '규격'], [9, '단위'], [10, '수량'], [11, '단가'], [12, '공급가'], [13, '부가세'], [14, '합계']]) {
    if (String(firstHeaderRow[index] ?? '').trim() !== header) {
      throw userError(`기존 입출고내역의 ${header} 열 위치가 다릅니다. 원본 형식을 확인해 주세요.`)
    }
  }
  return true
}

function getExistingMasterData(sourceWorkbook) {
  const result = {}
  for (const [name, key] of [['품목', 'items'], ['매출거래처', 'salesClients'], ['매입거래처', 'purchaseClients']]) {
    // Preserve every named source column, including additional client details.
    const rows = readSheetRows(sourceWorkbook, name)
    validateDuplicateCodes(rows, name)
    const headers = [...new Set([...workbookHeaders[name], ...getSheetHeaders(sourceWorkbook, name).filter((header) => !isBlank(header))])]
    result[key] = rows.map((row) => headers.map((header) => row[header] ?? ''))
    result[`${key}Headers`] = headers
  }
  return result
}

function getExistingTransactionData(
  sourceWorkbook,
  targetWorkbook
) {
  const sourceRows =
    readLegacyTransactionRows(
      sourceWorkbook
    )

  const transactionNos =
    new Set()

  const duplicateTransactionNos =
    new Set()

  const transactionTypeCounts = {
    입고: 0,
    출고: 0,
    출고반입: 0
  }

  const missingItemCodes =
    new Set()

  const missingClientCodes =
    new Set()

  const {
    itemCodes,
    clientCodes
  } = getMasterCodeSets(
    targetWorkbook
  )

  let maxTransactionNo = 0

  let normalizedReturnCount = 0

  const transactions =
    sourceRows.map((row) => {
      const transactionNo =
        parseTransactionNo(row[0])

      if (transactionNo === null) {
        throw userError(
          `거래번호가 없거나 숫자가 아닌 행이 있습니다: ${row[0]}`
        )
      }

      if (
        transactionNos.has(
          transactionNo
        )
      ) {
        duplicateTransactionNos.add(
          transactionNo
        )
      }

      transactionNos.add(
        transactionNo
      )

      maxTransactionNo =
        Math.max(
          maxTransactionNo,
          transactionNo
        )

      const transactionType =
        String(
          row[2] ?? ''
        ).trim()

      if (
        !allowedTransactionTypes.includes(
          transactionType
        )
      ) {
        throw userError(
          `${transactionNo}번 거래에 알 수 없는 구분이 있습니다: ${transactionType}`
        )
      }

      const quantity =
        parseRequiredNumber(
          row[10],
          transactionNo,
          '수량'
        )

      let normalizedQuantity =
        quantity

      // 기존 프로그램의 출고반입 음수 → 신규 프로그램 양수
      if (
        transactionType === '출고반입' &&
        quantity < 0
      ) {
        normalizedQuantity =
          Math.abs(quantity)

        normalizedReturnCount += 1
      } else if (
        (
          transactionType === '입고' ||
          transactionType === '출고'
        ) &&
        quantity < 0
      ) {
        throw userError(
          `${transactionNo}번 ${transactionType} 거래의 수량이 음수입니다.`
        )
      }

      const itemCode =
        normalizeCode(row[6])

      const clientCode =
        normalizeCode(row[3])

      if (
        itemCode &&
        !itemCodes.has(itemCode)
      ) {
        missingItemCodes.add(
          itemCode
        )
      }

      if (
        clientCode &&
        !clientCodes.has(clientCode)
      ) {
        missingClientCodes.add(
          clientCode
        )
      }

      transactionTypeCounts[
        transactionType
      ] += 1

      return [
        transactionNo,
        parseLegacyDate(
          row[1],
          transactionNo
        ),
        transactionType,
        row[3] ?? '',
        row[4] ?? '',
        row[6] ?? '',
        row[7] ?? '',
        row[8] ?? '',
        row[9] ?? '',
        normalizedQuantity,
        parseOptionalNumber(
          row[11],
          transactionNo,
          '단가'
        ),
        parseOptionalNumber(
          row[12],
          transactionNo,
          '공급가액'
        ),
        parseOptionalNumber(
          row[13],
          transactionNo,
          '부가세'
        ),
        parseOptionalNumber(
          row[14],
          transactionNo,
          '합계'
        ),
        'N',
        '',
        ''
      ]
    })

  if (
    duplicateTransactionNos.size > 0
  ) {
    throw userError(
      `중복 거래번호가 있습니다: ${Array.from(
        duplicateTransactionNos
      ).join(', ')}`
    )
  }

  return {
    transactions,
    maxTransactionNo,
    transactionTypeCounts,
    normalizedReturnCount,

    missingItemCodes:
      Array.from(
        missingItemCodes
      ),

    missingClientCodes:
      Array.from(
        missingClientCodes
      )
  }
}

async function importExistingExcel() {
  const selectResult =
    await dialog.showOpenDialog({
      title: '기존 재고관리 Excel 선택',

      properties: [
        'openFile'
      ],

      filters: [
        {
          name: 'Excel 파일',
          extensions: [
            'xlsx',
            'xlsm'
          ]
        }
      ]
    })

  if (
    selectResult.canceled ||
    selectResult.filePaths.length === 0
  ) {
    return {
      success: false,
      canceled: true
    }
  }

  const sourceFilePath =
    selectResult.filePaths[0]

  if ([dataFileName, tempDataFileName, previousDataFileName].some((name) =>
    resolve(getDataFilePath(name)) === resolve(sourceFilePath))) {
    throw userError('현재 사용 중인 데이터 파일은 가져올 수 없습니다. 기존 원본 Excel을 선택해 주세요.')
  }

  // 사용자가 선택한 기존 원본
  const sourceWorkbook =
    XLSX.readFile(
      sourceFilePath,
      {
        cellDates: true
      }
    )

  // 원본 구조 검사
  validateExistingExcelWorkbook(
    sourceWorkbook
  )

  // 마스터 데이터 읽기
  const masterData =
    getExistingMasterData(
      sourceWorkbook
    )

  // 완전히 새로운 업무 데이터 Workbook 생성
  const targetWorkbook =
    buildWorkbookWithDefaultSheets()

  replaceSheet(
    targetWorkbook,
    '품목',
    masterData.itemsHeaders,
    masterData.items
  )

  replaceSheet(
    targetWorkbook,
    '매출거래처',
    masterData.salesClientsHeaders,
    masterData.salesClients
  )

  replaceSheet(
    targetWorkbook,
    '매입거래처',
    masterData.purchaseClientsHeaders,
    masterData.purchaseClients
  )

  // 마스터가 들어간 상태에서 거래내역 변환
  const transactionData =
    getExistingTransactionData(
      sourceWorkbook,
      targetWorkbook
    )

  replaceSheet(
    targetWorkbook,
    '입출고내역',
    workbookHeaders['입출고내역'],
    transactionData.transactions
  )

  formatDateSheet(
    targetWorkbook.Sheets[
      '입출고내역'
    ]
  )

  const dataFilePath =
    getDataFilePath(dataFileName)

  assertWorkbook(targetWorkbook)
  ensureDataFolders()

  // 현재 사용 중인 데이터가 있으면
  // 가져오기 전에 자동 백업
  let beforeImportBackupFileName =
    ''

  if (
    existsSync(dataFilePath)
  ) {
    const backupResult =
      createBackup(
        'before_import'
      )

    beforeImportBackupFileName =
      backupResult.fileName
  }

  // 새 업무 데이터 저장
  saveWorkbookSafely(
    targetWorkbook,
    dataFilePath
  )

  return {
    success: true,
    canceled: false,

    sourceFilePath,

    itemCount:
      masterData.items.length,

    salesClientCount:
      masterData.salesClients.length,

    purchaseClientCount:
      masterData.purchaseClients.length,

    transactionCount:
      transactionData.transactions.length,

    maxTransactionNo:
      transactionData.maxTransactionNo,

    normalizedReturnCount:
      transactionData.normalizedReturnCount,

    transactionTypeCounts:
      transactionData.transactionTypeCounts,

    missingItemCodes:
      transactionData.missingItemCodes,

    missingClientCodes:
      transactionData.missingClientCodes,

    beforeImportBackupFileName
  }
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

  throw userError(`${transactionNo}번 거래의 일자가 올바르지 않습니다.`)
}

function parseRequiredNumber(value, transactionNo, columnName) {
  const numberValue = Number(value)

  if (value === '' || !Number.isFinite(numberValue)) {
    throw userError(`${transactionNo}번 거래의 ${columnName} 값이 올바르지 않습니다.`)
  }

  return numberValue
}

function parseOptionalNumber(value, transactionNo, columnName) {
  if (value === '') {
    return ''
  }

  const numberValue = Number(value)

  if (!Number.isFinite(numberValue)) {
    throw userError(`${transactionNo}번 거래의 ${columnName} 값이 올바르지 않습니다.`)
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

function updateItem(originalCode, item) {
  validateItemPrices(item)
  const dataFilePath = getDataFilePath(dataFileName)

  if (!existsSync(dataFilePath)) {
    throw userError('재고관리 데이터 파일이 없습니다.')
  }

  const workbook = readManagedWorkbook(dataFilePath)
  const itemRows = readSheetRows(workbook, '품목')

  const oldCode = normalizeCode(originalCode)
  const newCode = normalizeCode(item.code)
  const name = String(item.name ?? '').trim()

  if (!oldCode) {
    throw userError('수정할 품목 코드가 없습니다.')
  }

  if (!newCode) {
    throw userError('품목 코드를 입력해주세요.')
  }

  if (!name) {
    throw userError('품목명을 입력해주세요.')
  }

  const targetIndex = itemRows.findIndex(
    (row) => normalizeCode(row['코드']) === oldCode
  )

  if (targetIndex < 0) {
    throw userError(`수정할 품목을 찾을 수 없습니다: ${oldCode}`)
  }

  const transactionRows =
    readSheetRows(
      workbook,
      '입출고내역'
    )

  ensureWorkbookSheet(
    workbook,
    '재고조정'
  )

  const adjustmentRows =
    readSheetRows(
      workbook,
      '재고조정'
    )

  const usedInTransaction =
    transactionRows.some(
      (row) =>
        normalizeCode(
          row['품목코드']
        ) === oldCode
    )

  const usedInAdjustment =
    adjustmentRows.some(
      (row) =>
        normalizeCode(
          row['품목코드']
        ) === oldCode
    )

  if (
    (
      usedInTransaction ||
      usedInAdjustment
    ) &&
    oldCode !== newCode
  ) {
    throw userError(
      '입출고내역 또는 재고조정내역에 사용된 품목은 코드를 변경할 수 없습니다.'
    )
  }

  const duplicate = itemRows.some(
    (row, index) =>
      index !== targetIndex &&
      normalizeCode(row['코드']) === newCode
  )

  if (duplicate) {
    throw userError(`이미 존재하는 품목 코드입니다: ${newCode}`)
  }

  const existingItem =
    itemRows[targetIndex]

  itemRows[targetIndex] = {
    구분:
      String(
        item.type ?? ''
      ).trim(),

    코드:
      newCode,

    품목명:
      name,

    기초재고단가:
      item.initialPrice ?? '',

    매입단가:
      item.purchasePrice ?? '',

    매출단가:
      item.salesPrice ?? '',

    // 최초 등록된 기초재고 유지
    기초재고량:
      existingItem[
        '기초재고량'
      ] ?? '',

    // 현재재고는 입출고/재고조정으로만 변경
    현재재고량:
      existingItem[
        '현재재고량'
      ] ?? '',

    단위:
      String(
        item.unit ?? ''
      ).trim(),

    규격:
      String(
        item.spec ?? ''
      ).trim(),

    브랜드명:
      String(
        item.brand ?? ''
      ).trim()
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
  const dataFilePath = getDataFilePath(dataFileName)

  if (!existsSync(dataFilePath)) {
    throw userError('재고관리 데이터 파일이 없습니다.')
  }

  const workbook = readManagedWorkbook(dataFilePath)
  const itemRows = readSheetRows(workbook, '품목')

  const targetCode = normalizeCode(code)

  if (!targetCode) {
    throw userError('삭제할 품목 코드가 없습니다.')
  }

  const targetIndex = itemRows.findIndex(
    (row) => normalizeCode(row['코드']) === targetCode
  )

  if (targetIndex < 0) {
    throw userError(`삭제할 품목을 찾을 수 없습니다: ${targetCode}`)
  }

  const transactionRows =
    readSheetRows(
      workbook,
      '입출고내역'
    )

  ensureWorkbookSheet(
    workbook,
    '재고조정'
  )

  const adjustmentRows =
    readSheetRows(
      workbook,
      '재고조정'
    )

  const usedInTransaction =
    transactionRows.some(
      (row) =>
        normalizeCode(
          row['품목코드']
        ) === targetCode
    )

  const usedInAdjustment =
    adjustmentRows.some(
      (row) =>
        normalizeCode(
          row['품목코드']
        ) === targetCode
    )

  if (
    usedInTransaction ||
    usedInAdjustment
  ) {
    throw userError(
      '입출고내역 또는 재고조정내역에 사용된 품목은 삭제할 수 없습니다.'
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

  throw userError('올바르지 않은 거래처 구분입니다.')
}

function readClientsFromExcel(clientType) {
  const dataFilePath =
    getDataFilePath(dataFileName)

  if (!existsSync(dataFilePath)) {
    throw userError(
      '재고관리 데이터 파일이 없습니다.'
    )
  }

  const workbook =
    readManagedWorkbook(dataFilePath)

  const sheetName =
    getClientSheetName(clientType)

  const rows =
    readSheetRows(
      workbook,
      sheetName
    )

  return rows
    .map((row) => {
      const client = {}

      for (
        const [sourceKey, targetKey]
        of Object.entries(clientColumnMap)
      ) {
        const value =
          row[sourceKey] ?? ''

        client[targetKey] =
          typeof value === 'string'
            ? value.trim()
            : value
      }

      client.code =
        normalizeCode(client.code)

      return client
    })
    .filter(
      (client) =>
        client.code ||
        client.name
    )
}

function createClientRow(client) {
  return {
    코드:
      normalizeCode(client.code),

    구분:
      String(
        client.category ?? ''
      ).trim(),

    유형:
      String(
        client.type ?? ''
      ).trim(),

    거래처명:
      String(
        client.name ?? ''
      ).trim(),

    '사업자(주민)번호':
      String(
        client.businessNumber ?? ''
      ).trim(),

    대표자명:
      String(
        client.representative ?? ''
      ).trim(),

    사업장주소1:
      String(
        client.businessAddress ?? ''
      ).trim(),

    업태:
      String(
        client.businessType ?? ''
      ).trim(),

    종목:
      String(
        client.businessItem ?? ''
      ).trim(),

    전화:
      String(
        client.phone ?? ''
      ).trim(),

    팩스:
      String(
        client.fax ?? ''
      ).trim(),

    휴대폰:
      String(
        client.mobile ?? ''
      ).trim(),

    홈페이지주소:
      String(
        client.homepage ?? ''
      ).trim(),

    실제주소1:
      String(
        client.actualAddress ?? ''
      ).trim()
  }
}


function addClient(
  clientType,
  client
) {
  const dataFilePath =
    getDataFilePath(dataFileName)

  if (!existsSync(dataFilePath)) {
    throw userError(
      '재고관리 데이터 파일이 없습니다.'
    )
  }

  const workbook =
    readManagedWorkbook(dataFilePath)

  const sheetName =
    getClientSheetName(clientType)

  const rows =
    readSheetRows(
      workbook,
      sheetName
    )

  const code =
    normalizeCode(client.code)

  const name =
    String(
      client.name ?? ''
    ).trim()

  if (!code) {
    throw userError(
      '거래처 코드를 입력해주세요.'
    )
  }

  if (!name) {
    throw userError(
      '거래처명을 입력해주세요.'
    )
  }

  const duplicate =
    rows.some(
      (row) =>
        normalizeCode(
          row['코드']
        ) === code
    )

  if (duplicate) {
    throw userError(
      `이미 존재하는 거래처 코드입니다: ${code}`
    )
  }

  const newClient =
    createClientRow({
      ...client,
      code,
      name
    })

  writeClientRows(workbook, sheetName, [...rows, newClient])

  saveWorkbookSafely(
    workbook,
    dataFilePath
  )

  return {
    success: true,

    client: {
      code,
      category:
        newClient['구분'],
      type:
        newClient['유형'],
      name:
        newClient['거래처명'],
      businessNumber:
        newClient[
          '사업자(주민)번호'
        ],
      representative:
        newClient['대표자명'],
      businessAddress:
        newClient['사업장주소1'],
      businessType:
        newClient['업태'],
      businessItem:
        newClient['종목'],
      phone:
        newClient['전화'],
      fax:
        newClient['팩스'],
      mobile:
        newClient['휴대폰'],
      homepage:
        newClient['홈페이지주소'],
      actualAddress:
        newClient['실제주소1']
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

function updateClient(
  clientType,
  originalCode,
  client
) {
  const dataFilePath =
    getDataFilePath(dataFileName)

  if (!existsSync(dataFilePath)) {
    throw userError(
      '재고관리 데이터 파일이 없습니다.'
    )
  }

  const workbook =
    readManagedWorkbook(dataFilePath)

  const sheetName =
    getClientSheetName(clientType)

  const rows =
    readSheetRows(
      workbook,
      sheetName
    )

  const oldCode =
    normalizeCode(
      originalCode
    )

  const newCode =
    normalizeCode(
      client.code
    )

  const name =
    String(
      client.name ?? ''
    ).trim()

  if (!oldCode) {
    throw userError(
      '수정할 거래처 코드가 없습니다.'
    )
  }

  if (!newCode) {
    throw userError(
      '거래처 코드를 입력해주세요.'
    )
  }

  if (!name) {
    throw userError(
      '거래처명을 입력해주세요.'
    )
  }

  const targetIndex =
    rows.findIndex(
      (row) =>
        normalizeCode(
          row['코드']
        ) === oldCode
    )

  if (targetIndex < 0) {
    throw userError(
      `수정할 거래처를 찾을 수 없습니다: ${oldCode}`
    )
  }

  const transactionRows =
    readSheetRows(
      workbook,
      '입출고내역'
    )

  const usedInTransaction =
    isClientUsedInTransaction(
      transactionRows,
      clientType,
      oldCode
    )

  if (
    usedInTransaction &&
    oldCode !== newCode
  ) {
    throw userError(
      '입출고내역에 사용된 거래처는 코드를 변경할 수 없습니다.'
    )
  }

  const duplicate =
    rows.some(
      (row, index) =>
        index !== targetIndex &&
        normalizeCode(
          row['코드']
        ) === newCode
    )

  if (duplicate) {
    throw userError(
      `이미 존재하는 거래처 코드입니다: ${newCode}`
    )
  }

  const updatedClient = { ...rows[targetIndex] }
  const supplied = createClientRow({ ...client, code: newCode, name })
  for (const [header, property] of Object.entries(clientColumnMap)) {
    if (Object.hasOwn(client, property)) updatedClient[header] = supplied[header]
  }
  rows[targetIndex] = updatedClient
  writeClientRows(workbook, sheetName, rows)

  saveWorkbookSafely(
    workbook,
    dataFilePath
  )

  return {
    success: true,

    client: {
      code: newCode,
      category:
        updatedClient['구분'],
      type:
        updatedClient['유형'],
      name:
        updatedClient['거래처명'],
      businessNumber:
        updatedClient[
          '사업자(주민)번호'
        ],
      representative:
        updatedClient[
          '대표자명'
        ],
      businessAddress:
        updatedClient[
          '사업장주소1'
        ],
      businessType:
        updatedClient['업태'],
      businessItem:
        updatedClient['종목'],
      phone:
        updatedClient['전화'],
      fax:
        updatedClient['팩스'],
      mobile:
        updatedClient['휴대폰'],
      homepage:
        updatedClient[
          '홈페이지주소'
        ],
      actualAddress:
        updatedClient[
          '실제주소1'
        ]
    }
  }
}

function deleteClient(clientType, code) {
  const dataFilePath = getDataFilePath(dataFileName)

  if (!existsSync(dataFilePath)) {
    throw userError('재고관리 데이터 파일이 없습니다.')
  }

  const workbook = readManagedWorkbook(dataFilePath)
  const sheetName = getClientSheetName(clientType)
  const rows = readSheetRows(workbook, sheetName)

  const targetCode = normalizeCode(code)

  if (!targetCode) {
    throw userError('삭제할 거래처 코드가 없습니다.')
  }

  const targetIndex = rows.findIndex(
    (row) => normalizeCode(row['코드']) === targetCode
  )

  if (targetIndex < 0) {
    throw userError(`삭제할 거래처를 찾을 수 없습니다: ${targetCode}`)
  }

  const transactionRows = readSheetRows(workbook, '입출고내역')

  const usedInTransaction = isClientUsedInTransaction(
    transactionRows,
    clientType,
    targetCode
  )

  if (usedInTransaction) {
    throw userError(
      '입출고내역에 사용된 거래처는 삭제할 수 없습니다.'
    )
  }

  rows.splice(targetIndex, 1)

  writeClientRows(workbook, sheetName, rows)

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

function getNextAdjustmentNo(
  adjustmentRows
) {
  let maxAdjustmentNo = 0

  for (
    const row of adjustmentRows
  ) {
    const adjustmentNo =
      Number(row['조정번호'])

    if (
      Number.isFinite(
        adjustmentNo
      )
    ) {
      maxAdjustmentNo =
        Math.max(
          maxAdjustmentNo,
          adjustmentNo
        )
    }
  }

  return maxAdjustmentNo + 1
}

function parsePositiveInteger(value, fieldName) {
  if (!validNumber(value, { integer: true, min: 1 })) {
    throw userError(`${fieldName}은(는) 1 이상의 정수여야 합니다.`)
  }
  return Number(value)
}

function parseNonNegativeNumber(value, fieldName) {
  const numberValue = Number(value)

  if (!validNumber(value, { min: 0 })) {
    throw userError(`${fieldName}은(는) 0 이상의 숫자여야 합니다.`)
  }

  return numberValue
}

function parseTransactionDate(value) {
  if (!value) {
    throw userError('거래 일자를 입력해주세요.')
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

  throw userError('거래 일자가 올바르지 않습니다.')
}

function addTransaction(transaction) {
  const dataFilePath = getDataFilePath(dataFileName)

  if (!existsSync(dataFilePath)) {
    throw userError('재고관리 데이터 파일이 없습니다.')
  }


  const workbook = readManagedWorkbook(dataFilePath)

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
    throw userError('올바른 입출고 구분을 선택해주세요.')
  }

  const itemCode = normalizeCode(transaction.itemCode)

  if (!itemCode) {
    throw userError('품목을 선택해주세요.')
  }

  const itemIndex = itemRows.findIndex(
    (row) =>
      normalizeCode(row['코드']) === itemCode
  )

  if (itemIndex < 0) {
    throw userError(
      `품목을 찾을 수 없습니다: ${itemCode}`
    )
  }

  const item = itemRows[itemIndex]

  const clientCode =
    normalizeCode(transaction.clientCode)

  if (!clientCode) {
    throw userError('거래처를 선택해주세요.')
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
    throw userError(
      `거래처를 찾을 수 없습니다: ${clientCode}`
    )
  }

  const quantity =
    parsePositiveInteger(
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
    throw userError(
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

  if (
    transactionType === '출고' &&
    newStock < 0 &&
    transaction.allowNegativeStock !== true
  ) {
    return {
      requiresStockConfirmation: true,
      previousStock: currentStockValue,
      currentStock: newStock,
      itemCode,
      itemName: item['품목명'] ?? '',
      quantity
    }
  }
  if (!Number.isSafeInteger(newStock)) throw userError('재고 수량이 처리 가능한 범위를 벗어났습니다.')

  const supplyAmount =
    quantity * unitPrice

  const vat =
    Math.round(supplyAmount * 0.1)

  const totalAmount =
    supplyAmount + vat

  if (![supplyAmount, vat, totalAmount].every(Number.isFinite)) {
    throw userError('계산 금액이 너무 큽니다. 수량과 단가를 확인해 주세요.')
  }
  runAutoBackupIfNeeded()

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
    규격: item['규격'] ?? '',
    단위: item['단위'] ?? '',
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
      spec: item['규격'] ?? '',
      unit: item['단위'] ?? '',

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

function addInventoryAdjustment(
  adjustment
) {
  const dataFilePath =
    getDataFilePath(dataFileName)

  if (!existsSync(dataFilePath)) {
    throw userError(
      '재고관리 데이터 파일이 없습니다.'
    )
  }


  const workbook =
    readManagedWorkbook(dataFilePath)

  ensureWorkbookSheet(
    workbook,
    '재고조정'
  )

  const itemRows =
    readSheetRows(
      workbook,
      '품목'
    )

  const adjustmentRows =
    readSheetRows(
      workbook,
      '재고조정'
    )

  const itemCode =
    normalizeCode(
      adjustment.itemCode
    )

  if (!itemCode) {
    throw userError(
      '품목을 선택해주세요.'
    )
  }

  const itemIndex =
    itemRows.findIndex(
      (row) =>
        normalizeCode(
          row['코드']
        ) === itemCode
    )

  if (itemIndex < 0) {
    throw userError(
      `품목을 찾을 수 없습니다: ${itemCode}`
    )
  }

  const item =
    itemRows[itemIndex]

  const currentStock =
    item['현재재고량'] === ''
      ? 0
      : Number(
          item['현재재고량']
        )

  if (
    !Number.isFinite(
      currentStock
    )
  ) {
    throw userError(
      `${itemCode} 품목의 현재재고량이 올바르지 않습니다.`
    )
  }

  const mode = adjustment.mode ?? 'quantity'
  if (!['actual', 'quantity'].includes(mode)) throw userError('올바른 재고 조정 방식을 선택해 주세요.')
  const actualStock = Number(adjustment.actualStock)
  if (mode === 'actual' && !validNumber(adjustment.actualStock, { integer: true, min: 0 })) {
    throw userError('실제 재고수량은 0 이상의 정수로 입력해 주세요.')
  }
  if (mode === 'quantity' && !validNumber(adjustment.quantity, { integer: true })) {
    throw userError('조정수량은 0이 아닌 정수로 입력해 주세요.')
  }
  const adjustmentQuantity = mode === 'actual'
    ? actualStock - currentStock : Number(adjustment.quantity)

  if (
    !Number.isFinite(
      adjustmentQuantity
    ) ||
    adjustmentQuantity === 0
  ) {
    throw userError(
      '조정수량은 0이 아닌 숫자여야 합니다.'
    )
  }

  if (
    !Number.isInteger(
      adjustmentQuantity
    )
  ) {
    throw userError(
      '조정수량은 정수로 입력해주세요.'
    )
  }

  const reason =
    String(
      adjustment.reason ?? ''
    ).trim()

  if (!reason) {
    throw userError(
      '재고 조정 사유를 입력해주세요.'
    )
  }

  const adjustmentDate =
    parseTransactionDate(
      adjustment.date
    )

  const newStock =
    currentStock +
    adjustmentQuantity

  if (!Number.isSafeInteger(newStock)) throw userError('재고 수량이 처리 가능한 범위를 벗어났습니다.')
  runAutoBackupIfNeeded()

  const adjustmentNo =
    getNextAdjustmentNo(
      adjustmentRows
    )

  const newAdjustment = {
    조정번호:
      adjustmentNo,

    일자:
      adjustmentDate,

    품목코드:
      itemCode,

    품목명:
      item['품목명'] ?? '',

    조정전재고:
      currentStock,

    조정수량:
      adjustmentQuantity,

    조정후재고:
      newStock,

    사유:
      reason,

    등록일시:
      new Date()
  }

  const newAdjustmentRows = [
    ...adjustmentRows.map(
      (row) =>
        workbookHeaders[
          '재고조정'
        ].map(
          (header) =>
            row[header] ?? ''
        )
    ),

    workbookHeaders[
      '재고조정'
    ].map(
      (header) =>
        newAdjustment[
          header
        ] ?? ''
    )
  ]

  itemRows[itemIndex] = {
    ...item,
    현재재고량:
      newStock
  }

  const newItemRows =
    itemRows.map(
      (row) =>
        workbookHeaders[
          '품목'
        ].map(
          (header) =>
            row[header] ?? ''
        )
    )

  replaceSheet(
    workbook,
    '재고조정',
    workbookHeaders[
      '재고조정'
    ],
    newAdjustmentRows
  )

  replaceSheet(
    workbook,
    '품목',
    workbookHeaders['품목'],
    newItemRows
  )

  saveWorkbookSafely(
    workbook,
    dataFilePath
  )

  return {
    success: true,

    adjustment: {
      adjustmentNo,
      date:
        adjustment.date,

      itemCode,

      itemName:
        item['품목명'] ?? '',

      previousStock:
        currentStock,

      quantity:
        adjustmentQuantity,

      currentStock:
        newStock,

      reason
    },

    stockWarning:
      newStock < 0
  }
}

function readInventoryAdjustments() {
  const dataFilePath =
    getDataFilePath(dataFileName)

  if (!existsSync(dataFilePath)) {
    throw userError(
      '재고관리 데이터 파일이 없습니다.'
    )
  }

  const workbook =
    readManagedWorkbook(dataFilePath)

  ensureWorkbookSheet(
    workbook,
    '재고조정'
  )

  const rows =
    readSheetRows(
      workbook,
      '재고조정'
    )

  return rows
    .map((row) => ({
      adjustmentNo:
        row['조정번호'] ?? '',

      date:
        normalizeDateOnly(
          row['일자']
        ),

      itemCode:
        row['품목코드'] ?? '',

      itemName:
        row['품목명'] ?? '',

      previousStock:
        row['조정전재고'] ?? '',

      quantity:
        row['조정수량'] ?? '',

      currentStock:
        row['조정후재고'] ?? '',

      reason:
        row['사유'] ?? '',

      createdAt:
        row['등록일시'] ?? ''
    }))
    .filter(
      (row) =>
        row.adjustmentNo !== ''
    )
    .sort(
      (a, b) =>
        Number(
          b.adjustmentNo
        ) -
        Number(
          a.adjustmentNo
        )
    )
}

function cancelTransaction(
    transactionNo,
    reason = ''
) {
    const dataFilePath =
        getDataFilePath(
            dataFileName
        )

    if (
        !existsSync(
            dataFilePath
        )
    ) {
        throw userError(
            '재고관리 데이터 파일이 없습니다.'
        )
    }

    const cancelReason =
        String(
            reason ?? ''
        ).trim()

    if (!cancelReason) {
        throw userError(
            '취소 사유를 입력해주세요.'
        )
    }

    // 거래 취소도 재고를 변경하므로
    // 처리 전에 자동 백업
    runAutoBackupIfNeeded()

    const workbook =
        readManagedWorkbook(dataFilePath)

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
    throw userError('올바른 거래번호가 아닙니다.')
  }

  const transactionIndex = transactionRows.findIndex(
    (row) =>
      Number(row['거래번호']) === targetTransactionNo
  )

  if (transactionIndex < 0) {
    throw userError(
      `거래번호 ${targetTransactionNo}번을 찾을 수 없습니다.`
    )
  }

  const transaction = transactionRows[transactionIndex]

  if (
    String(transaction['취소여부'] ?? 'N').trim() === 'Y'
  ) {
    throw userError('이미 취소된 거래입니다.')
  }

  const transactionType =
    String(transaction['구분'] ?? '').trim()

  if (!allowedTransactionTypes.includes(transactionType)) {
    throw userError(
      `올바르지 않은 거래 구분입니다: ${transactionType}`
    )
  }

  const itemCode =
    normalizeCode(transaction['품목코드'])

  if (!itemCode) {
    throw userError(
      '해당 거래의 품목코드가 없습니다.'
    )
  }

  const itemIndex = itemRows.findIndex(
    (row) =>
      normalizeCode(row['코드']) === itemCode
  )

  if (itemIndex < 0) {
    throw userError(
      `현재 품목 목록에 ${itemCode} 품목이 없어 재고를 되돌릴 수 없습니다.`
    )
  }

  const quantity = Number(transaction['수량'])

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw userError(
      `${targetTransactionNo}번 거래의 수량이 올바르지 않습니다.`
    )
  }

  const currentStock =
    itemRows[itemIndex]['현재재고량'] === ''
      ? 0
      : Number(itemRows[itemIndex]['현재재고량'])

  if (!Number.isFinite(currentStock)) {
    throw userError(
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
    취소사유: cancelReason
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

function checkInventory() {
  const dataFilePath =
    getDataFilePath(dataFileName)

  if (!existsSync(dataFilePath)) {
    throw userError(
      '재고관리 데이터 파일이 없습니다.'
    )
  }

  const workbook =
    readManagedWorkbook(dataFilePath)

  const itemRows =
    readSheetRows(
      workbook,
      '품목'
    )

  const transactionRows =
    readSheetRows(
      workbook,
      '입출고내역'
    )

  ensureWorkbookSheet(
    workbook,
    '재고조정'
  )

  const adjustmentRows =
    readSheetRows(
      workbook,
      '재고조정'
    )

  const result = []

  for (const item of itemRows) {
    const itemCode =
      normalizeCode(
        item['코드']
      )

    if (!itemCode) {
      continue
    }

    const itemName =
      String(
        item['품목명'] ?? ''
      ).trim()

    const initialStock =
      item['기초재고량'] === ''
        ? 0
        : Number(
            item['기초재고량']
          )

    const currentStock =
      item['현재재고량'] === ''
        ? 0
        : Number(
            item['현재재고량']
          )

    if (
      !Number.isFinite(
        initialStock
      )
    ) {
      throw userError(
        `${itemCode} 품목의 기초재고량이 올바르지 않습니다.`
      )
    }

    if (
      !Number.isFinite(
        currentStock
      )
    ) {
      throw userError(
        `${itemCode} 품목의 현재재고량이 올바르지 않습니다.`
      )
    }

    let calculatedStock =
      initialStock

    let inQuantity = 0
    let outQuantity = 0
    let returnQuantity = 0
    let adjustmentQuantity = 0

    // 전체 입출고 내역 계산
    for (
      const transaction
      of transactionRows
    ) {
      if (
        normalizeCode(
          transaction['품목코드']
        ) !== itemCode
      ) {
        continue
      }

      // 취소 거래는 재고 계산에서 제외
      if (
        String(
          transaction[
            '취소여부'
          ] ?? 'N'
        ).trim() === 'Y'
      ) {
        continue
      }

      const type =
        String(
          transaction['구분'] ?? ''
        ).trim()

      const quantity =
        Number(
          transaction['수량']
        )

      if (
        !Number.isFinite(
          quantity
        ) ||
        quantity < 0
      ) {
        throw userError(
          `${transaction['거래번호']}번 거래의 수량이 올바르지 않습니다.`
        )
      }

      if (type === '입고') {
        calculatedStock +=
          quantity

        inQuantity +=
          quantity
      }
      else if (type === '출고') {
        calculatedStock -=
          quantity

        outQuantity +=
          quantity
      }
      else if (
        type === '출고반입'
      ) {
        calculatedStock +=
          quantity

        returnQuantity +=
          quantity
      }
      else {
        throw userError(
          `${transaction['거래번호']}번 거래의 구분이 올바르지 않습니다: ${type}`
        )
      }
    }

    // 전체 재고조정 내역 계산
    for (
      const adjustment
      of adjustmentRows
    ) {
      if (
        normalizeCode(
          adjustment['품목코드']
        ) !== itemCode
      ) {
        continue
      }

      const quantity =
        Number(
          adjustment['조정수량']
        )

      if (
        !Number.isFinite(
          quantity
        )
      ) {
        throw userError(
          `${adjustment['조정번호']}번 재고조정의 조정수량이 올바르지 않습니다.`
        )
      }

      calculatedStock +=
        quantity

      adjustmentQuantity +=
        quantity
    }

    const difference =
      currentStock -
      calculatedStock

    if (difference !== 0) {
      result.push({
        code:
          itemCode,

        name:
          itemName,

        initialStock,

        inQuantity,

        outQuantity,

        returnQuantity,

        adjustmentQuantity,

        calculatedStock,

        currentStock,

        difference
      })
    }
  }

  return {
    success: true,

    calculationBasis:
      '전체 이력',

    totalItemCount:
      itemRows.filter(
        (item) =>
          normalizeCode(
            item['코드']
          )
      ).length,

    mismatchCount:
      result.length,

    mismatches:
      result
  }
}

function getBackupFolderPath() {
  return join(
    getDataFolderPath(),
    'backup'
  )
}

function getExportFolderPath() {
  return join(
    getDataFolderPath(),
    'export'
  )
}

function createTransactionExportFileName() {
  const now = new Date()

  const year = now.getFullYear()
  const month = String(
    now.getMonth() + 1
  ).padStart(2, '0')
  const day = String(
    now.getDate()
  ).padStart(2, '0')

  const hour = String(
    now.getHours()
  ).padStart(2, '0')
  const minute = String(
    now.getMinutes()
  ).padStart(2, '0')
  const second = String(
    now.getSeconds()
  ).padStart(2, '0')

  return (
    `입출고조회_${year}${month}${day}` +
    `_${hour}${minute}${second}.xlsx`
  )
}

function exportTransactions(
  transactions
) {
  if (!Array.isArray(transactions)) {
    throw userError(
      '내보낼 입출고 데이터가 올바르지 않습니다.'
    )
  }

  if (transactions.length === 0) {
    throw userError(
      '내보낼 입출고 내역이 없습니다.'
    )
  }

  ensureDataFolders()

  const exportFolderPath =
    getExportFolderPath()

  mkdirSync(
    exportFolderPath,
    { recursive: true }
  )

  const fileName =
    createTransactionExportFileName()

  const filePath =
    join(
      exportFolderPath,
      fileName
    )

  const rows =
    transactions.map(
      (transaction) => ({
        거래번호:
          transaction.transactionNo ?? '',

        일자:
          transaction.date ?? '',

        구분:
          transaction.type ?? '',

        거래처코드:
          transaction.clientCode ?? '',

        거래처명:
          transaction.clientName ?? '',

        품목코드:
          transaction.itemCode ?? '',

        품목명:
          transaction.itemName ?? '',

        규격: transaction.spec ?? '',
        단위: transaction.unit ?? '',

        수량:
          Number(
            transaction.quantity
          ) || 0,

        단가:
          Number(
            transaction.unitPrice
          ) || 0,

        공급가액:
          Number(
            transaction.supplyAmount
          ) || 0,

        부가세:
          Number(
            transaction.vat
          ) || 0,

        합계:
          Number(
            transaction.totalAmount
          ) || 0,

        상태:
          transaction.canceled === 'Y'
            ? '취소'
            : '정상',

        취소일시:
          transaction.canceledAt ?? '',

        취소사유:
          transaction.cancelReason ?? ''
      })
    )

  const worksheet =
    XLSX.utils.json_to_sheet(
      rows
    )

  worksheet['!cols'] = [
    { wch: 10 },
    { wch: 12 },
    { wch: 10 },
    { wch: 16 },
    { wch: 24 },
    { wch: 18 },
    { wch: 30 },
    { wch: 20 },
    { wch: 8 },
    { wch: 10 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 10 },
    { wch: 20 },
    { wch: 30 }
  ]

  const workbook =
    XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    '입출고조회'
  )

  XLSX.writeFile(
    workbook,
    filePath,
    {
      bookType: 'xlsx'
    }
  )

  // 내보내기는 업무 데이터와 다른 단일 시트 형식입니다.
  XLSX.readFile(filePath, { cellDates: true })

  return {
    success: true,
    fileName,
    filePath,
    count: transactions.length
  }
}

function openExportFolder() {
  const exportFolderPath =
    getExportFolderPath()

  mkdirSync(
    exportFolderPath,
    { recursive: true }
  )

  shell.openPath(
    exportFolderPath
  )

  return {
    success: true
  }
}

function createBackupFileName(prefix = 'backup') {
  const now = new Date()

  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  const hour = String(now.getHours()).padStart(2, '0')
  const minute = String(now.getMinutes()).padStart(2, '0')
  const second = String(now.getSeconds()).padStart(2, '0')

  return `${prefix}_${year}${month}${day}_${hour}${minute}${second}_${Date.now()}_${backupSequence++}.xlsx`
}

function createBackup(prefix = 'backup') {
  const dataFilePath =
    getDataFilePath(dataFileName)

  if (!existsSync(dataFilePath)) {
    throw userError(
      '백업할 재고관리 데이터 파일이 없습니다.'
    )
  }

  assertWorkbook(XLSX.readFile(dataFilePath, { cellDates: true }), true)

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
  assertWorkbook(XLSX.readFile(backupFilePath, { cellDates: true }), true)

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

function cleanupOldBackups(
  maxCount = 30
) {
  const backupFolderPath =
    getBackupFolderPath()

  if (
    !existsSync(
      backupFolderPath
    )
  ) {
    return {
      deletedCount: 0
    }
  }

  const autoBackupFiles =
    readdirSync(
      backupFolderPath
    )
      .filter((fileName) => {
        return (
          fileName.startsWith(
            'auto_'
          ) &&
          fileName
            .toLowerCase()
            .endsWith(
              '.xlsx'
            )
        )
      })
      .map((fileName) => {
        const filePath =
          join(
            backupFolderPath,
            fileName
          )

        const stat =
          statSync(
            filePath
          )

        return {
          fileName,
          filePath,
          mtimeMs:
            stat.mtimeMs
        }
      })
      .sort(
        (a, b) =>
          b.mtimeMs -
          a.mtimeMs
      )

  if (
    autoBackupFiles.length <=
    maxCount
  ) {
    return {
      deletedCount: 0
    }
  }

  const deleteTargets =
    autoBackupFiles.slice(
      maxCount
    )

  for (
    const backup
    of deleteTargets
  ) {
    unlinkSync(
      backup.filePath
    )
  }

  return {
    deletedCount:
      deleteTargets.length
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
  const safeFileName = basename(String(fileName ?? ''))
  if (!safeFileName || safeFileName !== fileName || !safeFileName.toLowerCase().endsWith('.xlsx')) {
    throw userError('복원할 백업 파일을 선택해 주세요.')
  }
  const backupFilePath = join(getBackupFolderPath(), safeFileName)
  if (!existsSync(backupFilePath)) throw userError('선택한 백업 파일을 찾을 수 없습니다.')
  const workbook = XLSX.readFile(backupFilePath, { cellDates: true })
  assertWorkbook(workbook, true)
  migrateWorkbook(workbook)
  assertWorkbook(workbook)
  const dataFilePath = getDataFilePath(dataFileName)
  const before = inspectDataFile(dataFilePath).valid ? createBackup('before_restore') : null
  saveWorkbookSafely(workbook, dataFilePath, { recovery: true })
  return { success: true, restoredFileName: safeFileName,
    beforeRestoreBackupFileName: before?.fileName ?? '' }
}

function getSettingsFilePath() {
  return getDataFilePath(settingsFileName)
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
  ensureDataFolders()

  const settingsFilePath =
    getSettingsFilePath()

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

function getDataStatus() {
  const livePath = getDataFilePath(dataFileName)
  const live = inspectDataFile(livePath)
  const candidates = recoveryCandidates()
  const temporaryExists = existsSync(getDataFilePath(tempDataFileName))
  if (!live.valid) {
    const traces = live.exists || temporaryExists || existsSync(getDataFilePath(previousDataFileName))
    return { exists: live.exists, ready: false, recoveryRequired: traces,
      blocked: traces, candidates, warnings: [], errors: live.errors,
      message: traces ? '재고 데이터를 확인하거나 복구해야 합니다.' : '' }
  }
  try {
    const migrated = migrateWorkbook(live.workbook)
    if (migrated) saveWorkbookSafely(live.workbook, livePath)
    const warnings = [...live.warnings]
    if (temporaryExists) warnings.push('이전에 저장을 마치지 못한 흔적이 있습니다. 현재 정상 데이터를 사용하며 복구용 사본은 보존합니다.')
    if (migrated) warnings.push('기존 거래의 규격·단위를 현재 품목 정보로 보완했습니다. 거래 당시 값과 다를 수 있습니다.')
    return { exists: true, ready: true, blocked: false, recoveryRequired: false, candidates,
      migrated, warnings, errors: [] }
  } catch (error) {
    return { exists: true, ready: false, blocked: true, recoveryRequired: true, candidates,
      errors: [toUserMessage(error)], warnings: [], message: '데이터 준비를 완료하지 못했습니다.' }
  }
}

function userError(message) {
  const error = new Error(message)
  error.userFacing = true
  return error
}

function toUserMessage(error, fallback = '작업을 완료하지 못했습니다. 데이터 파일을 확인한 뒤 다시 시도해 주세요.') {
  if (isFileAccessError(error)) return '현재 재고 데이터 파일이 Excel에서 열려 있거나 접근할 수 없습니다. Excel 창을 닫은 뒤 다시 시도해 주세요.'
  if (error?.userFacing) return error.message
  return fallback
}

function handleInventory(channel, handler) {
  ipcMain.handle(channel, async (...args) => {
    try {
      return { ok: true, value: await handler(...args) }
    } catch (error) {
      console.error(channel, error)
      return { ok: false, message: toUserMessage(error) }
    }
  })
}

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === ''
}

function validNumber(value, { integer = false, min = -Infinity, blank = false } = {}) {
  if (isBlank(value)) return blank
  if (!['string', 'number'].includes(typeof value)) return false
  const n = Number(value)
  return Number.isFinite(n) && n >= min && (!integer || Number.isSafeInteger(n))
}

function validateItemPrices(item) {
  for (const [field, label] of [['initialPrice', '기초재고단가'], ['purchasePrice', '매입단가'], ['salesPrice', '매출단가']]) {
    if (!validNumber(item[field], { min: 0, blank: true })) throw userError(`${label}는 빈 값 또는 0 이상의 숫자여야 합니다.`)
  }
}

function getSheetHeaders(workbook, name) {
  return XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '' })[0] ?? []
}

function validateWorkbook(workbook, allowV100 = false) {
  const errors = []
  const warnings = []
  const rowsBySheet = {}
  for (const [name, expected] of Object.entries(workbookHeaders)) {
    if (!workbook.Sheets[name]) { errors.push(`${name} 시트가 없습니다.`); continue }
    const headers = getSheetHeaders(workbook, name)
    const required = allowV100 && name === '입출고내역'
      ? expected.filter((header) => !['규격', '단위'].includes(header)) : expected
    for (const header of required) {
      if (!headers.includes(header)) errors.push(`${name} 시트에 ${header} 열이 없습니다.`)
    }
    const nonempty = headers.filter((header) => !isBlank(header))
    if (new Set(nonempty).size !== nonempty.length) errors.push(`${name} 시트의 열 이름이 중복됩니다.`)
    rowsBySheet[name] = readSheetRows(workbook, name)
  }
  if (errors.length) return { errors, warnings }
  for (const name of ['품목', '매출거래처', '매입거래처']) {
    const seen = new Set()
    rowsBySheet[name].forEach((row, i) => {
      const prefix = `${name} ${i + 2}행`
      const code = normalizeCode(row['코드'])
      if (!code) errors.push(`${prefix}: 코드가 없습니다.`)
      else if (seen.has(code)) errors.push(`${prefix}: 코드가 중복됩니다.`)
      seen.add(code)
      if (isBlank(row[name === '품목' ? '품목명' : '거래처명'])) errors.push(`${prefix}: 이름이 없습니다.`)
      if (name === '품목') {
        for (const h of ['기초재고단가', '매입단가', '매출단가']) {
          if (!validNumber(row[h], { min: 0, blank: true })) errors.push(`${prefix}: ${h}가 올바르지 않습니다.`)
        }
        if (!validNumber(row['기초재고량'], { integer: true, min: 0, blank: true })) errors.push(`${prefix}: 기초재고량이 올바르지 않습니다.`)
        if (!validNumber(row['현재재고량'], { integer: true, blank: true })) errors.push(`${prefix}: 현재재고량이 올바르지 않습니다.`)
      }
    })
  }
  const itemCodes = new Set(rowsBySheet['품목'].map((row) => normalizeCode(row['코드'])))
  const missingItems = new Set()
  for (const name of ['입출고내역', '재고조정']) {
    const seen = new Set()
    rowsBySheet[name].forEach((row, i) => {
      const prefix = `${name} ${i + 2}행`
      const key = name === '입출고내역' ? '거래번호' : '조정번호'
      const no = Number(row[key])
      if (!validNumber(row[key], { integer: true, min: 1 }) || seen.has(no)) errors.push(`${prefix}: ${key}가 올바르지 않거나 중복됩니다.`)
      seen.add(no)
      try { parseTransactionDate(row['일자']) } catch { errors.push(`${prefix}: 일자가 올바르지 않습니다.`) }
      const code = normalizeCode(row['품목코드'])
      if (!code) errors.push(`${prefix}: 품목코드가 없습니다.`)
      else if (!itemCodes.has(code)) missingItems.add(code)
      if (name === '입출고내역') {
        if (!allowedTransactionTypes.includes(row['구분'])) errors.push(`${prefix}: 거래구분이 올바르지 않습니다.`)
        if (!validNumber(row['수량'], { integer: true, min: 1 })) errors.push(`${prefix}: 수량은 1 이상의 정수여야 합니다.`)
        if (!['Y', 'N'].includes(row['취소여부'])) errors.push(`${prefix}: 취소여부는 Y 또는 N이어야 합니다.`)
        if (!validNumber(row['단가'], { min: 0, blank: true })) errors.push(`${prefix}: 단가가 올바르지 않습니다.`)
        // Imported historical return amounts may be negative; do not recalculate them.
        for (const h of ['공급가액', '부가세', '합계']) {
          if (!validNumber(row[h], { blank: true })) errors.push(`${prefix}: ${h}가 올바르지 않습니다.`)
        }
      } else {
        for (const h of ['조정전재고', '조정수량', '조정후재고']) {
          if (!validNumber(row[h], { integer: true })) errors.push(`${prefix}: ${h}가 올바르지 않습니다.`)
        }
      }
    })
  }
  if (missingItems.size) warnings.push(`현재 품목 목록에 없는 과거 품목코드가 ${missingItems.size}개 있습니다. 해당 기록은 보존합니다.`)
  return { errors, warnings }
}

function assertWorkbook(workbook, allowV100 = false) {
  const report = validateWorkbook(workbook, allowV100)
  if (report.errors.length) throw userError(`재고 데이터 검사에서 오류를 발견했습니다. ${report.errors.slice(0, 5).join(' ')}${report.errors.length > 5 ? ` 외 ${report.errors.length - 5}건` : ''}`)
  return report
}

function readManagedWorkbook(path) {
  const workbook = XLSX.readFile(path, { cellDates: true })
  assertWorkbook(workbook, true)
  // In-memory migration protects writes even if a caller bypassed the startup UI.
  migrateWorkbook(workbook)
  return workbook
}

function migrateWorkbook(workbook) {
  const name = '입출고내역'
  const headers = getSheetHeaders(workbook, name)
  const missing = ['규격', '단위'].filter((header) => !headers.includes(header))
  if (!missing.length) return false
  const items = new Map(readSheetRows(workbook, '품목').map((row) => [normalizeCode(row['코드']), row]))
  const old = workbook.Sheets[name]
  const rows = readSheetRows(workbook, name)
  const newHeaders = [...headers]
  // Insert only absent columns, keeping all other headers and cell values intact.
  for (const header of missing) {
    const after = header === '규격' ? '품목명' : '규격'
    newHeaders.splice(newHeaders.indexOf(after) + 1, 0, header)
  }
  const range = XLSX.utils.decode_range(old['!ref'])
  const next = { ...old }
  for (const address of Object.keys(next)) if (!address.startsWith('!')) delete next[address]
  for (let r = 0; r <= range.e.r; r += 1) {
    for (let c = 0; c < newHeaders.length; c += 1) {
      const h = newHeaders[c]
      const oldColumn = headers.indexOf(h)
      const address = XLSX.utils.encode_cell({ r, c })
      if (oldColumn >= 0) {
        const cell = old[XLSX.utils.encode_cell({ r, c: oldColumn })]
        if (cell) next[address] = { ...cell }
      } else if (r === 0) next[address] = { t: 's', v: h }
      else {
        // Lookup the physical row's code, not the compacted JSON row position.
        const codeCell = old[XLSX.utils.encode_cell({ r, c: headers.indexOf('품목코드') })]
        const value = items.get(normalizeCode(codeCell?.v))?.[h] ?? ''
        next[address] = { t: typeof value === 'number' ? 'n' : 's', v: value }
      }
    }
  }
  next['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: range.e.r, c: newHeaders.length - 1 } })
  if (old['!cols']) next['!cols'] = newHeaders.map((h) => old['!cols'][headers.indexOf(h)] ?? { wch: 14 })
  workbook.Sheets[name] = next
  if (readSheetRows(workbook, name).length !== rows.length) throw userError('기존 거래 수를 확인하지 못해 데이터 보완을 중단했습니다.')
  return true
}

function inspectDataFile(path) {
  if (!existsSync(path)) return { exists: false, valid: false, errors: [], warnings: [] }
  try {
    const workbook = XLSX.readFile(path, { cellDates: true })
    const report = validateWorkbook(workbook, true)
    return { exists: true, valid: report.errors.length === 0, workbook, ...report }
  } catch (error) {
    return { exists: true, valid: false, errors: [toUserMessage(error, '재고 데이터 파일을 읽을 수 없습니다.')], warnings: [] }
  }
}

function recoveryCandidates() {
  return [['previous', previousDataFileName, '이전 정상 데이터'], ['temporary', tempDataFileName, '저장 중이던 데이터']]
    .flatMap(([kind, name, label]) => {
      const path = getDataFilePath(name)
      const checked = inspectDataFile(path)
      return checked.valid ? [{ kind, label, modifiedAt: statSync(path).mtime.toISOString(),
        transactionCount: readSheetRows(checked.workbook, '입출고내역').length }] : []
    })
}

function flushFile(path) {
  const fd = openSync(path, 'r+')
  try { fsyncSync(fd) } finally { closeSync(fd) }
}

function archiveRecoveryFile(path) {
  const folder = join(getDataFolderPath(), 'recovery')
  mkdirSync(folder, { recursive: true })
  const target = join(folder, `${Date.now()}-${backupSequence++}-${basename(path)}`)
  copyFileSync(path, target)
  flushFile(target)
  return target
}

function recoverData(kind) {
  if (!['previous', 'temporary'].includes(kind)) throw userError('복구할 데이터를 선택해 주세요.')
  const livePath = getDataFilePath(dataFileName)
  if (inspectDataFile(livePath).valid) throw userError('현재 데이터가 정상입니다. 이전 데이터로 자동 교체하지 않습니다. 다시 확인을 눌러 주세요.')
  const source = getDataFilePath(kind === 'previous' ? previousDataFileName : tempDataFileName)
  const inspected = inspectDataFile(source)
  if (!inspected.valid) throw userError('선택한 복구 데이터를 사용할 수 없습니다. 다른 백업을 확인해 주세요.')
  archiveRecoveryFile(source)
  migrateWorkbook(inspected.workbook)
  saveWorkbookSafely(inspected.workbook, livePath, { recovery: true })
  return getDataStatus()
}

function writeClientRows(workbook, sheetName, rows) {
  const headers = [...new Set([...getSheetHeaders(workbook, sheetName), ...workbookHeaders[sheetName]])]
  replaceSheet(workbook, sheetName, headers, rows.map((row) => headers.map((header) => row[header] ?? '')))
}

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,

    minWidth: 1100,
    minHeight: 700,

    show: false,
    autoHideMenuBar: true,

    ...(process.platform === 'linux'
      ? { icon }
      : {}),

    webPreferences: {
      preload: join(
        __dirname,
        '../preload/index.js'
      ),
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

  handleInventory(
    'data-file:status',
    () => getDataStatus()
  )
  handleInventory('data-file:create', () => createDataFile())
  handleInventory(
    'existing-excel:import',
    () => importExistingExcel()
  )
  handleInventory('items:get', () => readItemsFromExcel())
  handleInventory('items:add', (_, item) => addItem(item))
  handleInventory('items:update', (_, originalCode, item) =>
    updateItem(originalCode, item)
  )
  handleInventory('items:delete', (_, code) => deleteItem(code))

  handleInventory('clients:get', (_, clientType) =>
    readClientsFromExcel(clientType)
  )

  handleInventory('clients:add', (_, clientType, client) =>
    addClient(clientType, client)
  )

  handleInventory(
    'clients:update',
    (_, clientType, originalCode, client) =>
      updateClient(clientType, originalCode, client)
  )

  handleInventory('clients:delete', (_, clientType, code) =>
    deleteClient(clientType, code)
  )

  handleInventory(
    'transactions:get',
    () => readTransactionsFromExcel()
  )
  
  handleInventory(
    'transactions:add',
    (_, transaction) =>
      addTransaction(transaction)
  )

  handleInventory(
    'transactions:cancel',
    (_, transactionNo, reason) =>
      cancelTransaction(transactionNo, reason)
  )

  handleInventory(
    'inventory:check',
    () =>
      checkInventory()
  )

  handleInventory(
    'inventory-adjustments:get',
    () =>
      readInventoryAdjustments()
  )

  handleInventory(
    'inventory-adjustments:add',
    (_, adjustment) =>
      addInventoryAdjustment(
        adjustment
      )
  )

  handleInventory(
    'backup:create',
    () => createBackup()
  )

  handleInventory(
    'backup:list',
    () => getBackupList()
  )

  handleInventory(
    'backup:restore',
    (_, fileName) =>
      restoreBackup(fileName)
  )

  handleInventory(
    'backup:settings:get',
    () => getBackupSettings()
  )

  handleInventory(
    'backup:settings:save',
    (_, settings) =>
      saveBackupSettings(settings)
  )

  handleInventory(
    'backup:folder:open',
    () => openBackupFolder()
  )

  handleInventory(
    'transactions:export',
    (_, transactions) =>
      exportTransactions(
        transactions
      )
  )

  handleInventory(
    'export:folder:open',
    () =>
      openExportFolder()
  )

  handleInventory('data-file:recover', (_, kind) => recoverData(kind))

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
