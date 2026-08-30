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

  const [messageType, setMessageType] =
    useState('info')

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

          setMessageType('error')
          setMessage(
            '백업 목록을 불러오지 못했습니다.'
          )
        })
    }, [])

  const loadSettings =
    useCallback(() => {
      window.inventoryApi
        .getBackupSettings()
        .then(setSettings)
        .catch((error) => {
          console.error(error)

          setMessageType('error')
          setMessage(
            '백업 설정을 불러오지 못했습니다.'
          )
        })
    }, [])

  useEffect(() => {
    loadBackups()
    loadSettings()
  }, [
    loadBackups,
    loadSettings
  ])

  const createBackup = async () => {
    setMessage('')

    try {
      const result =
        await window.inventoryApi
          .createBackup()

      setMessageType('success')

      setMessage(
        `백업을 생성했습니다: ${result.fileName}`
      )

      loadBackups()
    } catch (error) {
      console.error(error)

      setMessageType('error')

      setMessage(
        error.message ||
        '백업 생성에 실패했습니다.'
      )
    }
  }

  const restoreBackup =
    async (backup) => {
      const confirmed =
        window.confirm(
          [
            '선택한 백업으로 데이터를 복원하시겠습니까?',
            '',
            backup.fileName,
            '',
            '현재 데이터는 복원 전에 자동으로 백업됩니다.'
          ].join('\n')
        )

      if (!confirmed) {
        return
      }

      setMessage('')

      try {
        const result =
          await window.inventoryApi
            .restoreBackup(
              backup.fileName
            )

        setMessageType('success')

        setMessage(
          [
            `${backup.fileName} 파일로 복원했습니다.`,

            result.beforeRestoreBackupFileName
              ? `복원 전 데이터는 ${result.beforeRestoreBackupFileName} 파일로 백업했습니다.`
              : ''
          ]
            .filter(Boolean)
            .join(' ')
        )

        loadBackups()
      } catch (error) {
        console.error(error)

        setMessageType('error')

        setMessage(
          error.message ||
          '백업 복원에 실패했습니다.'
        )
      }
    }

  const formatDateTime = (value) => {
    if (!value) {
      return '-'
    }

    return new Date(value)
      .toLocaleString()
  }

  const formatFileSize = (bytes) => {
    const size = Number(bytes)

    if (
      !Number.isFinite(size) ||
      size < 0
    ) {
      return '-'
    }

    if (size < 1024) {
      return `${size} B`
    }

    if (size < 1024 * 1024) {
      return `${(
        size / 1024
      ).toFixed(1)} KB`
    }

    return `${(
      size /
      (1024 * 1024)
    ).toFixed(1)} MB`
  }

  const getBackupType = (fileName) => {
    if (
      fileName.startsWith(
        'before_restore_'
      )
    ) {
      return {
        label: '복원 전',
        className: 'before-restore'
      }
    }

    if (
      fileName.startsWith(
        'before_import_'
      )
    ) {
      return {
        label: '가져오기 전',
        className: 'before-import'
      }
    }

    if (
      fileName.startsWith(
        'auto_'
      )
    ) {
      return {
        label: '자동',
        className: 'auto'
      }
    }

    return {
      label: '수동',
      className: 'manual'
    }
  }

  const changeSetting = async (e) => {
    const {
      name,
      checked
    } = e.target

    const newSettings = {
      ...settings,
      [name]: checked
    }

    try {
      const result =
        await window.inventoryApi
          .saveBackupSettings(
            newSettings
          )

      setSettings({
        autoBackup:
          result.autoBackup,

        autoCleanup:
          result.autoCleanup
      })

      setMessageType('success')

      setMessage(
        '백업 설정을 저장했습니다.'
      )
    } catch (error) {
      console.error(error)

      setMessageType('error')

      setMessage(
        error.message ||
        '백업 설정 저장에 실패했습니다.'
      )
    }
  }

  const openBackupFolder =
    async () => {
      try {
        await window.inventoryApi
          .openBackupFolder()
      } catch (error) {
        console.error(error)

        setMessageType('error')

        setMessage(
          '백업 폴더를 열지 못했습니다.'
        )
      }
    }

  return (
    <div className="backup-page">
      <div className="page-header">
        <div>
          <h1>백업 및 복원</h1>

          <p>
            재고관리 데이터를 안전하게 백업하고
            이전 상태로 복원합니다.
          </p>
        </div>
      </div>

      <div className="backup-top-grid">
        <div className="backup-card">
          <div className="backup-card-header">
            <div>
              <h2>수동 백업</h2>

              <p>
                현재 데이터를 즉시 별도 파일로 저장합니다.
              </p>
            </div>
          </div>

          <div className="backup-main-actions">
            <button
              type="button"
              className="backup-create-button"
              onClick={createBackup}
            >
              지금 백업하기
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={openBackupFolder}
            >
              백업 폴더 열기
            </button>
          </div>

          <div className="backup-info-box">
            백업 파일은 재고관리 프로그램 데이터 폴더의
            backup 폴더에 저장됩니다.
          </div>
        </div>

        <div className="backup-card">
          <div className="backup-card-header">
            <div>
              <h2>자동 백업 설정</h2>

              <p>
                업무 중 데이터 손실에 대비합니다.
              </p>
            </div>
          </div>

          <div className="backup-setting-list">
            <label className="backup-setting-item">
              <div>
                <strong>
                  자동 백업 사용
                </strong>

                <span>
                  하루 최초 입출고 등록 전에
                  한 번 자동으로 백업합니다.
                </span>
              </div>

              <input
                type="checkbox"
                name="autoBackup"
                checked={
                  settings.autoBackup
                }
                onChange={
                  changeSetting
                }
              />
            </label>

            <label className="backup-setting-item">
              <div>
                <strong>
                  오래된 백업 자동 정리
                </strong>

                <span>
                  최근 백업 30개를 남기고
                  오래된 파일을 정리합니다.
                </span>
              </div>

              <input
                type="checkbox"
                name="autoCleanup"
                checked={
                  settings.autoCleanup
                }
                onChange={
                  changeSetting
                }
              />
            </label>
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`backup-message ${messageType}`}
        >
          {message}
        </div>
      )}

      <div className="backup-list-card">
        <div className="backup-list-header">
          <div>
            <h2>백업 파일</h2>

            <p>
              총 {backups.length}개의
              백업이 있습니다.
            </p>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={loadBackups}
          >
            목록 새로고침
          </button>
        </div>

        <div className="backup-warning">
          복원을 실행하면 선택한 시점의 데이터로
          변경됩니다. 현재 데이터는 복원 직전에
          자동 백업됩니다.
        </div>

        <div className="backup-table-wrapper">
          <table className="backup-table">
            <thead>
              <tr>
                <th>종류</th>
                <th>백업 파일</th>
                <th>생성일시</th>
                <th>크기</th>
                <th>관리</th>
              </tr>
            </thead>

            <tbody>
              {backups.length === 0 ? (
                <tr>
                  <td
                    colSpan="5"
                    className="empty-table-cell"
                  >
                    생성된 백업 파일이 없습니다.
                  </td>
                </tr>
              ) : (
                backups.map(
                  (backup) => {
                    const backupType =
                      getBackupType(
                        backup.fileName
                      )

                    return (
                      <tr
                        key={
                          backup.fileName
                        }
                      >
                        <td>
                          <span
                            className={
                              `backup-type-badge ${backupType.className}`
                            }
                          >
                            {
                              backupType.label
                            }
                          </span>
                        </td>

                        <td className="backup-file-name">
                          {
                            backup.fileName
                          }
                        </td>

                        <td>
                          {formatDateTime(
                            backup.modifiedAt
                          )}
                        </td>

                        <td>
                          {formatFileSize(
                            backup.size
                          )}
                        </td>

                        <td>
                          <button
                            type="button"
                            className="restore-button"
                            onClick={() =>
                              restoreBackup(
                                backup
                              )
                            }
                          >
                            복원
                          </button>
                        </td>
                      </tr>
                    )
                  }
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default BackupManager