# 10. 연결 관계 교차 검토 (기능 ↔ 화면 ↔ API ↔ DB ↔ 테스트)

관련 문서: 01~09 전체

목적: 요구사항(FR)이 화면, API, 테이블, 테스트, 개발 작업까지 **빠짐없이 연결되는지** 검토하고, 발견한 불일치를 기록한다.

## 1. 기능 추적표 (P0)

| FR | 화면 | API | 테이블 | 테스트(TC) | 개발 작업 |
|----|------|-----|--------|------------|-----------|
| FR-AUTH-01 회원가입 | SCR-03 | POST /auth/signup | users, refresh_tokens | TC-AUTH-01~04, 14 | T-401, T-603 |
| FR-AUTH-02 로그인 | SCR-02, SCR-01 | POST /auth/login, GET /users/me | users, refresh_tokens | TC-AUTH-05~07 | T-402, T-603 |
| FR-AUTH-03 로그아웃 | SCR-14 | POST /auth/logout | refresh_tokens | TC-AUTH-10 | T-403, T-604 |
| FR-AUTH-04 세션 유지 | SCR-01 | POST /auth/refresh | refresh_tokens | TC-AUTH-08, 09, TC-UI-09/10 | T-403, T-601, T-602 |
| FR-AUTH-05 회원 탈퇴 | SCR-14, SCR-15, SCR-16 | POST /users/me/deletion | users, refresh_tokens, user_cards (CASCADE) | TC-AUTH-11~13, TC-UI-12 | T-405, T-408, T-604 |
| FR-DATA-01 동기화 | (없음, 시스템) | (공개 API 없음) | card_sets, cards, card_types, rarities | TC-DATA-01~10 | T-201~T-208 |
| FR-DATA-02 동기화 기록/알림 | (없음) | /health(상태) | sync_jobs | TC-DATA-05, 08 | T-204, T-206 |
| FR-SET-01 세트 목록 | SCR-11 | GET /sets | card_sets | TC-CARD-14 | T-301 |
| FR-CARD-01 카드 목록 | SCR-10 | GET /cards | cards, card_sets, card_types | TC-CARD-01~03, 10~12, 16, 17 | T-303, T-701 |
| FR-CARD-02 이름 검색 | SCR-10 | GET /cards?q= | cards | TC-CARD-04, 05, TC-UI-05, 14 | T-304, T-702 |
| FR-CARD-03 필터 | SCR-11 | GET /cards?setIds&types&rarities, GET /filters, GET /sets | cards, card_types, card_sets, rarities | TC-CARD-06, 07, 15, TC-UI-06 | T-302, T-305, T-703 |
| FR-CARD-04 정렬 | SCR-11 | GET /cards?sort&order | cards, card_sets, rarities | TC-CARD-08, 09 | T-306, T-703 |
| FR-CARD-05 카드 상세 | SCR-12, SCR-13 | GET /cards/{id} | cards, card_sets, card_types | TC-CARD-13 | T-307, T-704 |
| FR-OWN-01 보유 체크/해제 | SCR-10, SCR-12 | PUT/DELETE /users/me/cards/{id} | user_cards | TC-OWN-01~06, 10, TC-UI-02/03 | T-501, T-801 |
| FR-OWN-02 보유 표시 | SCR-10, SCR-12 | GET /cards, GET /cards/{id} (`owned`) | user_cards (LEFT JOIN) | TC-OWN-01, 11, TC-UI-04 | T-502, T-504, T-802 |
| FR-OWN-03 보유/미보유 필터 | SCR-10(보기 칩), SCR-11 | GET /cards?owned= | user_cards | TC-OWN-07~09 | T-503, T-803 |
| FR-GATE-01 로그인 유도/복귀 (2차 추가) | SCR-10, SCR-12, SCR-02, SCR-03 | (클라이언트 흐름) + 로그인 후 원 동작 API | profiles/auth | TC-GATE-01~03 | T-606, T-804 |

> 2차 갱신 주: 위 표의 "API" 열은 **논리 API**이며 Supabase 구현 대응은 05 §0, 테이블은 04 §9.1을 따른다 (`users`→`auth.users`+`profiles`, `refresh_tokens` 제거). RLS/RPC/Edge Function 테스트는 08 §4.8 (TC-RLS, TC-RPC, TC-EDGE).

### 1.1 P1/P2 연결 (사전 배치)

| FR | 화면 | API | 테이블 |
|----|------|-----|--------|
| FR-AUTH-06 비밀번호 재설정 | SCR-04 | POST /auth/password-reset/* | users, (재설정 토큰 저장소 — 상세 설계 시 `password_resets` 테이블 추가 필요) |
| FR-AUTH-07 소셜 로그인 | SCR-02 | POST /auth/social/google | users, (`auth_identities` 추가 예정) |
| FR-PROG-01 진행률 | SCR-21 (**보류**) | (보류) | (보류) |
| FR-WISH-01/02 위시리스트 **(P0)** | SCR-20, SCR-10, SCR-12 | PUT/DELETE/GET /users/me/wishlist, `list_cards`/`get_card`의 `wished` | wishlist_items (TC-WISH-01~10) |
| FR-AUTH-08 가입 연령 확인 **(P0)** | SCR-03 | signup 시 연령 확인 값 검증 (방식 미정) | profiles.age_verified_at (TC-AGE-01~04) |
| FR-PRICE-01 시세 | SCR-12 | GET /cards/{id} (`prices`) | card_prices |
| FR-SRCH-02 한글 검색 | SCR-10 | GET /cards?q= | pokemon_names, cards.national_dex_numbers |
| FR-SCAN-01 스캔 | SCR-30 | (미정) | (미정) |

## 2. 역방향 점검

### 2.1 API → 화면/FR 사용처 (사용되지 않는 API가 없는지)

| API | 사용 화면/기능 | 비고 |
|-----|----------------|------|
| POST /auth/signup | SCR-03 | |
| POST /auth/login | SCR-02 | |
| POST /auth/refresh | SCR-01 및 모든 인증 요청의 자동 갱신 | 사용자 화면 없음, 클라이언트 내부 |
| POST /auth/logout | SCR-14 | |
| GET /users/me | SCR-01, SCR-14 | |
| POST /users/me/deletion | SCR-15 | |
| GET /cards | SCR-10 | |
| GET /cards/{id} | SCR-12 | |
| GET /sets | SCR-11 | |
| GET /filters | SCR-11 | `supertypes`는 MVP 미사용(이슈 #4) |
| PUT/DELETE /users/me/cards/{id} | SCR-10, SCR-12 | |
| GET /health | 운영 모니터링 | 화면 없음 |

→ 미사용 API 없음. (`GET /users/me/cards`는 의도적으로 MVP 제외)

### 2.2 테이블 → API/FR 사용처 (사용되지 않는 테이블이 없는지)

| 테이블 | 사용처 |
|--------|--------|
| users | FR-AUTH 전반 |
| refresh_tokens | FR-AUTH-02~05 (`device_label` 컬럼은 현재 API에서 미사용, 이슈 #13) |
| card_sets | FR-SET-01, FR-CARD-01/03/04 |
| cards | FR-CARD 전반 |
| card_types | FR-CARD-03 |
| rarities | FR-CARD-04 정렬, GET /filters 순서 |
| user_cards | FR-OWN 전반 |
| sync_jobs | FR-DATA-02 |
| wishlist_items / card_prices / pokemon_names | P1 (MVP 구현 대상 아님) |

→ MVP에서 사용처 없는 P0 테이블 없음.

### 2.3 화면 → API 사용처 (호출할 API가 없는 화면이 없는지)

| 화면 | 필요한 데이터/동작 | 대응 API | 결과 |
|------|--------------------|----------|------|
| SCR-01 | 세션 확인 | refresh, users/me | OK |
| SCR-02/03 | 로그인/가입 | login, signup | OK |
| SCR-10 | 목록, 검색, 보유 토글 | cards, PUT/DELETE own | OK |
| SCR-11 | 세트 옵션, 타입/희귀도 옵션 | sets, filters | OK (건수 표시는 제외, 이슈 #3) |
| SCR-12 | 상세, 보유 토글 | cards/{id}, PUT/DELETE own | OK |
| SCR-13 | 큰 이미지 | 상세 응답의 이미지 URL | OK |
| SCR-14 | 내 정보, 로그아웃 | users/me, logout | OK |
| SCR-15 | 계정 삭제 | users/me/deletion | OK |
| SCR-16 | 약관/방침 | 외부 웹 문서 (API 아님) | 호스팅 필요 (T-408) |

## 3. 데이터 흐름 일관성 점검

| 점검 항목 | 결과 |
|-----------|------|
| `owned` 계산 위치 | 서버(LEFT JOIN)에서만 계산. 클라이언트는 토글 후 캐시만 갱신 (04 §5, 05 §3.1, 06 §5 일치) |
| 필터 결합 규칙(항목 내 OR / 항목 간 AND) | 02 §2.4, 04 §5, 05 §3.1, 08 TC-CARD-06 동일 |
| 비활성 카드 처리 | 02, 04, 05, 08 TC-OWN-09 일치 |
| 커서 페이징 | 05(커서), 04(키셋 쿼리), 06(조건 변경 시 리셋), 08(TC-CARD-02/03) 일치 |
| 멱등 PUT/DELETE | 02, 05, 07, 08 일치. 보유 해제 시 없는 카드 ID는 204로 통일 |
| 탈퇴 시 삭제 범위 | 02, 04(CASCADE), 05, 08 TC-AUTH-11 일치 |
| 에러 코드 | 05 §1.3 목록이 06/07 메시지 매핑에 모두 존재 |
| 외부 API 키 | 03, 07, 01 NFR-SEC-02 모두 서버 전용으로 일치 |
| 동기화 API 비공개 | 03, 05 §5, 07 §2.5 일치 |

## 4. 우선순위/의존성 정합성

| 점검 | 결과 |
|------|------|
| P0 기능의 선행 기능이 P0인가 | 예. FR-OWN은 FR-AUTH(P0)와 FR-CARD(P0)에 의존, FR-CARD는 FR-DATA(P0)에 의존 |
| 개발 단계 순서가 의존성을 따르는가 | PH-2→3→5, PH-4→5, PH-6→7→8 (09 §1과 02 §1.1 일치) |
| P0가 P1에 의존하는 항목이 없는가 | 없음. FR-AUTH-06은 P1이지만 이메일 방식 선택 시 **출시 전 필수**이므로 PH-9 이전에 일정에 포함해야 함 (이슈 #7a) |
| 희귀도 정렬(FR-CARD-04)의 선행 | rarities 시드(T-207, PH-2) → 정렬 구현(T-306, PH-3) 순서 OK |
| 한글 이름 검색(FR-SRCH-02) 선행 | FR-CARD-02(P0), 한글명 데이터 확보(DEC-10) |

## 5. 검토에서 발견한 이슈와 처리

| # | 이슈 | 영향 문서 | 상태 |
|---|------|-----------|------|
| 1 | 회원 탈퇴를 `DELETE`+본문(비밀번호)로 설계하면 일부 클라이언트/프록시에서 본문이 제거될 수 있음 → `POST /users/me/deletion`으로 변경 | 05, 06, 10 | **해결(문서 반영)** |
| 2 | 게스트가 `owned` 필터를 선택하면 API가 401을 반환 → UI에서 칩 탭 시 로그인 유도로 사전 차단하도록 명시 | 06 | **해결(문서 반영)** |
| 3 | 필터 시트에 "N개 카드 보기" 건수 표시를 설계했으나 사전 건수 조회 API가 없고 `includeTotal`은 비용이 큼 → MVP는 "적용하기"로 변경, 건수는 P1 | 06 | **해결(문서 반영)** |
| 4 | `GET /filters`의 `supertypes`는 MVP 필터 파라미터가 없어 미사용 → P1 용도로 명시 | 05 | **해결(문서 반영)** |
| 5 | PH-0 완료 조건에 DEC-05(이미지), DEC-06(호스팅)이 누락 | 09 | **해결(문서 반영)** |
| 6 | 희귀도 정렬 순서 정의(DEC-11)가 사용자 확인 사항이며, 소스에 새 희귀도가 생기면 매핑 누락 → 미매핑은 뒤로 정렬하고 동기화 후 신규 희귀도를 알림 | 04, 05 | 설계 반영, **DEC-11 확정 필요** |
| 7 | FR-AUTH-06(비밀번호 재설정)은 P1이나 이메일 방식 선택 시 출시 전 필수(7a). 소셜 전용 계정은 비밀번호가 없어 탈퇴 재확인 방식이 별도로 필요(7b). 재설정 토큰 저장 테이블(`password_resets`)이 ERD에 없음 | 02, 04, 05, 09 | **미해결(DEC-04 확정 후 보완)** |
| 8 | FR-DATA-02 실패 알림 수단이 호스팅(DEC-06)에 의존 | 02, 09 | **미해결(DEC-06 확정 후)** |
| 9 | `GET /sets`를 페이징 없이 전체 반환하는 가정의 타당성(세트 수) | 05 | **미해결(PH-2 동기화 후 확인)** |
| 10 | 세트 출시일 정렬이 `cards`–`card_sets` JOIN 정렬이라 느릴 수 있음 → `cards.set_release_date` 비정규화 검토 | 04 | **미해결(PH-3 성능 측정 후 결정)** |
| 11 | 약관/개인정보처리방침 버전 관리(어떤 버전에 동의했는지)가 스키마에 없음. 현재는 동의 시각만 저장 | 04 | **미해결(출시 전 법적 요구 확인 후 `terms_version` 추가 여부 결정)** |
| 12 | 한국어 UI인데 카드명이 영문이라 검색이 불편함(R-04). MVP는 안내 문구로 대응, 근본 대응은 FR-SRCH-02 | 01, 02 | **수용된 리스크, P1 최우선 검토** |
| 13 | `refresh_tokens.device_label` 컬럼이 어떤 API/화면에서도 쓰이지 않음 → MVP에서는 컬럼 생략 가능 | 04 | **미해결(PH-1 스키마 확정 시 결정)** |
| 14 | 보유 정보를 "카드 단위"로 저장하는 가정(A-03)에서 같은 카드의 홀로/리버스 버전을 구분하지 못함. 사용자 요구는 O/X이므로 충족하지만 향후 확장 시 PK 변경 마이그레이션 필요 | 01, 04 | **수용된 제약(04 §6에 확장 경로 기재)** |

### 5.1 2차 갱신 이슈 (사용자 결정 반영 + 조사 결과)

| # | 이슈 | 영향 문서 | 상태 |
|---|------|-----------|------|
| 15 | **데이터 소스 종료**: Pokémon TCG API가 2027-03-01 종료. **개발·1차는 무료 소스+DB 적재로 확정**. 종료 전 후속 소스·약관은 잔여 | 01, 03, 11 | **일부 해결 (DEC-16)** |
| 16 | **IP 위험**: 1차 무광고로 완화. 무광고+이미지 출시도 중~높음. 앱 이름·이미지 방침 미정 | 01, 07, 11 | **일부 해결 (DEC-14). 잔여 DEC-13** |
| 17 | 가입 만 14세·한국·무광고 확정. 연령 서버 검증 방식 미정 | 02, 04, 06, 07, 08 | **일부 해결 (DEC-17). 잔여 서버 검증** |
| 18 | "즐겨찾기" 의미가 불명확 (보유와 동일? 별개?) → 스키마·API·화면이 달라짐 | 01, 02, 04 | **해결**: 보유 체크 + 위시리스트로 확정, FR-FAV-01 삭제 |
| 19 | 위시리스트 MVP 포함 여부 불명확 | 01, 09 | **해결**: MVP 포함. 01/02/04/05/06/08/09 반영 완료 |
| 25 | **(3차)** 위시리스트 P0 승격에 따른 교차 점검: 테이블(`wishlist_items`) ↔ API(#17) ↔ 화면(SCR-20, SCR-10/12 아이콘, 하단 탭) ↔ 테스트(TC-WISH) ↔ 작업(T-506~510, T-807/808) 연결 확인 | 04, 05, 06, 08, 09 | 해결 |
| 26 | 보유 체크 시 위시 자동 제거 여부 | 02, 06 | **해결**: 자동 제거 없음, 위시에 `owned` 표시 (DEC-22) |
| 28 | 게스트에게 광고 노출 여부 | 07, 11 §7.4 | **해당 없음**: 1차 무광고 (DEC-14) |
| 27 | **(3차)** 연령 확인의 서버 측 우회 방지 방식 미정 (Auth Hook vs 가입용 Edge Function 등). 클라이언트만 검증하면 Auth API 직접 호출로 우회 가능 | 02, 07, 08 | **미해결 (PH-0/PH-4, TC-AGE-03)** |
| 29 | **(3차)** 위시 아이콘과 보유 아이콘이 3열 그리드 항목에서 오터치될 수 있음 | 06 | 디자인 단계에서 터치 영역 검증 |
| 20 | Supabase 구 프로젝트 | 03 §8.7, 09 | **방침 확정**: 삭제. 실행은 대시보드(MCP 불가) |
| 21 | 가입 연령 확인을 클라이언트에서만 하면 우회 가능 → Auth Hook/가입 Edge Function 필요 여부 | 03 §8.5, 07 | **미해결 (PH-0/PH-4)** |
| 22 | 이메일 확인 사용 시 가입 흐름이 앱 이탈·딥링크 복귀를 포함 → 로그인 유도 후 복귀 정보를 영속 저장해야 함 | 06 §4.5, 08 TC-GATE-02 | **설계 반영** |
| 23 | Supabase 구성으로 #7(재설정 토큰 테이블), #13(`device_label`)은 불필요해짐 (Auth 내부 처리) | 04 | **해소** |
| 24 | FR-PROG-01(세트 진행률)은 사용자 결정으로 보류. 관련 API/화면(SCR-21)/PH-10 작업은 보류 표시 | 01, 05, 06, 09, 10 | **해소(문서 반영)** |

## 6. 문서 간 용어/ID 정합성 점검 체크리스트

- [x] FR ID가 01(정의) → 02(명세) → 05/06/08/09/10에서 동일하게 사용됨
- [x] DEC ID가 README → 03/04/05/06/09에서 동일하게 사용됨
- [x] 단계 ID `PH-N`이 09와 다른 문서의 "Phase N" 참조와 일치 (Phase 1=기반, 2=동기화, 3=조회 API, 5=보유 API, 8=앱 보유)
- [x] SCR ID가 06과 10에서 일치
- [x] TC ID가 08과 10, 09에서 일치
- [ ] 사용자 승인 후 DEC 확정 결과를 반영해 01~09를 최종 갱신 (승인 단계의 작업)
