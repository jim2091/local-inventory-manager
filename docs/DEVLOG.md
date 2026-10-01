# 개발 기록

## 2026-10-01 - 관리 Modal Sticky 제거 및 Enter/ESC 조작

### 요청
- 작업지시서 14-1에 따라 품목/거래처 Modal의 sticky header/action을 제거하고 Enter 저장·ESC 닫기를 적용.

### 변경
- Modal header/action의 sticky 위치, z-index, 음수 margin 및 padding 보정을 제거하고 일반 문서 흐름으로 복원. 기존 구분선·버튼 정렬·내부 스크롤과 작은 화면 wrap 유지.
- sticky 전용 padding 변수를 제거하고 기존 24px/작은 화면 18px padding 복원.
- 두 Modal의 단일 keydown handler에서 Escape, Enter, 기존 Tab focus trap을 처리.
- create/edit의 일반 input/select에서 Enter 시 기존 등록/저장 함수 호출. IME 조합(isComposing/keyCode 229), 키 반복, busy/pendingRef, ConfirmDialog 상태를 확인하고 버튼·textarea 기본 동작은 유지.
- create/detail/edit 모두 Escape로 기존 closeModal 호출. ConfirmDialog 표시 또는 CRUD 처리 중에는 부모 Modal 닫기를 차단.
- 배경 .content 스크롤 잠금, 중복 실행 방지, 확장된 focus trap, 연속 등록과 기존 CRUD 흐름 유지. 신규 소스 파일 없음.

### 검증 및 결과물
- 변경 소스 diff를 읽어 CSS 제거 범위 및 키보드 모드·예외 조건 확인.
- 앱 실행·테스트·빌드·lint·formatter·브라우저 확인은 공통 지침에 따라 미실행. 실제 IME/키보드 및 화면 동작은 실행 검증하지 않음.
- 작업 시작/완료 시점의 기존 소스 3개 사본에 대한 git diff --no-index 출력만 docs/LAST_CHANGE.diff에 저장. before/after 경로로 표시되며 이전 미커밋 변경과 로그는 제외.

---

## 2026-10-01 - 품목/거래처 Modal 공통 UX 마감

### 요청
- 작업지시서 14에 따라 두 관리 Modal의 배경 스크롤, header/action 가시성, 중복 제출 및 키보드 접근성을 보완.

### 변경
- Modal 상태 클래스를 두 페이지에 부여하고 `.content:has(...)`에서만 overflow를 잠금. 닫힘/unmount 시 상태 선택자가 해제되어 원래 스크롤 규칙으로 복원되며 body 구조는 유지.
- 두 Modal 내부 header/action을 흰색 불투명 배경과 경계선의 상·하단 sticky 영역으로 변경. padding 변수를 이용해 가장자리 정렬과 작은 화면 간격을 일치시킴.
- 액션 wrap과 버튼 최소 높이를 적용하고 400px 이하에서는 주요 버튼 그룹을 별도 줄에 배치.
- ItemManager의 등록·수정·삭제에 pendingRef 즉시 잠금 추가. 삭제 확인 취소를 포함한 모든 종료 경로에서 finally로 잠금·busy 해제.
- 두 focus trap에 button/input/select/textarea/링크/tabindex 대상을 동일하게 적용하고 숨김·disabled·inert 및 음수 tabIndex 요소 제외. 확인창 종료 후 품목 Modal 포커스도 복구.
- 기존 CRUD API, 필드, 목록 컬럼, 연속 등록, result.item/result.client 동기화 흐름 유지. 신규 소스 파일 없음.

### 검증 및 결과물
- 변경 소스 diff를 읽어 CSS 범위와 상태 잠금·해제 경로 확인.
- 앱 실행·테스트·빌드·lint·formatter·브라우저 확인은 공통 지침에 따라 미실행. 실제 스크롤 및 키보드 동작은 실행 검증하지 않음.
- 작업 시작/완료 시점의 기존 소스 3개 사본에 대한 git diff --no-index 출력만 docs/LAST_CHANGE.diff에 저장. before/after 경로로 표시되며 이전 미커밋 변경과 로그는 제외.

---

## 2026-10-01 - 거래처 관리 목록·상세 Modal 리디자인

### 요청
- 작업지시서 13에 따라 거래처 관리를 품목 관리와 동일한 목록·등록/상세/수정 Modal UX로 전환.

### 변경
- ClientManager의 상시 우측 폼과 행별 수정·삭제 버튼, 페이지 폼 자동 이동 코드를 제거하고 전체 폭 목록 및 행 클릭/키보드 상세 진입 적용.
- 매출/매입 탭과 기존 검색을 유지. 탭 변경 시 검색·오류·Modal 상태를 초기화하고 이전 목록 요청의 지연 응답이 현재 탭을 덮어쓰지 않도록 처리.
- 기존 14개 필드 전체를 읽기 전용 상세에 표시. 등록 성공 후 현재 유형과 Modal을 유지하고 빈 폼·코드 입력 포커스로 연속 등록 지원.
- 기존 validation 및 CRUD API 유지. 수정 성공 시 result.client로 코드·폼·상세 동기화 후 상세 복귀, 수정 취소 시 저장 전 상세 복귀.
- 기존 ConfirmDialog/useConfirmation/Toast 재사용. CRUD 오류는 Modal 내부, 목록 로딩 오류는 페이지에 표시. 삭제 성공 시 Modal 닫기 및 목록 갱신.
- 거래처 전용 목록 가로 스크롤 제거, 세로 스크롤·sticky 헤더 유지. 1300/1500/1750px에서 구분·유형/사업자번호/주소를 순차 표시.
- 품목 Modal과 동일한 크기·overlay·버튼 배치와 2열/1열 grid 적용. 포커스 이동·복원·trap, 확인창 포커스 충돌 및 중복 실행 방지 적용.
- ClientManager.jsx와 main.css의 거래처 전용 부분만 변경. ItemManager 및 다른 화면·Main·Preload·IPC는 수정하지 않음. 신규 소스 파일 없음.

### 검증 및 결과물
- 변경 소스를 읽어 필드, 상태 전환, API 호출, 반응형 CSS 및 z-index 관계 확인.
- 앱 실행·테스트·빌드·lint·formatter·브라우저 확인은 공통 지침에 따라 미실행. 실제 GUI 및 CRUD는 실행 검증하지 않음.
- 작업 시작 시점의 두 소스 파일 사본과 완료본을 git diff --no-index로 비교한 출력만 docs/LAST_CHANGE.diff에 저장. before/after 경로로 표시되며 기존 미커밋 변경과 이전 품목 작업, 로그는 제외.

---

## 2026-10-01 - 품목 관리 목록·상세 Modal 리디자인

### 요청
- 작업지시서 12에 따라 품목 관리만 전체 폭 목록과 등록·상세·수정 Modal 구조로 전환.

### 변경
- ItemManager의 상시 우측 폼과 목록 수정·삭제 버튼, 좁은 화면 자동 스크롤 로직을 제거하고 행 클릭/키보드 선택으로 상세 Modal을 표시.
- 모든 품목 정보를 상세에 표시하고, 등록 성공 시 Modal 유지·빈 폼 초기화·구분 재포커스로 연속 등록 지원.
- 수정 시 기존 validation·재고 읽기전용 정책·코드 변경 API를 유지하고 result.item으로 동기화한 상세로 복귀. 수정 취소는 저장 전 상세로 복귀.
- 삭제 확인은 기존 ConfirmDialog/useConfirmation 재사용. 성공은 Toast, 작업 실패는 Modal 내부 지속 오류, 목록 로딩 실패는 페이지 메시지로 분리.
- 목록 가로 스크롤 제거, 세로 스크롤·sticky 헤더 유지. 1300/1500/1750px에서 단가/규격·단위/브랜드 컬럼을 순차 표시.
- 2열/1열 반응형 Modal, 내부 스크롤, 포커스 이동 및 저장 중 버튼 비활성화 적용. 확인창·Toast보다 낮은 z-index 사용.
- 기존 미커밋 변경을 보존하고 거래처·Main·Preload·IPC는 수정하지 않음. 신규 소스 파일 없음.

### 검증 및 결과물
- 변경 소스와 CSS를 읽어 상태 전환, API 호출, 필드 정책, 공통 스타일 재사용과 표시 순서를 확인.
- 앱 실행·테스트·빌드·lint·formatter·브라우저 확인은 공통 지침에 따라 미실행. 실제 화면 및 CRUD 동작은 실행 검증하지 않음.
- docs/LAST_CHANGE.diff에 수정한 기존 소스 두 파일의 git diff 출력 저장. 해당 파일의 기존 미커밋 변경도 일부 포함되며 로그와 타 파일은 제외.

---

## 2026-10-01 - 공통 페이지 헤더 Sticky 제거

### 요청
- 공통 페이지 헤더를 일반 콘텐츠 흐름으로 복원하고 내부 sticky 요소와의 시각적 겹침을 해소.

### 변경
- `.page-header`의 sticky 위치, z-index, negative margin 및 상단 padding 규칙을 제거.
- 제목·설명·액션 버튼의 flex 배치를 유지하고 하단 간격을 `24px`로 복원.
- `.transaction-summary-card`, `.item-form-card`, `.client-form-card`의 sticky offset을 `24px`로 조정.
- 사이드바, `.content` 스크롤, 테이블 헤더 sticky 및 품목·거래처 자동 이동 코드는 유지.

### 검증
- 공통 지침에 따라 앱 실행, 테스트, 빌드, lint, formatter는 실행하지 않음.

---

## 2026-10-01 - 관리 화면 반응형·Sticky·폼 자동이동 통합 개선

### 요청
- 품목·거래처 관리 화면의 반응형 기준, sticky 페이지 헤더 배경, 좁은 화면 폼 자동 이동을 통일.

### 변경
- 거래처 관리 1열 breakpoint를 `1000px`에서 `1200px`로 통일하고 기존 목록 높이·폼 정적 배치를 유지.
- `.content` padding을 CSS 변수로 관리하고 sticky `.page-header`가 상단 padding 영역까지 불투명하게 덮도록 보완.
- 1200px 이하에서 신규 등록 버튼·목록 행 선택 시 폼 카드로 부드럽게 이동하고 품목 구분/거래처 코드 입력에 focus.
- 폼 카드에 `scroll-margin-top`을 적용해 sticky 헤더에 가려지지 않도록 보정.
- 기존 CRUD, Toast, 오류, 배지 및 검색 동작은 유지.

### 검증
- 공통 지침에 따라 앱 실행, 테스트, 빌드, lint, formatter는 실행하지 않음.

---

## 2026-09-30 - 출고 마이너스 재고 사전 확인

### 요청
- 출고 후 재고가 음수가 되는 경우 저장 전에 사용자 확인을 받도록 변경.

### 변경
- Main의 `addTransaction()`에서 실제 데이터 파일의 최신 재고를 기준으로 저장 전 확인 응답을 반환.
- 확인 전에는 거래내역·재고·Excel을 변경하지 않도록 처리.
- Renderer에서 공통 확인 모달로 현재재고·출고수량·예상재고를 안내하고, 승인 시 `allowNegativeStock: true`로 재요청.
- 입고·출고반입과 기존 성공·오류 처리 흐름은 유지.

### 검증
- 공통 지침에 따라 앱 실행, 테스트, 빌드, lint, formatter는 실행하지 않음.

---

## 2026-09-30 - 최초 실행·복구 화면 상단 잘림 방지

### 요청
- 긴 setup/recovery 카드가 중앙 정렬로 인해 상단에서 잘리지 않도록 배치 보완.

### 변경
- `.setup-page`를 flex 상단 정렬 및 자체 스크롤 구조로 변경.
- `.setup-card`에 `margin-block: auto`를 적용해 짧은 콘텐츠는 중앙에 가깝게 유지하고 긴 콘텐츠는 상단부터 표시.
- 카드 디자인과 일반 앱 스크롤 구조는 유지.

### 검증
- 공통 지침에 따라 앱 실행, 테스트, 빌드, lint, formatter는 실행하지 않음.

---

## 2026-09-30 - 최초 실행·복구 화면 스크롤 보완

### 요청
- 전역 `body` 스크롤 차단 환경에서도 최초 실행·복구 화면의 긴 콘텐츠에 접근 가능하도록 보완.

### 변경
- `.setup-page`를 viewport 높이 기반 자체 세로 스크롤 컨테이너로 변경.
- 기존 중앙 배치, 배경색, padding 및 카드 디자인은 유지.
- JSX와 일반 앱 `.content` 스크롤 구조는 수정하지 않음.

### 검증
- 공통 지침에 따라 앱 실행, 테스트, 빌드, lint, formatter는 실행하지 않음.

---

## 2026-09-30 - 입출고 조회 검색영역 반응형 기준 보완

### 요청
- 입출고 조회 검색영역의 2열 전환 기준을 실제 콘텐츠 폭에 맞게 조정.

### 변경
- 해당 `.transaction-search-grid` media query breakpoint를 `950px`에서 `1200px`로 변경.
- 기존 2열 `.transaction-summary` 전환, 옵션 전체 행 배치 및 `650px` 1열 규칙은 유지.

### 검증
- 공통 지침에 따라 앱 실행, 테스트, 빌드, lint, formatter는 실행하지 않음.

---

## 2026-09-30 - 입출고 조회 검색영역 폭 정리

### 요청
- 입출고 조회의 취소 내역 포함 옵션이 검색 필드와 같은 열을 차지하지 않도록 검색 영역을 정리.

### 변경
- `.transaction-search-grid`의 기본 구조를 5열로 변경.
- `.search-option-field`를 검색 필드 아래 전체 행으로 확장하고 오른쪽 정렬.
- 950px·650px 반응형 그리드 규칙과 검색 기능은 유지.

### 검증
- 공통 지침에 따라 앱 실행, 테스트, 빌드, lint, formatter는 실행하지 않음.

---

## 2026-09-30 - 품목·거래처 폼 오류 위치 개선

### 요청
- 품목·거래처 등록·수정 오류를 저장 버튼 근처의 폼 하단에 표시.

### 변경
- `ItemManager`와 `ClientManager`에 `formError` 상태를 추가.
- 등록·수정의 validation/API 오류는 폼 하단에 표시하고 성공 시 초기화.
- 폼 초기화, 대상 선택, 거래처 구분 전환 시 이전 폼 오류를 제거.
- 목록 로딩·삭제 오류는 기존 상단 `message` 영역을 유지.
- 공통 `.form-error-message` 스타일을 추가하고 성공 Toast는 유지.

### 검증
- 공통 지침에 따라 앱 실행, 테스트, 빌드, lint, formatter는 실행하지 않음.

---

## 2026-09-30 - 수정 후 선택 상태 유지 보완

### 요청
- 품목·거래처 코드 변경을 포함한 수정 성공 후 저장 결과를 선택 상태와 폼에 반영.

### 변경
- `updateItem()`이 반환한 `result.item`의 새 코드와 저장 결과 필드로 `selectedCode` 및 폼을 갱신.
- `updateClient()`가 반환한 `result.client`의 새 코드와 저장 결과 필드로 `selectedCode` 및 폼을 갱신.
- 성공 Toast와 목록 새로고침을 유지하고, 신규 등록·삭제·오류·배지·CSS 동작은 변경하지 않음.

### 검증
- 공통 지침에 따라 앱 실행, 테스트, 빌드, lint, formatter는 실행하지 않음.

---

## 2026-09-30 - 수정 성공 후 선택 상태 유지

### 요청
- 품목·거래처 수정 성공 후 선택 대상과 폼 값을 유지하고 `수정 중` 상태를 계속 표시.

### 변경
- `ItemManager.updateItem()`과 `ClientManager.updateClient()` 성공 처리에서만 `resetForm()` 호출을 제거.
- 수정 성공 Toast와 목록 새로고침은 유지.
- 신규 등록 성공, 삭제, 오류 처리 및 기존 입력 검증은 변경하지 않음.

### 검증
- 공통 지침에 따라 앱 실행, 테스트, 빌드, lint, formatter는 실행하지 않음.

---

## 2026-09-30 - 품목·거래처 폼 모드 배지 추가

### 요청
- 품목 및 거래처 폼에서 신규 등록 상태와 수정 상태를 즉시 구분할 수 있는 공통 배지 추가.

### 변경
- `ItemManager`와 `ClientManager`의 폼 헤더에 `selectedCode` 기반 `신규 등록`/`수정 중` 배지를 추가.
- 두 화면에서 재사용하는 파랑·주황 계열의 `.form-mode-badge` 스타일을 추가.
- 기존 제목, 설명, CRUD 동작 및 폼 동작은 유지.

### 검증
- 공통 지침에 따라 앱 실행, 테스트, 빌드, lint, formatter는 실행하지 않음.

---

## 2026-09-30 - 품목·거래처 성공 Toast 적용

### 요청
- 품목 및 거래처의 등록·수정·삭제 성공 피드백을 상단 안내 대신 공통 성공 Toast로 전환.

### 변경
- `Toast` 공통 컴포넌트를 추가해 성공 메시지를 우측 상단에 표시하고 2.8초 후 자동 해제.
- 품목 관리와 거래처 관리의 성공 상태를 기존 inline 오류 상태에서 분리.
- 등록·수정·삭제 중 이전 성공 Toast를 해제하고, 오류는 기존 inline 메시지로 유지.
- 차분한 녹색 계열의 공통 Toast 스타일과 접근성 상태 알림을 추가.

### 검증
- 공통 지침에 따라 앱 실행, 테스트, 빌드, lint, formatter는 실행하지 않음.

---

## 2026-09-30 - 품목·거래처 목록 내부 스크롤 정리

### 요청
- 품목 관리와 거래처 관리의 테이블 영역을 명확한 고정형 내부 스크롤 구조로 정리.

### 변경
- `.item-table-wrapper`와 `.client-table-wrapper`에 `clamp()` 기반 높이 및 안정적인 스크롤바 여백을 적용.
- 1열 반응형 레이아웃에서 두 목록 wrapper의 높이를 `420px`로 제한.
- 중복된 거래처 wrapper 가로 스크롤 규칙을 제거하고 기존 `overflow: auto` 규칙으로 통합.
- 품목·거래처 테이블 헤더의 sticky 규칙과 전역 레이아웃 규칙은 유지.

### 검증
- 작업지시에 따라 앱 실행, 빌드, 테스트, lint, formatter는 실행하지 않음.

---

## 2026-09-30 - 전역 레이아웃 및 Sticky 스크롤 구조 정리

### 요청
- 앱 전체 스크롤을 막고 `.content`만 주 세로 스크롤 영역으로 전환.
- 사이드바와 공통 페이지 헤더의 sticky 동작을 정리하고 기존 sticky 카드와의 겹침 방지.

### 변경
- `html`, `body`, `#root`, `.app-layout`을 viewport 높이에 고정하고 문서 전체 스크롤을 차단.
- `.sidebar`를 화면 높이 sticky 영역 및 내부 세로 스크롤 가능 영역으로 변경.
- `.content`를 viewport 높이의 주 스크롤 영역으로 변경.
- `.page-header`에 공통 sticky·불투명 배경·액션 정렬 규칙을 추가.
- `.transaction-summary-card`, `.item-form-card`, `.client-form-card`의 sticky 기준점을 `96px`로 조정.

### 검증
- 작업지시에 따라 앱 실행, 빌드, 테스트, lint, formatter는 실행하지 않음.
- 테이블 헤더 sticky, `.startup-notice`, 반응형 카드의 `position: static` 규칙은 수정하지 않음.

---

## 2026-09-30 - 개발 변경 이력 기록 기준 설정

- 이후 사용자 요청으로 수행하는 모든 개발 작업의 변경·추가 내역을 이 문서에 완료 순서대로 누적 기록한다.
- 각 기록에는 요청 내용, 실제 변경 사항, 검증 결과 및 필요한 경우 남은 제한 사항을 포함한다.
- 기존 기록은 사실 오류를 바로잡는 경우를 제외하고 수정하지 않는다.

---

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


---

## 2026-09-22 — v1.0.1 안정성 및 UX 개선 (Work ZIP 복사본)

- 최신 첨부 `local-inventory-manager-release-v1.0.1(1).zip` fingerprint 확인 후 개선. 기존 9개 메뉴, 25개 IPC, 재고조정, 자동 백업 설정, 조회 필터/정렬/페이지/합계/내보내기 보존.
- 임시 파일 검증 → 직전 정상본 보존 → 같은 폴더의 파일 교체 → 최종 검증. 실제 교체 이후의 실패만 되돌리며 실패 사본을 보존.
- 시작 시 6개 시트 검증, 데이터 누락/손상 시 첫 실행보다 복구 우선. 현재 정상 데이터는 과거 사본으로 자동 교체하지 않음.
- 규격·단위 거래 snapshot, v1.0.0 누락 열 보완, 원본 Excel 규격/단위 직접 이관. 과거 금액·수량·취소상태·현재재고를 재계산하지 않음.
- 거래처 14개 상세 열 및 추가 열 보존, 음수 출고 승인, 품목/거래처 삭제 확인, 입력 검증, 성공 메시지 유지, 한국어 오류 안내.
- 조회 표 번호 표시 제거, 규격/단위 추가, 기존 CSS와 첫 실행 컴포넌트를 수정. 현재재고 readOnly 유지.
- Main 데이터 함수 자동 테스트 22개 통과(첨부 XLSM 포함), lint 오류 0개, production build 성공. 기존 서식 경고는 유지. Windows GUI/설치/실제 파일 잠금은 미검증.
- 사용자 PC의 Git 저장소나 GitHub를 변경하지 않음. 전체 설명과 한계: [RELEASE_v1.0.1.md](RELEASE_v1.0.1.md).
