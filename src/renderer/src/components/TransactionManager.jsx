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

  return (
    <div>
      <h1>입출고 등록</h1>

      <div>
        <label>
          일자
          <input
            type="date"
            name="date"
            value={form.date}
            onChange={changeForm}
          />
        </label>
      </div>

      <div>
        <label>
          구분
          <select
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
        </label>
      </div>

      <div>
        <label>
          거래처
          <select
            name="clientCode"
            value={form.clientCode}
            onChange={changeForm}
          >
            <option value="">
              거래처 선택
            </option>

            {clients.map((client) => (
              <option
                key={client.code}
                value={client.code}
              >
                {client.code} / {client.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <label>
          품목
          <select
            name="itemCode"
            value={form.itemCode}
            onChange={changeItem}
          >
            <option value="">
              품목 선택
            </option>

            {items.map((item) => (
              <option
                key={item.code}
                value={item.code}
              >
                {item.code} / {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedItem && (
        <div>
          <p>
            현재재고:
            {' '}
            {selectedItem.currentStock}
          </p>

          <p>
            매입단가:
            {' '}
            {selectedItem.purchasePrice}
          </p>

          <p>
            매출단가:
            {' '}
            {selectedItem.salesPrice}
          </p>
        </div>
      )}

      <div>
        <label>
          수량
          <input
            type="number"
            name="quantity"
            min="1"
            step="1"
            value={form.quantity}
            onChange={changeForm}
          />
        </label>
      </div>

      <div>
        <label>
          단가
          <input
            type="number"
            name="unitPrice"
            min="0"
            value={form.unitPrice}
            onChange={changeForm}
          />
        </label>
      </div>

      <div>
        <p>
          공급가액: {supplyAmount}
        </p>

        <p>
          부가세: {vat}
        </p>

        <p>
          합계: {totalAmount}
        </p>
      </div>

      <button
        type="button"
        onClick={submitTransaction}
      >
        등록
      </button>

      {message && <p>{message}</p>}

      {result && (
        <div>
          <p>
            거래번호:
            {' '}
            {result.transaction.transactionNo}
          </p>

          <p>
            이전재고:
            {' '}
            {result.previousStock}
          </p>

          <p>
            현재재고:
            {' '}
            {result.currentStock}
          </p>
        </div>
      )}
    </div>
  )
}

export default TransactionManager