import { useEffect, useRef, useState } from 'react'
import { objectProp, functionProp } from '../utils/propTypes'

function DataRecovery({ status, onComplete }) {
  const [backups, setBackups] = useState([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const running = useRef(false)
  useEffect(() => {
    window.inventoryApi
      .getBackups()
      .then(setBackups)
      .catch(() => setMessage('백업 목록을 확인하지 못했습니다. 다시 확인해 주세요.'))
  }, [])
  const run = async (action) => {
    if (running.current) return
    running.current = true
    setBusy(true)
    setMessage('')
    try {
      await action()
      await onComplete()
    } catch (error) {
      setMessage(error.message || '복구하지 못했습니다. 다른 데이터를 확인해 주세요.')
    } finally {
      running.current = false
      setBusy(false)
    }
  }
  return (
    <div className="setup-page">
      <div className="setup-card">
        <h1>재고 데이터 확인</h1>
        <p>
          데이터를 정상적으로 열지 못했습니다. 복구할 데이터를 선택하거나 Excel 창을 닫은 뒤 다시
          확인해 주세요.
        </p>
        <ul className="data-issues">
          {(status.errors || []).slice(0, 10).map((text, i) => (
            <li key={i}>{text}</li>
          ))}
        </ul>
        <div className="recovery-options">
          {(status.candidates || []).map((candidate) => (
            <button
              type="button"
              disabled={busy}
              key={candidate.kind}
              onClick={() => run(() => window.inventoryApi.recoverData(candidate.kind))}
            >
              <strong>{candidate.label}로 복구</strong>
              <span>
                {new Date(candidate.modifiedAt).toLocaleString('ko-KR')} · 거래{' '}
                {candidate.transactionCount}건
              </span>
            </button>
          ))}
        </div>
        <details>
          <summary>다른 백업에서 복구</summary>
          {backups.length === 0 && <p>저장된 백업이 없습니다.</p>}
          {backups.map((backup) => (
            <div className="recovery-backup" key={backup.fileName}>
              <span>{backup.fileName}</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => window.inventoryApi.restoreBackup(backup.fileName))}
              >
                이 백업으로 복구
              </button>
            </div>
          ))}
        </details>
        <button type="button" disabled={busy} onClick={() => run(() => Promise.resolve())}>
          다시 확인
        </button>
        {busy && <p role="status">데이터를 확인하고 있습니다.</p>}
        {message && (
          <p className="backup-message error" role="alert">
            {message}
          </p>
        )}
        <p>
          복구 전 데이터와 복구용 사본은 별도로 보존합니다. 복구 가능한 파일이 없다면 데이터 파일을
          보관한 뒤 개발 담당자에게 문의해 주세요.
        </p>
      </div>
    </div>
  )
}
DataRecovery.propTypes = { status: objectProp, onComplete: functionProp }
export default DataRecovery
