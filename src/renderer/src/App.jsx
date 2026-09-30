import DataRecovery from './components/DataRecovery'
import {
  useEffect,
  useState
} from 'react'

import TransactionManager
  from './components/TransactionManager'

import TransactionList
  from './components/TransactionList'

import InventoryChecker
  from './components/InventoryChecker'

import BackupManager
  from './components/BackupManager'

import ItemManager
  from './components/ItemManager'

import ClientManager
  from './components/ClientManager'

import ExistingExcelImporter
  from './components/ExistingExcelImporter'

import FirstRunSetup
  from './components/FirstRunSetup'

import InventoryStatus
  from './components/InventoryStatus'

import InventoryAdjustment
  from './components/InventoryAdjustment'

function App() {
  const [dataStatus, setDataStatus] = useState(null)
  const refreshStatus = async () => {
    const result = await window.inventoryApi.getDataStatus()
    setDataStatus(result)
    setDataReady(result.ready)
  }
  const [dataReady, setDataReady] =
    useState(null)

  const [currentMenu, setCurrentMenu] =
    useState('transaction-add')

  useEffect(() => {
    window.inventoryApi
      .getDataStatus()
      .then((result) => {
        setDataStatus(result)
        setDataReady(result.ready)
      })
      .catch((error) => {
        console.error(error)
        setDataStatus({ blocked: true, errors: [error.message || '데이터를 확인하지 못했습니다.'], candidates: [] })
        setDataReady(false)
      })
  }, [])

  if (dataReady === null) {
    return (
      <div className="setup-page">
        프로그램을 준비하고 있습니다.
      </div>
    )
  }

  if (dataStatus?.blocked || dataStatus?.recoveryRequired) {
    return <DataRecovery status={dataStatus} onComplete={refreshStatus} />
  }

  if (!dataReady) {
    return (
      <FirstRunSetup
        onComplete={refreshStatus}
      />
    )
  }

  const renderContent = () => {
    switch (currentMenu) {
      case 'transaction-add':
        return <TransactionManager />

      case 'transaction-list':
        return <TransactionList />

      case 'items':
        return <ItemManager />

      case 'clients':
        return <ClientManager />

      case 'inventory-check':
        return <InventoryChecker />

      case 'backup':
        return <BackupManager />

      case 'import':
        return <ExistingExcelImporter />

      case 'inventory-status':
        return <InventoryStatus />

      case 'inventory-adjustment':
        return <InventoryAdjustment />

      default:
        return <TransactionManager />
    }
  }

  return (
    <div className="app-layout">
      <div className="sidebar">
        <div className="sidebar-title">
          재고관리 프로그램
        </div>

        <button
          type="button"
          className={
            currentMenu === 'transaction-add'
              ? 'menu-button active'
              : 'menu-button'
          }
          onClick={() =>
            setCurrentMenu('transaction-add')
          }
        >
          입출고 등록
        </button>

        <button
          type="button"
          className={
            currentMenu === 'transaction-list'
              ? 'menu-button active'
              : 'menu-button'
          }
          onClick={() =>
            setCurrentMenu('transaction-list')
          }
        >
          입출고 조회
        </button>

        <button
          type="button"
          className={
            currentMenu === 'inventory-status'
              ? 'menu-button active'
              : 'menu-button'
          }
          onClick={() =>
            setCurrentMenu('inventory-status')
          }
        >
          재고 현황
        </button>

        <button
          type="button"
          className={
            currentMenu === 'inventory-adjustment'
              ? 'menu-button active'
              : 'menu-button'
          }
          onClick={() =>
            setCurrentMenu(
              'inventory-adjustment'
            )
          }
        >
          재고 조정
        </button>

        <button
          type="button"
          className={
            currentMenu === 'items'
              ? 'menu-button active'
              : 'menu-button'
          }
          onClick={() =>
            setCurrentMenu('items')
          }
        >
          품목 관리
        </button>

        <button
          type="button"
          className={
            currentMenu === 'clients'
              ? 'menu-button active'
              : 'menu-button'
          }
          onClick={() =>
            setCurrentMenu('clients')
          }
        >
          거래처 관리
        </button>

        <button
          type="button"
          className={
            currentMenu === 'inventory-check'
              ? 'menu-button active'
              : 'menu-button'
          }
          onClick={() =>
            setCurrentMenu('inventory-check')
          }
        >
          재고 검사
        </button>

        <button
          type="button"
          className={
            currentMenu === 'backup'
              ? 'menu-button active'
              : 'menu-button'
          }
          onClick={() =>
            setCurrentMenu('backup')
          }
        >
          백업 / 복원
        </button>

        <button
          type="button"
          className={
            currentMenu === 'import'
              ? 'menu-button active'
              : 'menu-button'
          }
          onClick={() =>
            setCurrentMenu('import')
          }
        >
          기존 Excel 가져오기
        </button>
      </div>

      <div className="content">
        {dataStatus?.warnings?.length > 0 && <details className="startup-notice"><summary>데이터 확인 안내 ({dataStatus.warnings.length}건)</summary>
          <ul>{dataStatus.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>
        </details>}
        {renderContent()}
      </div>
    </div>
  )
}

export default App