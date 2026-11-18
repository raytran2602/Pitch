import {
  ALL_DOMESTIC_LEAGUE_IDS,
  COUNTRY_BY_ID,
  COUNTRY_CATALOG,
  getCountryForLeague,
  isDomesticLeagueId,
  LEAGUE_CATALOG,
  UEFA_COMPETITIONS,
} from '../data/competitions';
import {
  buildWorldClubById,
  findContextTeamGlobally,
  getAllRestOfEuropeContextTeams,
  getInitialContextTeamsForLeague,
  getInitialUefaSeeds,
} from '../data/world/worldRegistry';
import {
  Club,
  CompetitionId,
  ContextTeam,
  CountryId,
  DomesticCupId,
  DomesticLeagueId,
  Fixture,
  PlayoffTieResult,
  StandingRow,
  TierMovement,
  UefaCompId,
} from '../types/game';

function seededRand(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function getUefaLeaguePhaseRounds(compId: UefaCompId): number {
  return compId === 'UECL' ? 6 : 8;
}

export function getUefaStageLabel(compId: UefaCompId, round: number, language: 'en' | 'vi' = 'en'): string {
  const lpRounds = getUefaLeaguePhaseRounds(compId);
  if (round <= lpRounds) {
    return language === 'vi' ? `Vòng phân hạng MD${round}` : `League Phase MD${round}`;
  }
  if (round === 9) return language === 'vi' ? 'Play-off Vòng 1/8' : 'Knockout Play-off';
  if (round === 10) return language === 'vi' ? 'Vòng 1/8' : 'Round of 16';
  if (round === 11) return language === 'vi' ? 'Tứ kết' : 'Quarter-Final';
  if (round === 12) return language === 'vi' ? 'Bán kết' : 'Semi-Final';
  return language === 'vi' ? 'Chung kết' : 'Final';
}

export function getWorldClubOvrLookup(
  clubs: Club[],
  leagueTeams?: Partial<Record<DomesticLeagueId, ContextTeam[]>>
): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of getAllRestOfEuropeContextTeams()) {
    map.set(t.id, t.ovr);
  }
  if (leagueTeams) {
    for (const lid of ALL_DOMESTIC_LEAGUE_IDS) {
      for (const t of leagueTeams[lid] ?? []) {
        map.set(t.id, t.ovr);
      }
    }
  } else {
    for (const lid of ALL_DOMESTIC_LEAGUE_IDS) {
      for (const t of getInitialContextTeamsForLeague(lid)) {
        map.set(t.id, t.ovr);
      }
    }
  }
  for (const c of clubs) {
    const avg = Math.round(
      c.players.slice(0, 11).reduce((s, p) => s + p.ovr, 0) / Math.max(1, Math.min(11, c.players.length))
    );
    map.set(c.id, avg);
  }
  return map;
}

export function resolveWorldClub(
  clubs: Club[],
  clubId: string,
  leagueTeams?: Partial<Record<DomesticLeagueId, ContextTeam[]>>
): Club | undefined {
  const inState = clubs.find((c) => c.id === clubId);
  if (inState) return inState;
  const built = buildWorldClubById(clubId);
  if (built) {
    const ctx = findContextTeamGlobally(clubId, leagueTeams);
    if (ctx) {
      return {
        ...built,
        leagueId: ctx.leagueId ?? built.leagueId,
        managerName: ctx.managerName ?? built.managerName,
        conf: ctx.conf ?? built.conf,
      };
    }
    return built;
  }
  return undefined;
}

function shiftSeasonDate(baseIso2026: string, seasonStartYear: number): string {
  const yrOffset = seasonStartYear - 2026;
  const yr = Number(baseIso2026.slice(0, 4)) + yrOffset;
  return `${yr}${baseIso2026.slice(4)}`;
}

export function generateWorldLeagueFixtures(
  teams: { id: string; name: string; shortName: string; conf?: 'EAST' | 'WEST' }[],
  compId: DomesticLeagueId,
  seasonStartYear = 2026
): Fixture[] {
  if (teams.length < 2) return [];
  if (compId === 'USA1') {
    return generateMlsFixtures(teams, seasonStartYear);
  }

  const meta = LEAGUE_CATALOG[compId];
  const cycles = meta?.cycles ?? 1;
  const n = teams.length % 2 === 0 ? teams.length : teams.length + 1;
  const halfRounds = n - 1;
  const totalRounds = halfRounds * 2 * cycles;
  const startBase = shiftSeasonDate(meta?.seasonStartIso ?? '2026-08-15', seasonStartYear);
  const seasonStart = new Date(`${startBase}T15:00:00Z`);
  const seasonDays = meta?.seasonSpanDays ?? 275;
  const idPrefix = seasonStartYear === 2026 ? '' : `S${seasonStartYear}_`;

  const rotation = teams.map((t) => t.id);
  if (teams.length % 2 === 1) rotation.push('__BYE__');
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const fixtures: Fixture[] = [];

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

    for (let phase = 0; phase < 2; phase++) {
      for (let r = 1; r <= halfRounds; r++) {
        const round = roundCounter++;
        const dayOffset =
          totalRounds > 1 ? Math.round(((round - 1) * seasonDays) / (totalRounds - 1)) : 0;
        const dateIso = new Date(seasonStart.getTime() + dayOffset * 86400_000).toISOString().slice(0, 10);
        const legOffset = phase === 0 ? r : (r % halfRounds) + 1;
        for (const pair of cycleFirstHalf.filter((x) => x.roundOffset === legOffset)) {
          const hid = phase === 0 ? pair.homeId : pair.awayId;
          const aid = phase === 0 ? pair.awayId : pair.homeId;
          if (hid === '__BYE__' || aid === '__BYE__') continue;
          const h = teamMap.get(hid);
          const a = teamMap.get(aid);
          if (!h || !a) continue;
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
  }

  return fixtures;
}

/** MLS 30-team 34-round regular season: 28 intra-conference + 6 cross-conference rounds */
function generateMlsFixtures(
  teams: { id: string; name: string; shortName: string; conf?: 'EAST' | 'WEST' }[],
  seasonStartYear = 2026
): Fixture[] {
  const east = teams.filter((t) => t.conf === 'EAST');
  const west = teams.filter((t) => t.conf === 'WEST');
  // Fallback split if custom override doesn't carry conf
  const finalEast = east.length === 15 && west.length === 15 ? east : teams.slice(0, Math.ceil(teams.length / 2));
  const finalWest = east.length === 15 && west.length === 15 ? west : teams.slice(Math.ceil(teams.length / 2));

  // Build 16-slot Berger circle inside each conference (15 teams + BYE => 15 half rounds * 2 = 30 slots; skip all-BYE, replace each team's BYE in cross rounds)
  const buildConfPairs = (confTeams: typeof finalEast) => {
    const rot = [...confTeams.map((t) => t.id), '__BYE__'];
    const rounds: { byeId: string | null; pairs: [string, string][] }[] = [];
    const n = rot.length;
    const m = n - 1;
    const half = n / 2;
    const pivot = rot[m];
    for (let cycle = 0; cycle < 2; cycle++) {
      for (let r = 0; r < m; r++) {
        const p = (r * half) % m;
        const anchor = rot[p];
        const rawPairs: [string, string][] = [];
        const addP = (u: string, v: string) => {
          rawPairs.push(cycle === 0 ? (r % 2 === 0 ? [u, v] : [v, u]) : (r % 2 === 0 ? [v, u] : [u, v]));
        };
        addP(anchor, pivot);
        for (let k = 1; k < half; k++) {
          addP(rot[(p + k) % m], rot[(p - k + m) % m]);
        }
        let byeId: string | null = null;
        const pairs: [string, string][] = [];
        for (const [u, v] of rawPairs) {
          if (u === '__BYE__') byeId = v;
          else if (v === '__BYE__') byeId = u;
          else pairs.push([u, v]);
        }
        rounds.push({ byeId, pairs });
      }
    }
    return rounds; // 30 rounds where each team plays 28 games and sits out 2 BYEs
  };

  const eastRounds = buildConfPairs(finalEast);
  const westRounds = buildConfPairs(finalWest);
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const startBase = shiftSeasonDate('2026-08-15', seasonStartYear);
  const seasonStart = new Date(`${startBase}T19:00:00Z`);
  const idPrefix = seasonStartYear === 2026 ? '' : `S${seasonStartYear}_`;

  const allRoundsPairs: [string, string][][] = [];
  for (let r = 0; r < 30; r++) {
    const list: [string, string][] = [...eastRounds[r].pairs, ...westRounds[r].pairs];
    // Pair the East BYE team vs West BYE team in that round (gives +2 games per team => 30 total!)
    if (eastRounds[r].byeId && westRounds[r].byeId) {
      list.push(
        r % 2 === 0
          ? [eastRounds[r].byeId!, westRounds[r].byeId!]
          : [westRounds[r].byeId!, eastRounds[r].byeId!]
      );
    }
    allRoundsPairs.push(list);
  }
  // Add 4 full cross-conference rounds (rounds 31..34 => exact 34 matches per team!)
  const ec = finalEast.length;
  const wc = finalWest.length;
  for (let shift = 1; shift <= 4; shift++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < Math.min(ec, wc); i++) {
      const e = finalEast[i];
      const w = finalWest[(i + shift) % wc];
      pairs.push(shift % 2 === 1 ? [e.id, w.id] : [w.id, e.id]);
    }
    allRoundsPairs.push(pairs);
  }

  const fixtures: Fixture[] = [];
  const totalRounds = allRoundsPairs.length; // 34
  allRoundsPairs.forEach((pairs, idx) => {
    const round = idx + 1;
    const dayOffset = Math.round((idx * 270) / (totalRounds - 1));
    const dateIso = new Date(seasonStart.getTime() + dayOffset * 86400_000).toISOString().slice(0, 10);
    for (const [hid, aid] of pairs) {
      const h = teamMap.get(hid);
      const a = teamMap.get(aid);
      if (!h || !a) continue;
      fixtures.push({
        id: `${idPrefix}USA1_R${round}_${h.shortName}_${a.shortName}`,
        competitionId: 'USA1',
        round,
        dateIso,
        homeClubId: h.id,
        awayClubId: a.id,
        homeClubName: h.name,
        awayClubName: a.name,
        played: false,
      });
    }
  });

  return fixtures;
}

export function getCupParticipantsForCountry(
  countryId: CountryId,
  leagueTeams: Partial<Record<DomesticLeagueId, ContextTeam[]>>,
  clubs: Club[],
  userClubId?: string
): ContextTeam[] {
  const country = COUNTRY_BY_ID[countryId];
  const pool: ContextTeam[] = [];
  const seen = new Set<string>();
  for (const lid of country.leagues) {
    for (const tm of leagueTeams[lid] ?? getInitialContextTeamsForLeague(lid)) {
      if (!seen.has(tm.id)) {
        seen.add(tm.id);
        pool.push(tm);
      }
    }
  }
  const targetSize = pool.length >= 32 ? 32 : pool.length >= 16 ? 16 : 8;
  const chosen = pool.slice(0, targetSize);
  if (userClubId && seen.has(userClubId) && !chosen.some((c) => c.id === userClubId)) {
    const userTeam = pool.find((t) => t.id === userClubId) ??
      clubs.find((c) => c.id === userClubId);
    if (userTeam) {
      chosen[chosen.length - 1] =
        'ovr' in userTeam
          ? userTeam
          : {
              id: userTeam.id,
              name: userTeam.name,
              shortName: userTeam.shortName,
              primaryColor: userTeam.primaryColor,
              secondaryColor: userTeam.secondaryColor,
              ovr: 72,
              managerName: userTeam.managerName,
            };
    }
  }
  return chosen;
}

export function getDomesticCupStartRound(participantCount: number): number {
  if (participantCount >= 32) return 3;
  if (participantCount >= 16) return 4;
  return 5;
}

export function getWorldCupRoundDate(
  compId: CompetitionId,
  round: number,
  seasonStartYear = 2026
): string {
  if (compId === 'UEFASUPERCUP') {
    return shiftSeasonDate('2026-08-12', seasonStartYear);
  }
  if (compId === 'SUPERCOPA') {
    return shiftSeasonDate(round === 6 ? '2027-01-11' : '2027-01-14', seasonStartYear);
  }
  if (compId === 'CARABAO') {
    const base: Record<number, string> = {
      3: '2026-09-23',
      4: '2026-10-28',
      5: '2026-12-16',
      6: '2027-01-20',
      7: '2027-02-24',
    };
    return shiftSeasonDate(base[round] ?? '2027-02-24', seasonStartYear);
  }
  if (compId === 'MLSCUP') {
    const baseMls: Record<number, string> = {
      4: '2027-05-19',
      5: '2027-05-23',
      6: '2027-05-27',
      7: '2027-05-31',
    };
    return shiftSeasonDate(baseMls[round] ?? '2027-05-31', seasonStartYear);
  }
  const baseNational: Record<number, string> = {
    3: '2027-01-06',
    4: '2027-01-27',
    5: '2027-03-17',
    6: '2027-04-14',
    7: '2027-05-08',
  };
  return shiftSeasonDate(baseNational[round] ?? '2027-05-08', seasonStartYear);
}

export function drawWorldCupRoundFixtures(
  compId: DomesticCupId,
  round: number,
  teams: ContextTeam[],
  seed: number,
  seasonStartYear = 2026
): Fixture[] {
  const rand = seededRand(seed);
  const shuffled = [...teams];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const dateIso = getWorldCupRoundDate(compId, round, seasonStartYear);
  const stageLabel =
    round === 5 ? 'Quarter-Final' : round === 6 ? 'Semi-Final' : round === 7 ? 'Final' : `Round ${round}`;
  const idPrefix = seasonStartYear === 2026 ? '' : `S${seasonStartYear}_`;
  const out: Fixture[] = [];
  for (let i = 0; i + 1 < shuffled.length; i += 2) {
    const h = shuffled[i];
    const a = shuffled[i + 1];
    out.push({
      id: `${idPrefix}${compId}_R${round}_${h.shortName}_${a.shortName}_${i}`,
      competitionId: compId,
      round,
      dateIso,
      homeClubId: h.id,
      awayClubId: a.id,
      homeClubName: h.name,
      awayClubName: a.name,
      played: false,
      stageLabel,
    });
  }
  return out;
}

export function getUefaRoundDate(compId: UefaCompId, round: number, seasonStartYear = 2026): string {
  const lpBase: Record<number, string> = {
    1: '2026-09-16',
    2: '2026-09-30',
    3: '2026-10-21',
    4: '2026-11-04',
    5: '2026-11-25',
    6: '2026-12-09',
    7: '2027-01-20',
    8: '2027-01-27',
    9: '2027-02-17',
    10: '2027-03-10',
    11: '2027-04-07',
    12: '2027-04-28',
    13: compId === 'UCL' ? '2027-05-29' : compId === 'UEL' ? '2027-05-26' : '2027-05-22',
  };
  const iso = lpBase[round] ?? '2027-05-29';
  return shiftSeasonDate(iso, seasonStartYear);
}

/** 36-club Swiss League Phase: exact 8 rounds (UCL/UEL) or 6 rounds (UECL), distinct opponents, balanced H/A */
export function buildUefaLeaguePhaseFixtures(
  compId: UefaCompId,
  participantIds: string[],
  leagueTeams: Partial<Record<DomesticLeagueId, ContextTeam[]>>,
  seasonStartYear = 2026
): { standings: StandingRow[]; fixtures: Fixture[]; participantTeams: ContextTeam[] } {
  const teams: ContextTeam[] = participantIds
    .map((id) => findContextTeamGlobally(id, leagueTeams))
    .filter((t): t is ContextTeam => Boolean(t));

  // Ensure exact even count (36)
  if (teams.length % 2 === 1) teams.pop();
  const n = teams.length;
  const totalLpRounds = getUefaLeaguePhaseRounds(compId);
  const rand = seededRand((compId === 'UCL' ? 4201 : compId === 'UEL' ? 7301 : 10216) + seasonStartYear * 13);
  const shuffled = [...teams];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const m = n - 1;
  const half = n / 2;
  const pivot = shuffled[m];
  const idPrefix = seasonStartYear === 2026 ? '' : `S${seasonStartYear}_`;
  const fixtures: Fixture[] = [];

  for (let r = 0; r < totalLpRounds; r++) {
    const round = r + 1;
    const dateIso = getUefaRoundDate(compId, round, seasonStartYear);
    const stageLabel = `League Phase MD${round}`;
    const p = (r * half) % m;
    const anchor = shuffled[p];
    const pairs: [ContextTeam, ContextTeam][] = [];
    pairs.push(r % 2 === 0 ? [anchor, pivot] : [pivot, anchor]);
    for (let k = 1; k < half; k++) {
      const u = shuffled[(p + k) % m];
      const v = shuffled[(p - k + m) % m];
      pairs.push((r + k) % 2 === 0 ? [u, v] : [v, u]);
    }
    pairs.forEach(([h, a], idx) => {
      fixtures.push({
        id: `${idPrefix}${compId}_MD${round}_${h.shortName}_${a.shortName}_${idx}`,
        competitionId: compId,
        round,
        dateIso,
        homeClubId: h.id,
        awayClubId: a.id,
        homeClubName: h.name,
        awayClubName: a.name,
        played: false,
        stageLabel,
      });
    });
  }

  const standings = computeUefaPhaseStandings(teams, fixtures, compId);
  return { standings, fixtures, participantTeams: teams };
}

export function computeUefaPhaseStandings(
  participants: ContextTeam[],
  fixtures: Fixture[],
  compId: UefaCompId
): StandingRow[] {
  const maxLp = getUefaLeaguePhaseRounds(compId);
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
    if (f.round > maxLp || !f.played || f.homeGoals === undefined || f.awayGoals === undefined) continue;
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
    } else if (f.awayGoals > f.homeGoals) {
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
    .map((r) => ({ ...r, goalDifference: r.goalsFor - r.goalsAgainst, form: r.form.slice(-5) }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.clubName.localeCompare(b.clubName);
    });
}

function getKoWinnerId(f: Fixture): string | null {
  if (!f.played || f.homeGoals === undefined || f.awayGoals === undefined) return null;
  if (f.homeGoals > f.awayGoals) return f.homeClubId;
  if (f.awayGoals > f.homeGoals) return f.awayClubId;
  return f.penaltiesWinnerId ?? f.homeClubId;
}

export function advanceUefaKnockoutIfReady(
  compId: UefaCompId,
  fixtures: Fixture[],
  standings: StandingRow[],
  teamLookup: Map<string, ContextTeam>,
  seasonStartYear = 2026
): Fixture[] {
  const lpRounds = getUefaLeaguePhaseRounds(compId);
  const lpMatches = fixtures.filter((f) => f.round <= lpRounds);
  if (lpMatches.length === 0 || !lpMatches.every((f) => f.played)) return fixtures;

  let updated = [...fixtures];
  const idPrefix = seasonStartYear === 2026 ? '' : `S${seasonStartYear}_`;

  // Round 9: Knockout Phase Play-off (#9-#24: 9v24 .. 16v17)
  if (!updated.some((f) => f.round === 9) && standings.length >= 24) {
    const dateIso = getUefaRoundDate(compId, 9, seasonStartYear);
    for (let i = 0; i < 8; i++) {
      const high = teamLookup.get(standings[8 + i].clubId);
      const low = teamLookup.get(standings[23 - i].clubId);
      if (!high || !low) continue;
      updated.push({
        id: `${idPrefix}${compId}_R9_${low.shortName}_${high.shortName}_${i}`,
        competitionId: compId,
        round: 9,
        dateIso,
        homeClubId: low.id,
        awayClubId: high.id,
        homeClubName: low.name,
        awayClubName: high.name,
        played: false,
        stageLabel: 'Knockout Play-off',
      });
    }
  }

  // Round 10: Round of 16 (Top 8 vs 8 Play-off winners)
  const r9 = updated.filter((f) => f.round === 9);
  if (r9.length === 8 && r9.every((f) => f.played) && !updated.some((f) => f.round === 10)) {
    const poWinners = r9.map((f) => getKoWinnerId(f)).filter((id): id is string => Boolean(id));
    const dateIso = getUefaRoundDate(compId, 10, seasonStartYear);
    for (let i = 0; i < 8; i++) {
      const seed = teamLookup.get(standings[i]?.clubId ?? '');
      const challenger = teamLookup.get(poWinners[7 - i] ?? '');
      if (!seed || !challenger) continue;
      updated.push({
        id: `${idPrefix}${compId}_R10_${challenger.shortName}_${seed.shortName}_${i}`,
        competitionId: compId,
        round: 10,
        dateIso,
        homeClubId: challenger.id,
        awayClubId: seed.id,
        homeClubName: challenger.name,
        awayClubName: seed.name,
        played: false,
        stageLabel: 'Round of 16',
      });
    }
  }

  // Rounds 11 (QF), 12 (SF), 13 (Final)
  for (const r of [10, 11, 12]) {
    const prev = updated.filter((f) => f.round === r);
    if (prev.length >= 2 && prev.every((f) => f.played) && !updated.some((f) => f.round === r + 1)) {
      const dateIso = getUefaRoundDate(compId, r + 1, seasonStartYear);
      const stageLabel = r + 1 === 11 ? 'Quarter-Final' : r + 1 === 12 ? 'Semi-Final' : 'Final';
      for (let i = 0; i + 1 < prev.length; i += 2) {
        const w1 = teamLookup.get(getKoWinnerId(prev[i]) ?? '');
        const w2 = teamLookup.get(getKoWinnerId(prev[i + 1]) ?? '');
        if (!w1 || !w2) continue;
        updated.push({
          id: `${idPrefix}${compId}_R${r + 1}_${w1.shortName}_${w2.shortName}_${i}`,
          competitionId: compId,
          round: r + 1,
          dateIso,
          homeClubId: w1.id,
          awayClubId: w2.id,
          homeClubName: w1.name,
          awayClubName: w2.name,
          played: false,
          stageLabel,
        });
      }
    }
  }

  return updated;
}

export function getUefaChampion(fixtures: Fixture[]): { clubId: string; clubName: string } | undefined {
  const final = fixtures.find((f) => f.round === 13 && f.played);
  if (!final) return undefined;
  const winnerId = getKoWinnerId(final);
  if (!winnerId) return undefined;
  return {
    clubId: winnerId,
    clubName: winnerId === final.homeClubId ? final.homeClubName : final.awayClubName,
  };
}

export function resolveCountryPyramidMovements(
  standingsByLeague: Partial<Record<DomesticLeagueId, StandingRow[]>>,
  leagueTeams: Partial<Record<DomesticLeagueId, ContextTeam[]>>,
  playTie: (compId: CompetitionId, homeId: string, awayId: string, round: number, label: string) => { winnerId: string; scoreText: string },
  playFourTeamBracket: (compId: CompetitionId, rows: StandingRow[]) => { winnerId: string; scoreText: string }
): { movements: TierMovement[]; playoffs: PlayoffTieResult[] } {
  const movements: TierMovement[] = [];
  const playoffs: PlayoffTieResult[] = [];
  const reserveSet = new Set<string>();
  for (const lid of ALL_DOMESTIC_LEAGUE_IDS) {
    for (const t of leagueTeams[lid] ?? []) {
      if (t.isReserve) reserveSet.add(t.id);
    }
  }

  for (const country of COUNTRY_CATALOG) {
    if (country.leagues.length < 2) continue;
    for (let i = 0; i + 1 < country.leagues.length; i++) {
      const upperId = country.leagues[i];
      const lowerId = country.leagues[i + 1];
      const upperMeta = LEAGUE_CATALOG[upperId];
      const lowerMeta = LEAGUE_CATALOG[lowerId];
      const upperTable = standingsByLeague[upperId] ?? [];
      const lowerTable = standingsByLeague[lowerId] ?? [];
      if (upperTable.length < 6 || lowerTable.length < 6) continue;

      const eligibleLower = lowerMeta.excludeReserveFromPromotion
        ? lowerTable.filter((r) => !reserveSet.has(r.clubId))
        : lowerTable;

      const autoUp = eligibleLower.slice(0, lowerMeta.autoPromote);
      let promoted: StandingRow[] = [...autoUp];
      let viaPlayoffClubId: string | undefined;

      // Relegation playoff vs lower playoff
      if (upperMeta.playoffRelegate === 1 && lowerMeta.playoffPromote === 1) {
        // Direct relegated from upper
        const autoDown = upperTable.slice(-upperMeta.autoRelegate);
        // Contender from upper (#N - autoRelegate)
        const upperPlayoffRow = upperTable[upperTable.length - upperMeta.autoRelegate - 1];
        let lowerContenderRow: StandingRow | undefined;

        if (lowerMeta.playoffRange && lowerMeta.playoffRange[1] > lowerMeta.playoffRange[0]) {
          // Multi-team playoff in lower tier to meet upperPlayoffRow (e.g. FRA2 #3-#5 or NED2 #3-#8)
          const slice = eligibleLower.slice(lowerMeta.playoffRange[0] - 1, lowerMeta.playoffRange[1]);
          if (slice.length >= 2) {
            const subWinner = playFourTeamBracket(lowerId, slice.slice(0, 4));
            lowerContenderRow = eligibleLower.find((r) => r.clubId === subWinner.winnerId) ?? slice[0];
          } else {
            lowerContenderRow = eligibleLower[lowerMeta.autoPromote];
          }
        } else {
          lowerContenderRow = eligibleLower[lowerMeta.autoPromote];
        }

        const relegated: StandingRow[] = [...autoDown];
        if (upperPlayoffRow && lowerContenderRow) {
          const tie = playTie(lowerId, lowerContenderRow.clubId, upperPlayoffRow.clubId, 98, 'Promotion / Relegation Play-Off');
          const winRow = tie.winnerId === lowerContenderRow.clubId ? lowerContenderRow : upperPlayoffRow;
          playoffs.push({
            competitionId: lowerId,
            winnerId: winRow.clubId,
            winnerName: winRow.clubName,
            finalSummary: tie.scoreText,
          });
          if (winRow.clubId === lowerContenderRow.clubId) {
            promoted.push(lowerContenderRow);
            viaPlayoffClubId = lowerContenderRow.clubId;
            relegated.push(upperPlayoffRow);
          }
        }

        movements.push({
          fromLeague: lowerId,
          toLeague: upperId,
          direction: 'PROMOTED',
          clubIds: promoted.map((r) => r.clubId),
          clubNames: promoted.map((r) => r.clubName),
          viaPlayoffClubId,
        });
        movements.push({
          fromLeague: upperId,
          toLeague: lowerId,
          direction: 'RELEGATED',
          clubIds: relegated.map((r) => r.clubId),
          clubNames: relegated.map((r) => r.clubName),
        });
      } else {
        // Pure playoff spot(s) from lower tier
        const relegated = upperTable.slice(-upperMeta.autoRelegate);
        if (lowerMeta.playoffPromote === 1 && lowerMeta.playoffRange) {
          const [startRank, endRank] = lowerMeta.playoffRange;
          const contenders = eligibleLower.slice(startRank - 1, endRank);
          if (contenders.length >= 4) {
            const po = playFourTeamBracket(lowerId, contenders.slice(0, 4));
            const poRow = eligibleLower.find((r) => r.clubId === po.winnerId) ?? contenders[0];
            playoffs.push({
              competitionId: lowerId,
              winnerId: poRow.clubId,
              winnerName: poRow.clubName,
              finalSummary: po.scoreText,
            });
            promoted.push(poRow);
            viaPlayoffClubId = poRow.clubId;
          } else if (contenders[0]) {
            promoted.push(contenders[0]);
            viaPlayoffClubId = contenders[0].clubId;
          }
        }
        movements.push({
          fromLeague: lowerId,
          toLeague: upperId,
          direction: 'PROMOTED',
          clubIds: promoted.map((r) => r.clubId),
          clubNames: promoted.map((r) => r.clubName),
          viaPlayoffClubId,
        });
        movements.push({
          fromLeague: upperId,
          toLeague: lowerId,
          direction: 'RELEGATED',
          clubIds: relegated.map((r) => r.clubId),
          clubNames: relegated.map((r) => r.clubName),
        });
      }
    }
  }

  return { movements, playoffs };
}

export function qualifyNextSeasonUefaTeams(
  standingsByLeague: Partial<Record<DomesticLeagueId, StandingRow[]>>,
  cupWinners: Partial<Record<CompetitionId, { clubId: string; clubName: string }>>
): Record<UefaCompId, string[]> {
  const taken = new Set<string>();
  const ucl: string[] = [];
  const uel: string[] = [];
  const uecl: string[] = [];

  const takeUnique = (dest: string[], id: string | undefined, max: number) => {
    if (!id || dest.length >= max || taken.has(id)) return false;
    taken.add(id);
    dest.push(id);
    return true;
  };

  for (const country of COUNTRY_CATALOG) {
    if (!country.isEuropeanUefaEligible || !country.uefaSlots) continue;
    const topLeagueId = country.leagues[0];
    const table = standingsByLeague[topLeagueId] ?? [];
    const { ucl: uclCutoff, uel: uelCutoff, uecl: ueclCutoff } = country.uefaSlots;

    for (let i = 0; i < Math.min(uclCutoff, table.length); i++) {
      takeUnique(ucl, table[i].clubId, 36);
    }
    const cupWin = cupWinners[country.primaryCupId]?.clubId;
    if (cupWin) {
      takeUnique(uel, cupWin, 36);
    }
    for (let i = uclCutoff; i < Math.min(uelCutoff, table.length); i++) {
      takeUnique(uel, table[i].clubId, 36);
    }
    for (let i = uclCutoff; i < Math.min(ueclCutoff + 2, table.length); i++) {
      if (uecl.length < 36) takeUnique(uecl, table[i].clubId, 36);
    }
  }

  // Fill remaining European slots from Season 1 seeds & Rest of Europe pool so each stays strictly 36 teams
  const fallbackSeeds = getInitialUefaSeeds();
  for (const id of [...fallbackSeeds.UCL, ...getAllRestOfEuropeContextTeams().map((c) => c.id)]) {
    if (ucl.length >= 36) break;
    takeUnique(ucl, id, 36);
  }
  for (const id of [...fallbackSeeds.UEL, ...getAllRestOfEuropeContextTeams().map((c) => c.id)]) {
    if (uel.length >= 36) break;
    takeUnique(uel, id, 36);
  }
  for (const id of [...fallbackSeeds.UECL, ...getAllRestOfEuropeContextTeams().map((c) => c.id)]) {
    if (uecl.length >= 36) break;
    takeUnique(uecl, id, 36);
  }

  return { UCL: ucl, UEL: uel, UECL: uecl };
}

export function isReserveCupCompetition(compId: CompetitionId): boolean {
  return !isDomesticLeagueId(compId);
}

export function getCountryDefaultTier(leagueId: CompetitionId): number {
  return isDomesticLeagueId(leagueId) ? LEAGUE_CATALOG[leagueId].tier : 1;
}

export { getCountryForLeague, UEFA_COMPETITIONS };
