import { useState } from 'react'

function InventoryChecker() {
  const [referenceDate, setReferenceDate] =
    useState('')

  const [result, setResult] =
    useState(null)

  const [message, setMessage] =
    useState('')

  const checkInventory = async () => {
    setMessage('')
    setResult(null)

    try {
      const response =
        await window.inventoryApi.checkInventory(
          referenceDate
        )

      setResult(response)

      if (response.mismatchCount === 0) {
        setMessage(
          '현재재고와 계산재고가 모두 일치합니다.'
        )
      } else {
        setMessage(
          `재고가 일치하지 않는 품목이 ${response.mismatchCount}개 있습니다.`
        )
      }
    } catch (error) {
      console.error(error)

      setMessage(
        error.message ||
        '재고 검사에 실패했습니다.'
      )
    }
  }

  return (
    <div>
      <h1>재고 검사</h1>

      <p>
        기초재고량의 기준일을 입력해주세요.
      </p>

      <input
        type="date"
        value={referenceDate}
        onChange={(e) =>
          setReferenceDate(e.target.value)
        }
      />

      <button
        type="button"
        onClick={checkInventory}
      >
        재고 검사
      </button>

      {message && <p>{message}</p>}

      {result && (
        <>
          <p>
            전체 품목:
            {' '}
            {result.totalItemCount}개
          </p>

          <p>
            불일치 품목:
            {' '}
            {result.mismatchCount}개
          </p>

          <table>
            <thead>
              <tr>
                <th>코드</th>
                <th>품목명</th>
                <th>기초재고</th>
                <th>입고</th>
                <th>출고</th>
                <th>출고반입</th>
                <th>계산재고</th>
                <th>현재재고</th>
                <th>차이</th>
              </tr>
            </thead>

            <tbody>
              {result.mismatches.map(
                (item) => (
                  <tr key={item.code}>
                    <td>{item.code}</td>
                    <td>{item.name}</td>
                    <td>
                      {item.initialStock}
                    </td>
                    <td>
                      {item.inQuantity}
                    </td>
                    <td>
                      {item.outQuantity}
                    </td>
                    <td>
                      {item.returnQuantity}
                    </td>
                    <td>
                      {item.calculatedStock}
                    </td>
                    <td>
                      {item.currentStock}
                    </td>
                    <td>
                      {item.difference}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}

export default InventoryChecker