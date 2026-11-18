import { Club, CompetitionId, ContextTeam, DomesticLeagueId, UefaCompId } from '../../types/game';
import { buildClubFromSeed, WorldClubSeed } from '../playerBuilder';
import {
  buildCuratedEflClubById,
  buildCuratedEflClubFromTeam,
  buildPremierLeagueClubs,
  EFL_CHAMPIONSHIP_TEAMS,
  EFL_LEAGUE_ONE_TEAMS,
  EFL_LEAGUE_TWO_TEAMS,
} from '../premierLeague2627';
import { ALL_DOMESTIC_LEAGUE_IDS } from '../competitions';
import { CHAMP_WORLD_CLUBS, L1_WORLD_CLUBS, L2_WORLD_CLUBS, PL_WORLD_CLUBS } from './england2627';
import { ESP1_CLUBS, ESP2_CLUBS } from './spain2627';
import { GER1_CLUBS, GER2_CLUBS, GER3_CLUBS } from './germany2627';
import { FRA1_CLUBS, FRA2_CLUBS, ITA1_CLUBS, ITA2_CLUBS } from './italyFrance2627';
import { NED1_CLUBS, NED2_CLUBS, POR1_CLUBS, POR2_CLUBS, TUR1_CLUBS, TUR2_CLUBS } from './nedPorTur2627';
import { KSA1_CLUBS, KSA2_CLUBS, USA1_CLUBS } from './ksaUsa2627';
import {
  AUT1_CLUBS,
  BEL1_CLUBS,
  CRO1_CLUBS,
  CZE1_CLUBS,
  DEN1_CLUBS,
  EUR_UEFA_CLUBS,
  GRE1_CLUBS,
  NOR1_CLUBS,
  POL1_CLUBS,
  SCO1_CLUBS,
  SUI1_CLUBS,
  SWE1_CLUBS,
  UKR1_CLUBS,
} from './europeOther2627';
import { INITIAL_UEFA_PARTICIPANTS_2627 } from './uefaSeeds2627';

export const WORLD_SEEDS_BY_LEAGUE: Record<Exclude<DomesticLeagueId, 'PL' | 'CHAMP' | 'L1' | 'L2'>, WorldClubSeed[]> = {
  ESP1: ESP1_CLUBS,
  ESP2: ESP2_CLUBS,
  GER1: GER1_CLUBS,
  GER2: GER2_CLUBS,
  GER3: GER3_CLUBS,
  ITA1: ITA1_CLUBS,
  ITA2: ITA2_CLUBS,
  FRA1: FRA1_CLUBS,
  FRA2: FRA2_CLUBS,
  NED1: NED1_CLUBS,
  NED2: NED2_CLUBS,
  POR1: POR1_CLUBS,
  POR2: POR2_CLUBS,
  TUR1: TUR1_CLUBS,
  TUR2: TUR2_CLUBS,
  KSA1: KSA1_CLUBS,
  KSA2: KSA2_CLUBS,
  USA1: USA1_CLUBS,
  BEL1: BEL1_CLUBS,
  SCO1: SCO1_CLUBS,
  AUT1: AUT1_CLUBS,
  SUI1: SUI1_CLUBS,
  DEN1: DEN1_CLUBS,
  NOR1: NOR1_CLUBS,
  GRE1: GRE1_CLUBS,
  CZE1: CZE1_CLUBS,
  POL1: POL1_CLUBS,
  UKR1: UKR1_CLUBS,
  CRO1: CRO1_CLUBS,
  SWE1: SWE1_CLUBS,
};

export { EUR_UEFA_CLUBS, INITIAL_UEFA_PARTICIPANTS_2627 };

let cachedPlClubs: Club[] | null = null;
function getCachedPlClubs(): Club[] {
  if (!cachedPlClubs) {
    cachedPlClubs = buildPremierLeagueClubs();
  }
  return cachedPlClubs;
}

const ALL_WORLD_SEEDS_MAP: Map<string, WorldClubSeed> = (() => {
  const m = new Map<string, WorldClubSeed>();
  for (const s of [...PL_WORLD_CLUBS, ...CHAMP_WORLD_CLUBS, ...L1_WORLD_CLUBS, ...L2_WORLD_CLUBS]) {
    m.set(s.id, s);
  }
  for (const list of Object.values(WORLD_SEEDS_BY_LEAGUE)) {
    for (const s of list) m.set(s.id, s);
  }
  for (const s of EUR_UEFA_CLUBS) {
    m.set(s.id, s);
  }
  return m;
})();

export function getWorldSeedById(clubId: string): WorldClubSeed | undefined {
  return ALL_WORLD_SEEDS_MAP.get(clubId);
}

export function getAllRestOfEuropeContextTeams(): ContextTeam[] {
  return EUR_UEFA_CLUBS.map(worldSeedToContextTeam);
}

export function worldSeedToContextTeam(s: WorldClubSeed): ContextTeam {
  return {
    id: s.id,
    name: s.name,
    shortName: s.shortName,
    primaryColor: s.primaryColor,
    secondaryColor: s.secondaryColor,
    ovr: s.ovr,
    managerName: s.managerName,
    leagueId: s.leagueId === 'EUR_UEFA' ? 'UCL' : s.leagueId,
    conf: s.conf,
    isReserve: s.isReserve,
  };
}

export function getInitialContextTeamsForLeague(leagueId: DomesticLeagueId): ContextTeam[] {
  if (leagueId === 'PL') {
    return getCachedPlClubs().map((c) => {
      const top11 = c.players.slice(0, 11);
      const ovr = top11.length > 0 ? Math.round(top11.reduce((acc, p) => acc + p.ovr, 0) / top11.length) : 78;
      return {
        id: c.id,
        name: c.name,
        shortName: c.shortName,
        primaryColor: c.primaryColor,
        secondaryColor: c.secondaryColor,
        ovr,
        managerName: c.managerName,
        leagueId: 'PL',
      };
    });
  }
  if (leagueId === 'CHAMP') return EFL_CHAMPIONSHIP_TEAMS.map((t) => ({ ...t, leagueId: 'CHAMP' }));
  if (leagueId === 'L1') return EFL_LEAGUE_ONE_TEAMS.map((t) => ({ ...t, leagueId: 'L1' }));
  if (leagueId === 'L2') return EFL_LEAGUE_TWO_TEAMS.map((t) => ({ ...t, leagueId: 'L2' }));
  const list = WORLD_SEEDS_BY_LEAGUE[leagueId] ?? [];
  return list.map(worldSeedToContextTeam);
}

export function buildAllInitialLeagueTeams(): Record<DomesticLeagueId, ContextTeam[]> {
  const out = {} as Record<DomesticLeagueId, ContextTeam[]>;
  for (const id of ALL_DOMESTIC_LEAGUE_IDS) {
    out[id] = getInitialContextTeamsForLeague(id);
  }
  return out;
}

export function buildWorldClubById(clubId: string, leagueIdOverride?: CompetitionId): Club | undefined {
  const plMatch = getCachedPlClubs().find((c) => c.id === clubId);
  if (plMatch) {
    return {
      ...plMatch,
      leagueId: leagueIdOverride ?? plMatch.leagueId ?? 'PL',
      players: plMatch.players.map((p) => ({ ...p })),
      tactics: { ...plMatch.tactics },
      startingIds: [...plMatch.startingIds],
      benchIds: [...plMatch.benchIds],
    };
  }
  const worldSeed = ALL_WORLD_SEEDS_MAP.get(clubId);
  if (worldSeed) {
    const resolvedLeague: CompetitionId =
      leagueIdOverride ?? (worldSeed.leagueId === 'EUR_UEFA' ? 'UCL' : worldSeed.leagueId);
    return buildClubFromSeed(worldSeed, resolvedLeague);
  }
  const eflClub = buildCuratedEflClubById(clubId);
  if (eflClub) {
    if (leagueIdOverride) eflClub.leagueId = leagueIdOverride;
    return eflClub;
  }
  return undefined;
}

export function buildWorldClubsForLeague(
  leagueId: DomesticLeagueId,
  teamsOverride?: ContextTeam[]
): Club[] {
  if (teamsOverride && teamsOverride.length > 0) {
    return teamsOverride.map((tm) => {
      const built = buildWorldClubById(tm.id, leagueId);
      if (built) {
        return {
          ...built,
          leagueId,
          conf: tm.conf ?? built.conf,
          managerName: tm.managerName ?? built.managerName,
        };
      }
      return buildCuratedEflClubFromTeam(tm, leagueId);
    });
  }

  if (leagueId === 'PL') {
    return getCachedPlClubs().map((c) => ({
      ...c,
      leagueId: 'PL',
      players: c.players.map((p) => ({ ...p })),
      tactics: { ...c.tactics },
      startingIds: [...c.startingIds],
      benchIds: [...c.benchIds],
    }));
  }
  if (leagueId === 'CHAMP') {
    return EFL_CHAMPIONSHIP_TEAMS.map((t) => buildCuratedEflClubById(t.id) ?? buildCuratedEflClubFromTeam(t, 'CHAMP'));
  }
  if (leagueId === 'L1') {
    return EFL_LEAGUE_ONE_TEAMS.map((t) => buildCuratedEflClubById(t.id) ?? buildCuratedEflClubFromTeam(t, 'L1'));
  }
  if (leagueId === 'L2') {
    return EFL_LEAGUE_TWO_TEAMS.map((t) => buildCuratedEflClubById(t.id) ?? buildCuratedEflClubFromTeam(t, 'L2'));
  }
  return (WORLD_SEEDS_BY_LEAGUE[leagueId] ?? []).map((s) => buildClubFromSeed(s, leagueId));
}

export function findContextTeamGlobally(
  clubId: string,
  leagueTeams?: Partial<Record<DomesticLeagueId, ContextTeam[]>>
): ContextTeam | undefined {
  if (leagueTeams) {
    for (const lid of ALL_DOMESTIC_LEAGUE_IDS) {
      const found = leagueTeams[lid]?.find((t) => t.id === clubId);
      if (found) return found;
    }
  }
  const rest = EUR_UEFA_CLUBS.find((c) => c.id === clubId);
  if (rest) return worldSeedToContextTeam(rest);
  for (const lid of ALL_DOMESTIC_LEAGUE_IDS) {
    const found = getInitialContextTeamsForLeague(lid).find((t) => t.id === clubId);
    if (found) return found;
  }
  return undefined;
}

export function findDomesticLeagueForClubId(
  clubId: string,
  leagueTeams?: Partial<Record<DomesticLeagueId, ContextTeam[]>>
): DomesticLeagueId | undefined {
  if (leagueTeams) {
    for (const lid of ALL_DOMESTIC_LEAGUE_IDS) {
      if (leagueTeams[lid]?.some((t) => t.id === clubId)) return lid;
    }
  }
  const ws = ALL_WORLD_SEEDS_MAP.get(clubId);
  if (ws && ws.leagueId !== 'EUR_UEFA') return ws.leagueId as DomesticLeagueId;
  for (const lid of ['PL', 'CHAMP', 'L1', 'L2'] as DomesticLeagueId[]) {
    if (getInitialContextTeamsForLeague(lid).some((t) => t.id === clubId)) return lid;
  }
  return undefined;
}

export function getInitialUefaSeeds(): Record<UefaCompId, string[]> {
  return {
    UCL: [...INITIAL_UEFA_PARTICIPANTS_2627.UCL],
    UEL: [...INITIAL_UEFA_PARTICIPANTS_2627.UEL],
    UECL: [...INITIAL_UEFA_PARTICIPANTS_2627.UECL],
  };
}

const cachedClubsByLeague = new Map<DomesticLeagueId, Club[]>();
export function getCachedClubsByLeague(leagueId: DomesticLeagueId): Club[] {
  let cached = cachedClubsByLeague.get(leagueId);
  if (!cached) {
    cached = buildWorldClubsForLeague(leagueId);
    cachedClubsByLeague.set(leagueId, cached);
  }
  return cached;
}

let cachedAllWorldClubs: Club[] | null = null;
export function getCachedAllWorldClubs(): Club[] {
  if (!cachedAllWorldClubs) {
    const byId = new Map<string, Club>();
    for (const lid of ALL_DOMESTIC_LEAGUE_IDS) {
      for (const club of getCachedClubsByLeague(lid)) {
        if (!byId.has(club.id)) byId.set(club.id, club);
      }
    }
    for (const seed of EUR_UEFA_CLUBS) {
      if (!byId.has(seed.id)) {
        byId.set(seed.id, buildClubFromSeed(seed, 'UCL'));
      }
    }
    cachedAllWorldClubs = Array.from(byId.values());
  }
  return cachedAllWorldClubs;
}
