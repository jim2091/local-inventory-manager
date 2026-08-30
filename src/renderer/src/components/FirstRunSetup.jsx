import { useState } from 'react'

function FirstRunSetup({ onComplete }) {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const createNewData = async () => {
    setMessage('')
    setLoading(true)

    try {
      const result =
        await window.inventoryApi.createDataFile()

      if (result.success) {
        onComplete()
      }
    } catch (error) {
      console.error(error)

      setMessage(
        error.message ||
        '새 데이터 파일을 만들지 못했습니다.'
      )
    } finally {
      setLoading(false)
    }
  }

  const importExistingExcel = async () => {
    setMessage('')
    setLoading(true)

    try {
      const result =
        await window.inventoryApi.importExistingExcel()

      if (result.canceled) {
        setMessage(
          'Excel 가져오기를 취소했습니다.'
        )
        return
      }

      if (result.success) {
        onComplete()
      }
    } catch (error) {
      console.error(error)

      setMessage(
        error.message ||
        '기존 Excel을 가져오지 못했습니다.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1>재고관리 프로그램</h1>

      <h2>처음 사용을 시작합니다</h2>

      <p>
        기존 재고관리 Excel이 있다면
        가져오기를 선택해주세요.
      </p>

      <button
        type="button"
        onClick={importExistingExcel}
        disabled={loading}
      >
        기존 Excel 가져오기
      </button>

      <button
        type="button"
        onClick={createNewData}
        disabled={loading}
      >
        새로 시작
      </button>

      {loading && (
        <p>처리 중입니다.</p>
      )}

      {message && (
        <p>{message}</p>
      )}
    </div>
  )
}

export default FirstRunSetup