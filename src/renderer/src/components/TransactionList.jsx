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
    const [cancelTarget, setCancelTarget] =
        useState(null)

    const [cancelReason, setCancelReason] =
        useState('')

    const [showCancelModal, setShowCancelModal] =
        useState(false)

    const [
        cancelDetailTarget,
        setCancelDetailTarget
    ] = useState(null)

    const [
        showCancelDetailModal,
        setShowCancelDetailModal
    ] = useState(false)

    const [transactions, setTransactions] =
        useState([])

    const [clientOptions, setClientOptions] =
        useState([])

    const [itemOptions, setItemOptions] =
        useState([])

    const [clientSearchText, setClientSearchText] =
        useState('')

    const [itemSearchText, setItemSearchText] =
        useState('')

    const [
        showClientResults,
        setShowClientResults
    ] = useState(false)

    const [
        showItemResults,
        setShowItemResults
    ] = useState(false)

    const [search, setSearch] =
        useState(emptySearch)

    const [message, setMessage] =
        useState('')

    const [page, setPage] =
        useState(1)

    const [pageSize, setPageSize] =
        useState(100)

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

    const loadSearchOptions =
        useCallback(async () => {
            try {
                const [
                    salesClients,
                    purchaseClients,
                    items
                ] = await Promise.all([
                    window.inventoryApi
                        .getClients('sales'),

                    window.inventoryApi
                        .getClients('purchase'),

                    window.inventoryApi
                        .getItems()
                ])

                const mergedClients = [
                    ...salesClients,
                    ...purchaseClients
                ]

                const uniqueClients = []

                const clientKeys =
                    new Set()

                for (const client of mergedClients) {
                    const key =
                        `${client.code}||${client.name}`

                    if (clientKeys.has(key)) {
                        continue
                    }

                    clientKeys.add(key)
                    uniqueClients.push(client)
                }

                uniqueClients.sort(
                    (a, b) =>
                        String(a.code ?? '')
                            .localeCompare(
                                String(b.code ?? ''),
                                'ko'
                            )
                )

                const sortedItems =
                    [...items].sort(
                        (a, b) =>
                            String(a.code ?? '')
                                .localeCompare(
                                    String(b.code ?? ''),
                                    'ko'
                                )
                    )

                setClientOptions(
                    uniqueClients
                )

                setItemOptions(
                    sortedItems
                )
            } catch (error) {
                console.error(error)

                setMessage(
                    '검색용 거래처/품목 목록을 불러오지 못했습니다.'
                )
            }
        }, [])


    useEffect(() => {
        loadTransactions()
        loadSearchOptions()
    }, [
        loadTransactions,
        loadSearchOptions
    ])

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

        setClientSearchText('')
        setItemSearchText('')

        setShowClientResults(false)
        setShowItemResults(false)

        setPage(1)
    }

    const filteredClientOptions =
        useMemo(() => {
            const keyword =
                search.clientKeyword
                    .trim()
                    .toLowerCase()

            if (!keyword) {
                return clientOptions
            }

            return clientOptions.filter(
                (client) => {
                    const code =
                        String(
                            client.code ?? ''
                        ).toLowerCase()

                    const name =
                        String(
                            client.name ?? ''
                        ).toLowerCase()

                    return (
                        code.startsWith(keyword) ||
                        name.startsWith(keyword)
                    )
                }
            )
        }, [
            clientOptions,
            search.clientKeyword
        ])

    const filteredItemOptions =
        useMemo(() => {
            const keyword =
                search.itemKeyword
                    .trim()
                    .toLowerCase()

            if (!keyword) {
                return itemOptions
            }

            return itemOptions.filter(
                (item) => {
                    const code =
                        String(
                            item.code ?? ''
                        ).toLowerCase()

                    const name =
                        String(
                            item.name ?? ''
                        ).toLowerCase()

                    return (
                        code.startsWith(keyword) ||
                        name.startsWith(keyword)
                    )
                }
            )
        }, [
            itemOptions,
            search.itemKeyword
        ])

    const selectClient = (client) => {
        setSearch((prev) => ({
            ...prev,
            clientKeyword:
                String(client.code)
        }))

        setClientSearchText(
            `${client.code} / ${client.name}`
        )

        setShowClientResults(false)
        setPage(1)
    }

    const selectItem = (item) => {
        setSearch((prev) => ({
            ...prev,
            itemKeyword:
                String(item.code)
        }))

        setItemSearchText(
            `${item.code} / ${item.name}`
        )

        setShowItemResults(false)
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
                        const clientCode =
                            String(
                                transaction.clientCode ?? ''
                            ).toLowerCase()

                        const clientName =
                            String(
                                transaction.clientName ?? ''
                            ).toLowerCase()

                        if (
                            !clientCode.startsWith(
                                clientKeyword
                            ) &&
                            !clientName.startsWith(
                                clientKeyword
                            )
                        ) {
                            return false
                        }
                    }

                    if (itemKeyword) {
                        const itemCode =
                            String(
                                transaction.itemCode ?? ''
                            ).toLowerCase()

                        const itemName =
                            String(
                                transaction.itemName ?? ''
                            ).toLowerCase()

                        if (
                            !itemCode.startsWith(
                                itemKeyword
                            ) &&
                            !itemName.startsWith(
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

    const isShowAll =
        pageSize === 'all'

    const totalPages =
        isShowAll
            ? 1
            : Math.max(
                1,
                Math.ceil(
                    filteredTransactions.length /
                    pageSize
                )
            )

    const currentPage =
        Math.min(
            page,
            totalPages
        )

    const pageTransactions =
        isShowAll
            ? filteredTransactions
            : filteredTransactions.slice(
                (currentPage - 1) *
                pageSize,
                currentPage *
                pageSize
            )

    const openCancelModal = (
        transaction
    ) => {
        setCancelTarget(transaction)
        setCancelReason('')
        setShowCancelModal(true)
    }

    const closeCancelModal = () => {
        setCancelTarget(null)
        setCancelReason('')
        setShowCancelModal(false)
    }

    const openCancelDetailModal = (
        transaction
    ) => {
        setCancelDetailTarget(
            transaction
        )

        setShowCancelDetailModal(
            true
        )
    }

    const closeCancelDetailModal = () => {
        setCancelDetailTarget(null)
        setShowCancelDetailModal(false)
    }

    const cancelTransaction =
        async () => {
            if (!cancelTarget) {
                return
            }

            const reason =
                cancelReason.trim()

            if (!reason) {
                setMessage(
                    '취소 사유를 입력해주세요.'
                )
                return
            }

            setMessage('')

            try {
                const result =
                    await window.inventoryApi
                        .cancelTransaction(
                            cancelTarget.transactionNo,
                            reason
                        )

                if (result.stockWarning) {
                    setMessage(
                        `${cancelTarget.transactionNo}번 거래를 취소했습니다. 현재재고가 ${result.currentStock}개로 음수입니다.`
                    )
                } else {
                    setMessage(
                        `${cancelTarget.transactionNo}번 거래를 취소했습니다.`
                    )
                }

                closeCancelModal()
                loadTransactions()
            } catch (error) {
                console.error(error)

                setMessage(
                    error.message ||
                    '거래 취소에 실패했습니다.'
                )
            }
        }

    const exportExcel =
        async () => {
            setMessage('')

            if (
                filteredTransactions.length === 0
            ) {
                setMessage(
                    '내보낼 입출고 내역이 없습니다.'
                )
                return
            }

            try {
                const result =
                    await window.inventoryApi
                        .exportTransactions(
                            filteredTransactions
                        )

                setMessage(
                    `${result.count}건을 ${result.fileName} 파일로 내보냈습니다.`
                )
            } catch (error) {
                console.error(error)

                setMessage(
                    error.message ||
                    'Excel 내보내기에 실패했습니다.'
                )
            }
        }

    const openExportFolder =
        async () => {
            try {
                await window.inventoryApi
                    .openExportFolder()
            } catch (error) {
                console.error(error)

                setMessage(
                    '내보내기 폴더를 열지 못했습니다.'
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

    const formatDateTime = (value) => {
        if (!value) {
            return '-'
        }

        const date =
            value instanceof Date
                ? value
                : new Date(value)

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return String(value)
        }

        const year =
            date.getFullYear()

        const month =
            String(
                date.getMonth() + 1
            ).padStart(2, '0')

        const day =
            String(
                date.getDate()
            ).padStart(2, '0')

        const hour =
            String(
                date.getHours()
            ).padStart(2, '0')

        const minute =
            String(
                date.getMinutes()
            ).padStart(2, '0')

        const second =
            String(
                date.getSeconds()
            ).padStart(2, '0')

        return (
            `${year}-${month}-${day} ` +
            `${hour}:${minute}:${second}`
        )
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

                <div className="transaction-header-actions">
                    <button
                        type="button"
                        className="secondary-button"
                        onClick={
                            openExportFolder
                        }
                    >
                        내보내기 폴더
                    </button>

                    <button
                        type="button"
                        className="excel-export-button"
                        onClick={exportExcel}
                        disabled={
                            filteredTransactions.length === 0
                        }
                    >
                        Excel 내보내기
                    </button>

                    <button
                        type="button"
                        className="secondary-button"
                        onClick={
                            loadTransactions
                        }
                    >
                        새로고침
                    </button>
                </div>
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

                        <div className="search-select">
                            <input
                                type="text"
                                value={clientSearchText}
                                autoComplete="off"
                                placeholder="코드 또는 거래처명"

                                onFocus={() => {
                                    setShowClientResults(true)
                                }}

                                onClick={() => {
                                    setShowClientResults(true)
                                }}

                                onChange={(e) => {
                                    const value =
                                        e.target.value

                                    setClientSearchText(
                                        value
                                    )

                                    setSearch((prev) => ({
                                        ...prev,
                                        clientKeyword:
                                            value
                                    }))

                                    setShowClientResults(
                                        true
                                    )

                                    setPage(1)
                                }}

                                onBlur={() => {
                                    setTimeout(() => {
                                        setShowClientResults(
                                            false
                                        )
                                    }, 100)
                                }}
                            />

                            {showClientResults && (
                                <div className="search-result-list">
                                    {filteredClientOptions.length >
                                        0 ? (
                                        filteredClientOptions.map(
                                            (client, index) => (
                                                <button
                                                    key={
                                                        `${client.code}-${client.name}-${index}`
                                                    }
                                                    type="button"
                                                    className="search-result-item"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault()
                                                    }}
                                                    onClick={() =>
                                                        selectClient(
                                                            client
                                                        )
                                                    }
                                                >
                                                    <span className="search-result-code">
                                                        {client.code}
                                                    </span>

                                                    <span className="search-result-name">
                                                        {client.name}
                                                    </span>
                                                </button>
                                            )
                                        )
                                    ) : (
                                        <div className="search-result-empty">
                                            검색 결과가 없습니다.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="form-field">
                        <label>품목</label>

                        <div className="search-select">
                            <input
                                type="text"
                                value={itemSearchText}
                                autoComplete="off"
                                placeholder="코드 또는 품목명"

                                onFocus={() => {
                                    setShowItemResults(true)
                                }}

                                onClick={() => {
                                    setShowItemResults(true)
                                }}

                                onChange={(e) => {
                                    const value =
                                        e.target.value

                                    setItemSearchText(
                                        value
                                    )

                                    setSearch((prev) => ({
                                        ...prev,
                                        itemKeyword:
                                            value
                                    }))

                                    setShowItemResults(
                                        true
                                    )

                                    setPage(1)
                                }}

                                onBlur={() => {
                                    setTimeout(() => {
                                        setShowItemResults(
                                            false
                                        )
                                    }, 100)
                                }}
                            />

                            {showItemResults && (
                                <div className="search-result-list">
                                    {filteredItemOptions.length >
                                        0 ? (
                                        filteredItemOptions.map(
                                            (item) => (
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
                                            )
                                        )
                                    ) : (
                                        <div className="search-result-empty">
                                            검색 결과가 없습니다.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
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

            <div className="transaction-list-toolbar">
                <div className="page-size-buttons">
                    <button
                        type="button"
                        className={
                            pageSize === 30
                                ? 'page-size-button active'
                                : 'page-size-button'
                        }
                        onClick={() => {
                            setPageSize(30)
                            setPage(1)
                        }}
                    >
                        30건
                    </button>

                    <button
                        type="button"
                        className={
                            pageSize === 50
                                ? 'page-size-button active'
                                : 'page-size-button'
                        }
                        onClick={() => {
                            setPageSize(50)
                            setPage(1)
                        }}
                    >
                        50건
                    </button>

                    <button
                        type="button"
                        className={
                            pageSize === 100
                                ? 'page-size-button active'
                                : 'page-size-button'
                        }
                        onClick={() => {
                            setPageSize(100)
                            setPage(1)
                        }}
                    >
                        100건
                    </button>

                    <button
                        type="button"
                        className={
                            pageSize === 'all'
                                ? 'page-size-button active'
                                : 'page-size-button'
                        }
                        onClick={() => {
                            setPageSize('all')
                            setPage(1)
                        }}
                    >
                        전체
                    </button>
                </div>

                <span className="transaction-result-count">
                    총 {filteredTransactions.length}건
                </span>
            </div>

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
                                                <div className="canceled-status-info">
                                                    <span className="status-canceled">
                                                        취소
                                                    </span>

                                                    <div className="cancel-reason-preview">
                                                        {transaction.cancelReason ||
                                                            '사유 없음'}
                                                    </div>

                                                    <button
                                                        type="button"
                                                        className="cancel-detail-button"
                                                        onClick={() =>
                                                            openCancelDetailModal(
                                                                transaction
                                                            )
                                                        }
                                                    >
                                                        취소 상세 보기
                                                    </button>
                                                </div>
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
                                                        openCancelModal(
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

            {!isShowAll && (
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
            )}

            {showCancelModal && cancelTarget && (
                <div className="cancel-modal-overlay">
                    <div className="cancel-modal">
                        <div className="cancel-modal-header">
                            <h2>
                                거래 취소
                            </h2>

                            <button
                                type="button"
                                className="cancel-modal-close"
                                onClick={
                                    closeCancelModal
                                }
                            >
                                ×
                            </button>
                        </div>

                        <div className="cancel-modal-warning">
                            거래를 취소하면 해당 거래로 변경된
                            재고가 자동으로 되돌아갑니다.
                        </div>

                        <div className="cancel-modal-info">
                            <div>
                                <span>
                                    거래번호
                                </span>

                                <strong>
                                    {
                                        cancelTarget
                                            .transactionNo
                                    }
                                </strong>
                            </div>

                            <div>
                                <span>
                                    일자
                                </span>

                                <strong>
                                    {
                                        cancelTarget
                                            .date
                                    }
                                </strong>
                            </div>

                            <div>
                                <span>
                                    구분
                                </span>

                                <strong>
                                    {
                                        cancelTarget
                                            .type
                                    }
                                </strong>
                            </div>

                            <div>
                                <span>
                                    거래처
                                </span>

                                <strong>
                                    {
                                        cancelTarget
                                            .clientName
                                    }
                                </strong>
                            </div>

                            <div>
                                <span>
                                    품목
                                </span>

                                <strong>
                                    {
                                        cancelTarget
                                            .itemName
                                    }
                                </strong>
                            </div>

                            <div>
                                <span>
                                    수량
                                </span>

                                <strong>
                                    {formatNumber(
                                        cancelTarget
                                            .quantity
                                    )}
                                </strong>
                            </div>
                        </div>

                        <div className="form-field cancel-reason-field">
                            <label>
                                취소 사유
                            </label>

                            <textarea
                                value={
                                    cancelReason
                                }
                                onChange={(e) =>
                                    setCancelReason(
                                        e.target.value
                                    )
                                }
                                rows="4"
                                placeholder="예: 잘못 등록한 출고 내역"
                                autoFocus
                            />
                        </div>

                        <div className="cancel-modal-actions">
                            <button
                                type="button"
                                className="secondary-button"
                                onClick={
                                    closeCancelModal
                                }
                            >
                                닫기
                            </button>

                            <button
                                type="button"
                                className="cancel-confirm-button"
                                onClick={
                                    cancelTransaction
                                }
                            >
                                거래 취소
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showCancelDetailModal &&
                cancelDetailTarget && (
                    <div className="cancel-modal-overlay">
                        <div className="cancel-detail-modal">
                            <div className="cancel-modal-header">
                                <h2>
                                    거래 취소 상세
                                </h2>

                                <button
                                    type="button"
                                    className="cancel-modal-close"
                                    onClick={
                                        closeCancelDetailModal
                                    }
                                >
                                    ×
                                </button>
                            </div>

                            <div className="cancel-detail-info">
                                <div>
                                    <span>
                                        거래번호
                                    </span>

                                    <strong>
                                        {
                                            cancelDetailTarget
                                                .transactionNo
                                        }
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        거래일자
                                    </span>

                                    <strong>
                                        {
                                            cancelDetailTarget
                                                .date
                                        }
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        구분
                                    </span>

                                    <strong>
                                        {
                                            cancelDetailTarget
                                                .type
                                        }
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        품목
                                    </span>

                                    <strong>
                                        {
                                            cancelDetailTarget
                                                .itemName
                                        }
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        취소일시
                                    </span>

                                    <strong>
                                        {formatDateTime(
                                            cancelDetailTarget
                                                .canceledAt
                                        )}
                                    </strong>
                                </div>
                            </div>

                            <div className="cancel-detail-reason">
                                <span>
                                    취소 사유
                                </span>

                                <div>
                                    {cancelDetailTarget
                                        .cancelReason ||
                                        '등록된 취소 사유가 없습니다.'}
                                </div>
                            </div>

                            <div className="cancel-modal-actions">
                                <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={
                                        closeCancelDetailModal
                                    }
                                >
                                    닫기
                                </button>
                            </div>
                        </div>
                    </div>
                )}
        </div>
    )
}

export default TransactionList