import { useCallback, useEffect, useMemo, useState } from 'react'

const emptySearch = {
    startDate: '',
    endDate: '',
    type: '',
    clientKeyword: '',
    itemKeyword: ''
}

function TransactionList() {
    const [transactions, setTransactions] = useState([])
    const [search, setSearch] = useState(emptySearch)
    const [message, setMessage] = useState('')

    const loadTransactions = useCallback(() => {
        window.inventoryApi
            .getTransactions()
            .then(setTransactions)
            .catch((error) => {
                console.error(error)
                setMessage('입출고 내역을 불러오지 못했습니다.')
            })
    }, [])

    useEffect(() => {
        loadTransactions()
    }, [loadTransactions])

    const changeSearch = (e) => {
        const { name, value } = e.target

        setSearch((prev) => ({
            ...prev,
            [name]: value
        }))
    }

    const filteredTransactions = useMemo(() => {
        const clientKeyword = search.clientKeyword.trim().toLowerCase()
        const itemKeyword = search.itemKeyword.trim().toLowerCase()

        return transactions.filter((transaction) => {
            if (
                search.startDate &&
                transaction.date < search.startDate
            ) {
                return false
            }

            if (
                search.endDate &&
                transaction.date > search.endDate
            ) {
                return false
            }

            if (
                search.type &&
                transaction.type !== search.type
            ) {
                return false
            }

            if (clientKeyword) {
                const clientText =
                    `${transaction.clientCode} ${transaction.clientName}`.toLowerCase()

                if (!clientText.includes(clientKeyword)) {
                    return false
                }
            }

            if (itemKeyword) {
                const itemText =
                    `${transaction.itemCode} ${transaction.itemName}`.toLowerCase()

                if (!itemText.includes(itemKeyword)) {
                    return false
                }
            }

            return true
        })
    }, [transactions, search])

    const resetSearch = () => {
        setSearch(emptySearch)
    }

    const cancelTransaction = async (transaction) => {
        setMessage('')

        try {
            const result =
                await window.inventoryApi.cancelTransaction(
                    transaction.transactionNo,
                    ''
                )

            if (result.stockWarning) {
                setMessage(
                    `${transaction.transactionNo}번 거래를 취소했습니다. 현재재고가 ${result.currentStock}개로 음수입니다.`
                )
            } else {
                setMessage(
                    `${transaction.transactionNo}번 거래를 취소했습니다.`
                )
            }

            loadTransactions()
        } catch (error) {
            console.error(error)

            setMessage(
                error.message ||
                '거래 취소에 실패했습니다.'
            )
        }
    }

    return (
        <div>
            <h1>입출고 조회</h1>

            <div>
                <label>
                    시작일
                    <input
                        type="date"
                        name="startDate"
                        value={search.startDate}
                        onChange={changeSearch}
                    />
                </label>

                <label>
                    종료일
                    <input
                        type="date"
                        name="endDate"
                        value={search.endDate}
                        onChange={changeSearch}
                    />
                </label>

                <label>
                    구분
                    <select
                        name="type"
                        value={search.type}
                        onChange={changeSearch}
                    >
                        <option value="">전체</option>
                        <option value="입고">입고</option>
                        <option value="출고">출고</option>
                        <option value="출고반입">
                            출고반입
                        </option>
                    </select>
                </label>

                <input
                    name="clientKeyword"
                    value={search.clientKeyword}
                    onChange={changeSearch}
                    placeholder="거래처 코드 또는 거래처명"
                />

                <input
                    name="itemKeyword"
                    value={search.itemKeyword}
                    onChange={changeSearch}
                    placeholder="품목 코드 또는 품목명"
                />

                <button
                    type="button"
                    onClick={resetSearch}
                >
                    검색 초기화
                </button>

                <button
                    type="button"
                    onClick={loadTransactions}
                >
                    새로고침
                </button>
            </div>

            {message && <p>{message}</p>}

            <p>
                전체 {transactions.length}건 /
                검색 결과 {filteredTransactions.length}건
            </p>

            <table>
                <thead>
                    <tr>
                        <th>거래번호</th>
                        <th>일자</th>
                        <th>구분</th>
                        <th>거래처코드</th>
                        <th>거래처명</th>
                        <th>품목코드</th>
                        <th>품목명</th>
                        <th>수량</th>
                        <th>단가</th>
                        <th>공급가액</th>
                        <th>부가세</th>
                        <th>합계</th>
                        <th>취소여부</th>
                        <th>관리</th>
                    </tr>
                </thead>

                <tbody>
                    {filteredTransactions.map(
                        (transaction) => (
                            <tr key={transaction.transactionNo}>
                                <td>
                                    {transaction.transactionNo}
                                </td>

                                <td>
                                    {transaction.date}
                                </td>

                                <td>
                                    {transaction.type}
                                </td>

                                <td>
                                    {transaction.clientCode}
                                </td>

                                <td>
                                    {transaction.clientName}
                                </td>

                                <td>
                                    {transaction.itemCode}
                                </td>

                                <td>
                                    {transaction.itemName}
                                </td>

                                <td>
                                    {transaction.quantity}
                                </td>

                                <td>
                                    {transaction.unitPrice}
                                </td>

                                <td>
                                    {transaction.supplyAmount}
                                </td>

                                <td>
                                    {transaction.vat}
                                </td>

                                <td>
                                    {transaction.totalAmount}
                                </td>

                                <td>
                                    {transaction.canceled}
                                </td>

                                <td>
                                    {transaction.canceled === 'Y' ? (
                                        '취소됨'
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                cancelTransaction(transaction)
                                            }
                                        >
                                            취소
                                        </button>
                                    )}
                                </td>
                            </tr>
                        )
                    )}
                </tbody>
            </table>
        </div>
    )
}

export default TransactionList