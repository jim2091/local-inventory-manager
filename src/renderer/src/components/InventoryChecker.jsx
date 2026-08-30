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
        await window.inventoryApi
          .checkInventory(
            referenceDate
          )

      setResult(response)

      if (
        response.mismatchCount === 0
      ) {
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

  const formatNumber = (value) => {
    const number = Number(value)

    if (!Number.isFinite(number)) {
      return '0'
    }

    return number.toLocaleString()
  }

  return (
    <div className="inventory-check-page">
      <div className="page-header">
        <div>
          <h1>재고 검사</h1>

          <p>
            입출고 내역으로 계산한 재고와
            현재 저장된 재고를 비교합니다.
          </p>
        </div>
      </div>

      <div className="inventory-check-card">
        <div className="inventory-check-title">
          재고 계산 기준일
        </div>

        <p className="inventory-check-description">
          기준일을 포함하여 이후의 입고,
          출고, 출고반입 내역을 계산합니다.
        </p>

        <div className="inventory-check-controls">
          <input
            type="date"
            value={referenceDate}
            onChange={(e) =>
              setReferenceDate(
                e.target.value
              )
            }
          />

          <button
            type="button"
            className="inventory-check-button"
            onClick={checkInventory}
          >
            재고 검사 실행
          </button>
        </div>
      </div>

      {message && (
        <div
          className={
            result &&
            result.mismatchCount === 0
              ? 'inventory-check-message success'
              : result
                ? 'inventory-check-message warning'
                : 'inventory-check-message error'
          }
        >
          {message}
        </div>
      )}

      {result && (
        <>
          <div className="inventory-check-summary">
            <div>
              <span>기준일</span>

              <strong>
                {result.referenceDate}
              </strong>
            </div>

            <div>
              <span>전체 품목</span>

              <strong>
                {formatNumber(
                  result.totalItemCount
                )}개
              </strong>
            </div>

            <div>
              <span>정상 품목</span>

              <strong>
                {formatNumber(
                  result.totalItemCount -
                  result.mismatchCount
                )}개
              </strong>
            </div>

            <div
              className={
                result.mismatchCount > 0
                  ? 'mismatch-summary'
                  : ''
              }
            >
              <span>불일치 품목</span>

              <strong>
                {formatNumber(
                  result.mismatchCount
                )}개
              </strong>
            </div>
          </div>

          <div className="inventory-result-card">
            <div className="inventory-result-header">
              <div>
                <h2>
                  불일치 품목
                </h2>

                <p>
                  계산재고와 현재재고가 다른
                  품목만 표시합니다.
                </p>
              </div>
            </div>

            <div className="inventory-table-wrapper">
              <table className="inventory-check-table">
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
                  {result.mismatches.length ===
                  0 ? (
                    <tr>
                      <td
                        colSpan="9"
                        className="inventory-all-match"
                      >
                        모든 품목의 재고가
                        일치합니다.
                      </td>
                    </tr>
                  ) : (
                    result.mismatches.map(
                      (item) => (
                        <tr
                          key={item.code}
                        >
                          <td className="inventory-code-cell">
                            {item.code}
                          </td>

                          <td className="inventory-name-cell">
                            {item.name}
                          </td>

                          <td className="number-cell">
                            {formatNumber(
                              item.initialStock
                            )}
                          </td>

                          <td className="number-cell">
                            {formatNumber(
                              item.inQuantity
                            )}
                          </td>

                          <td className="number-cell">
                            {formatNumber(
                              item.outQuantity
                            )}
                          </td>

                          <td className="number-cell">
                            {formatNumber(
                              item.returnQuantity
                            )}
                          </td>

                          <td className="number-cell calculated-stock-cell">
                            {formatNumber(
                              item.calculatedStock
                            )}
                          </td>

                          <td className="number-cell current-stock-cell">
                            {formatNumber(
                              item.currentStock
                            )}
                          </td>

                          <td
                            className={
                              item.difference > 0
                                ? 'number-cell difference-cell positive'
                                : 'number-cell difference-cell negative'
                            }
                          >
                            {item.difference > 0
                              ? '+'
                              : ''}

                            {formatNumber(
                              item.difference
                            )}
                          </td>
                        </tr>
                      )
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default InventoryChecker