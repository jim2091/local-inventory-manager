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
    type: '',
    code: '',
    name: '',
    initialPrice: '',
    purchasePrice: '',
    salesPrice: '',
    initialStock: '',
    currentStock: '',
    unit: '',
    spec: '',
    brand: ''
}

const fields = [
    ['type', '구분'], ['code', '코드'], ['name', '품목명'],
    ['initialPrice', '기초재고단가'], ['purchasePrice', '매입단가'],
    ['salesPrice', '매출단가'], ['initialStock', '기초재고량'],
    ['currentStock', '현재재고량'], ['unit', '단위'], ['spec', '규격'], ['brand', '브랜드명']
]
const columns = [
    ['code', '코드', 'item-code-column'], ['name', '품목명', 'item-name-column'],
    ['type', '구분', 'item-type-column'], ['currentStock', '현재재고', 'item-stock-column'],
    ['purchasePrice', '매입단가', 'item-price-column'], ['salesPrice', '매출단가', 'item-price-column'],
    ['spec', '규격', 'item-spec-column'], ['unit', '단위', 'item-unit-column'],
    ['brand', '브랜드', 'item-brand-column']
]

function ItemManager() {
  const { confirmation, requestConfirmation, closeConfirmation } = useConfirmation()
    const [items, setItems] =
        useState([])

    const [form, setForm] =
        useState(emptyForm)

    const [message, setMessage] =
        useState('')

    const [formError, setFormError] =
        useState('')

    const [successMessage, setSuccessMessage] =
        useState('')

    const clearSuccessMessage = useCallback(() => {
        setSuccessMessage('')
    }, [])

    const [selectedCode, setSelectedCode] =
        useState('')

    const [mode, setMode] = useState(null)
    const [selectedItem, setSelectedItem] = useState(null)
    const [busy, setBusy] = useState(false)
    const pendingRef = useRef(false)
    const modalRef = useRef(null)
    const returnFocusRef = useRef(null)
    const firstInputRef = useRef(null)

    const [keyword, setKeyword] =
        useState('')

    const loadItems = useCallback(() => {
        window.inventoryApi
            .getItems()
            .then((result) => { setItems(result); setMessage('') })
            .catch((error) => {
                console.error(error)

                setMessage(
                    '품목 목록을 불러오지 못했습니다.'
                )
            })
    }, [])

    useEffect(() => {
        loadItems()
    }, [loadItems])

    const changeForm = (e) => {
        const {
            name,
            value
        } = e.target

        // 새 품목 등록 중 기초재고를 입력하면
        // 현재재고도 같은 값으로 표시
        if (
            name === 'initialStock' &&
            !selectedCode
        ) {
            setForm((prev) => ({
                ...prev,
                initialStock: value,
                currentStock: value
            }))

            return
        }

        setForm((prev) => ({
            ...prev,
            [name]: value
        }))
    }

    const buildRequestData = () => ({
        ...form,

        initialPrice:
            form.initialPrice === ''
                ? ''
                : Number(form.initialPrice),

        purchasePrice:
            form.purchasePrice === ''
                ? ''
                : Number(form.purchasePrice),

        salesPrice:
            form.salesPrice === ''
                ? ''
                : Number(form.salesPrice),

        initialStock:
            form.initialStock === ''
                ? ''
                : Number(form.initialStock),

        currentStock:
            form.currentStock === ''
                ? ''
                : Number(form.currentStock)
    })

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
        setShowTypeResults(false)
        requestAnimationFrame(() => returnFocusRef.current?.focus())
    }

    const openCreateForm = () => {
        returnFocusRef.current = document.activeElement
        resetForm()
        setSelectedItem(null)
        setShowTypeResults(false)
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
          if (mode === 'create') addItem()
          else updateItem()
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

    const addItem = async () => {
        if (pendingRef.current) return
        pendingRef.current = true
        setBusy(true)
        setFormError('')
        clearSuccessMessage()

        try {
            for (const [field, label] of [['initialPrice', '기초재고단가'], ['purchasePrice', '매입단가'], ['salesPrice', '매출단가']]) {
              if (form[field] !== '' && (!Number.isFinite(Number(form[field])) || Number(form[field]) < 0)) throw new Error(`${label}는 0 이상의 숫자로 입력해 주세요.`)
            }
            if (!form.code.trim() || !form.name.trim()) throw new Error('품목 코드와 이름을 입력해 주세요.')
            if (!selectedCode && (!Number.isSafeInteger(Number(form.initialStock || 0)) || Number(form.initialStock) < 0)) throw new Error('기초재고량은 0 이상의 정수로 입력해 주세요.')
            await window.inventoryApi
                .addItem(
                    buildRequestData()
                )

            setSuccessMessage(
                '품목을 등록했습니다.'
            )
            setFormError('')

            resetForm()
            setShowTypeResults(false)
            requestAnimationFrame(() => firstInputRef.current?.focus())
            loadItems()
        } catch (error) {
            console.error(error)

            setFormError(
                error.message ||
                '품목 등록에 실패했습니다.'
            )
        } finally {
            pendingRef.current = false
            setBusy(false)
        }
    }

    const selectItem = (item, opening = true) => {
        if (opening) returnFocusRef.current = document.activeElement
        setSelectedItem(item)
        setMode('detail')
        setShowTypeResults(false)
        setSelectedCode(item.code)

        setForm({
            type:
                item.type ?? '',

            code:
                item.code ?? '',

            name:
                item.name ?? '',

            initialPrice:
                item.initialPrice ?? '',

            purchasePrice:
                item.purchasePrice ?? '',

            salesPrice:
                item.salesPrice ?? '',

            initialStock:
                item.initialStock ?? '',

            currentStock:
                item.currentStock ?? '',

            unit:
                item.unit ?? '',

            spec:
                item.spec ?? '',

            brand:
                item.brand ?? ''
        })

        setFormError('')
    }

    const updateItem = async () => {
        if (pendingRef.current) return
        pendingRef.current = true
        setBusy(true)
        setFormError('')
        clearSuccessMessage()

        try {
            for (const [field, label] of [['initialPrice', '기초재고단가'], ['purchasePrice', '매입단가'], ['salesPrice', '매출단가']]) {
              if (form[field] !== '' && (!Number.isFinite(Number(form[field])) || Number(form[field]) < 0)) throw new Error(`${label}는 0 이상의 숫자로 입력해 주세요.`)
            }
            if (!form.code.trim() || !form.name.trim()) throw new Error('품목 코드와 이름을 입력해 주세요.')
            if (!selectedCode && (!Number.isSafeInteger(Number(form.initialStock || 0)) || Number(form.initialStock) < 0)) throw new Error('기초재고량은 0 이상의 정수로 입력해 주세요.')
            const result = await window.inventoryApi
                .updateItem(
                    selectedCode,
                    buildRequestData()
                )

            setSelectedItem(result.item)
            setMode('detail')
            setShowTypeResults(false)
            setSelectedCode(result.item.code)
            setForm({
                type: result.item.type ?? '',
                code: result.item.code ?? '',
                name: result.item.name ?? '',
                initialPrice: result.item.initialPrice ?? '',
                purchasePrice: result.item.purchasePrice ?? '',
                salesPrice: result.item.salesPrice ?? '',
                initialStock: result.item.initialStock ?? '',
                currentStock: result.item.currentStock ?? '',
                unit: result.item.unit ?? '',
                spec: result.item.spec ?? '',
                brand: result.item.brand ?? ''
            })

            setSuccessMessage(
                '품목을 수정했습니다.'
            )
            setFormError('')

            loadItems()
        } catch (error) {
            console.error(error)

            setFormError(
                error.message ||
                '품목 수정에 실패했습니다.'
            )
        } finally {
            pendingRef.current = false
            setBusy(false)
        }
    }

    const deleteItem = async (code) => {
        if (pendingRef.current) return
        pendingRef.current = true
        setBusy(true)
        setFormError('')

        try {
            const target = items.find((entry) => entry.code === code)
            const accepted = await requestConfirmation({ title: '품목 삭제', confirmLabel: '삭제',
                message: `다음 품목을 삭제하시겠습니까?\n\n코드: ${code}\n품목명: ${target?.name ?? ''}\n\n삭제한 품목은 자동으로 복구되지 않습니다.` })
            if (!accepted) return

            clearSuccessMessage()
            await window.inventoryApi
                .deleteItem(code)

            setSuccessMessage(
                '품목을 삭제했습니다.'
            )

            resetForm()
            closeModal()

            loadItems()
        } catch (error) {
            console.error(error)

            setFormError(
                error.message ||
                '품목 삭제에 실패했습니다.'
            )
        } finally {
            pendingRef.current = false
            setBusy(false)
        }
    }

    const itemTypeOptions =
        useMemo(() => {
            return [
                ...new Set(
                    items
                        .map((item) =>
                            String(
                                item.type ?? ''
                            ).trim()
                        )
                        .filter(Boolean)
                )
            ].sort(
                (a, b) =>
                    a.localeCompare(
                        b,
                        'ko'
                    )
            )
        }, [items])

    const filteredItems =
        useMemo(() => {
            const searchKeyword =
                keyword
                    .trim()
                    .toLowerCase()

            if (!searchKeyword) {
                return items
            }

            return items.filter((item) => {
                const text =
                    [
                        item.code,
                        item.name,
                        item.type,
                        item.spec,
                        item.brand
                    ]
                        .join(' ')
                        .toLowerCase()

                return text.includes(
                    searchKeyword
                )
            })
        }, [
            items,
            keyword
        ])

    const formatNumber = (value) => {
        if (
            value === '' ||
            value === null ||
            value === undefined
        ) {
            return '-'
        }

        const number = Number(value)

        if (!Number.isFinite(number)) {
            return String(value)
        }

        return number.toLocaleString()
    }

    
    const [
        showTypeResults,
        setShowTypeResults
    ] = useState(false)

    const displayValue = (item, key) => ['initialPrice', 'purchasePrice', 'salesPrice', 'initialStock', 'currentStock'].includes(key)
        ? formatNumber(item[key]) : item[key] || '-'

    return (
        <div className={`item-page ${mode ? 'modal-open' : ''}`}>
            <Toast message={successMessage} onClose={clearSuccessMessage} />
      {confirmation && <ConfirmDialog options={confirmation} onClose={closeConfirmation} />}
            <div inert={Boolean(mode)}>
            <div className="page-header">
                <div>
                    <h1>품목 관리</h1>

                    <p>
                        품목을 조회하고 등록, 수정, 삭제합니다.
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
                <div className="item-message">
                    {message}
                </div>
            )}


                <div className="item-list-card">
                    <div className="item-list-header">
                        <div>
                            <h2>품목 목록</h2>

                            <p>
                                전체 {items.length}개 /
                                검색 결과 {filteredItems.length}개
                            </p>
                        </div>

                        <button
                            type="button"
                            className="primary-small-button"
                            onClick={openCreateForm}
                        >
                            새 품목 등록
                        </button>
                    </div>

                    <div className="item-search-box">
                        <input
                            type="text"
                            value={keyword}
                            onChange={(e) =>
                                setKeyword(
                                    e.target.value
                                )
                            }
                            placeholder="품목 코드, 품목명, 규격, 브랜드 검색"
                        />
                    </div>

                    <div className="item-table-wrapper">
                        <table className="item-table">
                            <thead>
                                <tr>{columns.map(([key, label, className]) => <th key={key} className={className}>{label}</th>)}</tr>
                            </thead>
                            <tbody>
                                {filteredItems.length === 0 ? (
                                    <tr><td colSpan={columns.length} className="empty-table-cell">조회된 품목이 없습니다.</td></tr>
                                ) : filteredItems.map((item) => (
                                    <tr key={item.code} tabIndex={0} aria-label={`${item.code} ${item.name} 상세 보기`}
                                        onClick={(event) => { event.currentTarget.focus(); selectItem(item) }} onKeyDown={(event) => {
                                            if (event.key === 'Enter' || event.key === ' ') {
                                                event.preventDefault()
                                                selectItem(item)
                                            }
                                        }}>
                                        {columns.map(([key, , className]) => (
                                            <td key={key} className={`${className} ${key === 'code' ? 'item-code-cell' : ''} ${key === 'currentStock' ? 'stock-cell' : ''} ${key.endsWith('Price') ? 'number-cell' : ''}`}
                                                title={String(displayValue(item, key))}>{displayValue(item, key)}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            {mode && (
                <div className="item-modal-overlay">
                    <div ref={modalRef} className="item-modal" role="dialog" aria-modal="true"
                        aria-labelledby="item-modal-title" tabIndex={-1} onKeyDown={handleModalKeyDown}
                        inert={Boolean(confirmation)} aria-busy={busy}>
                        <div className="item-form-header">
                            <div>
                                <h2 id="item-modal-title">{mode === 'create' ? '새 품목 등록' : mode === 'edit' ? '품목 수정' : '품목 상세'}</h2>
                                <p>{mode === 'create' ? '등록 후 계속해서 다음 품목을 입력할 수 있습니다.' : `${selectedCode} 품목 정보`}</p>
                            </div>
                            <button type="button" className="secondary-button" aria-label="품목 창 닫기" disabled={busy} onClick={closeModal}>×</button>
                        </div>
                        {mode === 'detail' ? (
                            <dl className="item-detail-grid">
                                {fields.map(([key, label]) => (
                                    <div key={key} className={key === 'name' ? 'item-form-full' : ''}>
                                        <dt>{label}</dt><dd>{displayValue(selectedItem, key)}</dd>
                                    </div>
                                ))}
                            </dl>
                        ) : (
                            <fieldset className="item-modal-fields" disabled={busy}>
                    <div className="item-form-grid">
                        <div className="form-field">
                            <label>구분</label>

                            <div className="search-select">
                                <input
                                    ref={firstInputRef}
                                    name="type"
                                    value={form.type}
                                    onChange={(e) => {
                                        changeForm(e)
                                        setShowTypeResults(true)
                                    }}
                                    onFocus={() =>
                                        setShowTypeResults(true)
                                    }
                                    onClick={() =>
                                        setShowTypeResults(true)
                                    }
                                    onBlur={() => {
                                        setTimeout(() => {
                                            setShowTypeResults(false)
                                        }, 100)
                                    }}
                                    autoComplete="off"
                                    placeholder="선택 또는 직접 입력"
                                />

                                {showTypeResults && (
                                    <div className="search-result-list">
                                        {itemTypeOptions.length > 0 ? (
                                            itemTypeOptions.map(
                                                (type) => (
                                                    <button
                                                        key={type}
                                                        type="button"
                                                        className="search-result-item"
                                                        onMouseDown={(e) => {
                                                            e.preventDefault()
                                                        }}
                                                        onClick={() => {
                                                            setForm(
                                                                (prev) => ({
                                                                    ...prev,
                                                                    type
                                                                })
                                                            )

                                                            setShowTypeResults(
                                                                false
                                                            )
                                                        }}
                                                    >
                                                        <span className="search-result-name">
                                                            {type}
                                                        </span>
                                                    </button>
                                                )
                                            )
                                        ) : (
                                            <div className="search-result-empty">
                                                등록된 구분이 없습니다.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="form-field">
                            <label>
                                코드
                                <span className="required-mark">
                                    *
                                </span>
                            </label>

                            <input
                                name="code"
                                value={form.code}
                                onChange={changeForm}
                                placeholder="품목 코드"
                            />
                        </div>

                        <div className="form-field item-form-full">
                            <label>
                                품목명
                                <span className="required-mark">
                                    *
                                </span>
                            </label>

                            <input
                                name="name"
                                value={form.name}
                                onChange={changeForm}
                                placeholder="품목명"
                            />
                        </div>

                        <div className="item-form-section-title">
                            단가
                        </div>

                        <div className="form-field">
                            <label>
                                기초재고단가
                            </label>

                            <input
                                type="number"
                                name="initialPrice"
                                value={
                                    form.initialPrice
                                }
                                onChange={changeForm}
                                min="0"
                                placeholder="0"
                            />
                        </div>

                        <div className="form-field">
                            <label>
                                매입단가
                            </label>

                            <input
                                type="number"
                                name="purchasePrice"
                                value={
                                    form.purchasePrice
                                }
                                onChange={changeForm}
                                min="0"
                                placeholder="0"
                            />
                        </div>

                        <div className="form-field">
                            <label>
                                매출단가
                            </label>

                            <input
                                type="number"
                                name="salesPrice"
                                value={
                                    form.salesPrice
                                }
                                onChange={changeForm}
                                min="0"
                                placeholder="0"
                            />
                        </div>

                        <div className="item-form-section-title">
                            재고
                        </div>

                        <div className="form-field">
                            <label>
                                기초재고량
                            </label>

                            <input
                                type="number"
                                name="initialStock"
                                value={
                                    form.initialStock
                                }
                                onChange={changeForm}
                                readOnly={
                                    Boolean(selectedCode)
                                }
                                placeholder="0"
                            />

                        {selectedCode && (
                            <div className="field-help">
                                {selectedCode
                                    ? '현재재고 변경은 입출고 또는 재고 조정으로 처리합니다.'
                                    : '신규 등록 시 기초재고량과 동일하게 자동 설정됩니다.'}
                            </div>
                        )}
                        </div>

                        <div className="form-field">
                            <label>
                                현재재고량
                            </label>

                            <input
                                type="number"
                                name="currentStock"
                                value={form.currentStock}
                                readOnly
                                placeholder="0"
                            />

                            <div className="field-help">
                                현재재고 변경은 재고 조정 메뉴에서 처리합니다.
                            </div>
                        </div>

                        <div className="item-form-section-title">
                            추가 정보
                        </div>

                        <div className="form-field">
                            <label>단위</label>

                            <input
                                name="unit"
                                value={form.unit}
                                onChange={changeForm}
                                placeholder="예: EA"
                            />
                        </div>

                        <div className="form-field">
                            <label>규격</label>

                            <input
                                name="spec"
                                value={form.spec}
                                onChange={changeForm}
                                placeholder="규격"
                            />
                        </div>

                        <div className="form-field item-form-full">
                            <label>브랜드명</label>

                            <input
                                name="brand"
                                value={form.brand}
                                onChange={changeForm}
                                placeholder="브랜드명"
                            />
                        </div>
                    </div>

                            </fieldset>
                        )}
                        {formError && <div className="form-error-message" role="alert">{formError}</div>}
                        <div className="item-form-actions">
                            {mode === 'detail' && <button type="button" className="table-delete-button" disabled={busy} onClick={() => deleteItem(selectedCode)}>삭제</button>}
                            <div className="item-modal-primary-actions">
                                <button type="button" className="secondary-button" disabled={busy}
                                    onClick={() => mode === 'edit' ? selectItem(selectedItem, false) : closeModal()}>{mode === 'edit' ? '취소' : '닫기'}</button>
                                <button type="button" className="item-save-button" disabled={busy}
                                    onClick={() => {
                                        if (mode === 'detail') { setFormError(''); setMode('edit') }
                                        else if (mode === 'create') addItem()
                                        else updateItem()
                                    }}>
                                    {mode === 'detail' ? '수정' : mode === 'create' ? '등록' : '저장'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ItemManager
