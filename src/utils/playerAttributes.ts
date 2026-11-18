import { EA_COMPACT_ATTRS } from '../data/eaStats27';
import {
  DefendingDetails,
  DetailedPosition,
  DribblingDetails,
  GoalkeeperDetails,
  PaceDetails,
  PassingDetails,
  PhysicalDetails,
  Player,
  PlayerAttributes,
  PlayerRole,
  Position,
  PositionRoleGroup,
  RoleMasteryLevel,
  ShootingDetails,
  WorkRateLevel,
} from '../types/game';

export type CompletePlayerAttributes = Required<PlayerAttributes>;

export const POSITION_ROLE_MAP: Record<PositionRoleGroup, PlayerRole[]> = {
  GK: ['Goalkeeper', 'Sweeper Keeper', 'Ball-Playing Keeper'],
  CB: ['Defender', 'Stopper', 'Ball-Playing Defender', 'Wide Back'],
  FB: ['Fullback', 'Falseback', 'Wingback', 'Attacking Wingback', 'Inverted Wingback'],
  CDM: ['Holding', 'Centre-Half', 'Deep-Lying Playmaker', 'Wide Half', 'Box Crasher'],
  CM_CAM: ['Box-to-Box', 'Playmaker', 'Half-Winger', 'Classic 10', 'Shadow Striker'],
  WINGER: ['Winger', 'Wide Midfielder', 'Wide Playmaker', 'Inside Forward'],
  ST: ['Advanced Forward', 'Poacher', 'False 9', 'Target Forward'],
};

export const DETAILED_TO_COARSE_POS: Record<DetailedPosition, Position> = {
  GK: 'GK',
  CB: 'DEF',
  LB: 'DEF',
  RB: 'DEF',
  CDM: 'MID',
  CM: 'MID',
  CAM: 'MID',
  LW: 'FWD',
  RW: 'FWD',
  ST: 'FWD',
};

export function slotLabelToDetailedPosition(
  label: string,
  fallbackCoarse?: Position
): DetailedPosition {
  const up = label.toUpperCase().trim();
  if (up === 'GK') return 'GK';
  if (up === 'CB' || up === 'LCB' || up === 'RCB' || up === 'CCB') return 'CB';
  if (up === 'LB' || up === 'LWB') return 'LB';
  if (up === 'RB' || up === 'RWB') return 'RB';
  if (up === 'CDM' || up === 'LDM' || up === 'RDM') return 'CDM';
  if (up === 'CM' || up === 'LCM' || up === 'RCM') return 'CM';
  if (up === 'CAM' || up === 'LAM' || up === 'RAM') return 'CAM';
  if (up === 'LW' || up === 'LM') return 'LW';
  if (up === 'RW' || up === 'RM') return 'RW';
  if (up === 'ST' || up === 'LST' || up === 'RST') return 'ST';

  if (fallbackCoarse === 'GK') return 'GK';
  if (fallbackCoarse === 'DEF') return 'CB';
  if (fallbackCoarse === 'MID') return 'CM';
  return 'ST';
}

export function detailedPositionToRoleGroup(pos: DetailedPosition): PositionRoleGroup {
  if (pos === 'GK') return 'GK';
  if (pos === 'CB') return 'CB';
  if (pos === 'LB' || pos === 'RB') return 'FB';
  if (pos === 'CDM') return 'CDM';
  if (pos === 'CM' || pos === 'CAM') return 'CM_CAM';
  if (pos === 'LW' || pos === 'RW') return 'WINGER';
  return 'ST';
}

export function getAllowedRolesForSlot(slotLabelOrPos: string, fallbackCoarse?: Position): PlayerRole[] {
  const dp = slotLabelToDetailedPosition(slotLabelOrPos, fallbackCoarse);
  return POSITION_ROLE_MAP[detailedPositionToRoleGroup(dp)];
}

export function migrateLegacyRole(role: string | undefined, detailedPos: DetailedPosition): PlayerRole {
  const allowed = getAllowedRolesForSlot(detailedPos);
  if (role && (allowed as string[]).includes(role)) {
    return role as PlayerRole;
  }
  const legacyMap: Record<string, PlayerRole> = {
    'Shot Stopper': 'Goalkeeper',
    'Sweeper Keeper': 'Sweeper Keeper',
    'Ball-Playing CB': detailedPos === 'CB' ? 'Ball-Playing Defender' : allowed[0],
    Stopper: detailedPos === 'CB' ? 'Stopper' : allowed[0],
    'Attacking Fullback':
      detailedPos === 'LB' || detailedPos === 'RB' ? 'Attacking Wingback' : allowed[0],
    'Inverted Fullback':
      detailedPos === 'LB' || detailedPos === 'RB' ? 'Inverted Wingback' : allowed[0],
    'Deep-Lying Playmaker':
      detailedPos === 'CDM' ? 'Deep-Lying Playmaker' : detailedPos === 'CM' ? 'Playmaker' : allowed[0],
    'Box-to-Box': detailedPos === 'CM' || detailedPos === 'CAM' ? 'Box-to-Box' : allowed[0],
    Mezzala: detailedPos === 'CM' || detailedPos === 'CAM' ? 'Half-Winger' : allowed[0],
    'Attacking Midfielder':
      detailedPos === 'CM' || detailedPos === 'CAM' ? 'Classic 10' : allowed[0],
    'Inside Forward':
      detailedPos === 'LW' || detailedPos === 'RW' ? 'Inside Forward' : allowed[0],
    Winger: detailedPos === 'LW' || detailedPos === 'RW' ? 'Winger' : allowed[0],
    'Target Forward': detailedPos === 'ST' ? 'Target Forward' : allowed[0],
    Poacher: detailedPos === 'ST' ? 'Poacher' : allowed[0],
    'Complete Forward': detailedPos === 'ST' ? 'Advanced Forward' : allowed[0],
  };

  if (role && legacyMap[role] && (allowed as string[]).includes(legacyMap[role])) {
    return legacyMap[role];
  }
  return allowed[0];
}

export function inferDetailedPositionFromLegacy(player: Pick<Player, 'id' | 'position' | 'role'>): DetailedPosition {
  const roleStr = String(player.role ?? '');
  if (player.position === 'GK') return 'GK';
  let seed = 0;
  for (let i = 0; i < player.id.length; i++) {
    seed = (seed * 31 + player.id.charCodeAt(i)) % 9973;
  }
  if (player.position === 'DEF') {
    if (roleStr.includes('Fullback') || roleStr.includes('Wingback') || roleStr.includes('Falseback')) {
      return seed % 2 === 0 ? 'LB' : 'RB';
    }
    return 'CB';
  }
  if (player.position === 'MID') {
    if (roleStr === 'Holding' || roleStr === 'Centre-Half' || roleStr === 'Deep-Lying Playmaker' || roleStr === 'Wide Half' || roleStr === 'Box Crasher') {
      return 'CDM';
    }
    if (roleStr === 'Attacking Midfielder' || roleStr === 'Classic 10' || roleStr === 'Shadow Striker') {
      return 'CAM';
    }
    if (roleStr === 'Winger' || roleStr === 'Inside Forward' || roleStr === 'Wide Playmaker' || roleStr === 'Wide Midfielder') {
      return seed % 2 === 0 ? 'LW' : 'RW';
    }
    return 'CM';
  }
  // FWD
  if (roleStr === 'Inside Forward' || roleStr === 'Winger' || roleStr === 'Wide Playmaker' || roleStr === 'Wide Midfielder') {
    return seed % 2 === 0 ? 'LW' : 'RW';
  }
  return 'ST';
}

export function deriveDefaultSecondaryPositions(
  primary: DetailedPosition,
  seed: number
): DetailedPosition[] {
  switch (primary) {
    case 'GK':
      return [];
    case 'CB':
      return seed % 3 === 0 ? ['CDM'] : seed % 3 === 1 ? [seed % 2 === 0 ? 'LB' : 'RB'] : [];
    case 'LB':
      return seed % 2 === 0 ? ['RB', 'LW'] : ['CB'];
    case 'RB':
      return seed % 2 === 0 ? ['LB', 'RW'] : ['CB'];
    case 'CDM':
      return seed % 2 === 0 ? ['CM', 'CB'] : ['CM'];
    case 'CM':
      return seed % 2 === 0 ? ['CDM', 'CAM'] : ['CAM'];
    case 'CAM':
      return seed % 2 === 0 ? ['CM', 'LW'] : ['CM', 'RW'];
    case 'LW':
      return seed % 2 === 0 ? ['RW', 'CAM'] : ['RW', 'ST'];
    case 'RW':
      return seed % 2 === 0 ? ['LW', 'CAM'] : ['LW', 'ST'];
    case 'ST':
      return seed % 2 === 0 ? ['LW', 'RW'] : ['CAM'];
  }
}

export function deriveDefaultRoleMastery(
  primaryPos: DetailedPosition,
  preferredRole: PlayerRole,
  ovr: number,
  seed: number
): Partial<Record<PlayerRole, RoleMasteryLevel>> {
  const allowed = getAllowedRolesForSlot(primaryPos);
  const mastery: Partial<Record<PlayerRole, RoleMasteryLevel>> = {};
  mastery[preferredRole] = ovr >= 81 || seed % 2 === 0 ? 'Role++' : 'Role+';
  const altRole = allowed.find((r) => r !== preferredRole);
  if (altRole) {
    mastery[altRole] = 'Role+';
  }
  return mastery;
}

export function getPlayerRoleMastery(player: Player, role: PlayerRole): RoleMasteryLevel {
  if (player.roleMastery && player.roleMastery[role]) {
    return player.roleMastery[role]!;
  }
  return player.role === role ? 'Role+' : 'Base';
}

export function getRoleMasteryBadgeClasses(mastery: RoleMasteryLevel): {
  text: string;
  badge: string;
  shortLabel: string;
} {
  if (mastery === 'Role++') {
    return {
      text: 'text-[#00FF85]',
      badge: 'border-[#00FF85]/55 bg-[#00FF85]/14 text-[#00FF85]',
      shortLabel: '++',
    };
  }
  if (mastery === 'Role+') {
    return {
      text: 'text-amber-300',
      badge: 'border-amber-400/55 bg-amber-500/14 text-amber-300',
      shortLabel: '+',
    };
  }
  return {
    text: 'text-slate-300',
    badge: 'border-white/20 bg-white/8 text-slate-300',
    shortLabel: 'Base',
  };
}

export interface PlayerRoleGroupSection {
  group: PositionRoleGroup;
  label: string;
  isNaturalOrSecondary: boolean;
  roles: { role: PlayerRole; mastery: RoleMasteryLevel; isPreferred: boolean }[];
}

const ROLE_GROUP_LABELS: Record<PositionRoleGroup, string> = {
  GK: 'GK',
  CB: 'CB',
  FB: 'LB / RB',
  CDM: 'CDM',
  CM_CAM: 'CM / CAM',
  WINGER: 'LW / RW',
  ST: 'ST',
};

export function getPlayerRoleFamiliarityMatrix(player: Player): PlayerRoleGroupSection[] {
  const naturalPos = player.detailedPosition ?? inferDetailedPositionFromLegacy(player);
  const naturalGroup = detailedPositionToRoleGroup(naturalPos);
  const secondaryGroups = new Set(
    (player.secondaryPositions ?? []).map((dp) => detailedPositionToRoleGroup(dp))
  );

  const orderedGroups: PositionRoleGroup[] =
    player.position === 'GK'
      ? ['GK']
      : (['CB', 'FB', 'CDM', 'CM_CAM', 'WINGER', 'ST'] as PositionRoleGroup[]).sort((a, b) => {
          const score = (g: PositionRoleGroup) =>
            g === naturalGroup ? 0 : secondaryGroups.has(g) ? 1 : 2;
          return score(a) - score(b);
        });

  return orderedGroups.map((group) => {
    const roles = POSITION_ROLE_MAP[group].map((role) => ({
      role,
      mastery: getPlayerRoleMastery(player, role),
      isPreferred: player.role === role,
    }));
    return {
      group,
      label: ROLE_GROUP_LABELS[group],
      isNaturalOrSecondary:
        group === naturalGroup ||
        secondaryGroups.has(group) ||
        roles.some((r) => r.mastery !== 'Base'),
      roles,
    };
  });
}

export function isPlayerAvailableForMatchday(player: Player): boolean {
  return player.loanInfo?.direction !== 'OUT';
}

function getPositionalWeightScore(pos: DetailedPosition, attrs: PlayerAttributes): number {
  const pac = attrs.pace;
  const sho = attrs.finishing;
  const pas = attrs.passing;
  const dri = attrs.dribbling;
  const def = attrs.defending;
  const phy = attrs.physical;
  const gk = attrs.goalkeeper;

  switch (pos) {
    case 'GK':
      return gk * 0.86 + phy * 0.08 + pas * 0.06;
    case 'CB':
      return def * 0.45 + phy * 0.25 + pas * 0.14 + pac * 0.12 + dri * 0.04;
    case 'LB':
    case 'RB':
      return pac * 0.26 + def * 0.28 + pas * 0.2 + dri * 0.14 + phy * 0.12;
    case 'CDM':
      return def * 0.3 + pas * 0.26 + phy * 0.2 + dri * 0.14 + pac * 0.1;
    case 'CM':
      return pas * 0.3 + dri * 0.24 + def * 0.16 + phy * 0.14 + sho * 0.08 + pac * 0.08;
    case 'CAM':
      return dri * 0.29 + pas * 0.29 + sho * 0.2 + pac * 0.14 + phy * 0.08;
    case 'LW':
    case 'RW':
      return pac * 0.28 + dri * 0.28 + sho * 0.2 + pas * 0.18 + phy * 0.06;
    case 'ST':
      return sho * 0.37 + pac * 0.22 + dri * 0.2 + phy * 0.13 + pas * 0.08;
  }
}

const ADJACENT_GROUPS: Record<DetailedPosition, DetailedPosition[]> = {
  GK: [],
  CB: ['CDM', 'LB', 'RB'],
  LB: ['RB', 'CB', 'LW', 'CDM'],
  RB: ['LB', 'CB', 'RW', 'CDM'],
  CDM: ['CM', 'CB', 'LB', 'RB'],
  CM: ['CDM', 'CAM', 'LW', 'RW'],
  CAM: ['CM', 'LW', 'RW', 'ST'],
  LW: ['RW', 'CAM', 'ST', 'LB'],
  RW: ['LW', 'CAM', 'ST', 'RB'],
  ST: ['LW', 'RW', 'CAM'],
};

export interface SlotEvaluation {
  targetPos: DetailedPosition;
  effectiveOvr: number;
  delta: number;
  fitLevel: 'Natural' | 'Secondary' | 'Partial' | 'OutOfPosition';
}

export function getPlayerSlotEvaluation(
  player: Player,
  slotLabelOrPos: string
): SlotEvaluation {
  const targetPos = slotLabelToDetailedPosition(slotLabelOrPos, player.position);
  const naturalPos = player.detailedPosition ?? inferDetailedPositionFromLegacy(player);
  const secondaries = player.secondaryPositions ?? [];

  if (targetPos === naturalPos) {
    return {
      targetPos,
      effectiveOvr: player.ovr,
      delta: 0,
      fitLevel: 'Natural',
    };
  }

  if (secondaries.includes(targetPos)) {
    return {
      targetPos,
      effectiveOvr: player.ovr,
      delta: 0,
      fitLevel: 'Secondary',
    };
  }

  // Goalkeeper mismatch check
  if (targetPos === 'GK') {
    const gkEffective = Math.max(38, Math.min(player.ovr - 12, Math.round(player.attributes.goalkeeper + 4)));
    return {
      targetPos,
      effectiveOvr: gkEffective,
      delta: gkEffective - player.ovr,
      fitLevel: 'OutOfPosition',
    };
  }
  if (naturalPos === 'GK') {
    const outfieldEffective = Math.max(40, Math.round(getPositionalWeightScore(targetPos, player.attributes) * 0.72));
    return {
      targetPos,
      effectiveOvr: outfieldEffective,
      delta: outfieldEffective - player.ovr,
      fitLevel: 'OutOfPosition',
    };
  }

  const naturalScore = getPositionalWeightScore(naturalPos, player.attributes);
  const targetScore = getPositionalWeightScore(targetPos, player.attributes);
  const attrGap = Math.round((targetScore - naturalScore) * 0.55);

  const isAdjacent = ADJACENT_GROUPS[naturalPos]?.includes(targetPos);
  const sameCoarse = DETAILED_TO_COARSE_POS[naturalPos] === DETAILED_TO_COARSE_POS[targetPos];

  let familiarityPenalty = -8;
  let fitLevel: SlotEvaluation['fitLevel'] = 'OutOfPosition';

  if (sameCoarse) {
    familiarityPenalty = -2;
    fitLevel = 'Partial';
  } else if (isAdjacent) {
    familiarityPenalty = -4;
    fitLevel = 'Partial';
  } else {
    familiarityPenalty = -9;
    fitLevel = 'OutOfPosition';
  }

  const rawAdjusted = player.ovr + familiarityPenalty + Math.min(1, Math.max(-6, attrGap));
  const effectiveOvr = Math.max(45, Math.min(player.ovr - (fitLevel === 'OutOfPosition' ? 5 : 1), rawAdjusted));

  return {
    targetPos,
    effectiveOvr,
    delta: effectiveOvr - player.ovr,
    fitLevel,
  };
}

const clampAttr = (v: number) => Math.max(12, Math.min(98, Math.round(v)));

function normalizeEaLookupKey(s: string): string {
  return String(s || '')
    .replace(/ø/gi, 'o').replace(/đ/gi, 'd').replace(/ı/gi, 'i').replace(/ß/gi, 'ss').replace(/ł/gi, 'l')
    .replace(/ş/gi, 's').replace(/ğ/gi, 'g').replace(/ç/gi, 'c').replace(/ž/gi, 'z').replace(/š/gi, 's')
    .replace(/č/gi, 'c').replace(/ć/gi, 'c').replace(/ñ/gi, 'n')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function computeFaceStatsFromDetails(
  pos: Position,
  details: {
    paceDetails: PaceDetails;
    shootingDetails: ShootingDetails;
    passingDetails: PassingDetails;
    dribblingDetails: DribblingDetails;
    defendingDetails: DefendingDetails;
    physicalDetails: PhysicalDetails;
    goalkeeperDetails: GoalkeeperDetails;
  }
): Pick<CompletePlayerAttributes, 'pace' | 'finishing' | 'passing' | 'dribbling' | 'defending' | 'physical' | 'goalkeeper'> {
  const {
    paceDetails: pd,
    shootingDetails: sd,
    passingDetails: pasd,
    dribblingDetails: dd,
    defendingDetails: defd,
    physicalDetails: phyd,
    goalkeeperDetails: gkd,
  } = details;
  const pace = clampAttr(0.45 * pd.acceleration + 0.55 * pd.sprintSpeed);
  const finishing = clampAttr(
    0.05 * sd.positioning + 0.45 * sd.finishing + 0.20 * sd.shotPower + 0.20 * sd.longShots + 0.05 * sd.volleys + 0.05 * sd.penalties
  );
  const passing = clampAttr(
    0.20 * pasd.vision + 0.20 * pasd.crossing + 0.05 * pasd.fkAccuracy + 0.35 * pasd.shortPassing + 0.15 * pasd.longPassing + 0.05 * pasd.curve
  );
  const dribbling = clampAttr(
    0.10 * dd.agility + 0.05 * dd.balance + 0.05 * dd.reactions + 0.30 * dd.ballControl + 0.50 * dd.dribbling
  );
  const defending = clampAttr(
    0.20 * defd.interceptions + 0.10 * defd.headingAccuracy + 0.30 * defd.defAwareness + 0.30 * defd.standingTackle + 0.10 * defd.slidingTackle
  );
  const physical = clampAttr(
    0.05 * phyd.jumping + 0.25 * phyd.stamina + 0.50 * phyd.strength + 0.20 * phyd.aggression
  );
  const goalkeeper = clampAttr(
    pos === 'GK'
      ? 0.22 * gkd.diving + 0.21 * gkd.handling + 0.14 * gkd.kicking + 0.21 * gkd.positioning + 0.22 * gkd.reflexes
      : 0.2 * (gkd.diving + gkd.handling + gkd.kicking + gkd.positioning + gkd.reflexes)
  );
  return { pace, finishing, passing, dribbling, defending, physical, goalkeeper };
}

/**
 * Official EA SPORTS FC 27 Position-Weighted OVR Calculation.
 * Computes overall rating from detailed attributes using position-specific weights.
 */
export function computeFc27Ovr(
  pos: DetailedPosition,
  attrs: PlayerAttributes,
  intRepHint = 0
): number {
  const pd = attrs.paceDetails ?? { acceleration: attrs.pace, sprintSpeed: attrs.pace };
  const sd = attrs.shootingDetails ?? {
    positioning: attrs.finishing,
    finishing: attrs.finishing,
    shotPower: attrs.finishing,
    longShots: attrs.finishing,
    volleys: attrs.finishing,
    penalties: attrs.finishing,
  };
  const pasd = attrs.passingDetails ?? {
    vision: attrs.passing,
    crossing: attrs.passing,
    fkAccuracy: attrs.passing,
    shortPassing: attrs.passing,
    longPassing: attrs.passing,
    curve: attrs.passing,
  };
  const dd = attrs.dribblingDetails ?? {
    agility: attrs.dribbling,
    balance: attrs.dribbling,
    reactions: attrs.dribbling,
    ballControl: attrs.dribbling,
    dribbling: attrs.dribbling,
    composure: attrs.dribbling,
  };
  const defd = attrs.defendingDetails ?? {
    interceptions: attrs.defending,
    headingAccuracy: attrs.defending,
    defAwareness: attrs.defending,
    standingTackle: attrs.defending,
    slidingTackle: attrs.defending,
  };
  const phyd = attrs.physicalDetails ?? {
    jumping: attrs.physical,
    stamina: attrs.physical,
    strength: attrs.physical,
    aggression: attrs.physical,
  };
  const gkd = attrs.goalkeeperDetails ?? {
    diving: attrs.goalkeeper,
    handling: attrs.goalkeeper,
    kicking: attrs.goalkeeper,
    positioning: attrs.goalkeeper,
    reflexes: attrs.goalkeeper,
  };

  let raw = 65;
  switch (pos) {
    case 'GK':
      raw =
        0.21 * gkd.diving +
        0.21 * gkd.handling +
        0.05 * gkd.kicking +
        0.21 * gkd.positioning +
        0.21 * gkd.reflexes +
        0.11 * dd.reactions;
      break;
    case 'CB':
      raw =
        0.02 * pd.sprintSpeed +
        0.05 * pasd.shortPassing +
        0.04 * dd.reactions +
        0.04 * dd.ballControl +
        0.13 * defd.interceptions +
        0.10 * defd.headingAccuracy +
        0.14 * defd.defAwareness +
        0.17 * defd.standingTackle +
        0.10 * defd.slidingTackle +
        0.03 * phyd.jumping +
        0.10 * phyd.strength +
        0.08 * phyd.aggression;
      break;
    case 'LB':
    case 'RB':
      raw =
        0.05 * pd.acceleration +
        0.07 * pd.sprintSpeed +
        0.09 * pasd.crossing +
        0.07 * pasd.shortPassing +
        0.08 * dd.reactions +
        0.07 * dd.ballControl +
        0.12 * defd.interceptions +
        0.04 * defd.headingAccuracy +
        0.08 * defd.defAwareness +
        0.11 * defd.standingTackle +
        0.14 * defd.slidingTackle +
        0.08 * phyd.stamina;
      break;
    case 'CDM':
      raw =
        0.04 * pasd.vision +
        0.14 * pasd.shortPassing +
        0.10 * pasd.longPassing +
        0.07 * dd.reactions +
        0.10 * dd.ballControl +
        0.14 * defd.interceptions +
        0.09 * defd.defAwareness +
        0.12 * defd.standingTackle +
        0.05 * defd.slidingTackle +
        0.06 * phyd.stamina +
        0.04 * phyd.strength +
        0.05 * phyd.aggression;
      break;
    case 'CM':
      raw =
        0.04 * sd.positioning +
        0.02 * sd.finishing +
        0.04 * sd.longShots +
        0.13 * pasd.vision +
        0.17 * pasd.shortPassing +
        0.13 * pasd.longPassing +
        0.08 * dd.reactions +
        0.14 * dd.ballControl +
        0.07 * dd.dribbling +
        0.05 * defd.interceptions +
        0.05 * defd.standingTackle +
        0.08 * phyd.stamina;
      break;
    case 'CAM':
      raw =
        0.09 * sd.positioning +
        0.07 * sd.finishing +
        0.05 * sd.longShots +
        0.14 * pasd.vision +
        0.16 * pasd.shortPassing +
        0.04 * pasd.longPassing +
        0.03 * dd.agility +
        0.07 * dd.reactions +
        0.15 * dd.ballControl +
        0.13 * dd.dribbling +
        0.04 * pd.acceleration +
        0.03 * pd.sprintSpeed;
      break;
    case 'LW':
    case 'RW':
      raw =
        0.07 * pd.acceleration +
        0.06 * pd.sprintSpeed +
        0.09 * sd.positioning +
        0.10 * sd.finishing +
        0.06 * pasd.vision +
        0.09 * pasd.crossing +
        0.09 * pasd.shortPassing +
        0.03 * dd.agility +
        0.07 * dd.reactions +
        0.14 * dd.ballControl +
        0.16 * dd.dribbling +
        0.04 * sd.longShots;
      break;
    case 'ST':
      raw =
        0.04 * pd.acceleration +
        0.05 * pd.sprintSpeed +
        0.13 * sd.positioning +
        0.18 * sd.finishing +
        0.10 * sd.shotPower +
        0.03 * sd.longShots +
        0.02 * sd.volleys +
        0.05 * pasd.shortPassing +
        0.08 * dd.reactions +
        0.10 * dd.ballControl +
        0.07 * dd.dribbling +
        0.10 * defd.headingAccuracy +
        0.05 * phyd.strength;
      break;
  }

  const autoRep = raw >= 87 ? 2 : raw >= 83 ? 1 : 0;
  const rep = Math.max(intRepHint, autoRep);
  return Math.max(48, Math.min(94, Math.round(raw + rep)));
}

export function hydrateEaPlayerProfile(
  name: string,
  detailedPos: DetailedPosition,
  clubId?: string
): {
  attributes: CompletePlayerAttributes;
  ovr: number;
  weakFoot: number;
  skillMoves: number;
  preferredFoot: 'Right' | 'Left';
  heightCm: number;
  age?: number;
  nationality?: string;
} | null {
  const key = normalizeEaLookupKey(name);
  const packed = (clubId ? EA_COMPACT_ATTRS[`${clubId}::${key}`] : undefined) ?? EA_COMPACT_ATTRS[key];
  if (!packed) return null;
  const rawParts = packed.split(',');
  const v = rawParts.slice(0, 41).map(Number);
  if (v.length < 39) return null;

  const paceDetails: PaceDetails = { acceleration: v[0], sprintSpeed: v[1] };
  const shootingDetails: ShootingDetails = {
    positioning: v[2],
    finishing: v[3],
    shotPower: v[4],
    longShots: v[5],
    volleys: v[6],
    penalties: v[7],
  };
  const passingDetails: PassingDetails = {
    vision: v[8],
    crossing: v[9],
    fkAccuracy: v[10],
    shortPassing: v[11],
    longPassing: v[12],
    curve: v[13],
  };
  const dribblingDetails: DribblingDetails = {
    agility: v[14],
    balance: v[15],
    reactions: v[16],
    ballControl: v[17],
    dribbling: v[18],
    composure: v[19],
  };
  const defendingDetails: DefendingDetails = {
    interceptions: v[20],
    headingAccuracy: v[21],
    defAwareness: v[22],
    standingTackle: v[23],
    slidingTackle: v[24],
  };
  const physicalDetails: PhysicalDetails = {
    jumping: v[25],
    stamina: v[26],
    strength: v[27],
    aggression: v[28],
  };
  const goalkeeperDetails: GoalkeeperDetails = {
    diving: v[29],
    handling: v[30],
    kicking: v[31],
    positioning: v[32],
    reflexes: v[33],
  };

  const pos = DETAILED_TO_COARSE_POS[detailedPos];
  const face = computeFaceStatsFromDetails(pos, {
    paceDetails,
    shootingDetails,
    passingDetails,
    dribblingDetails,
    defendingDetails,
    physicalDetails,
    goalkeeperDetails,
  });

  const attributes: CompletePlayerAttributes = {
    ...face,
    paceDetails,
    shootingDetails,
    passingDetails,
    dribblingDetails,
    defendingDetails,
    physicalDetails,
    goalkeeperDetails,
  };

  const officialEaOvr =
    rawParts.length >= 40 && Number.isFinite(v[39]) && v[39] > 0 ? Math.round(v[39]) : null;
  const ovr = officialEaOvr ?? computeFc27Ovr(detailedPos, attributes, v[38] ?? 0);
  const eaAge =
    rawParts.length >= 41 && Number.isFinite(v[40]) && v[40] >= 15 ? Math.round(v[40]) : undefined;
  const eaNat = rawParts.length >= 42 ? rawParts.slice(41).join(',').trim() || undefined : undefined;
  return {
    attributes,
    ovr,
    weakFoot: Math.max(1, Math.min(5, v[34] || 3)),
    skillMoves: Math.max(1, Math.min(5, v[35] || 3)),
    preferredFoot: v[36] === 1 ? 'Left' : 'Right',
    heightCm: v[37] || 180,
    age: eaAge,
    nationality: eaNat,
  };
}

function jitter(seed: number, salt: number, spread = 5): number {
  const n = Math.abs(Math.imul(seed + salt * 37, 2654435761)) % (spread * 2 + 1);
  return n - spread;
}

export function buildDetailedAttributes(
  pos: Position,
  ovr: number,
  seed: number,
  existing?: Partial<PlayerAttributes>
): CompletePlayerAttributes {
  const j = (salt: number, spread = 4) => jitter(seed, salt, spread);

  const pace = existing?.pace ?? clampAttr(
    pos === 'GK' ? ovr - 28 + j(1, 3) : pos === 'DEF' ? ovr - 5 + j(1, 3) : pos === 'MID' ? ovr - 4 + j(1, 3) : ovr + 2 + j(1, 3)
  );
  const finishing = existing?.finishing ?? clampAttr(
    pos === 'GK' ? 28 + j(2, 3) : pos === 'DEF' ? ovr - 24 + j(2, 3) : pos === 'MID' ? ovr - 8 + j(2, 3) : ovr + 3 + j(2, 3)
  );
  const passing = existing?.passing ?? clampAttr(
    pos === 'GK' ? ovr - 12 + j(3, 3) : pos === 'DEF' ? ovr - 7 + j(3, 3) : pos === 'MID' ? ovr + 3 + j(3, 3) : ovr - 7 + j(3, 3)
  );
  const dribbling = existing?.dribbling ?? clampAttr(
    pos === 'GK' ? ovr - 24 + j(4, 3) : pos === 'DEF' ? ovr - 11 + j(4, 3) : pos === 'MID' ? ovr + 1 + j(4, 3) : ovr + 1 + j(4, 3)
  );
  const defending = existing?.defending ?? clampAttr(
    pos === 'GK' ? 38 + j(5, 3) : pos === 'DEF' ? ovr + 3 + j(5, 3) : pos === 'MID' ? ovr - 10 + j(5, 3) : ovr - 34 + j(5, 3)
  );
  const physical = existing?.physical ?? clampAttr(
    pos === 'GK' ? ovr - 4 + j(6, 3) : pos === 'DEF' ? ovr + 1 + j(6, 3) : pos === 'MID' ? ovr - 5 + j(6, 3) : ovr - 5 + j(6, 3)
  );
  const goalkeeper = existing?.goalkeeper ?? clampAttr(
    pos === 'GK' ? ovr + 2 + j(7, 3) : 16 + ((seed + 4) % 9)
  );

  const paceDetails: PaceDetails = existing?.paceDetails ?? {
    acceleration: clampAttr(pace + j(11, 4)),
    sprintSpeed: clampAttr(pace + j(12, 4)),
  };

  const shootingDetails: ShootingDetails = existing?.shootingDetails ?? {
    positioning: clampAttr(pos === 'GK' ? 18 + j(21, 4) : finishing + (pos === 'FWD' ? 2 : -1) + j(21, 4)),
    finishing: clampAttr(finishing + j(22, 4)),
    shotPower: clampAttr(finishing + (pos === 'DEF' ? 14 : 3) + j(23, 5)),
    longShots: clampAttr(finishing + (pos === 'MID' ? 5 : -2) + j(24, 5)),
    volleys: clampAttr(finishing - 3 + j(25, 5)),
    penalties: clampAttr(finishing + j(26, 6)),
  };

  const passingDetails: PassingDetails = existing?.passingDetails ?? {
    vision: clampAttr(passing + (pos === 'MID' ? 3 : -2) + j(31, 4)),
    crossing: clampAttr(passing - 2 + j(32, 6)),
    fkAccuracy: clampAttr(passing - 8 + j(33, 8)),
    shortPassing: clampAttr(passing + 4 + j(34, 3)),
    longPassing: clampAttr(passing + (pos === 'MID' || pos === 'DEF' ? 2 : -4) + j(35, 5)),
    curve: clampAttr(passing - 3 + j(36, 6)),
  };

  const dribblingDetails: DribblingDetails = existing?.dribblingDetails ?? {
    agility: clampAttr(dribbling + (pos === 'DEF' ? -5 : 2) + j(41, 5)),
    balance: clampAttr(dribbling + j(42, 5)),
    reactions: clampAttr(ovr + j(43, 4)),
    ballControl: clampAttr(dribbling + 3 + j(44, 3)),
    dribbling: clampAttr(dribbling + j(45, 4)),
    composure: clampAttr(ovr - 1 + j(46, 4)),
  };

  const defendingDetails: DefendingDetails = existing?.defendingDetails ?? {
    interceptions: clampAttr(defending + j(51, 4)),
    headingAccuracy: clampAttr((pos === 'DEF' ? defending + 1 : pos === 'FWD' ? ovr - 8 : defending - 3) + j(52, 6)),
    defAwareness: clampAttr(defending + 2 + j(53, 4)),
    standingTackle: clampAttr(defending + 3 + j(54, 4)),
    slidingTackle: clampAttr(defending - 1 + j(55, 4)),
  };

  const physicalDetails: PhysicalDetails = existing?.physicalDetails ?? {
    jumping: clampAttr(physical + (pos === 'DEF' || pos === 'GK' ? 4 : -2) + j(61, 5)),
    stamina: clampAttr(pos === 'GK' ? 42 + j(62, 6) : Math.max(physical, ovr - 2) + j(62, 5)),
    strength: clampAttr(physical + (pos === 'DEF' ? 4 : -2) + j(63, 5)),
    aggression: clampAttr(physical + (pos === 'DEF' ? 3 : -3) + j(64, 6)),
  };

  const goalkeeperDetails: GoalkeeperDetails = existing?.goalkeeperDetails ?? {
    diving: clampAttr(pos === 'GK' ? goalkeeper + 1 + j(71, 3) : 12 + ((seed + 1) % 7)),
    handling: clampAttr(pos === 'GK' ? goalkeeper - 1 + j(72, 3) : 11 + ((seed + 2) % 7)),
    kicking: clampAttr(pos === 'GK' ? goalkeeper - 3 + j(73, 4) : 13 + ((seed + 3) % 7)),
    positioning: clampAttr(pos === 'GK' ? goalkeeper + j(74, 3) : 12 + ((seed + 4) % 7)),
    reflexes: clampAttr(pos === 'GK' ? goalkeeper + 2 + j(75, 3) : 13 + ((seed + 5) % 7)),
  };

  return {
    pace,
    finishing,
    passing,
    dribbling,
    defending,
    physical,
    goalkeeper,
    paceDetails,
    shootingDetails,
    passingDetails,
    dribblingDetails,
    defendingDetails,
    physicalDetails,
    goalkeeperDetails,
  };
}

const PLAYSTYLES_BY_POS: Record<Position, string[]> = {
  GK: ['Footwork', 'Cross Claimer', 'Far Throw', 'Long Ball Pass', 'Rush Out'],
  DEF: ['Anticipate', 'Intercept', 'Bruiser', 'Aerial', 'Jockey', 'Slide Tackle'],
  MID: ['Incisive Pass', 'Pinged Pass', 'Tiki Taka', 'Relentless', 'Technical', 'Dead Ball'],
  FWD: ['Finesse Shot', 'Quick Step', 'Rapid', 'Power Shot', 'Trivela', 'First Touch'],
};

export function derivePlayerMeta(player: Pick<Player, 'id' | 'position' | 'ovr' | 'role'>): {
  weakFoot: number;
  attackingWorkRate: WorkRateLevel;
  defensiveWorkRate: WorkRateLevel;
  playStyles: string[];
} {
  let seed = 0;
  for (let i = 0; i < player.id.length; i++) {
    seed = (seed * 31 + player.id.charCodeAt(i)) % 9973;
  }

  const weakFoot =
    player.position === 'GK'
      ? 2 + (seed % 2)
      : Math.min(5, Math.max(2, 2 + ((seed + (player.ovr >= 85 ? 1 : 0)) % 4)));

  let attackingWorkRate: WorkRateLevel = 'Medium';
  let defensiveWorkRate: WorkRateLevel = 'Medium';

  const roleStr = String(player.role ?? '');
  if (player.position === 'GK') {
    attackingWorkRate = 'Medium';
    defensiveWorkRate = 'Medium';
  } else if (player.position === 'DEF') {
    attackingWorkRate = roleStr.includes('Attacking') || roleStr.includes('Wingback') ? 'High' : 'Medium';
    defensiveWorkRate = 'High';
  } else if (player.position === 'MID') {
    attackingWorkRate =
      roleStr === 'Box-to-Box' ||
      roleStr === 'Classic 10' ||
      roleStr === 'Shadow Striker' ||
      roleStr === 'Playmaker' ||
      roleStr === 'Box Crasher'
        ? 'High'
        : 'Medium';
    defensiveWorkRate =
      roleStr === 'Box-to-Box' ||
      roleStr === 'Holding' ||
      roleStr === 'Centre-Half' ||
      roleStr === 'Deep-Lying Playmaker'
        ? 'High'
        : 'Medium';
  } else {
    attackingWorkRate = 'High';
    defensiveWorkRate = roleStr === 'False 9' || roleStr === 'Target Forward' ? 'Medium' : 'Low';
  }

  const pool = PLAYSTYLES_BY_POS[player.position];
  const count = player.ovr >= 85 ? 3 : player.ovr >= 78 ? 2 : 1;
  const playStyles: string[] = [];
  for (let i = 0; i < count; i++) {
    playStyles.push(pool[(seed + i * 2) % pool.length]);
  }

  return { weakFoot, attackingWorkRate, defensiveWorkRate, playStyles };
}

export function normalizePlayer(player: Player): Player {
  let seed = 0;
  for (let i = 0; i < player.id.length; i++) {
    seed = (seed * 31 + player.id.charCodeAt(i)) % 9973;
  }
  const hasFullDetails =
    player.attributes.paceDetails &&
    player.attributes.shootingDetails &&
    player.attributes.passingDetails &&
    player.attributes.dribblingDetails &&
    player.attributes.defendingDetails &&
    player.attributes.physicalDetails &&
    player.attributes.goalkeeperDetails;

  const detailedPosition: DetailedPosition =
    player.detailedPosition ?? inferDetailedPositionFromLegacy(player);
  const secondaryPositions: DetailedPosition[] =
    player.secondaryPositions ?? deriveDefaultSecondaryPositions(detailedPosition, seed);
  const migratedRole = migrateLegacyRole(player.role, detailedPosition);
  const roleMastery =
    player.roleMastery ?? deriveDefaultRoleMastery(detailedPosition, migratedRole, player.ovr, seed);

  const meta =
    player.weakFoot && player.attackingWorkRate && player.defensiveWorkRate && player.playStyles
      ? {
          weakFoot: player.weakFoot,
          attackingWorkRate: player.attackingWorkRate,
          defensiveWorkRate: player.defensiveWorkRate,
          playStyles: player.playStyles,
        }
      : derivePlayerMeta({ ...player, role: migratedRole });

  return {
    ...player,
    detailedPosition,
    secondaryPositions,
    role: migratedRole,
    roleMastery,
    injuredMatches: player.injuredMatches ?? 0,
    weakFoot: meta.weakFoot,
    attackingWorkRate: meta.attackingWorkRate,
    defensiveWorkRate: meta.defensiveWorkRate,
    playStyles: meta.playStyles,
    attributes: hasFullDetails
      ? player.attributes
      : buildDetailedAttributes(player.position, player.ovr, seed + player.ovr, player.attributes),
  };
}
