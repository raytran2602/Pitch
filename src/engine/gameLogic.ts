import {
  ALL_COMPETITION_IDS,
  ALL_DOMESTIC_LEAGUE_IDS,
  COMPETITION_THEMES,
  COUNTRY_BY_ID,
  COUNTRY_CATALOG,
  getCountryForLeague,
  getTotalRoundsForWorldLeague,
  isDomesticLeagueId,
  isUefaCompId,
  LEAGUE_CATALOG,
} from '../data/competitions';
import {
  buildAllInitialLeagueTeams,
  buildWorldClubById,
  buildWorldClubsForLeague,
  findContextTeamGlobally,
  findDomesticLeagueForClubId,
  getAllRestOfEuropeContextTeams,
  getInitialContextTeamsForLeague,
  getInitialUefaSeeds,
} from '../data/world/worldRegistry';
import {
  advanceUefaKnockoutIfReady,
  buildUefaLeaguePhaseFixtures,
  computeUefaPhaseStandings,
  drawWorldCupRoundFixtures,
  generateWorldLeagueFixtures,
  getCupParticipantsForCountry,
  getDomesticCupStartRound,
  getUefaChampion,
  getUefaLeaguePhaseRounds,
  getUefaStageLabel,
  getWorldClubOvrLookup,
  getWorldCupRoundDate,
  qualifyNextSeasonUefaTeams,
  resolveCountryPyramidMovements,
  resolveWorldClub,
} from './worldEngine';
import {
  AcademyPlayer,
  AiManagerStatus,
  CalendarDay,
  CareerState,
  CareerTrophy,
  Club,
  ClubManagerInfo,
  CoachProfile,
  CompetitionId,
  ContextTeam,
  ContractOffer,
  DetailedPosition,
  DomesticCupId,
  DomesticLeagueId,
  FinanceEntry,
  Fixture,
  IncomingTransferBid,
  ManagerContract,
  ManagerNotification,
  MatchdayLineupOverride,
  MatchEvent,
  MatchReport,
  MatchStats,
  ObjectivePriority,
  ObjectiveStatus,
  Player,
  PlayerMatchRating,
  PlayerRole,
  PlayoffTieResult,
  Position,
  SeasonEndSummary,
  SeasonObjective,
  StandingRow,
  TierMovement,
  TransferOffer,
  TransferTarget,
  UefaCompId,
} from '../types/game';
import {
  BENCH_SIZE,
  buildCuratedEflClubFromTeam,
  buildPremierLeagueClubs,
  deriveDefaultTeamRoles,
  EFL_CHAMPIONSHIP_TEAMS,
  EFL_LEAGUE_ONE_TEAMS,
  EFL_LEAGUE_TWO_TEAMS,
  FORMATION_SLOTS,
  getPlayableClubsForLeague,
} from '../data/premierLeague2627';
import {
  buildDetailedAttributes,
  deriveDefaultRoleMastery,
  deriveDefaultSecondaryPositions,
  derivePlayerMeta,
  getPlayerRoleMastery,
  getPlayerSlotEvaluation,
  isPlayerAvailableForMatchday,
} from '../utils/playerAttributes';
import {
  computeFoulOffenderWeight,
  computePlayerAssistWeight,
  computePlayerScoreWeight,
  computeTacticalMatchupShift,
  resolveShotAndGoalDuel,
} from './liveMatchEngine';
import { formatCurrency } from '../utils/i18n';

export function getTotalRoundsForLeague(leagueId: CompetitionId = 'PL'): number {
  return getTotalRoundsForWorldLeague(leagueId);
}

export const CAREER_STORAGE_KEY = 'premierLeague2627CoachV2';

function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function formatSeasonLabel(seasonIndex: number): string {
  const startYear = 2026 + seasonIndex;
  const endShort = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}/${endShort}`;
}

export function generateDoubleRoundRobinFixtures(
  clubs: Club[],
  compId: CompetitionId = 'PL',
  cycles = 1,
  seasonStartYear = 2026
): Fixture[] {
  if (compId !== 'PL' && isDomesticLeagueId(compId) && cycles === 1) {
    return generateWorldLeagueFixtures(
      clubs.map((c) => ({ id: c.id, name: c.name, shortName: c.shortName, conf: c.conf })),
      compId,
      seasonStartYear
    );
  }
  const n = clubs.length;
  const halfRounds = n - 1;
  const totalRounds = halfRounds * 2 * cycles;
  const ids = clubs.map((c) => c.id);
  const clubMap = new Map(clubs.map((c) => [c.id, c]));
  const fixtures: Fixture[] = [];

  const seasonStart =
    compId === 'PL'
      ? new Date(`${seasonStartYear}-08-15T15:00:00Z`)
      : new Date(`${seasonStartYear}-08-08T15:00:00Z`);
  const seasonDays = compId === 'PL' ? 281 : 273;
  const idPrefix = seasonStartYear === 2026 ? '' : `S${seasonStartYear}_`;

  let roundCounter = 1;
  for (let cycle = 0; cycle < cycles; cycle++) {
    const cycleFirstHalf: { roundOffset: number; homeId: string; awayId: string }[] = [];
    const m = n - 1;
    const half = n / 2;
    const pivot = ids[m];

    for (let r = 0; r < halfRounds; r++) {
      const p = (r * half) % m;
      const anchor = ids[p];
      if (r % 2 === 0) {
        cycleFirstHalf.push({ roundOffset: r + 1, homeId: anchor, awayId: pivot });
      } else {
        cycleFirstHalf.push({ roundOffset: r + 1, homeId: pivot, awayId: anchor });
      }
      for (let k = 1; k < half; k++) {
        const homeId = ids[(p + k) % m];
        const awayId = ids[(p - k + m) % m];
        cycleFirstHalf.push({ roundOffset: r + 1, homeId, awayId });
      }
    }

    for (let r = 1; r <= halfRounds; r++) {
      const round = roundCounter++;
      const dayOffset =
        compId === 'PL' && cycles === 1
          ? (round - 1) * 7
          : totalRounds > 1
          ? Math.round(((round - 1) * seasonDays) / (totalRounds - 1))
          : 0;
      const dateIso = new Date(seasonStart.getTime() + dayOffset * 86400_000).toISOString().slice(0, 10);

      for (const m of cycleFirstHalf.filter((x) => x.roundOffset === r)) {
        const home = clubMap.get(m.homeId)!;
        const away = clubMap.get(m.awayId)!;
        fixtures.push({
          id: `${idPrefix}${compId}_R${round}_${home.shortName}_${away.shortName}`,
          competitionId: compId,
          round,
          dateIso,
          homeClubId: home.id,
          awayClubId: away.id,
          homeClubName: home.name,
          awayClubName: away.name,
          played: false,
        });
      }
    }

    for (let r = 1; r <= halfRounds; r++) {
      const round = roundCounter++;
      const dayOffset =
        compId === 'PL' && cycles === 1
          ? (round - 1) * 7
          : totalRounds > 1
          ? Math.round(((round - 1) * seasonDays) / (totalRounds - 1))
          : 0;
      const dateIso = new Date(seasonStart.getTime() + dayOffset * 86400_000).toISOString().slice(0, 10);

      const leg2Offset = (r % halfRounds) + 1;
      for (const m of cycleFirstHalf.filter((x) => x.roundOffset === leg2Offset)) {
        const home = clubMap.get(m.awayId)!;
        const away = clubMap.get(m.homeId)!;
        fixtures.push({
          id: `${idPrefix}${compId}_R${round}_${home.shortName}_${away.shortName}`,
          competitionId: compId,
          round,
          dateIso,
          homeClubId: home.id,
          awayClubId: away.id,
          homeClubName: home.name,
          awayClubName: away.name,
          played: false,
        });
      }
    }
  }

  return fixtures;
}

function getCupRoundDate(compId: CompetitionId, round: number, seasonStartYear = 2026): string {
  return getWorldCupRoundDate(compId, round, seasonStartYear);
}

export function getCupStageLabel(round: number): string {
  if (round === 3) return 'Round 3';
  if (round === 4) return 'Round 4';
  if (round === 5) return 'Quarter-Final';
  if (round === 6) return 'Semi-Final';
  if (round === 7) return 'Final';
  return `Round ${round}`;
}

export function resolveClubForMatch(clubs: Club[], clubId: string): Club {
  const found = clubs.find((c) => c.id === clubId);
  if (found) return found;
  const worldResolved = resolveWorldClub(clubs, clubId);
  if (worldResolved) return worldResolved;
  const ch = EFL_CHAMPIONSHIP_TEAMS.find((t) => t.id === clubId);
  if (ch) return buildCuratedEflClubFromTeam(ch, 'CHAMP');
  const l1 = EFL_LEAGUE_ONE_TEAMS.find((t) => t.id === clubId);
  if (l1) return buildCuratedEflClubFromTeam(l1, 'L1');
  const l2 = EFL_LEAGUE_TWO_TEAMS.find((t) => t.id === clubId);
  if (l2) return buildCuratedEflClubFromTeam(l2, 'L2');
  return clubs[0];
}

function buildContextCompetition(
  compId: CompetitionId,
  teams: ContextTeam[],
  cycles: number,
  seasonStartYear = 2026
): { standings: StandingRow[]; fixtures: Fixture[] } {
  if (isDomesticLeagueId(compId) && compId !== 'PL') {
    const fixtures = generateWorldLeagueFixtures(teams, compId, seasonStartYear);
    return { standings: computeContextLeagueStandings(teams, fixtures), fixtures };
  }
  const n = teams.length;
  const halfRounds = n - 1;
  const totalRounds = halfRounds * 2 * cycles;
  const seasonStart =
    compId === 'PL'
      ? new Date(`${seasonStartYear}-08-15T15:00:00Z`)
      : new Date(`${seasonStartYear}-08-08T15:00:00Z`);
  const seasonDays = compId === 'PL' ? 281 : 273;
  const idPrefix = seasonStartYear === 2026 ? '' : `S${seasonStartYear}_`;

  const fixtures: Fixture[] = [];
  const rotation = teams.map((t) => t.id);
  const teamMap = new Map(teams.map((t) => [t.id, t]));

  let roundCounter = 1;
  for (let cycle = 0; cycle < cycles; cycle++) {
    const cycleFirstHalf: { roundOffset: number; homeId: string; awayId: string }[] = [];
    const m = n - 1;
    const half = n / 2;
    const pivot = rotation[m];

    for (let r = 0; r < halfRounds; r++) {
      const p = (r * half) % m;
      const anchor = rotation[p];
      if (r % 2 === 0) {
        cycleFirstHalf.push({ roundOffset: r + 1, homeId: anchor, awayId: pivot });
      } else {
        cycleFirstHalf.push({ roundOffset: r + 1, homeId: pivot, awayId: anchor });
      }
      for (let k = 1; k < half; k++) {
        const homeId = rotation[(p + k) % m];
        const awayId = rotation[(p - k + m) % m];
        cycleFirstHalf.push({ roundOffset: r + 1, homeId, awayId });
      }
    }

    // First half
    for (let r = 1; r <= halfRounds; r++) {
      const round = roundCounter++;
      const dayOffset =
        compId === 'PL' && cycles === 1
          ? (round - 1) * 7
          : totalRounds > 1
          ? Math.round(((round - 1) * seasonDays) / (totalRounds - 1))
          : 0;
      const dateIso = new Date(seasonStart.getTime() + dayOffset * 86400_000).toISOString().slice(0, 10);
      for (const m of cycleFirstHalf.filter((x) => x.roundOffset === r)) {
        const h = teamMap.get(m.homeId)!;
        const a = teamMap.get(m.awayId)!;
        fixtures.push({
          id: `${idPrefix}${compId}_R${round}_${h.shortName}_${a.shortName}`,
          competitionId: compId,
          round,
          dateIso,
          homeClubId: h.id,
          awayClubId: a.id,
          homeClubName: h.name,
          awayClubName: a.name,
          played: false,
        });
      }
    }

    // Reverse half
    for (let r = 1; r <= halfRounds; r++) {
      const round = roundCounter++;
      const dayOffset =
        compId === 'PL' && cycles === 1
          ? (round - 1) * 7
          : totalRounds > 1
          ? Math.round(((round - 1) * seasonDays) / (totalRounds - 1))
          : 0;
      const dateIso = new Date(seasonStart.getTime() + dayOffset * 86400_000).toISOString().slice(0, 10);
      const leg2Offset = (r % halfRounds) + 1;
      for (const m of cycleFirstHalf.filter((x) => x.roundOffset === leg2Offset)) {
        const h = teamMap.get(m.awayId)!;
        const a = teamMap.get(m.homeId)!;
        fixtures.push({
          id: `${idPrefix}${compId}_R${round}_${h.shortName}_${a.shortName}`,
          competitionId: compId,
          round,
          dateIso,
          homeClubId: h.id,
          awayClubId: a.id,
          homeClubName: h.name,
          awayClubName: a.name,
          played: false,
        });
      }
    }
  }

  const standings = computeContextLeagueStandings(teams, fixtures);
  return { standings, fixtures };
}

function computeContextLeagueStandings(teams: ContextTeam[], fixtures: Fixture[]): StandingRow[] {
  const map = new Map<string, StandingRow>();
  for (const t of teams) {
    map.set(t.id, {
      clubId: t.id,
      clubName: t.name,
      shortName: t.shortName,
      primaryColor: t.primaryColor,
      secondaryColor: t.secondaryColor,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      form: [],
    });
  }

  for (const f of fixtures) {
    if (!f.played || f.homeGoals === undefined || f.awayGoals === undefined) continue;
    const h = map.get(f.homeClubId);
    const a = map.get(f.awayClubId);
    if (!h || !a) continue;
    h.played++;
    a.played++;
    h.goalsFor += f.homeGoals;
    h.goalsAgainst += f.awayGoals;
    a.goalsFor += f.awayGoals;
    a.goalsAgainst += f.homeGoals;
    if (f.homeGoals > f.awayGoals) {
      h.won++;
      h.points += 3;
      h.form.push('W');
      a.lost++;
      a.form.push('L');
    } else if (f.homeGoals < f.awayGoals) {
      a.won++;
      a.points += 3;
      a.form.push('W');
      h.lost++;
      h.form.push('L');
    } else {
      h.drawn++;
      a.drawn++;
      h.points += 1;
      a.points += 1;
      h.form.push('D');
      a.form.push('D');
    }
  }

  const rows = Array.from(map.values()).map((r) => ({
    ...r,
    goalDifference: r.goalsFor - r.goalsAgainst,
    form: r.form.slice(-5),
  }));

  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.clubName.localeCompare(b.clubName);
  });

  return rows;
}

function clubToContextTeam(c: Club): ContextTeam {
  const avgOvr = Math.round(
    c.players.slice(0, 11).reduce((acc, p) => acc + p.ovr, 0) / Math.max(1, Math.min(11, c.players.length))
  );
  return {
    id: c.id,
    name: c.name,
    shortName: c.shortName,
    primaryColor: c.primaryColor,
    secondaryColor: c.secondaryColor,
    ovr: avgOvr,
    managerName: c.managerName,
  };
}

function getCupParticipants(
  clubs: Club[],
  leagueTeams: Partial<Record<DomesticLeagueId, ContextTeam[]>>,
  userClubId?: string,
  userLeagueId: CompetitionId = 'PL'
): ContextTeam[] {
  const country = getCountryForLeague(userLeagueId);
  if (country.id === 'ENG') {
    const plTeams = (leagueTeams.PL ?? []).slice(0, 20);
    const champTeams = (leagueTeams.CHAMP ?? []).slice(0, 12);
    const participants: ContextTeam[] = [...plTeams, ...champTeams];
    if (userClubId && !participants.some((p) => p.id === userClubId)) {
      const userClub = clubs.find((c) => c.id === userClubId);
      if (userClub) {
        participants[participants.length - 1] = clubToContextTeam(userClub);
      }
    }
    return participants;
  }
  return getCupParticipantsForCountry(country.id, leagueTeams, clubs, userClubId);
}

export function getLeagueTeamsFromState(
  state: Pick<CareerState, 'clubs' | 'leagueTeams' | 'userLeagueId'>
): Record<DomesticLeagueId, ContextTeam[]> {
  if (
    state.leagueTeams &&
    state.leagueTeams.PL?.length === 20 &&
    state.leagueTeams.CHAMP?.length === 24 &&
    (state.leagueTeams.L1?.length === 24 || state.leagueTeams.L1?.length === 12) &&
    (state.leagueTeams.L2?.length === 24 || state.leagueTeams.L2?.length === 12)
  ) {
    // Merge with any missing world leagues for backwards-compatible upgraded saves
    const hasAll = state.leagueTeams.ESP1 && state.leagueTeams.GER1 && state.leagueTeams.USA1;
    if (hasAll) return state.leagueTeams;
    return {
      ...buildAllInitialLeagueTeams(),
      ...state.leagueTeams,
    };
  }

  const plClubs = state.clubs.filter((c) => !c.leagueId || c.leagueId === 'PL');
  const pl = (plClubs.length === 20 ? plClubs : buildPremierLeagueClubs()).map(clubToContextTeam);
  return {
    ...buildAllInitialLeagueTeams(),
    PL: pl,
    CHAMP: [...EFL_CHAMPIONSHIP_TEAMS],
    L1: [...EFL_LEAGUE_ONE_TEAMS],
    L2: [...EFL_LEAGUE_TWO_TEAMS],
  };
}

function computeCupStandings(participants: ContextTeam[], fixtures: Fixture[]): StandingRow[] {
  const map = new Map<string, StandingRow>();
  for (const t of participants) {
    map.set(t.id, {
      clubId: t.id,
      clubName: t.name,
      shortName: t.shortName,
      primaryColor: t.primaryColor,
      secondaryColor: t.secondaryColor,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      form: [],
    });
  }

  for (const f of fixtures) {
    if (!f.played || f.homeGoals === undefined || f.awayGoals === undefined) continue;
    const h = map.get(f.homeClubId);
    const a = map.get(f.awayClubId);
    if (!h || !a) continue;
    h.played++;
    a.played++;
    h.goalsFor += f.homeGoals;
    h.goalsAgainst += f.awayGoals;
    a.goalsFor += f.awayGoals;
    a.goalsAgainst += f.homeGoals;

    const homeWon =
      f.homeGoals > f.awayGoals ||
      (f.homeGoals === f.awayGoals && f.penaltiesWinnerId === f.homeClubId);
    const awayWon =
      f.awayGoals > f.homeGoals ||
      (f.homeGoals === f.awayGoals && f.penaltiesWinnerId === f.awayClubId);

    if (homeWon) {
      h.won++;
      h.points += 3;
      h.form.push('W');
      a.lost++;
      a.form.push('L');
    } else if (awayWon) {
      a.won++;
      a.points += 3;
      a.form.push('W');
      h.lost++;
      h.form.push('L');
    } else {
      h.drawn++;
      a.drawn++;
      h.points += 1;
      a.points += 1;
      h.form.push('D');
      a.form.push('D');
    }
  }

  return Array.from(map.values())
    .map((r) => ({
      ...r,
      goalDifference: r.goalsFor - r.goalsAgainst,
      form: r.form.slice(-5),
    }))
    .sort((a, b) => {
      if (b.won !== a.won) return b.won - a.won;
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      return a.clubName.localeCompare(b.clubName);
    });
}

function drawCupRoundFixtures(
  compId: CompetitionId,
  round: number,
  teams: ContextTeam[],
  seed: number,
  seasonStartYear = 2026
): Fixture[] {
  return drawWorldCupRoundFixtures(compId as DomesticCupId, round, teams, seed, seasonStartYear);
}

function buildCupFixtures(
  clubs: Club[],
  leagueTeams: Partial<Record<DomesticLeagueId, ContextTeam[]>>,
  userLeagueId: CompetitionId = 'PL',
  userClubId?: string,
  seasonStartYear = 2026,
  shieldPair?: { homeId: string; awayId: string },
  uefaSeedsOverride?: Record<UefaCompId, string[]>,
  supercopaTeamIds?: string[],
  uefaSuperCupPair?: { homeId: string; awayId: string }
): Partial<Record<CompetitionId, { standings: StandingRow[]; fixtures: Fixture[] }>> {
  const out: Partial<Record<CompetitionId, { standings: StandingRow[]; fixtures: Fixture[] }>> = {};

  // 1. Build all 33 non-user domestic leagues
  for (const lid of ALL_DOMESTIC_LEAGUE_IDS) {
    if (lid === userLeagueId) {
      out[lid] = { standings: [], fixtures: [] };
      continue;
    }
    const teams = leagueTeams[lid] ?? getInitialContextTeamsForLeague(lid);
    out[lid] = buildContextCompetition(lid, teams, 1, seasonStartYear);
  }

  // 2. Build all 22 countries' primary domestic cups (+ Carabao & Community Shield for ENG)
  const userCountry = getCountryForLeague(userLeagueId);
  for (const country of COUNTRY_CATALOG) {
    const participants = getCupParticipantsForCountry(
      country.id,
      leagueTeams,
      clubs,
      country.id === userCountry.id ? userClubId : undefined
    );
    const startRound = getDomesticCupStartRound(participants.length);
    const cupFix = drawCupRoundFixtures(
      country.primaryCupId,
      startRound,
      participants,
      20270106 + country.id.charCodeAt(0) * 19 + (seasonStartYear - 2026) * 101,
      seasonStartYear
    );
    out[country.primaryCupId] = {
      standings: computeCupStandings(participants, cupFix),
      fixtures: cupFix,
    };

    if (country.id === 'ENG') {
      const engParticipants = getCupParticipants(clubs, leagueTeams, userCountry.id === 'ENG' ? userClubId : undefined, 'PL');
      const faFixtures = drawCupRoundFixtures(
        'FACUP',
        3,
        engParticipants,
        20270106 + (seasonStartYear - 2026) * 101,
        seasonStartYear
      );
      const carabaoFixtures = drawCupRoundFixtures(
        'CARABAO',
        3,
        engParticipants,
        20260923 + (seasonStartYear - 2026) * 101,
        seasonStartYear
      );
      out.FACUP = {
        standings: computeCupStandings(engParticipants, faFixtures),
        fixtures: faFixtures,
      };
      out.CARABAO = {
        standings: computeCupStandings(engParticipants, carabaoFixtures),
        fixtures: carabaoFixtures,
      };
    }
  }

  // Community Shield
  const shieldHome = resolveClubForMatch(clubs, shieldPair?.homeId ?? 'liv');
  const shieldAway = resolveClubForMatch(
    clubs,
    shieldPair?.awayId && shieldPair.awayId !== shieldHome.id ? shieldPair.awayId : 'cry'
  );
  const idPrefix = seasonStartYear === 2026 ? '' : `S${seasonStartYear}_`;
  const shieldBase: Fixture = {
    id: `${idPrefix}SHIELD_FINAL_${shieldHome.shortName}_${shieldAway.shortName}`,
    competitionId: 'SHIELD',
    round: 1,
    dateIso: `${seasonStartYear}-08-09`,
    homeClubId: shieldHome.id,
    awayClubId: shieldAway.id,
    homeClubName: shieldHome.name,
    awayClubName: shieldAway.name,
    played: true,
    stageLabel: 'Final',
  };
  const shieldReport = simulateMatch(shieldHome, shieldAway, shieldBase, 9 + seasonStartYear);
  const shieldWinnerId =
    shieldReport.homeGoals >= shieldReport.awayGoals ? shieldHome.id : shieldAway.id;
  const shieldFixture: Fixture = {
    ...shieldBase,
    homeGoals: shieldReport.homeGoals,
    awayGoals: shieldReport.awayGoals,
    penaltiesWinnerId:
      shieldReport.homeGoals === shieldReport.awayGoals ? shieldWinnerId : undefined,
    report: shieldReport,
  };
  out.SHIELD = {
    standings: computeCupStandings(
      [clubToContextTeam(shieldHome), clubToContextTeam(shieldAway)],
      [shieldFixture]
    ),
    fixtures: [shieldFixture],
  };

  // MLS Cup Playoffs (initially empty until USA1 Round 34 completes)
  out.MLSCUP = { standings: [], fixtures: [] };

  // Supercopa de España (4 teams: 2026/27 Season 1 = Barcelona, Atlético Madrid, Real Sociedad, Real Madrid)
  const scTeamIds =
    supercopaTeamIds && supercopaTeamIds.length >= 4
      ? supercopaTeamIds.slice(0, 4)
      : [
          'esp1_barcelona_8634',
          'esp1_atletico_madri_9906',
          'esp1_real_sociedad_8560',
          'esp1_real_madrid_8633',
        ];
  const scTeams = scTeamIds
    .map((cid) => findContextTeamGlobally(cid, leagueTeams))
    .filter((t): t is ContextTeam => Boolean(t));
  const scDate = getCupRoundDate('SUPERCOPA', 6, seasonStartYear);
  const scFixtures: Fixture[] = [];
  if (scTeams.length >= 4) {
    scFixtures.push(
      {
        id: `${idPrefix}SUPERCOPA_R6_${scTeams[0].shortName}_${scTeams[1].shortName}_0`,
        competitionId: 'SUPERCOPA',
        round: 6,
        dateIso: scDate,
        homeClubId: scTeams[0].id,
        awayClubId: scTeams[1].id,
        homeClubName: scTeams[0].name,
        awayClubName: scTeams[1].name,
        played: false,
        stageLabel: 'Semi-Final',
      },
      {
        id: `${idPrefix}SUPERCOPA_R6_${scTeams[2].shortName}_${scTeams[3].shortName}_1`,
        competitionId: 'SUPERCOPA',
        round: 6,
        dateIso: scDate,
        homeClubId: scTeams[2].id,
        awayClubId: scTeams[3].id,
        homeClubName: scTeams[2].name,
        awayClubName: scTeams[3].name,
        played: false,
        stageLabel: 'Semi-Final',
      }
    );
  }
  out.SUPERCOPA = {
    standings: computeCupStandings(scTeams, scFixtures),
    fixtures: scFixtures,
  };

  // UEFA Super Cup (UCL Winner vs UEL Winner; 2026/27 = Paris Saint-Germain vs Aston Villa)
  const uscHome =
    findContextTeamGlobally(uefaSuperCupPair?.homeId ?? 'fra1_paris_saint_ge_9847', leagueTeams) ??
    clubToContextTeam(shieldHome);
  const uscAway =
    findContextTeamGlobally(uefaSuperCupPair?.awayId ?? 'avl', leagueTeams) ??
    clubToContextTeam(shieldAway);
  const uscDate = getCupRoundDate('UEFASUPERCUP', 7, seasonStartYear);
  const uscFixture: Fixture = {
    id: `${idPrefix}UEFASUPERCUP_FINAL_${uscHome.shortName}_${uscAway.shortName}`,
    competitionId: 'UEFASUPERCUP',
    round: 7,
    dateIso: uscDate,
    homeClubId: uscHome.id,
    awayClubId: uscAway.id,
    homeClubName: uscHome.name,
    awayClubName: uscAway.name,
    played: false,
    stageLabel: 'Final',
  };
  out.UEFASUPERCUP = {
    standings: computeCupStandings([uscHome, uscAway], [uscFixture]),
    fixtures: [uscFixture],
  };

  // 3. Build UEFA C1 (UCL), C2 (UEL), C3 (UECL) 36-club Swiss League Phases
  const uefaSeeds = uefaSeedsOverride ?? getInitialUefaSeeds();
  (['UCL', 'UEL', 'UECL'] as UefaCompId[]).forEach((uId) => {
    const built = buildUefaLeaguePhaseFixtures(uId, uefaSeeds[uId], leagueTeams, seasonStartYear);
    out[uId] = { standings: built.standings, fixtures: built.fixtures };
  });

  return out;
}

function addDaysIso(baseIso: string, days: number): string {
  const d = new Date(`${baseIso}T12:00:00Z`);
  return new Date(d.getTime() + days * 86400_000).toISOString().slice(0, 10);
}

function diffDaysIso(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T12:00:00Z`).getTime();
  const b = new Date(`${toIso}T12:00:00Z`).getTime();
  return Math.round((b - a) / 86400_000);
}

export function getTransferWindowStatusForDate(
  dateIso: string,
  seasonStartYear = Number(dateIso.slice(0, 4)) >= 2026 ? (Number(dateIso.slice(5, 7)) >= 7 ? Number(dateIso.slice(0, 4)) : Number(dateIso.slice(0, 4)) - 1) : 2026
): {
  isOpen: boolean;
  windowType: 'SUMMER' | 'WINTER' | 'CLOSED';
  isDeadlineDay: boolean;
  summerStartIso: string;
  summerEndIso: string;
  winterStartIso: string;
  winterEndIso: string;
} {
  const summerStartIso = `${seasonStartYear}-07-01`;
  const summerEndIso = `${seasonStartYear}-09-01`;
  const winterStartIso = `${seasonStartYear + 1}-01-01`;
  const winterEndIso = `${seasonStartYear + 1}-02-01`;

  if (dateIso >= summerStartIso && dateIso <= summerEndIso) {
    return {
      isOpen: true,
      windowType: 'SUMMER',
      isDeadlineDay: dateIso === summerEndIso,
      summerStartIso,
      summerEndIso,
      winterStartIso,
      winterEndIso,
    };
  }
  if (dateIso >= winterStartIso && dateIso <= winterEndIso) {
    return {
      isOpen: true,
      windowType: 'WINTER',
      isDeadlineDay: dateIso === winterEndIso,
      summerStartIso,
      summerEndIso,
      winterStartIso,
      winterEndIso,
    };
  }
  return {
    isOpen: false,
    windowType: 'CLOSED',
    isDeadlineDay: false,
    summerStartIso,
    summerEndIso,
    winterStartIso,
    winterEndIso,
  };
}

function buildCalendarForUserClub(
  userClubId: string,
  plFixtures: Fixture[],
  cupFixtures: Fixture[] = [],
  seasonStartYear = 2026
): CalendarDay[] {
  const userMatches = [...plFixtures, ...cupFixtures]
    .filter((f) => f.homeClubId === userClubId || f.awayClubId === userClubId)
    .sort((a, b) => a.dateIso.localeCompare(b.dateIso) || a.round - b.round);

  const matchByDate = new Map<string, Fixture>();
  for (const m of userMatches) {
    if (!matchByDate.has(m.dateIso)) {
      matchByDate.set(m.dateIso, m);
    }
  }

  const summerOpenIso = `${seasonStartYear}-07-01`;
  const summerDeadlineIso = `${seasonStartYear}-09-01`;
  const winterOpenIso = `${seasonStartYear + 1}-01-01`;
  const winterDeadlineIso = `${seasonStartYear + 1}-02-01`;
  const defaultEndIso = `${seasonStartYear + 1}-05-24`;
  const lastMatchIso = userMatches[userMatches.length - 1]?.dateIso ?? defaultEndIso;
  const endDateIso = lastMatchIso > defaultEndIso ? lastMatchIso : defaultEndIso;
  const firstMatchIso = userMatches[0]?.dateIso ?? `${seasonStartYear}-08-15`;
  const totalDays = Math.max(1, diffDaysIso(summerOpenIso, endDateIso) + 1);

  const calendar: CalendarDay[] = [];
  for (let i = 0; i < totalDays; i++) {
    const dateIso = addDaysIso(summerOpenIso, i);
    const match = matchByDate.get(dateIso);
    const prevDateIso = i > 0 ? addDaysIso(dateIso, -1) : null;
    const prevWasMatch = prevDateIso ? matchByDate.has(prevDateIso) : false;
    const isPreSeasonRest = dateIso < firstMatchIso && i > 0 && i % 7 === 6;

    const windowEvent: CalendarDay['windowEvent'] =
      dateIso === summerOpenIso
        ? 'SUMMER_OPEN'
        : dateIso === summerDeadlineIso
        ? 'SUMMER_DEADLINE'
        : dateIso === winterOpenIso
        ? 'WINTER_OPEN'
        : dateIso === winterDeadlineIso
        ? 'WINTER_DEADLINE'
        : undefined;
    const isDeadlineDay = dateIso === summerDeadlineIso || dateIso === winterDeadlineIso;

    if (match) {
      const compName = COMPETITION_THEMES[match.competitionId].name;
      calendar.push({
        dayIndex: i,
        dateIso,
        type: 'MATCHDAY',
        label: `${compName} · ${match.stageLabel ?? `Round ${match.round}`}`,
        completed: false,
        matchFixtureId: match.id,
        competitionId: match.competitionId,
        isDeadlineDay: isDeadlineDay || undefined,
        windowEvent,
      });
      continue;
    }

    const type: CalendarDay['type'] = prevWasMatch || isPreSeasonRest ? 'RECOVERY' : 'TRAINING';
    let label =
      type === 'RECOVERY'
        ? dateIso < firstMatchIso
          ? 'Pre-Season Recovery Day'
          : 'Recovery Day'
        : dateIso < firstMatchIso
        ? 'Pre-Season Training Day'
        : 'Training Day';

    if (windowEvent === 'SUMMER_OPEN') label = 'Summer Transfer Window Opens · Pre-Season Camp';
    else if (windowEvent === 'SUMMER_DEADLINE') label = 'Summer Transfer Deadline Day (24h)';
    else if (windowEvent === 'WINTER_OPEN') label = 'Winter Transfer Window Opens';
    else if (windowEvent === 'WINTER_DEADLINE') label = 'Winter Transfer Deadline Day (24h)';

    calendar.push({
      dayIndex: i,
      dateIso,
      type,
      label,
      completed: false,
      isDeadlineDay: isDeadlineDay || undefined,
      windowEvent,
    });
  }

  return calendar;
}

function insertCupMatchdayIntoCalendar(
  calendar: CalendarDay[],
  currentDayIndex: number,
  cupFixture: Fixture
): CalendarDay[] {
  if (calendar.some((d) => d.matchFixtureId === cupFixture.id)) {
    return calendar;
  }

  const compName = COMPETITION_THEMES[cupFixture.competitionId].name;
  const cupLabel = `${compName} · ${cupFixture.stageLabel ?? `Round ${cupFixture.round}`}`;

  const existingIdx = calendar.findIndex((d) => d.dateIso === cupFixture.dateIso);
  let next: CalendarDay[];

  if (existingIdx !== -1 && existingIdx > currentDayIndex && calendar[existingIdx].type !== 'MATCHDAY') {
    next = calendar.map((d, i) => {
      if (i === existingIdx) {
        return {
          ...d,
          type: 'MATCHDAY' as const,
          label: cupLabel,
          matchFixtureId: cupFixture.id,
          competitionId: cupFixture.competitionId,
        };
      }
      if (i === existingIdx + 1 && d.type !== 'MATCHDAY' && !d.isDeadlineDay) {
        return {
          ...d,
          type: 'RECOVERY' as const,
          label: 'Recovery Day',
        };
      }
      return d;
    });
  } else {
    const insertPos = calendar.findIndex((d, i) => i > currentDayIndex && d.dateIso > cupFixture.dateIso);
    const newEntry: CalendarDay = {
      dayIndex: 0,
      dateIso: cupFixture.dateIso,
      type: 'MATCHDAY',
      label: cupLabel,
      completed: false,
      matchFixtureId: cupFixture.id,
      competitionId: cupFixture.competitionId,
    };
    next = [...calendar];
    if (insertPos === -1) next.push(newEntry);
    else next.splice(insertPos, 0, newEntry);
  }

  return next.map((d, idx) => ({ ...d, dayIndex: idx }));
}

function getContextTeamOvrMap(
  clubs: Club[],
  leagueTeams?: Partial<Record<DomesticLeagueId, ContextTeam[]>>
): Map<string, number> {
  return getWorldClubOvrLookup(clubs, leagueTeams);
}

function samplePoisson(lambda: number, rand: () => number): number {
  const limit = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.max(1e-7, rand());
  } while (p > limit && k < 8);
  return k - 1;
}

function simulateContextLeagueFixture(f: Fixture, ovrMap: Map<string, number>, seedOffset: number): Fixture {
  const hOvr = ovrMap.get(f.homeClubId) ?? 72;
  const aOvr = ovrMap.get(f.awayClubId) ?? 72;
  const seed =
    f.id.split('').reduce((s, ch, idx) => s + ch.charCodeAt(0) * (idx + 5), 0) * 31 +
    f.round * 17 +
    seedOffset * 13;
  const rand = seededRandom(seed);

  const ovrDiff = (hOvr + 2.2 - aOvr) / 14;
  const lambdaHome = Math.max(0.55, Math.min(3.15, 1.48 + ovrDiff * 0.55));
  const lambdaAway = Math.max(0.45, Math.min(2.85, 1.18 - ovrDiff * 0.5));
  const hg = Math.min(6, samplePoisson(lambdaHome, rand));
  const ag = Math.min(6, samplePoisson(lambdaAway, rand));
  return {
    ...f,
    played: true,
    homeGoals: hg,
    awayGoals: ag,
  };
}

function simulateCupFixture(clubs: Club[], f: Fixture, seedOffset: number): Fixture {
  const home = resolveClubForMatch(clubs, f.homeClubId);
  const away = resolveClubForMatch(clubs, f.awayClubId);
  const rep = simulateMatch(home, away, f, seedOffset);
  let penaltiesWinnerId: string | undefined;

  if (rep.homeGoals === rep.awayGoals) {
    const hAvg = home.players.slice(0, 11).reduce((s, p) => s + p.ovr, 0);
    const aAvg = away.players.slice(0, 11).reduce((s, p) => s + p.ovr, 0);
    const r = seededRandom(f.round * 97 + home.id.charCodeAt(0) * 19 + seedOffset)();
    const homePenChance = 0.52 + (hAvg - aAvg) * 0.008;
    penaltiesWinnerId = r < homePenChance ? home.id : away.id;
    const winnerName = penaltiesWinnerId === home.id ? home.shortName : away.shortName;
    rep.events.push({
      id: `ev_${f.id}_pens`,
      minute: 90,
      type: 'CHANCE',
      teamSide: penaltiesWinnerId === home.id ? 'HOME' : 'AWAY',
      playerId: (penaltiesWinnerId === home.id ? home : away).players[0]?.id ?? '',
      playerName: winnerName,
      description: `${winnerName} win the penalty shootout to advance!`,
    });
  }

  return {
    ...f,
    played: true,
    homeGoals: rep.homeGoals,
    awayGoals: rep.awayGoals,
    penaltiesWinnerId,
    report: rep,
  };
}

function advanceCupBracketIfReady(
  compId: CompetitionId,
  fixtures: Fixture[],
  participants: ContextTeam[],
  seasonStartYear = 2026
): Fixture[] {
  const participantMap = new Map(participants.map((p) => [p.id, p]));
  let updated = [...fixtures];

  for (let r = 3; r <= 6; r++) {
    const roundMatches = updated.filter((f) => f.round === r);
    const nextRoundExists = updated.some((f) => f.round === r + 1);
    if (roundMatches.length === 0 || nextRoundExists) continue;
    if (!roundMatches.every((f) => f.played)) break;

    const winners: ContextTeam[] = [];
    for (const m of roundMatches) {
      const winnerId =
        (m.homeGoals ?? 0) > (m.awayGoals ?? 0)
          ? m.homeClubId
          : (m.awayGoals ?? 0) > (m.homeGoals ?? 0)
          ? m.awayClubId
          : m.penaltiesWinnerId ?? m.homeClubId;
      const team = participantMap.get(winnerId) ?? findContextTeamGlobally(winnerId);
      if (team) winners.push(team);
    }

    if (winners.length >= 2) {
      const nextRound = drawCupRoundFixtures(
        compId,
        r + 1,
        winners,
        compId.charCodeAt(0) * 17 + r * 31 + (seasonStartYear - 2026) * 53,
        seasonStartYear
      );
      updated = [...updated, ...nextRound];
    }
  }

  return updated;
}

function buildGlobalContextTeamLookup(
  leagueTeams: Partial<Record<DomesticLeagueId, ContextTeam[]>>
): Map<string, ContextTeam> {
  const map = new Map<string, ContextTeam>();
  for (const t of getAllRestOfEuropeContextTeams()) {
    map.set(t.id, t);
  }
  for (const lid of ALL_DOMESTIC_LEAGUE_IDS) {
    for (const t of leagueTeams[lid] ?? []) {
      map.set(t.id, t);
    }
  }
  return map;
}

function syncParallelCompetitions(
  state: CareerState,
  upToDateIso: string,
  simulateAllUserCupsToo = false
): Pick<CareerState, 'contextStandings' | 'contextFixtures' | 'calendar' | 'leagueTeams'> {
  const userLeagueId = state.userLeagueId ?? 'PL';
  const userCountry = getCountryForLeague(userLeagueId);
  const seasonStartYear = 2026 + (state.seasonIndex ?? 0);
  const leagueTeams = getLeagueTeamsFromState(state);
  const ovrMap = getContextTeamOvrMap(state.clubs, leagueTeams);
  const globalTeamMap = buildGlobalContextTeamLookup(leagueTeams);
  const nextContextStandings = { ...state.contextStandings };
  const nextContextFixtures = { ...state.contextFixtures };
  let nextCalendar = state.calendar;

  // 1. All 34 domestic divisions NOT currently managed by the user run genuinely in parallel
  for (const compId of ALL_DOMESTIC_LEAGUE_IDS) {
    if (compId === userLeagueId) continue;
    const teams = leagueTeams[compId] ?? [];
    const existing = nextContextFixtures[compId] ?? [];
    let anyChanged = false;
    const updated = existing.map((cf) => {
      if (!cf.played && cf.dateIso <= upToDateIso) {
        anyChanged = true;
        return simulateContextLeagueFixture(cf, ovrMap, cf.round + state.currentDayIndex);
      }
      return cf;
    });
    if (anyChanged || !nextContextStandings[compId]?.length) {
      nextContextFixtures[compId] = updated;
      nextContextStandings[compId] = computeContextLeagueStandings(teams, updated);
    }
  }

  // 2. Domestic Cups (User's country active daily; all other countries when finalizing season)
  const cupIdsToSync: CompetitionId[] =
    userCountry.id === 'ENG'
      ? ['CARABAO', 'FACUP']
      : [userCountry.primaryCupId];
  if (simulateAllUserCupsToo) {
    for (const c of COUNTRY_CATALOG) {
      if (!cupIdsToSync.includes(c.primaryCupId)) cupIdsToSync.push(c.primaryCupId);
    }
  }

  for (const compId of cupIdsToSync) {
    const countryForCup = getCountryForLeague(compId);
    const cupParticipants = getCupParticipants(state.clubs, leagueTeams, state.clubId, countryForCup.leagues[0]);
    let cupFixtures = nextContextFixtures[compId] ?? [];
    if (cupFixtures.length === 0) continue;

    for (let safety = 0; safety < 6; safety++) {
      let changed = false;
      cupFixtures = cupFixtures.map((cf) => {
        if (cf.played || cf.dateIso > upToDateIso) return cf;
        const involvesUser = cf.homeClubId === state.clubId || cf.awayClubId === state.clubId;
        if (!simulateAllUserCupsToo && involvesUser && cf.dateIso === upToDateIso) return cf;
        changed = true;
        return simulateCupFixture(state.clubs, cf, cf.round + state.currentDayIndex + safety * 7);
      });

      const progressed = advanceCupBracketIfReady(compId, cupFixtures, cupParticipants, seasonStartYear);
      const addedNewRound = progressed.length > cupFixtures.length;
      cupFixtures = progressed;
      if (!changed && !addedNewRound) break;
      if (!simulateAllUserCupsToo) break;
    }

    nextContextFixtures[compId] = cupFixtures;
    nextContextStandings[compId] = computeCupStandings(cupParticipants, cupFixtures);

    if (!simulateAllUserCupsToo && countryForCup.id === userCountry.id) {
      const userUpcomingCup = cupFixtures.find(
        (f) => !f.played && (f.homeClubId === state.clubId || f.awayClubId === state.clubId)
      );
      if (userUpcomingCup) {
        nextCalendar = insertCupMatchdayIntoCalendar(nextCalendar, state.currentDayIndex, userUpcomingCup);
      }
    }
  }

  // 3. MLS Cup Playoffs (triggered when USA1 regular season finishes)
  const usaStandings =
    userLeagueId === 'USA1'
      ? computeStandings(
          state.clubs.filter((c) => (c.leagueId ?? 'PL') === 'USA1'),
          state.fixtures
        )
      : nextContextStandings.USA1 ?? [];
  const usaFinished =
    userLeagueId === 'USA1'
      ? state.fixtures.length > 0 && state.fixtures.every((f) => f.played)
      : (nextContextFixtures.USA1 ?? []).length > 0 &&
        (nextContextFixtures.USA1 ?? []).every((f) => f.played);

  if (usaFinished && usaStandings.length >= 16) {
    let mlsFixtures = nextContextFixtures.MLSCUP ?? [];
    const usaTeams = leagueTeams.USA1 ?? [];
    const eastTop = usaStandings
      .filter((r) => usaTeams.find((t) => t.id === r.clubId)?.conf === 'EAST')
      .slice(0, 8);
    const westTop = usaStandings
      .filter((r) => usaTeams.find((t) => t.id === r.clubId)?.conf === 'WEST')
      .slice(0, 8);
    const seedPairs: [StandingRow, StandingRow][] = [];
    for (let i = 0; i < 4; i++) {
      if (eastTop[i] && eastTop[7 - i]) seedPairs.push([eastTop[i], eastTop[7 - i]]);
      if (westTop[i] && westTop[7 - i]) seedPairs.push([westTop[i], westTop[7 - i]]);
    }
    const mlsParticipants = [...eastTop, ...westTop]
      .map((r) => globalTeamMap.get(r.clubId))
      .filter((t): t is ContextTeam => Boolean(t));

    if (mlsFixtures.length === 0 && seedPairs.length >= 4) {
      const dateIso = getCupRoundDate('MLSCUP', 4, seasonStartYear);
      const idPrefix = seasonStartYear === 2026 ? '' : `S${seasonStartYear}_`;
      mlsFixtures = seedPairs.map(([h, a], idx) => ({
        id: `${idPrefix}MLSCUP_R4_${h.shortName}_${a.shortName}_${idx}`,
        competitionId: 'MLSCUP',
        round: 4,
        dateIso,
        homeClubId: h.clubId,
        awayClubId: a.clubId,
        homeClubName: h.clubName,
        awayClubName: a.clubName,
        played: false,
        stageLabel: 'MLS Playoffs R16',
      }));
    }

    for (let safety = 0; safety < 5; safety++) {
      let changed = false;
      mlsFixtures = mlsFixtures.map((cf) => {
        if (cf.played || cf.dateIso > upToDateIso) return cf;
        const involvesUser = cf.homeClubId === state.clubId || cf.awayClubId === state.clubId;
        if (!simulateAllUserCupsToo && involvesUser && cf.dateIso === upToDateIso) return cf;
        changed = true;
        return simulateCupFixture(state.clubs, cf, cf.round + state.currentDayIndex + safety * 11);
      });
      const progressed = advanceCupBracketIfReady('MLSCUP', mlsFixtures, mlsParticipants, seasonStartYear);
      const added = progressed.length > mlsFixtures.length;
      mlsFixtures = progressed;
      if (!changed && !added) break;
      if (!simulateAllUserCupsToo) break;
    }

    nextContextFixtures.MLSCUP = mlsFixtures;
    nextContextStandings.MLSCUP = computeCupStandings(mlsParticipants, mlsFixtures);

    if (!simulateAllUserCupsToo && userLeagueId === 'USA1') {
      const userMls = mlsFixtures.find(
        (f) => !f.played && (f.homeClubId === state.clubId || f.awayClubId === state.clubId)
      );
      if (userMls) {
        nextCalendar = insertCupMatchdayIntoCalendar(nextCalendar, state.currentDayIndex, userMls);
      }
    }
  }

  // 4. UEFA Champions League (C1), Europa League (C2), Conference League (C3)
  const uefaSeeds = state.uefaParticipants ?? getInitialUefaSeeds();
  (['UCL', 'UEL', 'UECL'] as UefaCompId[]).forEach((uId) => {
    const partIds = uefaSeeds[uId] ?? getInitialUefaSeeds()[uId];
    const partTeams = partIds
      .map((id) => globalTeamMap.get(id) ?? findContextTeamGlobally(id, leagueTeams))
      .filter((t): t is ContextTeam => Boolean(t));
    let uFixtures = nextContextFixtures[uId] ?? [];
    if (uFixtures.length === 0) return;

    const lpMax = getUefaLeaguePhaseRounds(uId);
    for (let safety = 0; safety < 6; safety++) {
      let changed = false;
      uFixtures = uFixtures.map((cf) => {
        if (cf.played || cf.dateIso > upToDateIso) return cf;
        const involvesUser = cf.homeClubId === state.clubId || cf.awayClubId === state.clubId;
        if (!simulateAllUserCupsToo && involvesUser && cf.dateIso === upToDateIso) return cf;
        changed = true;
        if (cf.round <= lpMax) {
          return simulateContextLeagueFixture(cf, ovrMap, cf.round + state.currentDayIndex + safety * 5);
        }
        return simulateCupFixture(state.clubs, cf, cf.round + state.currentDayIndex + safety * 9);
      });

      const lpStandings = computeUefaPhaseStandings(partTeams, uFixtures, uId);
      const progressed = advanceUefaKnockoutIfReady(uId, uFixtures, lpStandings, globalTeamMap, seasonStartYear);
      const addedKo = progressed.length > uFixtures.length;
      uFixtures = progressed;
      if (!changed && !addedKo) break;
      if (!simulateAllUserCupsToo) break;
    }

    nextContextFixtures[uId] = uFixtures;
    nextContextStandings[uId] = computeUefaPhaseStandings(partTeams, uFixtures, uId);

    if (!simulateAllUserCupsToo) {
      const userUpcomingUefa = uFixtures.find(
        (f) => !f.played && (f.homeClubId === state.clubId || f.awayClubId === state.clubId)
      );
      if (userUpcomingUefa) {
        nextCalendar = insertCupMatchdayIntoCalendar(nextCalendar, state.currentDayIndex, userUpcomingUefa);
      }
    }
  });

  // 5. Supercopa de España (4-team SF -> Final) & UEFA Super Cup (1-match Final)
  (['SUPERCOPA', 'UEFASUPERCUP'] as const).forEach((scId) => {
    let scFixtures = nextContextFixtures[scId] ?? [];
    if (scFixtures.length === 0) return;

    const scPartIds = new Set<string>();
    for (const f of scFixtures) {
      scPartIds.add(f.homeClubId);
      scPartIds.add(f.awayClubId);
    }
    const scParticipants = Array.from(scPartIds)
      .map((id) => globalTeamMap.get(id) ?? findContextTeamGlobally(id, leagueTeams))
      .filter((t): t is ContextTeam => Boolean(t));

    for (let safety = 0; safety < 3; safety++) {
      let changed = false;
      scFixtures = scFixtures.map((cf) => {
        if (cf.played || cf.dateIso > upToDateIso) return cf;
        const involvesUser = cf.homeClubId === state.clubId || cf.awayClubId === state.clubId;
        if (!simulateAllUserCupsToo && involvesUser && cf.dateIso === upToDateIso) return cf;
        changed = true;
        return simulateCupFixture(state.clubs, cf, cf.round + state.currentDayIndex + safety * 13);
      });
      const progressed =
        scId === 'SUPERCOPA'
          ? advanceCupBracketIfReady('SUPERCOPA', scFixtures, scParticipants, seasonStartYear)
          : scFixtures;
      const added = progressed.length > scFixtures.length;
      scFixtures = progressed;
      if (!changed && !added) break;
      if (!simulateAllUserCupsToo) break;
    }

    nextContextFixtures[scId] = scFixtures;
    nextContextStandings[scId] = computeCupStandings(scParticipants, scFixtures);

    if (!simulateAllUserCupsToo) {
      const userScMatch = scFixtures.find(
        (f) => !f.played && (f.homeClubId === state.clubId || f.awayClubId === state.clubId)
      );
      if (userScMatch) {
        nextCalendar = insertCupMatchdayIntoCalendar(nextCalendar, state.currentDayIndex, userScMatch);
      }
    }
  });

  return {
    contextStandings: nextContextStandings,
    contextFixtures: nextContextFixtures,
    calendar: nextCalendar,
    leagueTeams,
  };
}

const ACADEMY_FIRST_NAMES = [
  'Callum', 'Jude', 'Theo', 'Liam', 'Mason', 'Toby', 'Ethan', 'Archie',
  'Kieran', 'Mateo', 'Seb', 'Finley', 'Noah', 'Ellis', 'Dylan', 'Owen',
];
const ACADEMY_LAST_NAMES = [
  'Whitaker', 'Hargreaves', 'Bramwell', 'Fletcher', 'Pemberton', 'Aldridge',
  'Sinclair', 'Mercer', 'Cunningham', 'Holloway', 'Redfern', 'Lockwood',
];

export function generateFakeAcademySquad(clubId: string): AcademyPlayer[] {
  const rand = seededRandom(clubId.charCodeAt(0) * 99 + 42);
  const positions: Position[] = ['GK', 'DEF', 'DEF', 'MID', 'MID', 'FWD', 'FWD', 'MID'];
  const nats = ['England', 'Wales', 'Scotland', 'Ireland', 'England', 'England'];

  return positions.map((pos, idx) => {
    const fn = ACADEMY_FIRST_NAMES[Math.floor(rand() * ACADEMY_FIRST_NAMES.length)];
    const ln = ACADEMY_LAST_NAMES[Math.floor(rand() * ACADEMY_LAST_NAMES.length)];
    const ovr = 61 + Math.floor(rand() * 8);
    const potential = Math.min(92, ovr + 12 + Math.floor(rand() * 10));
    return {
      id: `acad_${clubId}_${idx + 1}`,
      name: `${fn} ${ln}`,
      nationality: nats[Math.floor(rand() * nats.length)],
      age: 16 + Math.floor(rand() * 3),
      position: pos,
      ovr,
      potential,
      developmentProgress: 20 + Math.floor(rand() * 45),
      matches: 4 + Math.floor(rand() * 14),
      goals: pos === 'FWD' ? 3 + Math.floor(rand() * 8) : pos === 'MID' ? Math.floor(rand() * 5) : 0,
      assists: pos === 'GK' ? 0 : 1 + Math.floor(rand() * 6),
      promoted: false,
    };
  });
}

function computeManagerWeeklyOffer(leagueId: CompetitionId, ovr: number): number {
  const tier = isDomesticLeagueId(leagueId) ? LEAGUE_CATALOG[leagueId].tier : 1;
  const base =
    leagueId === 'PL'
      ? 52_000
      : leagueId === 'ESP1' || leagueId === 'GER1' || leagueId === 'ITA1'
      ? 45_000
      : leagueId === 'FRA1' || leagueId === 'KSA1'
      ? 36_000
      : tier === 1
      ? 22_000
      : leagueId === 'CHAMP'
      ? 18_000
      : tier === 2
      ? 11_000
      : tier === 3
      ? 6_500
      : 3_800;
  const expectedBaseline = tier === 1 ? 76 : tier === 2 ? 70 : tier === 3 ? 65 : 62;
  const ovrFactor = Math.max(0.75, 1 + (ovr - expectedBaseline) * 0.08);
  return Math.round((base * ovrFactor) / 500) * 500;
}

export function buildDefaultManagerContract(
  leagueId: CompetitionId,
  signedDateIso: string,
  seasonStartYear = 2026,
  club?: Club
): ManagerContract {
  const avgOvr = club
    ? Math.round(club.players.slice(0, 11).reduce((s, p) => s + p.ovr, 0) / Math.max(1, Math.min(11, club.players.length)))
    : 76;
  return {
    weeklyWage: computeManagerWeeklyOffer(leagueId, avgOvr),
    contractEndSeasonYear: seasonStartYear + 2,
    signedDateIso,
    status: 'ACTIVE',
    probationMatchesRemaining: null,
  };
}

export function buildInitialClubManagers(
  clubs: Club[],
  leagueTeams: Partial<Record<DomesticLeagueId, ContextTeam[]>>,
  userClubId: string,
  userCoachName: string,
  seasonStartYear = 2026
): Record<string, ClubManagerInfo> {
  const out: Record<string, ClubManagerInfo> = {};
  const clubMap = new Map(clubs.map((c) => [c.id, c]));

  for (const tier of ALL_DOMESTIC_LEAGUE_IDS) {
    for (const tm of leagueTeams[tier] ?? []) {
      const fullClub = clubMap.get(tm.id);
      const rawName = fullClub?.managerName ?? tm.managerName ?? `${tm.shortName} Coach`;
      const offer = computeManagerWeeklyOffer(tier, tm.ovr);

      if (tm.id === userClubId) {
        out[tm.id] = {
          clubId: tm.id,
          managerName: userCoachName,
          satisfaction: 72,
          contractEndSeasonYear: seasonStartYear + 2,
          status: 'SECURE',
          weeklyBudgetOffer: offer,
        };
        continue;
      }

      let hash = 0;
      for (let i = 0; i < tm.id.length; i++) hash = (hash * 31 + tm.id.charCodeAt(i)) % 997;
      const roll = hash % 20;

      let status: AiManagerStatus = 'SECURE';
      let satisfaction = 64 + (hash % 24);
      let contractEndSeasonYear = seasonStartYear + 1 + (hash % 3);
      let managerName = rawName;

      if (roll === 0) {
        status = 'VACANT';
        satisfaction = 25;
        managerName = 'Caretaker Boss';
      } else if (roll <= 3) {
        status = 'UNDER_PRESSURE';
        satisfaction = 24 + (hash % 11);
      } else if (roll <= 6) {
        status = 'EXPIRING';
        satisfaction = 52 + (hash % 18);
        contractEndSeasonYear = seasonStartYear + 1;
      }

      out[tm.id] = {
        clubId: tm.id,
        managerName,
        satisfaction,
        contractEndSeasonYear,
        status,
        weeklyBudgetOffer: offer,
      };
    }
  }

  return out;
}

function cupRoundNameEn(round: number): string {
  if (round >= 7) return 'Final';
  if (round === 6) return 'Semi-Final';
  if (round === 5) return 'Quarter-Final';
  return `Round ${round}`;
}

function cupRoundNameVi(round: number): string {
  if (round >= 7) return 'Chung kết';
  if (round === 6) return 'Bán kết';
  if (round === 5) return 'Tứ kết';
  return `Vòng ${round}`;
}

function getCupFixtureWinnerId(f: Fixture): string | null {
  if (!f.played || f.homeGoals === undefined || f.awayGoals === undefined) return null;
  if (f.homeGoals > f.awayGoals) return f.homeClubId;
  if (f.awayGoals > f.homeGoals) return f.awayClubId;
  return f.penaltiesWinnerId ?? f.homeClubId;
}

export function buildSeasonObjectivesForClub(
  clubId: string,
  leagueId: CompetitionId,
  leagueTeams: Partial<Record<DomesticLeagueId, ContextTeam[]>>,
  clubs: Club[],
  seasonIndex = 0
): SeasonObjective[] {
  const tier: DomesticLeagueId = isDomesticLeagueId(leagueId) ? leagueId : 'PL';
  const leagueMeta = LEAGUE_CATALOG[tier];
  const countryMeta = getCountryForLeague(tier);
  const clubById = new Map(clubs.map((c) => [c.id, c]));
  const teamsWithOvr = (leagueTeams[tier] ?? getInitialContextTeamsForLeague(tier)).map((tm) => {
    const full = clubById.get(tm.id);
    const calcOvr = full
      ? Math.round(
          full.players.slice(0, 11).reduce((s, p) => s + p.ovr, 0) /
            Math.max(1, Math.min(11, full.players.length))
        )
      : tm.ovr;
    return { id: tm.id, ovr: calcOvr, name: tm.name };
  });
  const sorted = [...teamsWithOvr].sort((a, b) => b.ovr - a.ovr || a.name.localeCompare(b.name));
  const rankIdx = sorted.findIndex((t) => t.id === clubId);
  const expectedRank = rankIdx >= 0 ? rankIdx + 1 : Math.max(1, Math.ceil(sorted.length / 2));
  const leagueThemeName = COMPETITION_THEMES[tier].name;

  let targetLeagueRank = Math.max(1, Math.round(sorted.length * 0.5));
  let leagueTitleEn = 'Finish in Top 10';
  let leagueTitleVi = 'Kết thúc trong Top 10';
  let leagueDescEn = `Finish at least #10 in ${leagueThemeName}.`;
  let leagueDescVi = `Kết thúc mùa giải ở vị trí từ #10 trở lên tại ${leagueThemeName}.`;

  if (tier === 'PL') {
    if (expectedRank <= 2) {
      targetLeagueRank = 2;
      leagueTitleEn = 'Title Challenge (Finish Top 2)';
      leagueTitleVi = 'Đua vô địch Premier League (Top 2)';
      leagueDescEn = 'Challenge for the Premier League title and finish inside the top 2.';
      leagueDescVi = 'Cạnh tranh ngôi vô địch Premier League và kết thúc trong Top 2.';
    } else if (expectedRank <= 5) {
      targetLeagueRank = 4;
      leagueTitleEn = 'Qualify for Champions League (Top 4)';
      leagueTitleVi = 'Giành vé dự Champions League (Top 4)';
      leagueDescEn = 'Secure a top-4 Premier League finish for Champions League football.';
      leagueDescVi = 'Hoàn thành mùa giải trong Top 4 Premier League để giành vé Champions League.';
    } else if (expectedRank <= 8) {
      targetLeagueRank = 6;
      leagueTitleEn = 'Qualify for European Competition (Top 6)';
      leagueTitleVi = 'Giành vé dự Cúp Châu Âu (Top 6)';
      leagueDescEn = 'Finish in the top 6 of the Premier League to qualify for Europe.';
      leagueDescVi = 'Kết thúc trong Top 6 Premier League để giành suất dự Cúp Châu Âu.';
    } else if (expectedRank <= 12) {
      targetLeagueRank = 10;
      leagueTitleEn = 'Finish in the Top Half (Top 10)';
      leagueTitleVi = 'Kết thúc ở nửa trên BXH (Top 10)';
      leagueDescEn = 'Achieve a strong top-10 Premier League finish.';
      leagueDescVi = 'Đạt thành tích tốt và cán đích trong Top 10 Premier League.';
    } else if (expectedRank <= 16) {
      targetLeagueRank = 14;
      leagueTitleEn = 'Mid-Table Stability (Top 14)';
      leagueTitleVi = 'Trụ hạng an toàn giữa BXH (Top 14)';
      leagueDescEn = 'Stay clear of the relegation fight and finish 14th or higher.';
      leagueDescVi = 'Tránh xa nhóm cầm đèn đỏ và kết thúc từ hạng 14 trở lên.';
    } else {
      targetLeagueRank = 17;
      leagueTitleEn = 'Avoid Relegation (Finish Top 17)';
      leagueTitleVi = 'Trụ hạng thành công (Top 17)';
      leagueDescEn = 'Keep the club in the Premier League by finishing 17th or higher.';
      leagueDescVi = 'Giữ suất chơi tại Premier League bằng vị trí thứ 17 trở lên.';
    }
  } else if (tier === 'CHAMP' || tier === 'L1') {
    if (expectedRank <= 2) {
      targetLeagueRank = 2;
      leagueTitleEn = 'Automatic Promotion (Top 2)';
      leagueTitleVi = 'Thăng hạng trực tiếp (Top 2)';
      leagueDescEn = `Win automatic promotion by finishing in the top 2 of ${leagueThemeName}.`;
      leagueDescVi = `Giành vé thăng hạng trực tiếp với vị trí Top 2 tại ${leagueThemeName}.`;
    } else if (expectedRank <= 7) {
      targetLeagueRank = 6;
      leagueTitleEn = 'Reach Promotion Play-Offs (Top 6)';
      leagueTitleVi = 'Lọt nhóm Play-off thăng hạng (Top 6)';
      leagueDescEn = `Finish inside the top 6 to fight for promotion in ${leagueThemeName}.`;
      leagueDescVi = `Cán đích trong Top 6 để tham dự Play-off thăng hạng tại ${leagueThemeName}.`;
    } else if (expectedRank <= 14) {
      targetLeagueRank = 12;
      leagueTitleEn = 'Top-Half Finish (Top 12)';
      leagueTitleVi = 'Kết thúc ở nửa trên BXH (Top 12)';
      leagueDescEn = `Establish a competitive top-12 campaign in ${leagueThemeName}.`;
      leagueDescVi = `Hoàn thành mùa giải ổn định trong Top 12 tại ${leagueThemeName}.`;
    } else {
      targetLeagueRank = tier === 'CHAMP' ? 21 : 20;
      leagueTitleEn = `Avoid Relegation (Top ${targetLeagueRank})`;
      leagueTitleVi = `Trụ hạng thành công (Top ${targetLeagueRank})`;
      leagueDescEn = `Finish #${targetLeagueRank} or above to retain ${leagueThemeName} status.`;
      leagueDescVi = `Cán đích từ hạng ${targetLeagueRank} trở lên để trụ lại ${leagueThemeName}.`;
    }
  } else if (tier === 'L2') {
    if (expectedRank <= 3) {
      targetLeagueRank = 3;
      leagueTitleEn = 'Automatic Promotion (Top 3)';
      leagueTitleVi = 'Thăng hạng trực tiếp (Top 3)';
      leagueDescEn = 'Finish in the top 3 of EFL League Two for automatic promotion.';
      leagueDescVi = 'Kết thúc trong Top 3 EFL League Two để giành vé thăng hạng trực tiếp.';
    } else if (expectedRank <= 8) {
      targetLeagueRank = 7;
      leagueTitleEn = 'Reach Promotion Play-Offs (Top 7)';
      leagueTitleVi = 'Lọt nhóm Play-off thăng hạng (Top 7)';
      leagueDescEn = 'Secure a top-7 finish to enter the League Two Play-Offs.';
      leagueDescVi = 'Cán đích trong Top 7 để góp mặt ở loạt Play-off thăng hạng League Two.';
    } else if (expectedRank <= 15) {
      targetLeagueRank = 12;
      leagueTitleEn = 'Top-Half Finish (Top 12)';
      leagueTitleVi = 'Kết thúc ở nửa trên BXH (Top 12)';
      leagueDescEn = 'Finish in the top 12 of EFL League Two.';
      leagueDescVi = 'Hoàn thành mùa giải trong Top 12 EFL League Two.';
    } else {
      targetLeagueRank = 22;
      leagueTitleEn = 'Avoid Relegation (Top 22)';
      leagueTitleVi = 'Trụ hạng thành công (Top 22)';
      leagueDescEn = 'Finish 22nd or higher to preserve EFL League Two status.';
      leagueDescVi = 'Cán đích từ hạng 22 trở lên để giữ suất thi đấu tại League Two.';
    }
  } else {
    // World leagues objective calibration
    const totalTeams = Math.max(10, sorted.length);
    const safeCutoff = Math.max(4, totalTeams - (leagueMeta.autoRelegate + leagueMeta.playoffRelegate));
    if (expectedRank <= 2) {
      targetLeagueRank = 2;
      leagueTitleEn = `Title Challenge (Top 2 · ${leagueThemeName})`;
      leagueTitleVi = `Đua vô địch ${leagueThemeName} (Top 2)`;
      leagueDescEn = `Challenge for the ${leagueThemeName} championship and finish Top 2.`;
      leagueDescVi = `Cạnh tranh ngôi vô địch ${leagueThemeName} và cán đích Top 2.`;
    } else if (expectedRank <= Math.ceil(totalTeams * 0.28)) {
      targetLeagueRank = Math.max(3, Math.ceil(totalTeams * 0.25));
      leagueTitleEn =
        leagueMeta.tier === 1 && countryMeta.isEuropeanUefaEligible
          ? `Continental Qualification (Top ${targetLeagueRank})`
          : `Promotion Push (Top ${targetLeagueRank})`;
      leagueTitleVi =
        leagueMeta.tier === 1 && countryMeta.isEuropeanUefaEligible
          ? `Giành vé dự Cúp Châu Âu (Top ${targetLeagueRank})`
          : `Cạnh tranh thăng hạng (Top ${targetLeagueRank})`;
      leagueDescEn = `Finish inside Top ${targetLeagueRank} of ${leagueThemeName}.`;
      leagueDescVi = `Cán đích trong Top ${targetLeagueRank} tại ${leagueThemeName}.`;
    } else if (expectedRank <= Math.ceil(totalTeams * 0.6)) {
      targetLeagueRank = Math.ceil(totalTeams * 0.5);
      leagueTitleEn = `Top-Half Finish (Top ${targetLeagueRank})`;
      leagueTitleVi = `Nửa trên BXH (Top ${targetLeagueRank})`;
      leagueDescEn = `Secure a Top ${targetLeagueRank} finish in ${leagueThemeName}.`;
      leagueDescVi = `Hoàn thành mùa giải trong Top ${targetLeagueRank} tại ${leagueThemeName}.`;
    } else {
      targetLeagueRank = safeCutoff;
      leagueTitleEn = `Maintain League Status (Top ${targetLeagueRank})`;
      leagueTitleVi = `Trụ hạng an toàn (Top ${targetLeagueRank})`;
      leagueDescEn = `Finish #${targetLeagueRank} or above in ${leagueThemeName}.`;
      leagueDescVi = `Kết thúc từ hạng ${targetLeagueRank} trở lên tại ${leagueThemeName}.`;
    }
  }

  let faTargetRound = 4;
  if (leagueMeta.tier === 1 && expectedRank <= 3) faTargetRound = 7;
  else if (leagueMeta.tier === 1 && expectedRank <= 6) faTargetRound = 6;
  else if (leagueMeta.tier === 1 && expectedRank <= 12) faTargetRound = 5;

  const primaryCupId = countryMeta.primaryCupId;
  const primaryCupName = COMPETITION_THEMES[primaryCupId].name;

  if (countryMeta.id === 'ENG') {
    let carabaoTargetRound = 4;
    if (tier === 'PL' && expectedRank <= 3) carabaoTargetRound = 6;
    else if (tier === 'PL' && expectedRank <= 8) carabaoTargetRound = 5;

    const faTitleEn =
      faTargetRound === 7 ? 'Reach the FA Cup Final' : `Reach FA Cup ${cupRoundNameEn(faTargetRound)}`;
    const faTitleVi =
      faTargetRound === 7 ? 'Vào Chung kết FA Cup' : `Vào ${cupRoundNameVi(faTargetRound)} FA Cup`;
    const carabaoTitleEn = `Reach Carabao Cup ${cupRoundNameEn(carabaoTargetRound)}`;
    const carabaoTitleVi = `Vào ${cupRoundNameVi(carabaoTargetRound)} Carabao Cup`;

    return [
      {
        id: `obj_s${seasonIndex}_${tier}_${clubId}`,
        competitionId: tier,
        priority: 'CRITICAL' as ObjectivePriority,
        titleEn: leagueTitleEn,
        titleVi: leagueTitleVi,
        descEn: leagueDescEn,
        descVi: leagueDescVi,
        targetLeagueRank,
        currentProgressEn: `Pre-season · Target: Top ${targetLeagueRank}`,
        currentProgressVi: `Tiền mùa giải · Mục tiêu: Top ${targetLeagueRank}`,
        status: 'IN_PROGRESS',
        onTrack: true,
        boardWeight: 55,
        satisfactionApplied: false,
      },
      {
        id: `obj_s${seasonIndex}_FACUP_${clubId}`,
        competitionId: 'FACUP',
        priority: 'HIGH' as ObjectivePriority,
        titleEn: faTitleEn,
        titleVi: faTitleVi,
        descEn: `Advance at least to the ${cupRoundNameEn(faTargetRound)} stage of the FA Cup.`,
        descVi: `Tiến vào tối thiểu vòng ${cupRoundNameVi(faTargetRound)} tại đấu trường FA Cup.`,
        targetCupRound: faTargetRound,
        currentProgressEn: `Round 3 upcoming · Target: ${cupRoundNameEn(faTargetRound)}`,
        currentProgressVi: `Chờ Vòng 3 · Mục tiêu: ${cupRoundNameVi(faTargetRound)}`,
        status: 'IN_PROGRESS',
        onTrack: true,
        boardWeight: 25,
        satisfactionApplied: false,
      },
      {
        id: `obj_s${seasonIndex}_CARABAO_${clubId}`,
        competitionId: 'CARABAO',
        priority: 'MEDIUM' as ObjectivePriority,
        titleEn: carabaoTitleEn,
        titleVi: carabaoTitleVi,
        descEn: `Advance at least to the ${cupRoundNameEn(carabaoTargetRound)} stage of the Carabao Cup.`,
        descVi: `Tiến vào tối thiểu vòng ${cupRoundNameVi(carabaoTargetRound)} tại Carabao Cup.`,
        targetCupRound: carabaoTargetRound,
        currentProgressEn: `Round 3 upcoming · Target: ${cupRoundNameEn(carabaoTargetRound)}`,
        currentProgressVi: `Chờ Vòng 3 · Mục tiêu: ${cupRoundNameVi(carabaoTargetRound)}`,
        status: 'IN_PROGRESS',
        onTrack: true,
        boardWeight: 20,
        satisfactionApplied: false,
      },
    ];
  }

  return [
    {
      id: `obj_s${seasonIndex}_${tier}_${clubId}`,
      competitionId: tier,
      priority: 'CRITICAL' as ObjectivePriority,
      titleEn: leagueTitleEn,
      titleVi: leagueTitleVi,
      descEn: leagueDescEn,
      descVi: leagueDescVi,
      targetLeagueRank,
      currentProgressEn: `Pre-season · Target: Top ${targetLeagueRank}`,
      currentProgressVi: `Tiền mùa giải · Mục tiêu: Top ${targetLeagueRank}`,
      status: 'IN_PROGRESS',
      onTrack: true,
      boardWeight: 65,
      satisfactionApplied: false,
    },
    {
      id: `obj_s${seasonIndex}_${primaryCupId}_${clubId}`,
      competitionId: primaryCupId,
      priority: 'HIGH' as ObjectivePriority,
      titleEn: `Reach ${primaryCupName} ${cupRoundNameEn(faTargetRound)}`,
      titleVi: `Vào ${cupRoundNameVi(faTargetRound)} ${primaryCupName}`,
      descEn: `Advance at least to the ${cupRoundNameEn(faTargetRound)} of ${primaryCupName}.`,
      descVi: `Tiến vào tối thiểu ${cupRoundNameVi(faTargetRound)} tại ${primaryCupName}.`,
      targetCupRound: faTargetRound,
      currentProgressEn: `Upcoming · Target: ${cupRoundNameEn(faTargetRound)}`,
      currentProgressVi: `Chờ bốc thăm · Mục tiêu: ${cupRoundNameVi(faTargetRound)}`,
      status: 'IN_PROGRESS',
      onTrack: true,
      boardWeight: 35,
      satisfactionApplied: false,
    },
  ];
}

export function evaluateSeasonObjectives(state: CareerState): SeasonObjective[] {
  const userLeagueId = state.userLeagueId ?? 'PL';
  const leagueTeams = getLeagueTeamsFromState(state);
  const baseObjectives =
    state.seasonObjectives && state.seasonObjectives.length > 0
      ? state.seasonObjectives
      : buildSeasonObjectivesForClub(
          state.clubId,
          userLeagueId,
          leagueTeams,
          state.clubs,
          state.seasonIndex ?? 0
        );

  return baseObjectives.map((obj) => {
    if (obj.competitionId === userLeagueId || obj.targetLeagueRank !== undefined) {
      const targetRank = obj.targetLeagueRank ?? 10;
      const standings = state.contextStandings[userLeagueId] ?? [];
      const rankIdx = standings.findIndex((r) => r.clubId === state.clubId);
      const rank = rankIdx >= 0 ? rankIdx + 1 : standings.length || 1;
      const row = rankIdx >= 0 ? standings[rankIdx] : undefined;
      const played = row?.played ?? 0;
      const pts = row?.points ?? 0;
      const totalMatches =
        state.fixtures.filter((f) => f.homeClubId === state.clubId || f.awayClubId === state.clubId)
          .length || getTotalRoundsForLeague(userLeagueId);
      const allLeaguePlayed = state.fixtures.length > 0 && state.fixtures.every((f) => f.played);
      const onTrack = played === 0 ? true : rank <= targetRank;
      const status: ObjectiveStatus = allLeaguePlayed
        ? rank <= targetRank
          ? 'COMPLETED'
          : 'FAILED'
        : 'IN_PROGRESS';

      const currentProgressEn =
        played === 0
          ? `Season not started · Target: Top ${targetRank}`
          : allLeaguePlayed
          ? `Finished #${rank} (${pts} pts) · Target: Top ${targetRank}`
          : `Currently #${rank} (${pts} pts · ${played}/${totalMatches} MP) · Target: Top ${targetRank}`;
      const currentProgressVi =
        played === 0
          ? `Chưa khởi tranh · Mục tiêu: Top ${targetRank}`
          : allLeaguePlayed
          ? `Kết thúc hạng #${rank} (${pts} điểm) · Mục tiêu: Top ${targetRank}`
          : `Hiện tại #${rank} (${pts} điểm · ${played}/${totalMatches} trận) · Mục tiêu: Top ${targetRank}`;

      return {
        ...obj,
        status,
        onTrack,
        currentProgressEn,
        currentProgressVi,
      };
    }

    const cupFixtures = (state.contextFixtures[obj.competitionId] ?? []).filter(
      (f) => f.homeClubId === state.clubId || f.awayClubId === state.clubId
    );
    const targetRound = obj.targetCupRound ?? 4;

    if (cupFixtures.length === 0) {
      return {
        ...obj,
        status: 'IN_PROGRESS' as ObjectiveStatus,
        onTrack: true,
        currentProgressEn: 'Not participating in this cup this season',
        currentProgressVi: 'CLB không tham dự giải cúp này trong mùa',
      };
    }

    const maxRound = Math.max(...cupFixtures.map((f) => f.round));
    const wonFinal = cupFixtures.some(
      (f) => f.round === 7 && f.played && getCupFixtureWinnerId(f) === state.clubId
    );
    const wonRounds = cupFixtures
      .filter((f) => f.played && getCupFixtureWinnerId(f) === state.clubId)
      .map((f) => f.round);
    const highestWonRound = wonRounds.length > 0 ? Math.max(...wonRounds) : 0;
    const eliminatedMatch = cupFixtures.find((f) => {
      const winner = getCupFixtureWinnerId(f);
      return f.played && winner !== null && winner !== state.clubId;
    });

    const reachedRound = wonFinal
      ? 8
      : Math.max(maxRound, highestWonRound > 0 && highestWonRound < 7 ? highestWonRound + 1 : 0);

    if (reachedRound >= targetRound) {
      const stageLabelEn = wonFinal ? 'Champions!' : cupRoundNameEn(Math.min(7, reachedRound));
      const stageLabelVi = wonFinal ? 'Vô địch!' : cupRoundNameVi(Math.min(7, reachedRound));
      return {
        ...obj,
        status: 'COMPLETED' as ObjectiveStatus,
        onTrack: true,
        currentProgressEn: wonFinal
          ? `Won the trophy! (Target: ${cupRoundNameEn(targetRound)})`
          : `Reached ${stageLabelEn} · Target achieved`,
        currentProgressVi: wonFinal
          ? `Đã vô địch! (Mục tiêu: ${cupRoundNameVi(targetRound)})`
          : `Đã tiến vào ${stageLabelVi} · Đạt mục tiêu`,
      };
    }

    if (eliminatedMatch) {
      return {
        ...obj,
        status: 'FAILED' as ObjectiveStatus,
        onTrack: false,
        currentProgressEn: `Eliminated in ${cupRoundNameEn(eliminatedMatch.round)} · Target: ${cupRoundNameEn(targetRound)}`,
        currentProgressVi: `Bị loại ở ${cupRoundNameVi(eliminatedMatch.round)} · Mục tiêu: ${cupRoundNameVi(targetRound)}`,
      };
    }

    const activeMatch = cupFixtures.find((f) => !f.played);
    const curRound = activeMatch?.round ?? maxRound;
    return {
      ...obj,
      status: 'IN_PROGRESS' as ObjectiveStatus,
      onTrack: true,
      currentProgressEn: `Active in ${cupRoundNameEn(curRound)} · Target: ${cupRoundNameEn(targetRound)}`,
      currentProgressVi: `Đang thi đấu ${cupRoundNameVi(curRound)} · Mục tiêu: ${cupRoundNameVi(targetRound)}`,
    };
  });
}

export function createInitialCareer(
  coach: CoachProfile,
  clubId: string,
  leagueId: CompetitionId = 'PL'
): CareerState {
  const detectedLeague =
    isDomesticLeagueId(leagueId)
      ? leagueId
      : findDomesticLeagueForClubId(clubId) ?? 'PL';
  const userLeague: DomesticLeagueId = detectedLeague;
  const userCountry = getCountryForLeague(userLeague);
  const coachFullName =
    `${coach.firstName} ${coach.lastName}`.trim() || coach.nickname || 'Manager';

  const rawUserLeagueClubs = buildWorldClubsForLeague(userLeague);
  const rawSelectedClub =
    rawUserLeagueClubs.find((c) => c.id === clubId) ?? rawUserLeagueClubs[0];
  const applyUserManager = (c: Club): Club =>
    c.id === rawSelectedClub.id ? { ...c, managerName: coachFullName } : c;
  const userLeagueClubs = rawUserLeagueClubs.map(applyUserManager);

  // Keep state.clubs lean; in England keep PL clubs hydrated too when managing EFL
  const clubs =
    userCountry.id === 'ENG' && userLeague !== 'PL'
      ? [...buildPremierLeagueClubs().map(applyUserManager), ...userLeagueClubs]
      : userLeagueClubs;

  const leagueTeams = buildAllInitialLeagueTeams();
  leagueTeams[userLeague] = userLeagueClubs.map(clubToContextTeam);

  const selectedClub =
    userLeagueClubs.find((c) => c.id === clubId) ?? userLeagueClubs[0];
  const cycles = 1;
  const fixtures = generateDoubleRoundRobinFixtures(userLeagueClubs, userLeague, cycles, 2026);

  const uefaSeeds = getInitialUefaSeeds();
  const cupData = buildCupFixtures(
    clubs,
    leagueTeams,
    userLeague,
    selectedClub.id,
    2026,
    undefined,
    uefaSeeds
  );

  // User calendar includes domestic league + user's country cups + Super Cups + UEFA matches
  const calendarCupFixtures: Fixture[] = [];
  if (userCountry.id === 'ENG') {
    calendarCupFixtures.push(
      ...(cupData.CARABAO?.fixtures ?? []),
      ...(cupData.FACUP?.fixtures ?? [])
    );
  } else {
    calendarCupFixtures.push(...(cupData[userCountry.primaryCupId]?.fixtures ?? []));
  }
  if (userCountry.id === 'ESP') {
    calendarCupFixtures.push(...(cupData.SUPERCOPA?.fixtures ?? []));
  }
  calendarCupFixtures.push(...(cupData.UEFASUPERCUP?.fixtures ?? []));
  (['UCL', 'UEL', 'UECL'] as UefaCompId[]).forEach((uId) => {
    calendarCupFixtures.push(...(cupData[uId]?.fixtures ?? []));
  });

  const calendar = buildCalendarForUserClub(
    selectedClub.id,
    fixtures,
    calendarCupFixtures,
    2026
  );

  const transferTargets: TransferTarget[] = [];
  for (const c of clubs) {
    if (c.id === selectedClub.id) continue;
    for (const p of c.players) {
      transferTargets.push({
        playerId: p.id,
        clubId: c.id,
        scoutStatus: 'UNSCOUTED',
        scoutDaysRemaining: 0,
        shortlisted: false,
        negotiationStatus: 'NONE',
        sellerSatisfaction: 65,
      });
    }
  }

  const contextStandings = Object.fromEntries(
    ALL_COMPETITION_IDS.map((cid) => [cid, [] as StandingRow[]])
  ) as Record<CompetitionId, StandingRow[]>;
  const contextFixtures = Object.fromEntries(
    ALL_COMPETITION_IDS.map((cid) => [cid, [] as Fixture[]])
  ) as Record<CompetitionId, Fixture[]>;
  for (const [cid, payload] of Object.entries(cupData) as [CompetitionId, { standings: StandingRow[]; fixtures: Fixture[] }][]) {
    contextStandings[cid] = payload.standings;
    contextFixtures[cid] = payload.fixtures;
  }
  contextStandings[userLeague] = computeStandings(userLeagueClubs, fixtures);
  contextFixtures[userLeague] = [];

  const openingDate = calendar[0]?.dateIso ?? '2026-07-01';
  const managerContract = buildDefaultManagerContract(userLeague, openingDate, 2026, selectedClub);
  const clubManagers = buildInitialClubManagers(
    clubs,
    leagueTeams,
    selectedClub.id,
    coachFullName,
    2026
  );
  const seasonObjectives = buildSeasonObjectivesForClub(
    selectedClub.id,
    userLeague,
    leagueTeams,
    clubs,
    0
  );

  const baseState: CareerState = {
    version: 2,
    seasonIndex: 0,
    seasonLabel: '2026/27',
    coach,
    clubId: selectedClub.id,
    countryId: userCountry.id,
    userLeagueId: userLeague,
    boardSatisfaction: 72,
    seasonObjectives,
    currentDayIndex: 0,
    currentRound: 1,
    calendar,
    clubs,
    leagueTeams,
    uefaParticipants: uefaSeeds,
    fixtures,
    contextStandings,
    contextFixtures,
    transferTargets,
    academy: generateFakeAcademySquad(selectedClub.id),
    financeLedger: [
      {
        id: 'fin_open',
        dateIso: openingDate,
        type: 'INCOME',
        category: 'OPENING_BUDGET',
        description: `Opening Board Transfer & Wage Allocation (${selectedClub.name})`,
        amount: selectedClub.openingBudget,
      },
    ],
    openingBudget: selectedClub.openingBudget,
    budget: selectedClub.openingBudget,
    careerTrophies: [],
    pendingSeasonSummary: null,
    seasonHistory: [],
    notifications: [],
    incomingBids: [],
    matchdayOverride: null,
    deadlineHoursRemaining: calendar[0]?.isDeadlineDay ? 24 : null,
    managerContract,
    clubManagers,
    settings: {
      language: 'en',
      soundEnabled: true,
      spotifyPlaylistIndex: 0,
      autoAdvanceStopOn: {
        TRANSFER_BID: true,
        LOAN_BID: true,
        INJURY: true,
        SUSPENSION: true,
        CONTRACT: true,
        BOARD: true,
      },
    },
  };

  const synced = syncParallelCompetitions(baseState, openingDate);
  const initializedState: CareerState = {
    ...baseState,
    ...synced,
  };
  return {
    ...initializedState,
    seasonObjectives: evaluateSeasonObjectives(initializedState),
  };
}

export function computeStandings(clubs: Club[], fixtures: Fixture[]): StandingRow[] {
  const map = new Map<string, StandingRow>();
  for (const c of clubs) {
    map.set(c.id, {
      clubId: c.id,
      clubName: c.name,
      shortName: c.shortName,
      primaryColor: c.primaryColor,
      secondaryColor: c.secondaryColor,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      form: [],
    });
  }

  for (const f of fixtures) {
    if (!f.played || f.homeGoals === undefined || f.awayGoals === undefined) continue;
    const h = map.get(f.homeClubId);
    const a = map.get(f.awayClubId);
    if (!h || !a) continue;

    h.played++;
    a.played++;
    h.goalsFor += f.homeGoals;
    h.goalsAgainst += f.awayGoals;
    a.goalsFor += f.awayGoals;
    a.goalsAgainst += f.homeGoals;

    if (f.homeGoals > f.awayGoals) {
      h.won++;
      h.points += 3;
      h.form.push('W');
      a.lost++;
      a.form.push('L');
    } else if (f.homeGoals < f.awayGoals) {
      a.won++;
      a.points += 3;
      a.form.push('W');
      h.lost++;
      h.form.push('L');
    } else {
      h.drawn++;
      a.drawn++;
      h.points += 1;
      a.points += 1;
      h.form.push('D');
      a.form.push('D');
    }
  }

  const rows = Array.from(map.values()).map((r) => ({
    ...r,
    goalDifference: r.goalsFor - r.goalsAgainst,
    form: r.form.slice(-5),
  }));

  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.clubName.localeCompare(b.clubName);
  });

  return rows;
}

export function applyMatchdayOverrideToClub(
  club: Club,
  override?: MatchdayLineupOverride | null,
  fixtureId?: string
): Club {
  if (!override) return club;
  if (fixtureId && override.fixtureId !== fixtureId) return club;
  return {
    ...club,
    formation: override.formation,
    startingIds: [...override.startingIds],
    benchIds: [...override.benchIds],
    tactics: { ...override.tactics },
    slotRoles: override.slotRoles ? { ...override.slotRoles } : club.slotRoles,
    teamRoles: override.teamRoles ? { ...override.teamRoles } : club.teamRoles,
  };
}

export function validateStartingXI(club: Club, startingIds: string[]): {
  valid: boolean;
  suspendedPlayers: Player[];
  injuredPlayers: Player[];
  loanedOutPlayers: Player[];
  missingCount: number;
} {
  const starterSet = new Set(startingIds);
  const starters = club.players.filter((p) => starterSet.has(p.id));
  const suspendedPlayers = starters.filter((p) => p.suspendedMatches > 0);
  const injuredPlayers = starters.filter((p) => (p.injuredMatches ?? 0) > 0);
  const loanedOutPlayers = starters.filter((p) => p.loanInfo?.direction === 'OUT');
  return {
    valid:
      starters.length === 11 &&
      suspendedPlayers.length === 0 &&
      injuredPlayers.length === 0 &&
      loanedOutPlayers.length === 0,
    suspendedPlayers,
    injuredPlayers,
    loanedOutPlayers,
    missingCount: Math.max(0, 11 - starters.length),
  };
}

export function autoReplaceUnavailableStarters(club: Club): {
  nextStartingIds: string[];
  nextBenchIds: string[];
  replacedCount: number;
  replacements: { slotLabel: string; outPlayer: Player | null; inPlayer: Player }[];
} {
  const slots = FORMATION_SLOTS[club.formation] ?? FORMATION_SLOTS['4-3-3'];
  const playerMap = new Map(club.players.map((p) => [p.id, p]));
  const isHealthyAvailable = (p: Player | undefined): p is Player =>
    Boolean(
      p &&
        p.suspendedMatches === 0 &&
        (p.injuredMatches ?? 0) === 0 &&
        isPlayerAvailableForMatchday(p)
    );

  const nextStarting = club.startingIds.slice(0, 11);
  let nextBench = club.benchIds.filter((id) => !nextStarting.includes(id));
  const usedInStarting = new Set<string>();
  const badIndices: number[] = [];

  for (let idx = 0; idx < 11; idx++) {
    const id = nextStarting[idx];
    const p = id ? playerMap.get(id) : undefined;
    if (!id || !isHealthyAvailable(p) || usedInStarting.has(id)) {
      badIndices.push(idx);
    } else {
      usedInStarting.add(id);
    }
  }

  const replacements: { slotLabel: string; outPlayer: Player | null; inPlayer: Player }[] = [];
  const displacedUnavailableIds: string[] = [];

  for (const idx of badIndices) {
    const slot = slots[idx] ?? slots[slots.length - 1];
    const outId = nextStarting[idx];
    const outPlayer = outId ? playerMap.get(outId) ?? null : null;
    if (outId && outPlayer) displacedUnavailableIds.push(outId);

    const benchCandidates = nextBench
      .map((bid) => playerMap.get(bid))
      .filter((p): p is Player => Boolean(isHealthyAvailable(p) && !usedInStarting.has(p.id)));
    const reserveCandidates = club.players.filter(
      (p) => isHealthyAvailable(p) && !usedInStarting.has(p.id) && !nextBench.includes(p.id)
    );
    const pool = [...benchCandidates, ...reserveCandidates];
    if (pool.length === 0) continue;

    pool.sort((a, b) => {
      const benchBoostA = nextBench.includes(a.id) ? 0.5 : 0;
      const benchBoostB = nextBench.includes(b.id) ? 0.5 : 0;
      const scoreA =
        getPlayerSlotEvaluation(a, slot.label).effectiveOvr + a.fitness * 0.04 + benchBoostA;
      const scoreB =
        getPlayerSlotEvaluation(b, slot.label).effectiveOvr + b.fitness * 0.04 + benchBoostB;
      return scoreB - scoreA;
    });

    const chosen = pool[0];
    nextStarting[idx] = chosen.id;
    usedInStarting.add(chosen.id);
    nextBench = nextBench.filter((id) => id !== chosen.id);
    replacements.push({
      slotLabel: slot.label,
      outPlayer,
      inPlayer: chosen,
    });
  }

  // Ensure bench contains healthy candidates first, up to BENCH_SIZE
  const nextBenchSet = new Set(nextBench);
  for (const p of club.players) {
    if (nextBench.length >= BENCH_SIZE) break;
    if (isHealthyAvailable(p) && !usedInStarting.has(p.id) && !nextBenchSet.has(p.id)) {
      nextBench.push(p.id);
      nextBenchSet.add(p.id);
    }
  }
  for (const dId of displacedUnavailableIds) {
    if (nextBench.length >= BENCH_SIZE) break;
    if (!usedInStarting.has(dId) && !nextBenchSet.has(dId)) {
      nextBench.push(dId);
      nextBenchSet.add(dId);
    }
  }

  return {
    nextStartingIds: nextStarting.slice(0, 11),
    nextBenchIds: nextBench.slice(0, BENCH_SIZE),
    replacedCount: replacements.length,
    replacements,
  };
}

function getOrderedStartersWithSlots(club: Club): { player: Player; slotIndex: number; label: string; slotPos: Position; detailedPos: DetailedPosition }[] {
  const slots = FORMATION_SLOTS[club.formation] ?? FORMATION_SLOTS['4-2-3-1'];
  const playerById = new Map(club.players.map((p) => [p.id, p]));
  const result: { player: Player; slotIndex: number; label: string; slotPos: Position; detailedPos: DetailedPosition }[] = [];
  const used = new Set<string>();

  club.startingIds.slice(0, 11).forEach((id, idx) => {
    const p = playerById.get(id);
    const slot = slots[idx] ?? slots[slots.length - 1];
    if (p) {
      used.add(p.id);
      result.push({
        player: p,
        slotIndex: idx,
        label: slot.label,
        slotPos: slot.position,
        detailedPos: slot.detailedPosition,
      });
    }
  });

  if (result.length < 11) {
    for (const p of club.players) {
      if (used.has(p.id) || p.loanInfo?.direction === 'OUT') continue;
      const idx = result.length;
      const slot = slots[idx] ?? slots[slots.length - 1];
      used.add(p.id);
      result.push({
        player: p,
        slotIndex: idx,
        label: slot.label,
        slotPos: slot.position,
        detailedPos: slot.detailedPosition,
      });
      if (result.length >= 11) break;
    }
  }
  return result;
}

function getTeamStrength(club: Club): {
  attack: number;
  midfield: number;
  defense: number;
  gk: number;
  fitnessAvg: number;
  tacticalBonus: number;
} {
  const ordered = getOrderedStartersWithSlots(club);
  const starterSet = new Set(ordered.map((x) => x.player.id));

  const weighted = ordered.map(({ player, slotIndex, label, slotPos }) => {
    const evalRes = getPlayerSlotEvaluation(player, label);
    const assignedRole = club.slotRoles?.[slotIndex] ?? player.role;
    const mastery = getPlayerRoleMastery(player, assignedRole);
    const masteryBoost = mastery === 'Role++' ? 1.15 : mastery === 'Role+' ? 0.5 : 0;
    const effWithFit = evalRes.effectiveOvr * (0.8 + (player.fitness / 100) * 0.2) + masteryBoost;
    return { player, slotPos, effectiveOvr: evalRes.effectiveOvr, score: effWithFit, masteryBoost };
  });

  const avgGroup = (pos: Position, fallback: number) => {
    const list = weighted.filter((x) => x.slotPos === pos);
    if (list.length === 0) return fallback;
    return list.reduce((acc, x) => acc + x.score, 0) / list.length;
  };

  const overallAvg =
    weighted.length === 0
      ? 78
      : weighted.reduce((acc, x) => acc + x.score, 0) / weighted.length;

  const gkSlot = weighted.find((x) => x.slotPos === 'GK');
  const gkScore = gkSlot
    ? gkSlot.player.position === 'GK'
      ? gkSlot.player.attributes.goalkeeper + gkSlot.masteryBoost
      : Math.max(40, gkSlot.effectiveOvr - 4)
    : overallAvg - 5;

  const fitnessAvg =
    ordered.length === 0
      ? 85
      : ordered.reduce((acc, x) => acc + x.player.fitness, 0) / ordered.length;

  let tacticalBonus = 0;
  if (club.tactics.preset === 'Gegenpress' && fitnessAvg > 82) tacticalBonus += 1.4;
  if (club.tactics.preset === 'Tiki-Taka') tacticalBonus += 1.1;
  if (club.tactics.defensiveApproach === 'High Press' && club.tactics.defensiveLine >= 7) tacticalBonus += 0.6;
  if (club.tactics.playersInBox >= 7) tacticalBonus += 0.5;
  if (club.teamRoles?.captainId && starterSet.has(club.teamRoles.captainId)) {
    tacticalBonus += 0.45;
  }

  return {
    attack: avgGroup('FWD', overallAvg),
    midfield: avgGroup('MID', overallAvg),
    defense: avgGroup('DEF', overallAvg),
    gk: gkScore,
    fitnessAvg,
    tacticalBonus,
  };
}

export function simulateMatch(
  homeClub: Club,
  awayClub: Club,
  fixture: Fixture,
  seedOffset = 1
): MatchReport {
  const seed =
    homeClub.id.charCodeAt(0) * 313 +
    awayClub.id.charCodeAt(0) * 197 +
    fixture.round * 71 +
    seedOffset * 17;
  const rand = seededRandom(seed);

  const homeStr = getTeamStrength(homeClub);
  const awayStr = getTeamStrength(awayClub);

  const homeOrdered = getOrderedStartersWithSlots(homeClub);
  const awayOrdered = getOrderedStartersWithSlots(awayClub);
  const homeStarters = homeOrdered.map((x) => x.player);
  const awayStarters = awayOrdered.map((x) => x.player);

  const resolveBenchList = (club: Club, starterIds: Set<string>): Player[] => {
    const out: Player[] = [];
    const used = new Set(starterIds);
    for (const bid of club.benchIds) {
      const p = club.players.find((x) => x.id === bid);
      if (p && !used.has(p.id) && p.loanInfo?.direction !== 'OUT') {
        used.add(p.id);
        out.push(p);
      }
    }
    return out;
  };

  const homeBench = resolveBenchList(homeClub, new Set(homeStarters.map((p) => p.id)));
  const awayBench = resolveBenchList(awayClub, new Set(awayStarters.map((p) => p.id)));

  const homeActive: Player[] = [...homeStarters];
  const awayActive: Player[] = [...awayStarters];
  const subbedOffMinute = new Map<string, number>();
  const subbedOnInfo = new Map<
    string,
    { minute: number; replacedSlotIndex: number; replacedLabel: string; replacedDetailedPos: DetailedPosition }
  >();
  const homeUsedBench = new Set<string>();
  const awayUsedBench = new Set<string>();

  const subScheduleMinutes = [58, 64, 70, 76, 82];
  const homeSubCount = Math.min(
    homeBench.filter((p) => p.position !== 'GK' && isPlayerAvailableForMatchday(p)).length || homeBench.length,
    3 + Math.floor(rand() * 3)
  );
  const awaySubCount = Math.min(
    awayBench.filter((p) => p.position !== 'GK' && isPlayerAvailableForMatchday(p)).length || awayBench.length,
    3 + Math.floor(rand() * 3)
  );
  const homeSubTicks = new Set(subScheduleMinutes.slice(0, homeSubCount));
  const awaySubTicks = new Set(subScheduleMinutes.slice(0, awaySubCount));

  let homePlayersOnPitch = homeStarters.length;
  let awayPlayersOnPitch = awayStarters.length;

  let homeGoals = 0;
  let awayGoals = 0;
  let homeShots = 0;
  let awayShots = 0;
  let homeShotsOnTarget = 0;
  let awayShotsOnTarget = 0;
  let homeFouls = 0;
  let awayFouls = 0;
  let homeYellows = 0;
  let awayYellows = 0;
  let homeReds = 0;
  let awayReds = 0;
  let homeOffsides = 0;
  let awayOffsides = 0;
  let homeCorners = 0;
  let awayCorners = 0;

  const events: MatchEvent[] = [];
  const playerGoals = new Map<string, number>();
  const playerAssists = new Map<string, number>();
  const playerYellows = new Map<string, number>();
  const playerReds = new Set<string>();

  const pickPlayer = (pool: Player[], weights: (p: Player) => number): Player => {
    const eligible = pool.filter((p) => !playerReds.has(p.id));
    const list = eligible.length > 0 ? eligible : pool;
    const total = list.reduce((acc, p) => acc + Math.max(1, weights(p)), 0);
    let r = rand() * total;
    for (const p of list) {
      r -= Math.max(1, weights(p));
      if (r <= 0) return p;
    }
    return list[0];
  };

  const performTeamSub = (
    club: Club,
    side: 'HOME' | 'AWAY',
    minute: number,
    activePool: Player[],
    benchPool: Player[],
    usedBench: Set<string>,
    orderedStarters: { player: Player; slotIndex: number; label: string; detailedPos: DetailedPosition }[],
    isTrailing: boolean
  ) => {
    const availBench = benchPool.filter(
      (p) => !usedBench.has(p.id) && p.position !== 'GK' && isPlayerAvailableForMatchday(p)
    );
    const fallbackBench =
      availBench.length > 0
        ? availBench
        : benchPool.filter((p) => !usedBench.has(p.id) && isPlayerAvailableForMatchday(p));
    if (fallbackBench.length === 0) return;

    const activeStarterCandidates = orderedStarters.filter(
      (entry) =>
        activePool.some((ap) => ap.id === entry.player.id) &&
        !playerReds.has(entry.player.id) &&
        entry.player.position !== 'GK'
    );
    if (activeStarterCandidates.length === 0) return;

    // Prioritize replacing yellow-carded or low-fitness starters
    const targetToSubOff =
      [...activeStarterCandidates].sort((a, b) => {
        const aRisk = ((playerYellows.get(a.player.id) ?? 0) > 0 && minute >= 58 ? 22 : 0) + (100 - a.player.fitness);
        const bRisk = ((playerYellows.get(b.player.id) ?? 0) > 0 && minute >= 58 ? 22 : 0) + (100 - b.player.fitness);
        return bRisk - aRisk;
      })[0] ?? activeStarterCandidates[0];

    const attackingPool = isTrailing && minute >= 65
      ? fallbackBench.filter((p) => p.position === 'FWD' || p.position === 'MID')
      : [];
    const samePosBench = fallbackBench.filter((p) => p.position === targetToSubOff.player.position);
    const candidateBench = attackingPool.length > 0 ? attackingPool : samePosBench.length > 0 ? samePosBench : fallbackBench;
    const sortedSubPool = [...candidateBench].sort((a, b) => b.ovr - a.ovr);
    const subOn = sortedSubPool[Math.floor(rand() * Math.min(2, sortedSubPool.length))];

    usedBench.add(subOn.id);
    subbedOffMinute.set(targetToSubOff.player.id, minute);
    subbedOnInfo.set(subOn.id, {
      minute,
      replacedSlotIndex: targetToSubOff.slotIndex,
      replacedLabel: targetToSubOff.label,
      replacedDetailedPos: targetToSubOff.detailedPos,
    });

    const poolIdx = activePool.findIndex((ap) => ap.id === targetToSubOff.player.id);
    if (poolIdx >= 0) {
      activePool[poolIdx] = subOn;
    }

    events.push({
      id: `ev_${fixture.id}_${minute}_${side === 'HOME' ? 'hsub' : 'asub'}_${subOn.id}`,
      minute,
      type: 'SUB',
      teamSide: side,
      playerId: subOn.id,
      playerName: subOn.name,
      assistPlayerId: targetToSubOff.player.id,
      assistPlayerName: targetToSubOff.player.name,
      description: `${club.shortName}: ${subOn.name} replaces ${targetToSubOff.player.name}.`,
    });
  };

  const homeRoles = homeClub.teamRoles ?? deriveDefaultTeamRoles(homeClub.players);
  const awayRoles = awayClub.teamRoles ?? deriveDefaultTeamRoles(awayClub.players);
  const homeGk = homeStarters.find((p) => p.position === 'GK');
  const awayGk = awayStarters.find((p) => p.position === 'GK');
  const avgFwdPace = (pool: Player[]) => {
    const fwds = pool.filter((p) => p.position === 'FWD');
    return fwds.length === 0 ? 78 : fwds.reduce((s, p) => s + p.attributes.pace, 0) / fwds.length;
  };

  const resolveSimAttack = (side: 'HOME' | 'AWAY', minute: number, edge: number, cornerBoost: number, offsideBoost: number) => {
    const isHome = side === 'HOME';
    const attPool = isHome ? homeActive : awayActive;
    const attClub = isHome ? homeClub : awayClub;
    const attRoles = isHome ? homeRoles : awayRoles;
    const oppGk = isHome ? awayGk : homeGk;
    const isPenalty = rand() < 0.055;

    if (isHome) {
      homeShots++;
      if (!isPenalty && rand() < 0.32 + cornerBoost) homeCorners++;
      if (!isPenalty && rand() < 0.12 + offsideBoost) homeOffsides++;
    } else {
      awayShots++;
      if (!isPenalty && rand() < 0.32 + cornerBoost) awayCorners++;
      if (!isPenalty && rand() < 0.12 + offsideBoost) awayOffsides++;
    }

    const penTaker =
      isPenalty && attRoles.penaltyId
        ? attPool.find((p) => p.id === attRoles.penaltyId && !playerReds.has(p.id))
        : undefined;
    const shooter =
      penTaker ??
      pickPlayer(attPool, (p) =>
        computePlayerScoreWeight(p, p.detailedPosition ?? p.position, attRoles, attClub.tactics, p.fitness, subbedOnInfo.has(p.id))
      );

    const duel = resolveShotAndGoalDuel(shooter, oppGk, edge, isPenalty, rand);
    if (!duel.onTarget) return;

    if (isHome) homeShotsOnTarget++;
    else awayShotsOnTarget++;

    if (!duel.goal) return;

    if (isHome) homeGoals++;
    else awayGoals++;
    playerGoals.set(shooter.id, (playerGoals.get(shooter.id) ?? 0) + 1);
    const assister = isPenalty
      ? undefined
      : pickPlayer(
          attPool.filter((p) => p.id !== shooter.id),
          (p) => computePlayerAssistWeight(p, p.detailedPosition ?? p.position, attRoles, attClub.tactics)
        );
    if (assister) {
      playerAssists.set(assister.id, (playerAssists.get(assister.id) ?? 0) + 1);
    }
    events.push({
      id: `ev_${fixture.id}_${minute}_${isHome ? 'hg' : 'ag'}_${playerGoals.get(shooter.id)}`,
      minute,
      type: 'GOAL',
      teamSide: side,
      playerId: shooter.id,
      playerName: shooter.name,
      assistPlayerId: assister?.id,
      assistPlayerName: assister?.name,
      description: isPenalty
        ? `PENALTY! ${shooter.name} converts from the spot for ${attClub.shortName}!`
        : `${shooter.name} scores for ${attClub.shortName}${assister ? ` (assist: ${assister.name})` : ''}.`,
    });
  };

  // Simulate key tactical intervals across 90 minutes
  for (let minute = 4; minute <= 90; minute += 3) {
    const homeShift = computeTacticalMatchupShift(
      homeClub.tactics,
      awayClub.tactics,
      homeStr.fitnessAvg,
      homeGoals - awayGoals,
      minute,
      avgFwdPace(homeActive)
    );
    const awayShift = computeTacticalMatchupShift(
      awayClub.tactics,
      homeClub.tactics,
      awayStr.fitnessAvg,
      awayGoals - homeGoals,
      minute,
      avgFwdPace(awayActive)
    );

    const homeEdge =
      (homeStr.attack + homeStr.midfield * 0.6 + homeStr.tacticalBonus + 2.2 - (awayStr.defense * 0.8 + awayStr.gk * 0.2)) /
        18 +
      homeShift.edgeDelta +
      (homePlayersOnPitch - awayPlayersOnPitch) * 0.35;
    const awayEdge =
      (awayStr.attack + awayStr.midfield * 0.6 + awayStr.tacticalBonus - (homeStr.defense * 0.8 + homeStr.gk * 0.2)) /
        18 +
      awayShift.edgeDelta +
      (awayPlayersOnPitch - homePlayersOnPitch) * 0.35;

    const roll = rand();
    const homeThreshold = 0.26 + Math.max(-0.08, Math.min(0.13, homeEdge * 0.05));
    const awayThreshold = 0.50 + Math.max(-0.08, Math.min(0.13, awayEdge * 0.05));
    const foulThreshold = 0.71 + (homeShift.foulBoost + awayShift.foulBoost) * 0.5;

    if (roll < homeThreshold) {
      resolveSimAttack('HOME', minute, homeEdge, homeShift.cornerBoost, awayShift.offsideBoost);
    } else if (roll < awayThreshold) {
      resolveSimAttack('AWAY', minute, awayEdge, awayShift.cornerBoost, homeShift.offsideBoost);
    } else if (roll < foulThreshold) {
      const isHomeFoul = rand() < 0.49;
      const pool = isHomeFoul ? homeActive : awayActive;
      if (isHomeFoul) homeFouls++;
      else awayFouls++;

      if (rand() < 0.23) {
        const offender = pickPlayer(pool, (p) =>
          computeFoulOffenderWeight(p, playerYellows.get(p.id) ?? 0)
        );
        const prevY = playerYellows.get(offender.id) ?? 0;
        const isDirectRed = prevY === 0 && rand() < 0.015;
        if (isDirectRed || (prevY >= 1 && rand() < 0.28)) {
          if (isHomeFoul) {
            homeReds++;
            homePlayersOnPitch = Math.max(7, homePlayersOnPitch - 1);
          } else {
            awayReds++;
            awayPlayersOnPitch = Math.max(7, awayPlayersOnPitch - 1);
          }
          playerReds.add(offender.id);
          events.push({
            id: `ev_${fixture.id}_${minute}_${isHomeFoul ? 'hr' : 'ar'}`,
            minute,
            type: 'RED',
            teamSide: isHomeFoul ? 'HOME' : 'AWAY',
            playerId: offender.id,
            playerName: offender.name,
            description: isDirectRed
              ? `${offender.name} receives a straight red card for a reckless challenge.`
              : `${offender.name} receives a second yellow and is sent off.`,
          });
        } else {
          if (isHomeFoul) homeYellows++;
          else awayYellows++;
          playerYellows.set(offender.id, prevY + 1);
          events.push({
            id: `ev_${fixture.id}_${minute}_${isHomeFoul ? 'hy' : 'ay'}`,
            minute,
            type: 'YELLOW',
            teamSide: isHomeFoul ? 'HOME' : 'AWAY',
            playerId: offender.id,
            playerName: offender.name,
            description: `${offender.name} booked for a tactical challenge.`,
          });
        }
      }
    }

    if (homeSubTicks.has(minute)) {
      performTeamSub(homeClub, 'HOME', minute, homeActive, homeBench, homeUsedBench, homeOrdered, homeGoals < awayGoals);
    }
    if (awaySubTicks.has(minute)) {
      performTeamSub(awayClub, 'AWAY', minute, awayActive, awayBench, awayUsedBench, awayOrdered, awayGoals < homeGoals);
    }
  }

  // Ensure shots >= shotsOnTarget >= goals
  homeShotsOnTarget = Math.max(homeShotsOnTarget, homeGoals);
  awayShotsOnTarget = Math.max(awayShotsOnTarget, awayGoals);
  homeShots = Math.max(homeShots, homeShotsOnTarget + 2);
  awayShots = Math.max(awayShots, awayShotsOnTarget + 2);

  const midDiff = homeStr.midfield - awayStr.midfield + (homeClub.tactics.buildUpStyle === 'Short Passing' ? 3 : 0);
  const homePoss = Math.max(32, Math.min(68, Math.round(50 + midDiff * 1.4 + (rand() * 6 - 3))));
  const awayPoss = 100 - homePoss;

  const homePasses = Math.round(homePoss * 9.5 + (homeClub.tactics.buildUpStyle === 'Short Passing' ? 55 : 0));
  const awayPasses = Math.round(awayPoss * 9.5 + (awayClub.tactics.buildUpStyle === 'Short Passing' ? 55 : 0));

  const homeAcc = Math.max(72, Math.min(93, Math.round(80 + (homeStr.midfield - 78) * 0.7)));
  const awayAcc = Math.max(72, Math.min(93, Math.round(80 + (awayStr.midfield - 78) * 0.7)));

  const stats: MatchStats = {
    homeShots,
    awayShots,
    homeShotsOnTarget,
    awayShotsOnTarget,
    homePossession: homePoss,
    awayPossession: awayPoss,
    homePasses,
    awayPasses,
    homePassAccuracy: homeAcc,
    awayPassAccuracy: awayAcc,
    homeFouls: Math.max(homeFouls, 4),
    awayFouls: Math.max(awayFouls, 4),
    homeYellowCards: homeYellows,
    awayYellowCards: awayYellows,
    homeRedCards: homeReds,
    awayRedCards: awayReds,
    homeOffsides,
    awayOffsides,
    homeCorners,
    awayCorners,
  };

  const buildRatings = (
    orderedList: { player: Player; slotIndex: number; label: string; detailedPos: DetailedPosition }[],
    benchList: Player[],
    side: 'HOME' | 'AWAY',
    teamGoalsFor: number,
    teamGoalsAgainst: number
  ): PlayerMatchRating[] => {
    const starterRatings: PlayerMatchRating[] = orderedList.map(({ player: p, slotIndex, label, detailedPos }) => {
      const g = playerGoals.get(p.id) ?? 0;
      const a = playerAssists.get(p.id) ?? 0;
      const y = playerYellows.get(p.id) ?? 0;
      const red = playerReds.has(p.id);
      const offMin = subbedOffMinute.get(p.id);
      const effOvr = getPlayerSlotEvaluation(p, label).effectiveOvr;
      let base = 6.3 + (effOvr - 78) * 0.05 + (rand() * 0.9 - 0.35);
      base += g * 1.15 + a * 0.65 - y * 0.25 - (red ? 1.6 : 0);
      if ((p.position === 'GK' || p.position === 'DEF') && teamGoalsAgainst === 0) base += 0.6;
      if (teamGoalsFor > teamGoalsAgainst) base += 0.35;
      const rating = Math.max(4.5, Math.min(10.0, Math.round(base * 10) / 10));
      return {
        playerId: p.id,
        playerName: p.name,
        position: p.position,
        detailedPosition: p.detailedPosition ?? detailedPos,
        slotIndex,
        teamSide: side,
        rating,
        goals: g,
        assists: a,
        minutesPlayed: offMin ?? (red ? 65 : 90),
        isMvp: false,
        isSub: false,
        didNotPlay: false,
      };
    });

    const benchRatings: PlayerMatchRating[] = benchList.map((p, idx) => {
      const subInfo = subbedOnInfo.get(p.id);
      if (!subInfo) {
        return {
          playerId: p.id,
          playerName: p.name,
          position: p.position,
          detailedPosition: p.detailedPosition,
          slotIndex: 11 + idx,
          teamSide: side,
          rating: null,
          goals: 0,
          assists: 0,
          minutesPlayed: 0,
          isMvp: false,
          isSub: true,
          didNotPlay: true,
        };
      }
      const g = playerGoals.get(p.id) ?? 0;
      const a = playerAssists.get(p.id) ?? 0;
      const y = playerYellows.get(p.id) ?? 0;
      const red = playerReds.has(p.id);
      const effOvr = getPlayerSlotEvaluation(p, subInfo.replacedLabel).effectiveOvr;
      let base = 6.1 + (effOvr - 78) * 0.04 + (rand() * 0.8 - 0.25);
      base += g * 1.2 + a * 0.7 - y * 0.25 - (red ? 1.6 : 0);
      if (teamGoalsFor > teamGoalsAgainst) base += 0.25;
      const rating = Math.max(4.5, Math.min(10.0, Math.round(base * 10) / 10));
      return {
        playerId: p.id,
        playerName: p.name,
        position: p.position,
        detailedPosition: p.detailedPosition ?? subInfo.replacedDetailedPos,
        slotIndex: 11 + idx,
        teamSide: side,
        rating,
        goals: g,
        assists: a,
        minutesPlayed: Math.max(4, 90 - subInfo.minute),
        isMvp: false,
        isSub: true,
        subMinute: subInfo.minute,
        didNotPlay: false,
      };
    });

    return [...starterRatings, ...benchRatings];
  };

  const ratings = [
    ...buildRatings(homeOrdered, homeBench, 'HOME', homeGoals, awayGoals),
    ...buildRatings(awayOrdered, awayBench, 'AWAY', awayGoals, homeGoals),
  ];

  // Mark highest rated player who played as MVP
  let mvpIdx = -1;
  for (let i = 0; i < ratings.length; i++) {
    const cur = ratings[i].rating;
    if (cur === null) continue;
    if (mvpIdx === -1 || cur > (ratings[mvpIdx].rating ?? -1)) {
      mvpIdx = i;
    }
  }
  if (mvpIdx >= 0 && ratings[mvpIdx]) {
    ratings[mvpIdx] = { ...ratings[mvpIdx], isMvp: true };
  }

  return {
    fixtureId: fixture.id,
    competitionId: fixture.competitionId,
    round: fixture.round,
    homeClubId: homeClub.id,
    awayClubId: awayClub.id,
    homeGoals,
    awayGoals,
    events: events.sort((a, b) => a.minute - b.minute),
    stats,
    ratings: ratings.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1)),
  };
}

const INJURY_NOTES = [
  'Hamstring strain',
  'Ankle sprain',
  'Calf tightness',
  'Groin knock',
  'Knee bruise',
];

export function computePaidNow(
  fee: number,
  offerOrInstallments: number | Pick<TransferOffer, 'installments' | 'upfrontPct' | 'installmentSeasons'>
): number {
  if (typeof offerOrInstallments === 'number') {
    const upfrontRatio =
      offerOrInstallments === 0
        ? 1
        : offerOrInstallments === 12
        ? 0.55
        : offerOrInstallments === 24
        ? 0.4
        : 0.3;
    return Math.round(fee * upfrontRatio);
  }
  if (typeof offerOrInstallments.upfrontPct === 'number') {
    const pct = Math.max(0, Math.min(100, offerOrInstallments.upfrontPct));
    return Math.round((fee * pct) / 100);
  }
  return computePaidNow(fee, offerOrInstallments.installments ?? 0);
}

export function getScoutDurationDays(player: Player, _club?: Club): number {
  let seed = 0;
  for (let i = 0; i < player.id.length; i++) {
    seed = (seed * 31 + player.id.charCodeAt(i)) % 997;
  }
  if (player.ovr >= 86) return 3 + (seed % 3); // 3..5 days
  if (player.ovr >= 78) return 2 + (seed % 3); // 2..4 days
  return 1 + (seed % 2); // 1..2 days
}

export function getRejectionCooldownUntil(currentDateIso: string, isDeadlineDay = false): string {
  return addDaysIso(currentDateIso, isDeadlineDay ? 2 : 10);
}

function createIncomingBidIfEligible(
  clubs: Club[],
  userClub: Club,
  existingBids: IncomingTransferBid[],
  dateIso: string,
  seed: number,
  maxPending = 3
): { bid: IncomingTransferBid; notification: ManagerNotification } | null {
  const pendingBids = existingBids.filter((b) => b.status === 'PENDING');
  if (pendingBids.length >= maxPending) return null;

  const rand = seededRandom(seed);
  const pendingPlayerIds = new Set(pendingBids.map((b) => b.playerId));
  const eligibleOwned = userClub.players.filter((p) => !p.loanInfo);
  const gkCount = eligibleOwned.filter((p) => p.position === 'GK').length;

  const candidates = eligibleOwned.filter(
    (p) =>
      !pendingPlayerIds.has(p.id) &&
      (p.position !== 'GK' || gkCount > 1) &&
      eligibleOwned.length > 16
  );
  if (candidates.length === 0) return null;

  const loanCandidates = candidates.filter((p) => p.forLoan || p.age <= 22);
  const wantLoan =
    loanCandidates.length > 0 &&
    (candidates.some((p) => p.forLoan) ? rand() < 0.62 : rand() < 0.25);

  const selectionPoolSource = wantLoan
    ? [...loanCandidates].sort((a, b) => {
        const sA = (a.forLoan ? 40 : 0) + (a.age <= 22 ? 15 : 0) + (90 - a.ovr);
        const sB = (b.forLoan ? 40 : 0) + (b.age <= 22 ? 15 : 0) + (90 - b.ovr);
        return sB - sA;
      })
    : [...candidates].sort((a, b) => {
        const scoreA = (a.forSale ? 25 : 0) + a.ovr + (a.age <= 24 ? 6 : 0) + a.goals * 2;
        const scoreB = (b.forSale ? 25 : 0) + b.ovr + (b.age <= 24 ? 6 : 0) + b.goals * 2;
        return scoreB - scoreA;
      });

  const pool = selectionPoolSource.slice(0, Math.min(6, selectionPoolSource.length));
  const target = pool[Math.floor(rand() * pool.length)];

  if (wantLoan) {
    const loanBuyers = clubs.filter((c) => c.id !== userClub.id);
    if (loanBuyers.length === 0) return null;
    const buyer = loanBuyers[Math.floor(rand() * loanBuyers.length)];
    const durations: (0.5 | 1 | 2)[] = [0.5, 1, 1, 2];
    const duration = durations[Math.floor(rand() * durations.length)];
    const wageSplit = 50 + Math.floor(rand() * 7) * 5; // 50%..80%
    const durationMult = duration === 0.5 ? 0.5 : duration === 2 ? 1.85 : 1;
    const loanFee =
      Math.round((target.marketValue * (0.025 + rand() * 0.04) * durationMult) / 100_000) *
      100_000;
    const buyOptionFee =
      rand() < 0.55
        ? Math.round((target.marketValue * (1.05 + rand() * 0.18)) / 250_000) * 250_000
        : 0;
    const maxLoanFee = Math.max(
      loanFee + 300_000,
      Math.round((target.marketValue * 0.095 * durationMult) / 100_000) * 100_000
    );

    const offeredTerms: TransferOffer = {
      dealType: 'LOAN',
      startDate: 'Immediate',
      transferFee: loanFee,
      installments: 0,
      upfrontPct: 100,
      installmentSeasons: 0,
      exchangePlayerId: null,
      bonusAfterAppearances: 0,
      sellOnShare: 0,
      loanFee,
      loanWageSplitPct: wageSplit,
      loanDurationSeasons: duration,
      buyOptionFee,
    };

    const bidId = `lbid_${dateIso}_${target.id}_${Math.floor(rand() * 9999)}`;
    const durationText =
      duration === 0.5 ? 'Half-Season' : duration === 2 ? '2-Season' : '1-Season';

    const bid: IncomingTransferBid = {
      id: bidId,
      playerId: target.id,
      playerName: target.name,
      buyingClubId: buyer.id,
      buyingClubName: buyer.name,
      buyingClubShortName: buyer.shortName,
      bidType: 'LOAN',
      loanWageSplitPct: wageSplit,
      offeredFee: loanFee,
      initialFee: loanFee,
      sellOnShare: 0,
      offeredTerms,
      paidNow: loanFee,
      futurePayments: 0,
      potentialAddons: buyOptionFee,
      buyerSatisfaction: 76,
      buyerMaxFee: maxLoanFee,
      patience: 88,
      roundCount: 1,
      status: 'PENDING',
      lastMessage: `${buyer.name} proposed a ${durationText} loan (${wageSplit}% wages${loanFee > 0 ? `, ${formatCurrency(loanFee)} fee` : ''}${buyOptionFee > 0 ? `, ${formatCurrency(buyOptionFee)} buy option` : ''}) for ${target.name}.`,
      dateIso,
    };

    const notification: ManagerNotification = {
      id: `notif_${bidId}`,
      dateIso,
      type: 'LOAN_BID',
      title: `Loan Offer: ${target.name}`,
      message: `${buyer.name} offered a ${durationText} loan (${wageSplit}% wages) for ${target.name}.`,
      read: false,
      resolved: false,
      bidId,
      playerId: target.id,
    };

    return { bid, notification };
  }

  const buyers = clubs.filter(
    (c) => c.id !== userClub.id && c.balance >= target.marketValue * 0.85
  );
  const buyerPool = buyers.length > 0 ? buyers : clubs.filter((c) => c.id !== userClub.id);
  if (buyerPool.length === 0) return null;
  const buyer = buyerPool[Math.floor(rand() * buyerPool.length)];

  const offerMultiplier = 0.88 + rand() * 0.22;
  const maxMultiplier = 1.15 + rand() * 0.24;
  const offeredFee = Math.max(
    500_000,
    Math.round((target.marketValue * offerMultiplier) / 100_000) * 100_000
  );
  const buyerMaxFee = Math.max(
    offeredFee + 500_000,
    Math.round((target.marketValue * maxMultiplier) / 100_000) * 100_000
  );
  const installmentsOptions = [0, 0, 12, 24];
  const installments = installmentsOptions[Math.floor(rand() * installmentsOptions.length)];
  const upfrontPct = installments === 0 ? 100 : installments === 12 ? 55 : 40;
  const installmentSeasons = installments === 0 ? 0 : installments === 12 ? 1 : 2;
  const bonusAfterAppearances =
    rand() < 0.45 ? Math.round((offeredFee * 0.08) / 250_000) * 250_000 : 0;
  const offeredTerms: TransferOffer = {
    dealType: 'PERMANENT',
    startDate: 'Immediate',
    transferFee: offeredFee,
    installments,
    upfrontPct,
    installmentSeasons,
    exchangePlayerId: null,
    bonusAfterAppearances,
    sellOnShare: 0,
  };
  const paidNow = computePaidNow(offeredFee, offeredTerms);
  const futurePayments = Math.max(0, offeredFee - paidNow);

  const bidId = `bid_${dateIso}_${target.id}_${Math.floor(rand() * 9999)}`;

  const bid: IncomingTransferBid = {
    id: bidId,
    playerId: target.id,
    playerName: target.name,
    buyingClubId: buyer.id,
    buyingClubName: buyer.name,
    buyingClubShortName: buyer.shortName,
    bidType: 'PERMANENT',
    offeredFee,
    initialFee: offeredFee,
    sellOnShare: 0,
    offeredTerms,
    paidNow,
    futurePayments,
    potentialAddons: bonusAfterAppearances,
    buyerSatisfaction: 72,
    buyerMaxFee,
    patience: 85,
    roundCount: 1,
    status: 'PENDING',
    lastMessage: `${buyer.name} submitted a ${formatCurrency(offeredFee)} structured offer for ${target.name}.`,
    dateIso,
  };

  const notification: ManagerNotification = {
    id: `notif_${bidId}`,
    dateIso,
    type: 'TRANSFER_BID',
    title: `Transfer Bid: ${target.name}`,
    message: `${buyer.name} offered ${formatCurrency(offeredFee)} for ${target.name}.`,
    read: false,
    resolved: false,
    bidId,
    playerId: target.id,
  };

  return { bid, notification };
}

export function advanceCalendarDay(state: CareerState): CareerState {
  if (state.managerContract?.status === 'SACKED') {
    return state;
  }
  const currentDay = state.calendar[state.currentDayIndex];
  if (!currentDay || currentDay.type === 'MATCHDAY') {
    return state;
  }
  if (currentDay.isDeadlineDay && (state.deadlineHoursRemaining ?? 24) > 0) {
    return state.deadlineHoursRemaining == null
      ? { ...state, deadlineHoursRemaining: 24 }
      : state;
  }

  const rand = seededRandom(state.currentDayIndex * 131 + state.clubId.charCodeAt(0) * 43 + 7);
  const nextNotifications: ManagerNotification[] = [...(state.notifications ?? [])];
  let nextBids: IncomingTransferBid[] = [...(state.incomingBids ?? [])];

  const nextClubs = state.clubs.map((club) => {
    if (club.id !== state.clubId) {
      return {
        ...club,
        players: club.players.map((p) => ({
          ...p,
          fitness: Math.min(100, p.fitness + 4),
        })),
      };
    }

    let pickedTrainingInjury = false;
    return {
      ...club,
      players: club.players.map((p) => {
        if (!isPlayerAvailableForMatchday(p)) {
          return p;
        }
        if (currentDay.type === 'RECOVERY') {
          return {
            ...p,
            fitness: Math.min(100, p.fitness + 10),
          };
        }
        const recoveredFitness = p.fitness < 96 ? Math.min(96, p.fitness + 1) : p.fitness;
        const grow = p.age <= 22 && p.ovr < p.potential && state.currentDayIndex % 18 === 0 ? 1 : 0;
        let injuredMatches = p.injuredMatches ?? 0;
        let injuryNote = p.injuryNote;
        const fatigueRisk =
          p.fitness < 65 ? 0.0014 : p.fitness < 78 ? 0.0009 : 0.00045;
        if (
          !pickedTrainingInjury &&
          injuredMatches === 0 &&
          p.suspendedMatches === 0 &&
          p.position !== 'GK' &&
          rand() < fatigueRisk
        ) {
          pickedTrainingInjury = true;
          injuredMatches = rand() < 0.8 ? 1 : 2;
          injuryNote = INJURY_NOTES[Math.floor(rand() * INJURY_NOTES.length)];
          nextNotifications.unshift({
            id: `notif_inj_${currentDay.dateIso}_${p.id}`,
            dateIso: currentDay.dateIso,
            type: 'INJURY',
            title: `Injury Alert: ${p.name}`,
            message: `${p.name} picked up a ${injuryNote.toLowerCase()} in training (${injuredMatches} match${injuredMatches > 1 ? 'es' : ''} out).`,
            read: false,
            playerId: p.id,
          });
        }
        return {
          ...p,
          ovr: Math.min(99, p.ovr + grow),
          fitness: recoveredFitness,
          injuredMatches,
          injuryNote,
        };
      }),
    };
  });

  const userClub = nextClubs.find((c) => c.id === state.clubId);
  const windowState = getTransferWindowStatusForDate(
    currentDay.dateIso,
    2026 + (state.seasonIndex ?? 0)
  );
  if (userClub) {
    if (windowState.isOpen && rand() < 0.08) {
      const created = createIncomingBidIfEligible(
        nextClubs,
        userClub,
        nextBids,
        currentDay.dateIso,
        state.currentDayIndex * 97 + userClub.players.length * 13
      );
      if (created) {
        nextBids = [created.bid, ...nextBids];
        nextNotifications.unshift(created.notification);
      }
    }

    const currentYear = Number(currentDay.dateIso.slice(0, 4)) || 2026;
    const expiring = userClub.players.find(
      (p) =>
        !p.loanInfo &&
        p.contractExpiry <= currentYear + 1 &&
        !nextNotifications.some((n) => n.type === 'CONTRACT' && n.playerId === p.id)
    );
    if (expiring && state.currentDayIndex >= 2) {
      nextNotifications.unshift({
        id: `notif_con_${expiring.id}_${expiring.contractExpiry}`,
        dateIso: currentDay.dateIso,
        type: 'CONTRACT',
        title: `Contract Expiring: ${expiring.name}`,
        message: `${expiring.name}'s contract expires in ${expiring.contractExpiry}. Review renewal terms in Squad Hub.`,
        read: false,
        playerId: expiring.id,
      });
    }
  }

  const nextTargets = state.transferTargets.map((t) => {
    if (t.scoutStatus === 'SCOUTING') {
      const rem = t.scoutDaysRemaining - 1;
      return rem <= 0
        ? { ...t, scoutStatus: 'SCOUTED' as const, scoutDaysRemaining: 0 }
        : { ...t, scoutDaysRemaining: rem };
    }
    return t;
  });

  const nextAcademy = state.academy.map((ap) => {
    if (ap.promoted) return ap;
    const gain = currentDay.type === 'TRAINING' ? 8 : 3;
    const prog = ap.developmentProgress + gain;
    if (prog >= 100 && ap.ovr < ap.potential) {
      return {
        ...ap,
        ovr: ap.ovr + 1,
        developmentProgress: prog - 100,
      };
    }
    return { ...ap, developmentProgress: Math.min(99, prog) };
  });

  const nextCalendar = state.calendar.map((d, idx) =>
    idx === state.currentDayIndex ? { ...d, completed: true } : d
  );

  const nextDayIndex = Math.min(state.calendar.length - 1, state.currentDayIndex + 1);
  const nextDay = nextCalendar[nextDayIndex];
  const nextDateIso = nextDay?.dateIso ?? currentDay.dateIso;

  // Check for Half-Season Summer->Jan short loan returns once date reaches Jan 1
  const seasonStartYear = 2026 + (state.seasonIndex ?? 0);
  const winterOpenIso = `${seasonStartYear + 1}-01-01`;
  let clubsAfterShortLoans = nextClubs;
  if (nextDateIso >= winterOpenIso) {
    const returningHalfSeasonMap = new Map<string, Player[]>();
    const hasExpiredHalfSeason = clubsAfterShortLoans.some((c) =>
      c.players.some(
        (p) =>
          p.loanInfo?.direction === 'IN' &&
          p.loanInfo.durationSeasons === 0.5 &&
          p.loanInfo.halfSeasonWindow === 'SUMMER_TO_JAN'
      )
    );
    if (hasExpiredHalfSeason) {
      for (const c of clubsAfterShortLoans) {
        for (const p of c.players) {
          if (
            p.loanInfo?.direction === 'IN' &&
            p.loanInfo.durationSeasons === 0.5 &&
            p.loanInfo.halfSeasonWindow === 'SUMMER_TO_JAN'
          ) {
            const list = returningHalfSeasonMap.get(p.loanInfo.counterpartyClubId) ?? [];
            const { loanInfo: _drop, ...clean } = p;
            list.push(clean);
            returningHalfSeasonMap.set(p.loanInfo.counterpartyClubId, list);
          }
        }
      }
      clubsAfterShortLoans = clubsAfterShortLoans.map((c) => {
        const filteredPlayers = c.players
          .filter(
            (p) =>
              !(
                p.loanInfo?.direction === 'IN' &&
                p.loanInfo.durationSeasons === 0.5 &&
                p.loanInfo.halfSeasonWindow === 'SUMMER_TO_JAN'
              )
          )
          .map((p) => {
            if (
              p.loanInfo?.direction === 'OUT' &&
              p.loanInfo.durationSeasons === 0.5 &&
              p.loanInfo.halfSeasonWindow === 'SUMMER_TO_JAN'
            ) {
              const { loanInfo: _drop, ...clean } = p;
              return clean;
            }
            return p;
          });
        const extras = (returningHalfSeasonMap.get(c.id) ?? []).filter(
          (rp) => !filteredPlayers.some((fp) => fp.id === rp.id)
        );
        const merged = [...filteredPlayers, ...extras];
        const validIds = new Set(merged.map((p) => p.id));
        const nextStart = c.startingIds.filter((id) => validIds.has(id));
        let nextBench = c.benchIds.filter((id) => validIds.has(id) && !nextStart.includes(id));
        for (const p of merged) {
          if (nextStart.length >= 11) break;
          if (!nextStart.includes(p.id) && isPlayerAvailableForMatchday(p)) {
            nextStart.push(p.id);
            nextBench = nextBench.filter((id) => id !== p.id);
          }
        }
        return {
          ...c,
          players: merged,
          startingIds: nextStart,
          benchIds: nextBench,
        };
      });
    }
  }

  const updatedBase: CareerState = {
    ...state,
    clubs: clubsAfterShortLoans,
    transferTargets: nextTargets,
    academy: nextAcademy,
    calendar: nextCalendar,
    currentDayIndex: nextDayIndex,
    deadlineHoursRemaining: nextDay?.isDeadlineDay ? 24 : null,
    notifications: nextNotifications.slice(0, 40),
    incomingBids: nextBids,
  };

  const parallel = syncParallelCompetitions(updatedBase, nextDateIso);

  return {
    ...updatedBase,
    ...parallel,
  };
}

export function advanceDeadlineHour(state: CareerState): CareerState {
  const currentDay = state.calendar[state.currentDayIndex];
  if (!currentDay || !currentDay.isDeadlineDay) {
    return state;
  }

  const currentHours = state.deadlineHoursRemaining ?? 24;
  if (currentHours <= 0) {
    return advanceCalendarDay({ ...state, deadlineHoursRemaining: 0 });
  }

  const nextHours = currentHours - 1;
  const rand = seededRandom(state.currentDayIndex * 199 + currentHours * 37 + state.clubId.charCodeAt(0));
  const nextNotifications: ManagerNotification[] = [...(state.notifications ?? [])];
  let nextBids: IncomingTransferBid[] = [...(state.incomingBids ?? [])];

  const userClub = state.clubs.find((c) => c.id === state.clubId);
  if (userClub && rand() < 0.28) {
    const created = createIncomingBidIfEligible(
      state.clubs,
      userClub,
      nextBids,
      currentDay.dateIso,
      state.currentDayIndex * 101 + currentHours * 17,
      4
    );
    if (created) {
      created.bid.lastMessage = `Deadline Day (${nextHours}h left): ${created.bid.buyingClubName} submitted an urgent ${formatCurrency(created.bid.offeredFee)} bid for ${created.bid.playerName}!`;
      created.notification.title = `Deadline Bid (${nextHours}h): ${created.bid.playerName}`;
      nextBids = [created.bid, ...nextBids];
      nextNotifications.unshift(created.notification);
    }
  }

  // Fast deadline-day scouting progress every 8 hours
  const nextTargets =
    nextHours % 8 === 0
      ? state.transferTargets.map((t) => {
          if (t.scoutStatus === 'SCOUTING') {
            const rem = t.scoutDaysRemaining - 1;
            return rem <= 0
              ? { ...t, scoutStatus: 'SCOUTED' as const, scoutDaysRemaining: 0 }
              : { ...t, scoutDaysRemaining: rem };
          }
          return t;
        })
      : state.transferTargets;

  if (nextHours > 0) {
    return {
      ...state,
      deadlineHoursRemaining: nextHours,
      transferTargets: nextTargets,
      incomingBids: nextBids,
      notifications: nextNotifications.slice(0, 40),
    };
  }

  // 24h expired -> close Deadline Day and advance to the next calendar day
  const nextCalendar = state.calendar.map((d, idx) =>
    idx === state.currentDayIndex ? { ...d, completed: true } : d
  );
  const nextDayIndex = Math.min(state.calendar.length - 1, state.currentDayIndex + 1);
  const nextDay = nextCalendar[nextDayIndex];
  const nextDateIso = nextDay?.dateIso ?? currentDay.dateIso;

  const updatedBase: CareerState = {
    ...state,
    calendar: nextCalendar,
    currentDayIndex: nextDayIndex,
    deadlineHoursRemaining: nextDay?.isDeadlineDay ? 24 : null,
    transferTargets: nextTargets,
    incomingBids: nextBids,
    notifications: nextNotifications.slice(0, 40),
  };

  const parallel = syncParallelCompetitions(updatedBase, nextDateIso);
  return {
    ...updatedBase,
    ...parallel,
  };
}

export function autoAdvanceDeadlineDay(state: CareerState): CareerState {
  let curr = state;
  const startDayIdx = curr.currentDayIndex;
  for (let safety = 0; safety < 26; safety++) {
    if (curr.managerContract?.status === 'SACKED') break;
    const day = curr.calendar[curr.currentDayIndex];
    if (!day?.isDeadlineDay || curr.currentDayIndex !== startDayIdx) break;
    curr = advanceDeadlineHour(curr);
    if (curr.deadlineHoursRemaining == null && curr.currentDayIndex !== startDayIdx) break;
  }
  return curr;
}

export function skipCalendarToDate(state: CareerState, targetDateIso: string): CareerState {
  let curr = state;
  for (let safety = 0; safety < 460; safety++) {
    if (curr.pendingSeasonSummary || curr.managerContract?.status === 'SACKED') break;
    const currentDay = curr.calendar[curr.currentDayIndex];
    if (!currentDay || currentDay.dateIso >= targetDateIso) break;
    if (curr.currentDayIndex >= curr.calendar.length - 1) break;

    if (currentDay.isDeadlineDay && (curr.deadlineHoursRemaining ?? 24) > 0) {
      const afterDeadline = autoAdvanceDeadlineDay(curr);
      if (afterDeadline.currentDayIndex === curr.currentDayIndex) {
        curr = advanceCalendarDay({ ...afterDeadline, deadlineHoursRemaining: 0 });
      } else {
        curr = afterDeadline;
      }
      continue;
    }

    if (currentDay.type === 'MATCHDAY') {
      const prevIdx = curr.currentDayIndex;
      const fixId = currentDay.matchFixtureId;
      const compId = currentDay.competitionId;
      const fix =
        curr.fixtures.find((f) => f.id === fixId) ??
        (compId ? curr.contextFixtures[compId]?.find((f) => f.id === fixId) : undefined);

      if (fix && !fix.played) {
        const userClub = curr.clubs.find((c) => c.id === curr.clubId);
        let preparedState = curr;
        if (userClub) {
          const check = validateStartingXI(userClub, userClub.startingIds);
          if (!check.valid) {
            const fixed = autoReplaceUnavailableStarters(userClub);
            preparedState = {
              ...curr,
              clubs: curr.clubs.map((c) =>
                c.id === userClub.id
                  ? { ...c, startingIds: fixed.nextStartingIds, benchIds: fixed.nextBenchIds }
                  : c
              ),
              matchdayOverride: null,
            };
          }
        }
        const homeClub = resolveClubForMatch(preparedState.clubs, fix.homeClubId);
        const awayClub = resolveClubForMatch(preparedState.clubs, fix.awayClubId);
        const report = simulateMatch(homeClub, awayClub, fix, preparedState.currentDayIndex + 1);
        curr = applyMatchReportAndSimulateRound(preparedState, report);
      } else {
        const nextCalendar = curr.calendar.map((d, idx) =>
          idx === curr.currentDayIndex ? { ...d, completed: true } : d
        );
        const nextDayIndex = Math.min(nextCalendar.length - 1, curr.currentDayIndex + 1);
        const nextDay = nextCalendar[nextDayIndex];
        const nextDateIso = nextDay?.dateIso ?? currentDay.dateIso;
        const base: CareerState = {
          ...curr,
          calendar: nextCalendar,
          currentDayIndex: nextDayIndex,
          deadlineHoursRemaining: nextDay?.isDeadlineDay ? 24 : null,
        };
        const parallel = syncParallelCompetitions(base, nextDateIso);
        curr = { ...base, ...parallel };
      }
      if (curr.currentDayIndex === prevIdx) break;
      continue;
    }

    const next = advanceCalendarDay(curr);
    if (next.currentDayIndex === curr.currentDayIndex) break;
    curr = next;
  }
  return curr;
}

export function applyMatchReportAndSimulateRound(
  state: CareerState,
  userReport: MatchReport
): CareerState {
  const userLeagueId = state.userLeagueId ?? 'PL';
  const totalRounds = getTotalRoundsForLeague(userLeagueId);
  const clubMap = new Map(state.clubs.map((c) => [c.id, { ...c, players: c.players.map((p) => ({ ...p })) }]));
  const isUserLeagueMatch = userReport.competitionId === userLeagueId;
  const roundFixtures = isUserLeagueMatch
    ? state.fixtures.filter((f) => f.round === userReport.round)
    : [];
  const reportsToApply: MatchReport[] = [userReport];
  const nextNotifications: ManagerNotification[] = [...(state.notifications ?? [])];
  let nextBids: IncomingTransferBid[] = [...(state.incomingBids ?? [])];
  const dateIso = state.calendar[state.currentDayIndex]?.dateIso ?? '2026-08-15';
  const rand = seededRandom(userReport.round * 211 + state.currentDayIndex * 29 + 13);

  // Simulate all other fixtures in the same user league round
  for (const f of roundFixtures) {
    if (f.id === userReport.fixtureId || f.played) continue;
    const h = clubMap.get(f.homeClubId);
    const a = clubMap.get(f.awayClubId);
    if (h && a) {
      reportsToApply.push(simulateMatch(h, a, f, state.currentDayIndex + 1));
    }
  }

  const reportByFixture = new Map(reportsToApply.map((r) => [r.fixtureId, r]));

  let bonusExpense = 0;
  const userGoalsScored =
    userReport.homeClubId === state.clubId ? userReport.homeGoals : userReport.awayGoals;
  const userGoalsConceded =
    userReport.homeClubId === state.clubId ? userReport.awayGoals : userReport.homeGoals;

  // Apply stats, fitness, cards, and suspensions for every club in the round
  for (const rep of reportsToApply) {
    const home = clubMap.get(rep.homeClubId);
    const away = clubMap.get(rep.awayClubId);

    const applyTeam = (club: Club | undefined, goalsAgainst: number) => {
      if (!club) return;
      for (const p of club.players) {
        if (p.suspendedMatches > 0) {
          p.suspendedMatches = Math.max(0, p.suspendedMatches - 1);
        }
        if ((p.injuredMatches ?? 0) > 0) {
          p.injuredMatches = Math.max(0, (p.injuredMatches ?? 0) - 1);
          if (p.injuredMatches === 0) {
            p.injuryNote = undefined;
          }
        }
      }
      const ratingMap = new Map(rep.ratings.map((r) => [r.playerId, r]));
      for (const p of club.players) {
        const r = ratingMap.get(p.id);
        if (r && !r.didNotPlay && r.minutesPlayed > 0) {
          p.appearances += 1;
          p.goals += r.goals;
          p.assists += r.assists;
          if ((p.position === 'GK' || p.position === 'DEF') && goalsAgainst === 0 && r.minutesPlayed >= 45) {
            p.cleanSheets += 1;
          }
          const minutesFactor = r.minutesPlayed >= 80 ? 15 : r.minutesPlayed >= 45 ? 10 : 5;
          p.fitness = Math.max(42, p.fitness - minutesFactor);
          if (club.id === state.clubId && r.goals > 0) {
            bonusExpense += r.goals * p.goalBonus;
          }
        }
      }
    };

    applyTeam(home, rep.awayGoals);
    applyTeam(away, rep.homeGoals);

    for (const ev of rep.events) {
      const targetClub = ev.teamSide === 'HOME' ? home : away;
      const player = targetClub?.players.find((p) => p.id === ev.playerId);
      if (!player) continue;
      if (ev.type === 'YELLOW') {
        player.yellowCards += 1;
        if (player.yellowCards > 0 && player.yellowCards % 5 === 0) {
          player.suspendedMatches += 1;
          if (targetClub?.id === state.clubId) {
            nextNotifications.unshift({
              id: `notif_sus_y_${rep.fixtureId}_${player.id}`,
              dateIso,
              type: 'SUSPENSION',
              title: `Suspension: ${player.name}`,
              message: `${player.name} reached 5 yellow cards and is suspended for 1 match.`,
              read: false,
              playerId: player.id,
            });
          }
        }
      } else if (ev.type === 'RED') {
        player.redCards += 1;
        player.suspendedMatches += 1;
        if (targetClub?.id === state.clubId) {
          nextNotifications.unshift({
            id: `notif_sus_r_${rep.fixtureId}_${player.id}`,
            dateIso,
            type: 'SUSPENSION',
            title: `Red Card Ban: ${player.name}`,
            message: `${player.name} received a red card and is suspended for ${player.suspendedMatches} match.`,
            read: false,
            playerId: player.id,
          });
        }
      }
    }

    // Small post-match injury check for user match outfield players who featured
    if (rep.fixtureId === userReport.fixtureId) {
      const userSide = rep.homeClubId === state.clubId ? home : away;
      if (userSide) {
        const playedOutfield = userSide.players.filter(
          (p) =>
            p.position !== 'GK' &&
            rep.ratings.some((r) => r.playerId === p.id && !r.didNotPlay && r.minutesPlayed > 0) &&
            (p.injuredMatches ?? 0) === 0
        );
        if (playedOutfield.length > 0 && rand() < 0.025) {
          // Slightly favor fatigued outfielders when picking a rare match knock
          const weightedPool = playedOutfield.map((p) => ({
            player: p,
            weight: p.fitness < 65 ? 3 : p.fitness < 78 ? 2 : 1,
          }));
          const totalW = weightedPool.reduce((s, x) => s + x.weight, 0);
          let pickR = rand() * totalW;
          let victim = playedOutfield[0];
          for (const item of weightedPool) {
            pickR -= item.weight;
            if (pickR <= 0) {
              victim = item.player;
              break;
            }
          }
          const duration = rand() < 0.82 ? 1 : 2;
          const note = INJURY_NOTES[Math.floor(rand() * INJURY_NOTES.length)];
          victim.injuredMatches = duration;
          victim.injuryNote = note;
          nextNotifications.unshift({
            id: `notif_inj_${rep.fixtureId}_${victim.id}`,
            dateIso,
            type: 'INJURY',
            title: `Match Injury: ${victim.name}`,
            message: `${victim.name} sustained a ${note.toLowerCase()} (${duration} match${duration > 1 ? 'es' : ''} out).`,
            read: false,
            playerId: victim.id,
          });
        }
      }
    }
  }

  const nextClubs = Array.from(clubMap.values());
  const nextFixtures = isUserLeagueMatch
    ? state.fixtures.map((f) => {
        const rep = reportByFixture.get(f.id);
        if (!rep) return f;
        return {
          ...f,
          played: true,
          homeGoals: rep.homeGoals,
          awayGoals: rep.awayGoals,
          report: rep,
        };
      })
    : state.fixtures;

  // Update cup / UEFA fixture if this was not the domestic league
  const nextContextFixtures = { ...state.contextFixtures };
  let cupFinalWinnerId: string | undefined;
  if (!isUserLeagueMatch) {
    const compId = userReport.competitionId;
    const isUefaMatch = isUefaCompId(compId);
    const lpRounds = isUefaMatch ? getUefaLeaguePhaseRounds(compId) : 0;
    const finalRound = isUefaMatch ? 13 : 7;
    const isKnockoutMatch = !isUefaMatch || userReport.round > lpRounds;

    const list = nextContextFixtures[compId] ?? [];
    nextContextFixtures[compId] = list.map((f) => {
      if (f.id !== userReport.fixtureId) return f;
      let penaltiesWinnerId: string | undefined;
      if (isKnockoutMatch && userReport.homeGoals === userReport.awayGoals) {
        const r = seededRandom(userReport.round * 83 + state.currentDayIndex * 19)();
        penaltiesWinnerId = r < 0.55 ? userReport.homeClubId : userReport.awayClubId;
      }
      if (f.round === finalRound) {
        cupFinalWinnerId =
          userReport.homeGoals > userReport.awayGoals
            ? userReport.homeClubId
            : userReport.awayGoals > userReport.homeGoals
            ? userReport.awayClubId
            : penaltiesWinnerId;
      }
      return {
        ...f,
        played: true,
        homeGoals: userReport.homeGoals,
        awayGoals: userReport.awayGoals,
        penaltiesWinnerId,
        report: userReport,
      };
    });
  }

  // Update weekly payroll & matchday revenue
  const userClub = nextClubs.find((c) => c.id === state.clubId)!;
  const weeklyPayroll = isUserLeagueMatch ? userClub.players.reduce((acc, p) => acc + p.weeklyWage, 0) : 0;
  const leagueTier = isDomesticLeagueId(userLeagueId) ? LEAGUE_CATALOG[userLeagueId].tier : 1;
  const baseRev =
    userLeagueId === 'PL'
      ? 1_450_000
      : userLeagueId === 'ESP1' || userLeagueId === 'GER1' || userLeagueId === 'ITA1'
      ? 1_200_000
      : userLeagueId === 'FRA1' || userLeagueId === 'KSA1'
      ? 950_000
      : leagueTier === 1
      ? 620_000
      : userLeagueId === 'CHAMP'
      ? 520_000
      : leagueTier === 2
      ? 310_000
      : leagueTier === 3
      ? 220_000
      : 120_000;
  const matchdayRevenue = userReport.homeClubId === state.clubId ? baseRev : Math.round(baseRev * 0.35);
  const netDelta = matchdayRevenue - weeklyPayroll - bonusExpense;

  const wonMatch = userGoalsScored > userGoalsConceded;
  const drewMatch = userGoalsScored === userGoalsConceded;
  const satDelta = wonMatch ? 4 : drewMatch ? 1 : -3;

  const compLabel = COMPETITION_THEMES[userReport.competitionId].name;
  const newLedgerEntries: FinanceEntry[] = [
    {
      id: `fin_rev_${userReport.fixtureId}`,
      dateIso,
      type: 'INCOME',
      category: 'MATCHDAY_REVENUE',
      description: `${compLabel} R${userReport.round} Matchday & Broadcast Income`,
      amount: matchdayRevenue,
    },
  ];
  if (weeklyPayroll > 0) {
    newLedgerEntries.push({
      id: `fin_wage_${userReport.fixtureId}`,
      dateIso,
      type: 'EXPENSE',
      category: 'WEEKLY_WAGES',
      description: `Round ${userReport.round} Squad Weekly Payroll`,
      amount: weeklyPayroll,
    });
  }
  if (bonusExpense > 0) {
    newLedgerEntries.push({
      id: `fin_goal_${userReport.fixtureId}`,
      dateIso,
      type: 'EXPENSE',
      category: 'GOAL_BONUS',
      description: `${compLabel} R${userReport.round} Player Goal Bonuses`,
      amount: bonusExpense,
    });
  }

  const nextCalendar = state.calendar.map((d, idx) =>
    idx === state.currentDayIndex ? { ...d, completed: true } : d
  );
  const nextDayIndex = Math.min(state.calendar.length - 1, state.currentDayIndex + 1);
  const nextDateIso = nextCalendar[nextDayIndex]?.dateIso ?? dateIso;

  const userLeagueClubs = nextClubs.filter((c) => (c.leagueId ?? 'PL') === userLeagueId);
  const userLeagueStandings = computeStandings(userLeagueClubs, nextFixtures);
  const activeSeasonLabel = state.seasonLabel ?? formatSeasonLabel(state.seasonIndex ?? 0);

  // Unlock Career Trophies when winning the league or a cup final
  const nextTrophies: CareerTrophy[] = [...(state.careerTrophies ?? [])];
  if (
    isUserLeagueMatch &&
    nextFixtures.every((f) => f.played) &&
    userLeagueStandings[0]?.clubId === state.clubId &&
    !nextTrophies.some((tr) => tr.competitionId === userLeagueId && tr.season === activeSeasonLabel)
  ) {
    nextTrophies.push({
      id: `trophy_${userLeagueId}_${activeSeasonLabel}`,
      title: `${COMPETITION_THEMES[userLeagueId].name} Champions`,
      season: activeSeasonLabel,
      competitionId: userLeagueId,
    });
  }
  if (
    !isUserLeagueMatch &&
    cupFinalWinnerId === state.clubId &&
    !nextTrophies.some((tr) => tr.competitionId === userReport.competitionId && tr.season === activeSeasonLabel)
  ) {
    nextTrophies.push({
      id: `trophy_${userReport.competitionId}_${activeSeasonLabel}`,
      title: `${COMPETITION_THEMES[userReport.competitionId].name} Winners`,
      season: activeSeasonLabel,
      competitionId: userReport.competitionId,
    });
  }

  // Periodic post-match incoming bid opportunity
  if (rand() < 0.24) {
    const created = createIncomingBidIfEligible(
      nextClubs,
      userClub,
      nextBids,
      dateIso,
      userReport.round * 73 + state.currentDayIndex * 11
    );
    if (created) {
      nextBids = [created.bid, ...nextBids];
      nextNotifications.unshift(created.notification);
    }
  }

  // Evaluate user board satisfaction (including league objective pace), 5-match probation warning (<30%), and potential sacking
  const activeObjectives =
    state.seasonObjectives && state.seasonObjectives.length > 0
      ? state.seasonObjectives
      : buildSeasonObjectivesForClub(
          state.clubId,
          userLeagueId,
          getLeagueTeamsFromState(state),
          nextClubs,
          state.seasonIndex ?? 0
        );
  const leagueObjective = activeObjectives.find(
    (o) => o.competitionId === userLeagueId || o.targetLeagueRank !== undefined
  );
  let objTrackingDelta = 0;
  if (isUserLeagueMatch && leagueObjective?.targetLeagueRank) {
    const rankIdx = userLeagueStandings.findIndex((r) => r.clubId === state.clubId);
    const rank = rankIdx >= 0 ? rankIdx + 1 : 0;
    const playedCount = rankIdx >= 0 ? userLeagueStandings[rankIdx].played : 0;
    if (playedCount >= 3 && rank > 0) {
      if (rank <= leagueObjective.targetLeagueRank) objTrackingDelta = 1;
      else if (rank > leagueObjective.targetLeagueRank + 3) objTrackingDelta = -1;
    }
  }

  const nextSatisfaction = Math.max(
    5,
    Math.min(100, state.boardSatisfaction + satDelta + objTrackingDelta)
  );
  const seasonStartYear = 2026 + (state.seasonIndex ?? 0);
  const currentContract: ManagerContract =
    state.managerContract ??
    buildDefaultManagerContract(userLeagueId, dateIso, seasonStartYear, userClub);
  let nextContract: ManagerContract = { ...currentContract };

  if (nextSatisfaction < 30 && nextContract.status !== 'SACKED') {
    if (nextContract.probationMatchesRemaining === null) {
      nextContract.probationMatchesRemaining = 5;
      nextNotifications.unshift({
        id: `notif_board_warn_${userReport.fixtureId}`,
        dateIso,
        type: 'BOARD',
        title: `Board Confidence Warning (${nextSatisfaction}%)`,
        message: `${userClub.name} board confidence dropped below 30%. Reach 30%+ within 5 matches or face dismissal.`,
        read: false,
      });
    } else {
      const rem = nextContract.probationMatchesRemaining - 1;
      if (rem <= 0) {
        nextContract.probationMatchesRemaining = 0;
        nextContract.status = 'SACKED';
        nextNotifications.unshift({
          id: `notif_board_sack_${userReport.fixtureId}`,
          dateIso,
          type: 'BOARD',
          title: `Dismissed by ${userClub.name}`,
          message: `The board ended your contract after remaining below 30% confidence for 5 matches. Apply for a new club in Job Market.`,
          read: false,
        });
      } else {
        nextContract.probationMatchesRemaining = rem;
        nextNotifications.unshift({
          id: `notif_board_prob_${userReport.fixtureId}`,
          dateIso,
          type: 'BOARD',
          title: `Probation Update: ${rem} Match${rem > 1 ? 'es' : ''} Left`,
          message: `Board confidence is ${nextSatisfaction}% (<30%). Improve results in your next ${rem} match${rem > 1 ? 'es' : ''}.`,
          read: false,
        });
      }
    }
  } else if (nextSatisfaction >= 30 && nextContract.probationMatchesRemaining !== null && nextContract.status !== 'SACKED') {
    nextContract.probationMatchesRemaining = null;
    nextNotifications.unshift({
      id: `notif_board_safe_${userReport.fixtureId}`,
      dateIso,
      type: 'BOARD',
      title: `Board Confidence Restored (${nextSatisfaction}%)`,
      message: `${userClub.name}'s board lifted your probation warning following improved results.`,
      read: false,
    });
  }

  // Update AI Club Managers satisfaction & pressures based on current league standings
  const leagueTeams = getLeagueTeamsFromState(state);
  const currentManagers: Record<string, ClubManagerInfo> = {
    ...(state.clubManagers ??
      buildInitialClubManagers(
        nextClubs,
        leagueTeams,
        state.clubId,
        `${state.coach.firstName} ${state.coach.lastName}`.trim() || state.coach.nickname,
        seasonStartYear
      )),
  };

  if (currentManagers[state.clubId]) {
    currentManagers[state.clubId] = {
      ...currentManagers[state.clubId],
      satisfaction: nextSatisfaction,
      contractEndSeasonYear: nextContract.contractEndSeasonYear,
      status: nextContract.status === 'SACKED' ? 'VACANT' : nextSatisfaction < 35 ? 'UNDER_PRESSURE' : 'SECURE',
    };
  }

  const nextDay = nextCalendar[nextDayIndex];
  const intermediateState: CareerState = {
    ...state,
    clubs: nextClubs,
    fixtures: nextFixtures,
    contextFixtures: nextContextFixtures,
    contextStandings: {
      ...state.contextStandings,
      [userLeagueId]: userLeagueStandings,
    },
    calendar: nextCalendar,
    currentDayIndex: nextDayIndex,
    deadlineHoursRemaining: nextDay?.isDeadlineDay ? 24 : null,
    currentRound: isUserLeagueMatch ? Math.min(totalRounds, userReport.round + 1) : state.currentRound,
    boardSatisfaction: nextSatisfaction,
    seasonObjectives: activeObjectives,
    managerContract: nextContract,
    clubManagers: currentManagers,
    budget: Math.max(0, state.budget + netDelta),
    financeLedger: [...newLedgerEntries, ...state.financeLedger],
    careerTrophies: nextTrophies,
    notifications: nextNotifications.slice(0, 40),
    incomingBids: nextBids,
    matchdayOverride: null,
  };

  // Simulate all parallel leagues & cups up to the new calendar date
  const parallel = syncParallelCompetitions(intermediateState, nextDateIso);
  let syncedState: CareerState = {
    ...intermediateState,
    ...parallel,
  };

  // Refresh AI manager statuses from latest standings
  const updatedManagers = { ...currentManagers };
  (['PL', 'CHAMP', 'L1', 'L2'] as const).forEach((tier) => {
    const rows = syncedState.contextStandings[tier] ?? [];
    const teams = parallel.leagueTeams?.[tier] ?? leagueTeams[tier] ?? [];
    const avgOvr = teams.reduce((s, t) => s + t.ovr, 0) / Math.max(1, teams.length);
    rows.forEach((row, idx) => {
      if (row.clubId === syncedState.clubId) return;
      const info = updatedManagers[row.clubId];
      if (!info || row.played < 3) return;
      const teamOvr = teams.find((t) => t.id === row.clubId)?.ovr ?? avgOvr;
      const expectedRank = Math.max(1, Math.min(rows.length, Math.round(((avgOvr - teamOvr + 6) / 12) * rows.length)));
      const rankGap = expectedRank - (idx + 1); // positive = overperforming, negative = underperforming
      const formPts = row.form.reduce((s, res) => s + (res === 'W' ? 3 : res === 'D' ? 1 : 0), 0);
      const nextSat = Math.max(12, Math.min(96, Math.round(58 + rankGap * 4 + (formPts - 6) * 2.5)));
      let nextStatus: AiManagerStatus = info.status;
      let nextMgrName = info.managerName;
      if (nextSat <= 18) {
        nextStatus = 'VACANT';
        nextMgrName = 'Caretaker Boss';
      } else if (nextSat < 35) {
        nextStatus = 'UNDER_PRESSURE';
      } else if (info.contractEndSeasonYear <= seasonStartYear + 1) {
        nextStatus = 'EXPIRING';
      } else {
        nextStatus = 'SECURE';
      }
      updatedManagers[row.clubId] = {
        ...info,
        satisfaction: nextSat,
        status: nextStatus,
        managerName: nextMgrName,
      };
    });
  });
  syncedState = { ...syncedState, clubManagers: updatedManagers };

  // Update season objectives progress & apply one-time board satisfaction reactions on completion/failure
  const evaluatedObjs = evaluateSeasonObjectives(syncedState);
  let objOutcomeSatDelta = 0;
  const objNotifs: ManagerNotification[] = [];
  const finalizedObjs = evaluatedObjs.map((obj) => {
    if ((obj.status === 'COMPLETED' || obj.status === 'FAILED') && !obj.satisfactionApplied) {
      const isLeague = obj.competitionId === userLeagueId || obj.targetLeagueRank !== undefined;
      const delta = isLeague
        ? obj.status === 'COMPLETED'
          ? 10
          : -8
        : obj.status === 'COMPLETED'
        ? 6
        : -6;
      objOutcomeSatDelta += delta;
      objNotifs.push({
        id: `notif_obj_${obj.id}_${obj.status}`,
        dateIso,
        type: 'BOARD',
        title:
          obj.status === 'COMPLETED'
            ? `Objective Achieved: ${obj.titleEn}`
            : `Objective Missed: ${obj.titleEn}`,
        message: `${obj.currentProgressEn} (${delta > 0 ? `+${delta}` : delta}% Board Satisfaction).`,
        read: false,
      });
      return { ...obj, satisfactionApplied: true };
    }
    return obj;
  });

  if (objOutcomeSatDelta !== 0) {
    const adjustedSat = Math.max(
      5,
      Math.min(100, syncedState.boardSatisfaction + objOutcomeSatDelta)
    );
    const nextClubMgrs = { ...(syncedState.clubManagers ?? {}) };
    if (nextClubMgrs[syncedState.clubId]) {
      nextClubMgrs[syncedState.clubId] = {
        ...nextClubMgrs[syncedState.clubId],
        satisfaction: adjustedSat,
        status:
          syncedState.managerContract?.status === 'SACKED'
            ? 'VACANT'
            : adjustedSat < 35
            ? 'UNDER_PRESSURE'
            : 'SECURE',
      };
    }
    syncedState = {
      ...syncedState,
      boardSatisfaction: adjustedSat,
      clubManagers: nextClubMgrs,
      notifications: [...objNotifs, ...(syncedState.notifications ?? [])].slice(0, 40),
    };
  }
  syncedState = {
    ...syncedState,
    seasonObjectives: finalizedObjs,
  };

  // Check if all user league fixtures + any remaining calendar matchdays are finished
  const hasRemainingMatchday = syncedState.calendar
    .slice(syncedState.currentDayIndex)
    .some((d) => d.type === 'MATCHDAY' && !d.completed);

  if (syncedState.fixtures.every((f) => f.played) && !hasRemainingMatchday && !syncedState.pendingSeasonSummary) {
    const { finalizedState, summary } = computeSeasonEndSummary(syncedState);
    syncedState = {
      ...finalizedState,
      pendingSeasonSummary: summary,
    };
    syncedState = {
      ...syncedState,
      seasonObjectives: evaluateSeasonObjectives(syncedState),
    };
  }

  return syncedState;
}

function resolveKnockoutMatchWinner(
  clubs: Club[],
  homeId: string,
  awayId: string,
  compId: CompetitionId,
  round: number,
  seed: number,
  stageLabel: string
): { winnerId: string; scoreText: string } {
  const home = resolveClubForMatch(clubs, homeId);
  const away = resolveClubForMatch(clubs, awayId);
  const fix: Fixture = {
    id: `PO_${compId}_R${round}_${home.shortName}_${away.shortName}`,
    competitionId: compId,
    round,
    dateIso: '2027-05-25',
    homeClubId: home.id,
    awayClubId: away.id,
    homeClubName: home.name,
    awayClubName: away.name,
    played: false,
    stageLabel,
  };
  const rep = simulateMatch(home, away, fix, seed);
  let winnerId = rep.homeGoals > rep.awayGoals ? home.id : away.id;
  let penSuffix = '';
  if (rep.homeGoals === rep.awayGoals) {
    const r = seededRandom(seed * 17 + home.id.charCodeAt(0))();
    winnerId = r < 0.52 ? home.id : away.id;
    const wShort = winnerId === home.id ? home.shortName : away.shortName;
    penSuffix = ` (${wShort} pens)`;
  }
  return {
    winnerId,
    scoreText: `${home.shortName} ${rep.homeGoals}-${rep.awayGoals} ${away.shortName}${penSuffix}`,
  };
}

function getCupFinalWinner(fixtures: Fixture[]): { clubId: string; clubName: string } | undefined {
  const final = fixtures.find((f) => f.round === 7 && f.played);
  if (!final) return undefined;
  const hg = final.homeGoals ?? 0;
  const ag = final.awayGoals ?? 0;
  const winnerId =
    hg > ag ? final.homeClubId : ag > hg ? final.awayClubId : final.penaltiesWinnerId ?? final.homeClubId;
  const winnerName = winnerId === final.homeClubId ? final.homeClubName : final.awayClubName;
  return { clubId: winnerId, clubName: winnerName };
}

export function computeSeasonEndSummary(rawState: CareerState): {
  finalizedState: CareerState;
  summary: SeasonEndSummary;
} {
  const seasonIdx = rawState.seasonIndex ?? 0;
  const seasonLabel = rawState.seasonLabel ?? formatSeasonLabel(seasonIdx);
  const seasonEndDate = `${2027 + seasonIdx}-06-30`;

  // Finish all parallel leagues, national cups, MLS Playoffs, and UEFA brackets
  const finalizedParallel = syncParallelCompetitions(rawState, seasonEndDate, true);
  const finalizedState: CareerState = {
    ...rawState,
    ...finalizedParallel,
  };

  const leagueTeams = getLeagueTeamsFromState(finalizedState);
  const userLeagueId: DomesticLeagueId = isDomesticLeagueId(finalizedState.userLeagueId ?? 'PL')
    ? (finalizedState.userLeagueId as DomesticLeagueId)
    : 'PL';

  const getStandingsForLeague = (tier: DomesticLeagueId): StandingRow[] => {
    if (tier === userLeagueId) {
      const tierClubs = finalizedState.clubs.filter((c) => (c.leagueId ?? 'PL') === tier);
      return computeStandings(tierClubs, finalizedState.fixtures);
    }
    return finalizedState.contextStandings[tier] ?? [];
  };

  const standingsByLeague: Partial<Record<DomesticLeagueId, StandingRow[]>> = {};
  for (const lid of ALL_DOMESTIC_LEAGUE_IDS) {
    standingsByLeague[lid] = getStandingsForLeague(lid);
  }

  const playFourTeamBracket = (compId: CompetitionId, contenders: StandingRow[]): { winnerId: string; scoreText: string } => {
    if (contenders.length < 4) {
      return { winnerId: contenders[0]?.clubId ?? '', scoreText: 'Auto' };
    }
    const s1 = resolveKnockoutMatchWinner(
      finalizedState.clubs,
      contenders[0].clubId,
      contenders[3].clubId,
      compId,
      91,
      seasonIdx * 97 + 11,
      'Play-Off Semi-Final'
    );
    const s2 = resolveKnockoutMatchWinner(
      finalizedState.clubs,
      contenders[1].clubId,
      contenders[2].clubId,
      compId,
      92,
      seasonIdx * 97 + 23,
      'Play-Off Semi-Final'
    );
    const fin = resolveKnockoutMatchWinner(
      finalizedState.clubs,
      s1.winnerId,
      s2.winnerId,
      compId,
      99,
      seasonIdx * 97 + 47,
      'Play-Off Final'
    );
    return fin;
  };

  const { movements, playoffs } = resolveCountryPyramidMovements(
    standingsByLeague,
    leagueTeams,
    (compId, hId, aId, r, lbl) => resolveKnockoutMatchWinner(finalizedState.clubs, hId, aId, compId, r, seasonIdx * 97 + 61, lbl),
    playFourTeamBracket
  );

  // Determine user club outcome & next division
  const userTable = standingsByLeague[userLeagueId] ?? [];
  const userFinishRank = Math.max(1, userTable.findIndex((r) => r.clubId === finalizedState.clubId) + 1);
  let userNextLeagueId: DomesticLeagueId = userLeagueId;
  let userOutcome: 'PROMOTED' | 'RELEGATED' | 'STAYED' = 'STAYED';

  for (const mv of movements) {
    if (mv.clubIds.includes(finalizedState.clubId)) {
      if (isDomesticLeagueId(mv.toLeague)) userNextLeagueId = mv.toLeague;
      userOutcome = mv.direction;
      break;
    }
  }

  const baseTierPrize = LEAGUE_CATALOG[userLeagueId]?.titlePrizeBase ?? 12_000_000;
  const rankFactor = Math.max(0.35, 1.35 - (userFinishRank - 1) * 0.045);
  const promotionBonus =
    userOutcome === 'PROMOTED'
      ? (LEAGUE_CATALOG[userNextLeagueId]?.tier ?? 2) === 1
        ? 35_000_000
        : (LEAGUE_CATALOG[userNextLeagueId]?.tier ?? 2) === 2
        ? 8_000_000
        : 2_500_000
      : 0;
  const prizeMoney = Math.round((baseTierPrize * rankFactor + promotionBonus) / 50_000) * 50_000;

  const pickChampion = (rows: StandingRow[]) =>
    rows[0] ? { clubId: rows[0].clubId, clubName: rows[0].clubName, points: rows[0].points } : undefined;

  const leagueChampions: Partial<Record<CompetitionId, { clubId: string; clubName: string; points: number }>> = {};
  for (const lid of ALL_DOMESTIC_LEAGUE_IDS) {
    const ch = pickChampion(standingsByLeague[lid] ?? []);
    if (ch) leagueChampions[lid] = ch;
  }

  const nationalCupWinners: Partial<Record<CompetitionId, { clubId: string; clubName: string }>> = {};
  for (const country of COUNTRY_CATALOG) {
    const win = getCupFinalWinner(finalizedState.contextFixtures[country.primaryCupId] ?? []);
    if (win) nationalCupWinners[country.primaryCupId] = win;
    if (country.secondaryCupId) {
      const swin = getCupFinalWinner(finalizedState.contextFixtures[country.secondaryCupId] ?? []);
      if (swin) nationalCupWinners[country.secondaryCupId] = swin;
    }
    if (country.superCupId && country.superCupId !== 'SHIELD') {
      const supWin = getCupFinalWinner(finalizedState.contextFixtures[country.superCupId] ?? []);
      if (supWin) nationalCupWinners[country.superCupId] = supWin;
    }
  }

  const summary: SeasonEndSummary = {
    seasonLabel,
    seasonIndex: seasonIdx,
    leagueChampions,
    faCupWinner: nationalCupWinners.FACUP,
    carabaoWinner: nationalCupWinners.CARABAO,
    nationalCupWinners,
    uclWinner: getUefaChampion(finalizedState.contextFixtures.UCL ?? []),
    uelWinner: getUefaChampion(finalizedState.contextFixtures.UEL ?? []),
    ueclWinner: getUefaChampion(finalizedState.contextFixtures.UECL ?? []),
    uefaSuperCupWinner: getCupFinalWinner(finalizedState.contextFixtures.UEFASUPERCUP ?? []),
    supercopaWinner: nationalCupWinners.SUPERCOPA,
    mlsCupWinner: nationalCupWinners.MLSCUP,
    movements,
    playoffs,
    userFinishRank,
    userPreviousLeagueId: userLeagueId,
    userNextLeagueId,
    userOutcome,
    prizeMoney,
  };

  return { finalizedState, summary };
}

export function advanceToNextSeason(rawState: CareerState): CareerState {
  const computed = rawState.pendingSeasonSummary
    ? { finalizedState: rawState, summary: rawState.pendingSeasonSummary }
    : computeSeasonEndSummary(rawState);

  const state = computed.finalizedState;
  const summary = computed.summary;

  const nextSeasonIndex = (state.seasonIndex ?? 0) + 1;
  const nextSeasonYear = 2026 + nextSeasonIndex;
  const nextSeasonLabel = formatSeasonLabel(nextSeasonIndex);

  const oldLeagueTeams = getLeagueTeamsFromState(state);
  const teamById = new Map<string, ContextTeam>();
  for (const tier of ALL_DOMESTIC_LEAGUE_IDS) {
    for (const tm of oldLeagueTeams[tier] ?? []) {
      teamById.set(tm.id, tm);
    }
  }

  // Build updated division membership map across all 34 domestic leagues
  const nextDivisionOf = new Map<string, DomesticLeagueId>();
  for (const tier of ALL_DOMESTIC_LEAGUE_IDS) {
    for (const tm of oldLeagueTeams[tier] ?? []) {
      nextDivisionOf.set(tm.id, tier);
    }
  }
  for (const mv of summary.movements) {
    for (const cid of mv.clubIds) {
      if (isDomesticLeagueId(mv.toLeague)) {
        nextDivisionOf.set(cid, mv.toLeague);
      }
    }
  }

  // Roll over players & auto-resolve single-season/half-season loans while preserving 2-season loans
  const returningToClubIdMap = new Map<string, Player[]>();
  const keepTwoYearLoanIds = new Set<string>();
  for (const c of state.clubs) {
    for (const p of c.players) {
      if (p.loanInfo?.direction === 'IN') {
        if ((p.loanInfo.durationSeasons ?? 1) >= 2 && p.loanInfo.returnSeasonYear > nextSeasonYear) {
          keepTwoYearLoanIds.add(p.id);
        } else {
          const homeId = p.loanInfo.counterpartyClubId;
          const list = returningToClubIdMap.get(homeId) ?? [];
          const { loanInfo: _drop, ...cleanPlayer } = p;
          list.push(cleanPlayer);
          returningToClubIdMap.set(homeId, list);
        }
      }
    }
  }

  const rollOverClub = (club: Club, targetLeague: DomesticLeagueId): Club => {
    const ownedAndContinuingLoans = club.players
      .filter((p) => p.loanInfo?.direction !== 'IN' || keepTwoYearLoanIds.has(p.id))
      .map((p) => {
        if (p.loanInfo?.direction === 'IN' && keepTwoYearLoanIds.has(p.id)) {
          return {
            ...p,
            loanInfo: {
              ...p.loanInfo,
              durationSeasons: 1 as const,
            },
          };
        }
        if (
          p.loanInfo?.direction === 'OUT' &&
          (p.loanInfo.durationSeasons ?? 1) >= 2 &&
          p.loanInfo.returnSeasonYear > nextSeasonYear
        ) {
          return {
            ...p,
            loanInfo: {
              ...p.loanInfo,
              durationSeasons: 1 as const,
            },
          };
        }
        const { loanInfo: _clearLoan, ...base } = p;
        return base;
      });
    const extraReturned = (returningToClubIdMap.get(club.id) ?? []).filter(
      (rp) => !ownedAndContinuingLoans.some((op) => op.id === rp.id)
    );
    const mergedPool = [...ownedAndContinuingLoans, ...extraReturned];

    const rolledPlayers: Player[] = mergedPool.map((p) => {
      const nextAge = p.age + 1;
      let nextOvr = p.ovr;
      if (nextAge <= 23 && p.ovr < p.potential) nextOvr = Math.min(p.potential, p.ovr + 1);
      else if (nextAge >= 33 && p.ovr > 62) nextOvr = p.ovr - 1;
      const nextExpiry = p.contractExpiry <= nextSeasonYear ? nextSeasonYear + 1 : p.contractExpiry;
      return {
        ...p,
        age: nextAge,
        ovr: nextOvr,
        fitness: 100,
        suspendedMatches: 0,
        injuredMatches: 0,
        injuryNote: undefined,
        yellowCards: 0,
        redCards: 0,
        goals: 0,
        assists: 0,
        cleanSheets: 0,
        appearances: 0,
        contractExpiry: nextExpiry,
      };
    });

    const rolledIds = new Set(rolledPlayers.map((p) => p.id));
    const availableIds = new Set(
      rolledPlayers.filter((p) => p.loanInfo?.direction !== 'OUT').map((p) => p.id)
    );
    const nextStart = club.startingIds.filter((id) => availableIds.has(id));
    for (const p of rolledPlayers) {
      if (nextStart.length >= 11) break;
      if (p.loanInfo?.direction !== 'OUT' && !nextStart.includes(p.id)) nextStart.push(p.id);
    }
    const nextBench = club.benchIds.filter(
      (id) => rolledIds.has(id) && availableIds.has(id) && !nextStart.includes(id)
    );
    for (const p of rolledPlayers) {
      if (nextBench.length >= BENCH_SIZE) break;
      if (p.loanInfo?.direction !== 'OUT' && !nextStart.includes(p.id) && !nextBench.includes(p.id)) {
        nextBench.push(p.id);
      }
    }

    return {
      ...club,
      leagueId: targetLeague,
      players: rolledPlayers,
      startingIds: nextStart,
      benchIds: nextBench,
    };
  };

  const coachFullName =
    `${state.coach.firstName} ${state.coach.lastName}`.trim() || state.coach.nickname || 'Manager';
  const existingClubMap = new Map<string, Club>();
  for (const c of state.clubs) {
    const fallbackTier: DomesticLeagueId = isDomesticLeagueId(c.leagueId ?? 'PL')
      ? (c.leagueId as DomesticLeagueId)
      : 'PL';
    const targetTier = nextDivisionOf.get(c.id) ?? fallbackTier;
    const rolled = rollOverClub(c, targetTier);
    existingClubMap.set(
      c.id,
      c.id === state.clubId && state.managerContract?.status !== 'SACKED'
        ? { ...rolled, managerName: coachFullName }
        : rolled
    );
  }

  const userNextLeague: DomesticLeagueId = isDomesticLeagueId(summary.userNextLeagueId)
    ? summary.userNextLeagueId
    : 'PL';
  const nextCountry = getCountryForLeague(userNextLeague);

  const nextLeagueTeams = buildAllInitialLeagueTeams();
  for (const lid of ALL_DOMESTIC_LEAGUE_IDS) nextLeagueTeams[lid] = [];

  for (const [cid, tier] of nextDivisionOf.entries()) {
    const existing = existingClubMap.get(cid);
    if (existing) {
      nextLeagueTeams[tier].push({ ...clubToContextTeam(existing), conf: existing.conf, isReserve: existing.isReserve });
    } else if (tier === userNextLeague || (nextCountry.id === 'ENG' && tier === 'PL')) {
      const built = buildWorldClubById(cid, tier) ?? (teamById.get(cid) ? buildCuratedEflClubFromTeam(teamById.get(cid)!, tier) : undefined);
      if (built) {
        const tm = teamById.get(cid);
        const hydrated = { ...built, leagueId: tier, conf: tm?.conf ?? built.conf, isReserve: tm?.isReserve ?? built.isReserve };
        existingClubMap.set(cid, hydrated);
        nextLeagueTeams[tier].push({ ...clubToContextTeam(hydrated), conf: hydrated.conf, isReserve: hydrated.isReserve });
      }
    } else {
      const tm = teamById.get(cid);
      if (tm) nextLeagueTeams[tier].push(tm);
    }
  }

  // Ensure every club stays in nextClubs (keep user league + previously loaded clubs)
  const nextClubs = Array.from(existingClubMap.values());
  const userLeagueClubs = nextClubs.filter((c) => (c.leagueId ?? 'PL') === userNextLeague);
  const cycles = 1;
  const nextFixtures = generateDoubleRoundRobinFixtures(
    userLeagueClubs,
    userNextLeague,
    cycles,
    nextSeasonYear
  );

  // Qualify Season 2+ UEFA clubs dynamically from European top-flight tables & cup winners!
  const prevStandingsByLeague: Partial<Record<DomesticLeagueId, StandingRow[]>> = {};
  for (const lid of ALL_DOMESTIC_LEAGUE_IDS) {
    if (lid === summary.userPreviousLeagueId) {
      const prevClubs = state.clubs.filter((c) => (c.leagueId ?? 'PL') === lid);
      prevStandingsByLeague[lid] = computeStandings(prevClubs, state.fixtures);
    } else {
      prevStandingsByLeague[lid] = state.contextStandings[lid] ?? [];
    }
  }
  const nextUefaSeeds = qualifyNextSeasonUefaTeams(
    prevStandingsByLeague,
    summary.nationalCupWinners ?? {}
  );

  const shieldHomeId = summary.leagueChampions.PL?.clubId ?? nextLeagueTeams.PL[0]?.id ?? state.clubId;
  const shieldAwayId = summary.faCupWinner?.clubId ?? nextLeagueTeams.PL[1]?.id ?? state.clubId;

  // Next season Supercopa de España: LaLiga Top 2 + Copa del Rey finalists (filled to 4 unique from LaLiga table)
  const copaFinal = (state.contextFixtures.COPADELREY ?? []).find((f) => f.round === 7);
  const scCandidates = [
    prevStandingsByLeague.ESP1?.[0]?.clubId,
    prevStandingsByLeague.ESP1?.[1]?.clubId,
    copaFinal?.homeClubId,
    copaFinal?.awayClubId,
    ...(prevStandingsByLeague.ESP1 ?? []).map((r) => r.clubId),
  ].filter((id): id is string => Boolean(id));
  const nextSupercopaTeams = Array.from(new Set(scCandidates)).slice(0, 4);

  const nextUefaSuperCupPair = {
    homeId: summary.uclWinner?.clubId ?? 'fra1_paris_saint_ge_9847',
    awayId: summary.uelWinner?.clubId ?? 'avl',
  };

  const cupData = buildCupFixtures(
    nextClubs,
    nextLeagueTeams,
    userNextLeague,
    state.clubId,
    nextSeasonYear,
    { homeId: shieldHomeId, awayId: shieldAwayId },
    nextUefaSeeds,
    nextSupercopaTeams,
    nextUefaSuperCupPair
  );

  const calendarCupFixtures: Fixture[] = [];
  if (nextCountry.id === 'ENG') {
    calendarCupFixtures.push(...(cupData.CARABAO?.fixtures ?? []), ...(cupData.FACUP?.fixtures ?? []));
  } else {
    calendarCupFixtures.push(...(cupData[nextCountry.primaryCupId]?.fixtures ?? []));
  }
  if (nextCountry.id === 'ESP') {
    calendarCupFixtures.push(...(cupData.SUPERCOPA?.fixtures ?? []));
  }
  calendarCupFixtures.push(...(cupData.UEFASUPERCUP?.fixtures ?? []));
  (['UCL', 'UEL', 'UECL'] as UefaCompId[]).forEach((uId) => {
    calendarCupFixtures.push(...(cupData[uId]?.fixtures ?? []));
  });

  const nextCalendar = buildCalendarForUserClub(
    state.clubId,
    nextFixtures,
    calendarCupFixtures,
    nextSeasonYear
  );

  const nextContextStandings = Object.fromEntries(
    ALL_COMPETITION_IDS.map((cid) => [cid, [] as StandingRow[]])
  ) as Record<CompetitionId, StandingRow[]>;
  const nextContextFixtures = Object.fromEntries(
    ALL_COMPETITION_IDS.map((cid) => [cid, [] as Fixture[]])
  ) as Record<CompetitionId, Fixture[]>;
  for (const [cid, payload] of Object.entries(cupData) as [CompetitionId, { standings: StandingRow[]; fixtures: Fixture[] }][]) {
    nextContextStandings[cid] = payload.standings;
    nextContextFixtures[cid] = payload.fixtures;
  }
  nextContextStandings[userNextLeague] = computeStandings(userLeagueClubs, nextFixtures);
  nextContextFixtures[userNextLeague] = [];

  const openingDate = nextCalendar[0]?.dateIso ?? `${nextSeasonYear}-07-01`;
  const prizeEntry: FinanceEntry = {
    id: `fin_season_${nextSeasonIndex}`,
    dateIso: openingDate,
    type: 'INCOME',
    category: 'PRIZE_MONEY',
    description: `${summary.seasonLabel} Season Prize & ${COMPETITION_THEMES[userNextLeague].name} Broadcast Allocation`,
    amount: summary.prizeMoney,
  };

  // Refresh transfer targets for any newly added clubs if needed
  const existingTargetPlayerIds = new Set(state.transferTargets.map((tItem) => tItem.playerId));
  const extraTargets: TransferTarget[] = [];
  for (const c of nextClubs) {
    if (c.id === state.clubId) continue;
    for (const p of c.players) {
      if (!existingTargetPlayerIds.has(p.id)) {
        extraTargets.push({
          playerId: p.id,
          clubId: c.id,
          scoutStatus: 'UNSCOUTED',
          scoutDaysRemaining: 0,
          shortlisted: false,
          negotiationStatus: 'NONE',
          sellerSatisfaction: 65,
        });
      }
    }
  }

  const prevContract =
    state.managerContract ??
    buildDefaultManagerContract(userNextLeague, openingDate, nextSeasonYear);
  const nextNotifications = [...(state.notifications ?? [])];
  let nextContract: ManagerContract = { ...prevContract };
  if (nextContract.status !== 'SACKED' && nextContract.contractEndSeasonYear <= nextSeasonYear) {
    nextContract = {
      ...nextContract,
      status: 'EXPIRING',
    };
    nextNotifications.unshift({
      id: `notif_mgr_exp_${nextSeasonYear}`,
      dateIso: openingDate,
      type: 'BOARD',
      title: 'Manager Contract Expiring This Season',
      message: `Your manager contract expires at the end of ${nextSeasonLabel}. Renew in Job Market or explore new clubs.`,
      read: false,
    });
  }

  const nextClubManagers: Record<string, ClubManagerInfo> = {
    ...(state.clubManagers ?? {}),
  };
  for (const tier of ALL_DOMESTIC_LEAGUE_IDS) {
    for (const tm of nextLeagueTeams[tier] ?? []) {
      const prevInfo = nextClubManagers[tm.id];
      const offer = computeManagerWeeklyOffer(tier, tm.ovr);
      if (tm.id === state.clubId) {
        nextClubManagers[tm.id] = {
          clubId: tm.id,
          managerName: `${state.coach.firstName} ${state.coach.lastName}`.trim() || state.coach.nickname,
          satisfaction: state.boardSatisfaction,
          contractEndSeasonYear: nextContract.contractEndSeasonYear,
          status: nextContract.status === 'SACKED' ? 'VACANT' : nextContract.status === 'EXPIRING' ? 'EXPIRING' : 'SECURE',
          weeklyBudgetOffer: offer,
        };
      } else if (prevInfo) {
        const rolledEnd =
          prevInfo.contractEndSeasonYear <= nextSeasonYear
            ? nextSeasonYear + 2
            : prevInfo.contractEndSeasonYear;
        nextClubManagers[tm.id] = {
          ...prevInfo,
          managerName:
            prevInfo.status === 'VACANT'
              ? tm.managerName ?? `${tm.shortName} Coach`
              : prevInfo.managerName,
          satisfaction: prevInfo.status === 'VACANT' ? 68 : Math.max(48, Math.min(88, prevInfo.satisfaction)),
          contractEndSeasonYear: rolledEnd,
          status: rolledEnd <= nextSeasonYear + 1 ? 'EXPIRING' : 'SECURE',
          weeklyBudgetOffer: offer,
        };
      } else {
        nextClubManagers[tm.id] = {
          clubId: tm.id,
          managerName: tm.managerName ?? `${tm.shortName} Coach`,
          satisfaction: 68,
          contractEndSeasonYear: nextSeasonYear + 2,
          status: 'SECURE',
          weeklyBudgetOffer: offer,
        };
      }
    }
  }

  const nextSeasonObjectives = buildSeasonObjectivesForClub(
    state.clubId,
    userNextLeague,
    nextLeagueTeams,
    nextClubs,
    nextSeasonIndex
  );

  const nextBase: CareerState = {
    ...state,
    seasonIndex: nextSeasonIndex,
    seasonLabel: nextSeasonLabel,
    countryId: nextCountry.id,
    userLeagueId: userNextLeague,
    uefaParticipants: nextUefaSeeds,
    seasonObjectives: nextSeasonObjectives,
    currentDayIndex: 0,
    currentRound: 1,
    calendar: nextCalendar,
    clubs: nextClubs,
    leagueTeams: nextLeagueTeams,
    fixtures: nextFixtures,
    contextStandings: nextContextStandings,
    contextFixtures: nextContextFixtures,
    transferTargets: [...state.transferTargets, ...extraTargets],
    budget: state.budget + summary.prizeMoney,
    financeLedger: [prizeEntry, ...state.financeLedger],
    pendingSeasonSummary: null,
    seasonHistory: [...(state.seasonHistory ?? []), summary],
    matchdayOverride: null,
    deadlineHoursRemaining: nextCalendar[0]?.isDeadlineDay ? 24 : null,
    managerContract: nextContract,
    clubManagers: nextClubManagers,
    notifications: nextNotifications.slice(0, 40),
  };

  const synced = syncParallelCompetitions(nextBase, openingDate);
  const rolledState: CareerState = {
    ...nextBase,
    ...synced,
  };
  return {
    ...rolledState,
    seasonObjectives: evaluateSeasonObjectives(rolledState),
  };
}

export function evaluateContractOffer(
  player: Player,
  offer: ContractOffer,
  availableBudget: number
): {
  accepted: boolean;
  satisfaction: number;
  immediateCost: number;
  recommendation: string;
} {
  const immediateCost = offer.signingFee + offer.agentFee;
  if (immediateCost > availableBudget) {
    return {
      accepted: false,
      satisfaction: 10,
      immediateCost,
      recommendation: 'Insufficient club budget to cover signing and agent fees.',
    };
  }

  const targetWage = Math.round(player.weeklyWage * 1.1);
  const wageRatio = offer.weeklyWage / Math.max(1, targetWage);
  let score = 45;

  if (wageRatio >= 1.15) score += 32;
  else if (wageRatio >= 1.0) score += 22;
  else if (wageRatio >= 0.88) score += 8;
  else score -= 25;

  if (offer.signingFee >= player.weeklyWage * 4) score += 10;
  if (offer.extendByYears >= 2 && offer.extendByYears <= 4) score += 8;
  if (offer.squadStatus === 'Crucial' || offer.squadStatus === player.squadStatus) score += 8;
  else if (offer.squadStatus === 'Sporadic' && player.ovr >= 82) score -= 20;
  if (offer.bonusPerGoal >= player.goalBonus) score += 5;

  const satisfaction = Math.max(5, Math.min(100, Math.round(score)));
  const accepted = satisfaction >= 68;

  let recommendation = '';
  if (accepted) {
    recommendation = `${player.name}'s camp is satisfied with the package and ready to sign.`;
  } else if (wageRatio < 0.95) {
    recommendation = `Scout recommends raising weekly wages closer to ${formatCurrency(targetWage)}/wk.`;
  } else {
    recommendation = 'Agent requests a stronger squad role guarantee or higher signing fee.';
  }

  return { accepted, satisfaction, immediateCost, recommendation };
}

export function evaluateTransferOffer(
  targetPlayer: Player,
  offer: TransferOffer,
  availableBudget: number,
  exchangePlayer: Player | null
): {
  status: 'ACCEPTED' | 'REJECTED' | 'IN_PROGRESS';
  satisfaction: number;
  paidNow: number;
  futurePayments: number;
  potentialAddons: number;
  insufficientBudget: boolean;
  message: string;
} {
  if (offer.dealType === 'LOAN') {
    const loanFee = Math.max(0, offer.loanFee ?? 0);
    const wageSplit = Math.max(0, Math.min(100, offer.loanWageSplitPct ?? 60));
    const duration: 0.5 | 1 | 2 =
      offer.loanDurationSeasons === 0.5 ? 0.5 : offer.loanDurationSeasons === 2 ? 2 : 1;
    const buyClause = Math.max(0, offer.buyOptionFee ?? 0);
    const insufficientBudget = loanFee > availableBudget;

    if (insufficientBudget) {
      return {
        status: 'IN_PROGRESS',
        satisfaction: 25,
        paidNow: loanFee,
        futurePayments: 0,
        potentialAddons: buyClause,
        insufficientBudget: true,
        message: 'Insufficient budget to cover the upfront loan fee.',
      };
    }

    const expectedFee = Math.round(targetPlayer.marketValue * 0.06 * duration);
    const feeScore = expectedFee > 0 ? Math.min(1.25, loanFee / expectedFee) : 1;
    const optionBonus = buyClause >= targetPlayer.marketValue * 0.95 ? 10 : buyClause > 0 ? 4 : 0;
    const score = Math.round(wageSplit * 0.72 + feeScore * 32 + optionBonus);
    const satisfaction = Math.max(10, Math.min(100, score));

    if (satisfaction >= 68 && wageSplit >= 45) {
      return {
        status: 'ACCEPTED',
        satisfaction,
        paidNow: loanFee,
        futurePayments: 0,
        potentialAddons: buyClause,
        insufficientBudget: false,
        message: `Loan agreement approved (${duration === 0.5 ? 'Half-Season' : `${duration}S`}, ${wageSplit}% wage coverage${loanFee > 0 ? `, ${formatCurrency(loanFee)} loan fee` : ''})!`,
      };
    }
    if (satisfaction >= 45) {
      return {
        status: 'IN_PROGRESS',
        satisfaction,
        paidNow: loanFee,
        futurePayments: 0,
        potentialAddons: buyClause,
        insufficientBudget: false,
        message: `Parent club seeks higher wage coverage (55%+) or a small loan fee for ${targetPlayer.name}.`,
      };
    }
    return {
      status: 'REJECTED',
      satisfaction,
      paidNow: loanFee,
      futurePayments: 0,
      potentialAddons: buyClause,
      insufficientBudget: false,
      message: 'Loan proposal rejected due to low wage contribution.',
    };
  }

  const paidNow = computePaidNow(offer.transferFee, offer);
  const futurePayments = Math.max(0, offer.transferFee - paidNow);
  const potentialAddons = offer.bonusAfterAppearances;
  const insufficientBudget = paidNow > availableBudget;

  if (insufficientBudget) {
    return {
      status: 'IN_PROGRESS',
      satisfaction: 25,
      paidNow,
      futurePayments,
      potentialAddons,
      insufficientBudget: true,
      message: 'Insufficient budget for the upfront transfer payment.',
    };
  }

  const upfrontRatio = offer.transferFee > 0 ? paidNow / offer.transferFee : 1;
  const exchangeValue = exchangePlayer ? Math.round(exchangePlayer.marketValue * 0.85) : 0;
  const effectiveCashValue = Math.round(offer.transferFee * (0.94 + upfrontRatio * 0.06));
  const totalPackage = effectiveCashValue + exchangeValue + Math.round(offer.bonusAfterAppearances * 0.6);
  const askingPrice = Math.round(targetPlayer.marketValue * 1.08);
  const ratio = totalPackage / Math.max(1, askingPrice);

  let satisfaction = Math.round(ratio * 72 + offer.sellOnShare * 0.5);
  satisfaction = Math.max(10, Math.min(100, satisfaction));

  if (ratio >= 0.96) {
    return {
      status: 'ACCEPTED',
      satisfaction,
      paidNow,
      futurePayments,
      potentialAddons,
      insufficientBudget: false,
      message: `Bid accepted by selling club! Proceed to player contract terms.`,
    };
  }
  if (ratio >= 0.72) {
    return {
      status: 'IN_PROGRESS',
      satisfaction,
      paidNow,
      futurePayments,
      potentialAddons,
      insufficientBudget: false,
      message: `Club values ${targetPlayer.name} closer to ${formatCurrency(askingPrice)}.`,
    };
  }
  return {
    status: 'REJECTED',
    satisfaction,
    paidNow,
    futurePayments,
    potentialAddons,
    insufficientBudget: false,
    message: 'Offer rejected outright as significantly below valuation.',
  };
}

export function promoteAcademyProspect(state: CareerState, academyId: string): CareerState {
  const prospect = state.academy.find((a) => a.id === academyId && !a.promoted);
  if (!prospect) return state;

  const userClub = state.clubs.find((c) => c.id === state.clubId);
  if (!userClub) return state;

  const usedNumbers = new Set(userClub.players.map((p) => p.shirtNumber));
  let freeShirt = 35;
  while (usedNumbers.has(freeShirt) && freeShirt < 99) freeShirt++;

  const detailedPosition: DetailedPosition =
    prospect.position === 'GK'
      ? 'GK'
      : prospect.position === 'DEF'
      ? 'CB'
      : prospect.position === 'MID'
      ? 'CM'
      : 'LW';
  const role: PlayerRole =
    prospect.position === 'GK'
      ? 'Sweeper Keeper'
      : prospect.position === 'DEF'
      ? 'Ball-Playing Defender'
      : prospect.position === 'MID'
      ? 'Box-to-Box'
      : 'Inside Forward';
  const pid = `prom_${prospect.id}`;
  const meta = derivePlayerMeta({ id: pid, position: prospect.position, ovr: prospect.ovr, role });
  const seed = prospect.ovr * 19 + freeShirt * 11;
  const secondaryPositions = deriveDefaultSecondaryPositions(detailedPosition, seed);
  const roleMastery = deriveDefaultRoleMastery(detailedPosition, role, prospect.ovr, seed);

  const promotedPlayer: Player = {
    id: pid,
    name: prospect.name,
    nationality: prospect.nationality,
    age: prospect.age,
    heightCm: prospect.position === 'GK' ? 188 : 178,
    preferredFoot: 'Right',
    weakFoot: meta.weakFoot,
    skillMoves: prospect.position === 'GK' ? 1 : 3,
    attackingWorkRate: meta.attackingWorkRate,
    defensiveWorkRate: meta.defensiveWorkRate,
    playStyles: meta.playStyles,
    shirtNumber: freeShirt,
    position: prospect.position,
    detailedPosition,
    secondaryPositions,
    ovr: prospect.ovr,
    potential: prospect.potential,
    fitness: 98,
    suspendedMatches: 0,
    injuredMatches: 0,
    yellowCards: 0,
    redCards: 0,
    goals: 0,
    assists: 0,
    cleanSheets: 0,
    appearances: 0,
    marketValue: Math.max(850_000, (prospect.ovr - 55) * 280_000),
    weeklyWage: 12_000,
    contractExpiry: 2030,
    squadStatus: 'Prospect',
    releaseClause: 12_000_000,
    goalBonus: 3000,
    forSale: false,
    role,
    roleMastery,
    attributes: buildDetailedAttributes(prospect.position, prospect.ovr, seed),
  };

  return {
    ...state,
    clubs: state.clubs.map((c) =>
      c.id === state.clubId
        ? {
            ...c,
            players: [...c.players, promotedPlayer],
            benchIds:
              c.benchIds.length < BENCH_SIZE ? [...c.benchIds, promotedPlayer.id] : c.benchIds,
          }
        : c
    ),
    academy: state.academy.map((a) => (a.id === academyId ? { ...a, promoted: true } : a)),
  };
}

export function evaluateIncomingBidCounter(
  state: CareerState,
  bidId: string,
  counterOfferOrFee: number | TransferOffer,
  counterSellOn = 0
): {
  nextState: CareerState;
  outcome: 'ACCEPTED' | 'COUNTERED' | 'WALKED';
  message: string;
} {
  const bids = state.incomingBids ?? [];
  const targetBid = bids.find((b) => b.id === bidId && b.status === 'PENDING');
  if (!targetBid) {
    return {
      nextState: state,
      outcome: 'WALKED',
      message: 'This transfer bid is no longer active.',
    };
  }

  const terms: TransferOffer =
    typeof counterOfferOrFee === 'number'
      ? {
          dealType: targetBid.bidType ?? 'PERMANENT',
          startDate: targetBid.offeredTerms?.startDate ?? 'Immediate',
          transferFee: counterOfferOrFee,
          installments: targetBid.offeredTerms?.installments ?? 0,
          exchangePlayerId: targetBid.offeredTerms?.exchangePlayerId ?? null,
          bonusAfterAppearances: targetBid.offeredTerms?.bonusAfterAppearances ?? 0,
          sellOnShare: counterSellOn,
          loanFee: targetBid.bidType === 'LOAN' ? counterOfferOrFee : targetBid.offeredTerms?.loanFee,
          loanWageSplitPct: targetBid.offeredTerms?.loanWageSplitPct ?? targetBid.loanWageSplitPct,
          loanDurationSeasons: targetBid.offeredTerms?.loanDurationSeasons,
          buyOptionFee: targetBid.offeredTerms?.buyOptionFee,
        }
      : counterOfferOrFee;

  if (targetBid.bidType === 'LOAN' || terms.dealType === 'LOAN') {
    const reqLoanFee = Math.max(0, terms.loanFee ?? terms.transferFee ?? 0);
    const reqSplit = Math.max(0, Math.min(100, terms.loanWageSplitPct ?? 60));
    const reqDuration: 0.5 | 1 | 2 =
      terms.loanDurationSeasons === 0.5 ? 0.5 : terms.loanDurationSeasons === 2 ? 2 : 1;
    const reqBuyOption = Math.max(0, terms.buyOptionFee ?? 0);
    const prevSplit = targetBid.offeredTerms?.loanWageSplitPct ?? targetBid.loanWageSplitPct ?? 60;
    const splitPenalty = Math.max(0, reqSplit - prevSplit) * 28_000;
    const effectiveDemand = reqLoanFee + splitPenalty;
    const patienceDrop = effectiveDemand > targetBid.buyerMaxFee ? 30 : 12;
    const nextPatience = Math.max(0, targetBid.patience - patienceDrop);

    if (effectiveDemand <= targetBid.buyerMaxFee && reqSplit <= 95) {
      const updatedTerms: TransferOffer = {
        ...terms,
        dealType: 'LOAN',
        transferFee: reqLoanFee,
        loanFee: reqLoanFee,
        loanWageSplitPct: reqSplit,
        loanDurationSeasons: reqDuration,
        buyOptionFee: reqBuyOption,
      };
      const durText = reqDuration === 0.5 ? 'Half-Season' : reqDuration === 2 ? '2 Seasons' : '1 Season';
      const msg = `${targetBid.buyingClubName} agreed to your loan terms (${durText}, ${reqSplit}% wages${reqLoanFee > 0 ? `, ${formatCurrency(reqLoanFee)} fee` : ''}${reqBuyOption > 0 ? `, ${formatCurrency(reqBuyOption)} buy option` : ''}).`;
      const updatedBids = bids.map((b) =>
        b.id === bidId
          ? {
              ...b,
              offeredFee: reqLoanFee,
              loanWageSplitPct: reqSplit,
              offeredTerms: updatedTerms,
              paidNow: reqLoanFee,
              futurePayments: 0,
              potentialAddons: reqBuyOption,
              buyerSatisfaction: 82,
              patience: nextPatience,
              roundCount: b.roundCount + 1,
              lastMessage: msg,
            }
          : b
      );
      return {
        nextState: { ...state, incomingBids: updatedBids },
        outcome: 'ACCEPTED',
        message: msg,
      };
    }

    if (nextPatience <= 0 || effectiveDemand > targetBid.buyerMaxFee * 1.35) {
      const msg = `${targetBid.buyingClubName} walked away from loan talks after terms exceeded their budget.`;
      const updatedBids: IncomingTransferBid[] = bids.map((b) =>
        b.id === bidId
          ? {
              ...b,
              patience: 0,
              buyerSatisfaction: 12,
              roundCount: b.roundCount + 1,
              status: 'REJECTED' as const,
              lastMessage: msg,
            }
          : b
      );
      const updatedNotifs = (state.notifications ?? []).map((n) =>
        n.bidId === bidId ? { ...n, read: true, resolved: true } : n
      );
      return {
        nextState: { ...state, incomingBids: updatedBids, notifications: updatedNotifs },
        outcome: 'WALKED',
        message: msg,
      };
    }

    const improvedFee = Math.min(
      targetBid.buyerMaxFee,
      Math.round(((targetBid.offeredFee + Math.min(reqLoanFee, targetBid.buyerMaxFee)) / 2) / 100_000) * 100_000
    );
    const improvedSplit = Math.min(90, Math.round((prevSplit + reqSplit) / 2));
    const counteredTerms: TransferOffer = {
      ...terms,
      dealType: 'LOAN',
      transferFee: improvedFee,
      loanFee: improvedFee,
      loanWageSplitPct: improvedSplit,
      loanDurationSeasons: reqDuration,
      buyOptionFee: reqBuyOption,
    };
    const msg = `${targetBid.buyingClubName} countered loan terms: ${improvedSplit}% wages, ${formatCurrency(improvedFee)} fee.`;
    const updatedBids = bids.map((b) =>
      b.id === bidId
        ? {
            ...b,
            offeredFee: improvedFee,
            loanWageSplitPct: improvedSplit,
            offeredTerms: counteredTerms,
            paidNow: improvedFee,
            futurePayments: 0,
            potentialAddons: reqBuyOption,
            buyerSatisfaction: 55,
            patience: nextPatience,
            roundCount: b.roundCount + 1,
            lastMessage: msg,
          }
        : b
    );
    return {
      nextState: { ...state, incomingBids: updatedBids },
      outcome: 'COUNTERED',
      message: msg,
    };
  }

  const buyingClub = state.clubs.find((c) => c.id === targetBid.buyingClubId);
  const requestedExchange = terms.exchangePlayerId
    ? buyingClub?.players.find((p) => p.id === terms.exchangePlayerId) ?? null
    : null;
  const exchangeCost = requestedExchange ? Math.round(requestedExchange.marketValue * 0.9) : 0;
  const effectivePackage =
    terms.transferFee + exchangeCost + Math.round(terms.bonusAfterAppearances * 0.55);

  const effectiveSeasons =
    terms.installmentSeasons ??
    (terms.installments >= 36 ? 3 : terms.installments >= 24 ? 2 : terms.installments >= 12 ? 1 : 0);
  const paidNow = computePaidNow(terms.transferFee, terms);
  const futurePayments = Math.max(0, terms.transferFee - paidNow);
  const deferredFraction = terms.transferFee > 0 ? futurePayments / terms.transferFee : 0;
  const installmentHeadroom = 1 + deferredFraction * (effectiveSeasons * 0.045);
  const effectiveLimit =
    targetBid.buyerMaxFee *
    installmentHeadroom *
    (1 - Math.min(25, terms.sellOnShare) * 0.004);
  const patienceDrop = effectivePackage > effectiveLimit ? 30 : 10;
  const nextPatience = Math.max(0, targetBid.patience - patienceDrop);

  const ratio = effectivePackage / Math.max(1, effectiveLimit);
  const buyerSatisfaction = Math.max(8, Math.min(100, Math.round(108 - ratio * 42)));

  if (effectivePackage <= effectiveLimit) {
    const msg = `${targetBid.buyingClubName} accepted your ${formatCurrency(terms.transferFee)}${requestedExchange ? ` + ${requestedExchange.name}` : ''}${terms.sellOnShare > 0 ? ` + ${terms.sellOnShare}% sell-on` : ''} terms!`;
    const updatedBids = bids.map((b) =>
      b.id === bidId
        ? {
            ...b,
            offeredFee: terms.transferFee,
            sellOnShare: terms.sellOnShare,
            offeredTerms: terms,
            paidNow,
            futurePayments,
            potentialAddons: terms.bonusAfterAppearances,
            buyerSatisfaction,
            patience: nextPatience,
            roundCount: b.roundCount + 1,
            lastMessage: msg,
          }
        : b
    );
    return {
      nextState: { ...state, incomingBids: updatedBids },
      outcome: 'ACCEPTED',
      message: msg,
    };
  }

  if (nextPatience <= 0 || effectivePackage > effectiveLimit * 1.28) {
    const msg = `${targetBid.buyingClubName} walked away after your ${formatCurrency(terms.transferFee)} package exceeded their ceiling.`;
    const updatedBids: IncomingTransferBid[] = bids.map((b) =>
      b.id === bidId
        ? {
            ...b,
            patience: 0,
            buyerSatisfaction: 12,
            roundCount: b.roundCount + 1,
            status: 'REJECTED' as const,
            lastMessage: msg,
          }
        : b
    );
    const updatedNotifs = (state.notifications ?? []).map((n) =>
      n.bidId === bidId ? { ...n, read: true, resolved: true } : n
    );
    return {
      nextState: { ...state, incomingBids: updatedBids, notifications: updatedNotifs },
      outcome: 'WALKED',
      message: msg,
    };
  }

  const maxCashAllowed = Math.max(targetBid.offeredFee, Math.round(effectiveLimit - exchangeCost - terms.bonusAfterAppearances * 0.55));
  const midpoint = Math.min(
    maxCashAllowed,
    Math.round((targetBid.offeredFee * 0.45 + Math.min(terms.transferFee, maxCashAllowed) * 0.55) / 100_000) * 100_000
  );
  const improvedFee = Math.max(targetBid.offeredFee, midpoint);
  const counteredTerms: TransferOffer = {
    ...terms,
    transferFee: improvedFee,
  };
  const cPaidNow = computePaidNow(improvedFee, counteredTerms);
  const cFuture = Math.max(0, improvedFee - cPaidNow);
  const upPctLabel =
    typeof counteredTerms.upfrontPct === 'number'
      ? `${counteredTerms.upfrontPct}% upfront`
      : counteredTerms.installments === 0
      ? 'Upfront'
      : `${counteredTerms.installments}m`;
  const msg = `${targetBid.buyingClubName} countered with ${formatCurrency(improvedFee)} (${upPctLabel}${counteredTerms.sellOnShare > 0 ? `, ${counteredTerms.sellOnShare}% sell-on` : ''}).`;
  const updatedBids = bids.map((b) =>
    b.id === bidId
      ? {
          ...b,
          offeredFee: improvedFee,
          sellOnShare: counteredTerms.sellOnShare,
          offeredTerms: counteredTerms,
          paidNow: cPaidNow,
          futurePayments: cFuture,
          potentialAddons: counteredTerms.bonusAfterAppearances,
          buyerSatisfaction,
          patience: nextPatience,
          roundCount: b.roundCount + 1,
          lastMessage: msg,
        }
      : b
  );
  return {
    nextState: { ...state, incomingBids: updatedBids },
    outcome: 'COUNTERED',
    message: msg,
  };
}

export function acceptIncomingTransferBid(state: CareerState, bidId: string): CareerState {
  const bids = state.incomingBids ?? [];
  const bid = bids.find((b) => b.id === bidId && b.status === 'PENDING');
  if (!bid) return state;

  if (bid.bidType === 'LOAN' || bid.offeredTerms?.dealType === 'LOAN') {
    const terms = bid.offeredTerms;
    const split = terms?.loanWageSplitPct ?? bid.loanWageSplitPct ?? 60;
    const fee = terms?.loanFee ?? bid.offeredFee ?? 0;
    const afterLoan = completeLoanOutDeal(state, bid.playerId, bid.buyingClubId, split, fee, {
      durationSeasons: terms?.loanDurationSeasons ?? 1,
      buyOptionFee: terms?.buyOptionFee ?? 0,
    });
    return {
      ...afterLoan,
      incomingBids: (afterLoan.incomingBids ?? []).map((b) =>
        b.id === bidId
          ? {
              ...b,
              status: 'ACCEPTED',
              lastMessage: 'Loan offer accepted and player departed temporarily.',
            }
          : b
      ),
      notifications: (afterLoan.notifications ?? []).map((n) =>
        n.bidId === bidId ? { ...n, read: true, resolved: true } : n
      ),
    };
  }

  const userClub = state.clubs.find((c) => c.id === state.clubId);
  if (!userClub) return state;
  const soldPlayer = userClub.players.find((p) => p.id === bid.playerId);
  if (!soldPlayer) return rejectIncomingTransferBid(state, bidId);

  const dateIso = state.calendar[state.currentDayIndex]?.dateIso ?? '2026-07-01';
  const installments = bid.offeredTerms?.installments ?? 0;
  const totalFee = bid.offeredTerms?.transferFee ?? bid.offeredFee;
  const receivedNow =
    bid.paidNow ?? computePaidNow(totalFee, bid.offeredTerms ?? installments);
  const exchangePlayerId = bid.offeredTerms?.exchangePlayerId ?? null;
  const buyingClub = state.clubs.find((c) => c.id === bid.buyingClubId);
  const incomingExchangeRaw = exchangePlayerId
    ? buyingClub?.players.find((p) => p.id === exchangePlayerId) ?? null
    : null;

  let incomingExchange: Player | null = null;
  if (incomingExchangeRaw) {
    const usedNums = new Set(userClub.players.filter((p) => p.id !== soldPlayer.id).map((p) => p.shirtNumber));
    let nextShirt = incomingExchangeRaw.shirtNumber;
    while (usedNums.has(nextShirt) && nextShirt < 99) nextShirt++;
    incomingExchange = {
      ...incomingExchangeRaw,
      shirtNumber: nextShirt,
      forSale: false,
      forLoan: false,
      loanInfo: undefined,
    };
  }

  const nextClubs = state.clubs.map((c) => {
    if (c.id === state.clubId) {
      let remaining = c.players.filter((p) => p.id !== soldPlayer.id);
      if (incomingExchange) {
        remaining = [...remaining, incomingExchange];
      }
      let nextStarting = c.startingIds.filter((id) => id !== soldPlayer.id);
      let nextBench = c.benchIds.filter((id) => id !== soldPlayer.id);
      if (nextStarting.length < 11) {
        const replacement =
          nextBench[0] ??
          remaining.find((p) => !nextStarting.includes(p.id) && isPlayerAvailableForMatchday(p))?.id;
        if (replacement) {
          nextStarting = [...nextStarting, replacement];
          nextBench = nextBench.filter((id) => id !== replacement);
        }
      }
      if (incomingExchange && nextBench.length < BENCH_SIZE) {
        nextBench = [...nextBench, incomingExchange.id];
      }
      return {
        ...c,
        balance: c.balance + receivedNow,
        players: remaining,
        startingIds: nextStarting,
        benchIds: nextBench,
      };
    }
    if (c.id === bid.buyingClubId) {
      const moved: Player = {
        ...soldPlayer,
        forSale: false,
        forLoan: false,
        loanInfo: undefined,
      };
      const basePlayers = incomingExchange
        ? c.players.filter((p) => p.id !== incomingExchange.id)
        : c.players;
      let nextStarting = incomingExchange
        ? c.startingIds.filter((id) => id !== incomingExchange.id)
        : [...c.startingIds];
      let nextBench = incomingExchange
        ? c.benchIds.filter((id) => id !== incomingExchange.id)
        : [...c.benchIds];
      const movedPlayers = [...basePlayers, moved];
      if (nextStarting.length < 11) {
        const rep =
          nextBench[0] ??
          movedPlayers.find((p) => !nextStarting.includes(p.id) && isPlayerAvailableForMatchday(p))?.id;
        if (rep) {
          nextStarting = [...nextStarting, rep];
          nextBench = nextBench.filter((id) => id !== rep);
        }
      }
      return {
        ...c,
        balance: Math.max(0, c.balance - receivedNow),
        players: movedPlayers,
        startingIds: nextStarting,
        benchIds: nextBench,
      };
    }
    return c;
  });

  const ledgerEntry: FinanceEntry = {
    id: `fin_sale_${bid.id}`,
    dateIso,
    type: 'INCOME',
    category: 'PLAYER_SALE',
    description: `Sold ${soldPlayer.name} to ${bid.buyingClubName}${incomingExchange ? ` + ${incomingExchange.name}` : ''}${bid.sellOnShare > 0 ? ` (${bid.sellOnShare}% sell-on)` : ''}`,
    amount: receivedNow,
  };

  return {
    ...state,
    clubs: nextClubs,
    budget: state.budget + receivedNow,
    financeLedger: [ledgerEntry, ...state.financeLedger],
    incomingBids: bids.map((b) =>
      b.id === bidId
        ? {
            ...b,
            status: 'ACCEPTED',
            lastMessage: `Deal completed (${totalFee === receivedNow ? `${formatCurrency(receivedNow)} upfront` : `${formatCurrency(receivedNow)} now / ${formatCurrency(totalFee)} total`}).`,
          }
        : b
    ),
    notifications: (state.notifications ?? []).map((n) =>
      n.bidId === bidId ? { ...n, read: true, resolved: true } : n
    ),
  };
}

export function rejectIncomingTransferBid(state: CareerState, bidId: string): CareerState {
  const bids = state.incomingBids ?? [];
  return {
    ...state,
    incomingBids: bids.map((b) =>
      b.id === bidId ? { ...b, status: 'REJECTED', lastMessage: 'Offer declined by club.' } : b
    ),
    notifications: (state.notifications ?? []).map((n) =>
      n.bidId === bidId ? { ...n, read: true, resolved: true } : n
    ),
  };
}

export function completeLoanInDeal(
  state: CareerState,
  playerId: string,
  parentClubId: string,
  offer: TransferOffer
): CareerState {
  const userClub = state.clubs.find((c) => c.id === state.clubId);
  const parentClub = state.clubs.find((c) => c.id === parentClubId && c.id !== state.clubId);
  if (!userClub || !parentClub) return state;

  const target = parentClub.players.find((p) => p.id === playerId && !p.loanInfo);
  if (!target) return state;

  const loanFee = Math.max(0, offer.loanFee ?? 0);
  if (loanFee > state.budget) return state;

  const cleanSplit = Math.max(0, Math.min(100, offer.loanWageSplitPct ?? 60));
  const duration: 0.5 | 1 | 2 =
    offer.loanDurationSeasons === 0.5 ? 0.5 : offer.loanDurationSeasons === 2 ? 2 : 1;
  const buyOptionFee = Math.max(0, offer.buyOptionFee ?? 0);
  const seasonStartYear = 2026 + (state.seasonIndex ?? 0);
  const dateIso = state.calendar[state.currentDayIndex]?.dateIso ?? `${seasonStartYear}-07-01`;
  const month = Number(dateIso.slice(5, 7)) || 7;
  const halfSeasonWindow =
    duration === 0.5 ? (month >= 7 ? 'SUMMER_TO_JAN' : 'JAN_TO_SUMMER') : undefined;
  const returnYear = seasonStartYear + (duration === 2 ? 2 : 1);

  const usedNumbers = new Set(userClub.players.map((p) => p.shirtNumber));
  let assignedShirt = target.shirtNumber;
  while (usedNumbers.has(assignedShirt) && assignedShirt < 99) assignedShirt++;

  const loanedInPlayer: Player = {
    ...target,
    shirtNumber: assignedShirt,
    forSale: false,
    forLoan: false,
    loanInfo: {
      direction: 'IN',
      counterpartyClubId: parentClub.id,
      counterpartyClubName: parentClub.name,
      wageSharePct: cleanSplit,
      returnSeasonYear: returnYear,
      loanFee,
      buyOptionFee: buyOptionFee > 0 ? buyOptionFee : undefined,
      durationSeasons: duration,
      halfSeasonWindow,
    },
  };

  const loanedOutCopy: Player = {
    ...target,
    forSale: false,
    forLoan: false,
    loanInfo: {
      direction: 'OUT',
      counterpartyClubId: userClub.id,
      counterpartyClubName: userClub.name,
      wageSharePct: Math.max(0, 100 - cleanSplit),
      returnSeasonYear: returnYear,
      loanFee,
      buyOptionFee: buyOptionFee > 0 ? buyOptionFee : undefined,
      durationSeasons: duration,
      halfSeasonWindow,
    },
  };

  const nextClubs = state.clubs.map((c) => {
    if (c.id === userClub.id) {
      const nextPlayers = [...c.players, loanedInPlayer];
      const nextBench =
        c.benchIds.length < BENCH_SIZE ? [...c.benchIds, loanedInPlayer.id] : c.benchIds;
      return {
        ...c,
        balance: Math.max(0, c.balance - loanFee),
        players: nextPlayers,
        benchIds: nextBench,
      };
    }
    if (c.id === parentClub.id) {
      const nextPlayers = c.players.map((p) => (p.id === target.id ? loanedOutCopy : p));
      let nextStarting = c.startingIds.filter((id) => id !== target.id);
      let nextBench = c.benchIds.filter((id) => id !== target.id);
      if (nextStarting.length < 11) {
        const rep =
          nextBench[0] ??
          nextPlayers.find((p) => !nextStarting.includes(p.id) && isPlayerAvailableForMatchday(p))?.id;
        if (rep) {
          nextStarting = [...nextStarting, rep];
          nextBench = nextBench.filter((id) => id !== rep);
        }
      }
      return {
        ...c,
        balance: c.balance + loanFee,
        players: nextPlayers,
        startingIds: nextStarting,
        benchIds: nextBench,
      };
    }
    return c;
  });

  const ledgerAdditions: FinanceEntry[] =
    loanFee > 0
      ? [
          {
            id: `fin_loan_in_${Date.now()}_${target.id}`,
            dateIso,
            type: 'EXPENSE',
            category: 'LOAN_FEE',
            description: `Loaned in ${target.name} from ${parentClub.name} (${duration === 0.5 ? 'Half Season' : `${duration}S`}, ${cleanSplit}% wages)`,
            amount: loanFee,
          },
        ]
      : [];

  return {
    ...state,
    clubs: nextClubs,
    budget: Math.max(0, state.budget - loanFee),
    financeLedger: [...ledgerAdditions, ...state.financeLedger],
    transferTargets: state.transferTargets.map((t) =>
      t.playerId === playerId ? { ...t, negotiationStatus: 'COMPLETED' } : t
    ),
  };
}

export function exerciseLoanBuyOption(state: CareerState, playerId: string): CareerState {
  const userClub = state.clubs.find((c) => c.id === state.clubId);
  if (!userClub) return state;
  const player = userClub.players.find(
    (p) => p.id === playerId && p.loanInfo?.direction === 'IN' && (p.loanInfo.buyOptionFee ?? 0) > 0
  );
  if (!player || !player.loanInfo?.buyOptionFee) return state;

  const fee = player.loanInfo.buyOptionFee;
  if (fee > state.budget) return state;

  const parentClubId = player.loanInfo.counterpartyClubId;
  const parentClubName = player.loanInfo.counterpartyClubName;
  const dateIso = state.calendar[state.currentDayIndex]?.dateIso ?? '2026-07-01';

  const nextClubs = state.clubs.map((c) => {
    if (c.id === userClub.id) {
      return {
        ...c,
        balance: Math.max(0, c.balance - fee),
        players: c.players.map((p) => {
          if (p.id !== player.id) return p;
          const { loanInfo: _drop, ...perm } = p;
          return { ...perm, forSale: false, forLoan: false };
        }),
      };
    }
    if (c.id === parentClubId) {
      return {
        ...c,
        balance: c.balance + fee,
        players: c.players.filter((p) => p.id !== player.id),
      };
    }
    return c;
  });

  const ledgerEntry: FinanceEntry = {
    id: `fin_buyopt_${Date.now()}_${player.id}`,
    dateIso,
    type: 'EXPENSE',
    category: 'TRANSFER_FEE',
    description: `Triggered loan buy option for ${player.name} from ${parentClubName}`,
    amount: fee,
  };

  return {
    ...state,
    clubs: nextClubs,
    budget: Math.max(0, state.budget - fee),
    financeLedger: [ledgerEntry, ...state.financeLedger],
  };
}

export function completeLoanOutDeal(
  state: CareerState,
  playerId: string,
  destinationClubId: string,
  wageSplitPct: number,
  loanFee: number,
  options?: { durationSeasons?: 0.5 | 1 | 2; buyOptionFee?: number }
): CareerState {
  const userClub = state.clubs.find((c) => c.id === state.clubId);
  const destClub = state.clubs.find((c) => c.id === destinationClubId && c.id !== state.clubId);
  if (!userClub || !destClub) return state;

  const player = userClub.players.find((p) => p.id === playerId && !p.loanInfo);
  if (!player) return state;

  const activeOwnedCount = userClub.players.filter((p) => p.loanInfo?.direction !== 'OUT').length;
  if (activeOwnedCount <= 14) return state;

  const cleanFee = Math.max(0, loanFee);
  const cleanSplit = Math.max(0, Math.min(100, wageSplitPct));
  const duration: 0.5 | 1 | 2 =
    options?.durationSeasons === 0.5 ? 0.5 : options?.durationSeasons === 2 ? 2 : 1;
  const buyOptionFee = Math.max(0, options?.buyOptionFee ?? 0);
  const seasonStartYear = 2026 + (state.seasonIndex ?? 0);
  const dateIso = state.calendar[state.currentDayIndex]?.dateIso ?? `${seasonStartYear}-07-01`;
  const month = Number(dateIso.slice(5, 7)) || 7;
  const halfSeasonWindow =
    duration === 0.5 ? (month >= 7 ? 'SUMMER_TO_JAN' : 'JAN_TO_SUMMER') : undefined;
  const returnYear = seasonStartYear + (duration === 2 ? 2 : 1);

  const loanedOutPlayer: Player = {
    ...player,
    forSale: false,
    forLoan: false,
    loanInfo: {
      direction: 'OUT',
      counterpartyClubId: destClub.id,
      counterpartyClubName: destClub.name,
      wageSharePct: Math.max(0, 100 - cleanSplit),
      returnSeasonYear: returnYear,
      loanFee: cleanFee,
      buyOptionFee: buyOptionFee > 0 ? buyOptionFee : undefined,
      durationSeasons: duration,
      halfSeasonWindow,
    },
  };

  const loanedInCopy: Player = {
    ...player,
    forSale: false,
    forLoan: false,
    loanInfo: {
      direction: 'IN',
      counterpartyClubId: userClub.id,
      counterpartyClubName: userClub.name,
      wageSharePct: cleanSplit,
      returnSeasonYear: returnYear,
      loanFee: cleanFee,
      buyOptionFee: buyOptionFee > 0 ? buyOptionFee : undefined,
      durationSeasons: duration,
      halfSeasonWindow,
    },
  };

  const nextClubs = state.clubs.map((c) => {
    if (c.id === userClub.id) {
      const updatedPlayers = c.players.map((p) => (p.id === player.id ? loanedOutPlayer : p));
      let nextStarting = c.startingIds.filter((id) => id !== player.id);
      let nextBench = c.benchIds.filter((id) => id !== player.id);
      if (nextStarting.length < 11) {
        const replacement =
          nextBench[0] ??
          updatedPlayers.find(
            (p) =>
              !nextStarting.includes(p.id) &&
              p.loanInfo?.direction !== 'OUT' &&
              isPlayerAvailableForMatchday(p)
          )?.id;
        if (replacement) {
          nextStarting = [...nextStarting, replacement];
          nextBench = nextBench.filter((id) => id !== replacement);
        }
      }
      return {
        ...c,
        balance: c.balance + cleanFee,
        players: updatedPlayers,
        startingIds: nextStarting,
        benchIds: nextBench,
      };
    }
    if (c.id === destClub.id) {
      const alreadyHas = c.players.some((p) => p.id === player.id);
      const nextPlayers = alreadyHas ? c.players : [...c.players, loanedInCopy];
      const nextBench =
        !alreadyHas && c.benchIds.length < BENCH_SIZE ? [...c.benchIds, loanedInCopy.id] : c.benchIds;
      return {
        ...c,
        balance: Math.max(0, c.balance - cleanFee),
        players: nextPlayers,
        benchIds: nextBench,
      };
    }
    return c;
  });

  const ledgerAdditions: FinanceEntry[] =
    cleanFee > 0
      ? [
          {
            id: `fin_loan_out_${Date.now()}_${player.id}`,
            dateIso,
            type: 'INCOME',
            category: 'LOAN_FEE',
            description: `Loaned out ${player.name} to ${destClub.name} (${duration === 0.5 ? 'Half Season' : `${duration}S`}, ${cleanSplit}% wages covered)`,
            amount: cleanFee,
          },
        ]
      : [];

  return {
    ...state,
    clubs: nextClubs,
    budget: state.budget + cleanFee,
    financeLedger: [...ledgerAdditions, ...state.financeLedger],
  };
}

export function renewManagerContract(
  state: CareerState,
  requestedWage: number,
  extendYears: number
): { ok: boolean; nextState: CareerState; message: string } {
  const userLeagueId = state.userLeagueId ?? 'PL';
  const userClub = state.clubs.find((c) => c.id === state.clubId);
  const seasonStartYear = 2026 + (state.seasonIndex ?? 0);
  const dateIso = state.calendar[state.currentDayIndex]?.dateIso ?? `${seasonStartYear}-07-01`;
  const current =
    state.managerContract ??
    buildDefaultManagerContract(userLeagueId, dateIso, seasonStartYear, userClub);

  if (current.status === 'SACKED') {
    return {
      ok: false,
      nextState: state,
      message: 'You were dismissed from this club and cannot renew here. Apply for another club in Job Market.',
    };
  }
  if (state.boardSatisfaction < 38) {
    return {
      ok: false,
      nextState: state,
      message: `Board confidence (${state.boardSatisfaction}%) is too low for an extension. Reach 38%+ first.`,
    };
  }

  const maxAffordable = Math.round(current.weeklyWage * 1.45);
  if (requestedWage > maxAffordable) {
    return {
      ok: false,
      nextState: state,
      message: `Board declined ${formatCurrency(requestedWage)}/wk. Maximum offer is ${formatCurrency(maxAffordable)}/wk.`,
    };
  }

  const safeYears = Math.max(1, Math.min(4, Math.round(extendYears)));
  const newEndYear = Math.max(current.contractEndSeasonYear, seasonStartYear + 1) + safeYears;
  const updatedContract: ManagerContract = {
    weeklyWage: Math.max(1500, Math.round(requestedWage)),
    contractEndSeasonYear: newEndYear,
    signedDateIso: dateIso,
    status: 'ACTIVE',
    probationMatchesRemaining: state.boardSatisfaction >= 30 ? null : current.probationMatchesRemaining,
  };

  const nextManagers = { ...(state.clubManagers ?? {}) };
  if (nextManagers[state.clubId]) {
    nextManagers[state.clubId] = {
      ...nextManagers[state.clubId],
      contractEndSeasonYear: newEndYear,
      status: state.boardSatisfaction < 35 ? 'UNDER_PRESSURE' : 'SECURE',
    };
  }

  return {
    ok: true,
    message: `Contract extended with ${userClub?.name ?? 'Club'} until June ${newEndYear} (${formatCurrency(updatedContract.weeklyWage)}/wk).`,
    nextState: {
      ...state,
      managerContract: updatedContract,
      clubManagers: nextManagers,
      notifications: [
        {
          id: `notif_mgr_ren_${dateIso}_${newEndYear}`,
          dateIso,
          type: 'BOARD' as const,
          title: 'Manager Contract Renewed',
          message: `Signed new deal until June ${newEndYear} at ${formatCurrency(updatedContract.weeklyWage)}/wk.`,
          read: false,
        },
        ...(state.notifications ?? []),
      ].slice(0, 40),
    },
  };
}

export function evaluateManagerJobApplication(
  state: CareerState,
  targetClubId: string,
  desiredWage: number,
  desiredYears: number
): { accepted: boolean; message: string; maxWageOffer: number } {
  if (targetClubId === state.clubId) {
    return {
      accepted: false,
      message: 'You already manage this club.',
      maxWageOffer: state.managerContract?.weeklyWage ?? 50_000,
    };
  }

  const leagueTeams = getLeagueTeamsFromState(state);
  const seasonStartYear = 2026 + (state.seasonIndex ?? 0);
  const managers =
    state.clubManagers ??
    buildInitialClubManagers(
      state.clubs,
      leagueTeams,
      state.clubId,
      `${state.coach.firstName} ${state.coach.lastName}`.trim() || state.coach.nickname,
      seasonStartYear
    );
  const info = managers[targetClubId];
  let targetTier: DomesticLeagueId = 'PL';
  for (const tier of ALL_DOMESTIC_LEAGUE_IDS) {
    if ((leagueTeams[tier] ?? []).some((t) => t.id === targetClubId)) {
      targetTier = tier;
      break;
    }
  }
  const teamOvr = (leagueTeams[targetTier] ?? []).find((t) => t.id === targetClubId)?.ovr ?? 72;
  const maxWageOffer = info?.weeklyBudgetOffer ?? computeManagerWeeklyOffer(targetTier, teamOvr);

  const currentTier = state.userLeagueId ?? 'PL';
  const currentTierRank = isDomesticLeagueId(currentTier) ? Math.max(1, 5 - LEAGUE_CATALOG[currentTier].tier) : 3;
  const trophyRep = (state.careerTrophies?.length ?? 0) * 8;
  const coachReputation =
    state.boardSatisfaction * 0.65 +
    currentTierRank * 8 +
    trophyRep -
    (state.managerContract?.status === 'SACKED' ? 18 : 0);

  const targetDivTier = LEAGUE_CATALOG[targetTier]?.tier ?? 1;
  const requiredRep =
    targetDivTier === 1
      ? Math.max(35, teamOvr - 24)
      : targetDivTier === 2
      ? Math.max(25, teamOvr - 32)
      : 15;

  const isOpenRole =
    info?.status === 'VACANT' ||
    info?.status === 'UNDER_PRESSURE' ||
    info?.status === 'EXPIRING';

  if (!isOpenRole && coachReputation < requiredRep + 15) {
    return {
      accepted: false,
      maxWageOffer,
      message: `Club board backed their incumbent manager (${info?.managerName ?? 'Current Coach'}). Target vacant, expiring, or under-pressure jobs.`,
    };
  }

  if (coachReputation < requiredRep - (info?.status === 'VACANT' ? 10 : 0)) {
    return {
      accepted: false,
      maxWageOffer,
      message: `Board felt you need higher recent reputation (${Math.round(coachReputation)} vs ${requiredRep} needed).`,
    };
  }

  if (desiredWage > Math.round(maxWageOffer * 1.25)) {
    return {
      accepted: false,
      maxWageOffer,
      message: `Salary demand (${formatCurrency(desiredWage)}/wk) exceeded club board limit (${formatCurrency(Math.round(maxWageOffer * 1.25))}/wk).`,
    };
  }

  if (desiredYears < 1 || desiredYears > 4) {
    return {
      accepted: false,
      maxWageOffer,
      message: 'Contract length must be between 1 and 4 years.',
    };
  }

  return {
    accepted: true,
    maxWageOffer,
    message: `Board approved your appointment at ${formatCurrency(desiredWage)}/wk for ${desiredYears} season(s)!`,
  };
}

export function ensureTargetClubInState(state: CareerState, clubId: string): CareerState {
  if (state.clubs.some((c) => c.id === clubId)) return state;
  const built = buildWorldClubById(clubId);
  if (!built) return state;
  const existingPlayerIds = new Set(state.transferTargets.map((t) => t.playerId));
  const newTargets: TransferTarget[] = [];
  for (const p of built.players) {
    if (!existingPlayerIds.has(p.id)) {
      newTargets.push({
        playerId: p.id,
        clubId: built.id,
        scoutStatus: 'UNSCOUTED',
        scoutDaysRemaining: 0,
        shortlisted: false,
        negotiationStatus: 'NONE',
        sellerSatisfaction: 65,
      });
    }
  }
  return {
    ...state,
    clubs: [...state.clubs, built],
    transferTargets: [...state.transferTargets, ...newTargets],
  };
}

export function switchUserClub(
  state: CareerState,
  targetClubId: string,
  agreedWage: number,
  contractYears: number
): CareerState {
  if (targetClubId === state.clubId) return state;

  const oldClubId = state.clubId;
  const oldLeagueId: DomesticLeagueId = isDomesticLeagueId(state.userLeagueId ?? 'PL')
    ? (state.userLeagueId as DomesticLeagueId)
    : 'PL';
  const seasonStartYear = 2026 + (state.seasonIndex ?? 0);
  const currentDay = state.calendar[state.currentDayIndex];
  const currentDateIso = currentDay?.dateIso ?? `${seasonStartYear}-07-01`;
  const leagueTeams = getLeagueTeamsFromState(state);

  let targetLeagueId: DomesticLeagueId = oldLeagueId;
  for (const tier of ALL_DOMESTIC_LEAGUE_IDS) {
    if ((leagueTeams[tier] ?? []).some((t) => t.id === targetClubId)) {
      targetLeagueId = tier;
      break;
    }
  }

  // Materialize target league clubs if not yet in state.clubs
  const clubMap = new Map<string, Club>(state.clubs.map((c) => [c.id, c]));
  if (!clubMap.has(targetClubId) || targetLeagueId !== oldLeagueId) {
    const tierPlayable = buildWorldClubsForLeague(targetLeagueId, leagueTeams[targetLeagueId]);
    for (const tc of tierPlayable) {
      if (!clubMap.has(tc.id)) {
        clubMap.set(tc.id, { ...tc, leagueId: targetLeagueId });
      }
    }
    for (const tm of leagueTeams[targetLeagueId] ?? []) {
      if (!clubMap.has(tm.id)) {
        const built = buildWorldClubById(tm.id, targetLeagueId) ?? buildCuratedEflClubFromTeam(tm, targetLeagueId);
        clubMap.set(tm.id, built);
      }
    }
  }

  const targetClub = clubMap.get(targetClubId);
  if (!targetClub) return state;

  const coachFullName =
    `${state.coach.firstName} ${state.coach.lastName}`.trim() || state.coach.nickname;

  const nextClubs = Array.from(clubMap.values()).map((c) => {
    if (c.id === oldClubId) {
      return { ...c, managerName: 'Caretaker Boss' };
    }
    if (c.id === targetClubId) {
      return { ...c, leagueId: targetLeagueId, managerName: coachFullName };
    }
    return c;
  });

  // Swap league fixtures between oldLeagueId and targetLeagueId cleanly
  let nextFixtures: Fixture[] = state.fixtures;
  const nextContextFixtures: Record<CompetitionId, Fixture[]> = { ...state.contextFixtures };
  const nextContextStandings: Record<CompetitionId, StandingRow[]> = { ...state.contextStandings };

  if (targetLeagueId !== oldLeagueId) {
    nextContextFixtures[oldLeagueId] = state.fixtures;
    const oldTierClubs = nextClubs.filter((c) => (c.leagueId ?? 'PL') === oldLeagueId);
    nextContextStandings[oldLeagueId] = computeStandings(oldTierClubs, state.fixtures);

    const existingTargetFixtures = state.contextFixtures[targetLeagueId];
    const targetTierClubs = nextClubs.filter((c) => (c.leagueId ?? 'PL') === targetLeagueId);
    nextFixtures =
      existingTargetFixtures && existingTargetFixtures.length > 0
        ? existingTargetFixtures
        : generateDoubleRoundRobinFixtures(targetTierClubs, targetLeagueId, 1, seasonStartYear);
    nextContextFixtures[targetLeagueId] = [];
    nextContextStandings[targetLeagueId] = computeStandings(targetTierClubs, nextFixtures);
  }

  // Rebuild future calendar from currentDateIso onward for the new club
  const targetCountry = getCountryForLeague(targetLeagueId);
  const calendarCupFixtures: Fixture[] = [];
  if (targetCountry.id === 'ENG') {
    calendarCupFixtures.push(...(nextContextFixtures.CARABAO ?? []), ...(nextContextFixtures.FACUP ?? []));
  } else {
    calendarCupFixtures.push(...(nextContextFixtures[targetCountry.primaryCupId] ?? []));
  }
  if (targetCountry.id === 'ESP') {
    calendarCupFixtures.push(...(nextContextFixtures.SUPERCOPA ?? []));
  }
  calendarCupFixtures.push(...(nextContextFixtures.UEFASUPERCUP ?? []));
  (['UCL', 'UEL', 'UECL'] as UefaCompId[]).forEach((uId) => {
    calendarCupFixtures.push(...(nextContextFixtures[uId] ?? []));
  });

  const fullTargetCalendar = buildCalendarForUserClub(
    targetClubId,
    nextFixtures,
    calendarCupFixtures,
    seasonStartYear
  );
  const completedPrefix = state.calendar.slice(0, state.currentDayIndex);
  const targetFuture = fullTargetCalendar.filter((d) => d.dateIso >= currentDateIso);
  const mergedCalendar = [...completedPrefix, ...targetFuture].map((d, idx) => ({
    ...d,
    dayIndex: idx,
  }));
  const nextDayIndex = Math.min(mergedCalendar.length - 1, completedPrefix.length);

  const nextUnplayed = nextFixtures.find((f) => !f.played);
  const nextRound = nextUnplayed?.round ?? getTotalRoundsForLeague(targetLeagueId);

  const existingTargetsByPlayer = new Map(state.transferTargets.map((t) => [t.playerId, t]));
  const nextTransferTargets: TransferTarget[] = [];
  for (const c of nextClubs) {
    if (c.id === targetClubId) continue;
    for (const p of c.players) {
      const prev = existingTargetsByPlayer.get(p.id);
      nextTransferTargets.push(
        prev ?? {
          playerId: p.id,
          clubId: c.id,
          scoutStatus: 'UNSCOUTED',
          scoutDaysRemaining: 0,
          shortlisted: false,
          negotiationStatus: 'NONE',
          sellerSatisfaction: 65,
        }
      );
    }
  }

  const nextEndYear = seasonStartYear + Math.max(1, Math.min(4, Math.round(contractYears)));
  const nextContract: ManagerContract = {
    weeklyWage: Math.max(1500, Math.round(agreedWage)),
    contractEndSeasonYear: nextEndYear,
    signedDateIso: currentDateIso,
    status: 'ACTIVE',
    probationMatchesRemaining: null,
  };

  const nextManagers: Record<string, ClubManagerInfo> = {
    ...(state.clubManagers ??
      buildInitialClubManagers(nextClubs, leagueTeams, oldClubId, coachFullName, seasonStartYear)),
  };
  if (nextManagers[oldClubId]) {
    nextManagers[oldClubId] = {
      ...nextManagers[oldClubId],
      managerName: 'Caretaker Boss',
      satisfaction: 25,
      status: 'VACANT',
    };
  }
  nextManagers[targetClubId] = {
    clubId: targetClubId,
    managerName: coachFullName,
    satisfaction: 72,
    contractEndSeasonYear: nextEndYear,
    status: 'SECURE',
    weeklyBudgetOffer: computeManagerWeeklyOffer(
      targetLeagueId,
      (leagueTeams[targetLeagueId] ?? []).find((t) => t.id === targetClubId)?.ovr ?? 72
    ),
  };

  const nextObjectives = buildSeasonObjectivesForClub(
    targetClubId,
    targetLeagueId,
    leagueTeams,
    nextClubs,
    state.seasonIndex ?? 0
  );

  const nextState: CareerState = {
    ...state,
    clubId: targetClubId,
    countryId: targetCountry.id,
    userLeagueId: targetLeagueId,
    boardSatisfaction: 72,
    seasonObjectives: nextObjectives,
    currentDayIndex: nextDayIndex,
    currentRound: nextRound,
    calendar: mergedCalendar,
    clubs: nextClubs,
    leagueTeams,
    fixtures: nextFixtures,
    contextFixtures: nextContextFixtures,
    contextStandings: nextContextStandings,
    transferTargets: nextTransferTargets,
    academy: generateFakeAcademySquad(targetClubId),
    openingBudget: targetClub.balance,
    budget: targetClub.balance,
    financeLedger: [
      {
        id: `fin_join_${targetClubId}_${currentDateIso}`,
        dateIso: currentDateIso,
        type: 'INCOME',
        category: 'OPENING_BUDGET',
        description: `Appointed Head Coach of ${targetClub.name} (${COMPETITION_THEMES[targetLeagueId].shortName})`,
        amount: targetClub.balance,
      },
      ...state.financeLedger,
    ],
    incomingBids: [],
    matchdayOverride: null,
    deadlineHoursRemaining: mergedCalendar[nextDayIndex]?.isDeadlineDay ? 24 : null,
    managerContract: nextContract,
    clubManagers: nextManagers,
    notifications: [
      {
        id: `notif_join_${targetClubId}_${currentDateIso}`,
        dateIso: currentDateIso,
        type: 'BOARD' as const,
        title: `New Club: ${targetClub.name}`,
        message: `Signed ${contractYears}-year deal (${formatCurrency(nextContract.weeklyWage)}/wk) as Head Coach of ${targetClub.name}.`,
        read: false,
      },
      ...(state.notifications ?? []),
    ].slice(0, 40),
  };

  const synced = syncParallelCompetitions(nextState, currentDateIso);
  const switchedState: CareerState = {
    ...nextState,
    ...synced,
  };
  return {
    ...switchedState,
    seasonObjectives: evaluateSeasonObjectives(switchedState),
  };
}
