import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react'

const emptySearch = {
  startDate: '',
  endDate: '',
  type: '',
  clientKeyword: '',
  itemKeyword: '',
  includeCanceled: false
}

const PAGE_SIZE = 100

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0')
  const day = String(
    date.getDate()
  ).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function TransactionList() {
  const [transactions, setTransactions] =
    useState([])

  const [search, setSearch] =
    useState(emptySearch)

  const [message, setMessage] =
    useState('')

  const [page, setPage] =
    useState(1)

  const loadTransactions =
    useCallback(() => {
      window.inventoryApi
        .getTransactions()
        .then(setTransactions)
        .catch((error) => {
          console.error(error)

          setMessage(
            '입출고 내역을 불러오지 못했습니다.'
          )
        })
    }, [])

  useEffect(() => {
    loadTransactions()
  }, [loadTransactions])

  const changeSearch = (e) => {
    const {
      name,
      value,
      type,
      checked
    } = e.target

    setSearch((prev) => ({
      ...prev,
      [name]:
        type === 'checkbox'
          ? checked
          : value
    }))

    setPage(1)
  }

  const setQuickDate = (type) => {
    const today = new Date()

    if (type === 'all') {
      setSearch((prev) => ({
        ...prev,
        startDate: '',
        endDate: ''
      }))

      setPage(1)
      return
    }

    let startDate
    let endDate

    if (type === 'today') {
      startDate = new Date(today)
      endDate = new Date(today)
    }

    if (type === 'week') {
      const day = today.getDay()

      const mondayDiff =
        day === 0
          ? -6
          : 1 - day

      startDate =
        new Date(today)

      startDate.setDate(
        today.getDate() + mondayDiff
      )

      endDate =
        new Date(startDate)

      endDate.setDate(
        startDate.getDate() + 6
      )
    }

    if (type === 'month') {
      startDate =
        new Date(
          today.getFullYear(),
          today.getMonth(),
          1
        )

      endDate =
        new Date(
          today.getFullYear(),
          today.getMonth() + 1,
          0
        )
    }

    if (type === 'last-month') {
      startDate =
        new Date(
          today.getFullYear(),
          today.getMonth() - 1,
          1
        )

      endDate =
        new Date(
          today.getFullYear(),
          today.getMonth(),
          0
        )
    }

    setSearch((prev) => ({
      ...prev,
      startDate: formatDate(startDate),
      endDate: formatDate(endDate)
    }))

    setPage(1)
  }

  const resetSearch = () => {
    setSearch(emptySearch)
    setPage(1)
  }

  const filteredTransactions =
    useMemo(() => {
      const clientKeyword =
        search.clientKeyword
          .trim()
          .toLowerCase()

      const itemKeyword =
        search.itemKeyword
          .trim()
          .toLowerCase()

      return transactions
        .filter((transaction) => {
          if (
            !search.includeCanceled &&
            transaction.canceled === 'Y'
          ) {
            return false
          }

          if (
            search.startDate &&
            transaction.date <
              search.startDate
          ) {
            return false
          }

          if (
            search.endDate &&
            transaction.date >
              search.endDate
          ) {
            return false
          }

          if (
            search.type &&
            transaction.type !==
              search.type
          ) {
            return false
          }

          if (clientKeyword) {
            const clientText =
              `${transaction.clientCode} ${transaction.clientName}`
                .toLowerCase()

            if (
              !clientText.includes(
                clientKeyword
              )
            ) {
              return false
            }
          }

          if (itemKeyword) {
            const itemText =
              `${transaction.itemCode} ${transaction.itemName}`
                .toLowerCase()

            if (
              !itemText.includes(
                itemKeyword
              )
            ) {
              return false
            }
          }

          return true
        })
        .sort((a, b) => {
          if (a.date !== b.date) {
            return b.date.localeCompare(
              a.date
            )
          }

          return (
            Number(b.transactionNo) -
            Number(a.transactionNo)
          )
        })
    }, [
      transactions,
      search
    ])

  const summary = useMemo(() => {
    return filteredTransactions.reduce(
      (acc, transaction) => {
        acc.supply +=
          Number(
            transaction.supplyAmount
          ) || 0

        acc.vat +=
          Number(
            transaction.vat
          ) || 0

        acc.total +=
          Number(
            transaction.totalAmount
          ) || 0

        return acc
      },
      {
        supply: 0,
        vat: 0,
        total: 0
      }
    )
  }, [filteredTransactions])

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredTransactions.length /
          PAGE_SIZE
      )
    )

  const currentPage =
    Math.min(page, totalPages)

  const pageTransactions =
    filteredTransactions.slice(
      (currentPage - 1) * PAGE_SIZE,
      currentPage * PAGE_SIZE
    )

  const cancelTransaction =
    async (transaction) => {
      setMessage('')

      try {
        const result =
          await window.inventoryApi
            .cancelTransaction(
              transaction.transactionNo,
              ''
            )

        if (result.stockWarning) {
          setMessage(
            `${transaction.transactionNo}번 거래를 취소했습니다. 현재재고가 ${result.currentStock}개로 음수입니다.`
          )
        } else {
          setMessage(
            `${transaction.transactionNo}번 거래를 취소했습니다.`
          )
        }

        loadTransactions()
      } catch (error) {
        console.error(error)

        setMessage(
          error.message ||
          '거래 취소에 실패했습니다.'
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
    <div className="transaction-list-page">
      <div className="page-header">
        <div>
          <h1>입출고 조회</h1>

          <p>
            등록된 입출고 내역을 조회하고 관리합니다.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={loadTransactions}
        >
          새로고침
        </button>
      </div>

      <div className="search-card">
        <div className="quick-date-buttons">
          <button
            type="button"
            onClick={() =>
              setQuickDate('today')
            }
          >
            오늘
          </button>

          <button
            type="button"
            onClick={() =>
              setQuickDate('week')
            }
          >
            이번 주
          </button>

          <button
            type="button"
            onClick={() =>
              setQuickDate('month')
            }
          >
            이번 달
          </button>

          <button
            type="button"
            onClick={() =>
              setQuickDate(
                'last-month'
              )
            }
          >
            지난달
          </button>

          <button
            type="button"
            onClick={() =>
              setQuickDate('all')
            }
          >
            전체
          </button>
        </div>

        <div className="transaction-search-grid">
          <div className="form-field">
            <label>시작일</label>

            <input
              type="date"
              name="startDate"
              value={search.startDate}
              onChange={changeSearch}
            />
          </div>

          <div className="form-field">
            <label>종료일</label>

            <input
              type="date"
              name="endDate"
              value={search.endDate}
              onChange={changeSearch}
            />
          </div>

          <div className="form-field">
            <label>구분</label>

            <select
              name="type"
              value={search.type}
              onChange={changeSearch}
            >
              <option value="">
                전체
              </option>

              <option value="입고">
                입고
              </option>

              <option value="출고">
                출고
              </option>

              <option value="출고반입">
                출고반입
              </option>
            </select>
          </div>

          <div className="form-field">
            <label>거래처</label>

            <input
              name="clientKeyword"
              value={
                search.clientKeyword
              }
              onChange={changeSearch}
              placeholder="코드 또는 거래처명"
            />
          </div>

          <div className="form-field">
            <label>품목</label>

            <input
              name="itemKeyword"
              value={
                search.itemKeyword
              }
              onChange={changeSearch}
              placeholder="코드 또는 품목명"
            />
          </div>

          <div className="search-option-field">
            <label>
              <input
                type="checkbox"
                name="includeCanceled"
                checked={
                  search.includeCanceled
                }
                onChange={changeSearch}
              />

              취소 내역 포함
            </label>
          </div>
        </div>

        <div className="search-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={resetSearch}
          >
            검색 초기화
          </button>
        </div>
      </div>

      {message && (
        <div className="list-message">
          {message}
        </div>
      )}

      <div className="transaction-summary">
        <div>
          <span>검색 결과</span>

          <strong>
            {
              filteredTransactions.length
            }건
          </strong>
        </div>

        <div>
          <span>공급가액</span>

          <strong>
            {formatNumber(
              summary.supply
            )}원
          </strong>
        </div>

        <div>
          <span>부가세</span>

          <strong>
            {formatNumber(
              summary.vat
            )}원
          </strong>
        </div>

        <div>
          <span>합계</span>

          <strong>
            {formatNumber(
              summary.total
            )}원
          </strong>
        </div>
      </div>

      <div className="transaction-table-wrapper">
        <table className="transaction-table">
          <thead>
            <tr>
              <th>번호</th>
              <th>일자</th>
              <th>구분</th>
              <th>거래처</th>
              <th>품목</th>
              <th>수량</th>
              <th>단가</th>
              <th>공급가</th>
              <th>부가세</th>
              <th>합계</th>
              <th>상태</th>
              <th>관리</th>
            </tr>
          </thead>

          <tbody>
            {pageTransactions.length ===
            0 ? (
              <tr>
                <td
                  colSpan="12"
                  className="empty-table-cell"
                >
                  조회된 입출고 내역이 없습니다.
                </td>
              </tr>
            ) : (
              pageTransactions.map(
                (transaction) => (
                  <tr
                    key={
                      transaction.transactionNo
                    }
                    className={
                      transaction.canceled ===
                      'Y'
                        ? 'canceled-row'
                        : ''
                    }
                  >
                    <td>
                      {
                        transaction.transactionNo
                      }
                    </td>

                    <td>
                      {transaction.date}
                    </td>

                    <td>
                      <span
                        className={`transaction-type-badge type-${transaction.type}`}
                      >
                        {transaction.type}
                      </span>
                    </td>

                    <td>
                      <div className="table-main-text">
                        {
                          transaction.clientName
                        }
                      </div>

                      <div className="table-sub-text">
                        {
                          transaction.clientCode
                        }
                      </div>
                    </td>

                    <td>
                      <div className="table-main-text">
                        {
                          transaction.itemName
                        }
                      </div>

                      <div className="table-sub-text">
                        {
                          transaction.itemCode
                        }
                      </div>
                    </td>

                    <td className="number-cell">
                      {formatNumber(
                        transaction.quantity
                      )}
                    </td>

                    <td className="number-cell">
                      {formatNumber(
                        transaction.unitPrice
                      )}
                    </td>

                    <td className="number-cell">
                      {formatNumber(
                        transaction.supplyAmount
                      )}
                    </td>

                    <td className="number-cell">
                      {formatNumber(
                        transaction.vat
                      )}
                    </td>

                    <td className="number-cell">
                      {formatNumber(
                        transaction.totalAmount
                      )}
                    </td>

                    <td>
                      {transaction.canceled ===
                      'Y' ? (
                        <span className="status-canceled">
                          취소
                        </span>
                      ) : (
                        <span className="status-normal">
                          정상
                        </span>
                      )}
                    </td>

                    <td>
                      {transaction.canceled ===
                      'Y' ? (
                        '-'
                      ) : (
                        <button
                          type="button"
                          className="cancel-button"
                          onClick={() =>
                            cancelTransaction(
                              transaction
                            )
                          }
                        >
                          취소
                        </button>
                      )}
                    </td>
                  </tr>
                )
              )
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button
          type="button"
          disabled={
            currentPage === 1
          }
          onClick={() =>
            setPage((prev) =>
              Math.max(
                1,
                prev - 1
              )
            )
          }
        >
          이전
        </button>

        <span>
          {currentPage} / {totalPages}
        </span>

        <button
          type="button"
          disabled={
            currentPage ===
            totalPages
          }
          onClick={() =>
            setPage((prev) =>
              Math.min(
                totalPages,
                prev + 1
              )
            )
          }
        >
          다음
        </button>
      </div>
    </div>
  )
}

export default TransactionList