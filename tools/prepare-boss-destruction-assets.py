"""Resize generated assets, preserve originals, and encode alpha WebP for runtime loading."""
import argparse
import json
import shutil
from pathlib import Path
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT.parent / "output/imagegen/boss-destruction-v1"

def prepare(source, destination, width):
    with Image.open(source) as original:
        image = original.convert("RGBA")
        width = min(width, image.width)
        height = round(image.height * width / image.width)
        if (width, height) != image.size:
            image = image.resize((width, height), Image.Resampling.LANCZOS)
        destination.parent.mkdir(parents=True, exist_ok=True)
        image.save(destination, "WEBP", quality=90, method=6, exact=True)
        with Image.open(destination) as encoded:
            assert encoded.size == image.size
            assert ImageChops.difference(image.getchannel("A"), encoded.convert("RGBA").getchannel("A")).getbbox() is None, destination
        return {"file": str(destination.relative_to(ROOT / "assets")).replace("\\", "/"),
                "width": width, "height": height, "sourceBytes": source.stat().st_size,
                "runtimeBytes": destination.stat().st_size, "alphaPreserved": True}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", default=str(ROOT / "assets/boss-destruction-imagegen-v1.json"))
    parser.add_argument("--archive", default=str(ARCHIVE))
    parser.add_argument("--report", default=str(ROOT / "assets/boss-destruction-loading-v1.json"))
    args = parser.parse_args()
    items = json.loads(Path(args.manifest).read_text(encoding="utf-8-sig"))
    archive = Path(args.archive)
    archive.mkdir(parents=True, exist_ok=True)
    generated = []
    for item in items:
        source = Path(item["source"])
        shutil.copy2(source, archive / (item["key"] + "-source.png"))
        generated.append(prepare(source, ROOT / "assets" / item["file"], item["width"]))
    existing = [
        ("boss-wreck-modules-v1.png", "boss-wreck-modules-runtime-v1.webp", 512),
        ("stage4-boss-nightark.png", "stage4-boss-nightark-runtime-v1.webp", 640),
        ("stage4-boss-nightark-damaged.png", "stage4-boss-nightark-damaged-runtime-v1.webp", 640),
    ]
    ground_manifest = ROOT / "assets/ground/imagegen-v1.json"
    ground = json.loads(ground_manifest.read_text(encoding="utf-8-sig"))
    for item in ground:
        item["runtimeFile"] = item["file"].replace(".png", ".webp")
        existing.append(("ground/" + item["file"], "ground/" + item["runtimeFile"], item["width"]))
    optimized = []
    for source_file, destination_file, width in existing:
        result = prepare(ROOT / "assets" / source_file, ROOT / "assets" / destination_file, width)
        result["originalFile"] = source_file
        optimized.append(result)
    ground_manifest.write_text(json.dumps(ground, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    before = sum(item["sourceBytes"] for item in optimized)
    after = sum(item["runtimeBytes"] for item in optimized)
    report = {"format": "WebP quality 90, lossless alpha", "generated": generated, "optimized": optimized,
              "existingBeforeBytes": before, "existingAfterBytes": after,
              "existingReductionPercent": round((1 - after / before) * 100, 1),
              "newRuntimeBytes": sum(item["runtimeBytes"] for item in generated)}
    Path(args.report).write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: report[key] for key in ("existingBeforeBytes", "existingAfterBytes", "existingReductionPercent", "newRuntimeBytes")}))

if __name__ == "__main__":
    main()
