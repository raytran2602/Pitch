import { Club, CompetitionId, ContextTeam, FormationName } from '../types/game';
import { buildClubFromSeed, RawClubSeed, RosterSeed, WorldClubSeed } from './playerBuilder';
import { CHAMP_WORLD_CLUBS, L1_WORLD_CLUBS, L2_WORLD_CLUBS } from './world/england2627';

export interface CompactEflSeed {
  id: string;
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  pattern: Club['pattern'];
  managerName: string;
  stadium: string;
  ovr: number;
  budget: number;
  formation: FormationName;
  roster: RosterSeed[];
}

function toRawClubSeed(c: WorldClubSeed | CompactEflSeed): RawClubSeed {
  return {
    id: c.id,
    name: c.name,
    shortName: c.shortName,
    primaryColor: c.primaryColor,
    secondaryColor: c.secondaryColor,
    pattern: c.pattern,
    managerName: c.managerName,
    stadium: c.stadium,
    budget: c.budget,
    formation: c.formation,
    tactics:
      'tactics' in c
        ? c.tactics
        : {
            preset: 'Balanced',
            formation: c.formation,
            buildUpStyle: 'Balanced',
            defensiveApproach: 'Mid Block',
            playersInBox: 5,
            attackingWidth: 6,
            defensiveLine: 5,
          },
    roster: c.roster,
  };
}

export const EFL_CHAMPIONSHIP_SEEDS: CompactEflSeed[] = CHAMP_WORLD_CLUBS;
export const EFL_LEAGUE_ONE_SEEDS: CompactEflSeed[] = L1_WORLD_CLUBS;
export const EFL_LEAGUE_TWO_SEEDS: CompactEflSeed[] = L2_WORLD_CLUBS;

function seedToContextTeam(s: CompactEflSeed): ContextTeam {
  return {
    id: s.id,
    name: s.name,
    shortName: s.shortName,
    primaryColor: s.primaryColor,
    secondaryColor: s.secondaryColor,
    ovr: s.ovr,
    managerName: s.managerName,
  };
}

export const EFL_CHAMPIONSHIP_TEAMS: ContextTeam[] = EFL_CHAMPIONSHIP_SEEDS.map(seedToContextTeam);
export const EFL_LEAGUE_ONE_TEAMS: ContextTeam[] = EFL_LEAGUE_ONE_SEEDS.map(seedToContextTeam);
export const EFL_LEAGUE_TWO_TEAMS: ContextTeam[] = EFL_LEAGUE_TWO_SEEDS.map(seedToContextTeam);

const EFL_SEED_BY_ID = new Map<string, { seed: WorldClubSeed; leagueId: 'CHAMP' | 'L1' | 'L2' }>([
  ...CHAMP_WORLD_CLUBS.map((seed) => [seed.id, { seed, leagueId: 'CHAMP' as const }] as const),
  ...L1_WORLD_CLUBS.map((seed) => [seed.id, { seed, leagueId: 'L1' as const }] as const),
  ...L2_WORLD_CLUBS.map((seed) => [seed.id, { seed, leagueId: 'L2' as const }] as const),
]);

export function buildCuratedEflClubById(clubId: string, overrideLeagueId?: CompetitionId): Club | null {
  const found = EFL_SEED_BY_ID.get(clubId);
  if (!found) return null;
  return buildClubFromSeed(toRawClubSeed(found.seed), overrideLeagueId ?? found.leagueId);
}

export function buildCuratedEflClubFromTeam(
  team: ContextTeam,
  leagueId: CompetitionId = 'CHAMP'
): Club {
  const existing = buildCuratedEflClubById(team.id, leagueId);
  if (existing) return existing;
  const fallback = EFL_CHAMPIONSHIP_SEEDS[0];
  return buildClubFromSeed(
    {
      ...toRawClubSeed(fallback),
      id: team.id,
      name: team.name,
      shortName: team.shortName,
      primaryColor: team.primaryColor,
      secondaryColor: team.secondaryColor,
    },
    leagueId
  );
}

export function getCuratedEflClubsForLeague(leagueId: 'CHAMP' | 'L1' | 'L2'): Club[] {
  const list =
    leagueId === 'CHAMP'
      ? CHAMP_WORLD_CLUBS
      : leagueId === 'L1'
      ? L1_WORLD_CLUBS
      : L2_WORLD_CLUBS;
  return list.map((s) => buildClubFromSeed(s, leagueId));
}
