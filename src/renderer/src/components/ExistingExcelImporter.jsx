import { useState } from 'react'

function ExistingExcelImporter() {
  const [result, setResult] =
    useState(null)

  const [message, setMessage] =
    useState('')

  const importExcel = async () => {
    setMessage('')
    setResult(null)

    try {
      const response =
        await window.inventoryApi
          .importExistingExcel()

      if (response.canceled) {
        setMessage(
          'Excel 가져오기를 취소했습니다.'
        )
        return
      }

      setResult(response)

      setMessage(
        '기존 Excel 가져오기가 완료되었습니다.'
      )
    } catch (error) {
      console.error(error)

      setMessage(
        error.message ||
        '기존 Excel 가져오기에 실패했습니다.'
      )
    }
  }

  const reloadScreen = () => {
    window.location.reload()
  }

  return (
    <div>
      <h1>기존 Excel 가져오기</h1>

      <p>
        기존 재고관리 Excel 파일을 선택하면
        새 재고관리데이터.xlsx 파일로 변환합니다.
      </p>

      <p>
        선택한 원본 Excel 파일은 수정하지 않습니다.
      </p>

      <button
        type="button"
        onClick={importExcel}
      >
        기존 Excel 선택
      </button>

      {message && (
        <p>{message}</p>
      )}

      {result && (
        <div>
          <h3>가져오기 결과</h3>

          <p>
            품목:
            {' '}
            {result.itemCount}개
          </p>

          <p>
            매출거래처:
            {' '}
            {result.salesClientCount}개
          </p>

          <p>
            매입거래처:
            {' '}
            {result.purchaseClientCount}개
          </p>

          <p>
            입출고내역:
            {' '}
            {result.transactionCount}건
          </p>

          <p>
            마지막 거래번호:
            {' '}
            {result.maxTransactionNo}
          </p>

          <p>
            출고반입 수량 정규화:
            {' '}
            {result.normalizedReturnCount}건
          </p>

          {result.beforeImportBackupFileName && (
            <p>
              가져오기 전 데이터 백업:
              {' '}
              {
                result.beforeImportBackupFileName
              }
            </p>
          )}

          {result.missingItemCodes.length > 0 && (
            <div>
              <strong>
                현재 품목 목록에 없는 거래 품목 코드
              </strong>

              <p>
                {
                  result.missingItemCodes.join(
                    ', '
                  )
                }
              </p>
            </div>
          )}

          {result.missingClientCodes.length > 0 && (
            <div>
              <strong>
                현재 거래처 목록에 없는 거래처 코드
              </strong>

              <p>
                {
                  result.missingClientCodes.join(
                    ', '
                  )
                }
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={reloadScreen}
          >
            가져온 데이터 화면에 반영
          </button>
        </div>
      )}
    </div>
  )
}

export default ExistingExcelImporter