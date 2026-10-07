# 듄 콜로서스 전용 파손 원화

내장 ImageGen 편집 모드. 입력: `boss2-dune.png`. 최종 사용 파일: `boss2-dune-damaged-v2.png`.

## 최종 원화 프롬프트

Edit the supplied arcade armored train sprite into its destroyed-module counterpart for a game. Transparent RGBA background. Preserve EXACT original 3:2 canvas composition, train position, scale, top-down orthographic camera, dark brass/olive-grey metal, painted pixel-detail aesthetic, lighting and the three carriage chassis silhouettes and couplers. Train runs horizontally from x=0 to x=width, centered near y=0.48H; do NOT enlarge, recenter, rotate, crop, or add margins. LEFT ammunition carriage: remove BOTH small round turrets and ALL their protruding downward gun barrels; replace each with a low recessed blackened turret socket, torn bronze rim, small scorched debris lying flat on the existing deck. CENTER main cannon carriage: remove giant turret dome and BOTH long downward gun barrels COMPLETELY, expose a broad shallow dark circular turret mounting cavity with ragged bronze ring and visible low structural ribs. Preserve center carriage chassis; below the chassis where barrels used to protrude must be transparent. RIGHT locomotive: engine roof destroyed with low charred open engine bay and broken ribs, retain front wedge and outer chassis. No standing wreck towers, no new intact weapons or barrels, no giant rubble piles, no fire, no smoke, no floating debris. Make destruction sit IN the original body, not pasted on top. The three carriages must occupy the exact same x regions as reference so each can be composited independently: left 0-.34W, middle .34-.68W, right .68-1W. Output only the single train sprite, no labels.

## 게임 합성

차량별 가로 구간을 교체하고 기존 차체 알파로 외곽을 제한한다. 포신이 돌출되던 차체 하단은 지워 완파 상태에 포신이 남지 않게 한다. 배경 추출 후속 시안은 원화 보존 개선이 없어 사용하지 않았다.
