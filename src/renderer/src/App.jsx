import TransactionManager from './components/TransactionManager'
import TransactionList from './components/TransactionList'
import ItemManager from './components/ItemManager'
import ClientManager from './components/ClientManager'
import InventoryChecker from './components/InventoryChecker'

function App() {
  return (
    <>
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