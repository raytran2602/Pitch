import React, { useMemo, useState } from 'react';
import {
  ALL_DOMESTIC_LEAGUE_IDS,
  COUNTRY_BY_ID,
  COUNTRY_CATALOG,
  isDomesticLeagueId,
  LEAGUE_CATALOG,
} from '../data/competitions';
import {
  buildWorldClubById,
  buildWorldClubsForLeague,
  EUR_UEFA_CLUBS,
  getAllRestOfEuropeContextTeams,
  getCachedAllWorldClubs,
  getCachedClubsByLeague,
  getInitialContextTeamsForLeague,
} from '../data/world/worldRegistry';
import { getScoutDurationDays, getTransferWindowStatusForDate } from '../engine/gameLogic';
import {
  CareerState,
  Club,
  ContractOffer,
  CountryId,
  DomesticLeagueId,
  Player,
  Position,
  TransferOffer,
  TransferTarget,
} from '../types/game';
import { formatCurrency, t } from '../utils/i18n';
import { useIsMobileLandscape } from '../utils/useMobileLandscape';
import { ClubBadge, PlayerAvatar } from './ClubBadge';
import { ContractNegotiationModal } from './ContractNegotiationModal';
import { PlayerProfileModal } from './PlayerProfileModal';
import { TransferNegotiationModal } from './TransferNegotiationModal';
import {
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  Clock,
  Eye,
  FastForward,
  Handshake,
  Lock,
  Search,
  UserRound,
  XCircle,
} from 'lucide-react';

interface TransfersViewProps {
  state: CareerState;
  userClub: Club;
  onEnsureClubLoaded?: (clubId: string) => void;
  onStartScout: (playerId: string, clubId?: string) => void;
  onToggleShortlist: (playerId: string, clubId?: string) => void;
  onUpdateTransferStatus: (
    playerId: string,
    status: TransferTarget['negotiationStatus'],
    offer?: TransferOffer,
    feedback?: string,
    targetClubId?: string
  ) => void;
  onCompleteTransferSigning: (
    playerId: string,
    sellingClubId: string,
    paidNow: number,
    exchangePlayerId: string | null,
    contractOffer: ContractOffer,
    contractCost: number
  ) => void;
  onCompleteLoanSigning: (
    playerId: string,
    parentClubId: string,
    offer: TransferOffer
  ) => void;
  onAdvanceDeadlineHour?: () => void;
  onAutoAdvanceDeadlineDay?: () => void;
}

type SortKey = 'position' | 'club' | 'name' | 'ovr' | 'age' | 'value' | 'status';

export const TransfersView: React.FC<TransfersViewProps> = ({
  state,
  userClub,
  onEnsureClubLoaded,
  onStartScout,
  onToggleShortlist,
  onUpdateTransferStatus,
  onCompleteTransferSigning,
  onCompleteLoanSigning,
  onAdvanceDeadlineHour,
  onAutoAdvanceDeadlineDay,
}) => {
  const lang = state.settings.language;
  const isMobileLandscape = useIsMobileLandscape();
  const currentDay = state.calendar[state.currentDayIndex];
  const currentDateIso = currentDay?.dateIso ?? '2026-07-01';
  const windowStatus = getTransferWindowStatusForDate(currentDateIso);
  const [subTab, setSubTab] = useState<'search' | 'scouting' | 'hub'>('search');
  const [marketCountry, setMarketCountry] = useState<'ALL_WORLD' | 'ACTIVE' | 'EUR_UEFA' | CountryId>('ALL_WORLD');
  const [marketLeague, setMarketLeague] = useState<'ALL' | DomesticLeagueId>('ALL');
  const [query, setQuery] = useState('');
  const [posFilter, setPosFilter] = useState<'ALL' | Position>('ALL');
  const [clubFilter, setClubFilter] = useState<string>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('ovr');
  const [sortAsc, setSortAsc] = useState(false);

  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [negotiatingTarget, setNegotiatingTarget] = useState<{
    player: Player;
    club: Club;
    isScouted: boolean;
  } | null>(null);
  const [signingStep, setSigningStep] = useState<{
    player: Player;
    club: Club;
    paidNow: number;
    exchangePlayerId: string | null;
  } | null>(null);

  const enrichedRows = useMemo(() => {
    const clubMap = new Map(state.clubs.map((c) => [c.id, c]));
    const targetByPlayer = new Map(state.transferTargets.map((tItem) => [tItem.playerId, tItem]));
    const rows: { target: TransferTarget; player: Player; club: Club }[] = [];
    const seenPlayerIds = new Set<string>();

    const pushClubPlayers = (club: Club) => {
      if (club.id === userClub.id) return;
      for (const player of club.players) {
        if (seenPlayerIds.has(player.id)) continue;
        seenPlayerIds.add(player.id);
        const target = targetByPlayer.get(player.id) ?? {
          playerId: player.id,
          clubId: club.id,
          scoutStatus: 'UNSCOUTED' as const,
          scoutDaysRemaining: 0,
          shortlisted: false,
          negotiationStatus: 'NONE' as const,
          sellerSatisfaction: 65,
        };
        rows.push({ target, player, club });
      }
    };

    if (subTab === 'search' && marketCountry !== 'ACTIVE') {
      if (marketCountry === 'ALL_WORLD') {
        const pool =
          marketLeague !== 'ALL'
            ? getCachedClubsByLeague(marketLeague)
            : getCachedAllWorldClubs();
        for (const rawC of pool) {
          pushClubPlayers(clubMap.get(rawC.id) ?? rawC);
        }
        return rows;
      }

      if (marketCountry === 'EUR_UEFA') {
        const uefaIds = new Set(EUR_UEFA_CLUBS.map((s) => s.id));
        for (const rawC of getCachedAllWorldClubs()) {
          if (uefaIds.has(rawC.id)) {
            pushClubPlayers(clubMap.get(rawC.id) ?? rawC);
          }
        }
        return rows;
      }

      const targetLeagues: DomesticLeagueId[] =
        marketLeague !== 'ALL'
          ? [marketLeague]
          : COUNTRY_BY_ID[marketCountry]?.leagues ?? ['PL'];
      for (const lid of targetLeagues) {
        const leagueClubs =
          state.clubs.filter((c) => c.leagueId === lid).length >=
          (getInitialContextTeamsForLeague(lid)?.length ?? 99)
            ? state.clubs.filter((c) => c.leagueId === lid)
            : state.leagueTeams?.[lid]
            ? buildWorldClubsForLeague(lid, state.leagueTeams[lid])
            : getCachedClubsByLeague(lid);
        for (const rawC of leagueClubs) {
          pushClubPlayers(clubMap.get(rawC.id) ?? rawC);
        }
      }
      return rows;
    }

    for (const target of state.transferTargets) {
      const club = clubMap.get(target.clubId) ?? buildWorldClubById(target.clubId);
      const player = club?.players.find((p) => p.id === target.playerId);
      if (club && player) {
        rows.push({ target, player, club });
      }
    }
    return rows;
  }, [state.transferTargets, state.clubs, state.leagueTeams, subTab, marketCountry, marketLeague, userClub.id]);

  const filterClubsList = useMemo(() => {
    if (marketCountry === 'ACTIVE') {
      return state.clubs.filter((c) => c.id !== userClub.id);
    }
    if (marketCountry === 'ALL_WORLD') {
      const list =
        marketLeague !== 'ALL'
          ? getInitialContextTeamsForLeague(marketLeague)
          : getCachedAllWorldClubs();
      return list
        .filter((tm) => tm.id !== userClub.id)
        .map((tm) => ({ id: tm.id, name: tm.name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    if (marketCountry === 'EUR_UEFA') {
      return getAllRestOfEuropeContextTeams()
        .filter((tm) => tm.id !== userClub.id)
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    const targetLeagues: DomesticLeagueId[] =
      marketLeague !== 'ALL'
        ? [marketLeague]
        : COUNTRY_BY_ID[marketCountry]?.leagues ?? ['PL'];
    return targetLeagues.flatMap((lid) =>
      getInitialContextTeamsForLeague(lid).filter((tm) => tm.id !== userClub.id)
    );
  }, [marketCountry, marketLeague, state.clubs, userClub.id]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = enrichedRows.filter(({ target, player, club }) => {
      if (subTab === 'scouting' && target.scoutStatus === 'UNSCOUTED') return false;
      if (
        subTab === 'hub' &&
        !target.shortlisted &&
        target.negotiationStatus === 'NONE'
      ) {
        return false;
      }
      if (posFilter !== 'ALL' && player.position !== posFilter) return false;
      if (clubFilter !== 'ALL' && club.id !== clubFilter) return false;
      if (
        q &&
        !player.name.toLowerCase().includes(q) &&
        !club.name.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'position') cmp = a.player.position.localeCompare(b.player.position);
      else if (sortKey === 'club') cmp = a.club.name.localeCompare(b.club.name);
      else if (sortKey === 'name') cmp = a.player.name.localeCompare(b.player.name);
      else if (sortKey === 'ovr') cmp = a.player.ovr - b.player.ovr;
      else if (sortKey === 'age') cmp = a.player.age - b.player.age;
      else if (sortKey === 'value') cmp = a.player.marketValue - b.player.marketValue;
      else cmp = a.target.scoutStatus.localeCompare(b.target.scoutStatus);
      return sortAsc ? cmp : -cmp;
    });

    return list.slice(0, 80);
  }, [enrichedRows, subTab, posFilter, clubFilter, query, sortKey, sortAsc]);

  const selectedDetail = useMemo(
    () => enrichedRows.find((r) => r.player.id === selectedPlayerId) ?? filteredRows[0] ?? null,
    [enrichedRows, selectedPlayerId, filteredRows]
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(key === 'name' || key === 'club');
    }
  };

  const renderStatusIcon = (target: TransferTarget) => {
    if (target.negotiationStatus === 'COMPLETED' || target.negotiationStatus === 'ACCEPTED') {
      return (
        <span title="Accepted / Completed" className="inline-flex">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        </span>
      );
    }
    if (target.negotiationStatus === 'REJECTED') {
      return (
        <span title="Rejected" className="inline-flex">
          <XCircle className="w-4 h-4 text-rose-400" />
        </span>
      );
    }
    if (target.negotiationStatus === 'IN_PROGRESS') {
      return (
        <span title="Negotiation in progress" className="inline-flex">
          <Handshake className="w-4 h-4 text-amber-300" />
        </span>
      );
    }
    if (target.scoutStatus === 'SCOUTED') {
      return (
        <span title="Scouting complete" className="inline-flex">
          <Eye className="w-4 h-4 text-sky-400" />
        </span>
      );
    }
    if (target.scoutStatus === 'SCOUTING') {
      return (
        <span title="Scouting in progress" className="inline-flex">
          <Clock className="w-4 h-4 text-amber-300" />
        </span>
      );
    }
    return <span className="text-xs text-slate-500">—</span>;
  };

  return (
    <div
      className={
        isMobileLandscape
          ? 'h-full min-h-0 flex flex-col gap-2 overflow-hidden'
          : 'space-y-5'
      }
    >
      {isMobileLandscape ? (
        /* Mobile Landscape Compact Combined Transfer Header */
        <div className="shrink-0 rounded-xl border border-white/12 bg-black/35 p-2 space-y-1.5">
          <div
            className={`rounded-lg border px-2.5 py-1 flex flex-wrap items-center justify-between gap-2 ${
              currentDay?.isDeadlineDay
                ? 'border-amber-400/50 bg-amber-950/35'
                : windowStatus.isOpen
                ? 'border-[#00FF85]/35 bg-emerald-950/25'
                : 'border-white/10 bg-black/30'
            }`}
          >
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span
                className={`font-mono font-bold tracking-wider uppercase ${
                  currentDay?.isDeadlineDay
                    ? 'text-amber-300'
                    : windowStatus.isOpen
                    ? 'text-[#00FF85]'
                    : 'text-slate-400'
                }`}
              >
                {currentDay?.isDeadlineDay
                  ? `${t(lang, 'deadlineDayTitle')} · ${state.deadlineHoursRemaining ?? 24}h`
                  : windowStatus.isOpen
                  ? `${t(lang, 'transferWindowOpen')} (${windowStatus.windowType})`
                  : t(lang, 'transferWindowClosed')}
              </span>
              <span className="text-slate-400 font-mono tabular-nums">{currentDateIso}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono text-slate-300 tabular-nums">
                {t(lang, 'availableBudget')}: <span className="text-emerald-300 font-bold">{formatCurrency(state.budget)}</span>
              </span>
              {currentDay?.isDeadlineDay && onAdvanceDeadlineHour && onAutoAdvanceDeadlineDay && (
                <>
                  <button
                    type="button"
                    onClick={onAdvanceDeadlineHour}
                    className="rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-[11px] px-2 py-0.5 cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
                  >
                    <Clock className="w-3 h-3" />
                    {t(lang, 'advanceOneHour')}
                  </button>
                  <button
                    type="button"
                    onClick={onAutoAdvanceDeadlineDay}
                    className="rounded-lg border border-amber-300/45 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 font-semibold text-[11px] px-2 py-0.5 cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
                  >
                    <FastForward className="w-3 h-3" />
                    {t(lang, 'autoAdvance24h')}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-black/45 border border-white/10 shrink-0">
                {(
                  [
                    ['search', t(lang, 'searchPlayers')],
                    ['scouting', t(lang, 'scouting')],
                    ['hub', t(lang, 'transferHub')],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSubTab(id)}
                    className={`px-2.5 py-1 min-h-[28px] rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap ${
                      subTab === id ? 'bg-white text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="relative flex-1 min-w-[140px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  aria-label="Search player or club"
                  placeholder={lang === 'vi' ? 'Tìm cầu thủ / CLB…' : 'Search player or club…'}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-black/50 pl-8 pr-2 py-1 min-h-[30px] text-xs text-white focus:outline-none focus:border-emerald-400"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <select
                aria-label="Filter by position"
                value={posFilter}
                onChange={(e) => setPosFilter(e.target.value as 'ALL' | Position)}
                className="rounded-lg border border-white/15 bg-[#0B0F17] px-2 py-1 min-h-[30px] text-xs text-white shrink-0"
              >
                <option value="ALL">All Pos</option>
                <option value="GK">GK</option>
                <option value="DEF">DEF</option>
                <option value="MID">MID</option>
                <option value="FWD">FWD</option>
              </select>
              <select
                aria-label="Filter by nation"
                value={marketCountry}
                onChange={(e) => {
                  const c = e.target.value as 'ALL_WORLD' | 'ACTIVE' | 'EUR_UEFA' | CountryId;
                  setMarketCountry(c);
                  setMarketLeague('ALL');
                  setClubFilter('ALL');
                }}
                className="rounded-lg border border-white/15 bg-[#0B0F17] px-2 py-1 min-h-[30px] text-xs text-white max-w-[145px] shrink-0"
              >
                <option value="ALL_WORLD">
                  {lang === 'vi' ? '🌍 Toàn bộ giải' : '🌍 World'}
                </option>
                <option value="ACTIVE">
                  {lang === 'vi' ? '🏟️ Giải hiện tại' : '🏟️ Local League'}
                </option>
                {COUNTRY_CATALOG.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.flag} {lang === 'vi' ? c.nameVi : c.nameEn}
                  </option>
                ))}
                <option value="EUR_UEFA">🏆 UEFA / Europe</option>
              </select>
              {marketCountry !== 'ACTIVE' && marketCountry !== 'EUR_UEFA' && (
                <select
                  aria-label="Filter by market league"
                  value={marketLeague}
                  onChange={(e) => {
                    setMarketLeague(e.target.value as 'ALL' | DomesticLeagueId);
                    setClubFilter('ALL');
                  }}
                  className="rounded-lg border border-white/15 bg-[#0B0F17] px-2 py-1 min-h-[30px] text-xs text-white max-w-[145px] shrink-0"
                >
                  <option value="ALL">{lang === 'vi' ? 'Mọi hạng đấu' : 'All Divisions'}</option>
                  {(marketCountry === 'ALL_WORLD'
                    ? ALL_DOMESTIC_LEAGUE_IDS
                    : COUNTRY_BY_ID[marketCountry]?.leagues ?? ALL_DOMESTIC_LEAGUE_IDS
                  ).map((lid) => (
                    <option key={lid} value={lid}>
                      {LEAGUE_CATALOG[lid]?.shortName ?? lid}
                    </option>
                  ))}
                </select>
              )}
              <select
                aria-label="Filter by club"
                value={clubFilter}
                onChange={(e) => {
                  const cid = e.target.value;
                  setClubFilter(cid);
                  if (cid !== 'ALL') onEnsureClubLoaded?.(cid);
                }}
                className="rounded-lg border border-white/15 bg-[#0B0F17] px-2 py-1 min-h-[30px] text-xs text-white flex-1 min-w-[115px]"
              >
                <option value="ALL">All Clubs</option>
                {filterClubsList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Original Desktop Transfer Window & Deadline Day Status Bar */}
          <div
            className={`rounded-xl border px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${
              currentDay?.isDeadlineDay
                ? 'border-amber-400/50 bg-amber-950/35'
                : windowStatus.isOpen
                ? 'border-[#00FF85]/35 bg-emerald-950/25'
                : 'border-white/12 bg-black/35'
            }`}
          >
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span
                className={`font-mono font-bold tracking-wider uppercase ${
                  currentDay?.isDeadlineDay
                    ? 'text-amber-300'
                    : windowStatus.isOpen
                    ? 'text-[#00FF85]'
                    : 'text-slate-400'
                }`}
              >
                {currentDay?.isDeadlineDay
                  ? `${t(lang, 'deadlineDayTitle')} · ${state.deadlineHoursRemaining ?? 24}h`
                  : windowStatus.isOpen
                  ? `${t(lang, 'transferWindowOpen')} (${windowStatus.windowType})`
                  : t(lang, 'transferWindowClosed')}
              </span>
              <span className="text-slate-400 font-mono tabular-nums">
                {currentDateIso}
                {windowStatus.isOpen && !currentDay?.isDeadlineDay
                  ? ` · ${
                      windowStatus.windowType === 'SUMMER'
                        ? `${windowStatus.summerStartIso} → ${windowStatus.summerEndIso}`
                        : `${windowStatus.winterStartIso} → ${windowStatus.winterEndIso}`
                    }`
                  : ''}
              </span>
            </div>

            {currentDay?.isDeadlineDay && onAdvanceDeadlineHour && onAutoAdvanceDeadlineDay && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold text-amber-200 tabular-nums mr-1">
                  {state.deadlineHoursRemaining ?? 24}/24 {t(lang, 'hoursRemaining')}
                </span>
                <button
                  type="button"
                  onClick={onAdvanceDeadlineHour}
                  className="rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs px-3 py-1.5 cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Clock className="w-3.5 h-3.5" />
                  {t(lang, 'advanceOneHour')}
                </button>
                <button
                  type="button"
                  onClick={onAutoAdvanceDeadlineDay}
                  className="rounded-lg border border-amber-300/45 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 font-semibold text-xs px-3 py-1.5 cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <FastForward className="w-3.5 h-3.5" />
                  {t(lang, 'autoAdvance24h')}
                </button>
              </div>
            )}
          </div>

          {/* Original Desktop Sub-navigation */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 p-1 rounded-lg bg-black/40 border border-white/10">
              {(
                [
                  ['search', t(lang, 'searchPlayers')],
                  ['scouting', t(lang, 'scouting')],
                  ['hub', t(lang, 'transferHub')],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSubTab(id)}
                  className={`px-4 py-1.5 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap ${
                    subTab === id ? 'bg-white text-slate-950' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="text-xs font-mono text-slate-300 tabular-nums">
              {t(lang, 'availableBudget')}: <span className="text-emerald-300 font-bold">{formatCurrency(state.budget)}</span>
            </div>
          </div>

          {/* Original Desktop Filters */}
          <div className="pitch-panel rounded-2xl p-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={lang === 'vi' ? 'Tìm cầu thủ hoặc CLB…' : 'Search player or club…'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-black/45 pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
              />
            </div>

            <select
              aria-label="Filter by position"
              value={posFilter}
              onChange={(e) => setPosFilter(e.target.value as 'ALL' | Position)}
              className="rounded-lg border border-white/15 bg-black/45 px-3 py-2 text-xs text-white"
            >
              <option value="ALL">All Positions</option>
              <option value="GK">GK</option>
              <option value="DEF">DEF</option>
              <option value="MID">MID</option>
              <option value="FWD">FWD</option>
            </select>

            <select
              aria-label="Filter by nation"
              value={marketCountry}
              onChange={(e) => {
                const c = e.target.value as 'ALL_WORLD' | 'ACTIVE' | 'EUR_UEFA' | CountryId;
                setMarketCountry(c);
                setMarketLeague('ALL');
                setClubFilter('ALL');
              }}
              className="rounded-lg border border-white/15 bg-black/45 px-2.5 py-2 text-xs text-white"
            >
              <option value="ALL_WORLD">
                {lang === 'vi' ? '🌍 Tất cả các giải (Thế giới)' : '🌍 All World Leagues'}
              </option>
              <option value="ACTIVE">
                {lang === 'vi' ? '🏟️ Giải đấu hiện tại' : '🏟️ Local League Pool'}
              </option>
              {COUNTRY_CATALOG.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.flag} {lang === 'vi' ? c.nameVi : c.nameEn}
                </option>
              ))}
              <option value="EUR_UEFA">🏆 UEFA / Rest of Europe</option>
            </select>

            {marketCountry !== 'ACTIVE' && marketCountry !== 'EUR_UEFA' && (
              <select
                aria-label="Filter by market league"
                value={marketLeague}
                onChange={(e) => {
                  setMarketLeague(e.target.value as 'ALL' | DomesticLeagueId);
                  setClubFilter('ALL');
                }}
                className="rounded-lg border border-white/15 bg-black/45 px-2.5 py-2 text-xs text-white"
              >
                <option value="ALL">{lang === 'vi' ? 'Mọi hạng đấu' : 'All Divisions'}</option>
                {(marketCountry === 'ALL_WORLD'
                  ? ALL_DOMESTIC_LEAGUE_IDS
                  : COUNTRY_BY_ID[marketCountry]?.leagues ?? ALL_DOMESTIC_LEAGUE_IDS
                ).map((lid) => (
                  <option key={lid} value={lid}>
                    {LEAGUE_CATALOG[lid]?.name ?? lid}
                  </option>
                ))}
              </select>
            )}

            <select
              aria-label="Filter by club"
              value={clubFilter}
              onChange={(e) => {
                const cid = e.target.value;
                setClubFilter(cid);
                if (cid !== 'ALL') onEnsureClubLoaded?.(cid);
              }}
              className="rounded-lg border border-white/15 bg-black/45 px-3 py-2 text-xs text-white max-w-[180px]"
            >
              <option value="ALL">All Clubs</option>
              {filterClubsList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <div
        className={
          isMobileLandscape
            ? 'grid grid-cols-12 gap-2 flex-1 min-h-0 overflow-hidden'
            : 'grid grid-cols-1 xl:grid-cols-12 gap-6 items-start'
        }
      >
        {/* Player Table */}
        <section
          className={
            isMobileLandscape
              ? 'col-span-7 h-full min-h-0 pitch-panel rounded-2xl flex flex-col overflow-hidden'
              : 'xl:col-span-7 pitch-panel rounded-2xl overflow-hidden'
          }
        >
          <div className={isMobileLandscape ? 'flex-1 min-h-0 overflow-auto' : 'overflow-x-auto max-h-[540px] overflow-y-auto'}>
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-[#1B0721] border-b border-white/10 text-slate-400">
                <tr>
                  {(
                    [
                      ['position', 'Pos'],
                      ['club', 'Club'],
                      ['name', 'Name'],
                      ['ovr', 'OVR'],
                      ['age', 'Age'],
                      ['value', 'Value'],
                      ['status', 'Status'],
                    ] as [SortKey, string][]
                  ).map(([key, label]) => (
                    <th key={key} className="px-3 py-2.5 font-semibold">
                      <button
                        type="button"
                        onClick={() => toggleSort(key)}
                        className="hover:text-white cursor-pointer whitespace-nowrap"
                      >
                        {label} {sortKey === key ? (sortAsc ? '↑' : '↓') : ''}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No matching targets found in this view.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map(({ target, player, club }) => {
                    const isSel = selectedDetail?.player.id === player.id;
                    const isScouted = target.scoutStatus === 'SCOUTED';
                    return (
                      <tr
                        key={player.id}
                        onClick={() => setSelectedPlayerId(player.id)}
                        className={`cursor-pointer transition-colors ${
                          isSel ? 'bg-[#00FF85]/12' : 'hover:bg-white/6'
                        }`}
                      >
                        <td className="px-3 py-2.5 font-mono text-slate-300">{player.position}</td>
                        <td className="px-3 py-2.5 text-slate-300 whitespace-nowrap">
                          <span>{club.shortName}</span>
                          {club.leagueId && (
                            <span className="ml-1.5 rounded bg-white/10 px-1 py-0.5 font-mono text-[9px] text-slate-400">
                              {isDomesticLeagueId(club.leagueId)
                                ? LEAGUE_CATALOG[club.leagueId]?.shortName ?? club.leagueId
                                : club.leagueId}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-white whitespace-nowrap">{player.name}</td>
                        <td className="px-3 py-2.5 font-mono font-bold text-emerald-300 tabular-nums">
                          {isScouted ? player.ovr : '??'}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-slate-300 tabular-nums">{player.age}</td>
                        <td className="px-3 py-2.5 font-mono text-slate-200 tabular-nums">
                          {isScouted ? formatCurrency(player.marketValue) : 'Hidden'}
                        </td>
                        <td className="px-3 py-2.5">{renderStatusIcon(target)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Right Detail Panel (no cluttered background portrait) */}
        <section
          className={
            isMobileLandscape
              ? 'col-span-5 h-full min-h-0 overflow-y-auto pitch-panel rounded-2xl p-3 pb-12'
              : 'xl:col-span-5 pitch-panel rounded-2xl p-5'
          }
        >
          {!selectedDetail ? (
            <div className="text-xs text-slate-400 py-12 text-center">
              Select a player to view scouting status and open transfer talks.
            </div>
          ) : (
            <div className={isMobileLandscape ? 'space-y-2.5' : 'space-y-5'}>
              <div className={`flex items-center justify-between gap-2.5 border-b border-white/10 ${isMobileLandscape ? 'pb-2.5' : 'pb-4'}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <PlayerAvatar
                    playerId={selectedDetail.player.id}
                    name={selectedDetail.player.name}
                    shirtNumber={selectedDetail.player.shirtNumber}
                    position={selectedDetail.player.position}
                    primaryColor={selectedDetail.club.primaryColor}
                    secondaryColor={selectedDetail.club.secondaryColor}
                    size={isMobileLandscape ? 48 : 64}
                  />
                  <div className="min-w-0">
                    <h3 className="font-display text-2xl font-bold text-white truncate">
                      {selectedDetail.player.name}
                    </h3>
                    <div className="text-xs text-slate-400">
                      {selectedDetail.club.name}
                      {selectedDetail.club.leagueId
                        ? ` (${
                            isDomesticLeagueId(selectedDetail.club.leagueId)
                              ? LEAGUE_CATALOG[selectedDetail.club.leagueId]?.name ?? selectedDetail.club.leagueId
                              : selectedDetail.club.leagueId
                          })`
                        : ''}{' '}
                      · {selectedDetail.player.position} · Age {selectedDetail.player.age}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-display text-3xl font-extrabold text-[#00FF85] tabular-nums">
                    {selectedDetail.target.scoutStatus === 'SCOUTED'
                      ? selectedDetail.player.ovr
                      : '??'}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">OVR</div>
                </div>
              </div>

              {selectedDetail.target.scoutStatus !== 'SCOUTED' ? (
                <div className={`rounded-lg border border-white/10 bg-black/30 text-xs text-slate-300 ${isMobileLandscape ? 'p-2.5 space-y-2' : 'p-4 space-y-3'}`}>
                  <p>
                    Market value, weekly wage, and full attribute ratings are hidden until your scouting department completes a report.
                  </p>
                  {selectedDetail.target.scoutStatus === 'UNSCOUTED' ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onStartScout(selectedDetail.player.id, selectedDetail.club.id)}
                        className={`rounded-lg bg-[#00FF85] hover:bg-emerald-300 text-slate-950 font-bold cursor-pointer ${isMobileLandscape ? 'px-3 py-1.5' : 'px-3.5 py-2'}`}
                      >
                        {t(lang, 'scoutPlayer')} (~{getScoutDurationDays(selectedDetail.player, selectedDetail.club)}d)
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-amber-300 font-semibold inline-flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Scouting in progress ({selectedDetail.target.scoutDaysRemaining} day(s) left)
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                      <div className="text-slate-400">{t(lang, 'marketValue')}</div>
                      <div className="font-mono font-bold text-white mt-0.5 tabular-nums">
                        {formatCurrency(selectedDetail.player.marketValue)}
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                      <div className="text-slate-400">{t(lang, 'weeklyWage')}</div>
                      <div className="font-mono font-bold text-white mt-0.5 tabular-nums">
                        {formatCurrency(selectedDetail.player.weeklyWage)}/wk
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                      <div className="text-slate-400">{t(lang, 'contractExpiry')}</div>
                      <div className="font-mono font-bold text-white mt-0.5 tabular-nums">
                        June {selectedDetail.player.contractExpiry}
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                      <div className="text-slate-400">{t(lang, 'playerRole')}</div>
                      <div className="font-semibold text-white mt-0.5 truncate">
                        {selectedDetail.player.role}
                      </div>
                    </div>
                  </div>

                  {/* Compact 7 General Face Stats Strip (full breakdown is inside View Profile) */}
                  <div className="rounded-lg border border-white/10 bg-black/30 p-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>{lang === 'vi' ? 'CHỈ SỐ CHUNG' : 'GENERAL STATS'}</span>
                      <span>POT {selectedDetail.player.potential}</span>
                    </div>
                    <div className="grid grid-cols-7 gap-1.5 text-center">
                      {[
                        ['PAC', selectedDetail.player.attributes.pace],
                        ['SHO', selectedDetail.player.attributes.finishing],
                        ['PAS', selectedDetail.player.attributes.passing],
                        ['DRI', selectedDetail.player.attributes.dribbling],
                        ['DEF', selectedDetail.player.attributes.defending],
                        ['PHY', selectedDetail.player.attributes.physical],
                        ['GK', selectedDetail.player.attributes.goalkeeper],
                      ].map(([label, val]) => {
                        const num = Number(val);
                        return (
                          <div key={String(label)} className="rounded bg-white/5 py-1.5 px-1">
                            <div className="text-[9px] font-mono text-slate-400">{label}</div>
                            <div
                              className={`font-mono text-xs font-bold tabular-nums ${
                                num >= 85
                                  ? 'text-[#00FF85]'
                                  : num >= 75
                                  ? 'text-emerald-300'
                                  : num >= 65
                                  ? 'text-amber-300'
                                  : 'text-slate-400'
                              }`}
                            >
                              {num}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {selectedDetail.target.feedbackMessage && (
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
                  {selectedDetail.target.feedbackMessage}
                </div>
              )}

              <div className={`flex flex-wrap pt-2 border-t border-white/10 ${isMobileLandscape ? 'gap-1.5 pr-9' : 'gap-2.5'}`}>
                <button
                  type="button"
                  onClick={() => setShowProfileModal(true)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border border-[#00FF85]/40 bg-[#00FF85]/12 hover:bg-[#00FF85]/22 text-[#00FF85] font-bold text-xs cursor-pointer ${
                    isMobileLandscape ? 'px-2.5 py-1.5' : 'px-3.5 py-2'
                  }`}
                >
                  <UserRound className="w-3.5 h-3.5" />
                  {t(lang, 'viewProfile')}
                </button>

                <button
                  type="button"
                  onClick={() => onToggleShortlist(selectedDetail.player.id, selectedDetail.club.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/8 hover:bg-white/15 text-white font-semibold text-xs cursor-pointer ${
                    isMobileLandscape ? 'px-2.5 py-1.5' : 'px-3.5 py-2'
                  }`}
                >
                  {selectedDetail.target.shortlisted ? (
                    <>
                      <BookmarkCheck className="w-3.5 h-3.5 text-emerald-300" />
                      {t(lang, 'removeShortlist')}
                    </>
                  ) : (
                    <>
                      <Bookmark className="w-3.5 h-3.5" />
                      {t(lang, 'shortlist')}
                    </>
                  )}
                </button>

                {selectedDetail.target.negotiationStatus !== 'COMPLETED' && (() => {
                  const cooldownDate = selectedDetail.target.cooldownUntilDateIso;
                  const isCooldownLocked = Boolean(cooldownDate && cooldownDate > currentDateIso);
                  return (
                    <button
                      type="button"
                      disabled={isCooldownLocked}
                      onClick={() => {
                        onEnsureClubLoaded?.(selectedDetail.club.id);
                        setNegotiatingTarget({
                          player: selectedDetail.player,
                          club: selectedDetail.club,
                          isScouted: selectedDetail.target.scoutStatus === 'SCOUTED',
                        });
                      }}
                      className={`rounded-lg bg-[#00FF85] hover:bg-emerald-300 disabled:opacity-45 disabled:cursor-not-allowed text-slate-950 font-bold text-xs cursor-pointer inline-flex items-center gap-1.5 ${
                        isMobileLandscape ? 'px-3 py-1.5' : 'px-4 py-2'
                      }`}
                    >
                      {isCooldownLocked && <Lock className="w-3.5 h-3.5" />}
                      {isCooldownLocked
                        ? `${t(lang, 'cooldownLocked')} (${cooldownDate})`
                        : t(lang, 'negotiateTransfer')}
                    </button>
                  );
                })()}
              </div>

              {selectedDetail.target.cooldownUntilDateIso &&
                selectedDetail.target.cooldownUntilDateIso > currentDateIso && (
                  <div className="text-[11px] font-mono text-rose-300">
                    {t(lang, 'cooldownLocked')}: {selectedDetail.target.cooldownUntilDateIso}
                  </div>
                )}

              {selectedDetail.target.scoutStatus !== 'SCOUTED' &&
                selectedDetail.target.negotiationStatus !== 'COMPLETED' && (
                  <div className="text-[11px] text-slate-400">
                    {lang === 'vi'
                      ? 'Có thể đàm phán mua ngay · Scout để mở khóa OVR & giá trị chính xác.'
                      : 'Blind bid available immediately · Scout to reveal exact OVR & market value.'}
                  </div>
                )}
            </div>
          )}
        </section>
      </div>

      {showProfileModal && selectedDetail && (
        <PlayerProfileModal
          player={selectedDetail.player}
          club={selectedDetail.club}
          language={lang}
          isScouted={selectedDetail.target.scoutStatus === 'SCOUTED'}
          scoutStatus={selectedDetail.target.scoutStatus}
          scoutDaysRemaining={selectedDetail.target.scoutDaysRemaining}
          onStartScout={() => onStartScout(selectedDetail.player.id, selectedDetail.club.id)}
          onClose={() => setShowProfileModal(false)}
        />
      )}

      {negotiatingTarget && (
        <TransferNegotiationModal
          targetPlayer={negotiatingTarget.player}
          sellingClub={negotiatingTarget.club}
          userClub={userClub}
          availableBudget={state.budget}
          language={lang}
          isScouted={negotiatingTarget.isScouted}
          onClose={() => setNegotiatingTarget(null)}
          onOfferAccepted={(offer, paidNow) => {
            onUpdateTransferStatus(
              negotiatingTarget.player.id,
              'ACCEPTED',
              offer,
              'Transfer fee agreed. Negotiate personal terms with the player.',
              negotiatingTarget.club.id
            );
            setSigningStep({
              player: negotiatingTarget.player,
              club: negotiatingTarget.club,
              paidNow,
              exchangePlayerId: offer.exchangePlayerId,
            });
            setNegotiatingTarget(null);
          }}
          onLoanAccepted={(offer) => {
            onCompleteLoanSigning(negotiatingTarget.player.id, negotiatingTarget.club.id, offer);
            onUpdateTransferStatus(
              negotiatingTarget.player.id,
              'COMPLETED',
              offer,
              'Loan agreement completed.',
              negotiatingTarget.club.id
            );
            setNegotiatingTarget(null);
          }}
          onOfferRejected={(msg) => {
            onUpdateTransferStatus(
              negotiatingTarget.player.id,
              'REJECTED',
              undefined,
              msg,
              negotiatingTarget.club.id
            );
            setNegotiatingTarget(null);
          }}
        />
      )}

      {signingStep && (
        <ContractNegotiationModal
          player={signingStep.player}
          availableBudget={state.budget - signingStep.paidNow}
          language={lang}
          mode="NEW_SIGNING"
          onClose={() => setSigningStep(null)}
          onSigned={(contractOffer, contractCost) => {
            onCompleteTransferSigning(
              signingStep.player.id,
              signingStep.club.id,
              signingStep.paidNow,
              signingStep.exchangePlayerId,
              contractOffer,
              contractCost
            );
            setSigningStep(null);
          }}
        />
      )}
    </div>
  );
};
