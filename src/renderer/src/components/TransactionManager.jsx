import { useEffect, useState } from 'react'

function getToday() {
  const now = new Date()

  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

const emptyForm = {
  date: getToday(),
  type: '출고',
  clientCode: '',
  itemCode: '',
  quantity: '',
  unitPrice: ''
}

function TransactionManager() {
  const [form, setForm] = useState(emptyForm)

  const [items, setItems] = useState([])
  const [clients, setClients] = useState([])

  const [clientSearch, setClientSearch] = useState('')
  const [itemSearch, setItemSearch] = useState('')
  const [showClientResults, setShowClientResults] = useState(false)
  const [showItemResults, setShowItemResults] = useState(false)

  const [message, setMessage] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => {
    window.inventoryApi
      .getItems()
      .then(setItems)
      .catch((error) => {
        console.error(error)
        setMessage('품목 목록을 불러오지 못했습니다.')
      })
  }, [])

  useEffect(() => {
    const clientType =
      form.type === '입고'
        ? 'purchase'
        : 'sales'

    window.inventoryApi
      .getClients(clientType)
      .then((data) => {
        setClients(data)

        setForm((prev) => ({
          ...prev,
          clientCode: ''
        }))
      })
      .catch((error) => {
        console.error(error)
        setMessage('거래처 목록을 불러오지 못했습니다.')
      })
  }, [form.type])

  const changeForm = (e) => {
    const { name, value } = e.target

    setForm((prev) => ({
      ...prev,
      [name]: value
    }))
  }

  const changeItem = (e) => {
    const itemCode = e.target.value

    const item = items.find(
      (item) => item.code === itemCode
    )

    let defaultPrice = ''

    if (item) {
      if (form.type === '입고') {
        defaultPrice = item.purchasePrice ?? ''
      } else {
        defaultPrice = item.salesPrice ?? ''
      }
    }

    setForm((prev) => ({
      ...prev,
      itemCode,
      unitPrice: defaultPrice
    }))
  }

  const changeTransactionType = (e) => {
    const type = e.target.value

    setClientSearch('')
    setShowClientResults(false)

    setForm((prev) => {
      const item = items.find(
        (item) => item.code === prev.itemCode
      )

      let unitPrice = ''

      if (item) {
        unitPrice =
          type === '입고'
            ? item.purchasePrice ?? ''
            : item.salesPrice ?? ''
      }

      return {
        ...prev,
        type,
        clientCode: '',
        unitPrice
      }
    })
  }

  const submitTransaction = async () => {
    setMessage('')
    setResult(null)

    try {
      const response =
        await window.inventoryApi.addTransaction({
          date: form.date,
          type: form.type,
          clientCode: form.clientCode,
          itemCode: form.itemCode,
          quantity: Number(form.quantity),
          unitPrice: Number(form.unitPrice)
        })

      setResult(response)

      if (response.stockWarning) {
        setMessage(
          `등록되었습니다. 주의: 현재재고가 ${response.currentStock}개로 음수가 되었습니다.`
        )
      } else {
        setMessage('입출고 내역을 등록했습니다.')
      }

      setForm((prev) => ({
        ...prev,
        clientCode: '',
        itemCode: '',
        quantity: '',
        unitPrice: ''
      }))

      setClientSearch('')
      setItemSearch('')
      setShowClientResults(false)
      setShowItemResults(false)

      const updatedItems =
        await window.inventoryApi.getItems()

      setItems(updatedItems)
    } catch (error) {
      console.error(error)

      setMessage(
        error.message ||
        '입출고 등록에 실패했습니다.'
      )
    }
  }

  const filteredClients = clients
    .filter((client) => {
      const keyword =
        clientSearch.trim().toLowerCase()

      if (!keyword) {
        return true
      }

      const text =
        `${client.code} ${client.name}`.toLowerCase()

      return text.includes(keyword)
    })
    .slice(0, 10)

  const filteredItems = items
    .filter((item) => {
      const keyword =
        itemSearch.trim().toLowerCase()

      if (!keyword) {
        return true
      }

      const text =
        `${item.code} ${item.name}`.toLowerCase()

      return text.includes(keyword)
    })
    .slice(0, 10)

  const selectClient = (client) => {
    setForm((prev) => ({
      ...prev,
      clientCode: client.code
    }))

    setClientSearch(
      `${client.code} / ${client.name}`
    )

    setShowClientResults(false)
  }

  const selectItem = (item) => {
    const defaultPrice =
      form.type === '입고'
        ? item.purchasePrice ?? ''
        : item.salesPrice ?? ''

    setForm((prev) => ({
      ...prev,
      itemCode: item.code,
      unitPrice: defaultPrice
    }))

    setItemSearch(
      `${item.code} / ${item.name}`
    )

    setShowItemResults(false)
  }

  const selectedItem = items.find(
    (item) => item.code === form.itemCode
  )

  const supplyAmount =
    form.quantity !== '' &&
      form.unitPrice !== ''
      ? Number(form.quantity) *
      Number(form.unitPrice)
      : 0

  const vat =
    Math.round(supplyAmount * 0.1)

  const totalAmount =
    supplyAmount + vat

  const formatNumber = (value) => {
    const number = Number(value)

    if (!Number.isFinite(number)) {
      return '0'
    }

    return number.toLocaleString()
  }

  return (
    <div className="transaction-page">
      <div className="page-header">
        <div>
          <h1>입출고 등록</h1>

          <p>
            입고, 출고, 출고반입 내역을 등록합니다.
          </p>
        </div>
      </div>

      <div className="transaction-layout">
        <div className="transaction-form-card">
          <div className="form-section-title">
            거래 정보
          </div>

          <div className="transaction-form-grid">
            <div className="form-field">
              <label htmlFor="transaction-date">
                일자
              </label>

              <input
                id="transaction-date"
                type="date"
                name="date"
                value={form.date}
                onChange={changeForm}
              />
            </div>

            <div className="form-field">
              <label htmlFor="transaction-type">
                구분
              </label>

              <select
                id="transaction-type"
                name="type"
                value={form.type}
                onChange={changeTransactionType}
              >
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

            <div className="form-field form-field-wide">
              <label htmlFor="transaction-client">
                거래처
              </label>

              <div className="search-select">
                <input
                  id="transaction-client"
                  type="text"
                  value={clientSearch}
                  placeholder="거래처 코드 또는 이름 검색"
                  autoComplete="off"
                  onFocus={() =>
                    setShowClientResults(true)
                  }
                  onChange={(e) => {
                    setClientSearch(e.target.value)

                    setForm((prev) => ({
                      ...prev,
                      clientCode: ''
                    }))

                    setShowClientResults(true)
                  }}
                />

                {showClientResults && (
                  <div className="search-result-list">
                    {filteredClients.length > 0 ? (
                      filteredClients.map((client) => (
                        <button
                          key={client.code}
                          type="button"
                          className="search-result-item"
                          onClick={() =>
                            selectClient(client)
                          }
                        >
                          <span className="search-result-code">
                            {client.code}
                          </span>

                          <span>
                            {client.name}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="search-result-empty">
                        검색 결과가 없습니다.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="form-field form-field-wide">
              <label htmlFor="transaction-item">
                품목
              </label>

              <div className="search-select">
                <input
                  id="transaction-item"
                  type="text"
                  value={itemSearch}
                  placeholder="품목 코드 또는 품목명 검색"
                  autoComplete="off"
                  onFocus={() =>
                    setShowItemResults(true)
                  }
                  onChange={(e) => {
                    setItemSearch(e.target.value)

                    setForm((prev) => ({
                      ...prev,
                      itemCode: '',
                      unitPrice: ''
                    }))

                    setShowItemResults(true)
                  }}
                />

                {showItemResults && (
                  <div className="search-result-list">
                    {filteredItems.length > 0 ? (
                      filteredItems.map((item) => (
                        <button
                          key={item.code}
                          type="button"
                          className="search-result-item"
                          onClick={() =>
                            selectItem(item)
                          }
                        >
                          <span className="search-result-code">
                            {item.code}
                          </span>

                          <span className="search-result-name">
                            {item.name}
                          </span>

                          <span className="search-result-stock">
                            재고 {formatNumber(item.currentStock)}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="search-result-empty">
                        검색 결과가 없습니다.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {selectedItem && (
            <div className="selected-item-card">
              <div>
                <span>현재재고</span>
                <strong>
                  {formatNumber(
                    selectedItem.currentStock
                  )}
                </strong>
              </div>

              <div>
                <span>매입단가</span>
                <strong>
                  {formatNumber(
                    selectedItem.purchasePrice
                  )}원
                </strong>
              </div>

              <div>
                <span>매출단가</span>
                <strong>
                  {formatNumber(
                    selectedItem.salesPrice
                  )}원
                </strong>
              </div>
            </div>
          )}

          <div className="form-section-title transaction-amount-title">
            수량 및 단가
          </div>

          <div className="transaction-form-grid">
            <div className="form-field">
              <label htmlFor="transaction-quantity">
                수량
              </label>

              <input
                id="transaction-quantity"
                type="number"
                name="quantity"
                min="1"
                step="1"
                value={form.quantity}
                onChange={changeForm}
                placeholder="수량 입력"
              />
            </div>

            <div className="form-field">
              <label htmlFor="transaction-unit-price">
                단가
              </label>

              <input
                id="transaction-unit-price"
                type="number"
                name="unitPrice"
                min="0"
                value={form.unitPrice}
                onChange={changeForm}
                placeholder="단가 입력"
              />
            </div>
          </div>
        </div>

        <div className="transaction-summary-card">
          <div className="form-section-title">
            금액 확인
          </div>

          <div className="amount-row">
            <span>공급가액</span>

            <strong>
              {formatNumber(supplyAmount)}원
            </strong>
          </div>

          <div className="amount-row">
            <span>부가세</span>

            <strong>
              {formatNumber(vat)}원
            </strong>
          </div>

          <div className="amount-row amount-total">
            <span>합계</span>

            <strong>
              {formatNumber(totalAmount)}원
            </strong>
          </div>

          <button
            type="button"
            className="transaction-submit-button"
            onClick={submitTransaction}
          >
            등록하기
          </button>

          {message && (
            <div
              className={
                result?.stockWarning
                  ? 'transaction-message warning'
                  : result
                    ? 'transaction-message success'
                    : 'transaction-message error'
              }
            >
              {message}
            </div>
          )}

          {result && (
            <div className="transaction-result">
              <div>
                <span>거래번호</span>
                <strong>
                  {result.transaction.transactionNo}
                </strong>
              </div>

              <div>
                <span>이전재고</span>
                <strong>
                  {formatNumber(
                    result.previousStock
                  )}
                </strong>
              </div>

              <div>
                <span>현재재고</span>
                <strong>
                  {formatNumber(
                    result.currentStock
                  )}
                </strong>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TransactionManager