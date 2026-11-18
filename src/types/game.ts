export type Language = 'en' | 'vi';

export type Position = 'GK' | 'DEF' | 'MID' | 'FWD';

export type DetailedPosition =
  | 'GK'
  | 'CB'
  | 'LB'
  | 'RB'
  | 'CDM'
  | 'CM'
  | 'CAM'
  | 'LW'
  | 'RW'
  | 'ST';

export type PositionRoleGroup = 'GK' | 'CB' | 'FB' | 'CDM' | 'CM_CAM' | 'WINGER' | 'ST';

export type RoleMasteryLevel = 'Base' | 'Role+' | 'Role++';

export type CountryId =
  | 'ENG'
  | 'ESP'
  | 'GER'
  | 'ITA'
  | 'FRA'
  | 'NED'
  | 'POR'
  | 'TUR'
  | 'KSA'
  | 'USA'
  | 'BEL'
  | 'SCO'
  | 'AUT'
  | 'SUI'
  | 'DEN'
  | 'NOR'
  | 'GRE'
  | 'CZE'
  | 'POL'
  | 'UKR'
  | 'CRO'
  | 'SWE';

export type DomesticLeagueId =
  | 'PL'
  | 'CHAMP'
  | 'L1'
  | 'L2'
  | 'ESP1'
  | 'ESP2'
  | 'GER1'
  | 'GER2'
  | 'GER3'
  | 'ITA1'
  | 'ITA2'
  | 'FRA1'
  | 'FRA2'
  | 'NED1'
  | 'NED2'
  | 'POR1'
  | 'POR2'
  | 'TUR1'
  | 'TUR2'
  | 'KSA1'
  | 'KSA2'
  | 'USA1'
  | 'BEL1'
  | 'SCO1'
  | 'AUT1'
  | 'SUI1'
  | 'DEN1'
  | 'NOR1'
  | 'GRE1'
  | 'CZE1'
  | 'POL1'
  | 'UKR1'
  | 'CRO1'
  | 'SWE1';

export type DomesticCupId =
  | 'FACUP'
  | 'CARABAO'
  | 'SHIELD'
  | 'COPADELREY'
  | 'SUPERCOPA'
  | 'DFBPOKAL'
  | 'COPPAITALIA'
  | 'COUPEDEFRANCE'
  | 'KNVBBEKER'
  | 'TACADEPORTUGAL'
  | 'TURKIYEKUPASI'
  | 'KINGSCUP'
  | 'USOPENCUP'
  | 'MLSCUP'
  | 'BELCUP'
  | 'SCOCUP'
  | 'AUTCUP'
  | 'SUICUP'
  | 'DENCUP'
  | 'NORCUP'
  | 'GRECUP'
  | 'CZECUP'
  | 'POLCUP'
  | 'UKRCUP'
  | 'CROCUP'
  | 'SWECUP';

export type UefaCompId = 'UCL' | 'UEL' | 'UECL';

export type CompetitionId = DomesticLeagueId | DomesticCupId | UefaCompId | 'UEFASUPERCUP';

export type FormationName =
  | '4-3-3'
  | '4-3-3 Holding'
  | '4-3-3 Attack'
  | '4-2-3-1'
  | '4-2-3-1 Narrow'
  | '4-4-2'
  | '4-1-2-1-2 Diamond'
  | '4-1-2-1-2 Wide'
  | '4-2-4'
  | '4-1-4-1'
  | '4-2-2-2'
  | '4-5-1'
  | '3-5-2'
  | '3-4-3'
  | '3-4-2-1'
  | '3-1-4-2'
  | '5-3-2'
  | '5-4-1'
  | '5-2-3';

export type TacticalPreset =
  | 'Gegenpress'
  | 'Tiki-Taka'
  | 'Counter-Attack'
  | 'Wing Play'
  | 'Park the Bus'
  | 'Balanced';

export type BuildUpStyle = 'Short Passing' | 'Balanced' | 'Direct Passing' | 'Long Ball';

export type DefensiveApproach = 'High Press' | 'Balanced' | 'Mid Block' | 'Deep Block';

export type SquadStatus =
  | 'Crucial'
  | 'Important'
  | 'Rotation'
  | 'Sporadic'
  | 'Prospect';

export type PlayerRole =
  // GK
  | 'Goalkeeper'
  | 'Sweeper Keeper'
  | 'Ball-Playing Keeper'
  // CB
  | 'Defender'
  | 'Stopper'
  | 'Ball-Playing Defender'
  | 'Wide Back'
  // LB / RB
  | 'Fullback'
  | 'Falseback'
  | 'Wingback'
  | 'Attacking Wingback'
  | 'Inverted Wingback'
  // CDM
  | 'Holding'
  | 'Centre-Half'
  | 'Deep-Lying Playmaker'
  | 'Wide Half'
  | 'Box Crasher'
  // CM / CAM
  | 'Box-to-Box'
  | 'Playmaker'
  | 'Half-Winger'
  | 'Classic 10'
  | 'Shadow Striker'
  // LW / RW
  | 'Winger'
  | 'Wide Midfielder'
  | 'Wide Playmaker'
  | 'Inside Forward'
  // ST
  | 'Advanced Forward'
  | 'Poacher'
  | 'False 9'
  | 'Target Forward';

export interface PaceDetails {
  acceleration: number;
  sprintSpeed: number;
}

export interface ShootingDetails {
  positioning: number;
  finishing: number;
  shotPower: number;
  longShots: number;
  volleys: number;
  penalties: number;
}

export interface PassingDetails {
  vision: number;
  crossing: number;
  fkAccuracy: number;
  shortPassing: number;
  longPassing: number;
  curve: number;
}

export interface DribblingDetails {
  agility: number;
  balance: number;
  reactions: number;
  ballControl: number;
  dribbling: number;
  composure: number;
}

export interface DefendingDetails {
  interceptions: number;
  headingAccuracy: number;
  defAwareness: number;
  standingTackle: number;
  slidingTackle: number;
}

export interface PhysicalDetails {
  jumping: number;
  stamina: number;
  strength: number;
  aggression: number;
}

export interface GoalkeeperDetails {
  diving: number;
  handling: number;
  kicking: number;
  positioning: number;
  reflexes: number;
}

export interface PlayerAttributes {
  pace: number;
  finishing: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  goalkeeper: number;
  paceDetails?: PaceDetails;
  shootingDetails?: ShootingDetails;
  passingDetails?: PassingDetails;
  dribblingDetails?: DribblingDetails;
  defendingDetails?: DefendingDetails;
  physicalDetails?: PhysicalDetails;
  goalkeeperDetails?: GoalkeeperDetails;
}

export type WorkRateLevel = 'Low' | 'Medium' | 'High';

export interface LoanInfo {
  direction: 'IN' | 'OUT';
  counterpartyClubId: string;
  counterpartyClubName: string;
  wageSharePct: number;
  returnSeasonYear: number;
  loanFee?: number;
  buyOptionFee?: number;
  durationSeasons?: 0.5 | 1 | 2;
  halfSeasonWindow?: 'SUMMER_TO_JAN' | 'JAN_TO_SUMMER';
}

export interface Player {
  id: string;
  name: string;
  nationality: string;
  age: number;
  heightCm: number;
  preferredFoot: 'Right' | 'Left';
  weakFoot?: number; // 1..5
  skillMoves: number; // 1..5
  attackingWorkRate?: WorkRateLevel;
  defensiveWorkRate?: WorkRateLevel;
  playStyles?: string[];
  shirtNumber: number;
  position: Position;
  detailedPosition?: DetailedPosition;
  secondaryPositions?: DetailedPosition[];
  ovr: number;
  potential: number;
  fitness: number; // 0..100
  suspendedMatches: number;
  injuredMatches?: number;
  injuryNote?: string;
  yellowCards: number;
  redCards: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  appearances: number;
  marketValue: number;
  weeklyWage: number;
  contractExpiry: number; // e.g., 2028
  squadStatus: SquadStatus;
  releaseClause: number;
  goalBonus: number;
  forSale: boolean;
  forLoan?: boolean;
  loanInfo?: LoanInfo;
  role: PlayerRole;
  roleMastery?: Partial<Record<PlayerRole, RoleMasteryLevel>>;
  attributes: PlayerAttributes;
}

export interface TacticsConfig {
  preset: TacticalPreset;
  formation: FormationName;
  buildUpStyle: BuildUpStyle;
  defensiveApproach: DefensiveApproach;
  playersInBox: number; // 1..10
  attackingWidth: number; // 1..10
  defensiveLine: number; // 1..10
}

export interface TeamRoles {
  captainId?: string;
  penaltyId?: string;
  freeKickId?: string;
  leftCornerId?: string;
  rightCornerId?: string;
}

export interface Club {
  id: string;
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  pattern: 'solid' | 'stripes' | 'hoops' | 'sash' | 'halves';
  managerName: string;
  stadium: string;
  leagueId?: CompetitionId;
  conf?: 'EAST' | 'WEST';
  isReserve?: boolean;
  openingBudget: number;
  balance: number;
  players: Player[];
  formation: FormationName;
  tactics: TacticsConfig;
  startingIds: string[]; // 11 player IDs
  benchIds: string[]; // up to 9 player IDs
  slotRoles?: Record<number, PlayerRole>;
  teamRoles?: TeamRoles;
}

export interface MatchdayLineupOverride {
  fixtureId: string;
  formation: FormationName;
  startingIds: string[];
  benchIds: string[];
  tactics: TacticsConfig;
  slotRoles?: Record<number, PlayerRole>;
  teamRoles?: TeamRoles;
}

export type DayType = 'RECOVERY' | 'TRAINING' | 'MATCHDAY';

export interface CalendarDay {
  dayIndex: number;
  dateIso: string;
  type: DayType;
  label: string;
  completed: boolean;
  matchFixtureId?: string;
  competitionId?: CompetitionId;
  isDeadlineDay?: boolean;
  windowEvent?: 'SUMMER_OPEN' | 'SUMMER_DEADLINE' | 'WINTER_OPEN' | 'WINTER_DEADLINE';
}

export interface MatchEvent {
  id: string;
  minute: number;
  type: 'GOAL' | 'YELLOW' | 'RED' | 'SUB' | 'CHANCE';
  teamSide: 'HOME' | 'AWAY';
  playerId: string;
  playerName: string;
  assistPlayerId?: string;
  assistPlayerName?: string;
  description: string;
}

export interface MatchStats {
  homeShots: number;
  awayShots: number;
  homeShotsOnTarget: number;
  awayShotsOnTarget: number;
  homePossession: number;
  awayPossession: number;
  homePasses: number;
  awayPasses: number;
  homePassAccuracy: number;
  awayPassAccuracy: number;
  homeFouls: number;
  awayFouls: number;
  homeYellowCards: number;
  awayYellowCards: number;
  homeRedCards: number;
  awayRedCards: number;
  homeOffsides: number;
  awayOffsides: number;
  homeCorners: number;
  awayCorners: number;
}

export interface PlayerMatchRating {
  playerId: string;
  playerName: string;
  position: Position;
  detailedPosition?: DetailedPosition;
  slotIndex?: number;
  teamSide: 'HOME' | 'AWAY';
  rating: number | null;
  goals: number;
  assists: number;
  minutesPlayed: number;
  isMvp: boolean;
  isSub?: boolean;
  subMinute?: number;
  didNotPlay?: boolean;
}

export interface MatchReport {
  fixtureId: string;
  competitionId: CompetitionId;
  round: number;
  homeClubId: string;
  awayClubId: string;
  homeGoals: number;
  awayGoals: number;
  events: MatchEvent[];
  stats: MatchStats;
  ratings: PlayerMatchRating[];
}

export interface Fixture {
  id: string;
  competitionId: CompetitionId;
  round: number;
  dateIso: string;
  homeClubId: string;
  awayClubId: string;
  homeClubName: string;
  awayClubName: string;
  played: boolean;
  homeGoals?: number;
  awayGoals?: number;
  penaltiesWinnerId?: string;
  stageLabel?: string;
  report?: MatchReport;
}

export interface StandingRow {
  clubId: string;
  clubName: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: ('W' | 'D' | 'L')[];
}

export type ScoutStatus = 'UNSCOUTED' | 'SCOUTING' | 'SCOUTED';

export type TransferNegotiationStatus =
  | 'NONE'
  | 'IN_PROGRESS'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'COMPLETED';

export interface TransferOffer {
  dealType?: 'PERMANENT' | 'LOAN';
  startDate: 'Immediate' | 'Next Window';
  transferFee: number;
  installments: number; // 0, 12, 24, 36 months (legacy fallback)
  upfrontPct?: number; // 0..100
  installmentSeasons?: number; // 0..3
  exchangePlayerId: string | null;
  bonusAfterAppearances: number;
  sellOnShare: number; // 0..25%
  loanWageSplitPct?: number; // 0..100%
  loanFee?: number;
  buyOptionFee?: number;
  loanDurationSeasons?: 0.5 | 1 | 2;
}

export interface TransferTarget {
  playerId: string;
  clubId: string;
  scoutStatus: ScoutStatus;
  scoutDaysRemaining: number;
  shortlisted: boolean;
  negotiationStatus: TransferNegotiationStatus;
  lastOffer?: TransferOffer;
  sellerSatisfaction: number; // 0..100
  feedbackMessage?: string;
  cooldownUntilDateIso?: string;
}

export interface IncomingTransferBid {
  id: string;
  playerId: string;
  playerName: string;
  buyingClubId: string;
  buyingClubName: string;
  buyingClubShortName: string;
  bidType?: 'PERMANENT' | 'LOAN';
  loanWageSplitPct?: number;
  offeredFee: number;
  initialFee: number;
  sellOnShare: number;
  offeredTerms?: TransferOffer;
  paidNow?: number;
  futurePayments?: number;
  potentialAddons?: number;
  buyerSatisfaction?: number;
  buyerMaxFee: number;
  patience: number; // 0..100
  roundCount: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  lastMessage: string;
  dateIso: string;
}

export type NotificationType =
  | 'TRANSFER_BID'
  | 'LOAN_BID'
  | 'INJURY'
  | 'SUSPENSION'
  | 'CONTRACT'
  | 'BOARD';

export type ManagerEmploymentStatus = 'ACTIVE' | 'EXPIRING' | 'SACKED';

export interface ManagerContract {
  weeklyWage: number;
  contractEndSeasonYear: number;
  signedDateIso: string;
  status: ManagerEmploymentStatus;
  probationMatchesRemaining: number | null;
}

export type AiManagerStatus = 'SECURE' | 'UNDER_PRESSURE' | 'EXPIRING' | 'VACANT';

export interface ClubManagerInfo {
  clubId: string;
  managerName: string;
  satisfaction: number;
  contractEndSeasonYear: number;
  status: AiManagerStatus;
  weeklyBudgetOffer: number;
}

export interface ManagerNotification {
  id: string;
  dateIso: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  resolved?: boolean;
  bidId?: string;
  playerId?: string;
}

export interface ContractOffer {
  weeklyWage: number;
  extendByYears: number; // 1..5
  signingFee: number;
  agentFee: number;
  squadStatus: SquadStatus;
  bonusPerGoal: number;
  releaseCompensation: number;
}

export interface AcademyPlayer {
  id: string;
  name: string;
  nationality: string;
  age: number;
  position: Position;
  ovr: number;
  potential: number;
  developmentProgress: number; // 0..100
  matches: number;
  goals: number;
  assists: number;
  promoted: boolean;
}

export interface FinanceEntry {
  id: string;
  dateIso: string;
  type: 'INCOME' | 'EXPENSE';
  category:
    | 'OPENING_BUDGET'
    | 'MATCHDAY_REVENUE'
    | 'WEEKLY_WAGES'
    | 'PLAYER_SALE'
    | 'TRANSFER_FEE'
    | 'RENEWAL_FEE'
    | 'RELEASE_COMPENSATION'
    | 'GOAL_BONUS'
    | 'PRIZE_MONEY'
    | 'LOAN_FEE';
  description: string;
  amount: number;
}

export interface CoachProfile {
  firstName: string;
  lastName: string;
  nickname: string;
  nationality: string;
  dob: string;
}

export interface ContextTeam {
  id: string;
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  ovr: number;
  managerName?: string;
  leagueId?: CompetitionId;
  conf?: 'EAST' | 'WEST';
  isReserve?: boolean;
}

export interface CareerTrophy {
  id: string;
  title: string;
  season: string;
  competitionId: CompetitionId;
}

export interface PlayoffTieResult {
  competitionId: CompetitionId;
  winnerId: string;
  winnerName: string;
  finalSummary: string;
}

export interface TierMovement {
  fromLeague: CompetitionId;
  toLeague: CompetitionId;
  direction: 'PROMOTED' | 'RELEGATED';
  clubIds: string[];
  clubNames: string[];
  viaPlayoffClubId?: string;
}

export interface SeasonEndSummary {
  seasonLabel: string;
  seasonIndex: number;
  leagueChampions: Partial<Record<CompetitionId, { clubId: string; clubName: string; points: number }>>;
  faCupWinner?: { clubId: string; clubName: string };
  carabaoWinner?: { clubId: string; clubName: string };
  nationalCupWinners?: Partial<Record<CompetitionId, { clubId: string; clubName: string }>>;
  uclWinner?: { clubId: string; clubName: string };
  uelWinner?: { clubId: string; clubName: string };
  ueclWinner?: { clubId: string; clubName: string };
  uefaSuperCupWinner?: { clubId: string; clubName: string };
  supercopaWinner?: { clubId: string; clubName: string };
  mlsCupWinner?: { clubId: string; clubName: string };
  movements: TierMovement[];
  playoffs: PlayoffTieResult[];
  userFinishRank: number;
  userPreviousLeagueId: CompetitionId;
  userNextLeagueId: CompetitionId;
  userOutcome: 'PROMOTED' | 'RELEGATED' | 'STAYED';
  prizeMoney: number;
}

export type ObjectivePriority = 'CRITICAL' | 'HIGH' | 'MEDIUM';

export type ObjectiveStatus = 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export interface SeasonObjective {
  id: string;
  competitionId: CompetitionId;
  priority: ObjectivePriority;
  titleEn: string;
  titleVi: string;
  descEn: string;
  descVi: string;
  targetLeagueRank?: number;
  targetCupRound?: number;
  currentProgressEn: string;
  currentProgressVi: string;
  status: ObjectiveStatus;
  onTrack?: boolean;
  boardWeight: number;
  satisfactionApplied?: boolean;
}

export interface CareerState {
  version: number;
  seasonIndex?: number;
  seasonLabel?: string;
  coach: CoachProfile;
  clubId: string;
  countryId?: CountryId;
  userLeagueId?: CompetitionId;
  boardSatisfaction: number; // 0..100
  seasonObjectives?: SeasonObjective[];
  currentDayIndex: number;
  currentRound: number;
  calendar: CalendarDay[];
  clubs: Club[];
  leagueTeams?: Record<DomesticLeagueId, ContextTeam[]>;
  uefaParticipants?: Record<UefaCompId, string[]>;
  fixtures: Fixture[];
  contextStandings: Record<CompetitionId, StandingRow[]>;
  contextFixtures: Record<CompetitionId, Fixture[]>;
  transferTargets: TransferTarget[];
  academy: AcademyPlayer[];
  financeLedger: FinanceEntry[];
  openingBudget: number;
  budget: number;
  careerTrophies?: CareerTrophy[];
  pendingSeasonSummary?: SeasonEndSummary | null;
  seasonHistory?: SeasonEndSummary[];
  notifications?: ManagerNotification[];
  incomingBids?: IncomingTransferBid[];
  matchdayOverride?: MatchdayLineupOverride | null;
  deadlineHoursRemaining?: number | null;
  managerContract?: ManagerContract;
  clubManagers?: Record<string, ClubManagerInfo>;
  settings: {
    language: Language;
    soundEnabled: boolean;
    spotifyPlaylistIndex: number;
    autoAdvanceStopOn?: Record<NotificationType, boolean>;
  };
}

export type NavSection =
  | 'matchday'
  | 'calendar'
  | 'lineup'
  | 'squad'
  | 'transfers'
  | 'standings'
  | 'fixtures'
  | 'academy'
  | 'finance'
  | 'media'
  | 'office'
  | 'jobs'
  | 'custom';
