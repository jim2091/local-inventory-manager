import TransactionManager from './components/TransactionManager'
import TransactionList from './components/TransactionList'
import ItemManager from './components/ItemManager'
import ClientManager from './components/ClientManager'
import InventoryChecker from './components/InventoryChecker'
import BackupManager from './components/BackupManager'

function App() {
  return (
    <>
      <BackupManager />

      <hr />

      <TransactionManager />

      <hr />

      <TransactionList />

      <hr />

      <InventoryChecker />

      <hr />

      <ItemManager />

      <hr />

      <ClientManager />

      
    </>
  )
}

export default App