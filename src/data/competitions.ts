import {
  CompetitionId,
  CountryId,
  DomesticCupId,
  DomesticLeagueId,
  UefaCompId,
} from '../types/game';

export interface CompetitionTheme {
  id: CompetitionId;
  name: string;
  shortName: string;
  bgGradient: string;
  headerBg: string;
  modalBg: string;
  accentColor: string;
  accentText: string;
  borderTint: string;
}

export interface LeagueMetadata {
  id: DomesticLeagueId;
  countryId: CountryId;
  tier: number;
  name: string;
  shortName: string;
  teamCount: number;
  cycles?: number; // 1 = standard double round-robin (or MLS regular season), 2 = quad (Scottish/Swiss/etc.)
  autoPromote: number;
  playoffPromote: number; // e.g., 4 teams play off for 1 spot -> 1
  playoffRange?: [number, number]; // inclusive 1-based rank range
  autoRelegate: number;
  playoffRelegate: number;
  promotedTo?: DomesticLeagueId;
  relegatedTo?: DomesticLeagueId;
  hasConferences?: boolean;
  excludeReserveFromPromotion?: boolean;
  seasonStartIso: string; // e.g. '2026-08-15'
  seasonSpanDays: number;
  titlePrizeBase: number;
}

export interface CountryMetadata {
  id: CountryId;
  nameEn: string;
  nameVi: string;
  flag: string;
  leagues: DomesticLeagueId[];
  primaryCupId: DomesticCupId;
  primaryCupName: string;
  secondaryCupId?: DomesticCupId;
  secondaryCupName?: string;
  superCupId?: DomesticCupId;
  superCupName?: string;
  isEuropeanUefaEligible: boolean;
  uefaSlots?: {
    ucl: number; // top rank cutoff for UCL
    uel: number; // next cutoff for UEL
    uecl: number; // next cutoff for UECL
  };
}

export const COUNTRY_CATALOG: CountryMetadata[] = [
  {
    id: 'ENG',
    nameEn: 'England',
    nameVi: 'Anh',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    leagues: ['PL', 'CHAMP', 'L1', 'L2'],
    primaryCupId: 'FACUP',
    primaryCupName: 'FA Cup',
    secondaryCupId: 'CARABAO',
    secondaryCupName: 'Carabao Cup',
    superCupId: 'SHIELD',
    superCupName: 'FA Community Shield',
    isEuropeanUefaEligible: true,
    uefaSlots: { ucl: 4, uel: 6, uecl: 7 },
  },
  {
    id: 'ESP',
    nameEn: 'Spain',
    nameVi: 'Tây Ban Nha',
    flag: '🇪🇸',
    leagues: ['ESP1', 'ESP2'],
    primaryCupId: 'COPADELREY',
    primaryCupName: 'Copa del Rey',
    superCupId: 'SUPERCOPA',
    superCupName: 'Supercopa de España',
    isEuropeanUefaEligible: true,
    uefaSlots: { ucl: 4, uel: 6, uecl: 7 },
  },
  {
    id: 'GER',
    nameEn: 'Germany',
    nameVi: 'Đức',
    flag: '🇩🇪',
    leagues: ['GER1', 'GER2', 'GER3'],
    primaryCupId: 'DFBPOKAL',
    primaryCupName: 'DFB-Pokal',
    isEuropeanUefaEligible: true,
    uefaSlots: { ucl: 4, uel: 6, uecl: 7 },
  },
  {
    id: 'ITA',
    nameEn: 'Italy',
    nameVi: 'Ý',
    flag: '🇮🇹',
    leagues: ['ITA1', 'ITA2'],
    primaryCupId: 'COPPAITALIA',
    primaryCupName: 'Coppa Italia',
    isEuropeanUefaEligible: true,
    uefaSlots: { ucl: 4, uel: 6, uecl: 7 },
  },
  {
    id: 'FRA',
    nameEn: 'France',
    nameVi: 'Pháp',
    flag: '🇫🇷',
    leagues: ['FRA1', 'FRA2'],
    primaryCupId: 'COUPEDEFRANCE',
    primaryCupName: 'Coupe de France',
    isEuropeanUefaEligible: true,
    uefaSlots: { ucl: 3, uel: 5, uecl: 6 },
  },
  {
    id: 'NED',
    nameEn: 'Netherlands',
    nameVi: 'Hà Lan',
    flag: '🇳🇱',
    leagues: ['NED1', 'NED2'],
    primaryCupId: 'KNVBBEKER',
    primaryCupName: 'KNVB Beker',
    isEuropeanUefaEligible: true,
    uefaSlots: { ucl: 2, uel: 3, uecl: 5 },
  },
  {
    id: 'POR',
    nameEn: 'Portugal',
    nameVi: 'Bồ Đào Nha',
    flag: '🇵🇹',
    leagues: ['POR1', 'POR2'],
    primaryCupId: 'TACADEPORTUGAL',
    primaryCupName: 'Taça de Portugal',
    isEuropeanUefaEligible: true,
    uefaSlots: { ucl: 2, uel: 3, uecl: 5 },
  },
  {
    id: 'TUR',
    nameEn: 'Turkey',
    nameVi: 'Thổ Nhĩ Kỳ',
    flag: '🇹🇷',
    leagues: ['TUR1', 'TUR2'],
    primaryCupId: 'TURKIYEKUPASI',
    primaryCupName: 'Türkiye Kupası',
    isEuropeanUefaEligible: true,
    uefaSlots: { ucl: 2, uel: 3, uecl: 4 },
  },
  {
    id: 'KSA',
    nameEn: 'Saudi Arabia',
    nameVi: 'Ả Rập Xê Út',
    flag: '🇸🇦',
    leagues: ['KSA1', 'KSA2'],
    primaryCupId: 'KINGSCUP',
    primaryCupName: "King's Cup",
    isEuropeanUefaEligible: false,
  },
  {
    id: 'USA',
    nameEn: 'USA & Canada',
    nameVi: 'Mỹ & Canada',
    flag: '🇺🇸',
    leagues: ['USA1'],
    primaryCupId: 'USOPENCUP',
    primaryCupName: 'U.S. Open Cup',
    secondaryCupId: 'MLSCUP',
    secondaryCupName: 'MLS Cup Playoffs',
    isEuropeanUefaEligible: false,
  },
  {
    id: 'BEL',
    nameEn: 'Belgium',
    nameVi: 'Bỉ',
    flag: '🇧🇪',
    leagues: ['BEL1'],
    primaryCupId: 'BELCUP',
    primaryCupName: 'Belgian Cup',
    isEuropeanUefaEligible: true,
    uefaSlots: { ucl: 2, uel: 3, uecl: 4 },
  },
  {
    id: 'SCO',
    nameEn: 'Scotland',
    nameVi: 'Scotland',
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    leagues: ['SCO1'],
    primaryCupId: 'SCOCUP',
    primaryCupName: 'Scottish Cup',
    isEuropeanUefaEligible: true,
    uefaSlots: { ucl: 1, uel: 2, uecl: 4 },
  },
  {
    id: 'AUT',
    nameEn: 'Austria',
    nameVi: 'Áo',
    flag: '🇦🇹',
    leagues: ['AUT1'],
    primaryCupId: 'AUTCUP',
    primaryCupName: 'ÖFB-Cup',
    isEuropeanUefaEligible: true,
    uefaSlots: { ucl: 1, uel: 2, uecl: 4 },
  },
  {
    id: 'SUI',
    nameEn: 'Switzerland',
    nameVi: 'Thụy Sĩ',
    flag: '🇨🇭',
    leagues: ['SUI1'],
    primaryCupId: 'SUICUP',
    primaryCupName: 'Swiss Cup',
    isEuropeanUefaEligible: true,
    uefaSlots: { ucl: 1, uel: 2, uecl: 4 },
  },
  {
    id: 'DEN',
    nameEn: 'Denmark',
    nameVi: 'Đan Mạch',
    flag: '🇩🇰',
    leagues: ['DEN1'],
    primaryCupId: 'DENCUP',
    primaryCupName: 'DBU Pokalen',
    isEuropeanUefaEligible: true,
    uefaSlots: { ucl: 1, uel: 2, uecl: 4 },
  },
  {
    id: 'NOR',
    nameEn: 'Norway',
    nameVi: 'Na Uy',
    flag: '🇳🇴',
    leagues: ['NOR1'],
    primaryCupId: 'NORCUP',
    primaryCupName: 'NM Cupen',
    isEuropeanUefaEligible: true,
    uefaSlots: { ucl: 1, uel: 2, uecl: 4 },
  },
  {
    id: 'GRE',
    nameEn: 'Greece',
    nameVi: 'Hy Lạp',
    flag: '🇬🇷',
    leagues: ['GRE1'],
    primaryCupId: 'GRECUP',
    primaryCupName: 'Greek Cup',
    isEuropeanUefaEligible: true,
    uefaSlots: { ucl: 1, uel: 2, uecl: 4 },
  },
  {
    id: 'CZE',
    nameEn: 'Czechia',
    nameVi: 'Séc',
    flag: '🇨🇿',
    leagues: ['CZE1'],
    primaryCupId: 'CZECUP',
    primaryCupName: 'MOL Cup',
    isEuropeanUefaEligible: true,
    uefaSlots: { ucl: 1, uel: 2, uecl: 4 },
  },
  {
    id: 'POL',
    nameEn: 'Poland',
    nameVi: 'Ba Lan',
    flag: '🇵🇱',
    leagues: ['POL1'],
    primaryCupId: 'POLCUP',
    primaryCupName: 'Puchar Polski',
    isEuropeanUefaEligible: true,
    uefaSlots: { ucl: 1, uel: 2, uecl: 4 },
  },
  {
    id: 'UKR',
    nameEn: 'Ukraine',
    nameVi: 'Ukraine',
    flag: '🇺🇦',
    leagues: ['UKR1'],
    primaryCupId: 'UKRCUP',
    primaryCupName: 'Ukrainian Cup',
    isEuropeanUefaEligible: true,
    uefaSlots: { ucl: 1, uel: 2, uecl: 4 },
  },
  {
    id: 'CRO',
    nameEn: 'Croatia',
    nameVi: 'Croatia',
    flag: '🇭🇷',
    leagues: ['CRO1'],
    primaryCupId: 'CROCUP',
    primaryCupName: 'Croatian Cup',
    isEuropeanUefaEligible: true,
    uefaSlots: { ucl: 1, uel: 2, uecl: 3 },
  },
  {
    id: 'SWE',
    nameEn: 'Sweden',
    nameVi: 'Thụy Điển',
    flag: '🇸🇪',
    leagues: ['SWE1'],
    primaryCupId: 'SWECUP',
    primaryCupName: 'Svenska Cupen',
    isEuropeanUefaEligible: true,
    uefaSlots: { ucl: 1, uel: 2, uecl: 3 },
  },
];

export const COUNTRY_BY_ID: Record<CountryId, CountryMetadata> = Object.fromEntries(
  COUNTRY_CATALOG.map((c) => [c.id, c])
) as Record<CountryId, CountryMetadata>;

export const LEAGUE_CATALOG: Record<DomesticLeagueId, LeagueMetadata> = {
  // England
  PL: { id: 'PL', countryId: 'ENG', tier: 1, name: 'Premier League', shortName: 'PL', teamCount: 20, autoPromote: 0, playoffPromote: 0, autoRelegate: 3, playoffRelegate: 0, relegatedTo: 'CHAMP', seasonStartIso: '2026-08-15', seasonSpanDays: 281, titlePrizeBase: 48_000_000 },
  CHAMP: { id: 'CHAMP', countryId: 'ENG', tier: 2, name: 'EFL Championship', shortName: 'EFLC', teamCount: 24, autoPromote: 2, playoffPromote: 1, playoffRange: [3, 6], autoRelegate: 3, playoffRelegate: 0, promotedTo: 'PL', relegatedTo: 'L1', seasonStartIso: '2026-08-08', seasonSpanDays: 273, titlePrizeBase: 14_000_000 },
  L1: { id: 'L1', countryId: 'ENG', tier: 3, name: 'EFL League One', shortName: 'L1', teamCount: 24, autoPromote: 2, playoffPromote: 1, playoffRange: [3, 6], autoRelegate: 4, playoffRelegate: 0, promotedTo: 'CHAMP', relegatedTo: 'L2', seasonStartIso: '2026-08-08', seasonSpanDays: 273, titlePrizeBase: 4_000_000 },
  L2: { id: 'L2', countryId: 'ENG', tier: 4, name: 'EFL League Two', shortName: 'L2', teamCount: 24, autoPromote: 3, playoffPromote: 1, playoffRange: [4, 7], autoRelegate: 0, playoffRelegate: 0, promotedTo: 'L1', seasonStartIso: '2026-08-08', seasonSpanDays: 273, titlePrizeBase: 2_000_000 },

  // Spain
  ESP1: { id: 'ESP1', countryId: 'ESP', tier: 1, name: 'LALIGA EA SPORTS', shortName: 'LL1', teamCount: 20, autoPromote: 0, playoffPromote: 0, autoRelegate: 3, playoffRelegate: 0, relegatedTo: 'ESP2', seasonStartIso: '2026-08-15', seasonSpanDays: 280, titlePrizeBase: 42_000_000 },
  ESP2: { id: 'ESP2', countryId: 'ESP', tier: 2, name: 'LALIGA HYPERMOTION', shortName: 'LL2', teamCount: 22, autoPromote: 2, playoffPromote: 1, playoffRange: [3, 6], autoRelegate: 0, playoffRelegate: 0, promotedTo: 'ESP1', excludeReserveFromPromotion: true, seasonStartIso: '2026-08-15', seasonSpanDays: 282, titlePrizeBase: 8_500_000 },

  // Germany
  GER1: { id: 'GER1', countryId: 'GER', tier: 1, name: 'Bundesliga', shortName: 'BL1', teamCount: 18, autoPromote: 0, playoffPromote: 0, autoRelegate: 2, playoffRelegate: 1, relegatedTo: 'GER2', seasonStartIso: '2026-08-22', seasonSpanDays: 266, titlePrizeBase: 40_000_000 },
  GER2: { id: 'GER2', countryId: 'GER', tier: 2, name: '2. Bundesliga', shortName: 'BL2', teamCount: 18, autoPromote: 2, playoffPromote: 1, playoffRange: [3, 3], autoRelegate: 2, playoffRelegate: 1, promotedTo: 'GER1', relegatedTo: 'GER3', seasonStartIso: '2026-08-08', seasonSpanDays: 280, titlePrizeBase: 9_000_000 },
  GER3: { id: 'GER3', countryId: 'GER', tier: 3, name: '3. Liga', shortName: '3L', teamCount: 20, autoPromote: 2, playoffPromote: 1, playoffRange: [3, 3], autoRelegate: 0, playoffRelegate: 0, promotedTo: 'GER2', excludeReserveFromPromotion: true, seasonStartIso: '2026-08-08', seasonSpanDays: 280, titlePrizeBase: 3_000_000 },

  // Italy
  ITA1: { id: 'ITA1', countryId: 'ITA', tier: 1, name: 'Serie A', shortName: 'SA', teamCount: 20, autoPromote: 0, playoffPromote: 0, autoRelegate: 3, playoffRelegate: 0, relegatedTo: 'ITA2', seasonStartIso: '2026-08-16', seasonSpanDays: 280, titlePrizeBase: 38_000_000 },
  ITA2: { id: 'ITA2', countryId: 'ITA', tier: 2, name: 'Serie B', shortName: 'SB', teamCount: 20, autoPromote: 2, playoffPromote: 1, playoffRange: [3, 8], autoRelegate: 0, playoffRelegate: 0, promotedTo: 'ITA1', seasonStartIso: '2026-08-16', seasonSpanDays: 274, titlePrizeBase: 7_500_000 },

  // France
  FRA1: { id: 'FRA1', countryId: 'FRA', tier: 1, name: 'Ligue 1', shortName: 'L1F', teamCount: 18, autoPromote: 0, playoffPromote: 0, autoRelegate: 2, playoffRelegate: 1, relegatedTo: 'FRA2', seasonStartIso: '2026-08-15', seasonSpanDays: 273, titlePrizeBase: 34_000_000 },
  FRA2: { id: 'FRA2', countryId: 'FRA', tier: 2, name: 'Ligue 2', shortName: 'L2F', teamCount: 18, autoPromote: 2, playoffPromote: 1, playoffRange: [3, 5], autoRelegate: 0, playoffRelegate: 0, promotedTo: 'FRA1', seasonStartIso: '2026-08-08', seasonSpanDays: 278, titlePrizeBase: 6_500_000 },

  // Netherlands
  NED1: { id: 'NED1', countryId: 'NED', tier: 1, name: 'Eredivisie', shortName: 'ERE', teamCount: 18, autoPromote: 0, playoffPromote: 0, autoRelegate: 2, playoffRelegate: 1, relegatedTo: 'NED2', seasonStartIso: '2026-08-15', seasonSpanDays: 275, titlePrizeBase: 16_000_000 },
  NED2: { id: 'NED2', countryId: 'NED', tier: 2, name: 'Eerste Divisie', shortName: 'KDD', teamCount: 20, autoPromote: 2, playoffPromote: 1, playoffRange: [3, 8], autoRelegate: 0, playoffRelegate: 0, promotedTo: 'NED1', excludeReserveFromPromotion: true, seasonStartIso: '2026-08-15', seasonSpanDays: 275, titlePrizeBase: 3_500_000 },

  // Portugal
  POR1: { id: 'POR1', countryId: 'POR', tier: 1, name: 'Liga Portugal', shortName: 'LP1', teamCount: 18, autoPromote: 0, playoffPromote: 0, autoRelegate: 2, playoffRelegate: 1, relegatedTo: 'POR2', seasonStartIso: '2026-08-15', seasonSpanDays: 275, titlePrizeBase: 16_000_000 },
  POR2: { id: 'POR2', countryId: 'POR', tier: 2, name: 'Liga Portugal 2', shortName: 'LP2', teamCount: 18, autoPromote: 2, playoffPromote: 1, playoffRange: [3, 3], autoRelegate: 0, playoffRelegate: 0, promotedTo: 'POR1', excludeReserveFromPromotion: true, seasonStartIso: '2026-08-15', seasonSpanDays: 275, titlePrizeBase: 3_500_000 },

  // Turkey
  TUR1: { id: 'TUR1', countryId: 'TUR', tier: 1, name: 'Süper Lig', shortName: 'SL', teamCount: 18, autoPromote: 0, playoffPromote: 0, autoRelegate: 3, playoffRelegate: 0, relegatedTo: 'TUR2', seasonStartIso: '2026-08-15', seasonSpanDays: 280, titlePrizeBase: 18_000_000 },
  TUR2: { id: 'TUR2', countryId: 'TUR', tier: 2, name: 'TFF 1. Lig', shortName: '1LG', teamCount: 20, autoPromote: 2, playoffPromote: 1, playoffRange: [3, 7], autoRelegate: 0, playoffRelegate: 0, promotedTo: 'TUR1', seasonStartIso: '2026-08-15', seasonSpanDays: 276, titlePrizeBase: 3_800_000 },

  // Saudi Arabia
  KSA1: { id: 'KSA1', countryId: 'KSA', tier: 1, name: 'Saudi Pro League', shortName: 'SPL', teamCount: 18, autoPromote: 0, playoffPromote: 0, autoRelegate: 3, playoffRelegate: 0, relegatedTo: 'KSA2', seasonStartIso: '2026-08-21', seasonSpanDays: 272, titlePrizeBase: 28_000_000 },
  KSA2: { id: 'KSA2', countryId: 'KSA', tier: 2, name: 'Saudi First Division', shortName: 'FDL', teamCount: 18, autoPromote: 3, playoffPromote: 0, autoRelegate: 0, playoffRelegate: 0, promotedTo: 'KSA1', seasonStartIso: '2026-08-21', seasonSpanDays: 272, titlePrizeBase: 4_500_000 },

  // USA
  USA1: { id: 'USA1', countryId: 'USA', tier: 1, name: 'Major League Soccer', shortName: 'MLS', teamCount: 30, hasConferences: true, autoPromote: 0, playoffPromote: 0, autoRelegate: 0, playoffRelegate: 0, seasonStartIso: '2026-08-15', seasonSpanDays: 270, titlePrizeBase: 15_000_000 },

  // Other 12 UEFA top flights
  BEL1: { id: 'BEL1', countryId: 'BEL', tier: 1, name: 'Belgian Pro League', shortName: 'JPL', teamCount: 18, autoPromote: 0, playoffPromote: 0, autoRelegate: 0, playoffRelegate: 0, seasonStartIso: '2026-08-08', seasonSpanDays: 280, titlePrizeBase: 12_000_000 },
  SCO1: { id: 'SCO1', countryId: 'SCO', tier: 1, name: 'Scottish Premiership', shortName: 'SPFL', teamCount: 12, cycles: 2, autoPromote: 0, playoffPromote: 0, autoRelegate: 0, playoffRelegate: 0, seasonStartIso: '2026-08-08', seasonSpanDays: 280, titlePrizeBase: 10_000_000 },
  AUT1: { id: 'AUT1', countryId: 'AUT', tier: 1, name: 'Austrian Bundesliga', shortName: 'AUT', teamCount: 12, cycles: 2, autoPromote: 0, playoffPromote: 0, autoRelegate: 0, playoffRelegate: 0, seasonStartIso: '2026-08-08', seasonSpanDays: 280, titlePrizeBase: 10_000_000 },
  SUI1: { id: 'SUI1', countryId: 'SUI', tier: 1, name: 'Swiss Super League', shortName: 'SUI', teamCount: 12, cycles: 2, autoPromote: 0, playoffPromote: 0, autoRelegate: 0, playoffRelegate: 0, seasonStartIso: '2026-08-08', seasonSpanDays: 280, titlePrizeBase: 9_500_000 },
  DEN1: { id: 'DEN1', countryId: 'DEN', tier: 1, name: 'Danish Superliga', shortName: 'DEN', teamCount: 12, cycles: 2, autoPromote: 0, playoffPromote: 0, autoRelegate: 0, playoffRelegate: 0, seasonStartIso: '2026-08-08', seasonSpanDays: 280, titlePrizeBase: 9_500_000 },
  NOR1: { id: 'NOR1', countryId: 'NOR', tier: 1, name: 'Eliteserien', shortName: 'NOR', teamCount: 16, autoPromote: 0, playoffPromote: 0, autoRelegate: 0, playoffRelegate: 0, seasonStartIso: '2026-08-15', seasonSpanDays: 270, titlePrizeBase: 8_500_000 },
  GRE1: { id: 'GRE1', countryId: 'GRE', tier: 1, name: 'Super League Greece', shortName: 'GRE', teamCount: 14, autoPromote: 0, playoffPromote: 0, autoRelegate: 0, playoffRelegate: 0, seasonStartIso: '2026-08-15', seasonSpanDays: 272, titlePrizeBase: 10_500_000 },
  CZE1: { id: 'CZE1', countryId: 'CZE', tier: 1, name: 'Czech First League', shortName: 'CZE', teamCount: 16, autoPromote: 0, playoffPromote: 0, autoRelegate: 0, playoffRelegate: 0, seasonStartIso: '2026-08-15', seasonSpanDays: 272, titlePrizeBase: 9_000_000 },
  POL1: { id: 'POL1', countryId: 'POL', tier: 1, name: 'Ekstraklasa', shortName: 'POL', teamCount: 18, autoPromote: 0, playoffPromote: 0, autoRelegate: 0, playoffRelegate: 0, seasonStartIso: '2026-08-08', seasonSpanDays: 280, titlePrizeBase: 8_500_000 },
  UKR1: { id: 'UKR1', countryId: 'UKR', tier: 1, name: 'Ukrainian Premier League', shortName: 'UPL', teamCount: 16, autoPromote: 0, playoffPromote: 0, autoRelegate: 0, playoffRelegate: 0, seasonStartIso: '2026-08-15', seasonSpanDays: 272, titlePrizeBase: 9_500_000 },
  CRO1: { id: 'CRO1', countryId: 'CRO', tier: 1, name: 'HNL', shortName: 'HNL', teamCount: 10, cycles: 2, autoPromote: 0, playoffPromote: 0, autoRelegate: 0, playoffRelegate: 0, seasonStartIso: '2026-08-08', seasonSpanDays: 280, titlePrizeBase: 8_000_000 },
  SWE1: { id: 'SWE1', countryId: 'SWE', tier: 1, name: 'Allsvenskan', shortName: 'SWE', teamCount: 16, autoPromote: 0, playoffPromote: 0, autoRelegate: 0, playoffRelegate: 0, seasonStartIso: '2026-08-15', seasonSpanDays: 270, titlePrizeBase: 8_000_000 },
};

export const ALL_DOMESTIC_LEAGUE_IDS = Object.keys(LEAGUE_CATALOG) as DomesticLeagueId[];

export const UEFA_COMPETITIONS: Record<UefaCompId, { id: UefaCompId; name: string; shortName: string; leaguePhaseMatches: number; championPrize: number }> = {
  UCL: { id: 'UCL', name: 'UEFA Champions League', shortName: 'UCL', leaguePhaseMatches: 8, championPrize: 65_000_000 },
  UEL: { id: 'UEL', name: 'UEFA Europa League', shortName: 'UEL', leaguePhaseMatches: 8, championPrize: 28_000_000 },
  UECL: { id: 'UECL', name: 'UEFA Conference League', shortName: 'UECL', leaguePhaseMatches: 6, championPrize: 14_000_000 },
};

export const ALL_CUP_IDS: DomesticCupId[] = [
  'FACUP', 'CARABAO', 'SHIELD', 'COPADELREY', 'SUPERCOPA', 'DFBPOKAL', 'COPPAITALIA', 'COUPEDEFRANCE',
  'KNVBBEKER', 'TACADEPORTUGAL', 'TURKIYEKUPASI', 'KINGSCUP', 'USOPENCUP', 'MLSCUP',
  'BELCUP', 'SCOCUP', 'AUTCUP', 'SUICUP', 'DENCUP', 'NORCUP', 'GRECUP',
  'CZECUP', 'POLCUP', 'UKRCUP', 'CROCUP', 'SWECUP',
];

export const ALL_COMPETITION_IDS: CompetitionId[] = [
  ...ALL_DOMESTIC_LEAGUE_IDS,
  ...ALL_CUP_IDS,
  'UCL',
  'UEL',
  'UECL',
  'UEFASUPERCUP',
];

export function isDomesticLeagueId(id: CompetitionId): id is DomesticLeagueId {
  return id in LEAGUE_CATALOG;
}

export function isUefaCompId(id: CompetitionId): id is UefaCompId {
  return id === 'UCL' || id === 'UEL' || id === 'UECL';
}

export function getCountryForLeague(leagueId: CompetitionId): CountryMetadata {
  if (isDomesticLeagueId(leagueId)) {
    return COUNTRY_BY_ID[LEAGUE_CATALOG[leagueId].countryId];
  }
  const byCup = COUNTRY_CATALOG.find(
    (c) => c.primaryCupId === leagueId || c.secondaryCupId === leagueId || c.superCupId === leagueId
  );
  return byCup ?? COUNTRY_BY_ID.ENG;
}

export function getTotalRoundsForWorldLeague(leagueId: CompetitionId = 'PL'): number {
  if (leagueId === 'USA1') return 34; // MLS 34-game regular season
  if (leagueId === 'UCL' || leagueId === 'UEL') return 8;
  if (leagueId === 'UECL') return 6;
  if (isDomesticLeagueId(leagueId)) {
    const meta = LEAGUE_CATALOG[leagueId];
    const cycles = meta.cycles ?? 1;
    return (meta.teamCount - 1) * 2 * cycles;
  }
  return 38;
}

function makeTheme(
  id: CompetitionId,
  name: string,
  shortName: string,
  bgGradient: string,
  headerBg: string,
  modalBg: string,
  accentColor: string,
  accentText: string,
  borderTint: string
): CompetitionTheme {
  return { id, name, shortName, bgGradient, headerBg, modalBg, accentColor, accentText, borderTint };
}

export const COMPETITION_THEMES: Record<CompetitionId, CompetitionTheme> = {
  PL: makeTheme('PL', 'Premier League', 'PL', 'from-[#2A0030] via-[#1C0022] to-[#120016]', '#38003C', '#1B0721', '#00FF85', 'text-[#00FF85]', 'border-fuchsia-500/20'),
  CHAMP: makeTheme('CHAMP', 'EFL Championship', 'EFLC', 'from-[#0B1E45] via-[#091532] to-[#060E22]', '#0E295E', '#0A1633', '#F59E0B', 'text-amber-400', 'border-blue-400/20'),
  L1: makeTheme('L1', 'EFL League One', 'L1', 'from-[#191B42] via-[#121330] to-[#0B0C1F]', '#23265E', '#111433', '#38BDF8', 'text-sky-400', 'border-indigo-400/20'),
  L2: makeTheme('L2', 'EFL League Two', 'L2', 'from-[#102B24] via-[#0B1E19] to-[#071310]', '#163D33', '#0B201A', '#34D399', 'text-emerald-400', 'border-emerald-400/20'),
  FACUP: makeTheme('FACUP', 'FA Cup', 'FAC', 'from-[#420C14] via-[#2B070C] to-[#1A0407]', '#6B121F', '#2D080E', '#FB7185', 'text-rose-400', 'border-rose-400/20'),
  CARABAO: makeTheme('CARABAO', 'Carabao Cup', 'EFL', 'from-[#07332C] via-[#05221E] to-[#031412]', '#0A4A40', '#06241F', '#2DD4BF', 'text-teal-300', 'border-teal-400/20'),
  SHIELD: makeTheme('SHIELD', 'FA Community Shield', 'CS', 'from-[#362207] via-[#241604] to-[#140C02]', '#52340B', '#241604', '#FBBF24', 'text-amber-300', 'border-amber-400/25'),

  ESP1: makeTheme('ESP1', 'LALIGA EA SPORTS', 'LL1', 'from-[#3D0B14] via-[#28070D] to-[#160408]', '#5A101D', '#2A0810', '#FF4B44', 'text-rose-400', 'border-rose-500/25'),
  ESP2: makeTheme('ESP2', 'LALIGA HYPERMOTION', 'LL2', 'from-[#2D1418] via-[#1E0C10] to-[#110709]', '#461C22', '#200D11', '#FB923C', 'text-orange-400', 'border-orange-500/20'),
  COPADELREY: makeTheme('COPADELREY', 'Copa del Rey', 'CDR', 'from-[#3F2908] via-[#2B1B05] to-[#170E03]', '#5C3C0B', '#2B1B05', '#FBBF24', 'text-amber-300', 'border-amber-400/25'),
  SUPERCOPA: makeTheme('SUPERCOPA', 'Supercopa de España', 'SUP', 'from-[#422008] via-[#2E1505] to-[#1A0B02]', '#66310C', '#2E1505', '#FCD34D', 'text-amber-300', 'border-amber-400/30'),

  GER1: makeTheme('GER1', 'Bundesliga', 'BL1', 'from-[#3E080F] via-[#28050A] to-[#150305]', '#600D16', '#2C060B', '#EF4444', 'text-red-400', 'border-red-500/25'),
  GER2: makeTheme('GER2', '2. Bundesliga', 'BL2', 'from-[#281118] via-[#1B0B10] to-[#100609]', '#3E1A24', '#1E0C12', '#F87171', 'text-red-300', 'border-red-400/20'),
  GER3: makeTheme('GER3', '3. Liga', '3L', 'from-[#1B1D29] via-[#12141D] to-[#0A0B10]', '#2B2E40', '#141620', '#94A3B8', 'text-slate-300', 'border-slate-400/20'),
  DFBPOKAL: makeTheme('DFBPOKAL', 'DFB-Pokal', 'DFB', 'from-[#0D2E1E] via-[#091F14] to-[#05120C]', '#13472E', '#0A2217', '#4ADE80', 'text-emerald-400', 'border-emerald-400/25'),

  ITA1: makeTheme('ITA1', 'Serie A', 'SA', 'from-[#07264D] via-[#051A36] to-[#030E1F]', '#0C3B75', '#061D3B', '#38BDF8', 'text-sky-400', 'border-sky-400/25'),
  ITA2: makeTheme('ITA2', 'Serie B', 'SB', 'from-[#0B2D39] via-[#071E26] to-[#041116]', '#114557', '#08222B', '#22D3EE', 'text-cyan-400', 'border-cyan-400/20'),
  COPPAITALIA: makeTheme('COPPAITALIA', 'Coppa Italia', 'CI', 'from-[#103224] via-[#0A2218] to-[#05130D]', '#184D37', '#0B241A', '#34D399', 'text-emerald-300', 'border-emerald-400/25'),

  FRA1: makeTheme('FRA1', 'Ligue 1', 'L1F', 'from-[#0B1E4A] via-[#081533] to-[#040B1D]', '#102D6E', '#091738', '#C4F042', 'text-lime-300', 'border-lime-400/25'),
  FRA2: makeTheme('FRA2', 'Ligue 2', 'L2F', 'from-[#17213E] via-[#10172B] to-[#090D1A]', '#243460', '#111930', '#60A5FA', 'text-blue-400', 'border-blue-400/20'),
  COUPEDEFRANCE: makeTheme('COUPEDEFRANCE', 'Coupe de France', 'CDF', 'from-[#142347] via-[#0D1730] to-[#070C1A]', '#1F366E', '#0F1B38', '#F43F5E', 'text-rose-400', 'border-rose-400/25'),

  NED1: makeTheme('NED1', 'Eredivisie', 'ERE', 'from-[#3B1B06] via-[#261104] to-[#140902]', '#592909', '#291304', '#FB923C', 'text-orange-400', 'border-orange-500/25'),
  NED2: makeTheme('NED2', 'Eerste Divisie', 'KDD', 'from-[#2D1A0E] via-[#1E1109] to-[#110905]', '#452815', '#21130A', '#FDBA74', 'text-orange-300', 'border-orange-400/20'),
  KNVBBEKER: makeTheme('KNVBBEKER', 'KNVB Beker', 'KNV', 'from-[#3D160A] via-[#280E07] to-[#160804]', '#5E220F', '#2B1008', '#FACC15', 'text-yellow-300', 'border-yellow-400/25'),

  POR1: makeTheme('POR1', 'Liga Portugal', 'LP1', 'from-[#11331A] via-[#0B2211] to-[#06130A]', '#1B4F29', '#0D2614', '#FBBF24', 'text-amber-300', 'border-amber-400/25'),
  POR2: makeTheme('POR2', 'Liga Portugal 2', 'LP2', 'from-[#1A2921] via-[#111C16] to-[#0A100D]', '#294034', '#131F18', '#4ADE80', 'text-emerald-400', 'border-emerald-400/20'),
  TACADEPORTUGAL: makeTheme('TACADEPORTUGAL', 'Taça de Portugal', 'TDP', 'from-[#3B1012] via-[#270A0B] to-[#150506]', '#5B181B', '#290B0D', '#34D399', 'text-emerald-300', 'border-emerald-400/25'),

  TUR1: makeTheme('TUR1', 'Süper Lig', 'SL', 'from-[#420C10] via-[#2B080A] to-[#170405]', '#661218', '#2E090C', '#FB7185', 'text-rose-400', 'border-rose-400/25'),
  TUR2: makeTheme('TUR2', 'TFF 1. Lig', '1LG', 'from-[#2B1216] via-[#1D0B0E] to-[#100608]', '#441B22', '#200D10', '#FCA5A5', 'text-red-300', 'border-red-400/20'),
  TURKIYEKUPASI: makeTheme('TURKIYEKUPASI', 'Türkiye Kupası', 'TK', 'from-[#3A0E16] via-[#26090E] to-[#140508]', '#5A1622', '#290A10', '#F43F5E', 'text-rose-400', 'border-rose-400/25'),

  KSA1: makeTheme('KSA1', 'Saudi Pro League', 'SPL', 'from-[#083320] via-[#052215] to-[#03130C]', '#0C4F31', '#062618', '#10B981', 'text-emerald-400', 'border-emerald-400/25'),
  KSA2: makeTheme('KSA2', 'Saudi First Division', 'FDL', 'from-[#132920] via-[#0D1C16] to-[#07100C]', '#1E4032', '#0E1F18', '#6EE7B7', 'text-emerald-300', 'border-emerald-400/20'),
  KINGSCUP: makeTheme('KINGSCUP', "King's Cup", 'KGC', 'from-[#2C2408] via-[#1D1805] to-[#100D03]', '#44380C', '#201B06', '#FCD34D', 'text-amber-300', 'border-amber-400/25'),

  USA1: makeTheme('USA1', 'Major League Soccer', 'MLS', 'from-[#0D2140] via-[#09162B] to-[#050C18]', '#143363', '#0A1930', '#38BDF8', 'text-sky-400', 'border-sky-400/25'),
  USOPENCUP: makeTheme('USOPENCUP', 'U.S. Open Cup', 'USO', 'from-[#1D2247] via-[#131730] to-[#0A0C1B]', '#2E366E', '#151936', '#FB7185', 'text-rose-400', 'border-rose-400/25'),
  MLSCUP: makeTheme('MLSCUP', 'MLS Cup Playoffs', 'MLSC', 'from-[#33240B] via-[#221807] to-[#130D04]', '#4F3811', '#241A08', '#FBBF24', 'text-amber-300', 'border-amber-400/25'),

  BEL1: makeTheme('BEL1', 'Belgian Pro League', 'JPL', 'from-[#2E1E0E] via-[#1F1409] to-[#110B05]', '#472E16', '#21160A', '#FACC15', 'text-yellow-300', 'border-yellow-400/25'),
  BELCUP: makeTheme('BELCUP', 'Belgian Cup', 'BCP', 'from-[#361016] via-[#240B0F] to-[#140608]', '#541922', '#260C10', '#FB7185', 'text-rose-400', 'border-rose-400/25'),
  SCO1: makeTheme('SCO1', 'Scottish Premiership', 'SPFL', 'from-[#0C1F3F] via-[#08152B] to-[#040B18]', '#123061', '#091730', '#60A5FA', 'text-blue-400', 'border-blue-400/25'),
  SCOCUP: makeTheme('SCOCUP', 'Scottish Cup', 'SCP', 'from-[#1B1D42] via-[#12142D] to-[#0A0B19]', '#2B2E66', '#141633', '#38BDF8', 'text-sky-400', 'border-sky-400/25'),
  AUT1: makeTheme('AUT1', 'Austrian Bundesliga', 'AUT', 'from-[#3A0E16] via-[#26090E] to-[#140508]', '#591622', '#290A10', '#F87171', 'text-red-400', 'border-red-400/25'),
  AUTCUP: makeTheme('AUTCUP', 'ÖFB-Cup', 'OFB', 'from-[#2B1218] via-[#1C0C10] to-[#100609]', '#421B25', '#1F0D12', '#FCA5A5', 'text-red-300', 'border-red-400/25'),
  SUI1: makeTheme('SUI1', 'Swiss Super League', 'SUI', 'from-[#3D0D11] via-[#28080B] to-[#160506]', '#5E141A', '#2B090C', '#FB7185', 'text-rose-400', 'border-rose-400/25'),
  SUICUP: makeTheme('SUICUP', 'Swiss Cup', 'SCH', 'from-[#2B1215] via-[#1D0C0E] to-[#100608]', '#441C20', '#200D10', '#F87171', 'text-red-400', 'border-red-400/25'),
  DEN1: makeTheme('DEN1', 'Danish Superliga', 'DEN', 'from-[#380E16] via-[#25090E] to-[#140508]', '#571622', '#280A10', '#FB7185', 'text-rose-400', 'border-rose-400/25'),
  DENCUP: makeTheme('DENCUP', 'DBU Pokalen', 'DBU', 'from-[#2A1118] via-[#1C0B10] to-[#100609]', '#421B25', '#1F0D12', '#FCA5A5', 'text-red-300', 'border-red-400/25'),
  NOR1: makeTheme('NOR1', 'Eliteserien', 'NOR', 'from-[#0D1E3F] via-[#09142B] to-[#050B18]', '#142F61', '#0A1730', '#F87171', 'text-red-400', 'border-red-400/25'),
  NORCUP: makeTheme('NORCUP', 'NM Cupen', 'NMC', 'from-[#182242] via-[#10172D] to-[#090D1A]', '#253566', '#111930', '#60A5FA', 'text-blue-400', 'border-blue-400/25'),
  GRE1: makeTheme('GRE1', 'Super League Greece', 'GRE', 'from-[#0A2547] via-[#071930] to-[#040E1C]', '#0F3A6E', '#081B36', '#38BDF8', 'text-sky-400', 'border-sky-400/25'),
  GRECUP: makeTheme('GRECUP', 'Greek Cup', 'GRC', 'from-[#0F2C4A] via-[#0A1E33] to-[#05101C]', '#174473', '#0B2138', '#7DD3FC', 'text-sky-300', 'border-sky-400/25'),
  CZE1: makeTheme('CZE1', 'Czech First League', 'CZE', 'from-[#0E2042] via-[#09152D] to-[#050C19]', '#163166', '#0A1730', '#EF4444', 'text-red-400', 'border-red-400/25'),
  CZECUP: makeTheme('CZECUP', 'MOL Cup', 'MOL', 'from-[#24163B] via-[#180E28] to-[#0D0816]', '#38225C', '#1A102B', '#A78BFA', 'text-violet-400', 'border-violet-400/25'),
  POL1: makeTheme('POL1', 'Ekstraklasa', 'POL', 'from-[#3B0F1A] via-[#270A11] to-[#150509]', '#5B1728', '#290B12', '#F43F5E', 'text-rose-400', 'border-rose-400/25'),
  POLCUP: makeTheme('POLCUP', 'Puchar Polski', 'PP', 'from-[#2C121D] via-[#1D0C13] to-[#10060B]', '#441C2D', '#200D15', '#FB7185', 'text-rose-400', 'border-rose-400/25'),
  UKR1: makeTheme('UKR1', 'Ukrainian Premier League', 'UPL', 'from-[#0A2247] via-[#071730] to-[#040D1B]', '#0F356E', '#081936', '#FACC15', 'text-yellow-300', 'border-yellow-400/25'),
  UKRCUP: makeTheme('UKRCUP', 'Ukrainian Cup', 'UKC', 'from-[#162747] via-[#0F1A30] to-[#080E1B]', '#223C6E', '#101D36', '#FDE047', 'text-yellow-300', 'border-yellow-400/25'),
  CRO1: makeTheme('CRO1', 'HNL', 'HNL', 'from-[#3B101C] via-[#270A12] to-[#15050A]', '#5B182B', '#290B14', '#60A5FA', 'text-blue-400', 'border-blue-400/25'),
  CROCUP: makeTheme('CROCUP', 'Croatian Cup', 'HRC', 'from-[#182147] via-[#101630] to-[#090C1A]', '#25336E', '#111836', '#FB7185', 'text-rose-400', 'border-rose-400/25'),
  SWE1: makeTheme('SWE1', 'Allsvenskan', 'SWE', 'from-[#0B2447] via-[#071830] to-[#040D1B]', '#11386E', '#081A36', '#FACC15', 'text-yellow-300', 'border-yellow-400/25'),
  SWECUP: makeTheme('SWECUP', 'Svenska Cupen', 'SVC', 'from-[#162947] via-[#0F1C30] to-[#080F1B]', '#22406E', '#101E36', '#FDE047', 'text-yellow-300', 'border-yellow-400/25'),

  UCL: makeTheme('UCL', 'UEFA Champions League', 'UCL', 'from-[#07143D] via-[#040C29] to-[#020617]', '#0A1E5C', '#050F33', '#60A5FA', 'text-blue-300', 'border-blue-400/30'),
  UEL: makeTheme('UEL', 'UEFA Europa League', 'UEL', 'from-[#2E1404] via-[#1F0D03] to-[#120701]', '#471F06', '#210E03', '#FB923C', 'text-orange-400', 'border-orange-400/30'),
  UECL: makeTheme('UECL', 'UEFA Conference League', 'UECL', 'from-[#06291A] via-[#041C11] to-[#020F09]', '#094028', '#041F14', '#22C55E', 'text-green-400', 'border-green-400/30'),
  UEFASUPERCUP: makeTheme('UEFASUPERCUP', 'UEFA Super Cup', 'USC', 'from-[#0C264D] via-[#071933] to-[#040D1C]', '#133A75', '#081B38', '#38BDF8', 'text-sky-300', 'border-sky-400/30'),
};
