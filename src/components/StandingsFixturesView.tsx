import React, { useMemo, useState } from 'react';
import { ModalPortal } from './ModalPortal';
import {
  COUNTRY_BY_ID,
  COUNTRY_CATALOG,
  getCountryForLeague,
  isDomesticLeagueId,
  isUefaCompId,
  LEAGUE_CATALOG,
} from '../data/competitions';
import { COMPETITION_THEMES } from '../data/premierLeague2627';
import { getLeagueTeamsFromState, resolveClubForMatch } from '../engine/gameLogic';
import { CareerState, Club, CompetitionId, CountryId, Fixture, Language, Player } from '../types/game';
import { t } from '../utils/i18n';
import { useIsMobileLandscape } from '../utils/useMobileLandscape';
import { ClubBadge } from './ClubBadge';
import { MatchReportPanel } from './MatchReportPanel';
import { X } from 'lucide-react';

type StandingZone =
  | 'CHAMPIONS'
  | 'UCL'
  | 'UEL'
  | 'UECL'
  | 'UEFA_KO_PO'
  | 'ELIMINATED'
  | 'AUTO_PROMO'
  | 'PLAYOFF'
  | 'RELEGATION'
  | null;

function getZoneForRank(
  compId: CompetitionId,
  rank: number,
  totalTeams: number
): StandingZone {
  if (isUefaCompId(compId)) {
    if (rank <= 8) return 'UCL'; // Direct to Round of 16
    if (rank <= 24) return 'UEFA_KO_PO'; // 9th-24th Knockout Play-off
    return 'ELIMINATED'; // 25th-36th eliminated
  }
  if (compId === 'USA1') {
    if (rank <= 8) return 'PLAYOFF';
    return null;
  }
  if (!isDomesticLeagueId(compId)) return null;

  const meta = LEAGUE_CATALOG[compId];
  const country = COUNTRY_BY_ID[meta.countryId];
  if (meta.tier === 1) {
    if (rank === 1) return 'CHAMPIONS';
    if (country.isEuropeanUefaEligible && country.uefaSlots) {
      if (rank <= country.uefaSlots.ucl) return 'UCL';
      if (rank <= country.uefaSlots.uel) return 'UEL';
      if (rank <= country.uefaSlots.uecl) return 'UECL';
    }
    const relSpots = meta.autoRelegate + meta.playoffRelegate;
    if (relSpots > 0 && rank > totalTeams - relSpots) return 'RELEGATION';
    return null;
  }

  // Lower divisions
  if (rank <= meta.autoPromote) return 'AUTO_PROMO';
  if (meta.playoffRange && rank >= meta.playoffRange[0] && rank <= meta.playoffRange[1]) {
    return 'PLAYOFF';
  }
  const relSpots = meta.autoRelegate + meta.playoffRelegate;
  if (relSpots > 0 && rank > totalTeams - relSpots) return 'RELEGATION';
  return null;
}

function getZoneMeta(zone: StandingZone, lang: Language, isUefaComp = false): {
  code: string;
  label: string;
  badgeCls: string;
  rowCls: string;
} | null {
  switch (zone) {
    case 'CHAMPIONS':
      return {
        code: 'C',
        label: t(lang, 'zoneChampions'),
        badgeCls: 'bg-amber-400/20 text-amber-300 border-amber-400/40',
        rowCls: 'bg-amber-400/[0.04]',
      };
    case 'UCL':
      return {
        code: isUefaComp ? 'R16' : 'UCL',
        label: isUefaComp ? (lang === 'vi' ? 'Vào thẳng 1/8' : 'Direct R16') : t(lang, 'zoneChampionsLeague'),
        badgeCls: 'bg-sky-400/20 text-sky-300 border-sky-400/40',
        rowCls: 'bg-sky-400/[0.04]',
      };
    case 'UEL':
      return {
        code: 'UEL',
        label: t(lang, 'zoneEuropaLeague'),
        badgeCls: 'bg-teal-400/20 text-teal-300 border-teal-400/40',
        rowCls: 'bg-teal-400/[0.03]',
      };
    case 'UECL':
      return {
        code: 'UECL',
        label: t(lang, 'zoneConferenceLeague'),
        badgeCls: 'bg-emerald-400/20 text-emerald-300 border-emerald-400/40',
        rowCls: 'bg-emerald-400/[0.03]',
      };
    case 'UEFA_KO_PO':
      return {
        code: 'PO',
        label: t(lang, 'zoneUefaPlayoff'),
        badgeCls: 'bg-amber-400/20 text-amber-300 border-amber-400/40',
        rowCls: 'bg-amber-400/[0.04]',
      };
    case 'ELIMINATED':
      return {
        code: 'OUT',
        label: t(lang, 'zoneEliminated'),
        badgeCls: 'bg-rose-500/20 text-rose-300 border-rose-400/40',
        rowCls: 'bg-rose-500/[0.05]',
      };
    case 'AUTO_PROMO':
      return {
        code: 'UP',
        label: t(lang, 'zoneAutoPromotion'),
        badgeCls: 'bg-emerald-400/20 text-[#00FF85] border-emerald-400/40',
        rowCls: 'bg-emerald-500/[0.05]',
      };
    case 'PLAYOFF':
      return {
        code: 'PO',
        label: t(lang, 'zonePlayoffs'),
        badgeCls: 'bg-amber-400/20 text-amber-300 border-amber-400/40',
        rowCls: 'bg-amber-400/[0.04]',
      };
    case 'RELEGATION':
      return {
        code: 'REL',
        label: t(lang, 'zoneRelegation'),
        badgeCls: 'bg-rose-500/20 text-rose-300 border-rose-400/40',
        rowCls: 'bg-rose-500/[0.06]',
      };
    default:
      return null;
  }
}

interface CompetitionSelectorProps {
  selected: CompetitionId;
  userLeagueId?: CompetitionId;
  seasonLabel?: string;
  compact?: boolean;
  onChange: (c: CompetitionId) => void;
}

const CompetitionSelector: React.FC<CompetitionSelectorProps> = ({
  selected,
  seasonLabel = '2026/27',
  compact = false,
  onChange,
}) => {
  const theme = COMPETITION_THEMES[selected];
  const selectedCountry: CountryId | 'UEFA' =
    isUefaCompId(selected) || selected === 'UEFASUPERCUP'
      ? 'UEFA'
      : getCountryForLeague(selected).id;

  const countryComps: CompetitionId[] = useMemo(() => {
    if (selectedCountry === 'UEFA') return ['UCL', 'UEL', 'UECL', 'UEFASUPERCUP'];
    const c = COUNTRY_BY_ID[selectedCountry];
    const list: CompetitionId[] = [...c.leagues, c.primaryCupId];
    if (c.secondaryCupId) list.push(c.secondaryCupId);
    if (c.superCupId) list.push(c.superCupId);
    return list;
  }, [selectedCountry]);

  return (
    <div
      className={`rounded-xl border border-white/12 flex flex-wrap items-center justify-between ${
        compact ? 'px-3 py-2 gap-2' : 'p-4 gap-3'
      }`}
      style={{ backgroundColor: theme.headerBg }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <div className="text-xs font-mono text-white/75 uppercase tracking-wider">
            {selectedCountry === 'UEFA'
              ? `UEFA Club Competitions · ${seasonLabel}`
              : `${COUNTRY_BY_ID[selectedCountry].flag} ${COUNTRY_BY_ID[selectedCountry].nameEn} · ${seasonLabel}`}
          </div>
          <div className={`font-display font-bold text-white ${compact ? 'text-lg leading-tight' : 'text-2xl'}`}>
            {theme.name}
          </div>
        </div>
        <select
          aria-label="Select Nation or UEFA"
          value={selectedCountry}
          onChange={(e) => {
            const val = e.target.value as CountryId | 'UEFA';
            if (val === 'UEFA') onChange('UCL');
            else onChange(COUNTRY_BY_ID[val].leagues[0]);
          }}
          className="rounded-lg border border-white/25 bg-black/45 px-2.5 py-1.5 text-xs font-semibold text-white cursor-pointer"
        >
          <option value="UEFA">🇪🇺 UEFA (C1 · C2 · C3)</option>
          {COUNTRY_CATALOG.map((c) => (
            <option key={c.id} value={c.id}>
              {c.flag} {c.nameEn}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-1.5 items-center">
        {selectedCountry !== 'UEFA' && (
          <button
            type="button"
            onClick={() => onChange('UCL')}
            className={`rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap bg-blue-950/65 text-blue-200 border border-blue-400/35 hover:bg-blue-900/80 ${
              compact ? 'px-2.5 py-1' : 'px-3 py-1.5'
            }`}
          >
            UEFA C1/C2/C3
          </button>
        )}
        {countryComps.map((compId) => {
          const ct = COMPETITION_THEMES[compId];
          const active = compId === selected;
          return (
            <button
              key={compId}
              type="button"
              onClick={() => onChange(compId)}
              className={`rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                compact ? 'px-2.5 py-1' : 'px-3 py-1.5'
              } ${
                active
                  ? 'bg-white text-slate-950'
                  : 'bg-black/30 text-white/85 hover:bg-black/50'
              }`}
            >
              {ct.name}
            </button>
          );
        })}
      </div>
    </div>
  );
};

interface StandingsViewProps {
  state: CareerState;
  selectedCompetition: CompetitionId;
  onSelectCompetition: (c: CompetitionId) => void;
}

interface PlayerBoardEntry {
  player: Player;
  clubName: string;
  shortName: string;
}

function buildCupPlayerLeaderboard(
  clubs: Club[],
  fixtures: Fixture[]
): PlayerBoardEntry[] {
  const clubCache = new Map<string, Club>();
  const getClub = (clubId: string) => {
    let c = clubCache.get(clubId);
    if (!c) {
      c = resolveClubForMatch(clubs, clubId);
      clubCache.set(clubId, c);
    }
    return c;
  };

  const entryMap = new Map<string, PlayerBoardEntry>();
  const ensureEntry = (
    club: Club,
    playerId: string,
    fallbackName: string,
    fallbackPos: Player['position'],
    fallbackDetailedPos?: Player['detailedPosition']
  ): PlayerBoardEntry => {
    const existing = entryMap.get(playerId);
    if (existing) return existing;
    const base = club.players.find((p) => p.id === playerId) ??
      clubs.flatMap((c) => c.players).find((p) => p.id === playerId);
    const created: PlayerBoardEntry = {
      player: base
        ? {
            ...base,
            goals: 0,
            assists: 0,
            cleanSheets: 0,
            appearances: 0,
            yellowCards: 0,
            redCards: 0,
          }
        : {
            id: playerId,
            name: fallbackName,
            nationality: 'England',
            age: 24,
            heightCm: 180,
            preferredFoot: 'Right',
            skillMoves: 3,
            shirtNumber: 1,
            position: fallbackPos,
            detailedPosition: fallbackDetailedPos,
            ovr: 72,
            potential: 75,
            fitness: 100,
            suspendedMatches: 0,
            yellowCards: 0,
            redCards: 0,
            goals: 0,
            assists: 0,
            cleanSheets: 0,
            appearances: 0,
            marketValue: 1_000_000,
            weeklyWage: 10_000,
            contractExpiry: 2028,
            squadStatus: 'Rotation',
            releaseClause: 2_000_000,
            goalBonus: 1_000,
            forSale: false,
            role: 'Box-to-Box',
            attributes: {
              pace: 70,
              finishing: 65,
              passing: 70,
              dribbling: 70,
              defending: 60,
              physical: 70,
              goalkeeper: 20,
            },
          },
      clubName: club.name,
      shortName: club.shortName,
    };
    entryMap.set(playerId, created);
    return created;
  };

  for (const f of fixtures) {
    if (!f.played || !f.report) continue;
    const home = getClub(f.homeClubId);
    const away = getClub(f.awayClubId);

    for (const r of f.report.ratings) {
      if (r.didNotPlay || r.minutesPlayed <= 0) continue;
      const club = r.teamSide === 'HOME' ? home : away;
      const conceded = r.teamSide === 'HOME' ? f.report.awayGoals : f.report.homeGoals;
      const entry = ensureEntry(club, r.playerId, r.playerName, r.position, r.detailedPosition);
      entry.player.appearances += 1;
      entry.player.goals += r.goals;
      entry.player.assists += r.assists;
      if ((r.position === 'GK' || r.position === 'DEF') && conceded === 0 && r.minutesPlayed >= 45) {
        entry.player.cleanSheets += 1;
      }
    }

    for (const ev of f.report.events) {
      if (ev.type !== 'YELLOW' && ev.type !== 'RED') continue;
      const club = ev.teamSide === 'HOME' ? home : away;
      const entry = ensureEntry(club, ev.playerId, ev.playerName, 'MID');
      if (ev.type === 'YELLOW') entry.player.yellowCards += 1;
      else entry.player.redCards += 1;
    }
  }

  return Array.from(entryMap.values());
}

function buildParallelLeaguePlayerLeaderboard(
  clubs: Club[],
  fixtures: Fixture[]
): PlayerBoardEntry[] {
  const clubById = new Map<string, Club>();
  const playerMap = new Map<string, PlayerBoardEntry>();

  for (const c of clubs) {
    clubById.set(c.id, c);
    for (const p of c.players) {
      if (p.loanInfo?.direction === 'OUT') continue;
      playerMap.set(p.id, {
        player: {
          ...p,
          goals: 0,
          assists: 0,
          cleanSheets: 0,
          appearances: 0,
          yellowCards: 0,
          redCards: 0,
        },
        clubName: c.name,
        shortName: c.shortName,
      });
    }
  }

  for (const f of fixtures) {
    if (!f.played || f.homeGoals === undefined || f.awayGoals === undefined) continue;
    let seed = f.round * 97;
    for (let i = 0; i < f.id.length; i++) seed = (seed * 31 + f.id.charCodeAt(i)) % 2147483647;
    if (seed <= 0) seed += 2147483646;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const pickWeighted = (list: PlayerBoardEntry[], weightFn: (p: Player) => number) => {
      const total = list.reduce((acc, item) => acc + Math.max(0.2, weightFn(item.player)), 0);
      let r = rand() * total;
      for (const item of list) {
        r -= Math.max(0.2, weightFn(item.player));
        if (r <= 0) return item;
      }
      return list[0];
    };

    const applySide = (clubId: string, goalsFor: number, goalsAgainst: number) => {
      const club = clubById.get(clubId);
      if (!club) return;
      const starters = club.startingIds
        .slice(0, 11)
        .map((id) => playerMap.get(id))
        .filter((e): e is PlayerBoardEntry => Boolean(e));
      const benchPool = club.benchIds
        .map((id) => playerMap.get(id))
        .filter((e): e is PlayerBoardEntry => Boolean(e))
        .filter((e) => e.player.position !== 'GK');
      const usedSubs = benchPool.slice(0, Math.min(3, benchPool.length));
      const activePool = [...starters, ...usedSubs];
      if (activePool.length === 0) return;

      for (const entry of activePool) {
        entry.player.appearances += 1;
      }

      if (goalsAgainst === 0) {
        for (const s of starters) {
          if (s.player.position === 'GK' || s.player.position === 'DEF') {
            s.player.cleanSheets += 1;
          }
        }
      }

      for (let g = 0; g < goalsFor; g++) {
        const scorer = pickWeighted(activePool, (p) => {
          const posW = p.position === 'FWD' ? 14 : p.position === 'MID' ? 6 : p.position === 'DEF' ? 1.5 : 0.05;
          return posW * Math.max(0.6, 1 + (p.ovr - 72) * 0.04);
        });
        scorer.player.goals += 1;
        if (rand() < 0.85 && activePool.length > 1) {
          const assistPool = activePool.filter((e) => e.player.id !== scorer.player.id);
          const assister = pickWeighted(assistPool, (p) => {
            const posW = p.position === 'MID' ? 10 : p.position === 'FWD' ? 7 : p.position === 'DEF' ? 3 : 0.1;
            return posW * Math.max(0.6, 1 + (p.ovr - 72) * 0.03);
          });
          assister.player.assists += 1;
        }
      }

      const ycCount = Math.floor(rand() * 3);
      for (let y = 0; y < ycCount; y++) {
        const offender = pickWeighted(activePool, (p) =>
          p.position === 'DEF' ? 7 : p.position === 'MID' ? 5 : 2
        );
        offender.player.yellowCards += 1;
      }
      if (rand() < 0.04) {
        const redOffender = pickWeighted(activePool, (p) =>
          p.position === 'DEF' ? 7 : p.position === 'MID' ? 5 : 2
        );
        redOffender.player.redCards += 1;
      }
    };

    applySide(f.homeClubId, f.homeGoals, f.awayGoals);
    applySide(f.awayClubId, f.awayGoals, f.homeGoals);
  }

  return Array.from(playerMap.values());
}

export const StandingsView: React.FC<StandingsViewProps> = ({
  state,
  selectedCompetition,
  onSelectCompetition,
}) => {
  const lang = state.settings.language;
  const isMobileLandscape = useIsMobileLandscape();
  const [boardTab, setBoardTab] = useState<'table' | 'scorers' | 'assists' | 'clean' | 'discipline'>('table');
  const [mlsConfFilter, setMlsConfFilter] = useState<'EAST' | 'WEST' | 'ALL'>('EAST');
  const userLeagueId = state.userLeagueId ?? 'PL';
  const rawRows = state.contextStandings[selectedCompetition] ?? [];
  const usaTeams = useMemo(
    () => (selectedCompetition === 'USA1' ? getLeagueTeamsFromState(state).USA1 ?? [] : []),
    [selectedCompetition, state]
  );
  const rows = useMemo(() => {
    if (selectedCompetition !== 'USA1' || mlsConfFilter === 'ALL') return rawRows;
    const confSet = new Set(usaTeams.filter((tm) => tm.conf === mlsConfFilter).map((tm) => tm.id));
    return rawRows.filter((r) => confSet.has(r.clubId));
  }, [selectedCompetition, mlsConfFilter, rawRows, usaTeams]);

  const competitionPlayers = useMemo(() => {
    if (boardTab === 'table') return [] as PlayerBoardEntry[];

    if (selectedCompetition === userLeagueId) {
      const userLeagueClubs = state.clubs.filter((c) => (c.leagueId ?? 'PL') === userLeagueId);
      const list: PlayerBoardEntry[] = [];
      for (const c of userLeagueClubs) {
        for (const p of c.players) {
          if (p.loanInfo?.direction === 'OUT') continue;
          list.push({ player: p, clubName: c.name, shortName: c.shortName });
        }
      }
      return list;
    }

    if (!isDomesticLeagueId(selectedCompetition)) {
      const cupFixtures = state.contextFixtures[selectedCompetition] ?? [];
      return buildCupPlayerLeaderboard(state.clubs, cupFixtures);
    }

    const leagueTeams = getLeagueTeamsFromState(state)[selectedCompetition] ?? [];
    const tierClubs = leagueTeams.map((tm) => resolveClubForMatch(state.clubs, tm.id));
    const tierFixtures = state.contextFixtures[selectedCompetition] ?? [];
    return buildParallelLeaguePlayerLeaderboard(tierClubs, tierFixtures);
  }, [boardTab, selectedCompetition, userLeagueId, state]);

  const topScorers = useMemo(
    () =>
      [...competitionPlayers]
        .sort((a, b) => b.player.goals - a.player.goals || b.player.assists - a.player.assists || b.player.ovr - a.player.ovr)
        .slice(0, 15),
    [competitionPlayers]
  );
  const topAssists = useMemo(
    () =>
      [...competitionPlayers]
        .sort((a, b) => b.player.assists - a.player.assists || b.player.goals - a.player.goals || b.player.ovr - a.player.ovr)
        .slice(0, 15),
    [competitionPlayers]
  );
  const topClean = useMemo(
    () =>
      [...competitionPlayers]
        .filter((x) => x.player.position === 'GK' || x.player.position === 'DEF')
        .sort((a, b) => b.player.cleanSheets - a.player.cleanSheets || b.player.ovr - a.player.ovr)
        .slice(0, 15),
    [competitionPlayers]
  );
  const topDiscipline = useMemo(
    () =>
      [...competitionPlayers]
        .sort(
          (a, b) =>
            b.player.redCards * 3 +
            b.player.yellowCards -
            (a.player.redCards * 3 + a.player.yellowCards) ||
            b.player.appearances - a.player.appearances
        )
        .slice(0, 15),
    [competitionPlayers]
  );

  const isUefaSelected = isUefaCompId(selectedCompetition);
  const legendZones: StandingZone[] = isUefaSelected
    ? ['UCL', 'UEFA_KO_PO', 'ELIMINATED']
    : selectedCompetition === 'USA1'
    ? ['PLAYOFF']
    : isDomesticLeagueId(selectedCompetition)
    ? LEAGUE_CATALOG[selectedCompetition].tier === 1
      ? getCountryForLeague(selectedCompetition).isEuropeanUefaEligible
        ? ['CHAMPIONS', 'UCL', 'UEL', 'UECL', 'RELEGATION']
        : ['CHAMPIONS', 'RELEGATION']
      : ['AUTO_PROMO', 'PLAYOFF', 'RELEGATION']
    : [];

  return (
    <div
      className={
        isMobileLandscape
          ? 'h-full min-h-0 flex flex-col gap-2 overflow-hidden'
          : 'space-y-4 lg:h-[calc(100vh-8.5rem)] lg:flex lg:flex-col lg:overflow-hidden'
      }
    >
      <div className="shrink-0">
        <CompetitionSelector
          selected={selectedCompetition}
          seasonLabel={state.seasonLabel ?? '2026/27'}
          compact={isMobileLandscape}
          onChange={onSelectCompetition}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
      <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-black/40 border border-white/10 w-fit">
        {(
          [
            ['table', t(lang, 'leagueTable')],
            ['scorers', t(lang, 'topScorers')],
            ['assists', t(lang, 'topAssists')],
            ['clean', t(lang, 'cleanSheets')],
            ['discipline', t(lang, 'discipline')],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setBoardTab(id)}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap ${
              boardTab === id ? 'bg-white text-slate-950' : 'text-slate-300 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {selectedCompetition === 'USA1' && boardTab === 'table' && (
        <div className="flex items-center gap-1 p-1 rounded-lg bg-black/40 border border-white/10 w-fit">
          {(
            [
              ['EAST', 'Eastern (15)'],
              ['WEST', 'Western (15)'],
              ['ALL', "Supporters' Shield (30)"],
            ] as const
          ).map(([cid, label]) => (
            <button
              key={cid}
              type="button"
              onClick={() => setMlsConfFilter(cid)}
              className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap ${
                mlsConfFilter === cid ? 'bg-sky-400 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      </div>

      {boardTab === 'table' && (
        <div
          className={
            isMobileLandscape
              ? 'space-y-2 flex-1 min-h-0 flex flex-col overflow-hidden'
              : 'space-y-3 lg:flex-1 lg:min-h-0 lg:flex lg:flex-col'
          }
        >
          <div
            className={`pitch-panel rounded-2xl overflow-auto ${
              isMobileLandscape ? 'flex-1 min-h-0' : 'lg:flex-1 lg:min-h-0'
            }`}
          >
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 bg-[#0B0F18]/95 backdrop-blur-md border-b border-white/10 text-slate-400 font-mono uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Club</th>
                  <th className="px-3 py-3 text-right">MP</th>
                  <th className="px-3 py-3 text-right">W</th>
                  <th className="px-3 py-3 text-right">D</th>
                  <th className="px-3 py-3 text-right">L</th>
                  <th className="px-3 py-3 text-right">GF</th>
                  <th className="px-3 py-3 text-right">GA</th>
                  <th className="px-3 py-3 text-right">GD</th>
                  <th className="px-4 py-3 text-right">Pts</th>
                  <th className="px-4 py-3">Form</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {rows.map((r, idx) => {
                  const isUser = r.clubId === state.clubId;
                  const zone = getZoneForRank(selectedCompetition, idx + 1, rows.length);
                  const zoneMeta = getZoneMeta(zone, lang, isUefaSelected);
                  return (
                    <tr
                      key={r.clubId}
                      className={
                        isUser
                          ? 'bg-[#00FF85]/14 font-semibold'
                          : zoneMeta?.rowCls ?? 'hover:bg-white/5'
                      }
                    >
                      <td className="px-4 py-2.5 font-mono tabular-nums text-slate-300">
                        <div className="flex items-center gap-2">
                          <span className="w-5 text-right">{idx + 1}</span>
                          {zoneMeta && (
                            <span
                              title={zoneMeta.label}
                              className={`px-1.5 py-0.5 rounded border text-[9px] font-mono font-bold leading-none ${zoneMeta.badgeCls}`}
                            >
                              {zoneMeta.code}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <ClubBadge
                            clubId={r.clubId}
                            name={r.clubName}
                            shortName={r.shortName}
                            primaryColor={r.primaryColor}
                            secondaryColor={r.secondaryColor}
                            size={24}
                          />
                          <span className="text-white whitespace-nowrap">{r.clubName}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">{r.played}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">{r.won}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">{r.drawn}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">{r.lost}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">{r.goalsFor}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">{r.goalsAgainst}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                        {r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-white tabular-nums">
                        {r.points}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          {r.form.map((f, i) => (
                            <span
                              key={i}
                              className={`w-4 h-4 rounded text-[10px] font-mono font-bold flex items-center justify-center ${
                                f === 'W'
                                  ? 'bg-emerald-500/25 text-emerald-300'
                                  : f === 'D'
                                  ? 'bg-slate-500/30 text-slate-200'
                                  : 'bg-rose-500/25 text-rose-300'
                              }`}
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {legendZones.length > 0 && (
            <div className="shrink-0 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-xs text-slate-300">
              {legendZones.map((z) => {
                const zm = getZoneMeta(z, lang, isUefaSelected);
                if (!zm) return null;
                return (
                  <div key={z} className="flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded border text-[10px] font-mono font-bold leading-none ${zm.badgeCls}`}
                    >
                      {zm.code}
                    </span>
                    <span>{zm.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {boardTab !== 'table' && (
        <div
          className={`rounded-xl border border-white/12 bg-black/35 overflow-auto ${
            isMobileLandscape ? 'flex-1 min-h-0' : 'lg:flex-1 lg:min-h-0'
          }`}
        >
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-10 bg-[#1B0721] border-b border-white/10 text-slate-400">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3">Club</th>
                <th className="px-4 py-3">Pos</th>
                <th className="px-4 py-3 text-right">Apps</th>
                <th className="px-4 py-3 text-right">
                  {boardTab === 'scorers'
                    ? 'Goals'
                    : boardTab === 'assists'
                    ? 'Assists'
                    : boardTab === 'clean'
                    ? 'Clean Sheets'
                    : 'YC / RC'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8">
              {(boardTab === 'scorers'
                ? topScorers
                : boardTab === 'assists'
                ? topAssists
                : boardTab === 'clean'
                ? topClean
                : topDiscipline
              ).map(({ player, clubName }, idx) => (
                <tr key={player.id} className="hover:bg-white/5">
                  <td className="px-4 py-2.5 font-mono tabular-nums text-slate-400">{idx + 1}</td>
                  <td className="px-4 py-2.5 font-semibold text-white">{player.name}</td>
                  <td className="px-4 py-2.5 text-slate-300">{clubName}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-400">
                    {player.detailedPosition ?? player.position}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">{player.appearances}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-300 tabular-nums">
                    {boardTab === 'scorers'
                      ? player.goals
                      : boardTab === 'assists'
                      ? player.assists
                      : boardTab === 'clean'
                      ? player.cleanSheets
                      : `${player.yellowCards} / ${player.redCards}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

interface FixturesViewProps {
  state: CareerState;
  selectedCompetition: CompetitionId;
  onSelectCompetition: (c: CompetitionId) => void;
}

export const FixturesView: React.FC<FixturesViewProps> = ({
  state,
  selectedCompetition,
  onSelectCompetition,
}) => {
  const isMobileLandscape = useIsMobileLandscape();
  const [selectedRound, setSelectedRound] = useState<number>(state.currentRound);
  const [activeFixture, setActiveFixture] = useState<Fixture | null>(null);

  const userLeagueId = state.userLeagueId ?? 'PL';
  const allFixtures =
    selectedCompetition === userLeagueId
      ? state.fixtures
      : state.contextFixtures[selectedCompetition] ?? [];

  const rounds = useMemo(
    () => Array.from(new Set(allFixtures.map((f) => f.round))).sort((a, b) => a - b),
    [allFixtures]
  );

  const roundLabels = useMemo(() => {
    const map = new Map<number, string>();
    for (const f of allFixtures) {
      if (!map.has(f.round)) {
        map.set(f.round, f.stageLabel ?? `Round ${f.round}`);
      }
    }
    return map;
  }, [allFixtures]);

  const effectiveRound = rounds.includes(selectedRound) ? selectedRound : rounds[0] ?? 1;
  const roundFixtures = allFixtures.filter((f) => f.round === effectiveRound);

  return (
    <div
      className={
        isMobileLandscape
          ? 'h-full min-h-0 flex flex-col gap-2 overflow-hidden'
          : 'space-y-5'
      }
    >
      <div className="shrink-0">
        <CompetitionSelector
          selected={selectedCompetition}
          seasonLabel={state.seasonLabel ?? '2026/27'}
          compact={isMobileLandscape}
          onChange={onSelectCompetition}
        />
      </div>

      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="round-select" className="text-xs text-slate-300">
            {!isDomesticLeagueId(selectedCompetition) ? 'Stage:' : 'Round:'}
          </label>
          <select
            id="round-select"
            value={effectiveRound}
            onChange={(e) => setSelectedRound(Number(e.target.value))}
            className="rounded-lg border border-white/15 bg-black/45 px-3 py-1.5 text-xs font-mono text-white"
          >
            {rounds.map((r) => (
              <option key={r} value={r}>
                {roundLabels.get(r) ?? `Round ${r}`}
              </option>
            ))}
          </select>
        </div>
        <span className="text-xs text-slate-400">
          {state.settings.language === 'vi'
            ? 'Nhấn vào trận đã đấu để xem Diễn biến, Thống kê & Chấm điểm'
            : 'Click any completed match to view Timeline, Stats & Ratings'}
        </span>
      </div>

      <div
        className={
          isMobileLandscape
            ? 'flex-1 min-h-0 overflow-y-auto pr-1 grid grid-cols-2 lg:grid-cols-3 gap-2 content-start'
            : 'grid grid-cols-1 md:grid-cols-2 gap-3'
        }
      >
        {roundFixtures.map((f) => {
          const involvesUser = f.homeClubId === state.clubId || f.awayClubId === state.clubId;
          const homeClub = resolveClubForMatch(state.clubs, f.homeClubId);
          const awayClub = resolveClubForMatch(state.clubs, f.awayClubId);
          const penWinner =
            f.penaltiesWinnerId === f.homeClubId
              ? homeClub.shortName
              : f.penaltiesWinnerId === f.awayClubId
              ? awayClub.shortName
              : null;

          return (
            <button
              key={f.id}
              type="button"
              disabled={!f.played || !f.report}
              onClick={() => f.report && setActiveFixture(f)}
              className={`rounded-xl border p-4 flex items-center justify-between gap-3 text-left transition-colors ${
                f.played && f.report ? 'cursor-pointer hover:bg-white/8' : 'cursor-default'
              } ${
                involvesUser
                  ? 'border-[#00FF85]/45 bg-[#00FF85]/10'
                  : 'border-white/10 bg-black/35'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
                  <span>{f.dateIso}</span>
                  {f.stageLabel && <span>· {f.stageLabel}</span>}
                  {penWinner && <span className="text-amber-300">· Pens: {penWinner}</span>}
                </div>
                <div className="mt-1 flex items-center justify-between text-sm font-semibold text-white">
                  <div className="flex items-center gap-2 min-w-0">
                    <ClubBadge
                      clubId={f.homeClubId}
                      name={f.homeClubName}
                      shortName={homeClub.shortName}
                      primaryColor={homeClub.primaryColor}
                      secondaryColor={homeClub.secondaryColor}
                      pattern={homeClub.pattern}
                      size={18}
                    />
                    <span className="truncate">{f.homeClubName}</span>
                  </div>
                  <span className="font-mono tabular-nums ml-2">
                    {f.played ? f.homeGoals : '-'}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-sm font-semibold text-white">
                  <div className="flex items-center gap-2 min-w-0">
                    <ClubBadge
                      clubId={f.awayClubId}
                      name={f.awayClubName}
                      shortName={awayClub.shortName}
                      primaryColor={awayClub.primaryColor}
                      secondaryColor={awayClub.secondaryColor}
                      pattern={awayClub.pattern}
                      size={18}
                    />
                    <span className="truncate">{f.awayClubName}</span>
                  </div>
                  <span className="font-mono tabular-nums ml-2">
                    {f.played ? f.awayGoals : '-'}
                  </span>
                </div>
              </div>
              <div className="text-xs font-mono text-slate-400 shrink-0">
                {f.played ? 'FT' : 'SCH'}
              </div>
            </button>
          );
        })}
      </div>

      {activeFixture && activeFixture.report && (() => {
        const homeClubObj = resolveClubForMatch(state.clubs, activeFixture.homeClubId);
        const awayClubObj = resolveClubForMatch(state.clubs, activeFixture.awayClubId);
        const penWinnerName =
          activeFixture.penaltiesWinnerId === activeFixture.homeClubId
            ? homeClubObj.name
            : activeFixture.penaltiesWinnerId === activeFixture.awayClubId
            ? awayClubObj.name
            : null;

        return (
          <ModalPortal>
          <div
            className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Fixture Match Report"
          >
            <div className="w-full max-w-4xl rounded-xl border border-white/15 bg-[#1B0721] p-6 space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <ClubBadge
                    clubId={homeClubObj.id}
                    name={homeClubObj.name}
                    shortName={homeClubObj.shortName}
                    primaryColor={homeClubObj.primaryColor}
                    secondaryColor={homeClubObj.secondaryColor}
                    pattern={homeClubObj.pattern}
                    size={36}
                  />
                  <div className="min-w-0">
                    <div className="text-xs text-slate-400">
                      {activeFixture.stageLabel ?? `Round ${activeFixture.round}`} · {activeFixture.dateIso}
                      {penWinnerName ? ` · ${penWinnerName} win on penalties` : ''}
                    </div>
                    <h3 className="font-display text-2xl font-bold text-white truncate">
                      {activeFixture.homeClubName} {activeFixture.homeGoals} - {activeFixture.awayGoals}{' '}
                      {activeFixture.awayClubName}
                    </h3>
                  </div>
                  <ClubBadge
                    clubId={awayClubObj.id}
                    name={awayClubObj.name}
                    shortName={awayClubObj.shortName}
                    primaryColor={awayClubObj.primaryColor}
                    secondaryColor={awayClubObj.secondaryColor}
                    pattern={awayClubObj.pattern}
                    size={36}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setActiveFixture(null)}
                  aria-label="Close fixture report"
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <MatchReportPanel
                report={activeFixture.report}
                homeClub={homeClubObj}
                awayClub={awayClubObj}
                language={state.settings.language}
              />
            </div>
          </div>
          </ModalPortal>
        );
      })()}
    </div>
  );
};
