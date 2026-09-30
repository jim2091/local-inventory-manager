# v1.0.1 작업 보고서

작업일: 2026-09-22. 첨부 ZIP 복사본만 수정했습니다. 사용자 PC의 Git 저장소, GitHub, 실제 release/v1.0.1 브랜치를 변경하지 않았습니다.

1. **기준 프로젝트 fingerprint 검증 결과** — 통과. 최신 첨부 `local-inventory-manager-release-v1.0.1(1).zip`을 사용했습니다. 이름 `local-inventory-manager`, 작성자 `ljb`, 기존 9개 업무 메뉴, 필수 컴포넌트 5개, 조회/내보내기/재고조정/자동 백업 설정, 창 크기, Windows 설치 설정을 수정 전에 확인했습니다. 원본 SHA-256은 릴리스 문서에 기록했습니다.

2. **작업 완료 여부** — 요청된 소스 개선, 데이터 자동 검사, lint/build, 원본 비교, 릴리스 문서 및 ZIP 작성 완료. Windows GUI/설치 실사용 승인은 아직 검증하지 않았습니다.

3. **주요 변경사항** — 단계별 안전 저장, 복구 우선 시작 흐름, 6개 시트 검증, 규격/단위 거래 snapshot 및 v1.0.0 호환, 음수 출고 승인, 삭제 확인, 입력·메시지·검색·첫 실행 UI 개선.

4. **기존 기능 보존 검사 결과** — 원본 39개 파일 보존. 메뉴 9개와 기존 IPC 25개 유지, 복구 IPC 1개 추가. 조회의 필터/정렬/페이지/전체 보기/합계/내보내기, 재고 현황/조정/검사, CRUD, 백업/복원/설정/정리/폴더, 기존 Excel 가져오기 모두 코드 경로 유지. 데이터 경로는 자동 검사했고 UI 클릭은 미검증입니다.

5. **수정 파일 목록** — 15개: `src/main/index.js`, `src/preload/index.js`, `src/renderer/src/App.jsx`, `src/renderer/src/assets/main.css`, `src/renderer/src/components/ClientManager.jsx`, `FirstRunSetup.jsx`, `InventoryAdjustment.jsx`, `ItemManager.jsx`, `TransactionList.jsx`, `TransactionManager.jsx`, `src/renderer/src/components/common/DateInput.jsx`, `package.json`, `package-lock.json`, `README.md`, `docs/DEVLOG.md`. 축약한 컴포넌트명은 모두 `src/renderer/src/components/` 아래입니다. 파일별 목적은 릴리스 문서 참조.

6. **신규 파일 목록** — 8개: `DataRecovery.jsx`, `common/ConfirmDialog.jsx`, `common/useConfirmation.js`, `src/renderer/src/utils/propTypes.js`, `scripts/test-data-safety.cjs`, `docs/RELEASE_v1.0.1.md`, `docs/WORK_REPORT_v1.0.1.md`, `docs/TEST_RESULTS_v1.0.1.txt`. 앞의 세 파일은 `src/renderer/src/components/` 아래입니다. FirstRunSetup은 신규 파일이 아닙니다.

7. **삭제 파일 목록** — 없음. 고정 열 매핑 내부 함수 한 개는 열을 보존하는 저장 함수로 대체했습니다. 기능 삭제는 없습니다.

8. **Excel schema 변경** — 입출고내역 품목명 뒤에 규격·단위를 추가(17개 기본 열). 나머지 기본 시트 유지. 거래처 상세 14개 열 및 이름이 있는 추가 열을 보존합니다.

9. **v1.0.0 migration** — 누락된 거래 규격·단위만 현재 품목 정보로 보완합니다. 해당 품목이 없으면 빈 값. 과거 거래 값과 현재재고를 재계산하지 않으며 반복 실행 시 재저장하지 않습니다. 보완 값이 거래 당시 값을 보장하지 않는 점을 안내합니다.

10. **안전 저장 구조** — 데이터 검사 → 임시 작성/검사 → 직전 정상본 보존 → 파일 교체 → 최종 검사. 실제 교체 이전의 실패에는 현재 파일을 되돌리지 않으며, 교체 후 검증 실패만 직전 정상본으로 복원합니다. 실패 파일을 보관합니다.

11. **복구 구조** — 현재 파일이 없어도 이전 정상본/저장 중 파일을 먼저 확인합니다. 현재 데이터가 정상이면 그대로 사용. 없거나 손상되면 복구 화면에서 사용자가 후보 또는 백업을 선택합니다. 첫 실행 빈 파일 생성보다 우선합니다.

12. **UI/UX 변경** — 기존 사이드바와 업무 화면 구성 유지. 조회 표 번호만 제거하고 규격/단위 추가, 열 폭 및 공통 숫자/키보드 표시 개선. 음수 출고/삭제 확인창, 첫 실행의 두 선택, 진행/오류 표시, 성공 메시지 유지. 기본 1280×800 / 최소 1100×700 유지. 실제 화면 배치는 미검증입니다.

13. **거래처 데이터 보존 방식** — 원래 행의 모든 데이터를 유지한 채 요청에 포함된 필드만 수정합니다. 기존 헤더와 기본 헤더를 함께 기록하므로 상세 정보/추가 열이 사라지지 않습니다. 매입·매출 양쪽 시트의 수정/등록/삭제 및 가져오기 테스트 통과.

14. **lint 결과** — `npm run lint` 종료 코드 0. 오류 0개, Prettier 서식 경고 3,549개. 원본의 오류 8개 해결. 기존 ESLint 규칙은 유지했고 전체 재포맷은 하지 않았습니다.

15. **build 결과** — `npm run build` 종료 코드 0. Main/Preload/Renderer 빌드 모두 성공. Windows NSIS 빌드는 실행하지 않았습니다.

16. **실제 실행 테스트 여부** — 실제 Main 데이터 함수를 임시 폴더의 실제 Excel 파일로 실행한 Node 테스트 22개 통과. Electron API는 대역입니다. Windows Electron 전체 앱 실행 및 GUI 클릭 테스트는 수행하지 못했습니다.

17. **수동 검증 결과** — 원본 ZIP 대비 소스 diff, 메뉴/IPC/보호 파일/창 크기/빌드 설정/의존성/README·DEVLOG 보존을 검사했습니다. 실제 첨부 XLSM의 289개 거래와 64개 품목, 매출거래처 67개·매입거래처 6개를 자동 비교했고 원본 해시는 동일했습니다. 저장 단계별 실패는 오류 주입 방식으로 검사했습니다.

18. **Work 환경에서 검증하지 못한 항목** — 실제 Excel 파일 잠금, 전원 차단, Windows 탐색기/파일 선택창, Electron IPC 전송, 1280/1100 해상도 및 배율별 배치, 전체 버튼 클릭, NSIS 설치. 브라우저 설치도 다운로드 시간 초과로 실패하여 화면 렌더 검증을 완료하지 못했습니다.

19. **알려진 문제/제한** — 기존 서식 경고 잔존, 화면 실동작 미검증, 과거 규격/단위 정확한 복원 불가, 모든 복구 후보가 손상된 경우 자동 복구 불가, recovery 사본 자동 정리 없음. 한 PC/한 사용자 및 값 중심 Excel 정책 유지. 상세 범위는 릴리스 문서 참조.

20. **결과 ZIP** — `local-inventory-manager-v1.0.1-worked.zip`. 원본 전체 프로젝트에 위 변경을 반영한 소스 ZIP이며 설치 실행 파일이 아닙니다. node_modules/out/dist/.git/캐시/업무 및 테스트 Excel은 제외했습니다. 전달 메시지의 파일 링크로 다운로드합니다.

21. **릴리스 문서** — 프로젝트의 [RELEASE_v1.0.1.md](RELEASE_v1.0.1.md). 파일별 변경, 전체 보존 확인표, 호환 방법, 자동 검사 결과, Windows 확인 항목을 포함했습니다. [TEST_RESULTS_v1.0.1.txt](TEST_RESULTS_v1.0.1.txt)에 실행 로그를 함께 제공합니다.
