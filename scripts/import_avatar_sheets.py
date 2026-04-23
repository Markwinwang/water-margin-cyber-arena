#!/usr/bin/env python3

from __future__ import annotations

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "water-margin-data.json"
MANIFEST_PATH = ROOT / "data" / "water-margin-avatar-batches.json"
SHEETS_DIR = ROOT / "generated" / "avatar-sheets"
ARTWORK_DIR = ROOT / "public" / "heroes" / "artwork"
SPRITE_DIR = ROOT / "public" / "heroes" / "sprite"


def run_magick(*args: str) -> None:
    subprocess.run(["magick", *args], check=True)


def identify_size(path: Path) -> tuple[int, int]:
    result = subprocess.run(
        ["magick", "identify", "-format", "%w %h", str(path)],
        check=True,
        capture_output=True,
        text=True,
    )
    width, height = result.stdout.strip().split()
    return int(width), int(height)


def main() -> None:
    dataset = json.loads(DATA_PATH.read_text())
    manifest = json.loads(MANIFEST_PATH.read_text())
    heroes_by_id = {hero["id"]: hero for hero in dataset["heroes"]}
    imported_batches = 0

    for batch in manifest["batches"]:
        sheet_path = SHEETS_DIR / f"batch-{batch['batch']:02d}.png"
        if not sheet_path.exists():
            continue

        width, height = identify_size(sheet_path)
        cell_width = width // 3
        cell_height = height // 3
        margin_x = max(cell_width // 32, 4)
        margin_y = max(cell_height // 32, 4)
        imported_batches += 1

        for index, hero in enumerate(batch["heroes"]):
            row = index // 3
            col = index % 3
            x = col * cell_width + margin_x
            y = row * cell_height + margin_y
            crop_width = cell_width - margin_x * 2
            crop_height = cell_height - margin_y * 2

            artwork_output = ARTWORK_DIR / f"{hero['slug']}.png"
            sprite_output = SPRITE_DIR / f"{hero['slug']}.png"

            run_magick(
                str(sheet_path),
                "-crop",
                f"{crop_width}x{crop_height}+{x}+{y}",
                "+repage",
                "-resize",
                "768x768^",
                "-gravity",
                "center",
                "-extent",
                "768x768",
                str(artwork_output),
            )
            run_magick(
                str(sheet_path),
                "-crop",
                f"{crop_width}x{crop_height}+{x}+{y}",
                "+repage",
                "-resize",
                "256x256^",
                "-gravity",
                "center",
                "-extent",
                "256x256",
                str(sprite_output),
            )

            dataset_hero = heroes_by_id[hero["id"]]
            dataset_hero["artwork"] = f"/heroes/artwork/{hero['slug']}.png"
            dataset_hero["sprite"] = f"/heroes/sprite/{hero['slug']}.png"

    DATA_PATH.write_text(json.dumps(dataset, ensure_ascii=False, indent=2) + "\n")
    print(f"Imported {imported_batches} batch(es)")


if __name__ == "__main__":
    main()
