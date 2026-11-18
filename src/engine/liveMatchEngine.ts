import { deriveDefaultTeamRoles, FORMATION_SLOTS } from '../data/premierLeague2627';
import {
  Club,
  DetailedPosition,
  Fixture,
  FormationName,
  MatchEvent,
  MatchReport,
  MatchStats,
  Player,
  PlayerMatchRating,
  PlayerRole,
  Position,
  TacticsConfig,
  TeamRoles,
} from '../types/game';
import {
  getPlayerRoleMastery,
  getPlayerSlotEvaluation,
  isPlayerAvailableForMatchday,
} from '../utils/playerAttributes';

export interface PitchCoordinate {
  x: number; // 0 (Home goal) -> 100 (Away goal)
  y: number; // 0 (Top touchline) -> 100 (Bottom touchline)
}

export interface LivePlayerRuntime {
  player: Player;
  side: 'HOME' | 'AWAY';
  slotIndex: number; // 0..10 while on pitch or starter slot; -1 if unused bench
  slotLabel: string;
  slotPos: Position;
  detailedPos: DetailedPosition;
  isStarter: boolean;
  onPitch: boolean;
  subbedOff: boolean;
  subInMinute?: number;
  subOutMinute?: number;
  yellowCards: number;
  redCarded: boolean;
  goals: number;
  assists: number;
  liveFitness: number;
  liveRating: number | null;
  x: number;
  y: number;
}

export interface LiveTeamRuntime {
  side: 'HOME' | 'AWAY';
  club: Club;
  starters: LivePlayerRuntime[];
  bench: LivePlayerRuntime[];
  activeIds: string[]; // length 11 indexed by slotIndex 0..10
  subsUsed: number;
  shots: number;
  shotsOnTarget: number;
  xg: number;
  passes: number;
  passesCompleted: number;
  possessionTicks: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
  offsides: number;
  corners: number;
}

export interface LiveMatchSession {
  fixture: Fixture;
  userSide: 'HOME' | 'AWAY';
  minute: number; // 0..90
  finished: boolean;
  homeGoals: number;
  awayGoals: number;
  possessionSide: 'HOME' | 'AWAY';
  ballPos: PitchCoordinate;
  ballCarrierId: string | null;
  lastEventType: MatchEvent['type'] | 'SHOT' | null;
  lastGoalMinute: number | null;
  lastCommentary: string;
  home: LiveTeamRuntime;
  away: LiveTeamRuntime;
  events: MatchEvent[];
  seedState: number;
  aiHomeSubTicks: number[];
  aiAwaySubTicks: number[];
}

export function computeTacticalMatchupShift(
  attTactics: TacticsConfig,
  defTactics: TacticsConfig,
  attFitness: number,
  goalDiff: number,
  minute: number,
  attAttackPace: number
): { edgeDelta: number; cornerBoost: number; foulBoost: number; offsideBoost: number } {
  let edgeDelta = 0;
  let cornerBoost = 0;
  let foulBoost = 0;
  let offsideBoost = 0;

  if (
    (attTactics.preset === 'Gegenpress' || attTactics.defensiveApproach === 'High Press') &&
    defTactics.buildUpStyle === 'Short Passing' &&
    attFitness >= 72
  ) {
    edgeDelta += 0.35;
    foulBoost += 0.03;
  }

  if (
    (attTactics.preset === 'Counter-Attack' || attTactics.buildUpStyle === 'Long Ball') &&
    defTactics.defensiveLine >= 7
  ) {
    edgeDelta += 0.25 + Math.max(0, (attAttackPace - 78) * 0.025);
    offsideBoost += 0.05;
  }

  if (defTactics.preset === 'Park the Bus' || defTactics.defensiveLine <= 3) {
    edgeDelta -= 0.22;
  }

  if (attTactics.preset === 'Wing Play' && attTactics.attackingWidth >= 7) {
    edgeDelta += 0.15;
    cornerBoost += 0.08;
  }

  if (minute >= 60) {
    if (goalDiff < 0) {
      edgeDelta += Math.min(0.45, Math.abs(goalDiff) * 0.22);
      cornerBoost += 0.04;
    } else if (goalDiff > 0 && minute >= 75) {
      edgeDelta -= 0.18;
      foulBoost += 0.015;
    }
  }

  return { edgeDelta, cornerBoost, foulBoost, offsideBoost };
}

export function computePlayerScoreWeight(
  p: Player,
  slotPosOrDetailed: string,
  roles: TeamRoles,
  attTactics: TacticsConfig,
  fitness: number,
  isSubOn = false
): number {
  const dp = String(p.detailedPosition ?? slotPosOrDetailed).toUpperCase();
  let base = 2;
  if (dp === 'GK') base = 0;
  else if (dp === 'ST') base = 16;
  else if (dp === 'LW' || dp === 'RW') base = 11;
  else if (dp === 'CAM') base = 9.5;
  else if (dp === 'CM') base = 5;
  else if (dp === 'CDM') base = 2.5;
  else if (dp === 'LB' || dp === 'RB') base = 1.6;
  else base = 1.3;

  const fin = p.attributes.shootingDetails?.finishing ?? p.attributes.finishing;
  const attPos = p.attributes.shootingDetails?.positioning ?? p.attributes.finishing;
  const pace = p.attributes.pace;
  const attrMult =
    dp === 'GK'
      ? 0
      : Math.max(0.55, 0.72 + (fin - 68) * 0.012 + (attPos - 68) * 0.008 + Math.max(0, p.ovr - 74) * 0.015);

  let tacticalMult = 1;
  if (attTactics.preset === 'Wing Play' && (dp === 'LW' || dp === 'RW')) tacticalMult += 0.22;
  if (attTactics.playersInBox >= 7 && (dp === 'ST' || dp === 'CAM' || dp === 'CM')) tacticalMult += 0.15;
  if (attTactics.preset === 'Counter-Attack' && pace >= 84 && (dp === 'ST' || dp === 'LW' || dp === 'RW')) {
    tacticalMult += 0.18;
  }

  const fitnessMult = isSubOn && fitness >= 80 ? 1.18 : fitness < 60 ? 0.84 : 1;
  let weight = base * attrMult * tacticalMult * fitnessMult;
  if (p.id === roles.penaltyId) weight += 4.5;
  if (p.id === roles.freeKickId) weight += 2.5;
  return dp === 'GK' ? 0 : Math.max(0.5, weight);
}

export function computePlayerAssistWeight(
  p: Player,
  slotPosOrDetailed: string,
  roles: TeamRoles,
  attTactics: TacticsConfig
): number {
  const dp = String(p.detailedPosition ?? slotPosOrDetailed).toUpperCase();
  let base = 2;
  if (dp === 'GK') base = 0.2;
  else if (dp === 'CAM') base = 12;
  else if (dp === 'LW' || dp === 'RW') base = 10.5;
  else if (dp === 'CM') base = 8.5;
  else if (dp === 'ST') base = 5.2;
  else if (dp === 'LB' || dp === 'RB') base = 5.0;
  else if (dp === 'CDM') base = 3.8;
  else base = 1.0;

  const vis = p.attributes.passingDetails?.vision ?? p.attributes.passing;
  const cro = p.attributes.passingDetails?.crossing ?? p.attributes.passing;
  const spa = p.attributes.passingDetails?.shortPassing ?? p.attributes.passing;
  const playmaking = (vis * 0.45 + spa * 0.3 + cro * 0.25 - 68) * 0.012;
  let attrMult = Math.max(0.55, 0.85 + playmaking);

  if (attTactics.preset === 'Wing Play' && (dp === 'LB' || dp === 'RB' || dp === 'LW' || dp === 'RW')) {
    attrMult += 0.24;
  }

  let weight = base * attrMult;
  if (p.id === roles.leftCornerId || p.id === roles.rightCornerId) weight += 4.5;
  if (p.id === roles.freeKickId) weight += 2.5;
  return Math.max(0.2, weight);
}

export function computeFoulOffenderWeight(p: Player, currentYellows: number): number {
  if (p.position === 'GK') return 0.4;
  const posBase = p.position === 'DEF' ? 7 : p.position === 'MID' ? 6 : 2.5;
  const agg = p.attributes.physicalDetails?.aggression ?? p.attributes.physical;
  const tackle = p.attributes.defendingDetails?.standingTackle ?? p.attributes.defending;
  const attrBias = Math.max(0.6, 0.7 + (agg - 65) * 0.012 + (tackle - 65) * 0.005);
  const cautionFactor = currentYellows >= 1 ? 0.55 : 1;
  return Math.max(0.5, posBase * attrBias * cautionFactor);
}

export function resolveShotAndGoalDuel(
  shooter: Player,
  gkPlayer: Player | undefined,
  edge: number,
  isPenalty: boolean,
  rand: () => number
): { onTarget: boolean; goal: boolean; shotXg: number } {
  const shooterFin = shooter.attributes.shootingDetails?.finishing ?? shooter.attributes.finishing;
  const shooterComp = shooter.attributes.dribblingDetails?.composure ?? shooter.ovr;
  const shooterPow = shooter.attributes.shootingDetails?.shotPower ?? shooter.attributes.finishing;
  const penSkill = shooter.attributes.shootingDetails?.penalties ?? shooterFin;

  const gkRating = gkPlayer
    ? gkPlayer.position === 'GK'
      ? Math.round(
          ((gkPlayer.attributes.goalkeeperDetails?.reflexes ?? gkPlayer.attributes.goalkeeper) * 0.4 +
            (gkPlayer.attributes.goalkeeperDetails?.positioning ?? gkPlayer.attributes.goalkeeper) * 0.35 +
            (gkPlayer.attributes.goalkeeperDetails?.diving ?? gkPlayer.attributes.goalkeeper) * 0.25)
        )
      : Math.max(38, gkPlayer.ovr - 26)
    : 72;

  if (isPenalty) {
    const onTargetProb = Math.max(0.84, Math.min(0.97, 0.88 + (penSkill - 72) * 0.003));
    const onTarget = rand() < onTargetProb;
    if (!onTarget) return { onTarget: false, goal: false, shotXg: 0.78 };
    const convProb = Math.max(0.68, Math.min(0.9, 0.8 + (penSkill - gkRating) * 0.004));
    return { onTarget: true, goal: rand() < convProb, shotXg: 0.78 };
  }

  const shooterAccuracyBias = (shooterFin * 0.6 + shooterPow * 0.2 + shooterComp * 0.2 - 74) * 0.005;
  const onTargetProb = Math.max(0.24, Math.min(0.58, 0.37 + edge * 0.03 + shooterAccuracyBias));
  const onTarget = rand() < onTargetProb;
  if (!onTarget) {
    return { onTarget: false, goal: false, shotXg: 0.04 + rand() * 0.06 };
  }

  const duelDiff = (shooterFin * 0.65 + shooterComp * 0.35 - gkRating) * 0.0045;
  const goalProb = Math.max(0.14, Math.min(0.46, 0.25 + edge * 0.045 + duelDiff));
  const shotXg = Math.max(0.08, Math.min(0.52, goalProb + 0.02 + rand() * 0.1));
  return { onTarget: true, goal: rand() < goalProb, shotXg };
}

function nextSeeded(state: number): { value: number; nextState: number } {
  let s = state % 2147483647;
  if (s <= 0) s += 2147483646;
  const next = (s * 16807) % 2147483647;
  return {
    value: (next - 1) / 2147483646,
    nextState: next,
  };
}

function getOrderedStarters(club: Club) {
  const slots = FORMATION_SLOTS[club.formation] ?? FORMATION_SLOTS['4-2-3-1'];
  const playerById = new Map(club.players.map((p) => [p.id, p]));
  const result: {
    player: Player;
    slotIndex: number;
    label: string;
    slotPos: Position;
    detailedPos: DetailedPosition;
  }[] = [];
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

function resolveBench(club: Club, starterIds: Set<string>): Player[] {
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
}

function findRuntime(team: LiveTeamRuntime, playerId: string): LivePlayerRuntime | undefined {
  return (
    team.starters.find((p) => p.player.id === playerId) ??
    team.bench.find((p) => p.player.id === playerId)
  );
}

function getAllPlayers(team: LiveTeamRuntime): LivePlayerRuntime[] {
  return [...team.starters, ...team.bench];
}

function getActivePlayers(team: LiveTeamRuntime): LivePlayerRuntime[] {
  return team.activeIds
    .map((id) => findRuntime(team, id))
    .filter((p): p is LivePlayerRuntime => Boolean(p && p.onPitch && !p.redCarded));
}

function computeHorizontalAnchor(
  side: 'HOME' | 'AWAY',
  slotIndex: number,
  formation: FormationName,
  tactics: TacticsConfig,
  hasPossession: boolean,
  ballPos: PitchCoordinate,
  isCarrier: boolean,
  jitterX: number,
  jitterY: number
): PitchCoordinate {
  const slots = FORMATION_SLOTS[formation] ?? FORMATION_SLOTS['4-2-3-1'];
  const slot = slots[slotIndex] ?? slots[slots.length - 1];

  if (slot.position === 'GK') {
    const gkX = side === 'HOME' ? (hasPossession ? 8.5 : 5.5) : hasPossession ? 91.5 : 94.5;
    const gkY = 50 + (ballPos.y - 50) * 0.18;
    return { x: Math.max(3, Math.min(97, gkX)), y: Math.max(32, Math.min(68, gkY)) };
  }

  // Convert vertical slot.y (88 near own GK -> 15 opp box) into horizontal base depth (16..56 from own goal)
  const forwardNorm = Math.max(0, Math.min(1, (88 - slot.y) / 73));
  const lineBias = ((tactics.defensiveLine ?? 6) - 5) * 1.4;
  const presetBoost =
    tactics.preset === 'Gegenpress' || tactics.preset === 'Tiki-Taka'
      ? 3.2
      : tactics.preset === 'Park the Bus'
      ? -4.5
      : 0;
  const possDepthShift = hasPossession ? 5.5 : -2.5;
  const ballDepthFromOwnGoal = (side === 'HOME' ? ballPos.x : 100 - ballPos.x) - 50;
  const ballDepthShift = ballDepthFromOwnGoal * (hasPossession ? 0.2 : 0.14);

  const teamDepth = 16 + forwardNorm * 40 + lineBias + presetBoost + possDepthShift + ballDepthShift;
  const naturalX = side === 'HOME' ? teamDepth : 100 - teamDepth;
  let finalX = naturalX + (ballPos.x - naturalX) * (hasPossession ? 0.16 : 0.22) + jitterX;

  if (isCarrier) {
    finalX = finalX + (ballPos.x - finalX) * 0.42;
  }

  // Vertical lane based on slot.x (0..100), modulated by attackingWidth
  const widthFactor = hasPossession
    ? 0.85 + ((tactics.attackingWidth ?? 6) - 5) * 0.045
    : 0.82;
  const baseLane = side === 'HOME' ? slot.x : 100 - slot.x;
  let finalY = 50 + (baseLane - 50) * widthFactor + (ballPos.y - 50) * 0.14 + jitterY;

  if (isCarrier) {
    finalY = finalY + (ballPos.y - finalY) * 0.42;
  }

  return {
    x: Math.max(7, Math.min(93, finalX)),
    y: Math.max(8, Math.min(92, finalY)),
  };
}

function computeLiveTeamStrength(team: LiveTeamRuntime) {
  const active = getActivePlayers(team);
  const starterSet = new Set(active.map((a) => a.player.id));
  const weighted = active.map((entry) => {
    const evalRes = getPlayerSlotEvaluation(entry.player, entry.slotLabel);
    const assignedRole = team.club.slotRoles?.[entry.slotIndex] ?? entry.player.role;
    const mastery = getPlayerRoleMastery(entry.player, assignedRole);
    const masteryBoost = mastery === 'Role++' ? 1.15 : mastery === 'Role+' ? 0.5 : 0;
    const effWithFit =
      evalRes.effectiveOvr * (0.78 + (entry.liveFitness / 100) * 0.22) + masteryBoost;
    return {
      entry,
      effectiveOvr: evalRes.effectiveOvr,
      score: effWithFit,
      masteryBoost,
    };
  });

  const overallAvg =
    weighted.length === 0
      ? 76
      : weighted.reduce((acc, w) => acc + w.score, 0) / weighted.length;

  const avgGroup = (pos: Position) => {
    const group = weighted.filter((w) => w.entry.slotPos === pos);
    if (group.length === 0) return overallAvg;
    return group.reduce((acc, w) => acc + w.score, 0) / group.length;
  };

  const gkEntry = weighted.find((w) => w.entry.slotPos === 'GK');
  const gkScore = gkEntry
    ? gkEntry.entry.player.position === 'GK'
      ? gkEntry.entry.player.attributes.goalkeeper + gkEntry.masteryBoost
      : Math.max(40, gkEntry.effectiveOvr - 4)
    : overallAvg - 5;

  const fitnessAvg =
    active.length === 0
      ? 80
      : active.reduce((acc, p) => acc + p.liveFitness, 0) / active.length;

  let tacticalBonus = 0;
  const tac = team.club.tactics;
  if (tac.preset === 'Gegenpress' && fitnessAvg > 74) tacticalBonus += 1.4;
  if (tac.preset === 'Tiki-Taka') tacticalBonus += 1.1;
  if (tac.preset === 'Counter-Attack') tacticalBonus += 0.65;
  if (tac.preset === 'Wing Play' && tac.attackingWidth >= 7) tacticalBonus += 0.7;
  if (tac.defensiveApproach === 'High Press' && tac.defensiveLine >= 7) tacticalBonus += 0.6;
  if (tac.playersInBox >= 7) tacticalBonus += 0.5;
  if (team.club.teamRoles?.captainId && starterSet.has(team.club.teamRoles.captainId)) {
    tacticalBonus += 0.45;
  }

  return {
    attack: avgGroup('FWD'),
    midfield: avgGroup('MID'),
    defense: avgGroup('DEF'),
    gk: gkScore,
    fitnessAvg,
    tacticalBonus,
    activeCount: active.length,
  };
}

function updateTeamCoordinates(
  team: LiveTeamRuntime,
  hasPossession: boolean,
  ballPos: PitchCoordinate,
  carrierId: string | null,
  seed: number,
  smoothMove = true
): { team: LiveTeamRuntime; nextSeed: number } {
  let s = seed;
  const jitter = () => {
    const r = nextSeeded(s);
    s = r.nextState;
    return (r.value - 0.5) * 1.1;
  };

  const mapPlayer = (p: LivePlayerRuntime): LivePlayerRuntime => {
    if (!p.onPitch || p.redCarded) return p;
    const coords = computeHorizontalAnchor(
      team.side,
      p.slotIndex,
      team.club.formation,
      team.club.tactics,
      hasPossession,
      ballPos,
      carrierId === p.player.id,
      jitter(),
      jitter()
    );
    if (!smoothMove) {
      return { ...p, x: coords.x, y: coords.y };
    }
    const maxStep = carrierId === p.player.id ? 4.8 : 3.6;
    const clampStep = (delta: number) => Math.max(-maxStep, Math.min(maxStep, delta));
    const dx = clampStep((coords.x - p.x) * 0.42);
    const dy = clampStep((coords.y - p.y) * 0.42);
    return {
      ...p,
      x: Math.max(4, Math.min(96, p.x + dx)),
      y: Math.max(6, Math.min(94, p.y + dy)),
    };
  };

  return {
    team: {
      ...team,
      starters: team.starters.map(mapPlayer),
      bench: team.bench.map(mapPlayer),
    },
    nextSeed: s,
  };
}

export function createLiveMatchSession(
  homeClub: Club,
  awayClub: Club,
  fixture: Fixture,
  userSide: 'HOME' | 'AWAY',
  seedOffset = 1
): LiveMatchSession {
  const baseSeed =
    homeClub.id.charCodeAt(0) * 313 +
    awayClub.id.charCodeAt(0) * 197 +
    fixture.round * 71 +
    seedOffset * 17;

  let seed = baseSeed;
  const rand = () => {
    const r = nextSeeded(seed);
    seed = r.nextState;
    return r.value;
  };

  const buildTeamRuntime = (club: Club, side: 'HOME' | 'AWAY'): LiveTeamRuntime => {
    const ordered = getOrderedStarters(club);
    const starterIds = new Set(ordered.map((o) => o.player.id));
    const benchPlayers = resolveBench(club, starterIds);

    const starters: LivePlayerRuntime[] = ordered.map((entry) => {
      const coords = computeHorizontalAnchor(
        side,
        entry.slotIndex,
        club.formation,
        club.tactics,
        side === 'HOME',
        { x: 50, y: 50 },
        false,
        0,
        0
      );
      return {
        player: { ...entry.player },
        side,
        slotIndex: entry.slotIndex,
        slotLabel: entry.label,
        slotPos: entry.slotPos,
        detailedPos: entry.detailedPos,
        isStarter: true,
        onPitch: true,
        subbedOff: false,
        yellowCards: 0,
        redCarded: false,
        goals: 0,
        assists: 0,
        liveFitness: entry.player.fitness,
        liveRating: 6.4,
        x: coords.x,
        y: coords.y,
      };
    });

    const bench: LivePlayerRuntime[] = benchPlayers.map((p) => ({
      player: { ...p },
      side,
      slotIndex: -1,
      slotLabel: p.detailedPosition ?? p.position,
      slotPos: p.position,
      detailedPos: p.detailedPosition ?? (p.position === 'GK' ? 'GK' : 'CM'),
      isStarter: false,
      onPitch: false,
      subbedOff: false,
      yellowCards: 0,
      redCarded: false,
      goals: 0,
      assists: 0,
      liveFitness: p.fitness,
      liveRating: null,
      x: side === 'HOME' ? 15 : 85,
      y: 96,
    }));

    return {
      side,
      club: {
        ...club,
        tactics: { ...club.tactics },
        players: club.players.map((p) => ({ ...p })),
      },
      starters,
      bench,
      activeIds: starters.map((s) => s.player.id),
      subsUsed: 0,
      shots: 0,
      shotsOnTarget: 0,
      xg: 0,
      passes: 0,
      passesCompleted: 0,
      possessionTicks: 0,
      fouls: 0,
      yellowCards: 0,
      redCards: 0,
      offsides: 0,
      corners: 0,
    };
  };

  const homeTeam = buildTeamRuntime(homeClub, 'HOME');
  const awayTeam = buildTeamRuntime(awayClub, 'AWAY');
  const firstCarrier =
    homeTeam.starters[9]?.player.id ?? homeTeam.starters[8]?.player.id ?? homeTeam.activeIds[0] ?? null;

  const scheduleAiSubs = () => {
    const count = 3 + Math.floor(rand() * 3); // 3..5 subs
    return [58, 65, 72, 79, 84].slice(0, count);
  };

  const aiHomeSubTicks = userSide === 'HOME' ? [] : scheduleAiSubs();
  const aiAwaySubTicks = userSide === 'AWAY' ? [] : scheduleAiSubs();

  const homeMoved = updateTeamCoordinates(homeTeam, true, { x: 50, y: 50 }, firstCarrier, seed, false);
  seed = homeMoved.nextSeed;
  const awayMoved = updateTeamCoordinates(awayTeam, false, { x: 50, y: 50 }, firstCarrier, seed, false);
  seed = awayMoved.nextSeed;

  return {
    fixture,
    userSide,
    minute: 0,
    finished: false,
    homeGoals: 0,
    awayGoals: 0,
    possessionSide: 'HOME',
    ballPos: { x: 50, y: 50 },
    ballCarrierId: firstCarrier,
    lastEventType: null,
    lastGoalMinute: null,
    lastCommentary: `Kick-off: ${homeClub.name} vs ${awayClub.name} at ${homeClub.stadium}.`,
    home: homeMoved.team,
    away: awayMoved.team,
    events: [],
    seedState: seed,
    aiHomeSubTicks,
    aiAwaySubTicks,
  };
}

export function applyLiveSubstitution(
  session: LiveMatchSession,
  side: 'HOME' | 'AWAY',
  offPlayerId: string,
  onPlayerId: string
): { ok: boolean; next: LiveMatchSession; reason?: string } {
  if (session.finished) {
    return { ok: false, next: session, reason: 'Match already finished.' };
  }
  const team = side === 'HOME' ? session.home : session.away;
  if (team.subsUsed >= 5) {
    return { ok: false, next: session, reason: 'Maximum 5 substitutions used.' };
  }

  const offRuntime = findRuntime(team, offPlayerId);
  const onRuntime = findRuntime(team, onPlayerId);

  if (!offRuntime || !offRuntime.onPitch || offRuntime.redCarded || offRuntime.subbedOff) {
    return { ok: false, next: session, reason: 'Selected pitch player cannot be substituted.' };
  }
  if (
    !onRuntime ||
    onRuntime.onPitch ||
    onRuntime.subbedOff ||
    !isPlayerAvailableForMatchday(onRuntime.player)
  ) {
    return { ok: false, next: session, reason: 'Selected bench player is unavailable.' };
  }

  const slots = FORMATION_SLOTS[team.club.formation] ?? FORMATION_SLOTS['4-2-3-1'];
  const targetSlot = slots[offRuntime.slotIndex] ?? slots[slots.length - 1];
  const subMin = Math.max(1, session.minute);

  const patchPlayer = (p: LivePlayerRuntime): LivePlayerRuntime => {
    if (p.player.id === offPlayerId) {
      return {
        ...p,
        onPitch: false,
        subbedOff: true,
        subOutMinute: subMin,
      };
    }
    if (p.player.id === onPlayerId) {
      return {
        ...p,
        onPitch: true,
        slotIndex: offRuntime.slotIndex,
        slotLabel: targetSlot.label,
        slotPos: targetSlot.position,
        detailedPos: targetSlot.detailedPosition,
        subInMinute: subMin,
        liveRating: p.liveRating ?? 6.2,
        x: offRuntime.x,
        y: offRuntime.y,
      };
    }
    return p;
  };

  const nextActiveIds = team.activeIds.map((id) => (id === offPlayerId ? onPlayerId : id));
  const nextTeam: LiveTeamRuntime = {
    ...team,
    club: {
      ...team.club,
      startingIds: nextActiveIds,
      benchIds: team.club.benchIds.filter((id) => id !== onPlayerId && id !== offPlayerId),
    },
    starters: team.starters.map(patchPlayer),
    bench: team.bench.map(patchPlayer),
    activeIds: nextActiveIds,
    subsUsed: team.subsUsed + 1,
  };

  const subEvent: MatchEvent = {
    id: `ev_${session.fixture.id}_${subMin}_${side.toLowerCase()}sub_${onPlayerId}`,
    minute: subMin,
    type: 'SUB',
    teamSide: side,
    playerId: onRuntime.player.id,
    playerName: onRuntime.player.name,
    assistPlayerId: offRuntime.player.id,
    assistPlayerName: offRuntime.player.name,
    description: `${team.club.shortName}: ${onRuntime.player.name} replaces ${offRuntime.player.name}.`,
  };

  const updatedCarrier =
    session.ballCarrierId === offPlayerId ? onPlayerId : session.ballCarrierId;

  return {
    ok: true,
    next: {
      ...session,
      [side === 'HOME' ? 'home' : 'away']: nextTeam,
      ballCarrierId: updatedCarrier,
      lastEventType: 'SUB',
      lastCommentary: subEvent.description,
      events: [...session.events, subEvent],
    },
  };
}

export function swapLivePitchPlayers(
  session: LiveMatchSession,
  side: 'HOME' | 'AWAY',
  playerIdA: string,
  playerIdB: string
): { ok: boolean; next: LiveMatchSession; reason?: string } {
  if (session.finished) {
    return { ok: false, next: session, reason: 'Match already finished.' };
  }
  if (playerIdA === playerIdB) {
    return { ok: false, next: session, reason: 'Select two different players to swap.' };
  }
  const team = side === 'HOME' ? session.home : session.away;
  const idxA = team.activeIds.indexOf(playerIdA);
  const idxB = team.activeIds.indexOf(playerIdB);
  if (idxA === -1 || idxB === -1) {
    return { ok: false, next: session, reason: 'Both players must be on the pitch.' };
  }

  const runtimeA = findRuntime(team, playerIdA);
  const runtimeB = findRuntime(team, playerIdB);
  if (
    !runtimeA ||
    !runtimeB ||
    !runtimeA.onPitch ||
    !runtimeB.onPitch ||
    runtimeA.redCarded ||
    runtimeB.redCarded
  ) {
    return { ok: false, next: session, reason: 'Selected player cannot swap positions.' };
  }

  const slots = FORMATION_SLOTS[team.club.formation] ?? FORMATION_SLOTS['4-2-3-1'];
  const slotA = slots[idxA] ?? slots[slots.length - 1];
  const slotB = slots[idxB] ?? slots[slots.length - 1];

  const nextActiveIds = [...team.activeIds];
  nextActiveIds[idxA] = playerIdB;
  nextActiveIds[idxB] = playerIdA;

  const patchRuntime = (p: LivePlayerRuntime): LivePlayerRuntime => {
    if (p.player.id === playerIdA) {
      return {
        ...p,
        slotIndex: idxB,
        slotLabel: slotB.label,
        slotPos: slotB.position,
        detailedPos: slotB.detailedPosition,
      };
    }
    if (p.player.id === playerIdB) {
      return {
        ...p,
        slotIndex: idxA,
        slotLabel: slotA.label,
        slotPos: slotA.position,
        detailedPos: slotA.detailedPosition,
      };
    }
    return p;
  };

  const updatedTeam: LiveTeamRuntime = {
    ...team,
    activeIds: nextActiveIds,
    club: {
      ...team.club,
      startingIds: nextActiveIds,
    },
    starters: team.starters.map(patchRuntime),
    bench: team.bench.map(patchRuntime),
  };

  const moved = updateTeamCoordinates(
    updatedTeam,
    session.possessionSide === side,
    session.ballPos,
    session.ballCarrierId,
    session.seedState,
    true
  );

  const shortA = runtimeA.player.name.split(' ').slice(-1)[0];
  const shortB = runtimeB.player.name.split(' ').slice(-1)[0];

  return {
    ok: true,
    next: {
      ...session,
      [side === 'HOME' ? 'home' : 'away']: moved.team,
      seedState: moved.nextSeed,
      lastCommentary: `${team.club.shortName}: ${shortA} (${slotB.label}) ↔ ${shortB} (${slotA.label}).`,
    },
  };
}

export function updateLiveTeamTactics(
  session: LiveMatchSession,
  side: 'HOME' | 'AWAY',
  formation: FormationName,
  tactics: TacticsConfig,
  slotRoles?: Record<number, PlayerRole>,
  teamRoles?: TeamRoles
): LiveMatchSession {
  const team = side === 'HOME' ? session.home : session.away;
  const slots = FORMATION_SLOTS[formation] ?? FORMATION_SLOTS['4-2-3-1'];

  const slotByPlayerId = new Map<string, number>();
  team.activeIds.forEach((id, idx) => slotByPlayerId.set(id, idx));

  const remap = (p: LivePlayerRuntime): LivePlayerRuntime => {
    if (!p.onPitch) return p;
    const sIdx = slotByPlayerId.get(p.player.id) ?? p.slotIndex;
    const slot = slots[sIdx] ?? slots[slots.length - 1];
    return {
      ...p,
      slotIndex: sIdx,
      slotLabel: slot.label,
      slotPos: slot.position,
      detailedPos: slot.detailedPosition,
    };
  };

  const updatedClub: Club = {
    ...team.club,
    formation,
    startingIds: [...team.activeIds],
    tactics: { ...tactics, formation },
    ...(slotRoles !== undefined ? { slotRoles: { ...slotRoles } } : {}),
    ...(teamRoles !== undefined ? { teamRoles: { ...teamRoles } } : {}),
  };

  const remappedTeam: LiveTeamRuntime = {
    ...team,
    club: updatedClub,
    starters: team.starters.map(remap),
    bench: team.bench.map(remap),
  };

  const moved = updateTeamCoordinates(
    remappedTeam,
    session.possessionSide === side,
    session.ballPos,
    session.ballCarrierId,
    session.seedState,
    true
  );

  return {
    ...session,
    [side === 'HOME' ? 'home' : 'away']: moved.team,
    seedState: moved.nextSeed,
    lastCommentary: `${team.club.shortName} adjusted setup to ${formation} (${tactics.preset}).`,
  };
}

export function stepLiveMatchMinute(session: LiveMatchSession): {
  next: LiveMatchSession;
  stepAudio: 'goal' | 'card' | 'shot' | 'sub' | 'fulltime' | 'whistle' | null;
  lastEvent?: MatchEvent;
} {
  if (session.finished || session.minute >= 90) {
    return {
      next: { ...session, minute: 90, finished: true },
      stepAudio: null,
    };
  }

  let seed = session.seedState;
  const rand = () => {
    const r = nextSeeded(seed);
    seed = r.nextState;
    return r.value;
  };

  const minute = session.minute + 1;
  let home: LiveTeamRuntime = {
    ...session.home,
    starters: session.home.starters.map((p) => ({ ...p })),
    bench: session.home.bench.map((p) => ({ ...p })),
  };
  let away: LiveTeamRuntime = {
    ...session.away,
    starters: session.away.starters.map((p) => ({ ...p })),
    bench: session.away.bench.map((p) => ({ ...p })),
  };

  let homeGoals = session.homeGoals;
  let awayGoals = session.awayGoals;
  const events = [...session.events];
  let stepAudio: 'goal' | 'card' | 'shot' | 'sub' | 'fulltime' | 'whistle' | null = null;
  let lastEvent: MatchEvent | undefined;
  let lastEventType: MatchEvent['type'] | 'SHOT' | null = null;
  let lastGoalMinute = session.lastGoalMinute;
  let lastCommentary = session.lastCommentary;

  const homeStr = computeLiveTeamStrength(home);
  const awayStr = computeLiveTeamStrength(away);

  // Fatigue tick every minute for active players (scaled by real EA stamina)
  const drainFitness = (team: LiveTeamRuntime) => {
    const intensity =
      team.club.tactics.preset === 'Gegenpress' || team.club.tactics.defensiveApproach === 'High Press'
        ? 0.24
        : team.club.tactics.preset === 'Park the Bus'
        ? 0.14
        : 0.18;
    const applyDrain = (p: LivePlayerRuntime) => {
      if (!p.onPitch || p.redCarded) return p;
      const posFactor = p.slotPos === 'GK' ? 0.2 : p.slotPos === 'MID' ? 1.14 : 1.0;
      const stamina = p.player.attributes.physicalDetails?.stamina ?? p.player.attributes.physical;
      const staminaFactor = Math.max(0.68, Math.min(1.26, 1.32 - stamina / 145));
      const nextFit = Math.max(24, p.liveFitness - intensity * posFactor * staminaFactor);
      return { ...p, liveFitness: nextFit };
    };
    team.starters = team.starters.map(applyDrain);
    team.bench = team.bench.map(applyDrain);
  };
  drainFitness(home);
  drainFitness(away);

  // Determine minute possession side & pass counters
  const midEdge =
    homeStr.midfield -
    awayStr.midfield +
    (home.club.tactics.buildUpStyle === 'Short Passing' ? 2.8 : 0) -
    (away.club.tactics.buildUpStyle === 'Short Passing' ? 2.8 : 0) +
    (homeStr.activeCount - awayStr.activeCount) * 3.5;

  const possBias =
    session.lastEventType === 'GOAL'
      ? 0
      : session.possessionSide === 'HOME'
      ? 0.14
      : -0.14;
  const homePossProb = Math.max(0.28, Math.min(0.72, 0.5 + midEdge * 0.014 + possBias));
  const possessionSide: 'HOME' | 'AWAY' = rand() < homePossProb ? 'HOME' : 'AWAY';

  if (possessionSide === 'HOME') {
    home.possessionTicks += 1;
    const pCount = 4 + Math.floor(rand() * 5) + (home.club.tactics.buildUpStyle === 'Short Passing' ? 2 : 0);
    home.passes += pCount;
    const acc = Math.max(0.72, Math.min(0.94, 0.8 + (homeStr.midfield - 78) * 0.007));
    home.passesCompleted += Math.round(pCount * acc);
    away.passes += 2;
    away.passesCompleted += 1;
  } else {
    away.possessionTicks += 1;
    const pCount = 4 + Math.floor(rand() * 5) + (away.club.tactics.buildUpStyle === 'Short Passing' ? 2 : 0);
    away.passes += pCount;
    const acc = Math.max(0.72, Math.min(0.94, 0.8 + (awayStr.midfield - 78) * 0.007));
    away.passesCompleted += Math.round(pCount * acc);
    home.passes += 2;
    home.passesCompleted += 1;
  }

  const pickWeighted = (
    pool: LivePlayerRuntime[],
    weightFn: (p: LivePlayerRuntime) => number
  ): LivePlayerRuntime => {
    const eligible = pool.filter((p) => p.onPitch && !p.redCarded);
    const list = eligible.length > 0 ? eligible : pool;
    const total = list.reduce((acc, p) => acc + Math.max(0.2, weightFn(p)), 0);
    let r = rand() * total;
    for (const item of list) {
      r -= Math.max(0.2, weightFn(item));
      if (r <= 0) return item;
    }
    return list[0];
  };

  const homeActive = getActivePlayers(home);
  const awayActive = getActivePlayers(away);
  const homeRoles = home.club.teamRoles ?? deriveDefaultTeamRoles(home.club.players);
  const awayRoles = away.club.teamRoles ?? deriveDefaultTeamRoles(away.club.players);
  const homeGk = homeActive.find((p) => p.slotPos === 'GK')?.player;
  const awayGk = awayActive.find((p) => p.slotPos === 'GK')?.player;

  const avgForwardPace = (pool: LivePlayerRuntime[]) => {
    const fwds = pool.filter((p) => p.slotPos === 'FWD');
    if (fwds.length === 0) return 78;
    return fwds.reduce((s, p) => s + p.player.attributes.pace, 0) / fwds.length;
  };

  const homeShift = computeTacticalMatchupShift(
    home.club.tactics,
    away.club.tactics,
    homeStr.fitnessAvg,
    homeGoals - awayGoals,
    minute,
    avgForwardPace(homeActive)
  );
  const awayShift = computeTacticalMatchupShift(
    away.club.tactics,
    home.club.tactics,
    awayStr.fitnessAvg,
    awayGoals - homeGoals,
    minute,
    avgForwardPace(awayActive)
  );

  // Move ball incrementally (reset cleanly to center circle right after a GOAL kick-off)
  const startBallPos = session.lastEventType === 'GOAL' ? { x: 50, y: 50 } : session.ballPos;
  const attackDir = possessionSide === 'HOME' ? 1 : -1;
  const possTactics = possessionSide === 'HOME' ? home.club.tactics : away.club.tactics;
  const buildPaceStep =
    possTactics.buildUpStyle === 'Long Ball' || possTactics.preset === 'Counter-Attack' ? 5.5 : 3;
  const targetCenterPull = ((possessionSide === 'HOME' ? 62 : 38) - startBallPos.x) * 0.16;
  const stepX = attackDir * (buildPaceStep + rand() * 6.5) + targetCenterPull;
  const stepY = (rand() - 0.5) * (possTactics.preset === 'Wing Play' ? 24 : 16);
  let ballPos: PitchCoordinate = {
    x: Math.max(20, Math.min(80, startBallPos.x + stepX)),
    y: Math.max(14, Math.min(86, startBallPos.y + stepY)),
  };

  const carrierTeamPool = possessionSide === 'HOME' ? homeActive : awayActive;
  const carrier = pickWeighted(carrierTeamPool, (p) => {
    const roleW = p.slotPos === 'MID' ? 10 : p.slotPos === 'FWD' ? 7 : p.slotPos === 'DEF' ? 5 : 1;
    const dist = Math.hypot(p.x - ballPos.x, p.y - ballPos.y);
    const proxW = Math.max(1, 35 - dist * 0.45);
    return roleW * proxW;
  });
  let ballCarrierId: string | null = carrier?.player.id ?? null;

  // Evaluate key minute action using tactical matchup + strength differential + game state
  const homeEdge =
    (homeStr.attack +
      homeStr.midfield * 0.6 +
      homeStr.tacticalBonus +
      2.1 -
      (awayStr.defense * 0.8 + awayStr.gk * 0.2)) /
      18 +
    homeShift.edgeDelta +
    (homeStr.activeCount - awayStr.activeCount) * 0.35;
  const awayEdge =
    (awayStr.attack +
      awayStr.midfield * 0.6 +
      awayStr.tacticalBonus -
      (homeStr.defense * 0.8 + homeStr.gk * 0.2)) /
      18 +
    awayShift.edgeDelta +
    (awayStr.activeCount - homeStr.activeCount) * 0.35;

  const actionRoll = rand();
  const homeShotThreshold = 0.088 + Math.max(-0.025, Math.min(0.045, homeEdge * 0.017));
  const awayShotThreshold =
    homeShotThreshold + 0.082 + Math.max(-0.025, Math.min(0.045, awayEdge * 0.017));
  const foulThreshold =
    awayShotThreshold + 0.068 + (homeShift.foulBoost + awayShift.foulBoost) * 0.5;

  if (actionRoll < homeShotThreshold) {
    // Home attacking shot (with rare penalty decision inside box)
    const isPenalty = rand() < 0.055;
    home.shots += 1;
    if (!isPenalty && rand() < 0.32 + homeShift.cornerBoost) home.corners += 1;
    if (!isPenalty && rand() < 0.11 + awayShift.offsideBoost) home.offsides += 1;

    const penTaker =
      isPenalty && homeRoles.penaltyId
        ? homeActive.find((p) => p.player.id === homeRoles.penaltyId)
        : undefined;
    const shooter =
      penTaker ??
      pickWeighted(homeActive, (p) =>
        computePlayerScoreWeight(p.player, p.detailedPos, homeRoles, home.club.tactics, p.liveFitness, !p.isStarter)
      );
    ballCarrierId = shooter.player.id;
    ballPos = isPenalty ? { x: 89, y: 50 } : { x: 86 + rand() * 8, y: 34 + rand() * 32 };

    const duel = resolveShotAndGoalDuel(shooter.player, awayGk, homeEdge, isPenalty, rand);
    home.xg = Math.round((home.xg + duel.shotXg) * 100) / 100;

    if (duel.onTarget) {
      home.shotsOnTarget += 1;
      if (duel.goal) {
        homeGoals += 1;
        shooter.goals += 1;
        shooter.liveRating = Math.min(10, (shooter.liveRating ?? 6.4) + 1.15);
        const assister = isPenalty
          ? undefined
          : pickWeighted(
              homeActive.filter((p) => p.player.id !== shooter.player.id),
              (p) => computePlayerAssistWeight(p.player, p.detailedPos, homeRoles, home.club.tactics)
            );
        if (assister) {
          assister.assists += 1;
          assister.liveRating = Math.min(10, (assister.liveRating ?? 6.4) + 0.65);
        }
        ballPos = { x: 96.5, y: 48 + rand() * 4 };
        lastGoalMinute = minute;
        lastEventType = 'GOAL';
        stepAudio = 'goal';
        const ev: MatchEvent = {
          id: `ev_${session.fixture.id}_${minute}_hg_${homeGoals}`,
          minute,
          type: 'GOAL',
          teamSide: 'HOME',
          playerId: shooter.player.id,
          playerName: shooter.player.name,
          assistPlayerId: assister?.player.id,
          assistPlayerName: assister?.player.name,
          description: isPenalty
            ? `PENALTY! ${shooter.player.name} converts from the spot for ${home.club.shortName}!`
            : `${shooter.player.name} scores for ${home.club.shortName}${assister ? ` (assist: ${assister.player.name})` : ''}.`,
        };
        events.push(ev);
        lastEvent = ev;
        lastCommentary = `${minute}' GOAL! ${ev.description}`;
      } else {
        lastEventType = 'SHOT';
        stepAudio = 'shot';
        lastCommentary = isPenalty
          ? `${minute}' SAVED PENALTY! ${awayGk?.name ?? 'Keeper'} denies ${shooter.player.name}!`
          : `${minute}' Close! ${shooter.player.name} forces a sharp save from ${awayGk?.name ?? 'the keeper'}.`;
      }
    } else {
      lastEventType = 'SHOT';
      stepAudio = 'shot';
      lastCommentary = `${minute}' ${shooter.player.name} fires just wide for ${home.club.shortName}.`;
    }
  } else if (actionRoll < awayShotThreshold) {
    // Away attacking shot
    const isPenalty = rand() < 0.05;
    away.shots += 1;
    if (!isPenalty && rand() < 0.32 + awayShift.cornerBoost) away.corners += 1;
    if (!isPenalty && rand() < 0.11 + homeShift.offsideBoost) away.offsides += 1;

    const penTaker =
      isPenalty && awayRoles.penaltyId
        ? awayActive.find((p) => p.player.id === awayRoles.penaltyId)
        : undefined;
    const shooter =
      penTaker ??
      pickWeighted(awayActive, (p) =>
        computePlayerScoreWeight(p.player, p.detailedPos, awayRoles, away.club.tactics, p.liveFitness, !p.isStarter)
      );
    ballCarrierId = shooter.player.id;
    ballPos = isPenalty ? { x: 11, y: 50 } : { x: 6 + rand() * 8, y: 34 + rand() * 32 };

    const duel = resolveShotAndGoalDuel(shooter.player, homeGk, awayEdge, isPenalty, rand);
    away.xg = Math.round((away.xg + duel.shotXg) * 100) / 100;

    if (duel.onTarget) {
      away.shotsOnTarget += 1;
      if (duel.goal) {
        awayGoals += 1;
        shooter.goals += 1;
        shooter.liveRating = Math.min(10, (shooter.liveRating ?? 6.4) + 1.15);
        const assister = isPenalty
          ? undefined
          : pickWeighted(
              awayActive.filter((p) => p.player.id !== shooter.player.id),
              (p) => computePlayerAssistWeight(p.player, p.detailedPos, awayRoles, away.club.tactics)
            );
        if (assister) {
          assister.assists += 1;
          assister.liveRating = Math.min(10, (assister.liveRating ?? 6.4) + 0.65);
        }
        ballPos = { x: 3.5, y: 48 + rand() * 4 };
        lastGoalMinute = minute;
        lastEventType = 'GOAL';
        stepAudio = 'goal';
        const ev: MatchEvent = {
          id: `ev_${session.fixture.id}_${minute}_ag_${awayGoals}`,
          minute,
          type: 'GOAL',
          teamSide: 'AWAY',
          playerId: shooter.player.id,
          playerName: shooter.player.name,
          assistPlayerId: assister?.player.id,
          assistPlayerName: assister?.player.name,
          description: isPenalty
            ? `PENALTY! ${shooter.player.name} converts from the spot for ${away.club.shortName}!`
            : `${shooter.player.name} scores for ${away.club.shortName}${assister ? ` (assist: ${assister.player.name})` : ''}.`,
        };
        events.push(ev);
        lastEvent = ev;
        lastCommentary = `${minute}' GOAL! ${ev.description}`;
      } else {
        lastEventType = 'SHOT';
        stepAudio = 'shot';
        lastCommentary = isPenalty
          ? `${minute}' SAVED PENALTY! ${homeGk?.name ?? 'Keeper'} denies ${shooter.player.name}!`
          : `${minute}' Saved! ${shooter.player.name} tests ${homeGk?.name ?? 'the keeper'} for ${away.club.shortName}.`;
      }
    } else {
      lastEventType = 'SHOT';
      stepAudio = 'shot';
      lastCommentary = `${minute}' ${shooter.player.name} shoots off target for ${away.club.shortName}.`;
    }
  } else if (actionRoll < foulThreshold) {
    // Tactical foul / card weighted by player aggression & tackles
    const isHomeFoul = rand() < 0.49;
    const foulingTeam = isHomeFoul ? home : away;
    const pool = isHomeFoul ? homeActive : awayActive;
    foulingTeam.fouls += 1;

    if (rand() < 0.23) {
      const offender = pickWeighted(pool, (p) =>
        computeFoulOffenderWeight(p.player, p.yellowCards)
      );
      const isDirectRed = offender.yellowCards === 0 && rand() < 0.015;
      if (isDirectRed || (offender.yellowCards >= 1 && rand() < 0.28)) {
        offender.redCarded = true;
        offender.onPitch = false;
        foulingTeam.redCards += 1;
        offender.liveRating = Math.max(4.5, (offender.liveRating ?? 6.2) - 1.5);
        lastEventType = 'RED';
        stepAudio = 'card';
        const ev: MatchEvent = {
          id: `ev_${session.fixture.id}_${minute}_${isHomeFoul ? 'hr' : 'ar'}_${offender.player.id}`,
          minute,
          type: 'RED',
          teamSide: isHomeFoul ? 'HOME' : 'AWAY',
          playerId: offender.player.id,
          playerName: offender.player.name,
          description: isDirectRed
            ? `${offender.player.name} is shown a straight red card for a reckless challenge!`
            : `${offender.player.name} receives a second yellow and is sent off.`,
        };
        events.push(ev);
        lastEvent = ev;
        lastCommentary = `${minute}' RED CARD! ${ev.description}`;
      } else {
        offender.yellowCards += 1;
        foulingTeam.yellowCards += 1;
        offender.liveRating = Math.max(4.8, (offender.liveRating ?? 6.3) - 0.25);
        lastEventType = 'YELLOW';
        stepAudio = 'card';
        const ev: MatchEvent = {
          id: `ev_${session.fixture.id}_${minute}_${isHomeFoul ? 'hy' : 'ay'}_${offender.player.id}`,
          minute,
          type: 'YELLOW',
          teamSide: isHomeFoul ? 'HOME' : 'AWAY',
          playerId: offender.player.id,
          playerName: offender.player.name,
          description: `${offender.player.name} booked for a tactical foul.`,
        };
        events.push(ev);
        lastEvent = ev;
        lastCommentary = `${minute}' Yellow Card: ${ev.description}`;
      }
    }
  } else if (minute === 45) {
    lastCommentary = `45' Half-time whistle approaching — ${home.club.shortName} ${homeGoals}-${awayGoals} ${away.club.shortName}.`;
  } else if (minute % 5 === 0) {
    lastCommentary = `${minute}' ${
      possessionSide === 'HOME' ? home.club.shortName : away.club.shortName
    } probing in midfield (${carrier?.player.name ?? 'Midfield'} on the ball).`;
  }

  let updatedSession: LiveMatchSession = {
    ...session,
    minute,
    finished: minute >= 90,
    homeGoals,
    awayGoals,
    possessionSide,
    ballPos,
    ballCarrierId,
    lastEventType,
    lastGoalMinute,
    lastCommentary,
    home,
    away,
    events,
    seedState: seed,
  };

  // Smart AI auto-substitutions: protect yellow-carded / exhausted starters & chase when trailing
  const tryAiSub = (side: 'HOME' | 'AWAY') => {
    const team = side === 'HOME' ? updatedSession.home : updatedSession.away;
    const isTrailing = side === 'HOME' ? homeGoals < awayGoals : awayGoals < homeGoals;
    const availBench = team.bench.filter(
      (b) => !b.onPitch && !b.subbedOff && b.slotPos !== 'GK' && isPlayerAvailableForMatchday(b.player)
    );
    if (availBench.length === 0) return;

    const candidatesOff = getActivePlayers(team).filter((p) => p.slotPos !== 'GK');
    if (candidatesOff.length === 0) return;

    // Pick player most in need of coming off (yellow-carded or lowest fitness)
    const offTarget = [...candidatesOff].sort((a, b) => {
      const aRisk = (a.yellowCards > 0 && minute >= 58 ? 22 : 0) + (100 - a.liveFitness);
      const bRisk = (b.yellowCards > 0 && minute >= 58 ? 22 : 0) + (100 - b.liveFitness);
      return bRisk - aRisk;
    })[0];
    if (!offTarget) return;

    // Pick best fitting bench impact (if trailing late, prioritize FWD/MID)
    const samePos = availBench.filter((b) => b.slotPos === offTarget.slotPos);
    const attackPool = isTrailing && minute >= 65
      ? availBench.filter((b) => b.slotPos === 'FWD' || b.slotPos === 'MID')
      : [];
    const benchPool = attackPool.length > 0 ? attackPool : samePos.length > 0 ? samePos : availBench;
    const subOn = [...benchPool].sort((a, b) => b.player.ovr - a.player.ovr)[0];
    if (!subOn) return;

    const res = applyLiveSubstitution(updatedSession, side, offTarget.player.id, subOn.player.id);
    if (res.ok) {
      updatedSession = res.next;
      if (!stepAudio) stepAudio = 'sub';
    }
  };

  if (updatedSession.aiHomeSubTicks.includes(minute)) {
    tryAiSub('HOME');
  }
  if (updatedSession.aiAwaySubTicks.includes(minute)) {
    tryAiSub('AWAY');
  }

  // Smoothly update live ratings & 2D pitch coordinates every tick
  const refreshRatingsAndCoords = (
    team: LiveTeamRuntime,
    isHome: boolean,
    goalsFor: number,
    goalsAgainst: number
  ): LiveTeamRuntime => {
    const nudge = (p: LivePlayerRuntime): LivePlayerRuntime => {
      if (!p.onPitch || p.redCarded) return p;
      const effOvr = getPlayerSlotEvaluation(p.player, p.slotLabel).effectiveOvr;
      let target = 6.3 + (effOvr - 78) * 0.045;
      target += p.goals * 1.15 + p.assists * 0.65 - p.yellowCards * 0.25;
      if ((p.slotPos === 'GK' || p.slotPos === 'DEF') && goalsAgainst === 0) target += 0.45;
      if (goalsFor > goalsAgainst) target += 0.3;
      const blended = (p.liveRating ?? 6.4) * 0.85 + target * 0.15;
      return {
        ...p,
        liveRating: Math.max(4.5, Math.min(10, Math.round(blended * 10) / 10)),
      };
    };

    const ratedTeam: LiveTeamRuntime = {
      ...team,
      starters: team.starters.map(nudge),
      bench: team.bench.map(nudge),
    };

    const moved = updateTeamCoordinates(
      ratedTeam,
      updatedSession.possessionSide === (isHome ? 'HOME' : 'AWAY'),
      updatedSession.ballPos,
      updatedSession.ballCarrierId,
      updatedSession.seedState
    );
    updatedSession.seedState = moved.nextSeed;
    return moved.team;
  };

  updatedSession.home = refreshRatingsAndCoords(updatedSession.home, true, homeGoals, awayGoals);
  updatedSession.away = refreshRatingsAndCoords(updatedSession.away, false, awayGoals, homeGoals);

  if (lastEventType !== 'GOAL' && lastEventType !== 'SHOT' && updatedSession.ballCarrierId) {
    const activeTeam =
      updatedSession.possessionSide === 'HOME' ? updatedSession.home : updatedSession.away;
    const carrierNow = findRuntime(activeTeam, updatedSession.ballCarrierId);
    if (carrierNow && carrierNow.onPitch && !carrierNow.redCarded) {
      const ballOffset = updatedSession.possessionSide === 'HOME' ? 1.4 : -1.4;
      updatedSession.ballPos = {
        x: Math.max(4, Math.min(96, carrierNow.x + ballOffset)),
        y: Math.max(6, Math.min(94, carrierNow.y)),
      };
    }
  }

  if (minute === 45) {
    if (!stepAudio) stepAudio = 'whistle';
    if (lastEventType !== 'GOAL' && lastEventType !== 'RED' && lastEventType !== 'YELLOW') {
      updatedSession.lastCommentary = `45' HALF-TIME: ${updatedSession.home.club.shortName} ${homeGoals}-${awayGoals} ${updatedSession.away.club.shortName}.`;
    }
  }

  if (minute >= 90) {
    updatedSession.finished = true;
    stepAudio = 'fulltime';
    updatedSession.lastCommentary = `Full Time: ${updatedSession.home.club.name} ${homeGoals}-${awayGoals} ${updatedSession.away.club.name}.`;
  }

  return { next: updatedSession, stepAudio, lastEvent };
}

export function finishLiveMatchToEnd(session: LiveMatchSession): LiveMatchSession {
  let current = session;
  while (!current.finished && current.minute < 90) {
    current = stepLiveMatchMinute(current).next;
  }
  return { ...current, minute: 90, finished: true };
}

export function finalizeLiveMatchReport(session: LiveMatchSession): MatchReport {
  const finalSession = session.finished ? session : finishLiveMatchToEnd(session);
  const totalPoss = Math.max(
    1,
    finalSession.home.possessionTicks + finalSession.away.possessionTicks
  );
  const homePoss = Math.max(
    30,
    Math.min(70, Math.round((finalSession.home.possessionTicks / totalPoss) * 100))
  );
  const awayPoss = 100 - homePoss;

  const homeShotsOnTarget = Math.max(finalSession.home.shotsOnTarget, finalSession.homeGoals);
  const awayShotsOnTarget = Math.max(finalSession.away.shotsOnTarget, finalSession.awayGoals);
  const homeShots = Math.max(finalSession.home.shots, homeShotsOnTarget);
  const awayShots = Math.max(finalSession.away.shots, awayShotsOnTarget);

  const homeAcc =
    finalSession.home.passes > 0
      ? Math.round((finalSession.home.passesCompleted / finalSession.home.passes) * 100)
      : 82;
  const awayAcc =
    finalSession.away.passes > 0
      ? Math.round((finalSession.away.passesCompleted / finalSession.away.passes) * 100)
      : 82;

  const stats: MatchStats = {
    homeShots,
    awayShots,
    homeShotsOnTarget,
    awayShotsOnTarget,
    homePossession: homePoss,
    awayPossession: awayPoss,
    homePasses: Math.max(120, finalSession.home.passes),
    awayPasses: Math.max(120, finalSession.away.passes),
    homePassAccuracy: Math.max(68, Math.min(95, homeAcc)),
    awayPassAccuracy: Math.max(68, Math.min(95, awayAcc)),
    homeFouls: finalSession.home.fouls,
    awayFouls: finalSession.away.fouls,
    homeYellowCards: finalSession.home.yellowCards,
    awayYellowCards: finalSession.away.yellowCards,
    homeRedCards: finalSession.home.redCards,
    awayRedCards: finalSession.away.redCards,
    homeOffsides: finalSession.home.offsides,
    awayOffsides: finalSession.away.offsides,
    homeCorners: finalSession.home.corners,
    awayCorners: finalSession.away.corners,
  };

  const buildSideRatings = (
    team: LiveTeamRuntime,
    side: 'HOME' | 'AWAY',
    goalsFor: number,
    goalsAgainst: number
  ): PlayerMatchRating[] => {
    const starterRatings: PlayerMatchRating[] = team.starters.map((p, idx) => {
      const minutesPlayed = p.redCarded
        ? Math.max(15, 65)
        : p.subOutMinute !== undefined
        ? Math.max(1, p.subOutMinute)
        : 90;
      const baseRating = p.liveRating ?? 6.4;
      const cleanSheetBump =
        (p.slotPos === 'GK' || p.slotPos === 'DEF') && goalsAgainst === 0 && minutesPlayed >= 45
          ? 0.25
          : 0;
      const winBump = goalsFor > goalsAgainst ? 0.15 : 0;
      const rating = Math.max(
        4.5,
        Math.min(10.0, Math.round((baseRating + cleanSheetBump + winBump) * 10) / 10)
      );
      return {
        playerId: p.player.id,
        playerName: p.player.name,
        position: p.player.position,
        detailedPosition: p.player.detailedPosition ?? p.detailedPos,
        slotIndex: p.slotIndex >= 0 ? p.slotIndex : idx,
        teamSide: side,
        rating,
        goals: p.goals,
        assists: p.assists,
        minutesPlayed,
        isMvp: false,
        isSub: false,
        didNotPlay: false,
      };
    });

    const benchRatings: PlayerMatchRating[] = team.bench.map((p, idx) => {
      const played = p.subInMinute !== undefined;
      if (!played) {
        return {
          playerId: p.player.id,
          playerName: p.player.name,
          position: p.player.position,
          detailedPosition: p.player.detailedPosition,
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
      const minutesPlayed = Math.max(2, 90 - (p.subInMinute ?? 85));
      const rating = Math.max(4.5, Math.min(10.0, Math.round((p.liveRating ?? 6.4) * 10) / 10));
      return {
        playerId: p.player.id,
        playerName: p.player.name,
        position: p.player.position,
        detailedPosition: p.player.detailedPosition ?? p.detailedPos,
        slotIndex: 11 + idx,
        teamSide: side,
        rating,
        goals: p.goals,
        assists: p.assists,
        minutesPlayed,
        isMvp: false,
        isSub: true,
        subMinute: p.subInMinute,
        didNotPlay: false,
      };
    });

    return [...starterRatings, ...benchRatings];
  };

  const ratings = [
    ...buildSideRatings(
      finalSession.home,
      'HOME',
      finalSession.homeGoals,
      finalSession.awayGoals
    ),
    ...buildSideRatings(
      finalSession.away,
      'AWAY',
      finalSession.awayGoals,
      finalSession.homeGoals
    ),
  ];

  let mvpIdx = -1;
  for (let i = 0; i < ratings.length; i++) {
    const r = ratings[i].rating;
    if (r === null) continue;
    if (mvpIdx === -1 || r > (ratings[mvpIdx].rating ?? -1)) {
      mvpIdx = i;
    }
  }
  if (mvpIdx >= 0 && ratings[mvpIdx]) {
    ratings[mvpIdx] = { ...ratings[mvpIdx], isMvp: true };
  }

  return {
    fixtureId: finalSession.fixture.id,
    competitionId: finalSession.fixture.competitionId,
    round: finalSession.fixture.round,
    homeClubId: finalSession.home.club.id,
    awayClubId: finalSession.away.club.id,
    homeGoals: finalSession.homeGoals,
    awayGoals: finalSession.awayGoals,
    events: [...finalSession.events].sort((a, b) => a.minute - b.minute),
    stats,
    ratings: ratings.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1)),
  };
}

export function getTeamActivePitchList(team: LiveTeamRuntime): LivePlayerRuntime[] {
  return team.activeIds
    .map((id) => findRuntime(team, id))
    .filter((p): p is LivePlayerRuntime => Boolean(p));
}

export function getTeamBenchDisplayList(team: LiveTeamRuntime): LivePlayerRuntime[] {
  return getAllPlayers(team).filter((p) => !team.activeIds.includes(p.player.id));
}
