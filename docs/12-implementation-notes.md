# 12. 구현 노트 (설계 문서와 달라진 점 / 실행 방법)

> 개발 착수 후 확정·변경된 사항. 설계 문서(01~11)와 충돌하면 이 문서가 우선한다.

## 1. 설계 대비 변경점

| 항목 | 설계 | 구현 | 비고 |
|---|---|---|---|
| 페이지 커서 파라미터명 | `cursor` | `page_cursor` | `cursor`는 SQL 예약어라 RPC 인자명으로 회피 (doc 04 §9.4, doc 05 갱신 필요) |
| 카탈로그 원본 | pokemontcg.io API (어댑터) | `PokemonTCG/pokemon-tcg-data` GitHub JSON 덤프 | 키 불필요, 레이트리밋 없음. API는 2027-03-01 종료 예정이라 오히려 안전 |
| 동기화 인증 | 서비스 롤 직접 호출 | Edge Function `sync-catalog` + `x-sync-token` 헤더 | 토큰의 SHA-256만 `public.admin_secrets`에 저장. 원문은 `.env.local`(gitignore)에만 존재 |
| 동기화 단위 | 전체 일괄 | 세트 단위 호출 (`action: sets` → `action: cards`+`setId`) | Edge Function CPU/시간 제한 회피. 러너: `scripts/import-catalog.mjs` |
| 가입 시 연령/약관 | 서버 검증 방식 미정 | `auth.users` insert 트리거(`handle_new_user`)가 `age_confirmed`/`terms_agreed` 메타데이터를 강제하고 `profiles` 생성 | **자기 선언 방식**. 더 강한 검증 필요 여부는 DEC 미결 |
| 게스트의 `list_cards` | - | `anon`에 `user_cards`/`wishlist_items` SELECT 부여 | RLS 정책이 `authenticated` 전용이라 anon은 항상 0행. 부여하지 않으면 조인 때문에 게스트 조회가 깨짐 |
| 잘못된 sort 에러코드 | PT422 | PT400 | 동작상 동일하게 클라이언트에서 `VALIDATION_FAILED`로 처리 |
| 희귀도 정렬 | DEC-11 미정 | 제안안을 `seed_rarities` 마이그레이션으로 적용 | 값은 `rarities.sort_order`. 확정 시 UPDATE만 하면 됨 |

## 2. 데이터 현황 (card-dex)

- 세트 176개, 카드 20,635장 (전부 이미지 URL 보유), 영어판.
- 카드 목록 전체 순회 테스트: 5개 정렬 × 2방향 모두 중복/누락 0건, 페이지당 약 30~60ms (DB 내부 측정).

## 3. 실행 방법

```text
# 카탈로그 (재)적재: 운영자 전용
node scripts/import-catalog.mjs                 # 전체
node scripts/import-catalog.mjs --only base1    # 일부 세트

# 앱
cd mobile
npm install
copy .env.example .env     # URL / publishable key 입력 (공개값만)
npx expo prebuild --platform android --no-install   # android/ 재생성이 필요할 때만
# Android Studio에서 mobile/android 열기 → Run
```

- `mobile/android/.idea/workspace.xml`에 `AutoImportSettings.autoReloadType=ALL`을 두어 Gradle 자동 리로드를 유지한다.
- `mobile/.npmrc`의 `legacy-peer-deps=true`는 Expo 57 + expo-router의 optional peer(react-native-worklets) 충돌 회피용.

## 4. 테스트 결과 (DB 레벨, 롤백 트랜잭션)

- 가입 트리거: 동의 누락 시 거부, 정상 가입 시 `profiles` 생성.
- RLS: 타 사용자 명의로 INSERT 거부, 타 사용자 `user_cards` 조회 0건, 타 사용자 행 DELETE 0건, anon 조회 0건.
- `list_cards`: 로그인 시 `owned`/`wished` 포함, 게스트는 필드 없음, `owned` 필터 게스트 PT401, `lim` 범위/잘못된 sort/커서 오류 코드 확인.
- 보안 어드바이저: ERROR/WARN 없음 (INFO: `admin_secrets`, `sync_jobs`는 정책 없음 = 의도된 클라이언트 접근 차단).

## 5. 남은 작업

- 실기기/에뮬레이터 수동 확인(목록·검색·필터·상세·로그인 복귀 흐름).
- `delete-account` Edge Function (계정 삭제, 스토어 요건).
- 커스텀 SMTP, 약관/개인정보처리방침 문서와 링크, 앱 아이콘/스토어 자산.
- 단위/통합 테스트 자동화 (doc 08), 크래시/분석 도구 결정 (DEC-15).


## 13. 한국어 카드 이름 / 비밀번호 재설정 / 세트 탭 (추가 구현)

### 한국어 이름 (`cards.name_ko`)
- 원본(영문) 카탈로그는 그대로 두고 `name_ko`를 **파생 컬럼**으로 둔다. `before insert/update` 트리거(`ko_card_name`)가 계산하므로 동기화(sync-catalog) 때도 자동 반영된다.
- 변환 순서: ① `ko_name_overrides`(운영자 수작업/공식 목록 검증) → ② 포켓몬 카드: `pokemon_species`(PokeAPI 한/영 종명) + `ko_name_modifiers`(알로라/가라르/히스이/로켓단의/메가 …)로 조합. 번역 근거가 없으면 `NULL`.
- `NULL`이면 앱은 영문명을 그대로 표시(`cardTitles()`). 한국어가 있으면 한국어를 제목, 영문을 보조 줄로 표시. 검색은 한/영 모두(`name ilike or name_ko ilike`).
- 데이터 적재: Edge Function `sync-species`(x-sync-token 필요) → PokeAPI CSV 로드 후 `recompute_card_names_ko()` 실행.
- 커버리지(적용 직후): 포켓몬 99.9%, 에너지 54.1%(기본 에너지 확정), 트레이너스 0% → 전체 85.4%.
- 남은 항목 처리 방침: 영문 병기 유지 → 기본/특수 에너지(약 100종) 수작업 → 트레이너스(1,380종)는 인쇄 빈도순으로 공식 한글명 목록과 대조하여 `ko_name_overrides`에 추가. 번역이 없는 카드는 영어로 보인다(오역 방지).
- 주의: 트레이너/체육관 관장 접두어(이슬/웅/마티스/민화/초련/강연/비주기/독수)는 공식 표기와 대조 전이므로 출시 전 검증 필요.

### 비밀번호
- 로그인 화면 "비밀번호를 잊으셨나요?" → `resetPasswordForEmail(email, { redirectTo: pokecard://auth/reset })`. 응답은 가입 여부와 무관하게 동일(계정 존재 노출 방지).
- 메일 링크 → 딥링크 → `AuthProvider`가 토큰으로 세션 생성 → `/auth/reset`에서 새 비밀번호 설정(`updateUser({password})`).
- "내 정보" 탭에 "비밀번호 변경" 추가(`/change-password`).
- **대시보드 설정 필요**: Authentication → URL Configuration → Redirect URLs에 `pokecard://**` 추가.

### 세트 탭 / 컬렉션
- 새 "세트" 탭: 시리즈별 세트 로고 그리드, 로그인 시 세트별 진행률. 세트를 누르면 해당 세트 카드 목록으로 이동.
- 컬렉션 상단에 원형 진행 그래프(`ProgressRing`, 네이티브 의존성 없음).