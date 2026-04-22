from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import requests
from bs4 import BeautifulSoup


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
PUBLIC_DIR = ROOT / "public"
ARTWORK_DIR = PUBLIC_DIR / "heroes" / "artwork"
SPRITE_DIR = PUBLIC_DIR / "heroes" / "sprite"
SOURCE_URL = "https://en.wikipedia.org/wiki/108_Heroes"


TYPE_META = {
    "leader": {
        "label": "统帅",
        "color": "#d4b16a",
        "ring": "#f1d18f",
        "icon": "banner",
    },
    "strategist": {
        "label": "军师",
        "color": "#8cc8ff",
        "ring": "#b9e8ff",
        "icon": "fan",
    },
    "cavalry": {
        "label": "骑军",
        "color": "#ff7f66",
        "ring": "#ffc4a8",
        "icon": "horse",
    },
    "infantry": {
        "label": "步战",
        "color": "#98d36d",
        "ring": "#cbf2a2",
        "icon": "blade",
    },
    "navy": {
        "label": "水战",
        "color": "#54c8d8",
        "ring": "#9af5ff",
        "icon": "wave",
    },
    "vanguard": {
        "label": "先锋",
        "color": "#ff5c7a",
        "ring": "#ffb5be",
        "icon": "spear",
    },
    "guard": {
        "label": "护阵",
        "color": "#7d90ff",
        "ring": "#c0c9ff",
        "icon": "shield",
    },
    "support": {
        "label": "奇技",
        "color": "#c08dff",
        "ring": "#e7caff",
        "icon": "seal",
    },
}


TYPE_MULTIPLIER = {
    "leader": {"guard": 2, "infantry": 1.5, "strategist": 0.75},
    "strategist": {"leader": 2, "support": 1.5, "cavalry": 0.75},
    "cavalry": {"strategist": 2, "support": 1.5, "guard": 0.75},
    "infantry": {"cavalry": 2, "guard": 1.5, "navy": 0.75},
    "navy": {"infantry": 2, "vanguard": 1.5, "support": 0.75},
    "vanguard": {"navy": 2, "strategist": 1.5, "leader": 0.75},
    "guard": {"cavalry": 2, "leader": 1.5, "infantry": 0.75},
    "support": {"navy": 2, "guard": 1.5, "vanguard": 0.75},
}


WEAPON_TRANSLATIONS = {
    "spear": "长枪",
    "cudgel": "棍棒",
    "pudao": "朴刀",
    "bronze hammer": "铜锤",
    "pair of swords": "双剑",
    "sword of death": "丧门剑",
    "steel clubs": "钢鞭",
    "daggers": "短刃",
    "halberd": "方天戟",
    "axe": "战斧",
    "staff": "禅杖",
    "trident": "三叉戟",
    "knife": "利刃",
    "lance": "长矛",
    "chain": "锁链",
    "whip": "钢鞭",
    "bow": "长弓",
    "crossbow": "弩",
    "shield": "盾牌",
    "hooked spear": "钩镰枪",
    "twin sabres": "双刀",
    "double swords": "双剑",
    "sabre": "钢刀",
    "hammer": "铁锤",
    "fork": "铁叉",
    "rake": "钉耙",
    "fan": "羽扇",
    "rope": "套索",
    "scissors": "剪刀",
}


FATE_TRANSLATIONS = {
    "poisoned": "中毒身亡",
    "assassinated": "遭刺身亡",
    "suicide": "自尽",
    "executed": "伏法",
    "drowned": "溺亡",
    "killed in battle": "战死",
    "illness": "病逝",
    "survived": "善终",
    "retired": "退隐",
}


@dataclass
class HeroRecord:
    id: int
    canonical_rank: int
    inner_rank: int
    camp_key: str
    camp_label: str
    star_code: str
    star_name_zh: str
    star_name_en: str
    slug: str
    name_zh: str
    name_en: str
    nickname_zh: str
    nickname_en: str
    aliases_zh: list[str]
    aliases_en: list[str]
    division: str
    division_zh: str
    designation: str
    designation_zh: str
    origin: str
    weapon: str
    weapon_zh: str
    first_chapter: int
    fate: str
    fate_zh: str
    type_key: str
    type_label: str
    color: str
    artwork: str
    sprite: str
    stats: dict[str, int]
    stat_total: int
    focus_tags: list[str]
    flavor: str
    squad_id: str
    squad_label: str


def fetch_source() -> str:
    response = requests.get(SOURCE_URL, timeout=20, headers={"User-Agent": "Mozilla/5.0"})
    response.raise_for_status()
    return response.text


def parse_wiki_tables(html: str) -> list[dict[str, str]]:
    soup = BeautifulSoup(html, "lxml")
    tables = soup.select("table.wikitable")
    heroes: list[dict[str, str]] = []

    for table in tables:
        rows = table.select("tr")
        headers = [cell.get_text(" ", strip=True) for cell in rows[0].select("th")]
        for row in rows[1:]:
            cells = row.select("th,td")
            if len(cells) != len(headers):
                continue
            item = {headers[index]: cells[index].get_text(" ", strip=True) for index in range(len(headers))}
            heroes.append(item)

    return heroes


def parse_person_field(value: str) -> tuple[str, str]:
    match = re.match(r"^(.*?)\s*\((.*?)\)$", value)
    if not match:
        return value.strip(), value.strip()

    english = match.group(1).strip().strip('"')
    chinese_parts = [part.strip() for part in match.group(2).split(";") if part.strip()]
    chinese = chinese_parts[0] if chinese_parts else english
    return english, chinese


def parse_aliases(value: str) -> tuple[list[str], list[str]]:
    zh_list: list[str] = []
    en_list: list[str] = []
    for segment in [part.strip() for part in value.split(";") if part.strip()]:
        en_name, zh_name = parse_person_field(segment)
        if zh_name not in zh_list:
            zh_list.append(zh_name)
        if en_name not in en_list:
            en_list.append(en_name)
    return zh_list, en_list


def parse_star(value: str) -> tuple[str, str, str]:
    parts = [part.strip() for part in value.split(";") if part.strip()]
    star_code_en, star_name_zh = parse_person_field(parts[0])
    if len(parts) > 1:
        star_name_en, star_name_zh_full = parse_person_field(parts[1])
        return star_code_en, star_name_zh_full, star_name_en
    return star_code_en, f"{star_name_zh}星", star_code_en


def slugify(text: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", text.lower())
    return normalized.strip("-")


def translate_weapon(value: str) -> str:
    if not value:
        return "拳脚与杂兵器"

    lowered = value.lower()
    translated = value
    for english, chinese in WEAPON_TRANSLATIONS.items():
        translated = re.sub(english, chinese, translated, flags=re.IGNORECASE)
    translated = translated.replace(",", " / ")
    return translated


def translate_fate(value: str) -> str:
    lowered = value.lower()
    for english, chinese in FATE_TRANSLATIONS.items():
        if english in lowered:
            return chinese
    return "结局未详"


def normalize_division(division: str, designation: str) -> tuple[str, str]:
    text = f"{division} {designation}".lower()
    if "leader" in designation.lower():
        return "leader", TYPE_META["leader"]["label"]
    if "strategist" in text:
        return "strategist", TYPE_META["strategist"]["label"]
    if "naval" in text or "boat" in text or "ferry" in text:
        return "navy", TYPE_META["navy"]["label"]
    if "vanguard" in text:
        return "vanguard", TYPE_META["vanguard"]["label"]
    if "scouting" in text or "cavalry" in text:
        return "cavalry", TYPE_META["cavalry"]["label"]
    if "guard" in text or "jailer" in text:
        return "guard", TYPE_META["guard"]["label"]
    if "smith" in text or "physician" in text or "hostel" in text or "musician" in text or "tailor" in text or "artisan" in text or "innkeeper" in text:
        return "support", TYPE_META["support"]["label"]
    if "infantry" in text or "bandit" in text or "marshal" in text or "hunter" in text:
        return "infantry", TYPE_META["infantry"]["label"]
    return "support", TYPE_META["support"]["label"]


def translate_division(division: str, type_label: str) -> str:
    lowered = division.lower()
    if "commander" in lowered:
        return "梁山中军"
    if "strategist" in lowered:
        return "军师营"
    if "naval" in lowered:
        return "水军营"
    if "vanguard" in lowered:
        return "先锋营"
    if "scouting" in lowered or "cavalry" in lowered:
        return "马军营"
    if "infantry" in lowered:
        return "步军营"
    if "guard" in lowered:
        return "护阵营"
    return f"{type_label}营"


def translate_designation(designation: str, type_label: str) -> str:
    lowered = designation.lower()
    if "leader" == lowered:
        return "寨主"
    if "deputy leader" in lowered:
        return "副寨主"
    if "chief strategist" in lowered:
        return "总军师"
    if "strategist" in lowered:
        return "军师"
    if "vanguard" in lowered:
        return "先锋"
    if "naval" in lowered:
        return "水军统制"
    if "cavalry" in lowered:
        return "马军头领"
    if "infantry" in lowered:
        return "步军头领"
    if "guard" in lowered:
        return "护阵头领"
    if "deputy" in lowered:
        return "副统制"
    if "general" in lowered:
        return "头领"
    return type_label


def pick_squad(rank: int, type_key: str, camp_label: str) -> tuple[str, str]:
    bucket = math.ceil(rank / 12)
    if type_key in {"leader", "strategist"}:
        squad_name = "中军议事"
    elif type_key in {"cavalry", "vanguard"}:
        squad_name = "马军冲阵"
    elif type_key == "navy":
        squad_name = "水寨战船"
    elif type_key == "guard":
        squad_name = "护寨列阵"
    elif type_key == "support":
        squad_name = "机巧后军"
    else:
        squad_name = "步军营阵"
    return f"{camp_label}-{bucket}", squad_name


def build_stats(rank: int, type_key: str) -> dict[str, int]:
    rank_power = 110 - rank
    stats = {
        "统率": 42 + rank_power,
        "武勇": 38 + int(rank_power * 0.72),
        "谋略": 36 + int(rank_power * 0.64),
        "机动": 34 + int(rank_power * 0.58),
        "坚忍": 40 + int(rank_power * 0.66),
        "威望": 44 + int(rank_power * 0.76),
    }

    adjustments = {
        "leader": {"统率": 20, "威望": 18, "谋略": 8},
        "strategist": {"谋略": 24, "统率": 10, "机动": 6},
        "cavalry": {"武勇": 20, "机动": 18, "统率": 6},
        "infantry": {"武勇": 18, "坚忍": 18, "威望": 4},
        "navy": {"机动": 16, "谋略": 12, "坚忍": 8},
        "vanguard": {"武勇": 22, "机动": 16, "威望": 8},
        "guard": {"坚忍": 24, "统率": 10, "武勇": 8},
        "support": {"谋略": 16, "统率": 10, "威望": 8},
    }

    for key, value in adjustments[type_key].items():
        stats[key] += value

    return stats


def build_focus_tags(type_label: str, weapon_zh: str, fate_zh: str, camp_label: str) -> list[str]:
    return [camp_label, type_label, weapon_zh.split(" / ")[0], fate_zh]


def build_flavor(hero: HeroRecord) -> str:
    return (
        f"「{hero.nickname_zh}」{hero.name_zh}列{hero.star_name_zh}，"
        f"座次第 {hero.canonical_rank}。梁山中主司{hero.designation_zh}，"
        f"偏长{hero.weapon_zh}，常被归入{hero.division_zh}战线。"
    )


def build_icon(icon: str, color: str, ring: str) -> str:
    if icon == "banner":
        return f'<path d="M160 128h34v238h-34z" fill="{ring}"/><path d="M194 128 356 154 294 226 356 298 194 322z" fill="{color}" />'
    if icon == "fan":
        return f'<path d="M194 320c18-96 76-160 176-188 8 52-10 108-52 162-38 48-78 78-124 92Z" fill="{color}" /><path d="M182 332c22-18 44-22 70-14" stroke="{ring}" stroke-width="12" fill="none" stroke-linecap="round" />'
    if icon == "horse":
        return f'<path d="M148 296c34-96 78-148 134-158l40-42 38 18-24 42 40 44-24 22-24-22-34 18 8 106h-34l-16-78-28 10-20 68h-34Z" fill="{color}" />'
    if icon == "blade":
        return f'<path d="M188 332 316 106l42 42-170 184Z" fill="{color}" /><rect x="156" y="304" width="74" height="22" rx="10" fill="{ring}" />'
    if icon == "wave":
        return f'<path d="M110 268c32-28 64-28 96 0s64 28 96 0 64-28 96 0v50H110Z" fill="{color}" /><path d="M110 224c32-28 64-28 96 0s64 28 96 0 64-28 96 0" stroke="{ring}" stroke-width="12" fill="none" stroke-linecap="round" />'
    if icon == "spear":
        return f'<path d="M178 348 322 112l26 26-144 236Z" fill="{color}" /><path d="M322 112 358 78l28 28-38 32Z" fill="{ring}" />'
    if icon == "shield":
        return f'<path d="M256 96 370 144v86c0 82-48 140-114 186-66-46-114-104-114-186v-86Z" fill="{color}" /><path d="M256 142v224" stroke="{ring}" stroke-width="12" />'
    return f'<circle cx="256" cy="208" r="96" fill="{color}" /><path d="M188 310c18-72 70-128 136-146" stroke="{ring}" stroke-width="12" fill="none" stroke-linecap="round" />'


def render_svg(hero: HeroRecord, sprite: bool) -> str:
    meta = TYPE_META[hero.type_key]
    size = 256 if sprite else 768
    name_size = 28 if sprite else 58
    nick_size = 14 if sprite else 26
    rank_size = 24 if sprite else 40
    icon = build_icon(meta["icon"], meta["color"], meta["ring"])
    camp_color = "#a84f3c" if hero.camp_key == "tiangang" else "#495d86"

    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 512 512" fill="none">
  <defs>
    <linearGradient id="bg" x1="64" y1="48" x2="440" y2="464" gradientUnits="userSpaceOnUse">
      <stop stop-color="#141112"/>
      <stop offset="0.55" stop-color="#23191b"/>
      <stop offset="1" stop-color="#0b0b0f"/>
    </linearGradient>
    <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(256 220) rotate(90) scale(220)">
      <stop stop-color="{meta['ring']}" stop-opacity="0.34"/>
      <stop offset="1" stop-color="{meta['ring']}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" rx="36" fill="url(#bg)"/>
  <rect x="18" y="18" width="476" height="476" rx="28" stroke="{camp_color}" stroke-opacity="0.55" stroke-width="2"/>
  <circle cx="256" cy="224" r="176" fill="url(#glow)"/>
  <circle cx="256" cy="224" r="148" stroke="{meta['ring']}" stroke-opacity="0.28" stroke-width="2" stroke-dasharray="8 10"/>
  <circle cx="256" cy="224" r="112" stroke="{meta['ring']}" stroke-opacity="0.2" stroke-width="1.5"/>
  <path d="M84 114h344" stroke="{camp_color}" stroke-opacity="0.5" stroke-width="2"/>
  <path d="M84 398h344" stroke="{camp_color}" stroke-opacity="0.3" stroke-width="2"/>
  <g opacity="0.96">{icon}</g>
  <text x="48" y="74" fill="{camp_color}" font-family="'Noto Serif SC','STSong',serif" font-size="{rank_size}" letter-spacing="4">第{hero.canonical_rank:03d}席</text>
  <text x="256" y="402" fill="#f5ede0" font-family="'Noto Serif SC','STSong',serif" font-size="{name_size}" text-anchor="middle">{hero.name_zh}</text>
  <text x="256" y="438" fill="{meta['ring']}" font-family="'Noto Sans SC','PingFang SC',sans-serif" font-size="{nick_size}" text-anchor="middle">「{hero.nickname_zh}」 · {hero.star_name_zh}</text>
  <text x="256" y="468" fill="#cdbf9f" font-family="'Noto Sans SC','PingFang SC',sans-serif" font-size="{nick_size}" text-anchor="middle">{hero.designation_zh} · {hero.type_label}</text>
</svg>"""


def write_svg(hero: HeroRecord) -> None:
    (ARTWORK_DIR / f"{hero.slug}.svg").write_text(render_svg(hero, sprite=False), encoding="utf-8")
    (SPRITE_DIR / f"{hero.slug}.svg").write_text(render_svg(hero, sprite=True), encoding="utf-8")


def build_records(items: Iterable[dict[str, str]]) -> list[HeroRecord]:
    records: list[HeroRecord] = []

    for item in items:
        rank_key = "Rank (HS)" if "Rank (HS)" in item else "Rank (EF)"
        canonical_rank = int(item["Rank (L)"])
        inner_rank = int(item[rank_key])
        camp_key = "tiangang" if canonical_rank <= 36 else "disha"
        camp_label = "天罡三十六" if camp_key == "tiangang" else "地煞七十二"

        star_code_en, star_name_zh, star_name_en = parse_star(item["Star"])
        name_en, name_zh = parse_person_field(item["Name"])
        nickname_en, nickname_zh = parse_person_field(item["Nickname"])
        aliases_zh, aliases_en = parse_aliases(item.get("Other names", ""))
        division = item["Division"]
        designation = item["Designation"]
        origin = item["Origin"]
        weapon = item.get("Weapon", "")
        weapon_zh = translate_weapon(weapon)
        fate = item.get("Fate", "")
        fate_zh = translate_fate(fate)
        type_key, type_label = normalize_division(division, designation)
        division_zh = translate_division(division, type_label)
        designation_zh = translate_designation(designation, type_label)
        color = TYPE_META[type_key]["color"]
        slug = slugify(f"{canonical_rank}-{name_en}")
        stats = build_stats(canonical_rank, type_key)
        stat_total = sum(stats.values())
        squad_id, squad_label = pick_squad(canonical_rank, type_key, camp_label)

        hero = HeroRecord(
            id=canonical_rank,
            canonical_rank=canonical_rank,
            inner_rank=inner_rank,
            camp_key=camp_key,
            camp_label=camp_label,
            star_code=star_code_en,
            star_name_zh=star_name_zh,
            star_name_en=star_name_en,
            slug=slug,
            name_zh=name_zh,
            name_en=name_en,
            nickname_zh=nickname_zh,
            nickname_en=nickname_en,
            aliases_zh=aliases_zh,
            aliases_en=aliases_en,
            division=division,
            division_zh=division_zh,
            designation=designation,
            designation_zh=designation_zh,
            origin=origin,
            weapon=weapon,
            weapon_zh=weapon_zh,
            first_chapter=int(item["Chapter of first appearance"]),
            fate=fate,
            fate_zh=fate_zh,
            type_key=type_key,
            type_label=type_label,
            color=color,
            artwork=f"/heroes/artwork/{slug}.svg",
            sprite=f"/heroes/sprite/{slug}.svg",
            stats=stats,
            stat_total=stat_total,
            focus_tags=[],
            flavor="",
            squad_id=squad_id,
            squad_label=squad_label,
        )
        hero.focus_tags = build_focus_tags(type_label, weapon_zh, fate_zh, camp_label)
        hero.flavor = build_flavor(hero)
        records.append(hero)

    return sorted(records, key=lambda item: item.canonical_rank)


def build_dataset(records: list[HeroRecord]) -> dict:
    star_clusters = []
    for camp_key, camp_label in (("tiangang", "天罡三十六"), ("disha", "地煞七十二")):
        members = [hero for hero in records if hero.camp_key == camp_key]
        star_clusters.append(
            {
                "id": camp_key,
                "label": camp_label,
                "count": len(members),
                "members": [
                    {
                        "id": hero.id,
                        "nameZh": hero.name_zh,
                        "nicknameZh": hero.nickname_zh,
                        "starNameZh": hero.star_name_zh,
                        "typeLabel": hero.type_label,
                    }
                    for hero in members
                ],
            }
        )

    return {
        "generatedAt": "2026-04-23",
        "count": len(records),
        "source": SOURCE_URL,
        "heroes": [hero.__dict__ for hero in records],
        "starClusters": star_clusters,
        "typeMeta": TYPE_META,
        "typeChart": TYPE_MULTIPLIER,
    }


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    ARTWORK_DIR.mkdir(parents=True, exist_ok=True)
    SPRITE_DIR.mkdir(parents=True, exist_ok=True)

    html = fetch_source()
    parsed = parse_wiki_tables(html)
    records = build_records(parsed)

    for hero in records:
        write_svg(hero)

    dataset = build_dataset(records)
    (DATA_DIR / "water-margin-data.json").write_text(
        json.dumps(dataset, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"Generated {len(records)} heroes into {DATA_DIR / 'water-margin-data.json'}")


if __name__ == "__main__":
    main()
