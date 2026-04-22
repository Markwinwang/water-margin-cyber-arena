import rawData from "@/data/water-margin-data.json";

export type ViewMode = "cards" | "table" | "stars";
export type AppMode = "roster" | "battle";
export type SortMode = "rank" | "total" | "leadership" | "valor" | "strategy" | "renown" | "name";
export type CampFilter = "all" | "tiangang" | "disha";
export type BattleAction = "charge" | "guard" | "ultimate";
export type Winner = "player" | "ai" | null;

export interface TypeMeta {
  label: string;
  color: string;
  ring: string;
  icon: string;
}

export interface HeroRecord {
  id: number;
  canonical_rank: number;
  inner_rank: number;
  camp_key: "tiangang" | "disha";
  camp_label: string;
  star_code: string;
  star_name_zh: string;
  star_name_en: string;
  slug: string;
  name_zh: string;
  name_en: string;
  nickname_zh: string;
  nickname_en: string;
  aliases_zh: string[];
  aliases_en: string[];
  division: string;
  division_zh: string;
  designation: string;
  designation_zh: string;
  origin: string;
  weapon: string;
  weapon_zh: string;
  first_chapter: number;
  fate: string;
  fate_zh: string;
  type_key: HeroTypeKey;
  type_label: string;
  color: string;
  artwork: string;
  sprite: string;
  stats: Record<HeroStatKey, number>;
  stat_total: number;
  focus_tags: string[];
  flavor: string;
  squad_id: string;
  squad_label: string;
}

export interface StarCluster {
  id: "tiangang" | "disha";
  label: string;
  count: number;
  members: {
    id: number;
    nameZh: string;
    nicknameZh: string;
    starNameZh: string;
    typeLabel: string;
  }[];
}

export interface BattleCardState {
  heroId: number;
  currentHp: number;
  maxHp: number;
  shield: number;
  charge: number;
  fainted: boolean;
}

export interface BattleState {
  playerTeam: BattleCardState[];
  aiTeam: BattleCardState[];
  turn: number;
  logs: string[];
  winner: Winner;
}

interface WaterMarginDataset {
  generatedAt: string;
  count: number;
  source: string;
  heroes: HeroRecord[];
  starClusters: StarCluster[];
  typeMeta: Record<HeroTypeKey, TypeMeta>;
  typeChart: Record<HeroTypeKey, Partial<Record<HeroTypeKey, number>>>;
}

export type HeroTypeKey =
  | "leader"
  | "strategist"
  | "cavalry"
  | "infantry"
  | "navy"
  | "vanguard"
  | "guard"
  | "support";

export type HeroStatKey = "统率" | "武勇" | "谋略" | "机动" | "坚忍" | "威望";

const dataset = rawData as WaterMarginDataset;

export const rosterData = dataset;
export const heroList = dataset.heroes;
export const starClusters = dataset.starClusters;
export const typeMeta = dataset.typeMeta;
export const typeChart = dataset.typeChart;
export const heroById = new Map(heroList.map((hero) => [hero.id, hero]));
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withBasePath(path: string) {
  if (!path || path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return `${basePath}${path}`;
}

export function getHero(id: number) {
  return heroById.get(id);
}

export function filterHeroes(
  list: HeroRecord[],
  {
    search,
    type,
    camp,
    sort,
  }: {
    search: string;
    type: string;
    camp: CampFilter;
    sort: SortMode;
  }
) {
  const keyword = search.trim().toLowerCase();

  const filtered = list.filter((hero) => {
    const matchesSearch =
      !keyword ||
      hero.name_zh.toLowerCase().includes(keyword) ||
      hero.name_en.toLowerCase().includes(keyword) ||
      hero.nickname_zh.toLowerCase().includes(keyword) ||
      hero.star_name_zh.toLowerCase().includes(keyword) ||
      hero.designation_zh.toLowerCase().includes(keyword) ||
      hero.type_label.toLowerCase().includes(keyword);

    const matchesType = type === "all" || hero.type_key === type;
    const matchesCamp = camp === "all" || hero.camp_key === camp;
    return matchesSearch && matchesType && matchesCamp;
  });

  const sorters: Record<SortMode, (left: HeroRecord, right: HeroRecord) => number> = {
    rank: (left, right) => left.id - right.id,
    total: (left, right) => right.stat_total - left.stat_total || left.id - right.id,
    leadership: (left, right) => right.stats["统率"] - left.stats["统率"] || left.id - right.id,
    valor: (left, right) => right.stats["武勇"] - left.stats["武勇"] || left.id - right.id,
    strategy: (left, right) => right.stats["谋略"] - left.stats["谋略"] || left.id - right.id,
    renown: (left, right) => right.stats["威望"] - left.stats["威望"] || left.id - right.id,
    name: (left, right) => left.name_zh.localeCompare(right.name_zh, "zh-Hans-CN"),
  };

  return filtered.sort(sorters[sort]);
}

export function getTypeMultiplier(attacker: HeroTypeKey, defender: HeroTypeKey) {
  return typeChart[attacker]?.[defender] ?? 1;
}

export function pickRandomDeck(source: HeroRecord[], excluded: number[] = [], size = 3) {
  const candidates = source.filter((hero) => !excluded.includes(hero.id));
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, size).map((hero) => hero.id);
}

export function pickInitialDeck(source: HeroRecord[], excluded: number[] = [], size = 3) {
  return source
    .filter((hero) => !excluded.includes(hero.id))
    .sort((left, right) => left.id - right.id)
    .slice(0, size)
    .map((hero) => hero.id);
}

function createTeam(ids: number[]): BattleCardState[] {
  return ids
    .map((id) => getHero(id))
    .filter((hero): hero is HeroRecord => Boolean(hero))
    .map((hero) => ({
      heroId: hero.id,
      currentHp: Math.round(hero.stats["坚忍"] * 2.2 + hero.stats["统率"] * 0.9 + 40),
      maxHp: Math.round(hero.stats["坚忍"] * 2.2 + hero.stats["统率"] * 0.9 + 40),
      shield: 0,
      charge: 1,
      fainted: false,
    }));
}

export function createBattleState(playerIds: number[], aiIds: number[]): BattleState {
  return {
    playerTeam: createTeam(playerIds),
    aiTeam: createTeam(aiIds),
    turn: 1,
    logs: ["点将开始：排兵布阵，先手破阵者将夺下梁山风云局。"],
    winner: null,
  };
}

export function getActiveIndex(team: BattleCardState[]) {
  return team.findIndex((member) => !member.fainted);
}

function isTeamDefeated(team: BattleCardState[]) {
  return team.every((member) => member.fainted);
}

function getActionLabel(action: BattleAction) {
  if (action === "guard") return "结阵";
  if (action === "ultimate") return "绝技";
  return "冲阵";
}

function resolveDamage(target: BattleCardState, incoming: number) {
  const next = { ...target };
  let remaining = incoming;
  let absorbed = 0;

  if (next.shield > 0) {
    absorbed = Math.min(next.shield, remaining);
    next.shield -= absorbed;
    remaining -= absorbed;
  }

  next.currentHp = Math.max(0, next.currentHp - remaining);
  next.fainted = next.currentHp <= 0;

  return { target: next, dealt: remaining, absorbed };
}

function calculateDamage(attacker: HeroRecord, defender: HeroRecord, action: BattleAction) {
  const multiplier = getTypeMultiplier(attacker.type_key, defender.type_key);
  const attackStat =
    action === "ultimate"
      ? Math.max(attacker.stats["谋略"], attacker.stats["武勇"])
      : attacker.stats["武勇"];
  const defenseStat =
    action === "ultimate"
      ? Math.max(defender.stats["统率"], defender.stats["坚忍"])
      : defender.stats["坚忍"];
  const burstBonus = action === "ultimate" ? 1.3 : 1;
  const base = Math.max(
    20,
    attackStat * (action === "ultimate" ? 1.04 : 0.84) +
      attacker.stats["机动"] * 0.24 +
      attacker.stats["威望"] * 0.12 -
      defenseStat * 0.34 +
      multiplier * 12
  );

  return Math.round(base * burstBonus);
}

function chooseAiAction(aiState: BattleCardState, aiHero: HeroRecord, playerHero: HeroRecord): BattleAction {
  const advantage = getTypeMultiplier(aiHero.type_key, playerHero.type_key);
  const hpRatio = aiState.currentHp / aiState.maxHp;

  if (aiState.charge >= 2 && advantage >= 1.5) {
    return "ultimate";
  }

  if (hpRatio < 0.35 && aiState.shield < 28) {
    return "guard";
  }

  if (aiState.charge >= 3) {
    return "ultimate";
  }

  return "charge";
}

function autoSwitchLog(side: "我方" | "对手", team: BattleCardState[]) {
  const nextIndex = getActiveIndex(team);
  if (nextIndex === -1) return null;
  const hero = getHero(team[nextIndex].heroId);
  return hero ? `${side}改换 ${hero.name_zh} 上阵，战线继续推进。` : null;
}

export function resolveBattleTurn(state: BattleState, playerAction: BattleAction): BattleState {
  if (state.winner) return state;

  const nextPlayerTeam = state.playerTeam.map((member) => ({ ...member }));
  const nextAiTeam = state.aiTeam.map((member) => ({ ...member }));
  const playerIndex = getActiveIndex(nextPlayerTeam);
  const aiIndex = getActiveIndex(nextAiTeam);

  if (playerIndex === -1 || aiIndex === -1) {
    return { ...state, winner: playerIndex === -1 ? "ai" : "player" };
  }

  const playerFighter = nextPlayerTeam[playerIndex];
  const aiFighter = nextAiTeam[aiIndex];
  const playerHero = getHero(playerFighter.heroId)!;
  const aiHero = getHero(aiFighter.heroId)!;
  const aiAction = chooseAiAction(aiFighter, aiHero, playerHero);
  const logs: string[] = [];

  if (playerAction === "guard") {
    playerFighter.shield += Math.round(playerHero.stats["统率"] * 0.45 + 26);
    playerFighter.currentHp = Math.min(
      playerFighter.maxHp,
      playerFighter.currentHp + Math.round(playerHero.stats["坚忍"] * 0.16 + 10)
    );
    playerFighter.charge = Math.min(4, playerFighter.charge + 1);
    logs.push(`我方 ${playerHero.name_zh} 收束战线，结阵稳住阵脚。`);
  }

  if (aiAction === "guard") {
    aiFighter.shield += Math.round(aiHero.stats["统率"] * 0.45 + 26);
    aiFighter.currentHp = Math.min(
      aiFighter.maxHp,
      aiFighter.currentHp + Math.round(aiHero.stats["坚忍"] * 0.16 + 10)
    );
    aiFighter.charge = Math.min(4, aiFighter.charge + 1);
    logs.push(`对手 ${aiHero.name_zh} 结阵守势，准备反打。`);
  }

  const turnOrder = [
    {
      side: "player" as const,
      action: playerAction,
      initiative:
        playerHero.stats["机动"] +
        (playerAction === "ultimate" ? 12 : playerAction === "guard" ? 4 : 0),
    },
    {
      side: "ai" as const,
      action: aiAction,
      initiative:
        aiHero.stats["机动"] + (aiAction === "ultimate" ? 12 : aiAction === "guard" ? 4 : 0),
    },
  ].sort((left, right) => right.initiative - left.initiative);

  for (const actor of turnOrder) {
    const actingTeam = actor.side === "player" ? nextPlayerTeam : nextAiTeam;
    const targetTeam = actor.side === "player" ? nextAiTeam : nextPlayerTeam;
    const actingIndex = getActiveIndex(actingTeam);
    const targetIndex = getActiveIndex(targetTeam);

    if (actingIndex === -1 || targetIndex === -1) continue;
    if (actor.action === "guard") continue;

    const actingState = actingTeam[actingIndex];
    const targetState = targetTeam[targetIndex];
    const actingHero = getHero(actingState.heroId)!;
    const targetHero = getHero(targetState.heroId)!;

    let resolvedAction = actor.action;
    if (resolvedAction === "ultimate" && actingState.charge < 2) {
      resolvedAction = "charge";
      logs.push(
        `${actor.side === "player" ? "我方" : "对手"} ${actingHero.name_zh} 蓄势未满，只能改以冲阵试探。`
      );
    }

    const rawDamage = calculateDamage(actingHero, targetHero, resolvedAction);
    const { target, dealt, absorbed } = resolveDamage(targetState, rawDamage);
    targetTeam[targetIndex] = target;

    if (resolvedAction === "ultimate") {
      actingState.charge = Math.max(0, actingState.charge - 2);
    } else {
      actingState.charge = Math.min(4, actingState.charge + 1);
    }

    const multiplier = getTypeMultiplier(actingHero.type_key, targetHero.type_key);
    const multiplierCopy =
      multiplier >= 1.5 ? "克制命中" : multiplier < 1 ? "受制交锋" : "正面对撞";

    logs.push(
      `${actor.side === "player" ? "我方" : "对手"} ${actingHero.name_zh} 施展 ${getActionLabel(
        resolvedAction
      )}，对 ${targetHero.name_zh} 造成 ${dealt} 点军势伤害${
        absorbed > 0 ? `（格挡 ${absorbed}）` : ""
      }，${multiplierCopy}。`
    );

    if (target.fainted) {
      logs.push(`${targetHero.name_zh} 被迫退阵。`);
      const switchLog = autoSwitchLog(actor.side === "player" ? "对手" : "我方", targetTeam);
      if (switchLog) logs.push(switchLog);
    }
  }

  const winner: Winner = isTeamDefeated(nextPlayerTeam)
    ? "ai"
    : isTeamDefeated(nextAiTeam)
      ? "player"
      : null;

  if (winner) {
    logs.push(winner === "player" ? "你夺下了这场点将之战。" : "对手拿下了这场点将之战。");
  }

  return {
    playerTeam: nextPlayerTeam,
    aiTeam: nextAiTeam,
    turn: state.turn + 1,
    logs: [...logs, ...state.logs].slice(0, 10),
    winner,
  };
}
