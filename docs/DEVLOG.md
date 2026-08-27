# 개발 기록

## 2026-08-27 - 초기 데이터 처리 구조 구현

### 개발 환경
- Electron
- React
- electron-vite
- JavaScript
- SheetJS xlsx 0.20.3
- Windows 환경

---

## 구현 완료

### 1. Electron + React 기본 프로젝트 구성

- electron-vite 기반 프로젝트 생성
- Electron Main / Preload / React Renderer 구조 확인
- 개발 환경 정상 실행 확인

---

### 2. Excel 파일 읽기

기존 Excel VBA 프로그램 파일을 개발용 legacy 데이터로 사용한다.

개발용 파일:

`local-data/재고관리 프로그램_v1.3.xlsm`

Electron Main에서 SheetJS를 사용하여 Excel 파일을 읽도록 구현했다.

React에서는 Excel 파일에 직접 접근하지 않고 다음 구조를 사용한다.

React Renderer  
→ window.inventoryApi  
→ preload  
→ IPC  
→ Electron Main  
→ Excel

---

### 3. 기존 품목 데이터 조회

legacy Excel 파일의 `품목` 시트를 읽어 React 화면에 표시하는 기능을 구현했다.

품목 구조:

- 구분
- 코드
- 품목명
- 기초재고단가
- 매입단가
- 매출단가
- 기초재고량
- 현재재고량
- 단위
- 규격
- 브랜드명

Electron 내부에서는 다음과 같은 객체 구조로 변환한다.

```js
{
  type,
  code,
  name,
  initialPrice,
  purchasePrice,
  salesPrice,
  initialStock,
  currentStock,
  unit,
  spec,
  brand
}
```

---

### 4. 새 데이터 파일 생성

앞으로 프로그램에서 실제로 사용할 데이터 파일을 생성하는 기능을 구현했다.

파일:

`local-data/재고관리데이터.xlsx`

생성되는 시트:

- 입출고내역
- 품목
- 매출거래처
- 매입거래처
- 설정

이미 파일이 존재하는 경우 기존 파일을 덮어쓰지 않는다.

---

### 5. Legacy Master Data 가져오기

기존 Excel VBA 파일에서 다음 데이터를 새 데이터 파일로 가져오는 기능을 구현했다.

- 품목
- 매출거래처
- 매입거래처

입출고내역은 아직 가져오지 않는다.

가져오기 결과:

- 품목: 64개
- 매출거래처: 67개
- 매입거래처: 6개

검증 기능:

- 필수 시트 존재 여부 확인
- 코드 없는 행 제외
- 품목 코드 중복 검사
- 매출거래처 코드 중복 검사
- 매입거래처 코드 중복 검사

현재재고량과 기초재고량은 legacy 데이터를 그대로 유지한다.

---

### 6. 데이터 파일 안전 저장

Master Data 가져오기 시 새 데이터 파일을 바로 수정하지 않고 임시 파일을 사용한다.

재고관리데이터.xlsx  
→ 메모리에서 수정  
→ 재고관리데이터.tmp.xlsx 생성  
→ 임시 파일 재읽기 검증  
→ 재고관리데이터.xlsx 교체  
→ 임시 파일 삭제

legacy `.xlsm` 원본은 수정하지 않는다.

검증 결과 legacy 파일의 작업 전후 SHA256 해시가 동일함을 확인했다.

---

### 7. 현재 IPC API

현재 React에서 사용할 수 있는 API:

```js
window.inventoryApi.getItems()
window.inventoryApi.createDataFile()
window.inventoryApi.importLegacyMasterData()
```

---

## 현재 데이터 흐름

legacy Excel  
`재고관리 프로그램_v1.3.xlsm`  
→ import  
→ `재고관리데이터.xlsx`  
→ Electron Main  
→ IPC  
→ Preload  
→ `window.inventoryApi`  
→ React Renderer

---

## 현재 테스트 결과

- `npm run lint` 통과
- `npm run dev` 정상 실행
- 품목 64개 import 확인
- 매출거래처 67개 import 확인
- 매입거래처 6개 import 확인
- 현재재고량 legacy 데이터와 샘플 비교 완료
- 임시 `.tmp.xlsx` 파일 정상 삭제 확인
- legacy `.xlsm` 파일 원본 변경 없음
- `getItems()`가 새 `재고관리데이터.xlsx`를 읽도록 전환 완료

---

## 다음 작업 예정

- legacy 입출고내역 import
- 기존 거래 이력 구조 분석
- 새 입출고내역 구조로 변환
- 거래번호 정책 적용
- 취소 데이터 처리 방식 검토
