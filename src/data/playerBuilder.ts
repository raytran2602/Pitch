import {
  Club,
  CompetitionId,
  DetailedPosition,
  FormationName,
  LoanInfo,
  Player,
  PlayerAttributes,
  PlayerRole,
  Position,
  RoleMasteryLevel,
  SquadStatus,
  TacticsConfig,
  TeamRoles,
} from '../types/game';
import {
  buildDetailedAttributes,
  computeFc27Ovr,
  deriveDefaultRoleMastery,
  deriveDefaultSecondaryPositions,
  derivePlayerMeta,
  DETAILED_TO_COARSE_POS,
  getAllowedRolesForSlot,
  hydrateEaPlayerProfile,
} from '../utils/playerAttributes';

export const BENCH_SIZE = 9;

export interface RosterLoanSeed {
  dir: 'IN' | 'OUT';
  clubId: string;
  clubName: string;
  wageSharePct?: number;
}

export type RosterSeed = [
  name: string,
  detailedPos: DetailedPosition,
  ovr: number,
  age: number,
  nat: string,
  shirt: number,
  secondary?: DetailedPosition[],
  role?: PlayerRole,
  mastery?: Partial<Record<PlayerRole, RoleMasteryLevel>>,
  loan?: RosterLoanSeed,
];

export interface RawClubSeed {
  id: string;
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  pattern: Club['pattern'];
  managerName: string;
  stadium: string;
  budget: number;
  formation: FormationName;
  tactics: TacticsConfig;
  roster: RosterSeed[];
}

export interface WorldClubSeed extends RawClubSeed {
  leagueId: CompetitionId | 'EUR_UEFA';
  ovr: number;
  conf?: 'EAST' | 'WEST';
  isReserve?: boolean;
}

function makeAttributes(pos: Position, ovr: number, seed: number): PlayerAttributes {
  return buildDetailedAttributes(pos, ovr, seed);
}

function defaultRole(detailedPos: DetailedPosition, idx: number, ovr: number): PlayerRole {
  const allowed = getAllowedRolesForSlot(detailedPos);
  if (detailedPos === 'GK') {
    return ovr >= 82 ? 'Sweeper Keeper' : idx % 2 === 0 ? 'Goalkeeper' : 'Ball-Playing Keeper';
  }
  return allowed[idx % allowed.length];
}

export function makePlayer(
  clubId: string,
  idx: number,
  name: string,
  detailedPos: DetailedPosition,
  ovr: number,
  age: number,
  nat: string,
  shirt: number,
  secondaryPositions?: DetailedPosition[],
  explicitRole?: PlayerRole,
  explicitMastery?: Partial<Record<PlayerRole, RoleMasteryLevel>>,
  loanSeed?: RosterLoanSeed,
  leagueScale = 1
): Player {
  const pos: Position = DETAILED_TO_COARSE_POS[detailedPos];
  const seed = clubId.charCodeAt(0) * 13 + idx * 7 + ovr;
  const eaProfile = hydrateEaPlayerProfile(name, detailedPos, clubId);
  const attributes = eaProfile ? eaProfile.attributes : makeAttributes(pos, ovr, seed);
  const computedOvr = eaProfile ? eaProfile.ovr : computeFc27Ovr(detailedPos, attributes);
  const resolvedAge = eaProfile?.age ?? age;
  const resolvedNat = eaProfile?.nationality ?? nat;

  const baseValue = Math.round(
    Math.pow(Math.max(1, computedOvr - 56), 2.32) *
      38000 *
      leagueScale *
      (resolvedAge < 24 ? 1.25 : resolvedAge > 30 ? 0.65 : 1)
  );
  const marketValue = Math.max(250_000, Math.round(baseValue / 50_000) * 50_000);
  const weeklyWage = Math.max(
    2_500,
    Math.round((((computedOvr - 56) * 6_200) * leagueScale) / 500) * 500
  );
  const status: SquadStatus = loanSeed?.dir === 'IN'
    ? 'Rotation'
    : idx < 5
    ? 'Crucial'
    : idx < 11
    ? 'Important'
    : idx < 16
    ? 'Rotation'
    : resolvedAge <= 21
    ? 'Prospect'
    : 'Sporadic';

  const role = explicitRole ?? defaultRole(detailedPos, idx, computedOvr);
  const secondaries = secondaryPositions ?? deriveDefaultSecondaryPositions(detailedPos, seed);
  const roleMastery =
    explicitMastery ?? deriveDefaultRoleMastery(detailedPos, role, computedOvr, seed);
  const id = `${clubId}_p${idx + 1}`;
  const meta = derivePlayerMeta({ id, position: pos, ovr: computedOvr, role });

  const loanInfo: LoanInfo | undefined = loanSeed
    ? {
        direction: loanSeed.dir,
        counterpartyClubId: loanSeed.clubId,
        counterpartyClubName: loanSeed.clubName,
        wageSharePct: loanSeed.wageSharePct ?? (loanSeed.dir === 'IN' ? 65 : 30),
        returnSeasonYear: 2027,
        durationSeasons: 1,
      }
    : undefined;

  return {
    id,
    name,
    nationality: resolvedNat,
    age: resolvedAge,
    heightCm: eaProfile?.heightCm ?? (pos === 'GK' ? 190 + (seed % 6) : pos === 'DEF' ? 182 + (seed % 9) : 174 + (seed % 11)),
    preferredFoot: eaProfile?.preferredFoot ?? (detailedPos === 'LB' || detailedPos === 'LW' || seed % 4 === 0 ? 'Left' : 'Right'),
    weakFoot: eaProfile?.weakFoot ?? meta.weakFoot,
    skillMoves: eaProfile?.skillMoves ?? (pos === 'GK' ? 1 : Math.min(5, Math.max(2, Math.round((computedOvr - 66) / 6)))),
    attackingWorkRate: meta.attackingWorkRate,
    defensiveWorkRate: meta.defensiveWorkRate,
    playStyles: meta.playStyles,
    shirtNumber: shirt,
    position: pos,
    detailedPosition: detailedPos,
    secondaryPositions: secondaries,
    ovr: computedOvr,
    potential: Math.min(95, resolvedAge <= 23 ? computedOvr + 5 : computedOvr + 1),
    fitness: 96 - (idx % 4),
    suspendedMatches: 0,
    injuredMatches: 0,
    yellowCards: 0,
    redCards: 0,
    goals: 0,
    assists: 0,
    cleanSheets: 0,
    appearances: 0,
    marketValue,
    weeklyWage,
    contractExpiry: 2027 + (seed % 4),
    squadStatus: status,
    releaseClause: Math.round((marketValue * 1.45) / 50_000) * 50_000,
    goalBonus: Math.max(1_000, Math.round(((pos === 'FWD' ? 12000 : pos === 'MID' ? 8000 : 4000) * leagueScale) / 500) * 500),
    forSale: false,
    loanInfo,
    role,
    roleMastery,
    attributes,
  };
}

export function deriveDefaultTeamRoles(players: Player[]): TeamRoles {
  const outfield = players.filter((p) => p.position !== 'GK');
  const pool = outfield.length > 0 ? outfield : players;
  const byOvr = [...pool].sort((a, b) => b.ovr - a.ovr);
  const captain =
    [...pool].sort((a, b) => b.ovr + (b.age >= 26 ? 4 : 0) - (a.ovr + (a.age >= 26 ? 4 : 0)))[0] ??
    players[0];
  const penalty =
    [...pool].sort(
      (a, b) =>
        (b.attributes.shootingDetails?.penalties ?? b.attributes.finishing) -
        (a.attributes.shootingDetails?.penalties ?? a.attributes.finishing)
    )[0] ?? byOvr[0];
  const freeKick =
    [...pool].sort(
      (a, b) =>
        (b.attributes.passingDetails?.fkAccuracy ?? b.attributes.passing) -
        (a.attributes.passingDetails?.fkAccuracy ?? a.attributes.passing)
    )[0] ?? byOvr[0];
  const cornerSorted = [...pool].sort(
    (a, b) =>
      (b.attributes.passingDetails?.crossing ?? b.attributes.passing) -
      (a.attributes.passingDetails?.crossing ?? a.attributes.passing)
  );
  const leftCorner = cornerSorted[0] ?? byOvr[0];
  const rightCorner = cornerSorted[1] ?? cornerSorted[0] ?? byOvr[0];

  return {
    captainId: captain?.id,
    penaltyId: penalty?.id,
    freeKickId: freeKick?.id,
    leftCornerId: leftCorner?.id,
    rightCornerId: rightCorner?.id,
  };
}

export function getLeagueEconomicScale(leagueId: CompetitionId | 'EUR_UEFA'): number {
  switch (leagueId) {
    case 'PL':
    case 'ESP1':
    case 'GER1':
    case 'ITA1':
      return 0.95;
    case 'FRA1':
      return 0.85;
    case 'KSA1':
    case 'NED1':
    case 'POR1':
    case 'TUR1':
      return 0.68;
    case 'USA1':
    case 'BEL1':
    case 'CHAMP':
    case 'GRE1':
    case 'AUT1':
    case 'DEN1':
    case 'SCO1':
    case 'SUI1':
      return 0.56;
    case 'CZE1':
    case 'NOR1':
    case 'POL1':
    case 'UKR1':
    case 'CRO1':
    case 'SWE1':
    case 'GER2':
    case 'ESP2':
    case 'ITA2':
    case 'FRA2':
      return 0.44;
    case 'L1':
    case 'NED2':
    case 'POR2':
    case 'TUR2':
    case 'KSA2':
    case 'GER3':
      return 0.3;
    case 'L2':
      return 0.2;
    default:
      return 0.5;
  }
}

export function buildClubFromSeed(
  raw: RawClubSeed & { conf?: 'EAST' | 'WEST'; isReserve?: boolean },
  leagueId: CompetitionId
): Club {
  const leagueScale = getLeagueEconomicScale(leagueId);
  const players = raw.roster.map(
    ([name, detailedPos, ovr, age, nat, shirt, secondary, role, mastery, loan], idx) =>
      makePlayer(
        raw.id,
        idx,
        name,
        detailedPos,
        ovr,
        age,
        nat,
        shirt,
        secondary,
        role,
        mastery,
        loan,
        leagueScale
      )
  );
  const eligible = players.filter((p) => p.loanInfo?.direction !== 'OUT');
  const slotRoles: Record<number, PlayerRole> = {};
  eligible.slice(0, 11).forEach((p, idx) => {
    slotRoles[idx] = p.role;
  });
  return {
    id: raw.id,
    name: raw.name,
    shortName: raw.shortName,
    primaryColor: raw.primaryColor,
    secondaryColor: raw.secondaryColor,
    pattern: raw.pattern,
    managerName: raw.managerName,
    stadium: raw.stadium,
    leagueId,
    conf: raw.conf,
    isReserve: raw.isReserve,
    openingBudget: raw.budget,
    balance: raw.budget,
    players,
    formation: raw.formation,
    tactics: { ...raw.tactics },
    startingIds: eligible.slice(0, 11).map((p) => p.id),
    benchIds: eligible.slice(11, 11 + BENCH_SIZE).map((p) => p.id),
    slotRoles,
    teamRoles: deriveDefaultTeamRoles(eligible),
  };
}
