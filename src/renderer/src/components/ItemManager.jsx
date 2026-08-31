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
    const [items, setItems] =
        useState([])

    const [form, setForm] =
        useState(emptyForm)

    const [message, setMessage] =
        useState('')

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
        setMessage('')
    }

    const addItem = async () => {
        setMessage('')

        try {
            await window.inventoryApi
                .addItem(
                    buildRequestData()
                )

            setMessage(
                '품목을 등록했습니다.'
            )

            resetForm()
            loadItems()
        } catch (error) {
            console.error(error)

            setMessage(
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
    }

    const updateItem = async () => {
        setMessage('')

        try {
            await window.inventoryApi
                .updateItem(
                    selectedCode,
                    buildRequestData()
                )

            setMessage(
                '품목을 수정했습니다.'
            )

            resetForm()
            loadItems()
        } catch (error) {
            console.error(error)

            setMessage(
                error.message ||
                '품목 수정에 실패했습니다.'
            )
        }
    }

    const deleteItem = async (code) => {
        setMessage('')

        try {
            await window.inventoryApi
                .deleteItem(code)

            setMessage(
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

    return (
        <div className="item-page">
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

                            <input
                                name="type"
                                value={form.type}
                                onChange={changeForm}
                                placeholder="예: 상품"
                            />
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