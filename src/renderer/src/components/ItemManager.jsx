import ConfirmDialog from './common/ConfirmDialog'
import Toast from './common/Toast'
import useConfirmation from './common/useConfirmation'
import {
    useCallback,
    useEffect,
    useMemo,
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

    const [keyword, setKeyword] =
        useState('')

    const loadItems = useCallback(() => {
        window.inventoryApi
            .getItems()
            .then(setItems)
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

    const addItem = async () => {
        setMessage('')
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
            loadItems()
        } catch (error) {
            console.error(error)

            setFormError(
                error.message ||
                '품목 등록에 실패했습니다.'
            )
        }
    }

    const selectItem = (item) => {
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

        setMessage('')
        setFormError('')
    }

    const updateItem = async () => {
        setMessage('')
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
        }
    }

    const deleteItem = async (code) => {
      const target = items.find((entry) => entry.code === code)
      const accepted = await requestConfirmation({ title: '품목 삭제', confirmLabel: '삭제',
        message: `다음 품목을 삭제하시겠습니까?\n\n코드: ${code}\n품목명: ${target?.name ?? ''}\n\n삭제한 품목은 자동으로 복구되지 않습니다.` })
      if (!accepted) return

        setMessage('')
        clearSuccessMessage()

        try {
            await window.inventoryApi
                .deleteItem(code)

            setSuccessMessage(
                '품목을 삭제했습니다.'
            )

            if (selectedCode === code) {
                resetForm()
            }

            loadItems()
        } catch (error) {
            console.error(error)

            setMessage(
                error.message ||
                '품목 삭제에 실패했습니다.'
            )
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

    return (
        <div className="item-page">
            <Toast message={successMessage} onClose={clearSuccessMessage} />
      {confirmation && <ConfirmDialog options={confirmation} onClose={closeConfirmation} />}
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

            <div className="item-layout">
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
                            onClick={resetForm}
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
                                <tr>
                                    <th>코드</th>
                                    <th>품목명</th>
                                    <th>구분</th>
                                    <th>현재재고</th>
                                    <th>매입단가</th>
                                    <th>매출단가</th>
                                    <th>규격</th>
                                    <th>브랜드</th>
                                    <th>관리</th>
                                </tr>
                            </thead>

                            <tbody>
                                {filteredItems.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan="9"
                                            className="empty-table-cell"
                                        >
                                            조회된 품목이 없습니다.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredItems.map(
                                        (item, index) => (
                                            <tr
                                                key={`${item.code}-${index}`}
                                                className={
                                                    selectedCode ===
                                                        item.code
                                                        ? 'selected-item-row'
                                                        : ''
                                                }
                                                onClick={() =>
                                                    selectItem(item)
                                                }
                                            >
                                                <td className="item-code-cell">
                                                    {item.code}
                                                </td>

                                                <td>
                                                    <div className="item-name-cell">
                                                        {item.name}
                                                    </div>

                                                    {item.unit && (
                                                        <div className="table-sub-text">
                                                            단위: {item.unit}
                                                        </div>
                                                    )}
                                                </td>

                                                <td>
                                                    {item.type || '-'}
                                                </td>

                                                <td className="stock-cell">
                                                    {formatNumber(
                                                        item.currentStock
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

                                                <td>
                                                    {item.spec || '-'}
                                                </td>

                                                <td>
                                                    {item.brand || '-'}
                                                </td>

                                                <td>
                                                    <div className="item-action-buttons">
                                                        <button
                                                            type="button"
                                                            className="table-edit-button"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                selectItem(item)
                                                            }}
                                                        >
                                                            수정
                                                        </button>

                                                        <button
                                                            type="button"
                                                            className="table-delete-button"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                deleteItem(
                                                                    item.code
                                                                )
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

                <div className="item-form-card">
                    <div className="item-form-header">
                        <div>
                            <span
                                className={`form-mode-badge ${
                                    selectedCode ? 'edit' : 'create'
                                }`}
                            >
                                {selectedCode ? '수정 중' : '신규 등록'}
                            </span>
                            <h2>
                                {selectedCode
                                    ? '품목 수정'
                                    : '새 품목 등록'}
                            </h2>

                            <p>
                                {selectedCode
                                    ? `${selectedCode} 품목을 수정합니다.`
                                    : '새로운 품목 정보를 입력해주세요.'}
                            </p>
                        </div>
                    </div>

                    <div className="item-form-grid">
                        <div className="form-field">
                            <label>구분</label>

                            <div className="search-select">
                                <input
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

                    {formError && (
                        <div className="form-error-message" role="alert">
                            {formError}
                        </div>
                    )}

                    <div className="item-form-actions">
                        {selectedCode ? (
                            <>
                                <button
                                    type="button"
                                    className="item-save-button"
                                    onClick={updateItem}
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
                                className="item-save-button"
                                onClick={addItem}
                            >
                                품목 등록
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ItemManager
