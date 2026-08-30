import {
    useCallback,
    useEffect,
    useMemo,
    useState
} from 'react'

function getToday() {
    const now = new Date()

    const year =
        now.getFullYear()

    const month =
        String(
            now.getMonth() + 1
        ).padStart(2, '0')

    const day =
        String(
            now.getDate()
        ).padStart(2, '0')

    return `${year}-${month}-${day}`
}

const emptyForm = {
    date: getToday(),
    itemCode: '',
    quantity: '',
    reason: ''
}

function InventoryAdjustment() {
    const [items, setItems] =
        useState([])

    const [adjustments, setAdjustments] =
        useState([])

    const [form, setForm] =
        useState(emptyForm)

    const [itemSearch, setItemSearch] =
        useState('')

    const [
        showItemResults,
        setShowItemResults
    ] = useState(false)

    const [message, setMessage] =
        useState('')

    const [result, setResult] =
        useState(null)

    const loadData =
        useCallback(async () => {
            try {
                const [
                    itemData,
                    adjustmentData
                ] = await Promise.all([
                    window.inventoryApi
                        .getItems(),

                    window.inventoryApi
                        .getInventoryAdjustments()
                ])

                setItems(itemData)
                setAdjustments(
                    adjustmentData
                )
            } catch (error) {
                console.error(error)

                setMessage(
                    '재고 조정 데이터를 불러오지 못했습니다.'
                )
            }
        }, [])

    useEffect(() => {
        loadData()
    }, [loadData])

    const selectedItem =
        items.find(
            (item) =>
                item.code ===
                form.itemCode
        )

    const filteredItems =
        useMemo(() => {
            const keyword =
                itemSearch
                    .trim()
                    .toLowerCase()

            const result =
                items.filter((item) => {
                    if (!keyword) {
                        return true
                    }

                    const text = [
                        item.code,
                        item.name,
                        item.brand,
                        item.spec
                    ]
                        .join(' ')
                        .toLowerCase()

                    return text.includes(keyword)
                })

            return result.slice(0, 20)
        }, [
            items,
            itemSearch
        ])

    const expectedStock =
        selectedItem &&
            form.quantity !== ''
            ? Number(
                selectedItem.currentStock ||
                0
            ) +
            Number(
                form.quantity || 0
            )
            : null

    const selectItem = (item) => {
        setForm((prev) => ({
            ...prev,
            itemCode: item.code
        }))

        setItemSearch(
            `${item.code} / ${item.name}`
        )

        setShowItemResults(false)
    }

    const changeForm = (e) => {
        const {
            name,
            value
        } = e.target

        setForm((prev) => ({
            ...prev,
            [name]: value
        }))
    }

    const submitAdjustment =
        async () => {
            setMessage('')
            setResult(null)

            try {
                const response =
                    await window.inventoryApi
                        .addInventoryAdjustment({
                            date: form.date,
                            itemCode:
                                form.itemCode,
                            quantity:
                                Number(
                                    form.quantity
                                ),
                            reason:
                                form.reason
                        })

                setResult(response)

                if (
                    response.stockWarning
                ) {
                    setMessage(
                        `재고를 조정했습니다. 현재재고가 ${response.adjustment.currentStock}개로 음수입니다.`
                    )
                } else {
                    setMessage(
                        '재고 조정을 완료했습니다.'
                    )
                }

                setForm({
                    ...emptyForm,
                    date: form.date
                })

                setItemSearch('')
                setShowItemResults(false)

                await loadData()
            } catch (error) {
                console.error(error)

                setMessage(
                    error.message ||
                    '재고 조정에 실패했습니다.'
                )
            }
        }

    const formatNumber = (value) => {
        const number =
            Number(value)

        if (
            !Number.isFinite(number)
        ) {
            return '0'
        }

        return number.toLocaleString()
    }

    return (
        <div className="adjustment-page">
            <div className="page-header">
                <div>
                    <h1>재고 조정</h1>

                    <p>
                        실사 차이, 파손, 분실 등으로
                        발생한 재고 차이를 조정합니다.
                    </p>
                </div>
            </div>

            <div className="adjustment-layout">
                <div className="adjustment-form-card">
                    <h2>재고 조정 등록</h2>

                    <div className="adjustment-warning">
                        입고나 출고 업무는
                        입출고 등록에서 처리해주세요.
                        이 화면은 실제 재고와
                        시스템 재고가 다른 경우에만
                        사용합니다.
                    </div>

                    <div className="adjustment-form-grid">
                        <div className="form-field">
                            <label>일자</label>

                            <input
                                type="date"
                                name="date"
                                value={form.date}
                                onChange={changeForm}
                            />
                        </div>

                        <div className="form-field adjustment-full">
                            <label>품목</label>

                            <div className="search-select">
                                <input
                                    type="text"
                                    value={itemSearch}
                                    placeholder="품목 코드 또는 품목명 검색"
                                    autoComplete="off"

                                    onFocus={() => {
                                        setShowItemResults(true)
                                    }}

                                    onClick={() => {
                                        setShowItemResults(true)
                                    }}

                                    onChange={(e) => {
                                        const value =
                                            e.target.value

                                        setItemSearch(value)

                                        setForm((prev) => ({
                                            ...prev,
                                            itemCode: ''
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
                                                    onMouseDown={(e) => {
                                                        e.preventDefault()
                                                    }}
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
                                                        재고{' '}
                                                        {formatNumber(
                                                            item.currentStock
                                                        )}
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

                        {selectedItem && (
                            <div className="adjustment-stock-info adjustment-full">
                                <div>
                                    <span>
                                        현재재고
                                    </span>

                                    <strong>
                                        {formatNumber(
                                            selectedItem.currentStock
                                        )}
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        조정 후 예상재고
                                    </span>

                                    <strong>
                                        {expectedStock === null
                                            ? '-'
                                            : formatNumber(
                                                expectedStock
                                            )}
                                    </strong>
                                </div>
                            </div>
                        )}

                        <div className="form-field">
                            <label>
                                조정수량
                            </label>

                            <input
                                type="number"
                                name="quantity"
                                step="1"
                                value={form.quantity}
                                onChange={changeForm}
                                placeholder="+3 또는 -2"
                            />
                        </div>

                        <div className="form-field adjustment-full">
                            <label>
                                조정 사유
                            </label>

                            <textarea
                                name="reason"
                                value={form.reason}
                                onChange={changeForm}
                                rows="3"
                                placeholder="예: 재고 실사 결과 2개 부족"
                            />
                        </div>
                    </div>

                    <button
                        type="button"
                        className="adjustment-submit-button"
                        onClick={submitAdjustment}
                    >
                        재고 조정 등록
                    </button>

                    {message && (
                        <div className="adjustment-message">
                            {message}
                        </div>
                    )}

                    {result && (
                        <div className="adjustment-result">
                            <div>
                                <span>
                                    조정번호
                                </span>

                                <strong>
                                    {
                                        result.adjustment
                                            .adjustmentNo
                                    }
                                </strong>
                            </div>

                            <div>
                                <span>
                                    조정 전
                                </span>

                                <strong>
                                    {formatNumber(
                                        result.adjustment
                                            .previousStock
                                    )}
                                </strong>
                            </div>

                            <div>
                                <span>
                                    조정량
                                </span>

                                <strong>
                                    {
                                        result.adjustment
                                            .quantity > 0
                                            ? '+'
                                            : ''
                                    }

                                    {formatNumber(
                                        result.adjustment
                                            .quantity
                                    )}
                                </strong>
                            </div>

                            <div>
                                <span>
                                    조정 후
                                </span>

                                <strong>
                                    {formatNumber(
                                        result.adjustment
                                            .currentStock
                                    )}
                                </strong>
                            </div>
                        </div>
                    )}
                </div>

                <div className="adjustment-history-card">
                    <div className="adjustment-history-header">
                        <div>
                            <h2>
                                최근 조정 내역
                            </h2>

                            <p>
                                최근 등록된 재고 조정
                                이력을 확인합니다.
                            </p>
                        </div>
                    </div>

                    <div className="adjustment-table-wrapper">
                        <table className="adjustment-table">
                            <thead>
                                <tr>
                                    <th>번호</th>
                                    <th>일자</th>
                                    <th>품목</th>
                                    <th>조정 전</th>
                                    <th>조정량</th>
                                    <th>조정 후</th>
                                    <th>사유</th>
                                </tr>
                            </thead>

                            <tbody>
                                {adjustments.length ===
                                    0 ? (
                                    <tr>
                                        <td
                                            colSpan="7"
                                            className="empty-table-cell"
                                        >
                                            등록된 재고 조정
                                            내역이 없습니다.
                                        </td>
                                    </tr>
                                ) : (
                                    adjustments
                                        .slice(0, 100)
                                        .map(
                                            (adjustment) => (
                                                <tr
                                                    key={
                                                        adjustment
                                                            .adjustmentNo
                                                    }
                                                >
                                                    <td>
                                                        {
                                                            adjustment
                                                                .adjustmentNo
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            adjustment
                                                                .date
                                                        }
                                                    </td>

                                                    <td>
                                                        <div>
                                                            {
                                                                adjustment
                                                                    .itemName
                                                            }
                                                        </div>

                                                        <div className="table-sub-text">
                                                            {
                                                                adjustment
                                                                    .itemCode
                                                            }
                                                        </div>
                                                    </td>

                                                    <td className="number-cell">
                                                        {formatNumber(
                                                            adjustment
                                                                .previousStock
                                                        )}
                                                    </td>

                                                    <td
                                                        className={
                                                            Number(
                                                                adjustment
                                                                    .quantity
                                                            ) > 0
                                                                ? 'number-cell adjustment-plus'
                                                                : 'number-cell adjustment-minus'
                                                        }
                                                    >
                                                        {Number(
                                                            adjustment
                                                                .quantity
                                                        ) > 0
                                                            ? '+'
                                                            : ''}

                                                        {formatNumber(
                                                            adjustment
                                                                .quantity
                                                        )}
                                                    </td>

                                                    <td className="number-cell">
                                                        {formatNumber(
                                                            adjustment
                                                                .currentStock
                                                        )}
                                                    </td>

                                                    <td>
                                                        {
                                                            adjustment
                                                                .reason
                                                        }
                                                    </td>
                                                </tr>
                                            )
                                        )
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default InventoryAdjustment