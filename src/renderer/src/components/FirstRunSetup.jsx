import { functionProp } from '../utils/propTypes'
import { useRef, useState } from 'react'

function FirstRunSetup({ onComplete }) {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const running = useRef(false)

  const createNewData = async () => {
    if (running.current) return
    running.current = true
    setMessage('')
    setLoading(true)

    try {
      const result = await window.inventoryApi.createDataFile()

      if (result.success) {
        await onComplete()
      }
    } catch (error) {
      console.error(error)

      setMessage(error.message || '새 데이터 파일을 만들지 못했습니다.')
    } finally {
      running.current = false
      setLoading(false)
    }
  }

  const importExistingExcel = async () => {
    if (running.current) return
    running.current = true
    setMessage('')
    setLoading(true)

    try {
      const result = await window.inventoryApi.importExistingExcel()

      if (result.canceled) {
        setMessage('Excel 가져오기를 취소했습니다.')
        return
      }

      if (result.success) {
        await onComplete()
      }
    } catch (error) {
      console.error(error)

      setMessage(error.message || '기존 Excel을 가져오지 못했습니다.')
    } finally {
      running.current = false
      setLoading(false)
    }
  }

  return (
    <div className="setup-page">
      <div className="setup-card">
        <h1>재고관리 프로그램</h1>

        <h2>처음 사용을 시작합니다</h2>

        <p>기존 재고관리 Excel이 있다면 가져오기를 선택해주세요.</p>

        <div className="setup-options">
          <button type="button" onClick={importExistingExcel} disabled={loading}>
            <strong>기존 Excel 가져오기</strong>
            <span>사용하던 재고 데이터를 가져와 계속 사용합니다.</span>
          </button>

          <button type="button" onClick={createNewData} disabled={loading}>
            <strong>새로 시작</strong>
            <span>빈 데이터 파일로 처음부터 시작합니다.</span>
          </button>
        </div>
        {loading && <p>처리 중입니다.</p>}

        {message && (
          <p className="backup-message error" role="alert">
            {message}
          </p>
        )}
      </div>
    </div>
  )
}

FirstRunSetup.propTypes = { onComplete: functionProp }

export default FirstRunSetup
