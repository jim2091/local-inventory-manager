import ConfirmDialog from './common/ConfirmDialog'
import Toast from './common/Toast'
import useConfirmation from './common/useConfirmation'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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

const clientFields = [
  ['code', '코드'], ['category', '구분'], ['type', '유형'], ['name', '거래처명'],
  ['businessNumber', '사업자(주민)번호'], ['representative', '대표자명'],
  ['businessAddress', '사업장주소1'], ['businessType', '업태'], ['businessItem', '종목'],
  ['phone', '전화'], ['fax', '팩스'], ['mobile', '휴대폰'],
  ['homepage', '홈페이지주소'], ['actualAddress', '실제주소1']
]
const clientColumns = [
  ['code', '코드', 'client-code-column'], ['name', '거래처명', 'client-name-column'],
  ['representative', '대표자', 'client-representative-column'], ['contact', '연락처', 'client-contact-column'],
  ['classification', '구분/유형', 'client-classification-column'],
  ['businessNumber', '사업자(주민)번호', 'client-business-column'],
  ['businessAddress', '사업장 주소', 'client-address-column']
]
const listValue = (client, key) => {
  if (key === 'contact') return client.phone || client.mobile || '-'
  if (key === 'classification') return [client.category, client.type].filter(Boolean).join(' / ') || '-'
  return client[key] || '-'
}

function ClientManager() {
  const { confirmation, requestConfirmation, closeConfirmation } = useConfirmation()
  const [clientType, setClientType] =
    useState('sales')

  const [clients, setClients] =
    useState([])

  const [form, setForm] =
    useState(emptyForm)

  const [selectedCode, setSelectedCode] =
    useState('')

  const [mode, setMode] = useState(null)
  const [selectedClient, setSelectedClient] = useState(null)
  const [busy, setBusy] = useState(false)
  const pendingRef = useRef(false)
  const modalRef = useRef(null)
  const returnFocusRef = useRef(null)
  const createButtonRef = useRef(null)
  const loadSequenceRef = useRef(0)
  const firstInputRef = useRef(null)

  const [message, setMessage] =
    useState('')

  const [formError, setFormError] =
    useState('')

  const [successMessage, setSuccessMessage] =
    useState('')

  const clearSuccessMessage = useCallback(() => {
    setSuccessMessage('')
  }, [])

  const [keyword, setKeyword] =
    useState('')

  const loadClients = useCallback(() => {
    const sequence = ++loadSequenceRef.current
    return window.inventoryApi
      .getClients(clientType)
      .then((result) => {
        if (sequence !== loadSequenceRef.current) return
        setClients(result)
        setMessage('')
      })
      .catch((error) => {
        if (sequence !== loadSequenceRef.current) return
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
    setFormError('')
  }

  useEffect(() => {
    if (confirmation) return
    if (mode === 'detail') modalRef.current?.focus()
    else if (mode) firstInputRef.current?.focus()
  }, [mode, confirmation])

  const closeModal = () => {
    setMode(null)
    setFormError('')
    requestAnimationFrame(() => {
      const target = returnFocusRef.current
      if (target?.isConnected) target.focus()
      else createButtonRef.current?.focus()
    })
  }

  const openCreateForm = () => {
    returnFocusRef.current = document.activeElement
    resetForm()
    setSelectedClient(null)
    setMode('create')
  }

  const handleModalKeyDown = (event) => {
    if (confirmation || event.defaultPrevented) return
    if (event.key === 'Escape') {
      if (busy || pendingRef.current) return
      event.preventDefault()
      event.stopPropagation()
      closeModal()
      return
    }
    if (event.key === 'Enter' && (mode === 'create' || mode === 'edit')
      && event.target.matches('input:not([type=button]):not([type=submit]):not([type=reset]):not([type=image]):not([type=checkbox]):not([type=radio]), select')) {
      if (event.nativeEvent?.isComposing || event.nativeEvent?.keyCode === 229) return
      event.preventDefault()
      if (busy || pendingRef.current || event.repeat) return
      if (mode === 'create') addClient()
      else updateClient()
      return
    }
    if (event.key !== 'Tab') return
    const controls = [...modalRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')]
      .filter((element) => element.getClientRects().length && element.tabIndex >= 0
          && !element.matches(':disabled') && !element.closest('[hidden], [inert]')
          && !['hidden', 'collapse'].includes(getComputedStyle(element).visibility))
    const first = controls[0]
    const last = controls[controls.length - 1]
    if (!first) { event.preventDefault(); return }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === modalRef.current)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === modalRef.current)) {
      event.preventDefault()
      first.focus()
    }
  }

  const changeClientType = (type) => {
    if (pendingRef.current) return
    if (type !== clientType) {
      ++loadSequenceRef.current
      setClients([])
    }
    setClientType(type)
    setKeyword('')
    resetForm()
    setSelectedClient(null)
    setMode(null)
    setMessage('')
    clearSuccessMessage()
  }

  const addClient = async () => {
    if (pendingRef.current) return
    pendingRef.current = true
    setBusy(true)
    setFormError('')
    clearSuccessMessage()

    try {
      if (!form.code.trim() || !form.name.trim()) throw new Error('거래처 코드와 이름을 입력해 주세요.')
      await window.inventoryApi
        .addClient(
          clientType,
          form
        )

      setSuccessMessage(
        '거래처를 등록했습니다.'
      )
      setFormError('')

      resetForm()
      requestAnimationFrame(() => firstInputRef.current?.focus())
      loadClients()
    } catch (error) {
      console.error(error)

      setFormError(
        error.message ||
        '거래처 등록에 실패했습니다.'
      )
    } finally {
      pendingRef.current = false
      setBusy(false)
    }
  }

  const selectClient = (client, opening = true) => {
    if (opening) returnFocusRef.current = document.activeElement
    setSelectedClient(client)
    setMode('detail')
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

    setFormError('')
  }

  const updateClient = async () => {
    if (pendingRef.current) return
    pendingRef.current = true
    setBusy(true)
    setFormError('')
    clearSuccessMessage()

    try {
      if (!form.code.trim() || !form.name.trim()) throw new Error('거래처 코드와 이름을 입력해 주세요.')
      const result = await window.inventoryApi
        .updateClient(
          clientType,
          selectedCode,
          form
        )

      setSelectedClient(result.client)
      setMode('detail')
      setSelectedCode(result.client.code)
      setForm({
        code: result.client.code ?? '',
        category: result.client.category ?? '',
        type: result.client.type ?? '',
        name: result.client.name ?? '',
        businessNumber: result.client.businessNumber ?? '',
        representative: result.client.representative ?? '',
        businessAddress: result.client.businessAddress ?? '',
        businessType: result.client.businessType ?? '',
        businessItem: result.client.businessItem ?? '',
        phone: result.client.phone ?? '',
        fax: result.client.fax ?? '',
        mobile: result.client.mobile ?? '',
        homepage: result.client.homepage ?? '',
        actualAddress: result.client.actualAddress ?? ''
      })

      setSuccessMessage(
        '거래처를 수정했습니다.'
      )
      setFormError('')

      loadClients()
    } catch (error) {
      console.error(error)

      setFormError(
        error.message ||
        '거래처 수정에 실패했습니다.'
      )
    } finally {
      pendingRef.current = false
      setBusy(false)
    }
  }

  const deleteClient = async (code) => {
      if (pendingRef.current) return
      pendingRef.current = true
      setBusy(true)
      setFormError('')
      const target = clients.find((entry) => entry.code === code)
      const accepted = await requestConfirmation({ title: '거래처 삭제', confirmLabel: '삭제',
        message: `다음 거래처를 삭제하시겠습니까?\n\n코드: ${code}\n거래처명: ${target?.name ?? ''}\n\n삭제한 거래처는 자동으로 복구되지 않습니다.` })
      if (!accepted) {
        pendingRef.current = false
        setBusy(false)
        return
      }

    clearSuccessMessage()

    try {
      await window.inventoryApi
        .deleteClient(
          clientType,
          code
        )

      setSuccessMessage(
        '거래처를 삭제했습니다.'
      )

      resetForm()
      returnFocusRef.current = createButtonRef.current
      closeModal()

      loadClients()
    } catch (error) {
      console.error(error)

      setFormError(
        error.message ||
        '거래처 삭제에 실패했습니다.'
      )
    } finally {
      pendingRef.current = false
      setBusy(false)
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
    <div className={`client-page ${mode ? 'modal-open' : ''}`}>
      <Toast message={successMessage} onClose={clearSuccessMessage} />
      {confirmation && <ConfirmDialog options={confirmation} onClose={closeConfirmation} />}
      <div inert={Boolean(mode)}>
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
              ref={createButtonRef}
              onClick={openCreateForm}
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
                <tr>{clientColumns.map(([key, label, className]) => <th key={key} className={className}>{label}</th>)}</tr>
              </thead>
              <tbody>
                {filteredClients.length === 0 ? (
                  <tr><td colSpan={clientColumns.length} className="empty-table-cell">조회된 거래처가 없습니다.</td></tr>
                ) : filteredClients.map((client) => (
                  <tr key={client.code} tabIndex={0} aria-label={`${client.code} ${client.name} 상세 보기`}
                    onClick={(event) => { event.currentTarget.focus(); selectClient(client) }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        selectClient(client)
                      }
                    }}>
                    {clientColumns.map(([key, , className]) => (
                      <td key={key} className={`${className} ${key === 'code' ? 'client-code-cell' : ''}`}
                        title={String(listValue(client, key))}>{listValue(client, key)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {mode && (
        <div className="client-modal-overlay">
          <div ref={modalRef} className="client-modal" role="dialog" aria-modal="true"
            aria-labelledby="client-modal-title" tabIndex={-1} onKeyDown={handleModalKeyDown}
            inert={Boolean(confirmation)} aria-busy={busy}>
            <div className="client-form-header">
              <div>
                <h2 id="client-modal-title">{mode === 'create' ? '새 거래처 등록' : mode === 'edit' ? '거래처 수정' : '거래처 상세'}</h2>
                <p>{mode === 'create' ? `${currentTitle} 등록 후 계속해서 다음 거래처를 입력할 수 있습니다.` : `${currentTitle} · ${selectedCode}`}</p>
              </div>
              <button type="button" className="secondary-button" aria-label="거래처 창 닫기" disabled={busy} onClick={closeModal}>×</button>
            </div>
            {mode === 'detail' ? (
              <dl className="client-detail-grid">
                {clientFields.map(([key, label]) => (
                  <div key={key} className={['name', 'businessAddress', 'actualAddress', 'homepage'].includes(key) ? 'client-form-full' : ''}>
                    <dt>{label}</dt><dd>{selectedClient[key] || '-'}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <fieldset className="client-modal-fields" disabled={busy}>
          <div className="client-form-grid">
            <div className="form-field">
              <label>
                거래처 코드
                <span className="required-mark">*</span>
              </label>

              <input
                ref={firstInputRef}
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

              </fieldset>
            )}
            {formError && <div className="form-error-message" role="alert">{formError}</div>}
            <div className="client-form-actions">
              {mode === 'detail' && <button type="button" className="table-delete-button" disabled={busy} onClick={() => deleteClient(selectedCode)}>삭제</button>}
              <div className="client-modal-primary-actions">
                <button type="button" className="secondary-button" disabled={busy}
                  onClick={() => mode === 'edit' ? selectClient(selectedClient, false) : closeModal()}>{mode === 'edit' ? '취소' : '닫기'}</button>
                <button type="button" className="client-save-button" disabled={busy}
                  onClick={() => {
                    if (mode === 'detail') { setFormError(''); setMode('edit') }
                    else if (mode === 'create') addClient()
                    else updateClient()
                  }}>{mode === 'detail' ? '수정' : mode === 'create' ? '등록' : '저장'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ClientManager
