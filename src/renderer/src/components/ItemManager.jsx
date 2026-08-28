import { useCallback, useEffect, useState } from 'react'

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
    const [items, setItems] = useState([])
    const [form, setForm] = useState(emptyForm)
    const [message, setMessage] = useState('')
    const [selectedCode, setSelectedCode] = useState('')

    const loadItems = useCallback(() => {
        window.inventoryApi
            .getItems()
            .then(setItems)
            .catch((error) => {
                console.error(error)
                setMessage('품목 목록을 불러오지 못했습니다.')
            })
    }, [])

    useEffect(() => {
        loadItems()
    }, [loadItems])

    const changeForm = (e) => {
        const { name, value } = e.target

        setForm((prev) => ({
            ...prev,
            [name]: value
        }))
    }

    const buildRequestData = () => ({
        ...form,
        initialPrice:
            form.initialPrice === '' ? '' : Number(form.initialPrice),
        purchasePrice:
            form.purchasePrice === '' ? '' : Number(form.purchasePrice),
        salesPrice:
            form.salesPrice === '' ? '' : Number(form.salesPrice),
        initialStock:
            form.initialStock === '' ? '' : Number(form.initialStock),
        currentStock:
            form.currentStock === '' ? '' : Number(form.currentStock)
    })

    const resetForm = () => {
        setForm(emptyForm)
        setSelectedCode('')
    }

    const addItem = async () => {
        setMessage('')

        try {
            await window.inventoryApi.addItem(buildRequestData())

            setMessage('품목을 등록했습니다.')
            resetForm()
            loadItems()
        } catch (error) {
            console.error(error)
            setMessage(error.message || '품목 등록에 실패했습니다.')
        }
    }

    const selectItem = (item) => {
        setSelectedCode(item.code)

        setForm({
            type: item.type ?? '',
            code: item.code ?? '',
            name: item.name ?? '',
            initialPrice: item.initialPrice ?? '',
            purchasePrice: item.purchasePrice ?? '',
            salesPrice: item.salesPrice ?? '',
            initialStock: item.initialStock ?? '',
            currentStock: item.currentStock ?? '',
            unit: item.unit ?? '',
            spec: item.spec ?? '',
            brand: item.brand ?? ''
        })

        setMessage('')
    }

    const updateItem = async () => {
        setMessage('')

        try {
            await window.inventoryApi.updateItem(
                selectedCode,
                buildRequestData()
            )

            setMessage('품목을 수정했습니다.')
            resetForm()
            loadItems()
        } catch (error) {
            console.error(error)
            setMessage(error.message || '품목 수정에 실패했습니다.')
        }
    }

    const deleteItem = async (code) => {
        setMessage('')

        try {
            await window.inventoryApi.deleteItem(code)

            setMessage('품목을 삭제했습니다.')

            if (selectedCode === code) {
                resetForm()
            }

            loadItems()
        } catch (error) {
            console.error(error)
            setMessage(error.message || '품목 삭제에 실패했습니다.')
        }
    }

    return (
        <div>
            <h1>품목 관리</h1>

            <div>
                <h2>{selectedCode ? '품목 수정' : '품목 등록'}</h2>

                <div>
                    <input
                        name="type"
                        value={form.type}
                        onChange={changeForm}
                        placeholder="구분"
                    />

                    <input
                        name="code"
                        value={form.code}
                        onChange={changeForm}
                        placeholder="코드"
                    />

                    <input
                        name="name"
                        value={form.name}
                        onChange={changeForm}
                        placeholder="품목명"
                    />

                    <input
                        type="number"
                        name="initialPrice"
                        value={form.initialPrice}
                        onChange={changeForm}
                        placeholder="기초재고단가"
                    />

                    <input
                        type="number"
                        name="purchasePrice"
                        value={form.purchasePrice}
                        onChange={changeForm}
                        placeholder="매입단가"
                    />

                    <input
                        type="number"
                        name="salesPrice"
                        value={form.salesPrice}
                        onChange={changeForm}
                        placeholder="매출단가"
                    />

                    <input
                        type="number"
                        name="initialStock"
                        value={form.initialStock}
                        onChange={changeForm}
                        placeholder="기초재고량"
                    />

                    <input
                        type="number"
                        name="currentStock"
                        value={form.currentStock}
                        onChange={changeForm}
                        placeholder="현재재고량"
                    />

                    <input
                        name="unit"
                        value={form.unit}
                        onChange={changeForm}
                        placeholder="단위"
                    />

                    <input
                        name="spec"
                        value={form.spec}
                        onChange={changeForm}
                        placeholder="규격"
                    />

                    <input
                        name="brand"
                        value={form.brand}
                        onChange={changeForm}
                        placeholder="브랜드명"
                    />

                    {selectedCode ? (
                        <>
                            <button type="button" onClick={updateItem}>
                                품목 수정
                            </button>

                            <button type="button" onClick={resetForm}>
                                수정 취소
                            </button>
                        </>
                    ) : (
                        <button type="button" onClick={addItem}>
                            품목 등록
                        </button>
                    )}
                </div>

                {message && <p>{message}</p>}
            </div>

            <hr />

            <div>
                <h2>품목 목록</h2>
                <p>총 {items.length}개</p>

                <button
                    type="button"
                    onClick={loadItems}
                >
                    품목 새로고침
                </button>

                <table>
                    <thead>
                        <tr>
                            <th>구분</th>
                            <th>코드</th>
                            <th>품목명</th>
                            <th>기초재고단가</th>
                            <th>매입단가</th>
                            <th>매출단가</th>
                            <th>기초재고량</th>
                            <th>현재재고량</th>
                            <th>단위</th>
                            <th>규격</th>
                            <th>브랜드명</th>
                            <th>관리</th>
                        </tr>
                    </thead>

                    <tbody>
                        {items.map((item, index) => (
                            <tr key={`${item.code}-${index}`}>
                                <td>{item.type}</td>
                                <td>{item.code}</td>
                                <td>{item.name}</td>
                                <td>{item.initialPrice}</td>
                                <td>{item.purchasePrice}</td>
                                <td>{item.salesPrice}</td>
                                <td>{item.initialStock}</td>
                                <td>{item.currentStock}</td>
                                <td>{item.unit}</td>
                                <td>{item.spec}</td>
                                <td>{item.brand}</td>

                                <td>
                                    <button
                                        type="button"
                                        onClick={() => selectItem(item)}
                                    >
                                        수정
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => deleteItem(item.code)}
                                    >
                                        삭제
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

export default ItemManager