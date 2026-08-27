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

### 2. Excel 파일 읽기
- 개발용 legacy 파일: `local-data/재고관리 프로그램_v1.3.xlsm`
- Electron Main에서 SheetJS로 Excel 파일 읽기 구현
- React에서 Excel 파일에 직접 접근하지 않고 다음 구조 사용

React Renderer  
→ `window.inventoryApi`  
→ preload  
→ IPC  
→ Electron Main  
→ Excel

### 3. 기존 품목 데이터 조회
- legacy Excel의 `품목` 시트 읽기 구현
- React 화면에 품목 목록 표시
- 한글 Excel 컬럼을 React에서 사용하기 편한 영문 key 객체로 변환

### 4. 새 데이터 파일 생성
- 실제 앱 데이터 파일: `local-data/재고관리데이터.xlsx`
- 생성 시트:
  - 입출고내역
  - 품목
  - 매출거래처
  - 매입거래처
  - 설정
- 기존 파일 존재 시 덮어쓰지 않도록 처리

### 5. Legacy Master Data 가져오기
- 기존 `.xlsm`에서 다음 데이터 이관
  - 품목 64개
  - 매출거래처 67개
  - 매입거래처 6개
- 코드 없는 행 제외
- 품목 / 매출거래처 / 매입거래처 코드 중복 검증
- 현재재고량 및 기초재고량은 legacy 값을 그대로 유지
- legacy 원본 파일은 수정하지 않음

### 6. 데이터 파일 안전 저장
Master Data import 시 임시 파일을 이용한 저장 흐름 구현

재고관리데이터.xlsx  
→ 메모리에서 수정  
→ 재고관리데이터.tmp.xlsx 저장  
→ 임시 파일 재읽기 검증  
→ 실제 데이터 파일 교체  
→ 임시 파일 삭제

### 7. 현재 IPC API
```js
window.inventoryApi.getItems()
window.inventoryApi.createDataFile()
window.inventoryApi.importLegacyMasterData()
```

---

## 2026-08-27 - Legacy 입출고내역 이관 구현

### 1. Legacy 입출고내역 전체 이관
기존 `재고관리 프로그램_v1.3.xlsm`의 `입출고내역` 시트를 읽어
`재고관리데이터.xlsx`의 `입출고내역` 시트로 변환 및 저장하는 기능 구현.

### 2. 거래 데이터 이관 결과
- legacy 거래: 289건
- import 거래: 289건
- 거래번호: 1 ~ 289
- 거래번호 중복: 없음
- 최대 거래번호: 289

거래 구분별 건수:
- 입고: 18건
- 출고: 259건
- 출고반입: 12건

### 3. 출고반입 수량 정규화
기존 VBA 구조에서 출고반입 수량이 음수로 저장되어 있던 데이터를
새 앱 정책에 맞게 양수로 변환.

- 정규화 건수: 12건
- import 후 음수 출고반입 수량: 0건
- 입고/출고 음수 수량: 0건

새 앱 정책:
- 입고 → 양수 수량 / 재고 증가
- 출고 → 양수 수량 / 재고 감소
- 출고반입 → 양수 수량 / 재고 증가

### 4. Legacy 거래 컬럼 변환
새 `입출고내역` 시트에 다음 데이터만 보존.

- 거래번호
- 일자
- 구분
- 거래처코드
- 거래처명
- 품목코드
- 품목명
- 수량
- 단가
- 공급가액
- 부가세
- 합계
- 취소여부
- 취소일시
- 취소사유

기존 주문/발주번호, 규격, 단위, 거래명세, 전표번호, 비고,
원산지 코드, 조달청 식별코드는 새 거래 구조에서 제외.

기존 거래는 모두:
- 취소여부: `N`
- 취소일시: 빈 값
- 취소사유: 빈 값

으로 초기화.

### 5. 거래 데이터 검증
import 과정에서 다음 항목 검증.

- 거래번호 존재 및 숫자 여부
- 거래번호 중복 여부
- 허용된 거래 구분인지 확인
- 거래일자 정상 여부
- 수량 숫자 여부
- 입고/출고 음수 수량 차단
- 단가 / 공급가액 / 부가세 / 합계 숫자 여부

과거 거래 금액은 재계산하지 않고 legacy 값을 그대로 보존.

### 6. Master 누락 코드 확인
과거 거래에는 존재하지만 현재 품목 master에는 없는 품목코드 11개 확인.

- SIKAG 22702 B
- 3M PN 07333
- SIKA AL SPRAY -227
- SIKAGARD 835 B
- SIKAGARD 836 G
- SIKAGARD-6250K
- 27
- PN8193
- SIKAG 22702 G
- 2463554
- 8007

현재 master에 없는 거래처 코드는 없음.

과거 거래 보존을 위해 master에 없는 코드가 있더라도 import 자체는 허용.

### 7. 안전 저장
Master import와 동일한 임시 파일 기반 저장 방식을 공통 함수로 사용.

- 기존 데이터 파일 직접 수정 최소화
- 임시 xlsx 생성 후 재읽기 검증
- 정상일 때 원본 데이터 파일 교체
- 작업 완료 후 임시 파일 삭제
- legacy `.xlsm` 원본 수정 없음

### 8. 검증 결과
- 거래 건수 일치
- 거래번호 범위 일치
- 날짜 샘플 일치
- 거래처 코드/명 샘플 일치
- 품목 코드/명 샘플 일치
- 단가/공급가/부가세/합계 샘플 일치
- legacy 파일 SHA256 작업 전후 동일
- 임시 파일 잔존 없음
- `npm run lint` 통과
- `npm run dev` 정상 기동

### 9. 현재 IPC API
```js
window.inventoryApi.getItems()
window.inventoryApi.createDataFile()
window.inventoryApi.importLegacyMasterData()
window.inventoryApi.importLegacyTransactions()
```

---

## 현재 진행 상태

Legacy Excel  
→ Master Data 이관 완료  
→ 입출고내역 이관 완료  
→ 새 `재고관리데이터.xlsx`를 실제 앱 데이터로 사용하기 위한 기반 완료

## 다음 작업 예정

1. 품목 관리 CRUD
2. 거래처 관리 CRUD
3. 입출고 등록
4. 입출고 조회
5. 거래 취소
6. 재고 검사
7. 백업 / 복원
8. Legacy 파일 선택 및 첫 실행 UX
9. 실제 Documents 경로 적용
10. Windows 설치 프로그램 패키징
