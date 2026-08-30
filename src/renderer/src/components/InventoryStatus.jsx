import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react'

function InventoryStatus() {
  const [items, setItems] =
    useState([])

  const [keyword, setKeyword] =
    useState('')

  const [stockFilter, setStockFilter] =
    useState('all')

  const [sortType, setSortType] =
    useState('code')

  const [message, setMessage] =
    useState('')

  const loadItems =
    useCallback(() => {
      window.inventoryApi
        .getItems()
        .then(setItems)
        .catch((error) => {
          console.error(error)

          setMessage(
            '재고 현황을 불러오지 못했습니다.'
          )
        })
    }, [])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  const filteredItems =
    useMemo(() => {
      const searchKeyword =
        keyword
          .trim()
          .toLowerCase()

      let result =
        items.filter((item) => {
          const currentStock =
            Number(item.currentStock) || 0

          if (
            stockFilter === 'negative' &&
            currentStock >= 0
          ) {
            return false
          }

          if (
            stockFilter === 'zero' &&
            currentStock !== 0
          ) {
            return false
          }

          if (
            stockFilter === 'positive' &&
            currentStock <= 0
          ) {
            return false
          }

          if (!searchKeyword) {
            return true
          }

          const text = [
            item.code,
            item.name,
            item.brand,
            item.spec,
            item.type
          ]
            .join(' ')
            .toLowerCase()

          return text.includes(
            searchKeyword
          )
        })

      result = [...result]

      if (sortType === 'stock-asc') {
        result.sort(
          (a, b) =>
            Number(a.currentStock || 0) -
            Number(b.currentStock || 0)
        )
      } else if (
        sortType === 'stock-desc'
      ) {
        result.sort(
          (a, b) =>
            Number(b.currentStock || 0) -
            Number(a.currentStock || 0)
        )
      } else if (
        sortType === 'name'
      ) {
        result.sort(
          (a, b) =>
            String(a.name ?? '')
              .localeCompare(
                String(b.name ?? ''),
                'ko'
              )
        )
      } else {
        result.sort(
          (a, b) =>
            String(a.code ?? '')
              .localeCompare(
                String(b.code ?? ''),
                'ko'
              )
        )
      }

      return result
    }, [
      items,
      keyword,
      stockFilter,
      sortType
    ])

  const summary =
    useMemo(() => {
      return items.reduce(
        (acc, item) => {
          const stock =
            Number(
              item.currentStock
            ) || 0

          const purchasePrice =
            Number(
              item.purchasePrice
            ) || 0

          acc.totalItemCount += 1
          acc.totalStock += stock

          acc.purchaseValue +=
            stock * purchasePrice

          if (stock < 0) {
            acc.negativeCount += 1
          }

          if (stock === 0) {
            acc.zeroCount += 1
          }

          return acc
        },
        {
          totalItemCount: 0,
          totalStock: 0,
          negativeCount: 0,
          zeroCount: 0,
          purchaseValue: 0
        }
      )
    }, [items])

  const formatNumber = (value) => {
    const number = Number(value)

    if (!Number.isFinite(number)) {
      return '0'
    }

    return number.toLocaleString()
  }

  return (
    <div className="inventory-status-page">
      <div className="page-header">
        <div>
          <h1>재고 현황</h1>

          <p>
            전체 품목의 현재 재고를
            한눈에 확인합니다.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={loadItems}
        >
          새로고침
        </button>
      </div>

      {message && (
        <div className="inventory-status-message">
          {message}
        </div>
      )}

      <div className="inventory-status-summary">
        <div>
          <span>전체 품목</span>

          <strong>
            {formatNumber(
              summary.totalItemCount
            )}개
          </strong>
        </div>

        <div>
          <span>전체 재고수량</span>

          <strong>
            {formatNumber(
              summary.totalStock
            )}
          </strong>
        </div>

        <div>
          <span>재고 0 품목</span>

          <strong>
            {formatNumber(
              summary.zeroCount
            )}개
          </strong>
        </div>

        <div
          className={
            summary.negativeCount > 0
              ? 'inventory-summary-warning'
              : ''
          }
        >
          <span>음수 재고 품목</span>

          <strong>
            {formatNumber(
              summary.negativeCount
            )}개
          </strong>
        </div>

        <div>
          <span>매입단가 기준 재고금액</span>

          <strong>
            {formatNumber(
              summary.purchaseValue
            )}원
          </strong>
        </div>
      </div>

      <div className="inventory-status-card">
        <div className="inventory-status-controls">
          <input
            type="text"
            value={keyword}
            onChange={(e) =>
              setKeyword(
                e.target.value
              )
            }
            placeholder="품목 코드, 품목명, 브랜드, 규격 검색"
          />

          <select
            value={stockFilter}
            onChange={(e) =>
              setStockFilter(
                e.target.value
              )
            }
          >
            <option value="all">
              전체 재고
            </option>

            <option value="positive">
              재고 있음
            </option>

            <option value="zero">
              재고 0
            </option>

            <option value="negative">
              음수 재고
            </option>
          </select>

          <select
            value={sortType}
            onChange={(e) =>
              setSortType(
                e.target.value
              )
            }
          >
            <option value="code">
              코드순
            </option>

            <option value="name">
              품목명순
            </option>

            <option value="stock-desc">
              재고 많은순
            </option>

            <option value="stock-asc">
              재고 적은순
            </option>
          </select>
        </div>

        <div className="inventory-status-count">
          검색 결과 {filteredItems.length}개
        </div>

        <div className="inventory-status-table-wrapper">
          <table className="inventory-status-table">
            <thead>
              <tr>
                <th>코드</th>
                <th>품목명</th>
                <th>구분</th>
                <th>현재재고</th>
                <th>기초재고</th>
                <th>매입단가</th>
                <th>매출단가</th>
                <th>재고금액</th>
                <th>단위</th>
                <th>규격</th>
                <th>브랜드</th>
              </tr>
            </thead>

            <tbody>
              {filteredItems.length ===
              0 ? (
                <tr>
                  <td
                    colSpan="11"
                    className="empty-table-cell"
                  >
                    조회된 품목이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredItems.map(
                  (item, index) => {
                    const stock =
                      Number(
                        item.currentStock
                      ) || 0

                    const purchasePrice =
                      Number(
                        item.purchasePrice
                      ) || 0

                    const stockValue =
                      stock *
                      purchasePrice

                    return (
                      <tr
                        key={`${item.code}-${index}`}
                        className={
                          stock < 0
                            ? 'negative-stock-row'
                            : stock === 0
                              ? 'zero-stock-row'
                              : ''
                        }
                      >
                        <td className="inventory-status-code">
                          {item.code}
                        </td>

                        <td>
                          {item.name}
                        </td>

                        <td>
                          {item.type || '-'}
                        </td>

                        <td
                          className={
                            stock < 0
                              ? 'stock-number negative'
                              : stock === 0
                                ? 'stock-number zero'
                                : 'stock-number'
                          }
                        >
                          {formatNumber(
                            stock
                          )}
                        </td>

                        <td className="number-cell">
                          {formatNumber(
                            item.initialStock
                          )}
                        </td>

                        <td className="number-cell">
                          {formatNumber(
                            item.purchasePrice
                          )}
                        </td>

                        <td className="number-cell">
                          {formatNumber(
                            item.salesPrice
                          )}
                        </td>

                        <td className="number-cell">
                          {formatNumber(
                            stockValue
                          )}
                        </td>

                        <td>
                          {item.unit || '-'}
                        </td>

                        <td>
                          {item.spec || '-'}
                        </td>

                        <td>
                          {item.brand || '-'}
                        </td>
                      </tr>
                    )
                  }
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default InventoryStatus