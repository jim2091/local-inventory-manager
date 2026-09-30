// Executes the actual Main data functions with a temporary Documents folder.
// Electron GUI/IPC transport and Windows file locking require separate Windows checks.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const vm = require('node:vm')
const crypto = require('node:crypto')
const XLSX = require('xlsx')
const source = fs
  .readFileSync(path.join(__dirname, '../src/main/index.js'), 'utf8')
  .replace(/^import[\s\S]*?from ['"][^'"]+['"]\s*;?/gm, '')
  .split('app.whenReady()')[0]
const plain = (value) => JSON.parse(JSON.stringify(value))
const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
function harness(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inventory-v101-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const h = { root, fail: null, selected: '', handlers: new Map(), opened: [] }
  const ctx = {
    console: { error() {} },
    Date,
    XLSX: { ...XLSX },
    ...path,
    app: { getPath: () => root },
    shell: {
      openPath: (p) => {
        h.opened.push(p)
        return Promise.resolve('')
      }
    },
    dialog: {
      showOpenDialog: async () => ({
        canceled: !h.selected,
        filePaths: h.selected ? [h.selected] : []
      })
    },
    ipcMain: { handle: (name, callback) => h.handlers.set(name, callback) }
  }
  for (const name of [
    'copyFileSync',
    'renameSync',
    'openSync',
    'closeSync',
    'fsyncSync',
    'existsSync',
    'mkdirSync',
    'unlinkSync',
    'readdirSync',
    'statSync',
    'readFileSync',
    'writeFileSync'
  ]) {
    ctx[name] = (...args) => {
      h.fail?.(name, args)
      return fs[name](...args)
    }
  }
  for (const name of ['writeFile', 'readFile'])
    ctx.XLSX[name] = (...args) => {
      h.fail?.(`xlsx.${name}`, args)
      return XLSX[name](...args)
    }
  vm.createContext(ctx)
  vm.runInContext(source, ctx, { filename: 'src/main/index.js' })
  h.c = ctx
  h.file = (name = '재고관리데이터.xlsx') => ctx.getDataFilePath(name)
  h.read = () => XLSX.readFile(h.file(), { cellDates: true })
  h.rows = (name) => plain(ctx.readSheetRows(h.read(), name))
  h.write = (w) => XLSX.writeFile(w, h.file(), { cellDates: true })
  h.stock = () => Number(h.rows('품목')[0]['현재재고량'])
  h.tx = (type = '출고', quantity = 3, extra = {}) =>
    ctx.addTransaction({
      type,
      quantity,
      itemCode: 'A',
      clientCode: 'C',
      date: '2026-09-21',
      unitPrice: 100,
      ...extra
    })
  h.seed = (stock = 10) => {
    ctx.createDataFile()
    ctx.addItem({
      code: 'A',
      name: '시험 품목',
      initialStock: stock,
      spec: 'SPEC-old',
      unit: 'EA',
      salesPrice: 100
    })
    ctx.addClient('sales', {
      code: 'C',
      name: '판매처',
      businessNumber: '001-23',
      phone: '02-001',
      representative: '대표',
      actualAddress: '주소'
    })
    ctx.addClient('purchase', { code: 'C', name: '매입처' })
  }
  h.legacy = () => {
    const w = h.read()
    const headers = ctx
      .getSheetHeaders(w, '입출고내역')
      .filter((x) => !['규격', '단위'].includes(x))
    const rows = ctx.readSheetRows(w, '입출고내역')
    ctx.replaceSheet(
      w,
      '입출고내역',
      headers,
      rows.map((r) => headers.map((key) => r[key]))
    )
    return w
  }
  return h
}

test('new file / required six sheets / malformed rows and missing master warnings', (t) => {
  const h = harness(t)
  assert.equal(h.c.getDataStatus().ready, false)
  assert.equal(h.c.createDataFile().created, true)
  assert.equal(h.read().SheetNames.length, 6)
  h.c.addItem({ code: 'A', name: '품목', initialStock: 10 })
  let w = h.read()
  const headers = h.c.getSheetHeaders(w, '품목')
  const row = h.c.readSheetRows(w, '품목')[0]
  h.c.replaceSheet(
    w,
    '품목',
    headers,
    [row, row].map((r) => headers.map((key) => r[key]))
  )
  assert.match(h.c.validateWorkbook(w).errors.join(), /중복/)
  w = h.read()
  delete w.Sheets['설정']
  assert.match(h.c.validateWorkbook(w).errors.join(), /설정/)
  h.c.addClient('sales', { code: 'C', name: '고객' })
  h.tx()
  w = h.read()
  h.c.replaceSheet(w, '품목', headers, [])
  const report = h.c.validateWorkbook(w)
  assert.equal(report.errors.length, 0)
  assert.equal(report.warnings.length, 1)
})

test('v1.0.0 migration preserves every historical value and current stock; idempotent', (t) => {
  const h = harness(t)
  h.seed()
  h.tx()
  h.tx('출고반입', 1)
  h.c.cancelTransaction(2, '시험 취소')
  const w = h.legacy()
  const header = h.c.getSheetHeaders(w, '입출고내역')
  const oldRows = h.c.readSheetRows(w, '입출고내역')
  oldRows[1]['품목코드'] = 'DELETED'
  h.c.replaceSheet(
    w,
    '입출고내역',
    header,
    oldRows.map((r) => header.map((key) => r[key]))
  )
  h.write(w)
  const before = hash(h.file()),
    itemBefore = h.rows('품목'),
    txBefore = h.rows('입출고내역')
  assert.equal(h.c.getDataStatus().migrated, true)
  assert.equal(hash(h.file('재고관리데이터.prev.xlsx')), before)
  assert.deepEqual(h.rows('품목'), itemBefore)
  h.rows('입출고내역').forEach((row, i) => {
    assert.equal(row['規格'], undefined)
    assert.equal(row['규격'], i ? '' : 'SPEC-old')
    delete row['규격']
    delete row['단위']
    assert.deepEqual(row, txBefore[i])
  })
  const migratedHash = hash(h.file())
  assert.equal(h.c.getDataStatus().migrated, false)
  assert.equal(hash(h.file()), migratedHash)
})

test('three transaction types, negative approval, stale approval, snapshot and cancellation', (t) => {
  const h = harness(t)
  h.seed(10)
  assert.equal(h.tx('출고', 3).currentStock, 7)
  assert.equal(h.tx('입고', 2).currentStock, 9)
  assert.equal(h.tx('출고반입', 1).currentStock, 10)
  for (const no of [3, 2, 1]) h.c.cancelTransaction(no, '취소')
  assert.equal(h.stock(), 10)
  assert.throws(() => h.c.cancelTransaction(1, '중복'))
  h.tx('출고', 7)
  const before = hash(h.file()),
    backups = h.c.getBackupList().length
  const denied = h.tx('출고', 8)
  assert.equal(denied.expectedStock, -5)
  assert.equal(denied.requiresNegativeStockConfirmation, true)
  assert.equal(hash(h.file()), before)
  assert.equal(h.c.getBackupList().length, backups)
  assert.equal(h.tx('출고', 8, { allowNegativeStock: true, confirmedStock: 99 }).success, false)
  assert.equal(h.tx('출고', 8, { allowNegativeStock: true, confirmedStock: 3 }).currentStock, -5)
  const item = h.c.readItemsFromExcel()[0]
  h.c.updateItem('A', {
    ...item,
    spec: 'SPEC-new',
    unit: 'BOX',
    currentStock: 999,
    initialStock: 999
  })
  assert.equal(h.stock(), -5)
  assert.equal(h.rows('품목')[0]['기초재고량'], 10)
  assert.ok(h.rows('입출고내역').every((r) => r['규격'] === 'SPEC-old' && r['단위'] === 'EA'))
  assert.throws(() => h.c.deleteItem('A'))
  assert.throws(() => h.c.deleteClient('sales', 'C'))
  assert.throws(() => h.c.updateClient('sales', 'C', { code: 'D', name: '수정' }))
  assert.throws(() => h.c.updateItem('A', { ...item, code: 'B' }))
})

test('client CRUD preserves 14 details plus custom column, other rows and both client types', (t) => {
  const h = harness(t)
  h.seed()
  for (const [type, sheet] of [
    ['sales', '매출거래처'],
    ['purchase', '매입거래처']
  ]) {
    const w = h.read(),
      headers = [...h.c.getSheetHeaders(w, sheet), '추가메모']
    const row = Object.fromEntries(headers.map((key, i) => [key, `값${i}`]))
    row['코드'] = 'C'
    row['거래처명'] = '원래 이름'
    h.c.replaceSheet(w, sheet, headers, [headers.map((key) => row[key])])
    h.write(w)
    h.c.updateClient(type, 'C', { code: 'C', name: '변경 이름' })
    assert.deepEqual(h.rows(sheet)[0], { ...row, 거래처명: '변경 이름' })
    h.c.addClient(type, { code: 'D', name: '새 거래처' })
    h.c.deleteClient(type, 'D')
    assert.deepEqual(h.rows(sheet), [{ ...row, 거래처명: '변경 이름' }])
  }
})

test('Main input validation, actual/delta adjustments, history and reconciliation', (t) => {
  const h = harness(t)
  h.seed()
  for (const price of [-1, NaN, Infinity, 'NaN']) {
    assert.throws(() => h.c.addItem({ code: 'X', name: 'X', initialPrice: price }))
    assert.throws(() => h.tx('입고', 1, { unitPrice: price }))
  }
  for (const qty of [0, -1, 1.5, NaN, Infinity, '']) assert.throws(() => h.tx('입고', qty))
  for (const extra of [{ date: '2026-02-30' }, { itemCode: 'missing' }, { clientCode: 'missing' }])
    assert.throws(() => h.tx('입고', 1, extra))
  assert.throws(() => h.tx('반출', 1))
  assert.throws(() => h.c.addItem({ code: ' A ', name: '중복' }))
  const adj = { itemCode: 'A', date: '2026-09-21', reason: '실사', mode: 'actual', actualStock: -1 }
  assert.throws(() => h.c.addInventoryAdjustment(adj))
  h.c.addInventoryAdjustment({ ...adj, actualStock: 4, quantity: 999 })
  assert.equal(h.stock(), 4)
  h.c.addInventoryAdjustment({ ...adj, mode: 'quantity', quantity: -6 })
  assert.equal(h.stock(), -2)
  assert.equal(h.c.readInventoryAdjustments().length, 2)
  assert.equal(h.rows('재고조정')[0]['조정수량'], -6)
  assert.throws(() => h.c.deleteItem('A'))
  assert.equal(h.c.checkInventory().mismatchCount, 0)
  const changed = h.read()
  const stockColumn = h.c.getSheetHeaders(changed, '품목').indexOf('현재재고량')
  changed.Sheets['품목'][XLSX.utils.encode_cell({ r: 1, c: stockColumn })].v = 5
  h.write(changed)
  const inspection = h.c.checkInventory()
  assert.equal(inspection.mismatchCount, 1)
  assert.equal(inspection.mismatches[0].calculatedStock, -2)
  assert.equal(inspection.mismatches[0].difference, 7)
  assert.equal(h.stock(), 5)
})

for (const liveState of ['missing', 'corrupt']) {
  for (const kind of ['previous', 'temporary'])
    test(`recovery: ${liveState} live + ${kind}`, (t) => {
      const h = harness(t)
      h.seed()
      h.tx()
      const candidate = h.file(
        kind === 'previous' ? '재고관리데이터.prev.xlsx' : '재고관리데이터.tmp.xlsx'
      )
      fs.copyFileSync(h.file(), candidate)
      if (liveState === 'missing') fs.unlinkSync(h.file())
      else fs.writeFileSync(h.file(), 'broken excel')
      const status = h.c.getDataStatus()
      assert.equal(status.ready, false)
      assert.equal(status.recoveryRequired, true)
      assert.ok(status.candidates.some((c) => c.kind === kind))
      assert.equal(h.c.recoverData(kind).ready, true)
      assert.equal(h.stock(), 7)
    })
}

test('normal live wins with both candidates; missing live does not create a blank file', (t) => {
  const h = harness(t)
  h.seed()
  h.tx()
  fs.copyFileSync(h.file(), h.file('재고관리데이터.tmp.xlsx'))
  const before = hash(h.file())
  assert.equal(h.c.getDataStatus().ready, true)
  assert.equal(hash(h.file()), before)
  assert.throws(() => h.c.recoverData('previous'))
  fs.unlinkSync(h.file())
  assert.throws(() => h.c.createDataFile())
  assert.equal(h.c.getDataStatus().candidates.length, 2)
})

for (const stage of ['temp-write', 'temp-validation', 'previous-copy', 'replace-locked']) {
  test(`save fault ${stage}: never rolls live back to stale previous`, (t) => {
    const h = harness(t)
    h.seed()
    h.tx()
    const before = hash(h.file()),
      stale = hash(h.file('재고관리데이터.prev.xlsx'))
    assert.notEqual(stale, before)
    h.fail = (name, args) => {
      const target = String(args[name === 'xlsx.writeFile' ? 1 : 0])
      if (
        (stage === 'temp-write' && name === 'xlsx.writeFile') ||
        (stage === 'temp-validation' && name === 'xlsx.readFile' && target.endsWith('.tmp.xlsx')) ||
        (stage === 'previous-copy' &&
          name === 'copyFileSync' &&
          String(args[1]).endsWith('.pending.xlsx')) ||
        (stage === 'replace-locked' && name === 'renameSync' && args[1] === h.file())
      ) {
        const error = new Error('EPERM C:\\Users\\private')
        error.code = 'EPERM'
        throw error
      }
    }
    assert.throws(
      () => h.tx('입고', 1),
      (error) => !/EPERM|C:\\|remote method/.test(error.message)
    )
    assert.equal(hash(h.file()), before)
  })
}

test('post-replace validation failure restores the immediately previous live bytes', (t) => {
  const h = harness(t)
  h.seed()
  h.tx()
  const before = hash(h.file())
  let replaced = false,
    failed = false
  h.fail = (name, args) => {
    if (name === 'renameSync' && String(args[0]).endsWith('재고관리데이터.tmp.xlsx'))
      replaced = true
    if (replaced && !failed && name === 'xlsx.readFile' && args[0] === h.file()) {
      failed = true
      throw new Error('injected verification failure')
    }
  }
  assert.throws(() => h.tx('입고', 1))
  assert.equal(hash(h.file()), before)
  assert.ok(fs.readdirSync(path.join(h.c.getDataFolderPath(), 'recovery')).length)
})

test('rollback failure preserves previous and archive recovery candidates', (t) => {
  const h = harness(t)
  h.seed()
  h.tx()
  const before = hash(h.file())
  let replaced = false
  h.fail = (name, args) => {
    if (name === 'renameSync' && String(args[0]).endsWith('재고관리데이터.tmp.xlsx'))
      replaced = true
    if (
      replaced &&
      ((name === 'xlsx.readFile' && args[0] === h.file()) ||
        (name === 'renameSync' && String(args[0]).includes('rollback')))
    )
      throw new Error('injected failure')
  }
  assert.throws(() => h.tx('입고', 1), /다시 열어/)
  assert.equal(hash(h.file('재고관리데이터.prev.xlsx')), before)
  assert.ok(fs.existsSync(h.file('재고관리데이터.rollback.tmp.xlsx')))
})

test('backup settings, once-a-day backup, cleanup, legacy restore and invalid restore', (t) => {
  const h = harness(t)
  h.seed()
  h.tx()
  h.c.saveBackupSettings({ autoBackup: true, autoCleanup: true })
  assert.equal(h.c.runAutoBackupIfNeeded().backupCreated, true)
  assert.equal(h.c.runAutoBackupIfNeeded().backupCreated, false)
  const backup = h.c.createBackup(),
    saved = hash(backup.filePath)
  const folder = h.c.getBackupFolderPath()
  for (let i = 0; i < 32; i++)
    fs.copyFileSync(h.file(), path.join(folder, `auto_20000101_${i}.xlsx`))
  assert.equal(h.c.cleanupOldBackups(30).deletedCount, 3)
  assert.equal(hash(backup.filePath), saved)
  const legacyPath = path.join(folder, 'legacy.xlsx')
  XLSX.writeFile(h.legacy(), legacyPath, { cellDates: true })
  const oldHash = hash(legacyPath),
    settingsHash = hash(h.file('settings.json'))
  h.tx('입고', 3)
  h.c.restoreBackup('legacy.xlsx')
  assert.equal(h.stock(), 7)
  assert.equal(hash(legacyPath), oldHash)
  assert.equal(hash(h.file('settings.json')), settingsHash)
  assert.ok(h.c.getSheetHeaders(h.read(), '입출고내역').includes('규격'))
  const ordinary = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(ordinary, XLSX.utils.aoa_to_sheet([['test'], [1]]), 'Sheet1')
  XLSX.writeFile(ordinary, path.join(folder, 'ordinary.xlsx'))
  const before = hash(h.file())
  assert.throws(() => h.c.restoreBackup('ordinary.xlsx'))
  assert.throws(() => h.c.restoreBackup('../escape.xlsx'))
  assert.equal(hash(h.file()), before)
  h.c.openBackupFolder()
  h.c.openExportFolder()
  assert.equal(h.opened.length, 2)
})

test('export retains snapshots and totals without using managed-workbook validation', (t) => {
  const h = harness(t)
  h.seed()
  h.tx()
  const transactions = h.c.readTransactionsFromExcel()
  const result = h.c.exportTransactions(transactions)
  const exported = XLSX.readFile(result.filePath, { cellDates: true })
  const row = XLSX.utils.sheet_to_json(exported.Sheets['입출고조회'])[0]
  assert.equal(row['규격'], 'SPEC-old')
  assert.equal(row['단위'], 'EA')
  assert.equal(row['합계'], 330)
  assert.equal(result.count, 1)
})

test('IPC envelope hides internal paths, exposes actionable validation errors', async (t) => {
  const h = harness(t)
  h.c.handleInventory('test', () => {
    const e = new Error('EBUSY C:\\Users\\secret')
    e.code = 'EBUSY'
    throw e
  })
  const result = await h.handlers.get('test')()
  assert.equal(result.ok, false)
  assert.match(result.message, /Excel/)
  assert.doesNotMatch(result.message, /EBUSY|Users|remote/)
  h.c.handleInventory('validation', () => {
    throw h.c.userError('수량을 확인해 주세요.')
  })
  assert.equal((await h.handlers.get('validation')()).message, '수량을 확인해 주세요.')
})

test(
  'real legacy XLSM import preserves source hash, snapshots, amounts and current stock',
  { skip: !process.env.INVENTORY_LEGACY_FIXTURE },
  async (t) => {
    const h = harness(t)
    h.selected = path.resolve(process.env.INVENTORY_LEGACY_FIXTURE)
    const before = hash(h.selected),
      sourceWorkbook = XLSX.readFile(h.selected, { cellDates: true })
    const originalTransactions = h.c.readLegacyTransactionRows(sourceWorkbook)
    const result = await h.c.importExistingExcel()
    assert.equal(result.transactionCount, originalTransactions.length)
    assert.equal(hash(h.selected), before)
    const rows = h.rows('입출고내역')
    rows.forEach((r, i) => {
      const old = originalTransactions[i]
      assert.equal(r['거래번호'], Number(old[0]))
      assert.equal(r['규격'], old[8])
      assert.equal(r['단위'], old[9])
      assert.equal(Number(r['수량']), Math.abs(Number(old[10])))
      for (const [key, col] of [
        ['단가', 11],
        ['공급가액', 12],
        ['부가세', 13],
        ['합계', 14]
      ])
        assert.equal(Number(r[key]), Number(old[col]))
    })
    assert.deepEqual(
      h.rows('품목').map((r) => r['현재재고량']),
      plain(h.c.readSheetRows(sourceWorkbook, '품목').map((r) => r['현재재고량']))
    )
  }
)

test('startup rejects missing/duplicate keys, invalid dates, types, quantities and cancellation flags', (t) => {
  const h = harness(t)
  h.seed()
  h.tx()
  const good = h.rows('입출고내역')[0]
  for (const [field, value] of [
    ['거래번호', 'text'],
    ['거래번호', ''],
    ['일자', '2026-02-30'],
    ['구분', '기타'],
    ['수량', 0],
    ['수량', 1.5],
    ['취소여부', 'X'],
    ['단가', -1]
  ]) {
    const w = h.read(),
      headers = h.c.getSheetHeaders(w, '입출고내역')
    h.c.replaceSheet(w, '입출고내역', headers, [
      headers.map((key) => ({ ...good, [field]: value })[key])
    ])
    assert.ok(h.c.validateWorkbook(w).errors.length > 0, `${field}=${value}`)
  }
  for (const sheet of ['품목', '매출거래처', '매입거래처']) {
    const w = h.read(),
      headers = h.c.getSheetHeaders(w, sheet),
      row = h.c.readSheetRows(w, sheet)[0]
    row['코드'] = ''
    h.c.replaceSheet(w, sheet, headers, [headers.map((key) => row[key])])
    assert.ok(h.c.validateWorkbook(w).errors.length > 0, sheet)
  }
})

test('legacy import keeps additional client headers and values; cancel leaves current data intact', async (t) => {
  const h = harness(t)
  h.seed()
  const before = hash(h.file())
  assert.equal((await h.c.importExistingExcel()).canceled, true)
  assert.equal(hash(h.file()), before)
  const w = h.read(),
    headers = [...h.c.getSheetHeaders(w, '매출거래처'), '추가메모']
  const client = h.c.readSheetRows(w, '매출거래처')[0]
  client['추가메모'] = '보존 대상'
  h.c.replaceSheet(w, '매출거래처', headers, [headers.map((key) => client[key])])
  w.Sheets['입출고내역'] = XLSX.utils.aoa_to_sheet([
    [
      '키',
      '일자',
      '구분',
      '거래처정보',
      '',
      '주문번호',
      '품목정보',
      '',
      '규격',
      '단위',
      '수량',
      '단가',
      '공급가',
      '부가세',
      '합계'
    ],
    ['', '', '', '코드', '거래처명', '', '코드', '품목명'],
    [
      1,
      new Date(2026, 8, 21),
      '출고',
      'C',
      '판매처',
      '',
      'A',
      '시험 품목',
      'HISTORICAL',
      'PACK',
      2,
      100,
      200,
      20,
      220
    ]
  ])
  h.selected = path.join(h.root, 'legacy-import.xlsx')
  XLSX.writeFile(w, h.selected, { cellDates: true })
  const sourceHash = hash(h.selected)
  assert.equal((await h.c.importExistingExcel()).success, true)
  assert.equal(h.rows('매출거래처')[0]['추가메모'], '보존 대상')
  assert.equal(h.rows('입출고내역')[0]['규격'], 'HISTORICAL')
  assert.equal(h.rows('입출고내역')[0]['단위'], 'PACK')
  assert.equal(h.stock(), 10)
  assert.equal(hash(h.selected), sourceHash)
  assert.ok(h.c.getBackupList().some((b) => b.fileName.startsWith('before_import_')))
})
