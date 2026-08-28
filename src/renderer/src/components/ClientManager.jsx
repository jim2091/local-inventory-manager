import { useCallback, useEffect, useState } from 'react'

const emptyForm = {
  code: '',
  name: ''
}

function ClientManager() {
  const [clientType, setClientType] = useState('sales')
  const [clients, setClients] = useState([])

  const [form, setForm] = useState(emptyForm)
  const [selectedCode, setSelectedCode] = useState('')
  const [message, setMessage] = useState('')

  const loadClients = useCallback(() => {
    window.inventoryApi
      .getClients(clientType)
      .then(setClients)
      .catch((error) => {
        console.error(error)
        setMessage('거래처 목록을 불러오지 못했습니다.')
      })
  }, [clientType])

  useEffect(() => {
    loadClients()
  }, [loadClients])

  const changeForm = (e) => {
    const { name, value } = e.target

    setForm((prev) => ({
      ...prev,
      [name]: value
    }))
  }

  const resetForm = () => {
    setForm(emptyForm)
    setSelectedCode('')
  }

  const changeClientType = (type) => {
    setClientType(type)
    resetForm()
    setMessage('')
  }

  const addClient = async () => {
    setMessage('')

    try {
      await window.inventoryApi.addClient(
        clientType,
        form
      )

      setMessage('거래처를 등록했습니다.')
      resetForm()
      loadClients()
    } catch (error) {
      console.error(error)
      setMessage(
        error.message || '거래처 등록에 실패했습니다.'
      )
    }
  }

  const selectClient = (client) => {
    setSelectedCode(client.code)

    setForm({
      code: client.code ?? '',
      name: client.name ?? ''
    })

    setMessage('')
  }

  const updateClient = async () => {
    setMessage('')

    try {
      await window.inventoryApi.updateClient(
        clientType,
        selectedCode,
        form
      )

      setMessage('거래처를 수정했습니다.')
      resetForm()
      loadClients()
    } catch (error) {
      console.error(error)
      setMessage(
        error.message || '거래처 수정에 실패했습니다.'
      )
    }
  }

  const deleteClient = async (code) => {
    setMessage('')

    try {
      await window.inventoryApi.deleteClient(
        clientType,
        code
      )

      setMessage('거래처를 삭제했습니다.')

      if (selectedCode === code) {
        resetForm()
      }

      loadClients()
    } catch (error) {
      console.error(error)
      setMessage(
        error.message || '거래처 삭제에 실패했습니다.'
      )
    }
  }

  return (
    <div>
      <h1>거래처 관리</h1>

      <div>
        <button
          type="button"
          onClick={() => changeClientType('sales')}
        >
          매출거래처
        </button>

        <button
          type="button"
          onClick={() => changeClientType('purchase')}
        >
          매입거래처
        </button>
      </div>

      <h2>
        {clientType === 'sales'
          ? '매출거래처'
          : '매입거래처'}
      </h2>

      <div>
        <h3>
          {selectedCode
            ? '거래처 수정'
            : '거래처 등록'}
        </h3>

        <input
          name="code"
          value={form.code}
          onChange={changeForm}
          placeholder="거래처 코드"
        />

        <input
          name="name"
          value={form.name}
          onChange={changeForm}
          placeholder="거래처명"
        />

        {selectedCode ? (
          <>
            <button
              type="button"
              onClick={updateClient}
            >
              거래처 수정
            </button>

            <button
              type="button"
              onClick={resetForm}
            >
              수정 취소
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={addClient}
          >
            거래처 등록
          </button>
        )}

        {message && <p>{message}</p>}
      </div>

      <hr />

      <p>총 {clients.length}개</p>

      <table>
        <thead>
          <tr>
            <th>코드</th>
            <th>거래처명</th>
            <th>관리</th>
          </tr>
        </thead>

        <tbody>
          {clients.map((client, index) => (
            <tr key={`${client.code}-${index}`}>
              <td>{client.code}</td>
              <td>{client.name}</td>

              <td>
                <button
                  type="button"
                  onClick={() => selectClient(client)}
                >
                  수정
                </button>

                <button
                  type="button"
                  onClick={() =>
                    deleteClient(client.code)
                  }
                >
                  삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default ClientManager