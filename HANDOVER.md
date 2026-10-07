# 아이언 스트라이커 인수인계서

작성 시점: 2026-09-20. 이 문서는 **다음 작업자(또는 에셋을 직접 만들 본인)** 를 위한 것입니다.
게임 사용법은 [README.md](README.md)에 있고, 여기에는 구조·교체 방법·남은 일만 적습니다.

## 현재 상태: 7스테이지 + EASY/HARD

- 2026-10-07 추가 개선: 플레이어의 중앙 피격 반경을 5→3px로 줄였습니다. 날개·보조 포드에는
  적탄 판정을 두지 않으며 EASY/HARD 모두 같은 판정입니다. `api.onBossPhase()`에서 적탄 초기화를
  제거해 이전 페이즈의 일반탄·유도탄·분열탄은 정상 이동과 유도/분열 처리를 이어갑니다.
  미발사 살보/조준 예약만 정리하는 `Bosses.update()`의 전환 간격은 유지합니다.
- 1·3·4탄 전용 손상 원화 3장을 내장 ImageGen으로 원래 보스에 맞춰 편집했습니다.
  `assets/boss1-breakwater-damaged-v1.webp`, `s3-boss-damaged-v1.webp`, `canopy-boss-damaged-v1.webp`이며
  `bossDamageBody()`는 파괴한 부위만 원래 픽셀을 지우고 등록된 영역으로 교체합니다.
  합계 262,310B이며 bg1/bg3/bg6을 준비할 때만 로드합니다. bg6은 현재 4탄 밀림입니다.
  전체 프롬프트는 `assets/boss-damage-imagegen-v1.json`, 용량·알파 검사는 `assets/boss-damage-loading-v1.json`,
  원본 사본은 `../output/imagegen/boss-damage-v1/`입니다. 재처리 명령:
  `python tools/prepare-boss-destruction-assets.py --manifest assets/boss-damage-imagegen-v1.json --archive ../output/imagegen/boss-damage-v1 --report assets/boss-damage-loading-v1.json`.
  `check-boss-destruction.cjs`는 각 부위 밖 정상 픽셀 보존과 지연 로딩도 검사합니다.
- 터치 기기에 `btnPause`를 추가했습니다. `resize()`에서 실제 캔버스 높이에 맞춰 보스 HUD 아래에
  위치시키며 버튼 클릭과 키보드 활성화를 지원합니다. `resumeGame()`은 `G.state='resume'`,
  `resumeRemaining=3`으로 진입하고, 모든 시뮬레이션을 멈춘 채 준비 숫자만 갱신합니다.
  `finishResumeCountdown()`에서 입력을 비우고 플레이/BGM을 재개합니다. 준비 중 다시 일시정지하거나
  탭을 숨기면 취소하며 시작·스테이지 전환·클리어·게임오버·엔딩·타이틀에서 상태를 정리합니다.
  `node tools/check-mobile-pause.cjs`가 실제 적탄·보스 격파를 포함한 정지, BGM 호출 시점, 취소,
  320×568·390×844·844×390 화면을 검사합니다. 캡처는 `../output/striker-mobile-pause-qa/`에 있습니다.
  `browser-seven-stages.cjs`의 EASY/HARD 7탄 진행과 피격/탄막 유지 검사도 통과했습니다.
  이 검사는 Edge 자동화이며 실제 휴대폰과 음향 출력 확인은 별도로 해야 합니다.

- 2026-10-07 추가 수정: 5탄 칼데라의 원래 포대·포신을 교체하는 전용 손상 원화를 제작했습니다.
  `bossDamageBody('bossCaldera')`는 좌우 포대의 긴 포신까지 원래 픽셀을 지우고 전용 손상 영역으로 교체합니다.
  손상된 쪽만 바꾸며 반대 포대와 노심은 그대로 둡니다. 공용 잔해는 칼데라에 사용하지 않습니다.
  활성 파일은 `boss-heavy-blast-v3.webp`, `boss-reactor-blast-v3.webp`, `caldera-boss-damaged-v1.webp`입니다.
  전용 손상 원화는 기존 `regent-damaged-v1.webp`를 유지합니다. 새 프롬프트·원본은 `assets/boss-destruction-imagegen-v3.json`입니다.
  전 보스의 날아가는 파편, 파편 원화 로딩, `wreckFragment()`를 제거하고 폭발 원화 안의 금속 조각도 없앴습니다.
  `Bosses.draw()`의 함체 페이드는 1.48~2.06초이며, 최종 폭발 크기를 함체 크기에 맞춥니다. 정산은 기존 2.4초입니다.
  새 원화 3장 합계는 718,706B, 리전트 손상 원화 포함 격파 파일 4장은 878,090B입니다.
  검사는 `node tools/check-boss-destruction.cjs`, 현재 캡처는 `../output/striker-boss-destruction-qa-v3/`입니다.
- `js/boss-destruction.js`는 7개 보스의 격파 전용 시퀀스입니다. `killBoss()`에서 `deathFx`를 만들고,
  실제 `boss.dying`으로만 진행해 일시정지·히트스톱·새 탄 초기화와 동기화합니다.
  연쇄 화재·1.5초 최종 폭발을 별도 경로로 그려 일반 파티클 풀 포화와 독립적으로 표시합니다.
  기존 보상·잔탄 보너스·2.4초 정산 전환은 유지합니다.
- ImageGen으로 공용 화재·최종 동력로 점화 16프레임 시트, 칼데라·리전트 손상 원화를 제작했습니다.
  폭발·칼데라는 `assets/boss-destruction-imagegen-v3.json`, 리전트는 v1 기록에 프롬프트·원본 위치가 있습니다.
  `bossDamageBody('boss5')`는 좌우 무장부·동력로의 손상 영역만 전용 원화로 바꿉니다.
  나이트 아크의 기존 `boss4Body()` 손상 합성은 그대로 사용합니다.
- `tools/prepare-boss-destruction-assets.py`는 원본을 보관하고 폭발 시트 1024²·칼데라 손상 원화 768px를
  WebP quality90으로 저장합니다. 인코딩 전후 알파 일치를 검사합니다. v3 재처리는
  `python tools/prepare-boss-destruction-assets.py --manifest assets/boss-destruction-imagegen-v3.json --archive ../output/imagegen/boss-destruction-v3 --report assets/boss-destruction-loading-v3.json`입니다.
  기존 지상 9장·야간 본체/손상 2장·공용 잔해도 WebP로 압축해 로딩 용량을 79.8% 줄였습니다.
  PNG와 원본은 보관하고 `CORE`·`STAGE4`는 WebP를 사용합니다. 상세 용량은 `assets/boss-destruction-loading-v1.json`입니다.
- `Assets.loadBg()`는 공용 대형 폭발을 재사용하고, bg5를 준비할 때만 최종 동력로와 손상 원화를 로드합니다.
  bg5는 현재 7탄이며 6탄에서 다음 전장 사전 로딩으로 준비합니다.
- 기본 지상 목표 6종의 코드 생성 PNG를 내장 ImageGen 투명 원화 9장으로 교체했습니다.
  `assets/ground/*-imagegen-v1.png`는 384px, `assets/ground/imagegen-v1.json`에 프롬프트·원본·회전축·크기가 있습니다.
  원본 사본은 `../output/imagegen/ground-v1/`, 준비 도구는 `tools/prepare-ground-assets.ps1`입니다.
  `FRAMES.ground`의 pivot은 실제 포탑·안테나 연결부에 맞추고 scale로 기존 크기에 맞춥니다.
  `GROUND`의 체력·판정·사격·드롭·연료고 연쇄 피해와 기존 야간·요새 원화는 그대로 사용합니다.
  `tools/ground-art.html`은 확대·게임 크기·7개 배경의 조준/회전 미리보기입니다.
  `node tools/check-ground-art.cjs`로 알파·로딩·조준·회전·이동·사격·파괴 보상·연쇄 피해를 검사하며
  결과·브라우저 캡처는 `../output/striker-ground-qa/`에 저장합니다.
- 보스 예정 이벤트는 `G.bossPending`으로 예약하고, 실제 중간보스 격파(`G.midbossDefeated`) 후에만
  2.4초 경고와 등장을 진행합니다. 중간보스는 시간 경과로 퇴장하지 않습니다.
  `startStage()`에서 두 상태를 초기화하므로 다음 탄·컨티뉴·새 게임에 예약이 이어지지 않습니다.
  `tools/browser-seven-stages.cjs`는 두 모드 전 7탄의 조기/지연 격파, 미격파·부분 피해·일시정지,
  컨티뉴·새 게임 초기화를 검사합니다. 피해는 실제 `damageEnemy()`로 처리합니다.
- 보스 탄막을 페이즈별로 구분했습니다. `Bosses.DEFS[*].phaseNames`는 각 보스의 3개 이름이며 HUD에 표시합니다.
  통로 탄벽·진자 사격·교차탄·꽃잎탄·나비 날개·이중 나선을 기존 공격 대신 사용해 밀도만 늘리지 않았습니다.
- `Bosses.update()`에서 66%·33% 전환 시 사격 단계·대기 연속 포격·조준 잠금·보조 타이머를 정리합니다.
  `Game`의 `onBossPhase()`는 남은 적탄을 지우고 패턴 이름을 알립니다. 점수와 이동 시계는 그대로 이어집니다.
- 밀림 중무장기·화산 폭격기를 내장 ImageGen으로 생성해 `assets/canopy-gunship-v1.png`·`caldera-bomber-v1.png`에
  저장했습니다. `assets/phase-variety-imagegen-v1.json`에 프롬프트·원본 위치가 있습니다. 원본 RGBA를 그대로 사용합니다.
  `enemyForStage()`에서 무장 역할을 새 원화로 매핑하며 체력·피격 반지름·공격 역할은 보존합니다.
- `tools/boss-patterns.html`은 보스 실제 공격 함수를 공유하는 7탄·3페이즈·두 모드의 조작 가능한 미리보기입니다.
  호위기 이동·공격은 간략한 표현입니다. `tools/test-phase-variety.cjs`와 `tools/check-seven-previews.cjs`로 확인합니다.

- 시작 화면에서 EASY/HARD를 고릅니다. 기본값 EASY, 마지막 선택 `is_difficulty` 저장, 진행 중 모드 고정.
- `js/difficulty.js`에서 모드 배율·자원·편대 수·탄막 수·기록 키를 관리합니다.
  HARD는 기존 설정이며 EASY는 적 수 약 2/3, 일반 체력 70%, 지상·중간보스 체력 75%, 보스·부위 80%,
  적탄 속도 78%, 공격 타이머 속도 80%, 큰 부채꼴·원형 탄막 수를 축소합니다.
- EASY 시작 잔기 5·폭탄 3·화력 2, HARD는 3·2·1. EASY 피격은 화력 한 단계 감소, HARD는 1로 초기화.
  EASY 부활 무적 4초, HARD 2.8초. 컨티뉴도 해당 모드 자원으로 복원합니다.
- 일반·지상·중간보스·보스 공격 간격에 배율 적용. `eShot()`에서 속도를 한 번 적용하며,
  `eMissile()`의 가속·최대 속도도 같은 배율을 사용합니다. 이동·사망 연출 시간은 원래 시간을 사용합니다.
- HARD 기록 키 `is_hi`·`is_last`·`is_scores` 보존, EASY는 `is_easy_*`. 진행 전 도움말이나
  엔딩 복귀에서 기록이 생기거나 중복 저장되지 않도록 `G.hasRun`·`G.scoreSaved`로 제한합니다.
- `node tools/test-difficulty.cjs`: 7보스 × 3페이즈 × 정상/부위 파괴 상태의 20초 표본 검사.
  `node tools/browser-seven-stages.cjs`: 두 모드의 실제 자원·피격·부활·게임 오버·컨티뉴·기록·선택 저장·전체 진행.
  현재 결과·캡처 `../output/striker-difficulty-qa/`, 판단과 한계는 `tools/difficulty-review.md`.

- 순서: 군도 → 사막 → 빙하 → 밀림 → 화산 → 야간 공업지대 → 철의 요새.
- 기존 4·5탄은 6·7탄으로 이동했으며 기존 원화·배경 ID 4·5와 파일명은 보존했습니다.
- 새 4·5탄의 요격기·중간보스·보스 6장과 배경 2장은 내장 ImageGen으로 제작했습니다.
  사용 파일은 `assets/{canopy,caldera}-*-v1.*`, 프롬프트·원본 위치는 `assets/seven-stage-imagegen-v1.json`,
  원본 사본은 `../output/imagegen/seven-stage-v1/`입니다. `tools/seven-stage-art.html`에서 비교할 수 있습니다.
- 새 배경 ID 6·7은 각각 밀림·화산을 뜻합니다. `loadBg`는 배경 ID를 받고, 게임 스테이지 번호와 구분합니다.
  `enemyForStage`와 `groundForStage`의 야간 원화 선택은 숫자 인덱스 대신 보스 ID를 사용합니다.
- 난이도는 각 스테이지의 `enemyHpMul`·`groundHpMul`·`bulletMul`, BGM은 명시적인 7개 매핑입니다.
  기존 야간·요새의 난이도 수치는 보존했고 새 음악은 만들지 않았습니다.
- 밀림은 양갈래 탄막, 화산은 점선 조준 예고 후 고정 방향 포격을 사용하며, 새 기체는 PNG로 렌더링합니다.
- `node tools/test-seven-stages.cjs`와 기존 적·보스·필살기 검사를 사용합니다.
  `node tools/browser-seven-stages.cjs`는 Edge에서 실제 조작, 화면 경계, 투명 PNG,
  7탄 타이틀 데모, 중간보스·3페이즈·부위 파괴·정산·ALL CLEAR를 검증합니다.
  캠페인 검사는 시간 가속·무적을 사용하므로 사람의 난이도 체감이나 실제 소리 출력을 증명하지 않습니다.
- 이전 브라우저 검사 결과와 캡처: `../output/striker-seven-qa/`.
  개발용 리뷰 사본은 `node tools/make-test.cjs`로 현재 `game.js`에서 다시 생성합니다.

## 2026-10-06 로딩 용량·저장소 차단 대응·타이틀 카드

- **원화 축소:** 게임이 실제로 받는 PNG 24장이 1254²·1536² 원본 그대로여서 첫 로딩이 15.2MB, 6탄(야간) 진입 시 19.9MB였습니다.
  표시 폭의 약 2배로 줄여 첫 로딩 **15.2 → 5.0MB**, 6탄 **19.9 → 4.0MB**, 4·5탄 전용 원화 **2.8/2.5 → 1.4/1.3MB**입니다.
  시트 자르기·부위 좌표·덕트 좌표는 모두 비율(`img.width/4` 등)이라 코드 수정은 없습니다. 파일명도 그대로입니다.
  줄인 크기: 일반 원화 512², 나이트 아크(파손 포함) 640², 효과 시트 768²(`charge-plasma` 768×512), 잔해 시트 512², 랜서 시트 768×256, 지원기 800×600, 미사일 160×240, 사막 보스 파손 768×512.
  1254² 원본과 쓰지 않던 파일(`bomb_effect1~3.png`, `explosion-sheet-v1.png`, 확장자 없는 `title-image`)은
  `../output/imagegen/striker-src/full-res-2026-10-06/`(쓰지 않던 파일은 `unused/`)로 옮겼습니다. 새 원화를 넣을 때도 같은 크기로 줄여 주세요.
- **저장소 차단 대응:** `localStorage` 접근이 예외를 던지는 환경(사이트 데이터 차단 정책, 일부 사생활 보호 모드)에서는
  `game.js` 맨 위의 읽기에서 게임 전체가 시작되지 않았습니다. `game.js`의 `store.get/set`, `audio.js`의 `readPref/writePref`로
  모두 감쌌습니다. 저장이 막히면 설정·기록은 그 실행 동안만 유지됩니다. 도구 페이지가 두 파일을 따로 불러오므로 공용 파일을 만들지 않았습니다.
- **스테이지 타이틀 카드:** 'STAGE n'과 30px 스테이지 이름이 겹쳐 보여 세 줄의 기준선을 -36/0/+28로 옮겼습니다.
- 검증: `tools/test-*.cjs`·`verify-seven-source.cjs` 전부 통과. `make-test.py` 사본으로 title·lancer·lancerburst·chargefx·wreckcheck·bomb·damage·
  1·4·5·6탄 진행 장면을 headless Chrome에서 돌려 오류 0, 축소 원화 화질 캡처 확인.
  `localStorage`가 예외를 던지게 만든 사본에서 타이틀·플레이·일시정지·게임오버·컨티뉴가 오류 없이 진행되는 것도 확인했습니다(수정 전 코드는 로딩에서 멈춤).
  `browser-seven-stages.cjs`는 Playwright 모듈 경로(`../../tmp/gradient-comparison-qa`)가 이 PC에 없어 실행하지 못했습니다.

아래 날짜별 기록은 확장 이전의 구현 기록입니다. 현재 순서와 자산 연결은 위 내용을 우선합니다.

## 2026-09-22 (2차) 보스·중간보스 등장 직후 위치가 튀던 문제

"등장은 좋은데 갑자기 좌우로 들쭉날쭉하게 움직이며 시작한다"는 제보로 찾은 **두 개의 서로 다른 버그**입니다.

### 버그 1 — 보스가 교전 시작 순간 옆으로 순간이동 (`js/bosses.js`)

- 네 보스(`breakwater` / `gemini` / `nightark` / `regent`)가 `b.x = W/2 + Math.sin(b.t * f) * amp` 로 좌우 위치를 **매 프레임 다시 계산**하고 있었습니다.
- `b.t` 는 **등장 연출 동안에도 쌓입니다.** 등장 중에는 `update()` 가 `b.x = W/2` 로 고정한 채 일찍 반환하므로 문제가 없다가, 교전으로 넘어간 첫 프레임에 `move()` 가 불리면서 `sin(b.t * f)` 가 이미 커져 있는 값으로 평가돼 **한 프레임에 x 가 110~114px 튀었습니다.**
- 같은 이유로 페이즈가 바뀔 때 주기·진폭이 동시에 바뀌면서 또 튀었습니다(`breakwater` 163px, `regent` 16px).
- 고친 방법: `swingX()` / `bobY()` 헬퍼를 두고 **교전 중에만 쌓이는 전용 위상**(`b.swing`, `b.bob`)을 씁니다. 위상이 0 에서 시작하므로 첫 프레임 위치가 등장이 끝난 자리(화면 중앙)와 그대로 이어집니다. 진폭(`b.swingAmp`)과 중심(`b.cy`, gemini 3페이즈의 -20px)은 목표값으로 서서히 옮겨 페이즈 전환에서도 튀지 않습니다.
- `dune` 은 원래 `b.x += dir * speed * dt` 증분 이동이라 x 는 그대로 두고 y 만 위상으로 바꿨습니다.

측정값(px/프레임, 값이 작을수록 부드러움):

| 보스 | 첫 교전 프레임 (전 → 후) | 페이즈 전환 (전 → 후) |
|---|---|---|
| breakwater | 110.0 → **0.9** | 163.3 → **0.4** |
| gemini | 114.0 → **1.3** | 1.3 → 4.6(3페이즈 돌진, 의도된 가속) |
| nightark | 66.3 → **0.5** | 0.2 → **0.4** |
| regent | 79.7 → **0.6** | 15.7 → **0.9** |
| dune | 2.9 → 1.6 (원래 정상) | 2.9 → 2.9 |

### 버그 2 — 중간보스가 자리를 잡은 뒤 위아래로 튕기고 좌우 이동이 끊김 (`js/game.js`)

- `midbossMove()` 가 **좌표로 도착을 판단**했습니다: `if (e.y < e.targetY) { 하강; return; }`.
- 자리를 잡은 뒤 상하 흔들림이 `targetY` 보다 위로 올라가는 순간 이 조건이 다시 참이 되어 **"하강 중" 상태로 되돌아갑니다.** 그래서 5프레임 주기로 4.3px 씩 위아래로 튕겼고(세로 이동 최대 **12.5~16.6px/프레임**), 더 중요하게는 그 프레임에 `return` 하므로 **좌우 이동 코드가 아예 실행되지 않아 가로 움직임이 뚝뚝 끊겼습니다.** 제보의 "좌우로 들쭉날쭉"은 이쪽입니다.
- 고친 방법: 좌표 대신 `e.arrived` 플래그로 판단하고, 도착 시 `e.y` 를 `targetY` 에 정확히 맞춥니다.
- 함께 고친 것: 상하 흔들림도 `e.t`(등장 전부터 쌓이고 `rand(0, 6)` 로 시작) 대신 도착 후부터 쌓는 `e.bobT` 를 씁니다. 도착 순간 세로 위치가 튀지 않습니다.
- 돌진형(3·5탄) 중간보스와 gemini 3페이즈의 돌진 목표는 `rand(-130, 130)` 처럼 **완전 무작위**라 같은 쪽으로 연달아 튈 수 있었습니다. 좌우를 번갈아 잡도록(`dashSide`) 바꿔 폭만 무작위로 남겼습니다.

측정값(도착 후 세로 이동 최대, px/프레임): 12.5~16.6 → **0.2~0.3**. 좌우가 멈춘 프레임: sway·slow형 1227프레임 중 **0회**(돌진형의 131회는 목표에 도달해 대기하는 정상 구간).

### 검증

- `python tools/make-test.py` 후 `scene=full&s=1,3,5&f=3300`, `scene=mid&s=3`, `scene=boss1/boss3/boss5` 전부 오류 0.
- 위 표의 수치는 보스 정의를 직접 구동해(`Bosses.update` 2400프레임, 중간에 페이즈 강제 전환) 프레임 간 이동량을 잰 값입니다.
- **확인하지 못한 것**: 사람 눈으로 본 체감입니다. 수치상 튐은 사라졌지만 흔들림 폭·주기 자체가 마음에 드는지는 직접 봐야 합니다. 폭을 바꾸려면 각 보스 `move()` 의 `swingX(b, dt, 주기, 진폭)` 인자만 고치면 됩니다.

---

## 2026-09-22 배경음 음원 연결 · 색조별 공격기 3종

### 배경음을 음원 파일로 바꿈 (`js/audio.js`)

- 사용자가 `assets/` 에 넣은 mp3 5개를 연결했습니다. 스테이지 4곡(4·5탄은 `stage45bgm.mp3` 공용)과 보스 등장 1곡입니다.
- 파일명은 받은 그대로 씁니다(`stage1bgm` / `stage2BGM` / `stage3bgm` / `stage45bgm` / `bossBGM`). **대소문자가 제각각이므로 이름을 바꾸거나 코드에 옮겨 적을 때 주의해야 합니다.** 대소문자를 구분하는 서버(GitHub Pages 등)에 올리면 철자가 다르면 404 입니다.
- 게임 쪽 호출부(`Snd.bgmStart(stageIndex, mode)`)는 그대로 두고 `audio.js` 안만 바꿨습니다. 보스 등장 시점(`js/game.js` 의 `Snd.bgmStart(G.stageIndex, 'boss')`)도 기존 코드 그대로입니다.
- **합성 트랙은 지우지 않고 대체용으로 남겼습니다.** `TRACKS` / `BOSS_TRACK` / `step()` 은 `synthStart()` / `synthStop()` 으로 이름만 바꿨고, 음원 로드가 실패하면(`audio` 의 error 이벤트) 그 곡으로 자동 전환합니다. 오프라인이나 파일 누락 상황에서도 소리가 끊기지 않습니다.
- 재생은 `HTMLAudioElement` 를 직접 씁니다. WebAudio `createMediaElementSource` 를 거치지 않는 이유는 `file://` 로 열었을 때 교차 출처 취급을 받아 소리가 사라질 수 있기 때문입니다. 그래서 BGM 크기는 `bgmGain` 이 아니라 요소의 `volume` 으로 조절합니다.
- **크기 조절은 `BGM_VOLUME` 한 곳입니다(현재 0.26).** 처음 0.5 로 넣었더니 탄환·폭발 효과음이 묻힌다는 피드백을 받아 낮췄습니다. 더 조절할 일이 있으면 이 상수만 바꾸면 됩니다.
- 곡을 바꿀 때는 이전 곡을 `FADE_MS`(0.32초) 동안 줄인 뒤 새 곡을 시작합니다. 보스 등장에서 뚝 끊기지 않습니다.
- 보스 곡은 4.4MB 라 등장 순간에 받기 시작하면 늦습니다. 스테이지 시작 후 `WARM_DELAY`(5초) 뒤에 미리 받아 둡니다. 스테이지 음원의 초기 버퍼링과 겹치지 않게 일부러 늦춥니다.
- 음원은 `Assets` 의 로딩 목록에 넣지 않았습니다. 5개 합계 20MB 라 로딩 화면에서 전부 받으면 시작이 너무 느려집니다. 필요한 곡만 그때 받습니다.
- 일시정지는 위치를 남기도록 `Snd.bgmPause()` / `Snd.bgmResume()` 를 새로 두고 `js/game.js` 의 `pauseGame` / `resumeGame` 만 그쪽으로 바꿨습니다. 그 외 `bgmStop()` 호출부(보스 격파·정산·게임오버·타이틀)는 예전처럼 완전 정지입니다.

### 색조로 구분하는 공격기 3종 (`js/stages.js`, `js/game.js`)

공격 방식이 다양해야 재미있다는 요청에 따라, 색조와 꼬리 표식과 공격이 각각 다른 적 3종을 넣었습니다.

| 종류 | 색조 | 표식 | 공격(`fire`) | 등장 |
|---|---|---|---|---|
| `gunner` | 빨강 `#c22f28` | ✚ 십자 | `sweep` — 조준각을 한쪽으로 훑으며 0.1초 간격 5연사 | 1~5탄 |
| `spinner` | 노랑 `#d9a915` | ◎ 고리 | `ring` — 10발 원형 확산, 쏠 때마다 각도를 0.34rad 돌림 | 3~5탄 |
| `hunter` | 초록 `#2e8f4d` | ⬡ 육각 | `homing` — 선회 유도탄(`eMissile`) | 4~5탄 |

- 색만으로 구분하지 않도록 **표식·공격 방식·회피법을 함께** 다르게 했습니다(`.claude/rules` 의 접근성 원칙). 빨강은 기존 자폭기(`kamikaze`)와 색이 비슷하지만 표식(✚ vs ▲)과 행동(제자리 연사 vs 돌진)이 확실히 다릅니다.
- 원화는 새로 만들지 않고 기존 `mini` / `medium` PNG 에 색조만 얹었습니다(`sniper` / `kamikaze` / `bomber` 와 같은 방식). 전용 원화가 생기면 `ENEMY[*].art` 만 바꾸면 됩니다.
- `hunter` 는 `medium` 원화를 쓰지만 4탄 VTOL 교체 목록(`enemyForStage`)에는 넣지 않았습니다. 넣으면 `tint: null` 이 되어 초록색이 사라집니다.
- 웨이브는 기존 편대를 고치지 않고 **비어 있는 시간대에 한 무리씩 덧붙였습니다.** 스테이지별 배치는 `js/stages.js` 의 `F(..., { type: 'gunner' | 'spinner' | 'hunter' ... })` 줄입니다.

### 검증

- `python tools/make-test.py` 후 headless Chrome:
  - 배경음: 스테이지 시작 → 일시정지 → 재개(처음부터 다시 시작하지 않음) → 보스 전환(이전 곡 정지, 보스 곡 재생) → BGM 끄기/켜기 → 정지 → 다른 스테이지 순서로 상태 전이 확인. `audio` 요소는 필요한 3개만 생성됐습니다. mp3 5개 길이 132~195초로 루프에 충분합니다.
  - 적 3종: 연사기 5발이 6프레임(0.1초) 간격으로 발사되고 각도가 1.79 → 1.15rad 로 한쪽으로 훑음, 산탄기 1회 10발 원형, 추격기 `eMissile` 유도 활성 확인. 확대 캡처로 6종 표식(◆▲■✚◎⬡)이 서로 구분되는 것도 확인했습니다.
  - `scene=full&s=2..5&f=3300`(각 55초 플레이) 전부 오류 0.
- **확인하지 못한 것**: 실제 소리 크기입니다. headless 에는 오디오 장치가 없어 `BGM_VOLUME = 0.26` 이 적당한지는 직접 들어 봐야 합니다. 새 적 3종을 포함한 난이도 체감도 사람이 플레이해야 알 수 있습니다.

---

## 2026-09-21 (2차) 필살기 방향 · 화력 규칙 · 2탄 보스 주포

세 가지 요청을 반영했습니다. 모두 기존 구조를 유지한 부분 수정입니다.

### 필살기 폭격 방향 반전 (`js/bomb-run.js`)

- 기체와 지원기가 모두 아래에서 위로 가는데 폭격만 위에서 아래로 내려와 방향이 어긋나 있었습니다.
- 착탄 순서를 뒤집었습니다. `launch: .26 + row * .14` → `.26 + (4 - row) * .14`. 맨 아랫줄(row 4)이 먼저 터지고 위로 훑어 올라갑니다.
- 미사일 출발점을 `sy: -90`(화면 위) → `sy: h + 90`(화면 아래)으로 바꾸고 비행 시간도 `(h + 90 - y) / 2300` 으로 맞췄습니다. `missileAt()` 의 가속 곡선(`.25t + .75t²`)은 그대로이며 이제 상승에 쓰입니다.
- `bomb_missile.png` 는 기수가 아래를 향한 원화이므로 `ctx.rotate(Math.PI)` 로 뒤집어 그립니다. 같은 회전 안에서 그리므로 잔상(30px)도 자동으로 아래쪽에 깔립니다.
- 타이밍은 기존 연출을 위아래로 뒤집은 것과 같습니다. 첫 착탄 y≈675(t=0.44) → 마지막 착탄 y≈85(t=1.34), 폭발 종료 2.06초로 `DURATION` 2.2초 안에 들어옵니다. 줄당 1회 효과음 트리거(`x < 65`)도 5회 그대로입니다.
- 지원기(`planeAt`)는 원래부터 아래에서 위로 날고 있어 건드리지 않았습니다.

### 격추 시 화력 초기화 (`js/game.js`)

- `hitPlayer()`: `P.power = Math.max(1, P.power - 1)` → `P.power = 1`. 격추되면 화력이 한 단계가 아니라 처음 상태로 돌아갑니다.
- `index.html` 의 HOW TO PLAY 문구와 `README.md` 규칙도 함께 고쳤습니다. 컨티뉴·스테이지 시작 경로(`startStage` 주변)는 이미 `power = 1` 이라 변경이 없습니다.

### 2탄 사막 보스: 철길 삭제와 주포 포격 개선

- **철길 삭제**: `js/game.js` `render()` 에서 보스 뒤에 가로 레일 2줄과 침목을 그리던 블록을 제거했습니다. 배경 원화와 겉돌아 어색했습니다.
- 남은 `rails` 플래그는 그림이 아니라 "좌우로만 달리므로 진행 방향에 맞춰 뒤집는다"는 뜻만 남으므로 **`sideRun`** 으로 이름을 바꿨습니다(`js/bosses.js` 정의, `js/game.js` 어트랙트 모드 2곳).
- **주포 연속 살보**: 기존에는 두 포신이 동시에 1발(3페이즈 3발)씩 쏘고 끝났습니다. 이제 한 번 조준하면 두 포신이 `DUNE_SALVO_GAP`(0.08초) 간격으로 번갈아 쏟아냅니다. 1/2/3페이즈 각각 4·6·8발입니다.
- 조준각은 포격 **시작 순간에 `b.salvoAng` 로 고정**되고 발마다 `DUNE_SWEEP`(0.052rad)씩 각이 틀어집니다. 저격기 규칙과 같은 방식이라 옆으로 비키면 탄막 전체를 피할 수 있습니다.
- `b.salvo` / `b.salvoN` / `b.salvoCt` 는 `init()` 에서 초기화하고 `fire()` 맨 앞에서 매 프레임 처리합니다. `dt` 는 루프에서 0.05로 제한되므로 `while` 로 밀린 발수를 보정해도 한 프레임에 한두 발 이상 몰리지 않습니다. 주포 부위가 파괴되면 즉시 중단합니다.
- **포구 섬광**: `DEFS.dune.fx(b, ctx, G)` 를 새로 두고 `Bosses.draw()` 끝(부위 발광 직전)에서 호출합니다. 발사마다 `b.muzzle` 에 좌표를 쌓고 `DUNE_MUZZLE_LIFE`(0.16초) 동안 가산 합성으로 밝혔다가 지웁니다. 보스별 추가 연출이 필요하면 같은 `fx` 훅을 쓰면 됩니다.
- **포신 좌표는 원화 실측값**입니다. `boss2-dune.png` 를 폭 430으로 렌더해 알파를 훑어 잰 결과 두 포신 중심이 중앙 기준 -6.9px / +16.3px, 포구 끝이 +65.4px 였습니다. 상수로 `DUNE_BARREL = [-.016, .038]`, `DUNE_MUZZLE_Y = .228` (폭·높이 비율)로 넣었습니다.
- 원화의 두 포신이 좌우 대칭이 아니어서 보스가 반대로 달릴 때(`b.flip`) 어긋납니다. 그래서 발사 좌표에 `face = b.flip ? -1 : 1` 을 곱합니다. 같은 이유로 탄약차·기관차 발사 좌표에도 같은 보정을 넣었습니다(전에는 스프라이트만 뒤집히고 탄은 제자리에서 나왔습니다).

### 검증

- 5장 "검증 방법"의 headless Chrome 절차로 확인했습니다. `python tools/make-test.py` 후 `__test.html?scene=boss2&f=75` 가 2탄 보스 화면입니다(`&phase=0.2` 은 3페이즈). 화력 초기화와 살보 발수·간격처럼 기존 scene 에 없는 항목은 같은 방식의 임시 사본에서 내부 함수를 노출시켜 쟀고, 임시 파일은 모두 지웠습니다.
- 화력 5에서 `hitPlayer()` → `power = 1`, 잔기 정상 감소.
- `scene=boss2` 캔버스 캡처: 철길 없음, 보스 정상 교전(`st=fight`, `partsAlive=3`), 오류 0. 주포 살보 구간 캡처에서 대형 포탄이 줄지어 나오고 섬광이 포신 끝에 정확히 붙는 것을 확인했습니다.
- 살보 실측: 1페이즈 4발/0.23초, 3페이즈 8발/0.55초(약 5프레임 간격). 포구 오프셋 정방향 (-6.9, 65.4)/(16.3, 65.4), flip 시 좌우 반전 확인. 주포 파괴 시 살보 즉시 0.
- 타이틀 어트랙트 900프레임 + 플레이 상태 구동에서 콘솔 오류 0건.
- **남은 일**: 사람이 직접 2탄을 플레이한 난이도 확인. 3페이즈 화면 탄 수가 늘었으므로(동시 6발 → 순차 8발) 빡빡하면 `DUNE_SALVO_GAP` 을 늘리거나 살보 발수를 줄이면 됩니다.

---

## 2026-09-21 필살기·폰트 수정

- `js/bomb-run.js`: 지원기 폭 520px(기존 2배), 0.72초 급속 통과. 미사일 25발은 고정 x축으로 수직 가속 비행하며 기수 끝과 착탄 중심을 맞춥니다(진행 방향은 아래 2차 수정에서 상승으로 바뀌었습니다). 탑뷰 폭발 16프레임을 재생하며 전체 연출 2.2초, 폭발 0.72초입니다. `BombRun.update()` 착탄 콜백에서만 피해가 발생합니다.
- `game.js`: 발동 즉시 적탄 제거, 연출 종료까지 무적, 연출 중 재발동 방지. 대상별 Set으로 중복 피해를 막고 적/지상/보스 피해 140/120/350을 유지합니다. `startStage`와 `stageClear`에서 폭격을 정리합니다.
- `css/fonts.css`, `assets/fonts/`: Neo둥근모 WOFF2와 OFL 라이선스 동봉. 메뉴 CSS 변수와 캔버스 `FONT`를 통일하고 첫 렌더 전 로딩을 기다립니다. 원본 로고 이미지는 별도입니다.
- `tools/bomb-preview.html`: 재생·정지·시간 탐색. `node tools/test-bomb-run.cjs`: 25발 1회 착탄, 지연 피해, 화면 모서리까지 범위, 최종 이펙트 종료 검사.
- `python tools/make-test.py` 후 `__test.html?scene=bomb`: 소모량·중복 발동·피해 시점·일시정지·중복 피해·무적·재사용·전환 초기화 통합 검사. `&f=27`은 지원기 통과, `&f=60`은 착탄 장면입니다. 단위 검사에 수직 궤적·착탄 위치·2배 크기·통과 시간을 포함했습니다.

---

## 1. 지금 상태 한눈에

| 영역 | 상태 |
|---|---|
| 5스테이지 진행 | 완료 (웨이브 → 지상 목표물 → 중간보스 → 보스 → 정산 → 다음 스테이지) |
| 보스 5종 | 1·2·4는 원화 PNG, 3·5는 캔버스 임시 작화 |
| 중간보스 | 4탄은 쌍로터 3자세 원화, 나머지는 중형기 공용. 스테이지별 패턴·이동 |
| 공중 적 | mini / medium / heavy / sniper / kamikaze / bomber / gunner / spinner / hunter (특수 6종은 색조 + 도형 표식 + 행동 예고로 구분) |
| 지상 목표물 | 기존 6종 + 4탄 경비정·미사일정·중포탑 3자세 원화 |
| 플레이어 기체 | 2종(스트라이커·랜서). 원화는 1종, 색조와 무기 구성으로 구분 |
| 사운드 | 배경음은 `assets/*.mp3` 5곡(스테이지 4 + 보스 1, 4·5탄 공용), 효과음 16종은 WebAudio 합성. 음원 실패 시 기존 합성 트랙으로 대체 |
| 저장 | 최고 점수, 지난 점수, 상위 5개 기록, 옵션(BGM/효과음/화질/차지 자동발사/기체) |
| 타이틀 | 아케이드풍 영문 화면 + 어트랙트 모드(스테이지 순환 데모·보스 등장·PRESS START). 기체 스펙과 게임 중 HUD·도움말 본문은 한국어 |

기존 자산과 컨셉 문서는 `../output/imagegen/` 에 있습니다. 4탄 신규 원화 13장은 `assets/stage4-*.png`입니다. 2026-10-06에 512²(보스 640²)로 줄였고, 1254² 원본은 `../output/imagegen/striker-src/full-res-2026-10-06/`에 있습니다.

### 4탄 신규 원화 (2026-09-21)

#### 부위 파괴·폭발 수정

- 원인: 단일 보스 PNG가 부위 파괴 뒤에도 그대로 표시됐으며, 일반탄은 상부 부위에 도달하기 전에 선체 판정으로 소멸했습니다.
- `Bosses.partAt`: 4탄의 부위와 같은 세로 발사 구간에서 선체에 도달한 일반탄을 해당 부위에 배분합니다. 숨김·파괴 부위는 제외합니다. 다른 보스에는 기존 원형 부위 판정을 유지합니다.
- `Assets.boss4Body`: `stage4-boss-nightark-damaged.png`의 해당 영역만 교체해 8개 파괴 상태를 캐시합니다. 좌우 포격과 함교의 조준·원형 탄막은 각각 해당 부위의 생존 여부를 따릅니다. 중앙 주포는 남습니다.
- `damageBoss`: 부위 HP를 0으로 제한하고 중복 보상을 막습니다. 폭발 위치는 탄의 충돌점이 아닌 해당 부위 중심입니다. HUD는 내구도 %, 장갑, 파괴 상태를 표시합니다.
- `boom`: `explosion.png`(원본 `explosion-sheet-v1.png`의 축소본)의 4×4/16프레임을 재생합니다. 보스 격파는 일정 간격의 연쇄 폭발, 최종 폭발, 선체 페이드로 진행합니다. 이미지 생성은 내장 Imagegen을 사용했고 프롬프트는 `assets/boss-effects-prompts.md`에 보존했습니다.
- 확인 페이지: `tools/boss-effects-preview.html`. 테스트: `node tools/test-boss-parts.cjs`; `python tools/make-test.py` 실행 후 `__test.html?scene=damage` (잔해), `?scene=damage&fx=1` (폭발 중간 프레임).
- 검증: 부위 조준/장갑/중복 제외/무장 및 함교 공격 중지 단위 검사 통과. Edge에서 실제 일반탄 충돌로 세 부위 HP 0·독립 파괴·폭발·각 5,000점 보상 확인(오류 0). 난이도 체감은 별도 플레이 조정 대상입니다.

- `assets/stage4-rename-map.json`: `stage3`, `stage31`~`stage312` 및 오타 `staeg39`의 변경 이름과 원본 SHA256.
- `tools/stage4-art.html`: 게임과 같은 렌더러로 13장과 로터 회전을 확인하는 페이지.
- `js/assets.js`: `STAGE4` 지연 로딩, `stage4Vtol / stage4Patrol / stage4MissileBoat / stage4Artillery / boss4` 프레임. 선박 파일의 `n/nw/ne`는 **원본 방향**이며, 표시할 때 180° 회전하고 좌우 프레임을 교환합니다. 나머지 `n/l/r`는 정면/화면 좌/화면 우입니다.
- `Stages.enemyForStage / groundForStage`: 4탄에만 원화를 선택합니다. 경비정은 6.5·39초, 미사일정은 18·47초에 출현합니다. 중포탑은 기존 aa/bunker 위치에 적용합니다.
- 나이트 아크는 폭 320, 정사각 본체이며 양현 무장부와 함교 좌표를 새 원화에 맞췄습니다. PNG 로드 실패 시 기존 캔버스 원화를 대신 표시합니다.
- 쌍로터는 기존 프로펠러 규칙의 예외입니다. 원화에 그려진 팬 내부만 `ducts` 좌표로 잘라 8프레임을 만들어 회전합니다.
- 검증: Edge에서 13장 미리보기와 회전 재생/정지 확인. 테스트 사본의 4탄 80초 진행으로 보스 3단계 도달, 별도 격파 테스트로 정산 후 5탄 진입 확인(오류 0). 파일명 변경 전후 SHA256 13개 일치. 실제 사람의 난이도 플레이 검증은 별도입니다.

---

## 2. 에셋 제작 규격 (직접 만들 때 이대로 맞추면 코드 수정이 없습니다)

### 2-1. 공통 규칙

- **정사각 캔버스, 중앙 피벗, 투명 알파.** 기체가 캔버스 폭을 거의 꽉 채우게 그립니다.
- 반투명 잔여 픽셀(알파 12 미만)은 제거합니다. 원본에서 줄일 때 `tools/` 의 방식과 같게 하면 됩니다.
- **위쪽이 화면 위**입니다. 우리 기체는 기수가 위, 적기는 기수가 아래, 지상 시설은 정북 기준으로 그립니다.
- **프로펠러 날개를 그리지 마세요.** 스피너(회전축)만 남기면 코드가 회전면을 그립니다.
  회전축 위치는 `js/assets.js` 의 `FRAMES[...].hubs` 에 비율(0~1)로 적습니다.
- 그림자·배경·글자·탄·불꽃은 넣지 않습니다. 코드가 그립니다.

### 2-2. 지금 비어 있는 슬롯 (우선순위 순)

| 우선 | 파일명(권장) | 크기 | 용도 | 지금 대체물 |
|---|---|---|---|---|
| 1 | `boss3-gemini.png` | 512² | 3스테이지 보스 프로스트 제미니 | `js/boss-art.js` 캔버스 작화 |
| 3 | `boss5-regent.png` | 512² | 5스테이지 보스 아이언 리전트 | 캔버스 작화 |
| 4 | `midboss1~3.png`, `midboss5.png` | 320² | 1·2·3·5탄 중간보스 | 중형기 원화 확대 + 색조 |
| 5 | `player2-n/l/r.png` | 256² | 두 번째 기체(랜서) 3자세 | 1번 기체 + 주황 색조 |
| 6 | `enemy-sniper.png`, `enemy-kamikaze.png`, `enemy-bomber.png` | 192~320² | 신규 적 3종 | mini/medium + 색조 + 도형 표식 |
| 7 | `ground/*-imagegen-v1.png` | 384² | 기본 지상 시설 6종 | ImageGen 원화 9장으로 교체 완료 |

### 2-2-1. 직접 만들어 넣은 자산의 정리 규칙

`assets/` 에 원본(1254², 1.5~2.6MB)을 넣어 주시면, 표시 크기로 줄이고 팔레트 압축한 뒤
아래 이름으로 바꿔 씁니다. 원본은 `output/imagegen/striker-src/` 로 옮겨 보관합니다.

| 넣어 주신 이름 | 정리된 이름 | 표시폭 | 상하반전 | 쓰임 |
|---|---|---|---|---|
| stage31 / stage31left / stage32right | s3-fighter-n/l/r | 320 | 아니오 | 3스테이지 요격기(3자세) |
| stage3midboss | s3-midboss | 420 | 아니오 | 3스테이지 중간보스 |
| stage3boss | s3-boss | 560 | **예** | 3스테이지 보스 |
| stage51 / stage52 / stage53 | s5-fighter / s5-heavy / s5-gunship | 320/340/380 | 아니오 | 5스테이지 공중 3종 |
| stage54 / stage55 / stage56 / stage57 | s5-turret / s5-battery / s5-tank / s5-core | 256~300 | 앞 3개 **예** | 5스테이지 지상 4종 |
| stage58 | s5-dreadnought | 420 | **예** | 5스테이지 중간보스 |
| stage59 | s5-boss | 560 | **예** | 5스테이지 보스 |
| power / bomb / life | item-power / item-bomb / item-life | 96 | 아니오 | 아이템 3종 |
| missile | p-missile | 40×46 | 아니오 | 우리 기체 유도 미사일 |
| missilebot | p-pod | 64 | 아니오 | 화력 3 이상에서 붙는 보조 포드 |
| p-charge2 | charge-gather | 96×144 | 아니오 | 기수에 모이는 에너지(게이지에 따라 자람) |
| p-charge1 / p-charge4 / p-charge3 | charge-shot1 / 2 / 3 | 128~150 | 아니오 | 차지샷 3프레임(작게→크게→작게 반복) |

탄환·아이템 원화는 `js/assets.js` 의 `IMG_BULLET`(탄환)과 `js/game.js` 의 `ITEM_ART`(아이템)에서
키만 바꾸면 교체됩니다. 원화를 지우면 예전 코드 드로잉으로 자동 대체됩니다.

반전 판단 기준: 적 기체·시설은 **화면 아래(플레이어 쪽)를 향해야** 합니다.
엔진 화염이 위, 포구가 아래면 그대로 쓰고, 반대면 180도 돌립니다.

보스 생성 프롬프트는 `../output/imagegen/boss-prompts-v1.txt` 에 있습니다. 4탄은 신규 해상 요새 원화로 교체되어 예전 항공모함 프롬프트와 다릅니다.
중간보스·신규 적·두 번째 기체는 프롬프트가 없으니 아래 골격을 참고해 만드세요.

```
Asset type: <중형 편대장 / 저격 요격기 / 자폭 돌격기 / 폭격기> sprite for an original vertical arcade
propeller shooter. Orthographic TOP-DOWN dorsal view, nose pointing DOWN (적기) 또는 UP (우리 기체),
bilaterally symmetric, centered on a square transparent canvas with even padding.
Style: polished retro arcade sprite, crisp dark outlines, shaded weathered metal, restrained panel detail,
readable at <표시 크기>px wide.
Color: <스테이지 배색 — 1 해상 청회색 / 2 사막 황토 / 3 설원 담청 / 4 야간 자주 / 5 요새 진홍>.
Animation-ready: NO propeller blades, spinner hubs only. No background, shadow, text, bullets, effects.
```

### 2-3. 교체 절차

1. PNG를 `assets/` 또는 `assets/ground/` 에 넣습니다.
2. `js/assets.js` 의 `CORE` 배열에 `['키', '파일명.png']` 을 추가합니다.
3. `js/assets.js` 의 `FRAMES` 에 pivot(보통 `[.5,.5]`)과 프로펠러 `hubs`, 회전면 반지름 `r` 을 적습니다.
4. 쓰는 곳을 바꿉니다.
   - 보스 3·5: `js/bosses.js` 의 해당 보스에서 `art: 'gemini'` → `sprite: 'boss3'`처럼 지정합니다. 생성·그리기는 `sprite` 키를 그대로 사용합니다.
   - 중간보스: `js/stages.js` 의 `MIDBOSS[i].art` 를 새 키로 바꾸고 `tint` 를 지웁니다.
   - 신규 적: `js/stages.js` 의 `ENEMY.sniper/kamikaze/bomber` 에서 `art` 를 바꾸고 `tint` 를 지웁니다.
   - 두 번째 기체: `js/game.js` 의 `SHIPS[1].art` 를 새 키로 바꾸고 `tint` 를 지웁니다.
5. 브라우저에서 확인합니다. 크기가 안 맞으면 쓰는 쪽의 `w`(표시 폭)만 조정합니다.

`tint` 는 원본 PNG를 건드리지 않고 그릴 때만 색을 얹는 장치입니다. 전용 원화가 생기면 지우세요.

### 2-4. 지상 시설을 다시 그릴 때

현재 원화와 프롬프트는 `assets/ground/imagegen-v1.json`, 미리보기는 `tools/ground-art.html`입니다.
회전하는 부품은 반드시 **별도 파일**로 두세요
(`aa-base`/`aa-gun`, `tank-hull`/`tank-turret`, `radar-base`/`radar-dish`).
코드는 base를 먼저 그리고 gun을 각도만큼 돌려 덧그립니다. 새 원화의 실제 연결부에
`FRAMES.ground[*].pivot`을 맞추고, 표시 크기는 `scale`로 조절합니다.
`tools/sprite-gen.html`·`tools/sprite-defs.js`는 이전 코드 작화 보관용이며 현재 게임에서 사용하지 않습니다.

---

## 3. 코드 지도

| 파일 | 맡은 일 | 자주 건드릴 곳 |
|---|---|---|
| `js/assets.js` | 이미지 로딩, 스프라이트·프로펠러·탄·발광·배경 타일 사전 렌더링 | `FRAMES`, `CORE` |
| `js/audio.js` | 배경음 음원 재생 + 효과음 16종 + 대체 합성 트랙 | `BGM_FILES`, `BGM_BOSS`, `BGM_VOLUME`, `sfx` |
| `js/input.js` | 키보드·포인터·터치 버튼 | 키 배치 |
| `js/stages.js` | 적·지상·중간보스 수치표, 스테이지별 웨이브 스크립트 | `ENEMY`, `GROUND`, `MIDBOSS`, `STAGES[].script` |
| `js/boss-art.js` | 3·5 보스 및 4탄 로딩 실패 시 대체 작화 | 원화 교체 전까지만 |
| `js/bosses.js` | 보스 정의·페이즈·패턴·그리기 | `DEFS`, 보스별 추가 연출 `DEFS[*].fx` |
| `js/game.js` | 루프·충돌·점수·HUD·화면 전환·기체 정의·타이틀 데모 | `SHIPS`, `attract`, 밸런스 상수 |

### 웨이브 스크립트 읽는 법

```js
F(16.0, { type: 'sniper', shape: 'line', n: 2, x: 0.5, speed: 90, move: 'hover', fire: 'snipe' })
//  ↑초    적 종류        편대 모양      수   위치     속도       이동          사격
G(11.0, 'aa', .50, { drop: 'power' })   // 지상 목표물: 초, 종류, 가로 위치, 전멸 드롭
EV(44.0, 'midboss')                     // 중간보스 / 보스 호출
```

`script` 와 `ground` 는 모듈이 로드될 때 합쳐지고 시간 순으로 정렬됩니다. 순서 신경 쓰지 말고 넣으세요.

이동(`move`): `straight` `sine` `dive` `swoop` `hover` `chase`
사격(`fire`): `none` `aimed` `spread3` `burst` `snipe` `drop`

---

## 4. 밸런스 조정 지점 (플레이 후 여기만 만지면 됩니다)

| 느낌 | 고칠 곳 |
|---|---|
| 적이 너무 많다/적다 | `js/stages.js` 의 `F(...)` 항목 수와 `n` |
| 적탄이 빠르다 | `js/stages.js`의 `STAGES[*].bulletMul`, `js/difficulty.js`의 `bulletSpeed` |
| 보스가 오래 끈다 | `js/bosses.js` `DEFS[*].hp`, `js/difficulty.js`의 `bossHp` |
| 보스가 너무 크게/작게 움직인다 | `js/bosses.js` 각 `move()` 의 `swingX(b, dt, 주기, 진폭)` · `bobY(...)` 인자 |
| 보스 탄막이 빡세다 | 각 보스 `fire()` 의 `b.ct = ...` (쿨다운) 과 `fan/ring` 의 개수 |
| 2탄 주포 살보가 빡세다 | `js/bosses.js` `DUNE_SALVO_GAP`(발사 간격 0.08초), `DEFS.dune.fire` 의 `b.salvoN`(단계별 4·6·8발), `DUNE_SWEEP`(각 벌어짐) |
| 중간보스가 약하다 | `js/stages.js` `MIDBOSS[i].hp` |
| 화력이 약하다 | `js/game.js` `SHIPS[i].dmg`, `fireCd`, `VULCAN_A/B` |
| 잔기가 부족하다 | `js/difficulty.js`의 `lives`, `G.nextExtend`(30만 점마다 1기) |
| 지상 목표물이 성가시다 | `js/stages.js` `GROUND[*].cd`(발사 간격), `hp` |
| 배경음이 크다/작다 | `js/audio.js` `BGM_VOLUME`(현재 0.26). 효과음은 `sfxGain`(1.0)과 `master`(0.9) |
| 빨강·노랑·초록 적이 버겁다 | `js/stages.js` 의 `type: 'gunner' / 'spinner' / 'hunter'` 편대 `n`, `js/game.js` 의 `sweep`(5발·0.1초) · `ring`(10발) · `homing` 쿨다운 |

---

## 5. 검증 방법 (설치 없이 가능)

```sh
cd striker-game
python tools/make-test.py         # __test.html, js/__game_test.js 생성(임시)
# 아래 URL 을 Chrome headless 로 열고 #TESTOUT 을 읽는다
#   __test.html?scene=full&s=3&f=4200   3스테이지 전체 진행
#   __test.html?scene=boss5&phase=0.2   5스테이지 보스 최종 단계
#   __test.html?scene=ground&s=2        지상 목표물
#   __test.html?scene=clear / over / ending / pause / pickup / bomb / mid
python tools/make-test.py clean   # 임시 파일 삭제
```

- headless 에서는 가상 시간 때문에 `requestAnimationFrame` 이 초당 수천 번 발화합니다.
  그래서 테스트 사본은 내부 rAF 를 끄고 `tools/harness.js` 가 루프를 직접 돌립니다.
- 게임이 시작된 뒤에는 Chrome 의 `--screenshot` 이 검은 화면을 찍습니다.
  캔버스는 `toDataURL` 로 뽑아야 하고, 이때 `--allow-file-access-from-files` 가 필요합니다.
- 임시 파일(`__test.html`, `js/__game_test.js`)은 **저장소에 남기지 마세요.**

---

## 6. 남은 일

**곧 해야 하는 것**

1. 사람이 직접 5스테이지를 플레이하고 난이도 피드백 → 4장 표대로 조정. (수치는 전부 설계값입니다)
2. 보스 3·5 원화 제작 후 교체. (2장 절차)
3. 모바일 실기 확인: 터치 버튼 위치·크기, 세로 레터박스, iOS 에서 소리 재개.

**하면 좋은 것**

4. 1·2·3·5탄 중간보스 전용 원화. 4탄에는 신규 쌍로터 원화를 적용했습니다.
   신규 적 3종도 실루엣이 달라지면 도형 표식(`MARK_SHAPE`)은 그대로 두고 색조만 지우면 됩니다.
5. 스테이지별 지상 목표물 배색. 현재는 6종이 모든 스테이지에서 같은 색입니다.
6. 보스 등장·격파 컷인, 스테이지 시작 연출.
   타이틀 외 화면(도움말 본문·일시정지·정산·게임오버)은 아직 한국어다. 전부 영문으로 맞출지는 결정 필요.
7. 기체 3번째 종류(폭장형 등)와 그에 맞는 원화.

**확인하지 못한 것**

- 실제 기기 프레임 수. headless 에서는 가상 시간이라 초당 프레임을 측정할 수 없습니다.
- 소리 출력 자체. 코드 경로는 돌지만 headless 에 오디오 장치가 없습니다.
- 2~5스테이지 난이도 균형과 스테이지 3~5 보스전 체감.
