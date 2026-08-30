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
  const [dataReady, setDataReady] =
    useState(null)

  const [currentMenu, setCurrentMenu] =
    useState('transaction-add')

  useEffect(() => {
    window.inventoryApi
      .getDataStatus()
      .then((result) => {
        setDataReady(result.exists)
      })
      .catch((error) => {
        console.error(error)
        setDataReady(false)
      })
  }, [])

  if (dataReady === null) {
    return (
      <div>
        프로그램을 준비하고 있습니다.
      </div>
    )
  }

  if (!dataReady) {
    return (
      <FirstRunSetup
        onComplete={() =>
          setDataReady(true)
        }
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
        {renderContent()}
      </div>
    </div>
  )
}

export default App