import { useState } from 'react'

function ExistingExcelImporter() {
  const [result, setResult] =
    useState(null)

  const [message, setMessage] =
    useState('')

  const [messageType, setMessageType] =
    useState('info')

  const [loading, setLoading] =
    useState(false)

  const importExcel = async () => {
    const confirmed =
      window.confirm(
        [
          '기존 Excel 데이터를 가져오시겠습니까?',
          '',
          '현재 사용 중인 재고관리 데이터는 가져오기 전 자동으로 백업됩니다.',
          '선택한 원본 Excel 파일은 수정하지 않습니다.'
        ].join('\n')
      )

    if (!confirmed) {
      return
    }

    setMessage('')
    setResult(null)
    setLoading(true)

    try {
      const response =
        await window.inventoryApi
          .importExistingExcel()

      if (response.canceled) {
        setMessageType('info')

        setMessage(
          'Excel 가져오기를 취소했습니다.'
        )

        return
      }

      setResult(response)

      setMessageType('success')

      setMessage(
        '기존 Excel 가져오기가 완료되었습니다.'
      )
    } catch (error) {
      console.error(error)

      setMessageType('error')

      setMessage(
        error.message ||
        '기존 Excel 가져오기에 실패했습니다.'
      )
    } finally {
      setLoading(false)
    }
  }

  const reloadScreen = () => {
    window.location.reload()
  }

  const missingItemCodes =
    result?.missingItemCodes ?? []

  const missingClientCodes =
    result?.missingClientCodes ?? []

  const transactionTypeCounts =
    result?.transactionTypeCounts ?? {}

  return (
    <div className="excel-import-page">
      <div className="page-header">
        <div>
          <h1>기존 Excel 가져오기</h1>

          <p>
            기존 재고관리 프로그램의 Excel 데이터를
            현재 프로그램 형식으로 변환합니다.
          </p>
        </div>
      </div>

      <div className="excel-import-card">
        <div className="excel-import-card-header">
          <h2>기존 데이터 가져오기</h2>

          <p>
            기존 재고관리 Excel 파일(.xlsx, .xlsm)을
            선택해주세요.
          </p>
        </div>

        <div className="excel-import-warning">
          <strong>
            가져오기 전에 확인해주세요
          </strong>

          <div>
            현재 사용 중인 데이터가 있다면 가져오기 전에
            자동으로 별도 백업합니다.
          </div>

          <div>
            선택한 기존 Excel 원본 파일은 수정하지 않습니다.
          </div>

          <div>
            품목, 거래처, 입출고내역을 새 데이터 형식으로
            변환하여 저장합니다.
          </div>
        </div>

        <div className="excel-import-source-info">
          <div>
            <span>지원 파일</span>

            <strong>
              Excel .xlsx / .xlsm
            </strong>
          </div>

          <div>
            <span>변환 대상</span>

            <strong>
              품목 · 거래처 · 입출고내역
            </strong>
          </div>

          <div>
            <span>원본 파일</span>

            <strong>
              변경하지 않음
            </strong>
          </div>
        </div>

        <button
          type="button"
          className="excel-import-button"
          onClick={importExcel}
          disabled={loading}
        >
          {loading
            ? '데이터를 가져오는 중...'
            : '기존 Excel 선택 및 가져오기'}
        </button>
      </div>

      {message && (
        <div
          className={
            `excel-import-message ${messageType}`
          }
        >
          {message}
        </div>
      )}

      {result && (
        <div className="excel-import-result-card">
          <div className="excel-import-result-header">
            <div>
              <h2>가져오기 결과</h2>

              <p>
                기존 Excel 데이터를 정상적으로
                변환했습니다.
              </p>
            </div>
          </div>

          <div className="excel-import-summary">
            <div>
              <span>품목</span>

              <strong>
                {result.itemCount ?? 0}개
              </strong>
            </div>

            <div>
              <span>매출거래처</span>

              <strong>
                {result.salesClientCount ?? 0}개
              </strong>
            </div>

            <div>
              <span>매입거래처</span>

              <strong>
                {result.purchaseClientCount ?? 0}개
              </strong>
            </div>

            <div>
              <span>입출고내역</span>

              <strong>
                {result.transactionCount ?? 0}건
              </strong>
            </div>
          </div>

          <div className="excel-import-detail-grid">
            <div className="excel-import-detail-item">
              <span>
                마지막 거래번호
              </span>

              <strong>
                {result.maxTransactionNo ?? '-'}
              </strong>
            </div>

            <div className="excel-import-detail-item">
              <span>
                입고
              </span>

              <strong>
                {transactionTypeCounts['입고'] ?? 0}건
              </strong>
            </div>

            <div className="excel-import-detail-item">
              <span>
                출고
              </span>

              <strong>
                {transactionTypeCounts['출고'] ?? 0}건
              </strong>
            </div>

            <div className="excel-import-detail-item">
              <span>
                출고반입
              </span>

              <strong>
                {transactionTypeCounts['출고반입'] ?? 0}건
              </strong>
            </div>

            <div className="excel-import-detail-item">
              <span>
                출고반입 수량 보정
              </span>

              <strong>
                {result.normalizedReturnCount ?? 0}건
              </strong>
            </div>
          </div>

          {result.beforeImportBackupFileName && (
            <div className="excel-import-backup-info">
              <span>
                가져오기 전 데이터 백업
              </span>

              <strong>
                {
                  result.beforeImportBackupFileName
                }
              </strong>
            </div>
          )}

          {(
            missingItemCodes.length > 0 ||
            missingClientCodes.length > 0
          ) && (
            <div className="excel-import-problems">
              <div className="excel-import-problems-title">
                확인이 필요한 데이터
              </div>

              {missingItemCodes.length > 0 && (
                <div className="excel-import-problem-box">
                  <strong>
                    품목 목록에 없는 거래 품목 코드
                  </strong>

                  <p>
                    거래내역에는 존재하지만
                    품목 마스터에서 찾을 수 없는 코드가
                    {missingItemCodes.length}개 있습니다.
                  </p>

                  <div className="excel-import-code-list">
                    {missingItemCodes.map(
                      (code) => (
                        <span key={code}>
                          {code}
                        </span>
                      )
                    )}
                  </div>
                </div>
              )}

              {missingClientCodes.length > 0 && (
                <div className="excel-import-problem-box">
                  <strong>
                    거래처 목록에 없는 거래처 코드
                  </strong>

                  <p>
                    거래내역에는 존재하지만
                    거래처 마스터에서 찾을 수 없는 코드가
                    {missingClientCodes.length}개 있습니다.
                  </p>

                  <div className="excel-import-code-list">
                    {missingClientCodes.map(
                      (code) => (
                        <span key={code}>
                          {code}
                        </span>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {(
            missingItemCodes.length === 0 &&
            missingClientCodes.length === 0
          ) && (
            <div className="excel-import-clean-result">
              품목 및 거래처 코드 누락 없이
              정상적으로 가져왔습니다.
            </div>
          )}

          <div className="excel-import-result-actions">
            <button
              type="button"
              className="excel-import-apply-button"
              onClick={reloadScreen}
            >
              가져온 데이터 화면에 반영
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ExistingExcelImporter