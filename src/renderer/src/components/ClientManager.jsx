import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react'

const emptyForm = {
  code: '',
  category: '',
  type: '',
  name: '',
  businessNumber: '',
  representative: '',
  businessAddress: '',
  businessType: '',
  businessItem: '',
  phone: '',
  fax: '',
  mobile: '',
  homepage: '',
  actualAddress: ''
}

function ClientManager() {
  const [clientType, setClientType] =
    useState('sales')

  const [clients, setClients] =
    useState([])

  const [form, setForm] =
    useState(emptyForm)

  const [selectedCode, setSelectedCode] =
    useState('')

  const [message, setMessage] =
    useState('')

  const [keyword, setKeyword] =
    useState('')

  const loadClients = useCallback(() => {
    window.inventoryApi
      .getClients(clientType)
      .then(setClients)
      .catch((error) => {
        console.error(error)

        setMessage(
          '거래처 목록을 불러오지 못했습니다.'
        )
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
    setMessage('')
  }

  const changeClientType = (type) => {
    setClientType(type)
    setKeyword('')
    resetForm()
  }

  const addClient = async () => {
    setMessage('')

    try {
      await window.inventoryApi
        .addClient(
          clientType,
          form
        )

      setMessage(
        '거래처를 등록했습니다.'
      )

      resetForm()
      loadClients()
    } catch (error) {
      console.error(error)

      setMessage(
        error.message ||
        '거래처 등록에 실패했습니다.'
      )
    }
  }

  const selectClient = (client) => {
    setSelectedCode(client.code)

    setForm({
      code: client.code ?? '',
      category: client.category ?? '',
      type: client.type ?? '',
      name: client.name ?? '',
      businessNumber: client.businessNumber ?? '',
      representative: client.representative ?? '',
      businessAddress: client.businessAddress ?? '',
      businessType: client.businessType ?? '',
      businessItem: client.businessItem ?? '',
      phone: client.phone ?? '',
      fax: client.fax ?? '',
      mobile: client.mobile ?? '',
      homepage: client.homepage ?? '',
      actualAddress: client.actualAddress ?? ''
    })

    setMessage('')
  }

  const updateClient = async () => {
    setMessage('')

    try {
      await window.inventoryApi
        .updateClient(
          clientType,
          selectedCode,
          form
        )

      setMessage(
        '거래처를 수정했습니다.'
      )

      resetForm()
      loadClients()
    } catch (error) {
      console.error(error)

      setMessage(
        error.message ||
        '거래처 수정에 실패했습니다.'
      )
    }
  }

  const deleteClient = async (code) => {
    setMessage('')

    try {
      await window.inventoryApi
        .deleteClient(
          clientType,
          code
        )

      setMessage(
        '거래처를 삭제했습니다.'
      )

      if (selectedCode === code) {
        resetForm()
      }

      loadClients()
    } catch (error) {
      console.error(error)

      setMessage(
        error.message ||
        '거래처 삭제에 실패했습니다.'
      )
    }
  }

  const filteredClients =
    useMemo(() => {
      const searchKeyword =
        keyword
          .trim()
          .toLowerCase()

      if (!searchKeyword) {
        return clients
      }

      return clients.filter(
        (client) => {
          const text = [
            client.code,
            client.name,
            client.representative,
            client.businessNumber,
            client.phone,
            client.mobile
          ]
            .join(' ')
            .toLowerCase()

          return text.includes(
            searchKeyword
          )
        }
      )
    }, [
      clients,
      keyword
    ])

  const currentTitle =
    clientType === 'sales'
      ? '매출거래처'
      : '매입거래처'

  return (
    <div className="client-page">
      <div className="page-header">
        <div>
          <h1>거래처 관리</h1>

          <p>
            매출 및 매입 거래처를 조회하고 관리합니다.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={loadClients}
        >
          새로고침
        </button>
      </div>

      <div className="client-type-tabs">
        <button
          type="button"
          className={
            clientType === 'sales'
              ? 'client-tab active'
              : 'client-tab'
          }
          onClick={() =>
            changeClientType('sales')
          }
        >
          매출거래처
        </button>

        <button
          type="button"
          className={
            clientType === 'purchase'
              ? 'client-tab active'
              : 'client-tab'
          }
          onClick={() =>
            changeClientType(
              'purchase'
            )
          }
        >
          매입거래처
        </button>
      </div>

      {message && (
        <div className="client-message">
          {message}
        </div>
      )}

      <div className="client-layout">
        <div className="client-list-card">
          <div className="client-list-header">
            <div>
              <h2>
                {currentTitle}
              </h2>

              <p>
                전체 {clients.length}개 /
                검색 결과 {filteredClients.length}개
              </p>
            </div>

            <button
              type="button"
              className="primary-small-button"
              onClick={resetForm}
            >
              새 거래처 등록
            </button>
          </div>

          <div className="client-search-box">
            <input
              type="text"
              value={keyword}
              onChange={(e) =>
                setKeyword(
                  e.target.value
                )
              }
              placeholder="코드, 거래처명, 대표자, 전화번호 검색"
            />
          </div>

          <div className="client-table-wrapper">
            <table className="client-table">
              <thead>
                <tr>
                  <th>코드</th>
                  <th>거래처명</th>
                  <th>대표자</th>
                  <th>전화</th>
                  <th>사업자번호</th>
                  <th>관리</th>
                </tr>
              </thead>

              <tbody>
                {filteredClients.length === 0 ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="empty-table-cell"
                    >
                      조회된 거래처가 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredClients.map(
                    (client, index) => (
                      <tr
                        key={`${client.code}-${index}`}
                        className={
                          selectedCode === client.code
                            ? 'selected-client-row'
                            : ''
                        }
                        onClick={() =>
                          selectClient(client)
                        }
                      >
                        <td className="client-code-cell">
                          {client.code}
                        </td>

                        <td className="client-name-cell">
                          {client.name}
                        </td>

                        <td>
                          {client.representative || '-'}
                        </td>

                        <td>
                          {client.phone || client.mobile || '-'}
                        </td>

                        <td>
                          {client.businessNumber || '-'}
                        </td>

                        <td>
                          <div className="client-action-buttons">
                            <button
                              type="button"
                              className="table-edit-button"
                              onClick={(e) => {
                                e.stopPropagation()
                                selectClient(client)
                              }}
                            >
                              수정
                            </button>

                            <button
                              type="button"
                              className="table-delete-button"
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteClient(client.code)
                              }}
                            >
                              삭제
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="client-form-card">
          <div className="client-form-header">
            <h2>
              {selectedCode
                ? '거래처 수정'
                : '새 거래처 등록'}
            </h2>

            <p>
              {selectedCode
                ? `${selectedCode} 거래처를 수정합니다.`
                : `${currentTitle}를 새로 등록합니다.`}
            </p>
          </div>

          <div className="client-form-grid">
            <div className="form-field">
              <label>
                거래처 코드
                <span className="required-mark">*</span>
              </label>

              <input
                name="code"
                value={form.code}
                onChange={changeForm}
                placeholder="거래처 코드"
              />
            </div>

            <div className="form-field">
              <label>
                거래처명
                <span className="required-mark">*</span>
              </label>

              <input
                name="name"
                value={form.name}
                onChange={changeForm}
                placeholder="거래처명"
              />
            </div>

            <div className="client-form-section-title">
              기본 정보
            </div>

            <div className="form-field">
              <label>구분</label>

              <input
                name="category"
                value={form.category}
                onChange={changeForm}
                placeholder="구분"
              />
            </div>

            <div className="form-field">
              <label>유형</label>

              <input
                name="type"
                value={form.type}
                onChange={changeForm}
                placeholder="유형"
              />
            </div>

            <div className="form-field">
              <label>사업자(주민)번호</label>

              <input
                name="businessNumber"
                value={form.businessNumber}
                onChange={changeForm}
                placeholder="사업자번호"
              />
            </div>

            <div className="form-field">
              <label>대표자명</label>

              <input
                name="representative"
                value={form.representative}
                onChange={changeForm}
                placeholder="대표자명"
              />
            </div>

            <div className="client-form-section-title">
              사업장 정보
            </div>

            <div className="form-field client-form-full">
              <label>사업장주소</label>

              <input
                name="businessAddress"
                value={form.businessAddress}
                onChange={changeForm}
                placeholder="사업장주소"
              />
            </div>

            <div className="form-field">
              <label>업태</label>

              <input
                name="businessType"
                value={form.businessType}
                onChange={changeForm}
                placeholder="업태"
              />
            </div>

            <div className="form-field">
              <label>종목</label>

              <input
                name="businessItem"
                value={form.businessItem}
                onChange={changeForm}
                placeholder="종목"
              />
            </div>

            <div className="client-form-section-title">
              연락처
            </div>

            <div className="form-field">
              <label>전화</label>

              <input
                name="phone"
                value={form.phone}
                onChange={changeForm}
                placeholder="전화번호"
              />
            </div>

            <div className="form-field">
              <label>팩스</label>

              <input
                name="fax"
                value={form.fax}
                onChange={changeForm}
                placeholder="팩스번호"
              />
            </div>

            <div className="form-field">
              <label>휴대폰</label>

              <input
                name="mobile"
                value={form.mobile}
                onChange={changeForm}
                placeholder="휴대폰"
              />
            </div>

            <div className="form-field">
              <label>홈페이지</label>

              <input
                name="homepage"
                value={form.homepage}
                onChange={changeForm}
                placeholder="홈페이지 주소"
              />
            </div>

            <div className="client-form-section-title">
              기타
            </div>

            <div className="form-field client-form-full">
              <label>실제주소</label>

              <input
                name="actualAddress"
                value={form.actualAddress}
                onChange={changeForm}
                placeholder="실제주소"
              />
            </div>
          </div>

          <div className="client-form-info">
            <strong>
              현재 구분
            </strong>

            <span>
              {currentTitle}
            </span>
          </div>

          <div className="client-form-actions">
            {selectedCode ? (
              <>
                <button
                  type="button"
                  className="client-save-button"
                  onClick={updateClient}
                >
                  수정 저장
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={resetForm}
                >
                  수정 취소
                </button>
              </>
            ) : (
              <button
                type="button"
                className="client-save-button"
                onClick={addClient}
              >
                거래처 등록
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ClientManager