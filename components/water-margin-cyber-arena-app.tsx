"use client";
/* eslint-disable @next/next/no-img-element */

import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { startTransition, useDeferredValue, useState, useSyncExternalStore } from "react";
import clsx from "clsx";
import {
  AppMode,
  BattleAction,
  BattleState,
  CampFilter,
  HeroRecord,
  SortMode,
  ViewMode,
  createBattleState,
  filterHeroes,
  getActiveIndex,
  getHero,
  getTypeMultiplier,
  heroList,
  pickInitialDeck,
  pickRandomDeck,
  resolveBattleTurn,
  starClusters,
  typeMeta,
} from "@/lib/water-margin";

const WaterMarginScene = dynamic(() => import("@/components/water-margin-scene"), {
  ssr: false,
  loading: () => (
    <div className="panel grid h-[420px] place-items-center rounded-[28px] text-sm text-[#d6c7a2]">
      正在点亮梁山将星主舞台…
    </div>
  ),
});

const TYPE_OPTIONS = ["all", ...Object.keys(typeMeta)];
const VIEW_OPTIONS: { key: ViewMode; label: string }[] = [
  { key: "cards", label: "将星卡阵" },
  { key: "table", label: "座次总表" },
  { key: "stars", label: "星宿阵图" },
];
const MODE_OPTIONS: { key: AppMode; label: string; copy: string }[] = [
  { key: "roster", label: "梁山名册", copy: "浏览 108 将，筛选座次、星宿、兵种与头领职责。" },
  { key: "battle", label: "点将对决", copy: "组建 3 将阵容，在金墨赛博战旗之下回合交锋。" },
];
const CAMP_OPTIONS: { value: CampFilter; label: string }[] = [
  { value: "all", label: "全体" },
  { value: "tiangang", label: "天罡" },
  { value: "disha", label: "地煞" },
];
const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "rank", label: "按座次" },
  { value: "total", label: "按总战力" },
  { value: "leadership", label: "按统率" },
  { value: "valor", label: "按武勇" },
  { value: "strategy", label: "按谋略" },
  { value: "renown", label: "按威望" },
  { value: "name", label: "按姓名" },
];
const ACTIONS: { key: BattleAction; title: string; copy: string }[] = [
  { key: "charge", title: "冲阵", copy: "正面进击，稳定积攒绝技气势。" },
  { key: "guard", title: "结阵", copy: "收束队形，立刻获得护势与回复。" },
  { key: "ultimate", title: "绝技", copy: "消耗 2 点气势，打出高额将星伤害。" },
];

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between text-xs text-[#cdbf9f]">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-2 rounded-full bg-white/6">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min((value / 180) * 100, 100)}%`,
            background: `linear-gradient(90deg, ${color}, rgba(255,246,223,0.92))`,
            boxShadow: `0 0 18px ${color}`,
          }}
        />
      </div>
    </div>
  );
}

function HpBar({
  current,
  max,
  shield,
  accent,
}: {
  current: number;
  max: number;
  shield: number;
  accent: string;
}) {
  const hpPct = Math.max(0, Math.min(100, (current / max) * 100));
  const shieldPct = Math.max(0, Math.min(100, (shield / max) * 100));

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between text-xs text-[#cdbf9f]">
        <span>HP {current}/{max}</span>
        <span>护势 {shield}</span>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-white/6">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${hpPct}%`,
            background: `linear-gradient(90deg, ${accent}, rgba(255,240,207,0.95))`,
          }}
        />
        {shieldPct > 0 ? (
          <div
            className="absolute inset-y-0 rounded-full bg-[#9ab6ff]/55"
            style={{ left: `${hpPct}%`, width: `${Math.min(100 - hpPct, shieldPct)}%` }}
          />
        ) : null}
      </div>
    </div>
  );
}

function BattleAvatar({
  hero,
  perspective,
}: {
  hero: HeroRecord;
  perspective: "player" | "ai";
}) {
  const meta = typeMeta[hero.type_key];

  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-[28px] border p-4",
        perspective === "player"
          ? "border-[rgba(212,177,106,0.18)] bg-[rgba(122,78,46,0.08)]"
          : "border-[rgba(125,144,255,0.18)] bg-[rgba(73,93,134,0.12)]"
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background: `radial-gradient(circle at 50% 24%, ${meta.color}28, transparent 36%), radial-gradient(circle at 84% 20%, ${meta.ring}22, transparent 22%)`,
        }}
      />
      <div className="relative z-10 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#d9c48d]/80">
              {perspective === "player" ? "Player Active" : "AI Active"}
            </p>
            <h3 className="font-display text-3xl uppercase">{hero.name_zh}</h3>
            <p className="mt-1 text-xs text-[#cdbf9f]">「{hero.nickname_zh}」 · {hero.star_name_zh}</p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-[#e8dcc0]">
            第 {hero.id} 席
          </span>
        </div>
        <div className="flex gap-2">
          <span
            className="rounded-full px-3 py-1 text-xs font-medium"
            style={{ color: meta.color, background: `${meta.color}26` }}
          >
            {meta.label}
          </span>
          <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-[#d8c9a6]">{hero.camp_label}</span>
        </div>
        <div className="grid place-items-center rounded-[22px] border border-white/8 bg-black/15 p-6">
          <img
            src={hero.artwork}
            alt={hero.name_zh}
            className={clsx(
              "h-44 w-44 object-contain drop-shadow-[0_18px_22px_rgba(0,0,0,0.45)]",
              perspective === "ai" ? "scale-x-[-1]" : ""
            )}
          />
        </div>
      </div>
    </div>
  );
}

export default function WaterMarginCyberArenaApp() {
  const sceneMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const [mode, setMode] = useState<AppMode>("roster");
  const [view, setView] = useState<ViewMode>("cards");
  const [sort, setSort] = useState<SortMode>("rank");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [campFilter, setCampFilter] = useState<CampFilter>("all");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [selectedId, setSelectedId] = useState(1);
  const [deckIds, setDeckIds] = useState<number[]>([1, 6, 14]);
  const [aiDeckIds, setAiDeckIds] = useState<number[]>(() => pickInitialDeck(heroList, [1, 6, 14]));
  const [battle, setBattle] = useState<BattleState | null>(null);

  const visibleHeroes = filterHeroes(heroList, {
    search: deferredSearch,
    type: typeFilter,
    camp: campFilter,
    sort,
  });

  const effectiveSelectedId = visibleHeroes.some((hero) => hero.id === selectedId)
    ? selectedId
    : (visibleHeroes[0]?.id ?? heroList[0].id);

  const selectedHero = getHero(effectiveSelectedId) ?? visibleHeroes[0] ?? heroList[0];
  const primaryType = typeMeta[selectedHero.type_key];
  const activeCluster = starClusters.find((cluster) => cluster.id === selectedHero.camp_key);
  const activeSquad = heroList
    .filter((hero) => hero.squad_id === selectedHero.squad_id)
    .sort((left, right) => left.id - right.id);
  const playerDeck = deckIds.map((id) => getHero(id)).filter((hero): hero is HeroRecord => Boolean(hero));
  const aiDeck = aiDeckIds.map((id) => getHero(id)).filter((hero): hero is HeroRecord => Boolean(hero));
  const playerActiveIndex = battle ? getActiveIndex(battle.playerTeam) : -1;
  const aiActiveIndex = battle ? getActiveIndex(battle.aiTeam) : -1;
  const playerActive =
    battle && playerActiveIndex !== -1 ? getHero(battle.playerTeam[playerActiveIndex].heroId) : null;
  const aiActive = battle && aiActiveIndex !== -1 ? getHero(battle.aiTeam[aiActiveIndex].heroId) : null;
  const playerMultiplier =
    playerActive && aiActive ? getTypeMultiplier(playerActive.type_key, aiActive.type_key) : 1;
  const aiMultiplier = aiActive && playerActive ? getTypeMultiplier(aiActive.type_key, playerActive.type_key) : 1;

  function updateSelected(nextId: number) {
    startTransition(() => {
      setSelectedId(nextId);
    });
  }

  function toggleDeck(id: number) {
    if (battle) return;

    setDeckIds((current) => {
      if (current.includes(id)) {
        return current.filter((item) => item !== id);
      }

      if (current.length >= 3) {
        return [...current.slice(1), id];
      }

      return [...current, id];
    });
  }

  function randomizeAi() {
    setAiDeckIds(pickRandomDeck(heroList, deckIds));
  }

  function startBattle() {
    if (deckIds.length !== 3) return;
    const nextAiDeck = aiDeckIds.length === 3 ? aiDeckIds : pickRandomDeck(heroList, deckIds);
    setAiDeckIds(nextAiDeck);
    setBattle(createBattleState(deckIds, nextAiDeck));
    setMode("battle");
  }

  function performAction(action: BattleAction) {
    if (!battle || battle.winner) return;
    setBattle((current) => (current ? resolveBattleTurn(current, action) : current));
  }

  function resetBattle() {
    setBattle(null);
    setAiDeckIds(pickRandomDeck(heroList, deckIds));
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex w-full max-w-[1560px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <motion.header
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="panel rounded-[32px] border border-[rgba(212,177,106,0.12)] px-6 py-6 sm:px-8"
        >
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <p className="mb-3 text-xs uppercase tracking-[0.38em] text-[#d8c284]">
                Next.js / Tailwind / Framer Motion / React Three Fiber
              </p>
              <h1 className="font-display text-5xl uppercase leading-none sm:text-7xl">梁山 Cyber Arena</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[#d2c3a0] sm:text-base">
                一个基于现代前端栈重构的《水浒传》108 将互动站点：上半区是将星军旗驱动的 3D
                主舞台，下半区则把梁山名册、座次总表、星宿阵图与点将对决并入同一战术界面。
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                { value: heroList.length, label: "一百单八将" },
                { value: 36, label: "天罡三十六" },
                { value: 72, label: "地煞七十二" },
                { value: "3D + Duel", label: "点将玩法" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-[22px] border border-[rgba(212,177,106,0.1)] bg-[rgba(15,10,12,0.36)] px-4 py-4"
                >
                  <div className="font-display text-2xl text-white">{item.value}</div>
                  <div className="mt-1 text-xs tracking-[0.18em] text-[#bda977] uppercase">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.header>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_420px]">
          <motion.div
            layout
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            className="panel overflow-hidden rounded-[32px] p-6 sm:p-7"
          >
            <div className="mb-5 flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[#d8c284]">Liangshan Star Engine</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="rounded-full border border-[rgba(212,177,106,0.24)] bg-[rgba(212,177,106,0.08)] px-4 py-2 font-display text-sm tracking-[0.18em] text-[#f0ddae]">
                    第 {selectedHero.id} 席
                  </span>
                  <div>
                    <h2 className="font-display text-4xl uppercase sm:text-6xl">{selectedHero.name_zh}</h2>
                    <p className="mt-1 text-sm text-[#d0c0a0]">
                      「{selectedHero.nickname_zh}」 · {selectedHero.star_name_zh} · {selectedHero.designation_zh}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span
                  className="rounded-full px-4 py-2 text-sm font-medium"
                  style={{
                    color: primaryType.color,
                    background: `${primaryType.color}20`,
                    border: `1px solid ${primaryType.color}50`,
                  }}
                >
                  {primaryType.label}
                </span>
                <span className="rounded-full border border-white/8 bg-white/[0.03] px-4 py-2 text-sm text-[#d6c7a2]">
                  {selectedHero.camp_label}
                </span>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_360px]">
              {sceneMounted ? (
                <WaterMarginScene hero={selectedHero} />
              ) : (
                <div className="panel grid h-[420px] place-items-center rounded-[28px] text-sm text-[#d6c7a2]">
                  正在点亮梁山将星主舞台…
                </div>
              )}

              <div className="flex flex-col gap-4">
                <div className="rounded-[24px] border border-[rgba(212,177,106,0.12)] bg-[rgba(15,10,12,0.36)] p-5">
                  <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.24em] text-[#af9a69]">
                    <span>人物档案</span>
                    <span className="text-[#e1c889]">Live</span>
                  </div>
                  <p className="text-sm leading-7 text-[#d6c7a2]">{selectedHero.flavor}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { label: "星宿", value: selectedHero.star_name_zh },
                    { label: "营职", value: selectedHero.designation_zh },
                    { label: "兵器", value: selectedHero.weapon_zh.split(" / ")[0] },
                    { label: "出场章回", value: `第 ${selectedHero.first_chapter} 回` },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-[20px] border border-[rgba(212,177,106,0.1)] bg-white/[0.03] px-4 py-4"
                    >
                      <p className="text-xs uppercase tracking-[0.2em] text-[#af9a69]">{item.label}</p>
                      <p className="mt-2 font-display text-3xl text-white">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-[24px] border border-[rgba(212,177,106,0.12)] bg-[rgba(15,10,12,0.36)] p-5">
                  <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-[0.24em] text-[#af9a69]">
                    <span>六维军势</span>
                    <span>{selectedHero.stat_total}</span>
                  </div>
                  <div className="grid gap-3">
                    {Object.entries(selectedHero.stats).map(([label, value]) => (
                      <StatBar key={label} label={label} value={value} color={primaryType.color} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.aside
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            className="panel rounded-[32px] p-5"
          >
            <div className="grid gap-5">
              <div className="rounded-[24px] border border-[rgba(212,177,106,0.1)] bg-[rgba(15,10,12,0.36)] p-5">
                <p className="text-xs uppercase tracking-[0.28em] text-[#d8c284]">Mode switch</p>
                <div className="mt-4 grid gap-3">
                  {MODE_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setMode(option.key)}
                      className={clsx(
                        "rounded-[20px] border px-4 py-4 text-left transition",
                        mode === option.key
                          ? "border-[rgba(212,177,106,0.45)] bg-[rgba(212,177,106,0.12)] text-white"
                          : "border-white/8 bg-white/[0.03] text-[#d6c7a2] hover:border-[rgba(212,177,106,0.25)]"
                      )}
                    >
                      <div className="font-medium">{option.label}</div>
                      <div className="mt-1 text-sm text-[#bba883]">{option.copy}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-[rgba(212,177,106,0.1)] bg-[rgba(15,10,12,0.36)] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.28em] text-[#d8c284]">Star Cluster</p>
                  <span className="rounded-full bg-white/[0.03] px-3 py-1 text-xs text-[#d6c7a2]">
                    {activeCluster?.count ?? 0} heroes
                  </span>
                </div>
                <div className="grid gap-3">
                  {activeSquad.slice(0, 8).map((hero) => (
                    <button
                      key={hero.id}
                      type="button"
                      onClick={() => updateSelected(hero.id)}
                      className={clsx(
                        "flex items-center gap-3 rounded-[18px] border px-3 py-3 text-left transition",
                        hero.id === selectedHero.id
                          ? "border-[rgba(212,177,106,0.45)] bg-[rgba(212,177,106,0.1)]"
                          : "border-white/8 bg-white/[0.03] hover:border-[rgba(212,177,106,0.25)]"
                      )}
                    >
                      <img
                        src={hero.sprite}
                        alt={hero.name_zh}
                        className="h-12 w-12 rounded-xl bg-white/5 object-contain"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-white">{hero.name_zh}</p>
                        <p className="truncate text-xs text-[#bba883]">{hero.squad_label}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-[rgba(212,177,106,0.1)] bg-[rgba(15,10,12,0.36)] p-5">
                <p className="text-xs uppercase tracking-[0.28em] text-[#d8c284]">Battle deck</p>
                <div className="mt-4 grid gap-3">
                  {playerDeck.map((hero) => (
                    <button
                      key={hero.id}
                      type="button"
                      onClick={() => updateSelected(hero.id)}
                      className="flex items-center gap-3 rounded-[18px] border border-white/8 bg-white/[0.03] px-3 py-3 text-left hover:border-[rgba(212,177,106,0.25)]"
                    >
                      <img
                        src={hero.sprite}
                        alt={hero.name_zh}
                        className="h-12 w-12 rounded-xl bg-white/5 object-contain"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-white">{hero.name_zh}</p>
                        <p className="text-xs text-[#bba883]">
                          {hero.type_label} · {hero.designation_zh}
                        </p>
                      </div>
                      <span className="font-display text-sm text-[#edd39b]">{hero.stat_total}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.aside>
        </section>

        <section className="panel rounded-[32px] p-5 sm:p-6">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-[#d8c284]">Explorer controls</p>
              <h2 className="mt-3 font-display text-3xl uppercase sm:text-4xl">
                {mode === "roster" ? "梁山名册矩阵" : "点将对决擂台"}
              </h2>
              <p className="mt-2 text-sm leading-7 text-[#d6c7a2]">
                {mode === "roster"
                  ? "用搜索、营种、天罡地煞和多视图浏览水浒 108 将。每一次选择都会同步 3D 主舞台。"
                  : "挑 3 位头领组队，对手会自动排出 3 将。利用兵种克制、护势与绝技气势赢下对决。"}
              </p>
            </div>

            {mode === "battle" ? (
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={randomizeAi}
                  disabled={Boolean(battle)}
                  className={clsx(
                    "rounded-full border px-4 py-2 text-sm transition",
                    battle
                      ? "border-white/8 bg-white/[0.02] text-[#7e7767]"
                      : "border-white/8 bg-white/[0.03] text-[#e6d6b0] hover:border-[rgba(212,177,106,0.25)]"
                  )}
                >
                  重排敌阵
                </button>
                {battle ? (
                  <button
                    type="button"
                    onClick={resetBattle}
                    className="rounded-full border border-[rgba(212,177,106,0.35)] bg-[rgba(212,177,106,0.1)] px-4 py-2 text-sm text-white"
                  >
                    重新点将
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startBattle}
                    disabled={deckIds.length !== 3}
                    className={clsx(
                      "rounded-full border px-4 py-2 text-sm transition",
                      deckIds.length === 3
                        ? "border-[rgba(212,177,106,0.35)] bg-[rgba(212,177,106,0.1)] text-white"
                        : "border-white/8 bg-white/[0.02] text-[#7e7767]"
                    )}
                  >
                    开始对战
                  </button>
                )}
              </div>
            ) : null}
          </div>

          <AnimatePresence mode="wait">
            {mode === "roster" ? (
              <motion.div
                key="roster"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="grid gap-5"
              >
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_200px_200px_200px]">
                  <label className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-[#d6c7a2]">
                    <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-[#af9a69]">搜索</span>
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="姓名、绰号、星宿、营职"
                      className="w-full bg-transparent text-white outline-none placeholder:text-[#7e7767]"
                    />
                  </label>

                  <label className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-[#d6c7a2]">
                    <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-[#af9a69]">座次阵营</span>
                    <select
                      value={campFilter}
                      onChange={(event) => setCampFilter(event.target.value as CampFilter)}
                      className="w-full bg-transparent text-white outline-none"
                    >
                      {CAMP_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value} className="bg-[#130f12]">
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-[#d6c7a2]">
                    <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-[#af9a69]">头领类型</span>
                    <select
                      value={typeFilter}
                      onChange={(event) => setTypeFilter(event.target.value)}
                      className="w-full bg-transparent text-white outline-none"
                    >
                      {TYPE_OPTIONS.map((type) => (
                        <option key={type} value={type} className="bg-[#130f12]">
                          {type === "all" ? "全部" : typeMeta[type as keyof typeof typeMeta].label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-[#d6c7a2]">
                    <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-[#af9a69]">排序</span>
                    <select
                      value={sort}
                      onChange={(event) => setSort(event.target.value as SortMode)}
                      className="w-full bg-transparent text-white outline-none"
                    >
                      {SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value} className="bg-[#130f12]">
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="flex flex-wrap gap-3">
                  {VIEW_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setView(option.key)}
                      className={clsx(
                        "rounded-full border px-4 py-2 text-sm transition",
                        view === option.key
                          ? "border-[rgba(212,177,106,0.4)] bg-[rgba(212,177,106,0.1)] text-white"
                          : "border-white/8 bg-white/[0.03] text-[#d6c7a2] hover:border-[rgba(212,177,106,0.25)]"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {view === "cards" ? (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {visibleHeroes.map((hero, index) => {
                      const meta = typeMeta[hero.type_key];
                      const isSelected = hero.id === selectedHero.id;
                      const inDeck = deckIds.includes(hero.id);

                      return (
                        <motion.article
                          key={hero.id}
                          initial={{ opacity: 0, y: 14 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.006 }}
                          onClick={() => updateSelected(hero.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              updateSelected(hero.id);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          className={clsx(
                            "relative overflow-hidden rounded-[26px] border px-4 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(212,177,106,0.65)]",
                            isSelected
                              ? "border-[rgba(212,177,106,0.45)] bg-[rgba(212,177,106,0.1)]"
                              : "border-white/8 bg-white/[0.03] hover:border-[rgba(212,177,106,0.25)]"
                          )}
                        >
                          <div
                            className="pointer-events-none absolute inset-0 opacity-60"
                            style={{
                              background: `radial-gradient(circle at top right, ${meta.color}22, transparent 32%)`,
                            }}
                          />
                          <div className="relative z-10 flex flex-col gap-4">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <h3 className="text-xl font-semibold text-white">{hero.name_zh}</h3>
                                <p className="text-xs text-[#bba883]">「{hero.nickname_zh}」 · {hero.star_name_zh}</p>
                              </div>
                              {inDeck ? (
                                <span className="rounded-full bg-[rgba(212,177,106,0.12)] px-3 py-1 text-xs text-[#f2deb1]">
                                  已点将
                                </span>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span
                                className="rounded-full px-3 py-1 text-xs"
                                style={{ color: meta.color, background: `${meta.color}26` }}
                              >
                                {meta.label}
                              </span>
                              <span className="rounded-full bg-white/[0.03] px-3 py-1 text-xs text-[#d4c5a0]">
                                {hero.camp_label}
                              </span>
                            </div>
                            <div className="grid min-h-40 place-items-center rounded-[22px] border border-white/8 bg-black/15 p-4">
                              <img
                                src={hero.artwork}
                                alt={hero.name_zh}
                                className="h-32 w-32 object-contain drop-shadow-[0_12px_16px_rgba(0,0,0,0.4)]"
                              />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                ["总值", hero.stat_total],
                                ["统率", hero.stats["统率"]],
                                ["武勇", hero.stats["武勇"]],
                              ].map(([label, value]) => (
                                <div
                                  key={label}
                                  className="rounded-[16px] border border-white/8 bg-white/[0.03] px-3 py-3"
                                >
                                  <p className="text-[11px] uppercase tracking-[0.16em] text-[#af9a69]">{label}</p>
                                  <p className="mt-1 font-display text-xl text-white">{value}</p>
                                </div>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleDeck(hero.id);
                              }}
                              className={clsx(
                                "rounded-full border px-4 py-2 text-sm transition",
                                inDeck
                                  ? "border-[rgba(212,177,106,0.28)] bg-[rgba(212,177,106,0.08)] text-[#f2deb1]"
                                  : "border-white/8 bg-white/[0.03] text-[#e6d6b0] hover:border-[rgba(212,177,106,0.25)]"
                              )}
                            >
                              {inDeck ? "撤下此将" : "加入阵容"}
                            </button>
                          </div>
                        </motion.article>
                      );
                    })}
                  </div>
                ) : null}

                {view === "table" ? (
                  <div className="cyber-scrollbar overflow-auto rounded-[28px] border border-[rgba(212,177,106,0.12)]">
                    <table className="min-w-[1120px] w-full text-left">
                      <thead className="bg-[rgba(20,14,18,0.84)] text-xs uppercase tracking-[0.2em] text-[#d8c284]">
                        <tr>
                          {["座次", "头领", "星宿", "营种", "总值", "统率", "武勇", "谋略", "机动", "威望"].map((label) => (
                            <th key={label} className="px-4 py-4 font-medium">
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visibleHeroes.map((hero) => (
                          <tr
                            key={hero.id}
                            onClick={() => updateSelected(hero.id)}
                            className={clsx(
                              "cursor-pointer border-t border-white/6 transition hover:bg-[rgba(212,177,106,0.06)]",
                              hero.id === selectedHero.id ? "bg-[rgba(212,177,106,0.08)]" : ""
                            )}
                          >
                            <td className="px-4 py-4">第 {hero.id} 席</td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                <img
                                  src={hero.sprite}
                                  alt={hero.name_zh}
                                  className="h-10 w-10 rounded-xl bg-white/5 object-contain"
                                />
                                <div>
                                  <div className="font-medium text-white">{hero.name_zh}</div>
                                  <div className="text-xs text-[#bba883]">「{hero.nickname_zh}」</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4">{hero.star_name_zh}</td>
                            <td className="px-4 py-4">{hero.type_label}</td>
                            <td className="px-4 py-4">{hero.stat_total}</td>
                            <td className="px-4 py-4">{hero.stats["统率"]}</td>
                            <td className="px-4 py-4">{hero.stats["武勇"]}</td>
                            <td className="px-4 py-4">{hero.stats["谋略"]}</td>
                            <td className="px-4 py-4">{hero.stats["机动"]}</td>
                            <td className="px-4 py-4">{hero.stats["威望"]}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {view === "stars" ? (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {starClusters
                      .filter((cluster) => campFilter === "all" || cluster.id === campFilter)
                      .map((cluster) => (
                        <div
                          key={cluster.id}
                          className="rounded-[28px] border border-white/8 bg-white/[0.03] p-5"
                        >
                          <div className="mb-4 flex items-center justify-between gap-4">
                            <div>
                              <p className="text-xs uppercase tracking-[0.26em] text-[#d8c284]">Star cluster</p>
                              <h3 className="mt-2 text-2xl font-semibold text-white">{cluster.label}</h3>
                            </div>
                            <span className="rounded-full bg-white/[0.03] px-3 py-1 text-xs text-[#d6c7a2]">
                              共 {cluster.count} 将
                            </span>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {cluster.members.map((member) => {
                              const hero = getHero(member.id);
                              if (!hero) return null;
                              return (
                                <button
                                  key={member.id}
                                  type="button"
                                  onClick={() => updateSelected(member.id)}
                                  className={clsx(
                                    "flex items-center gap-3 rounded-[18px] border px-3 py-3 text-left transition",
                                    hero.id === selectedHero.id
                                      ? "border-[rgba(212,177,106,0.45)] bg-[rgba(212,177,106,0.1)]"
                                      : "border-white/8 bg-white/[0.03] hover:border-[rgba(212,177,106,0.25)]"
                                  )}
                                >
                                  <img
                                    src={hero.sprite}
                                    alt={hero.name_zh}
                                    className="h-12 w-12 rounded-xl bg-white/5 object-contain"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-white">{hero.name_zh}</p>
                                    <p className="truncate text-xs text-[#bba883]">
                                      「{hero.nickname_zh}」 · {hero.type_label}
                                    </p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : null}
              </motion.div>
            ) : (
              <motion.div
                key="battle"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]"
              >
                <div className="grid gap-5">
                  <div className="rounded-[28px] border border-[rgba(212,177,106,0.1)] bg-[rgba(15,10,12,0.36)] p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.26em] text-[#d8c284]">Your lineup</p>
                        <h3 className="mt-2 text-2xl font-semibold text-white">我方点将</h3>
                      </div>
                      <span className="rounded-full bg-white/[0.03] px-3 py-1 text-xs text-[#d6c7a2]">
                        {playerDeck.length}/3
                      </span>
                    </div>
                    <div className="grid gap-3">
                      {playerDeck.map((hero) => (
                        <div
                          key={hero.id}
                          className="flex items-center gap-3 rounded-[18px] border border-white/8 bg-white/[0.03] px-3 py-3"
                        >
                          <img src={hero.sprite} alt={hero.name_zh} className="h-12 w-12 rounded-xl bg-white/5 object-contain" />
                          <div className="flex-1">
                            <p className="font-medium text-white">{hero.name_zh}</p>
                            <p className="text-xs text-[#bba883]">{hero.type_label} · {hero.designation_zh}</p>
                          </div>
                          {!battle ? (
                            <button
                              type="button"
                              onClick={() => toggleDeck(hero.id)}
                              className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-xs text-[#d6c7a2] hover:border-[rgba(212,177,106,0.25)]"
                            >
                              撤下
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    <p className="mt-4 text-sm leading-7 text-[#bba883]">
                      在“梁山名册”模式中点击卡片即可加入或移出阵容。当前版本默认 3v3，敌阵也会自动排出 3 将。
                    </p>
                  </div>

                  <div className="rounded-[28px] border border-[rgba(212,177,106,0.1)] bg-[rgba(15,10,12,0.36)] p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.26em] text-[#d8c284]">Rival lineup</p>
                        <h3 className="mt-2 text-2xl font-semibold text-white">敌阵列席</h3>
                      </div>
                      <span className="rounded-full bg-white/[0.03] px-3 py-1 text-xs text-[#d6c7a2]">洗牌</span>
                    </div>
                    <div className="grid gap-3">
                      {aiDeck.map((hero) => (
                        <div
                          key={hero.id}
                          className="flex items-center gap-3 rounded-[18px] border border-white/8 bg-white/[0.03] px-3 py-3"
                        >
                          <img src={hero.sprite} alt={hero.name_zh} className="h-12 w-12 rounded-xl bg-white/5 object-contain" />
                          <div className="flex-1">
                            <p className="font-medium text-white">{hero.name_zh}</p>
                            <p className="text-xs text-[#bba883]">{hero.type_label} · {hero.designation_zh}</p>
                          </div>
                          <span className="font-display text-sm text-[#edd39b]">{hero.stat_total}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-5">
                  <div className="grid gap-5 xl:grid-cols-2">
                    <div className="rounded-[28px] border border-[rgba(212,177,106,0.1)] bg-[rgba(15,10,12,0.36)] p-5">
                      <div className="mb-4 flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.26em] text-[#d8c284]">Current clash</p>
                          <h3 className="mt-2 text-2xl font-semibold text-white">
                            {battle ? "我方出阵" : "等待点将"}
                          </h3>
                        </div>
                        {playerActive ? (
                          <span className="rounded-full bg-[rgba(212,177,106,0.12)] px-3 py-1 text-xs text-[#f0ddae]">
                            克制 {playerMultiplier.toFixed(2)}x
                          </span>
                        ) : null}
                      </div>
                      {battle && playerActive && playerActiveIndex !== -1 ? (
                        <div className="grid gap-4">
                          <BattleAvatar hero={playerActive} perspective="player" />
                          <HpBar
                            current={battle.playerTeam[playerActiveIndex].currentHp}
                            max={battle.playerTeam[playerActiveIndex].maxHp}
                            shield={battle.playerTeam[playerActiveIndex].shield}
                            accent={typeMeta[playerActive.type_key].color}
                          />
                        </div>
                      ) : (
                        <div className="rounded-[22px] border border-dashed border-white/12 px-5 py-8 text-sm text-[#bba883]">
                          集齐 3 位头领后点击“开始对战”。
                        </div>
                      )}
                    </div>

                    <div className="rounded-[28px] border border-[rgba(125,144,255,0.14)] bg-[rgba(20,18,29,0.42)] p-5">
                      <div className="mb-4 flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.26em] text-[#9ab6ff]">Enemy active</p>
                          <h3 className="mt-2 text-2xl font-semibold text-white">
                            {battle ? "敌阵出列" : "敌军待命"}
                          </h3>
                        </div>
                        {aiActive ? (
                          <span className="rounded-full bg-[rgba(125,144,255,0.12)] px-3 py-1 text-xs text-[#dbe3ff]">
                            克制 {aiMultiplier.toFixed(2)}x
                          </span>
                        ) : null}
                      </div>
                      {battle && aiActive && aiActiveIndex !== -1 ? (
                        <div className="grid gap-4">
                          <BattleAvatar hero={aiActive} perspective="ai" />
                          <HpBar
                            current={battle.aiTeam[aiActiveIndex].currentHp}
                            max={battle.aiTeam[aiActiveIndex].maxHp}
                            shield={battle.aiTeam[aiActiveIndex].shield}
                            accent={typeMeta[aiActive.type_key].color}
                          />
                        </div>
                      ) : (
                        <div className="rounded-[22px] border border-dashed border-white/12 px-5 py-8 text-sm text-[#bba883]">
                          对手已列阵，开战后这里会显示当前应战头领。
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="rounded-[28px] border border-[rgba(212,177,106,0.1)] bg-[rgba(15,10,12,0.36)] p-5">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.26em] text-[#d8c284]">Battle actions</p>
                          <h3 className="mt-2 text-2xl font-semibold text-white">
                            {battle ? `第 ${battle.turn} 回合` : "战术指令"}
                          </h3>
                        </div>
                        {battle?.winner ? (
                          <span className="rounded-full bg-[rgba(212,177,106,0.12)] px-4 py-2 text-sm text-[#f0ddae]">
                            {battle.winner === "player" ? "你赢了" : "敌阵胜出"}
                          </span>
                        ) : null}
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        {ACTIONS.map((action) => (
                          <button
                            key={action.key}
                            type="button"
                            disabled={!battle || Boolean(battle.winner)}
                            onClick={() => performAction(action.key)}
                            className={clsx(
                              "rounded-[22px] border px-4 py-4 text-left transition",
                              battle && !battle.winner
                                ? "border-[rgba(212,177,106,0.2)] bg-white/[0.03] hover:border-[rgba(212,177,106,0.36)] hover:bg-[rgba(212,177,106,0.08)]"
                                : "border-white/8 bg-white/[0.02] text-[#7e7767]"
                            )}
                          >
                            <div className="font-medium text-white">{action.title}</div>
                            <div className="mt-1 text-sm text-[#bba883]">{action.copy}</div>
                          </button>
                        ))}
                      </div>

                      <div className="mt-5 grid gap-3 md:grid-cols-2">
                        <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                          <p className="text-xs uppercase tracking-[0.22em] text-[#af9a69]">战术提示</p>
                          <p className="mt-3 text-sm leading-7 text-[#d6c7a2]">
                            绝技适合在你拥有兵种优势时打出；结阵则适合在残血时稳住战线，拖到下一次冲阵或绝技。
                          </p>
                        </div>
                        <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                          <p className="text-xs uppercase tracking-[0.22em] text-[#af9a69]">阵容轮替</p>
                          <p className="mt-3 text-sm leading-7 text-[#d6c7a2]">
                            当前版本会在一位头领退阵后自动换上下一位成员，直到某一方 3 将全部失去战力。
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[28px] border border-[rgba(212,177,106,0.1)] bg-[rgba(15,10,12,0.36)] p-5">
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.26em] text-[#d8c284]">Combat log</p>
                          <h3 className="mt-2 text-2xl font-semibold text-white">战局簿</h3>
                        </div>
                        <span className="rounded-full bg-white/[0.03] px-3 py-1 text-xs text-[#d6c7a2]">
                          {battle?.logs.length ?? 0} 条
                        </span>
                      </div>
                      <div className="grid gap-3">
                        {(battle?.logs ?? ["等待开战：先完成点将配置，然后点击“开始对战”。"]).map((log, index) => (
                          <div
                            key={`${index}-${log}`}
                            className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-[#d6c7a2]"
                          >
                            {log}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </main>
  );
}
