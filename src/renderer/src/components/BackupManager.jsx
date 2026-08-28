import {
  useCallback,
  useEffect,
  useState
} from 'react'

function BackupManager() {
  const [backups, setBackups] =
    useState([])

  const [message, setMessage] =
    useState('')

  const [settings, setSettings] = useState({
    autoBackup: false,
    autoCleanup: false
  })

  const loadBackups =
    useCallback(() => {
      window.inventoryApi
        .getBackups()
        .then(setBackups)
        .catch((error) => {
          console.error(error)

          setMessage(
            '백업 목록을 불러오지 못했습니다.'
          )
        })
    }, [])

  const loadSettings = useCallback(() => {
    window.inventoryApi
      .getBackupSettings()
      .then(setSettings)
      .catch((error) => {
        console.error(error)
      })
  }, [])

  useEffect(() => {
    loadBackups()
    loadSettings()
  }, [loadBackups, loadSettings])

  const createBackup = async () => {
    setMessage('')

    try {
      const result =
        await window.inventoryApi
          .createBackup()

      setMessage(
        `백업을 생성했습니다: ${result.fileName}`
      )

      loadBackups()
    } catch (error) {
      console.error(error)

      setMessage(
        error.message ||
        '백업 생성에 실패했습니다.'
      )
    }
  }

  const restoreBackup =
    async (backup) => {
      setMessage('')

      try {
        const result =
          await window.inventoryApi
            .restoreBackup(
              backup.fileName
            )

        setMessage(
          [
            `${backup.fileName} 파일로 복원했습니다.`,
            result.beforeRestoreBackupFileName
              ? `복원 전 데이터도 ${result.beforeRestoreBackupFileName} 파일로 백업했습니다.`
              : ''
          ]
            .filter(Boolean)
            .join(' ')
        )

        loadBackups()
      } catch (error) {
        console.error(error)

        setMessage(
          error.message ||
          '백업 복원에 실패했습니다.'
        )
      }
    }

  const formatDateTime = (value) => {
    if (!value) {
      return ''
    }

    return new Date(value)
      .toLocaleString()
  }

  const changeSetting = async (e) => {
  const { name, checked } = e.target

  const newSettings = {
      ...settings,
      [name]: checked
    }

    try {
      const result =
        await window.inventoryApi
          .saveBackupSettings(newSettings)

      setSettings({
        autoBackup: result.autoBackup,
        autoCleanup: result.autoCleanup
      })

      setMessage('백업 설정을 저장했습니다.')
    } catch (error) {
      console.error(error)

      setMessage(
        error.message ||
        '백업 설정 저장에 실패했습니다.'
      )
    }
  }

  const openBackupFolder = async () => {
    try {
      await window.inventoryApi
        .openBackupFolder()
    } catch (error) {
      console.error(error)

      setMessage(
        '백업 폴더를 열지 못했습니다.'
      )
    }
  }

  return (
    <div>
      <h1>백업 및 복원</h1>

      <div>
        <button
          type="button"
          onClick={createBackup}
        >
          지금 백업하기
        </button>

        <button
          type="button"
          onClick={openBackupFolder}
        >
          백업 폴더 열기
        </button>
      </div>

      <div>
        <label>
          <input
            type="checkbox"
            name="autoBackup"
            checked={settings.autoBackup}
            onChange={changeSetting}
          />
          자동 백업 사용
        </label>

        <label>
          <input
            type="checkbox"
            name="autoCleanup"
            checked={settings.autoCleanup}
            onChange={changeSetting}
          />
          오래된 백업 자동 정리
        </label>
      </div>

      {message && <p>{message}</p>}

      <p>
        백업 파일 {backups.length}개
      </p>

      <table>
        <thead>
          <tr>
            <th>백업 파일</th>
            <th>생성일시</th>
            <th>크기</th>
            <th>관리</th>
          </tr>
        </thead>

        <tbody>
          {backups.map((backup) => (
            <tr key={backup.fileName}>
              <td>
                {backup.fileName}
              </td>

              <td>
                {formatDateTime(
                  backup.modifiedAt
                )}
              </td>

              <td>
                {backup.size}
              </td>

              <td>
                <button
                  type="button"
                  onClick={() =>
                    restoreBackup(backup)
                  }
                >
                  복원
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default BackupManager