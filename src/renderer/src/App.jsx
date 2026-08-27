import { useCallback, useEffect, useState } from 'react'

function App() {
  const [items, setItems] = useState([])
  const [errorMessage, setErrorMessage] = useState('')
  const [createResultMessage, setCreateResultMessage] = useState('')
  const [importResultMessage, setImportResultMessage] = useState('')
  const [transactionImportResultMessage, setTransactionImportResultMessage] = useState('')

  const loadItems = useCallback(() => {
    window.inventoryApi
      .getItems()
      .then(setItems)
      .catch((error) => {
        console.error(error)
        setErrorMessage('품목 목록을 불러오지 못했습니다.')
      })
  }, [])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  const handleCreateDataFile = () => {
    setCreateResultMessage('')

    window.inventoryApi
      .createDataFile()
      .then((result) => {
        setCreateResultMessage(
          result.created ? '새 데이터 파일을 생성했습니다.' : '이미 데이터 파일이 존재합니다.'
        )
      })
      .catch((error) => {
        console.error(error)
        setCreateResultMessage('새 데이터 파일을 생성하지 못했습니다.')
      })
  }

  const handleImportLegacyMasterData = () => {
    setImportResultMessage('')

    window.inventoryApi
      .importLegacyMasterData()
      .then((result) => {
        setImportResultMessage(
          `기존 데이터를 가져왔습니다. 품목 ${result.itemCount}개 / 매출거래처 ${result.salesClientCount}개 / 매입거래처 ${result.purchaseClientCount}개`
        )
        loadItems()
      })
      .catch((error) => {
        console.error(error)
        setImportResultMessage('기존 데이터를 가져오지 못했습니다.')
      })
  }

  const handleImportLegacyTransactions = () => {
    setTransactionImportResultMessage('')

    window.inventoryApi
      .importLegacyTransactions()
      .then((result) => {
        const missingItemCount = result.missingItemCodes.length
        const missingClientCount = result.missingClientCodes.length
        const typeCounts = result.transactionTypeCounts
        const missingSummary = [
          missingItemCount > 0 ? `현재 품목 목록에 없는 코드 ${missingItemCount}개` : '',
          missingClientCount > 0 ? `현재 거래처 목록에 없는 코드 ${missingClientCount}개` : ''
        ]
          .filter(Boolean)
          .join(' / ')

        setTransactionImportResultMessage(
          [
            `기존 입출고내역을 가져왔습니다. 총 ${result.transactionCount}건`,
            `입고 ${typeCounts['입고']} / 출고 ${typeCounts['출고']} / 출고반입 ${typeCounts['출고반입']}`,
            `출고반입 수량 정규화 ${result.normalizedReturnCount}건`,
            missingSummary
          ]
            .filter(Boolean)
            .join(' ')
        )
      })
      .catch((error) => {
        console.error(error)
        setTransactionImportResultMessage('기존 입출고내역을 가져오지 못했습니다.')
      })
  }

  return (
    <main>
      <h1>품목 목록</h1>
      <p>총 {items.length}개</p>

      <button type="button" onClick={handleCreateDataFile}>
        새 데이터 파일 생성 테스트
      </button>
      {createResultMessage && <p>{createResultMessage}</p>}

      <button type="button" onClick={handleImportLegacyMasterData}>
        기존 데이터 가져오기 테스트
      </button>
      {importResultMessage && <p>{importResultMessage}</p>}

      <button type="button" onClick={handleImportLegacyTransactions}>
        기존 입출고내역 가져오기 테스트
      </button>
      {transactionImportResultMessage && <p>{transactionImportResultMessage}</p>}

      {errorMessage && <p>{errorMessage}</p>}

      <table>
        <thead>
          <tr>
            <th>구분</th>
            <th>코드</th>
            <th>품목명</th>
            <th>기초재고단가</th>
            <th>매입단가</th>
            <th>매출단가</th>
            <th>기초재고량</th>
            <th>현재재고량</th>
            <th>단위</th>
            <th>규격</th>
            <th>브랜드명</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={`${item.code}-${index}`}>
              <td>{item.type}</td>
              <td>{item.code}</td>
              <td>{item.name}</td>
              <td>{item.initialPrice}</td>
              <td>{item.purchasePrice}</td>
              <td>{item.salesPrice}</td>
              <td>{item.initialStock}</td>
              <td>{item.currentStock}</td>
              <td>{item.unit}</td>
              <td>{item.spec}</td>
              <td>{item.brand}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}

export default App
