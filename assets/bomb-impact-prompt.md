# 필살기 착탄 폭발

- 제작: ImageGen 내장 도구, 신규 생성
- 파일: `bomb-impact-sheet-v1.png`
- 규격: 1254 × 1254 RGBA, 4 × 4, 좌→우 / 위→아래 16프레임
- 재생: `BombRun`에서 착탄 후 0.72초, 마지막 연기는 알파 페이드
- 일반 격추 폭발과 별도 이미지 및 프레임 캐시 사용

## 사용한 프롬프트

```text
Use case: stylized-concept.
Asset type: production game VFX sprite atlas for a polished top-down arcade military aircraft shooter.
Create ONE square RGBA transparent PNG sprite sheet, exactly 4 columns by 4 rows, 16 equally sized square cells, animation ordered left to right then top to bottom. No grid lines, no labels, no numbers, no padding between cells. Each explosion precisely centered in its own cell at the same anchor; maintain fixed camera and fixed scale across all frames. Leave transparent margin inside every cell; no effect crosses a cell boundary.
Subject: ONE missile impact explosion seen DIRECTLY FROM ABOVE, not from the side. It spreads radially across the ground plane, an irregular circular blast with molten yellow-white core, layered orange fire petals, short outward flying sparks, small fragments and charcoal smoke breaking into wisps. Premium hand-painted 2D arcade sprite aesthetic, crisp strong silhouettes readable at 160px.
Animation progression: frames 1-2 tiny sharp white-hot impact and compact ignition; frames 3-5 rapid expansion of bright yellow-orange flame with directional debris; frames 6-8 maximum ragged radial fireball occupying 80 percent of cell width, white core cooling into orange; frames 9-12 cooling red embers and fragmented dark smoke with increasingly transparent hollow center; frames 13-16 fading separated smoke wisps and a few embers, final frame almost invisible. Continuous temporal evolution of the SAME explosion, not 16 different explosions.
True transparent background with alpha; smoke and glow have soft translucent alpha. Absolutely no opaque background, no checkerboard painted into image, no ground, no crater, no horizon, no mushroom cloud, no upright fire column, no aircraft or missile, no text, no border, no watermark.
```

