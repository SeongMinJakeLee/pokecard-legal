# 05. API 명세서

관련 문서: [02 기능](02-functional-spec-and-scenarios.md) · [04 DB](04-database-and-erd.md) · [07 보안/예외](07-error-handling-and-security.md) · [10 추적표](10-traceability-review.md)

> 인증 방식(DEC-04), 게스트 열람(DEC-07)은 미확정이다. 아래는 **제안 기준** 명세이며, 해당 항목은 `⚠ 조건부`로 표시한다.
> 구현 시 이 문서를 기준으로 **OpenAPI 문서**를 작성하고 계약 테스트의 기준으로 사용한다.

## 0. Supabase 구현 매핑 (2차 갱신)

> **Supabase 기반 서버리스로 확정**(03 §8)되어, 아래 §1~§6의 REST 경로는 **논리 API 계약(입력/출력/에러/권한 규칙)** 으로 유지하고, 실제 호출 방식은 이 표를 따른다. 앱은 `supabase-js`와 RPC를 서비스 계층 한 곳에서만 호출한다.
> 인증 방식(DEC-04)과 게스트 열람(DEC-07)은 **확정**되었다 (이메일+비밀번호, 게스트 허용). §2의 `⚠ 조건부` 표기는 이메일+비밀번호 기준으로 확정된 것으로 읽는다.

| 논리 API (본문) | Supabase 구현 | 비고 |
|-----------------|---------------|------|
| 2.1 `POST /auth/signup` | `supabase.auth.signUp` (이메일 확인 메일 → 딥링크) | 연령 확인 서버 검증은 미확정(03 §8.5) |
| 2.2 `POST /auth/login` | `supabase.auth.signInWithPassword` | |
| 2.3 `POST /auth/refresh` | SDK가 자동 갱신 | refresh 회전/재사용 감지는 Auth 설정으로 |
| 2.4 `POST /auth/logout` | `supabase.auth.signOut` | |
| 2.5 `GET /users/me` | `supabase.auth.getUser` + `profiles` 조회 | |
| 2.6 `POST /users/me/deletion` | **Edge Function `delete-account`** (비밀번호 재확인 후 service role로 사용자 삭제, CASCADE) | 클라이언트에서 직접 삭제 불가 (service role 필요) |
| 2.7 비밀번호 재설정 | `resetPasswordForEmail` + 딥링크 + `updateUser` | 출시 전 필수, 커스텀 SMTP 필요 |
| 3.1 `GET /cards` | RPC `list_cards` | 응답은 아래 JSON 계약과 동일하게 반환 |
| 3.2 `GET /cards/{id}` | RPC `get_card` | |
| 3.3 `GET /sets` | RPC `list_sets` 또는 `card_sets` SELECT | |
| 3.4 `GET /filters` | RPC `get_filters` | |
| 4.1 `PUT /users/me/cards/{id}` | `user_cards` upsert(`ignoreDuplicates`) 또는 RPC `set_owned` | RLS가 본인만 허용 |
| 4.2 `DELETE /users/me/cards/{id}` | `user_cards` delete | |
| 5. `/health` | Supabase 상태 + 간단 RPC 핑(선택) | |
| 동기화 | Edge Function `sync-catalog` (공개 호출 차단: 서비스 키/전용 시크릿 헤더 검증) | |

**에러 코드 매핑**: Supabase(Auth/PostgREST/Edge)의 에러 형식은 §1.2와 다르다. 앱의 서비스 계층이 Supabase 에러를 §1.3의 **논리 코드**(`INVALID_CREDENTIALS`, `EMAIL_ALREADY_EXISTS`, `RATE_LIMITED` 등)로 변환해 UI에 전달한다. RPC 함수는 `raise exception`에 안정적인 코드 문자열을 포함해 변환 규칙을 단순화한다.

**제한/남용 방지**: PostgREST/RPC에는 기본 IP별 요청 제한이 없으므로 `list_cards`는 `lim` 상한(100), 쿼리 비용 제한(검색어 길이 등), 필요 시 CDN/캐시 또는 Edge Function 앞단 레이트 리밋을 둔다 (07 §6).

## 1. 공통 규칙

| 항목 | 규칙 |
|------|------|
| Base URL | `https://{host}/api/v1` (버전 prefix, ADR-04) |
| 형식 | JSON (`Content-Type: application/json; charset=utf-8`) |
| 인증 | `Authorization: Bearer <access_token>` ⚠ 조건부(방식 DEC-04) |
| 시간 | ISO 8601 UTC (`2026-10-07T01:23:45Z`) |
| ID | 사용자 ID = UUID, 카드/세트 ID = 소스 문자열 (`swsh4-25`) |
| 페이징 | 커서 기반: `limit`(기본 30, 최대 100), `cursor`(불투명 문자열) |
| 요청 추적 | 서버가 `X-Request-Id` 생성/반환. 에러 응답에 포함 |
| 멱등성 | `PUT`/`DELETE`는 반복 호출해도 같은 결과 |
| 레이트 리밋 | 초과 시 429 + `Retry-After` 헤더 (한도 값은 07 문서) |

### 1.1 인증 요구 표기
- 🔓 공개 (게스트 허용, DEC-07 제안안 기준)
- 🔐 로그인 필요
- 🔓➕🔐 공개이나 로그인 시 추가 필드(`owned`) 제공

### 1.2 공통 에러 응답 형식

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "요청 값이 올바르지 않습니다.",
    "details": [{ "field": "email", "reason": "invalid_format" }],
    "requestId": "7c9e6679-7425-40de-944b-e07fc1f90ae7"
  }
}
```
- `message`는 사용자에게 보여줄 수 있는 한국어 문구. 내부 정보(스택, SQL 등)는 절대 포함하지 않는다.
- 앱은 `code` 기준으로 분기한다 (문구에 의존 금지).

### 1.3 공통 에러 코드

| HTTP | code | 설명 |
|------|------|------|
| 400 | BAD_REQUEST | 형식 오류(JSON 파싱 등), 잘못된 커서 |
| 401 | UNAUTHENTICATED | 토큰 없음/만료/위조 |
| 401 | TOKEN_EXPIRED | access 토큰 만료 (갱신 유도) |
| 401 | INVALID_CREDENTIALS | 로그인/탈퇴 재확인 시 이메일·비밀번호 불일치 (계정 존재 여부 비노출) |
| 401 | REFRESH_TOKEN_INVALID | refresh 토큰 만료/폐기/재사용 감지 → 재로그인 필요 |
| 403 | FORBIDDEN | 권한 없음 |
| 404 | NOT_FOUND | 리소스 없음 (카드/세트) |
| 409 | EMAIL_ALREADY_EXISTS | 이메일 중복 |
| 422 | VALIDATION_FAILED | 필드 검증 실패 |
| 429 | RATE_LIMITED | 호출 한도 초과 |
| 500 | INTERNAL_ERROR | 서버 오류 |
| 503 | SERVICE_UNAVAILABLE | 점검/일시 장애 |

---

## 2. 인증/계정 API ⚠ 조건부 (이메일+비밀번호 기준)

### 2.1 회원가입 — FR-AUTH-01 (P0) 🔓
`POST /auth/signup`

요청
```json
{ "email": "user@example.com", "password": "********", "displayName": "민수", "termsAgreed": true }
```
응답 `201`
```json
{
  "user": { "id": "uuid", "email": "user@example.com", "displayName": "민수" },
  "tokens": { "accessToken": "...", "accessTokenExpiresIn": 900, "refreshToken": "..." }
}
```
에러: `409 EMAIL_ALREADY_EXISTS`, `422 VALIDATION_FAILED`(형식/길이/약관 미동의), `429`

### 2.2 로그인 — FR-AUTH-02 (P0) 🔓
`POST /auth/login`

요청 `{ "email": "...", "password": "..." }` → 응답 `200` (가입 응답과 동일 구조)
에러: `401 INVALID_CREDENTIALS`(계정 존재 여부 비노출), `429`

### 2.3 토큰 갱신 — FR-AUTH-04 (P0) 🔓
`POST /auth/refresh`

요청 `{ "refreshToken": "..." }` → 응답 `200` `{ "tokens": {...} }` (**refresh 토큰 회전**: 새 토큰 발급, 이전 토큰 폐기)
에러: `401 REFRESH_TOKEN_INVALID`(만료/폐기/재사용 감지)

### 2.4 로그아웃 — FR-AUTH-03 (P0) 🔐
`POST /auth/logout`

요청 `{ "refreshToken": "..." }` → `204`. 해당 refresh 토큰 폐기(멱등).

### 2.5 내 정보 — (P0) 🔐
`GET /users/me` → `200` `{ "id", "email", "displayName", "createdAt" }`

### 2.6 회원 탈퇴 — FR-AUTH-05 (P0) 🔐
`POST /users/me/deletion`

> `DELETE` 메서드에 본문을 실으면 일부 HTTP 클라이언트/프록시가 본문을 제거하므로, 비밀번호 재확인 본문을 안전하게 전달하기 위해 `POST` 로 설계한다. (10 문서 검토 이슈 #1)

요청 본문 `{ "password": "..." }` (재확인) → `204`
- 소셜 전용 계정(비밀번호 없음)의 재확인 방식은 FR-AUTH-07 설계 시 정의 (재로그인 토큰 확인 등)
- 사용자 행 삭제 → `user_cards`, `refresh_tokens`, `wishlist_items` CASCADE 삭제
- 에러: `401 INVALID_CREDENTIALS`(비밀번호 불일치)
- 웹 삭제 요청 경로(스토어 정책)는 07 문서 참고

### 2.7 비밀번호 재설정 — FR-AUTH-06 (P1, 출시 전 필수) 🔓
- `POST /auth/password-reset/request` `{ "email" }` → 항상 `202` (계정 존재 여부 비노출)
- `POST /auth/password-reset/confirm` `{ "token", "newPassword" }` → `204`, 모든 refresh 토큰 폐기

### 2.8 소셜 로그인 — FR-AUTH-07 (P1, 조건부)
`POST /auth/social/google` `{ "idToken": "..." }` → 로그인 응답과 동일. DEC-04 확정 시 상세화.

---

## 3. 카드 데이터 API

### 3.1 카드 목록 — FR-CARD-01/02/03/04, FR-OWN-02/03 (P0) 🔓➕🔐
`GET /cards`

| 쿼리 | 타입 | 기본 | 설명 |
|------|------|------|------|
| q | string | - | 이름 부분 일치(대소문자 무시). 길이 1~50 |
| setIds | string(콤마 구분) | - | 세트 ID 목록 (OR) |
| types | string(콤마 구분) | - | 타입 목록 (OR) |
| rarities | string(콤마 구분) | - | 희귀도 목록 (OR) |
| owned | `all`\|`owned`\|`unowned` | `all` | 🔐 필요. 비로그인 시 `all` 외 값은 401 |
| sort | enum | `releaseDate` | `name`, `releaseDate`, `number`, `hp`, `rarity` |
| order | `asc`\|`desc` | 정렬별 기본값(아래) | |
| limit | int | 30 | 1~100 |
| cursor | string | - | 이전 응답의 `nextCursor` |
| includeTotal | bool | false | true면 조건에 맞는 전체 건수 포함 (비용 큼, 필요 시만) |

- 필터 조합: **항목 내 OR, 항목 간 AND**
- 정렬 기본 방향: `name`=asc, `releaseDate`=desc, `number`=asc, `hp`=desc, `rarity`=desc(희귀한 순). 모든 정렬에 `id`를 보조키로 사용.
- `hp`가 없는 카드는 방향과 무관하게 항상 뒤. `rarity` 매핑 없는 값도 뒤.
- 비활성 카드는 제외하되 `owned=owned`일 때 보유한 비활성 카드는 포함.

응답 `200`
```json
{
  "data": [
    {
      "id": "swsh4-25",
      "name": "Charizard",
      "supertype": "Pokémon",
      "types": ["Fire"],
      "rarity": "Rare Holo VMAX",
      "number": "25",
      "set": { "id": "swsh4", "name": "Vivid Voltage" },
      "images": { "small": "https://...", "large": "https://..." },
      "owned": true
    }
  ],
  "page": { "limit": 30, "nextCursor": "eyJ...", "hasNext": true, "total": 1234 }
}
```
- `owned`: 로그인 시에만 포함. 게스트는 필드 생략.
- `total`: `includeTotal=true`일 때만.
- 에러: `400 BAD_REQUEST`(잘못된 cursor/sort), `422 VALIDATION_FAILED`(limit 범위 등), `401`(비로그인 + `owned` 필터)
- 커서는 `정렬키 + id`를 인코딩하며, **정렬/필터가 바뀌면 이전 커서는 무효** (클라이언트는 조건 변경 시 cursor 초기화).

### 3.2 카드 상세 — FR-CARD-05 (P0) 🔓➕🔐
`GET /cards/{cardId}`

응답 `200`
```json
{
  "id": "swsh4-25",
  "name": "Charizard",
  "supertype": "Pokémon",
  "subtypes": ["Stage 2"],
  "hp": 170,
  "types": ["Fire"],
  "evolvesFrom": "Charmeleon",
  "evolvesTo": [],
  "rules": [],
  "abilities": [{ "name": "Battle Sense", "text": "...", "type": "Ability" }],
  "attacks": [{ "name": "Royal Blaze", "cost": ["Fire","Fire"], "convertedEnergyCost": 2, "damage": "100+", "text": "..." }],
  "weaknesses": [{ "type": "Water", "value": "×2" }],
  "resistances": [],
  "retreatCost": ["Colorless","Colorless","Colorless"],
  "set": { "id": "swsh4", "name": "Vivid Voltage", "series": "Sword & Shield", "releaseDate": "2020-11-13", "logo": "https://..." },
  "number": "25",
  "artist": "Ryuta Fuse",
  "rarity": "Rare",
  "flavorText": "...",
  "nationalPokedexNumbers": [6],
  "images": { "small": "https://...", "large": "https://..." },
  "owned": true
}
```
- 시세는 P1에서 `prices` 필드로 확장 (3.5 참고). 필드 추가는 하위 호환 변경으로 취급.
- 에러: `404 NOT_FOUND`

### 3.3 세트 목록 — FR-SET-01 (P0) 🔓
`GET /sets`

쿼리: `series`(선택), `limit`/`cursor`는 제공하지 않고 전체를 반환(세트 수가 수백 개 이하 가정, 구현 시 실제 건수 확인).

응답 `200`
```json
{
  "data": [
    { "id": "swsh4", "name": "Vivid Voltage", "series": "Sword & Shield",
      "total": 203, "printedTotal": 185, "releaseDate": "2020-11-13",
      "images": { "symbol": "https://...", "logo": "https://..." } }
  ]
}
```
- 기본 정렬 `releaseDate desc`. 캐시 가능(`Cache-Control`/`ETag`).

### 3.4 필터 옵션 — FR-CARD-03 (P0) 🔓
`GET /filters`

응답 `200`
```json
{
  "types": ["Colorless","Darkness","Dragon","Fairy","Fighting","Fire","Grass","Lightning","Metal","Psychic","Water"],
  "rarities": ["Common","Uncommon","Rare","Rare Holo", "..."],
  "supertypes": ["Energy","Pokémon","Trainer"]
}
```
- 값은 DB의 실제 데이터(DISTINCT)에서 생성. 캐시 권장. `rarities`는 `rarities.sort_order` 순서로 반환.
- `supertypes`는 P1 필터 확장용으로 미리 제공한다. MVP의 `GET /cards`에는 해당 필터 파라미터가 없다 (10 문서 이슈 #4).
- 세트 목록은 `/sets` 사용(중복 제공 안 함).

### 3.5 (P1) 시세 — FR-PRICE-01
상세 응답에 포함 `prices` 필드 제안:
```json
"prices": {
  "tcgplayer": { "currency": "USD", "updatedAt": "2026-10-06", "variants": { "holofoil": { "low": 1.2, "mid": 3.5, "high": 12.9, "market": 2.8 } } },
  "cardmarket": { "currency": "EUR", "updatedAt": "2026-10-06", "trendPrice": 10.29, "averageSellPrice": 9.38, "lowPrice": 8.95 }
}
```
- 별도 엔드포인트 분리(`GET /cards/{id}/prices`)도 가능 — P1 설계 시 결정

---

## 4. 보유 관리 API

### 4.1 보유 설정 — FR-OWN-01 (P0) 🔐
`PUT /users/me/cards/{cardId}`

- 본문 없음. 이미 보유 중이어도 성공(멱등).
- 응답 `204` (또는 `200 { "cardId": "...", "owned": true }` — 구현 시 하나로 통일, **제안: 204**)
- 에러: `404 NOT_FOUND`(카드 없음), `401`

### 4.2 보유 해제 — FR-OWN-01 (P0) 🔐
`DELETE /users/me/cards/{cardId}`

- 보유 중이 아니어도 `204` (멱등). 존재하지 않는 카드 ID여도 `204`로 처리 **[제안]**(해제의 결과 상태가 이미 달성됨).
- 에러: `401`

### 4.3 내 보유 카드 목록 — (P0, 선택) 🔐
`GET /users/me/cards`

- `GET /cards?owned=owned`와 동일 결과를 제공하는 별칭 성격. 중복 구현을 피하기 위해 **MVP에서는 제공하지 않고** `GET /cards?owned=owned`를 사용한다 **[제안]**. 별도 요구(예: 통계/내보내기)가 생기면 추가.

### 4.4 (P1) 세트 진행률 — FR-PROG-01 🔐
`GET /users/me/progress` → 세트별 `{ setId, ownedCount, totalCount }` 목록. `?setId=` 로 단일 세트 조회.

### 4.5 (P0) 위시리스트 — FR-WISH 🔐 **[1차 출시 포함 확정]**
- `PUT /users/me/wishlist/{cardId}` → `204` (멱등). 존재하지 않는 카드 `404 CARD_NOT_FOUND`
- `DELETE /users/me/wishlist/{cardId}` → `204` (멱등, 이미 없어도 204)
- `GET /users/me/wishlist?limit=&cursor=` → 카드 목록(§3.1)과 동일 항목 형식(`owned`, `wished` 포함) + 커서 페이징, 정렬은 담은 시각 최신순. 비로그인 `401 UNAUTHENTICATED`
- 카드 목록/상세 응답에 **`wished`**(로그인 시 boolean, 게스트는 필드 생략 또는 null — `owned`와 동일 규칙) 필드 추가
- Supabase 매핑: `wishlist_items` 테이블 직접 upsert/delete(RLS) + `list_wishlist` RPC (04 §9)
- 위시리스트 때문에 `GET /cards`에 `wished=wished|unwished` 필터를 추가할지는 **보류**(위시 전용 화면이 있으므로 MVP 제외, 제안)

---

## 5. 내부/운영 (공개 API 아님)

| 대상 | 방식 | 비고 |
|------|------|------|
| 카드/세트 동기화 | 서버 내부 스케줄 작업 (+ 수동 실행용 CLI/명령) | 공개 엔드포인트로 노출하지 않음 (보안) |
| 헬스체크 | `GET /health` (공개, 상태만 반환) | 로드밸런서/모니터링용. 내부 정보 미노출 |
| 동기화 상태 조회 | 운영자 전용 수단(로그/DB 조회) | 관리자 API는 범위 제외 |

---

## 6. 엔드포인트 요약 표

| # | 메서드 | 경로 | 인증 | 기능 ID | 우선순위 |
|---|--------|------|------|---------|----------|
| 1 | POST | /auth/signup | 🔓 | FR-AUTH-01 | P0 |
| 2 | POST | /auth/login | 🔓 | FR-AUTH-02 | P0 |
| 3 | POST | /auth/refresh | 🔓 | FR-AUTH-04 | P0 |
| 4 | POST | /auth/logout | 🔐 | FR-AUTH-03 | P0 |
| 5 | GET | /users/me | 🔐 | FR-AUTH-02/04 | P0 |
| 6 | POST | /users/me/deletion | 🔐 | FR-AUTH-05 | P0 |
| 7 | GET | /cards | 🔓➕🔐 | FR-CARD-01~04, FR-OWN-02/03 | P0 |
| 8 | GET | /cards/{cardId} | 🔓➕🔐 | FR-CARD-05, FR-OWN-02 | P0 |
| 9 | GET | /sets | 🔓 | FR-SET-01 | P0 |
| 10 | GET | /filters | 🔓 | FR-CARD-03 | P0 |
| 11 | PUT | /users/me/cards/{cardId} | 🔐 | FR-OWN-01 | P0 |
| 12 | DELETE | /users/me/cards/{cardId} | 🔐 | FR-OWN-01 | P0 |
| 13 | GET | /health | 🔓 | NFR-OBS-01 | P0 |
| 14 | POST | /auth/password-reset/request, /confirm | 🔓 | FR-AUTH-06 | P1 |
| 15 | POST | /auth/social/google | 🔓 | FR-AUTH-07 | P1 |
| 16 | GET | /users/me/progress | 🔐 | FR-PROG-01 | **보류** (사용자 결정) |
| 17 | PUT/DELETE/GET | /users/me/wishlist[/{cardId}] | 🔐 | FR-WISH-01/02 | **P0** (확정) |

## 7. API 설계 상 열린 이슈
| # | 이슈 | 결정 시점 |
|---|------|-----------|
| 1 | 게스트 열람 허용(DEC-07)에 따라 3.1~3.4의 인증 요건 확정 | Phase 0 |
| 2 | 인증 방식(DEC-04)에 따라 2.x 상세 변경 | Phase 0 |
| 3 | `GET /sets`가 전체 반환 가능한 규모인지 동기화 후 확인 | Phase 2 |
| 4 | 목록 `total` 제공 방식(성능 비용) | Phase 3 |
| 5 | 보유 설정 응답 `204` vs `200` 통일 | Phase 5 |
