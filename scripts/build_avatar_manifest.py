#!/usr/bin/env python3

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "water-margin-data.json"
OUTPUT_JSON = ROOT / "data" / "water-margin-avatar-batches.json"
OUTPUT_MD = ROOT / "data" / "water-margin-avatar-prompts.md"
BATCH_SIZE = 9

FEMALE_NAMES = {"顾大嫂", "孙二娘", "扈三娘"}

ROLE_STYLE = {
    "统帅": "commanding leader aura, dignified, layered formal robe with light armor trim",
    "军师": "scholar-strategist presence, elegant robes, composed and intelligent expression",
    "骑军": "elite cavalry general aura, lamellar armor, disciplined battlefield presence",
    "先锋": "vanguard warrior presence, bolder armor, intense aggressive energy",
    "奇技": "specialist hero presence, distinctive outfit details, clever and unconventional temperament",
    "步军": "close-combat infantry fighter, practical armor, grounded and rugged presence",
    "水军": "river-navy fighter, weathered face, functional armor and travel layers",
}

FACE_ARCHETYPES = [
    "younger clean-shaven face, sharp cheekbones, alert eyes",
    "broad square jaw, trimmed mustache, commanding gaze",
    "older scarred veteran face, thick brows, weathered skin",
    "lean hawk-eyed face, short beard, calculating expression",
    "full beard, heavier brow, intimidating presence",
    "noble refined features, thin mustache, composed poise",
    "sun-darkened rugged face, broken eyebrow scar, practical toughness",
    "rounder face, short boxed beard, stubborn expression",
    "longer face, sparse mustache and goatee, restless energy",
]

HEAD_STYLES = [
    "formal warrior topknot with dark ribbon",
    "simple headscarf under a bronze ornament",
    "high topknot with narrow crown",
    "windswept tied-back hair",
    "travel-worn cloth headband",
    "armored cap with subtle engraved details",
    "plain scholar cap",
    "braided leather headband",
    "loose tied warrior hair with side strands",
]

ACCENT_STYLES = [
    "aged gold and black",
    "deep crimson and bronze",
    "dark teal and steel",
    "moss green and iron gray",
    "oxblood red and black",
    "indigo and bronze",
    "umber and iron",
    "slate blue and silver",
    "dark green and gold",
]

MANUAL_OVERRIDES = {
    "宋江": "Chinese male rebel leader, black headscarf, thin mustache and pointed beard, dark crimson robe with black armor trim, calm commanding gaze",
    "卢俊义": "Chinese male noble champion, tall and powerful, refined stern face, silver-white armor with pale cloak accents, elite general aura",
    "吴用": "Chinese male strategist, elegant scholar face, black scholar hat, feather fan near shoulder, dark robe, intelligent calculating expression",
    "公孙胜": "Chinese male Daoist warrior priest, topknot, Daoist crown, slight beard, dark teal Taoist robes, mystical but disciplined expression",
    "关胜": "Chinese male great general, long beard, green lamellar armor, righteous and imposing, legendary guandao-general presence",
    "林沖": "Chinese male spear master, intense leopard-like eyes, rugged handsome face, dark armor, disciplined fighter aura",
    "秦明": "Chinese male vanguard warrior, fiery expression, heavier red armor, bold brows, brutal shock-troop presence",
    "呼延灼": "Chinese male cavalry commander, heavy ornate armor, stern veteran face, dark steel and bronze accents",
    "花荣": "Chinese male handsome archer, youthful heroic face, lighter armor, elegant archer styling, sharp focused eyes",
    "柴进": "Chinese male noble patron, refined aristocratic face, dark brocade robe with subtle armor accents, composed generous bearing",
    "李应": "Chinese male manor lord and weapon expert, sharp eyes, refined warrior clothing, concealed blade-master presence",
    "朱仝": "Chinese male heroic officer, beautiful long beard, calm righteous face, red-brown armor accents",
    "鲁智深": "Chinese male giant warrior monk, shaved head, fierce eyes, heavy build, monk robes with battle-worn layers",
    "武松": "Chinese male wandering fighter, loose hair, hard handsome face, tough traveler layers, fierce tiger-slayer aura",
    "董平": "Chinese male twin-spear general, youthful but proud, white-silver armor, sharp aristocratic features",
    "杨志": "Chinese male scarred veteran warrior, stern face, blue-green armor, burdened but unbroken spirit",
    "徐宁": "Chinese male imperial guard instructor, polished lamellar armor, composed elite-soldier bearing",
    "索超": "Chinese male wild charging warrior, heavy axe-fighter presence, forceful glare, thick armor",
    "戴宗": "Chinese male swift courier, lean face, travel wraps, fast-footed messenger-warrior energy",
    "刘唐": "Chinese male outlaw fighter, strong jaw, red headscarf, rugged and hot-blooded",
    "李逵": "Chinese male huge ferocious warrior, dark skin tone, wild beard, terrifying intensity, brute-force presence",
    "史进": "Chinese male handsome young fighter, open robe collar, visible tattoo hints, passionate rebellious energy",
    "穆弘": "Chinese male river-town strongman, broad face, practical armor, intimidating grounded power",
    "雷横": "Chinese male stern constable-turned-outlaw, weathered face, practical dark armor",
    "阮小二": "Chinese male water-bandit elder brother, river fighter, weathered skin, darker travel layers",
    "阮小五": "Chinese male water-bandit middle brother, tough grin, rough river gear, agile navy presence",
    "阮小七": "Chinese male water-bandit younger brother, fierce playful expression, travel wraps, dangerous river outlaw energy",
    "张顺": "Chinese male handsome water hero, lean swimmer build, calm eyes, navy fighter styling",
    "张清": "Chinese male stone-throwing cavalry fighter, sharp gaze, lighter armor, agile precision-warrior presence",
    "杨雄": "Chinese male executioner-warrior, cold stern face, dark officer layers",
    "石秀": "Chinese male lean deadly drifter, intense eyes, dark travel clothing, assassin-like sharpness",
    "解珍": "Chinese male mountain hunter, fur-trimmed rugged clothing, hunter-warrior face",
    "解宝": "Chinese male mountain hunter, younger rugged hunter face, fur and leather layers",
    "燕青": "Chinese male youthful handsome retainer, elegant features, refined martial grace, performer-fighter aura",
    "扈三娘": "Chinese female warrior, beautiful but fierce, light armor, twin-blade or spear-general styling, heroic focus",
    "顾大嫂": "Chinese female warrior matriarch, strong practical face, sturdy innkeeper-fighter clothing, formidable presence",
    "孙二娘": "Chinese female outlaw innkeeper, dangerous beauty, bold eyes, layered travel clothing, ruthless energy",
}


def normalize_weapon(raw: str) -> str:
    value = " ".join(raw.replace(" ", " ").split())
    replacements = {
        "Sword / Taoist magic": "sword and Daoist ritual magic",
        "Blue Dragon Crescent Moon Blade (青龍偃月刀)": "green-dragon guandao",
        "8-foot-long (2.4 m) Snake 长枪 (丈八蛇矛); 朴刀 (朴刀)": "long snake spear",
        "Pair of 钢鞭": "paired steel whips",
        "长枪; 长弓 and arrows": "long bow and spear",
        "Steel alloy 长枪 (渾鐵點鋼槍); Flying 短刃 (飛刀)": "steel spear and throwing knives",
    }
    return replacements.get(value, value)


def build_descriptor(hero: dict) -> str:
    if hero["name_zh"] in MANUAL_OVERRIDES:
        return f"{hero['name_zh']} ({hero['nickname_zh']}), {MANUAL_OVERRIDES[hero['name_zh']]}"

    gender = "female" if hero["name_zh"] in FEMALE_NAMES else "male"
    role_style = ROLE_STYLE.get(hero["type_label"], "distinct outlaw hero presence, Song-dynasty clothing and armor")
    weapon = normalize_weapon(hero["weapon_zh"])
    star_name = hero["star_name_zh"].replace("星", "")
    face_style = FACE_ARCHETYPES[(hero["id"] - 1) % len(FACE_ARCHETYPES)]
    head_style = HEAD_STYLES[(hero["id"] - 1) % len(HEAD_STYLES)]
    accent_style = ACCENT_STYLES[(hero["id"] - 1) % len(ACCENT_STYLES)]

    descriptor_parts = [
        f"Chinese {gender} Water Margin hero",
        f"name {hero['name_zh']}",
        f"nickname {hero['nickname_zh']}",
        face_style,
        head_style,
        role_style,
        f"associated with {star_name}",
        f"costume accents in {accent_style}",
    ]

    if weapon and weapon != "拳脚与杂兵器":
        descriptor_parts.append(f"signature weapon styling inspired by {weapon}")

    if gender == "female":
        descriptor_parts.append("clearly feminine face and silhouette, heroic and formidable")
    else:
        descriptor_parts.append("strong facial identity, historically inspired Song-dynasty styling")

    return ", ".join(descriptor_parts)


def build_batch_prompt(batch: list[dict], batch_index: int) -> str:
    panel_lines = [
        f"{index}. {build_descriptor(hero)}"
        for index, hero in enumerate(batch, start=1)
    ]

    return "\n".join(
        [
            "Use case: historical-scene",
            "Asset type: 3x3 portrait sheet for a Chinese literary heroes website",
            (
                "Primary request: Create a single square image laid out as a clean 3x3 grid of nine separate portrait "
                "panels, each panel containing one distinct bust portrait of a Water Margin hero. Keep every portrait "
                "centered and visually separated so the sheet can be cropped into nine individual avatars later."
            ),
            "Scene/backdrop: each panel has a simple dark ink-texture background with subtle ember glow, no props, no scenery, no text",
            "Style/medium: stylized semi-realistic digital painting, cinematic Chinese historical fantasy, consistent art direction across all nine portraits, high facial detail, readable at thumbnail size",
            "Composition/framing: each hero is chest-up or shoulders-up, centered in their own panel, enough padding around the head, one person per panel only",
            "Lighting/mood: dramatic warm rim light, heroic but moody",
            "Color palette: ink black, aged gold, muted crimson, deep green, steel gray",
            "Constraints: exactly nine portraits in a 3x3 grid, no text, no watermark, no merged panels, no extra people, no hands covering faces, keep the portraits distinct and crop-friendly",
            "Panel order left-to-right, top-to-bottom:",
            *panel_lines,
            f"Batch tag: water-margin-batch-{batch_index:02d}",
        ]
    )


def main() -> None:
    dataset = json.loads(DATA_PATH.read_text())
    heroes = dataset["heroes"]
    batches = []

    for offset in range(0, len(heroes), BATCH_SIZE):
        batch = heroes[offset : offset + BATCH_SIZE]
        batch_index = offset // BATCH_SIZE + 1
        batches.append(
            {
                "batch": batch_index,
                "heroes": [
                    {
                        "id": hero["id"],
                        "name_zh": hero["name_zh"],
                        "slug": Path(hero["artwork"]).stem,
                        "artwork_path": hero["artwork"],
                        "sprite_path": hero["sprite"],
                        "descriptor": build_descriptor(hero),
                    }
                    for hero in batch
                ],
                "prompt": build_batch_prompt(batch, batch_index),
            }
        )

    OUTPUT_JSON.write_text(json.dumps({"batches": batches}, ensure_ascii=False, indent=2) + "\n")

    md_parts = ["# Water Margin Avatar Prompts", ""]
    for batch in batches:
        md_parts.append(f"## Batch {batch['batch']:02d}")
        md_parts.append("")
        md_parts.append("```text")
        md_parts.append(batch["prompt"])
        md_parts.append("```")
        md_parts.append("")

    OUTPUT_MD.write_text("\n".join(md_parts))


if __name__ == "__main__":
    main()
