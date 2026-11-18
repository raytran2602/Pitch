import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowLeftRight, ArrowUp, Search, UserCheck } from 'lucide-react';
import { Club, ContractOffer, DetailedPosition, Language, Player, Position } from '../types/game';
import { formatCurrency, t } from '../utils/i18n';
import { normalizePlayer } from '../utils/playerAttributes';
import { useIsMobileLandscape } from '../utils/useMobileLandscape';
import { PlayerAvatar } from './ClubBadge';
import { ContractNegotiationModal } from './ContractNegotiationModal';
import { PlayerProfileModal } from './PlayerProfileModal';

interface SquadHubViewProps {
  club: Club;
  availableBudget: number;
  language: Language;
  onChangeShirtNumber: (playerId: string, nextShirt: number) => { ok: boolean; error?: string };
  onToggleForSale: (playerId: string) => void;
  onToggleForLoan: (playerId: string) => void;
  onExerciseBuyOption?: (playerId: string) => void;
  onReleasePlayer: (playerId: string) => void;
  onSignContractRenewal: (playerId: string, offer: ContractOffer, immediateCost: number) => void;
}

type SquadSortKey = 'default' | 'ovr' | 'position' | 'value' | 'wage' | 'contractExpiry';
type SquadScope = 'all' | 'firstTeam' | 'loanIn' | 'loanOut';

const POSITION_ORDER: Record<DetailedPosition | string, number> = {
  GK: 0,
  CB: 1,
  LB: 2,
  RB: 3,
  DEF: 2,
  CDM: 4,
  CM: 5,
  CAM: 6,
  MID: 5,
  LW: 7,
  RW: 8,
  ST: 9,
  FWD: 8,
};

function statTextColor(val: number): string {
  if (val >= 85) return 'text-[#00FF85]';
  if (val >= 75) return 'text-emerald-300';
  if (val >= 65) return 'text-amber-300';
  return 'text-slate-400';
}

function posBadgeClass(pos: Position): string {
  if (pos === 'GK') return 'bg-amber-400/15 text-amber-300 border-amber-400/35';
  if (pos === 'DEF') return 'bg-sky-400/15 text-sky-300 border-sky-400/35';
  if (pos === 'MID') return 'bg-emerald-400/15 text-[#00FF85] border-emerald-400/35';
  return 'bg-rose-400/15 text-rose-300 border-rose-400/35';
}

export const SquadHubView: React.FC<SquadHubViewProps> = ({
  club,
  availableBudget,
  language,
  onChangeShirtNumber,
  onToggleForSale,
  onToggleForLoan,
  onExerciseBuyOption,
  onReleasePlayer,
  onSignContractRenewal,
}) => {
  const isMobileLandscape = useIsMobileLandscape();
  const [selectedId, setSelectedId] = useState<string>(club.players[0]?.id ?? '');
  const [compareId, setCompareId] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);
  const [shirtInput, setShirtInput] = useState<number>(club.players[0]?.shirtNumber ?? 1);
  const [shirtMsg, setShirtMsg] = useState<string | null>(null);
  const [showNegotiation, setShowNegotiation] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [sortBy, setSortBy] = useState<SquadSortKey>('default');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [scopeFilter, setScopeFilter] = useState<SquadScope>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const scopeCounts = useMemo(() => {
    let firstTeam = 0;
    let loanIn = 0;
    let loanOut = 0;
    for (const p of club.players) {
      if (p.loanInfo?.direction === 'IN') loanIn++;
      else if (p.loanInfo?.direction === 'OUT') loanOut++;
      else firstTeam++;
    }
    return { all: club.players.length, firstTeam, loanIn, loanOut };
  }, [club.players]);

  const sortedPlayers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const scoped = club.players.filter((p) => {
      if (scopeFilter === 'firstTeam' && p.loanInfo) return false;
      if (scopeFilter === 'loanIn' && p.loanInfo?.direction !== 'IN') return false;
      if (scopeFilter === 'loanOut' && p.loanInfo?.direction !== 'OUT') return false;
      if (q) {
        const pos = (p.detailedPosition ?? p.position).toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !pos.includes(q)) return false;
      }
      return true;
    });
    if (sortBy === 'default') return scoped;
    const list = [...scoped];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'ovr') {
        cmp = a.ovr - b.ovr;
      } else if (sortBy === 'value') {
        cmp = a.marketValue - b.marketValue;
      } else if (sortBy === 'wage') {
        cmp = a.weeklyWage - b.weeklyWage;
      } else if (sortBy === 'contractExpiry') {
        cmp = a.contractExpiry - b.contractExpiry;
      } else if (sortBy === 'position') {
        const pa = POSITION_ORDER[a.detailedPosition ?? a.position] ?? 99;
        const pb = POSITION_ORDER[b.detailedPosition ?? b.position] ?? 99;
        cmp = pa - pb || b.ovr - a.ovr;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [club.players, scopeFilter, searchQuery, sortBy, sortDir]);

  const selectedPlayer = useMemo(
    () =>
      club.players.find((p) => p.id === selectedId) ??
      sortedPlayers[0] ??
      club.players[0],
    [club.players, sortedPlayers, selectedId]
  );

  const comparePlayer = useMemo(
    () => club.players.find((p) => p.id === compareId) ?? null,
    [club.players, compareId]
  );

  const normalizedPlayer = useMemo(
    () => (selectedPlayer ? normalizePlayer(selectedPlayer) : null),
    [selectedPlayer]
  );

  const normalizedCompare = useMemo(
    () => (comparing && comparePlayer ? normalizePlayer(comparePlayer) : null),
    [comparing, comparePlayer]
  );

  const handleSelectPlayer = (p: Player) => {
    setSelectedId(p.id);
    setShirtInput(p.shirtNumber);
    setShirtMsg(null);
  };

  const handleShirtSave = () => {
    if (!selectedPlayer) return;
    const res = onChangeShirtNumber(selectedPlayer.id, shirtInput);
    if (!res.ok) {
      setShirtMsg(res.error ?? 'Number already taken');
    } else {
      setShirtMsg(language === 'vi' ? 'Đã cập nhật số áo.' : 'Shirt number updated.');
    }
  };

  const renderDelta = (val: number, otherVal?: number) => {
    if (otherVal === undefined) return null;
    const diff = val - otherVal;
    if (diff === 0) {
      return <span className="ml-1 text-[10px] font-mono text-slate-400">(=)</span>;
    }
    return (
      <span
        className={`ml-1 text-[10px] font-mono font-bold ${
          diff > 0 ? 'text-[#00FF85]' : 'text-rose-400'
        }`}
      >
        ({diff > 0 ? `+${diff}` : diff})
      </span>
    );
  };

  return (
    <div
      className={
        isMobileLandscape
          ? 'h-full min-h-0 grid grid-cols-12 gap-2 overflow-hidden'
          : 'grid grid-cols-1 lg:grid-cols-12 gap-6 items-start'
      }
    >
      {/* Left Squad List */}
      <section
        className={
          isMobileLandscape
            ? 'col-span-5 h-full min-h-0 flex flex-col pitch-panel rounded-2xl p-2.5 gap-1.5 overflow-hidden'
            : 'lg:col-span-5 pitch-panel rounded-2xl p-4 space-y-3'
        }
      >
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <h2 className="font-display text-xl font-bold text-white">
            {t(language, 'squadOverview')} ({sortedPlayers.length})
          </h2>
          <button
            type="button"
            onClick={() => {
              setComparing((v) => !v);
              if (!compareId && club.players[1]) setCompareId(club.players[1].id);
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold border cursor-pointer whitespace-nowrap transition-colors ${
              comparing
                ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300'
                : 'border-white/15 bg-white/[0.05] text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            {t(language, 'comparePlayers')}
          </button>
        </div>

        {/* Squad Scope Filter (All / First Team / Loaned In / Loaned Out) */}
        <div
          className={
            isMobileLandscape
              ? 'flex items-center gap-1 p-1 rounded-xl bg-black/50 border border-white/10 overflow-x-auto no-scrollbar shrink-0'
              : 'grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 rounded-xl bg-black/50 border border-white/10'
          }
        >
          {(
            isMobileLandscape
              ? ([
                  ['all', `${language === 'vi' ? 'Tất cả' : 'All'} (${scopeCounts.all})`],
                  ['firstTeam', `${language === 'vi' ? 'Đội 1' : '1st'} (${scopeCounts.firstTeam})`],
                  ['loanIn', `${language === 'vi' ? 'Mượn' : 'In'} (${scopeCounts.loanIn})`],
                  ['loanOut', `${language === 'vi' ? 'Cho mượn' : 'Out'} (${scopeCounts.loanOut})`],
                ] as const)
              : ([
                  ['all', `${t(language, 'allSquad')} (${scopeCounts.all})`],
                  ['firstTeam', `${t(language, 'firstTeam')} (${scopeCounts.firstTeam})`],
                  ['loanIn', `${t(language, 'loanedIn')} (${scopeCounts.loanIn})`],
                  ['loanOut', `${t(language, 'loanedOut')} (${scopeCounts.loanOut})`],
                ] as const)
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setScopeFilter(id)}
              className={`rounded-lg px-2 py-1 min-h-[28px] text-[11px] font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                isMobileLandscape ? 'flex-1 shrink-0' : 'truncate'
              } ${
                scopeFilter === id
                  ? 'bg-[#00FF85] text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search & Sort Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="relative flex-1 min-w-[130px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === 'vi' ? 'Tìm cầu thủ / vị trí…' : 'Filter player / pos…'}
              aria-label="Filter squad players"
              className="w-full rounded-lg border border-white/12 bg-black/45 pl-8 pr-2.5 py-1 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00FF85]"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label htmlFor="squad-sort-select" className="text-[11px] text-slate-400 hidden sm:inline">
              {t(language, 'sortBy')}:
            </label>
            <select
              id="squad-sort-select"
              value={sortBy}
              onChange={(e) => {
                const next = e.target.value as SquadSortKey;
                setSortBy(next);
                setSortDir(next === 'contractExpiry' || next === 'position' ? 'asc' : 'desc');
              }}
              className="rounded-lg border border-white/15 bg-black/55 px-2 py-1 text-xs text-white cursor-pointer"
            >
              <option value="default">{t(language, 'sortDefault')}</option>
              <option value="ovr">{t(language, 'sortOvr')}</option>
              <option value="position">{t(language, 'sortPos')}</option>
              <option value="value">{t(language, 'sortValue')}</option>
              <option value="wage">{t(language, 'sortWage')}</option>
              <option value="contractExpiry">{t(language, 'sortExpiry')}</option>
            </select>

            {sortBy !== 'default' && (
              <button
                type="button"
                onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                aria-label="Toggle sort direction"
                className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 px-2 py-1 text-xs font-mono text-slate-200 cursor-pointer whitespace-nowrap"
              >
                {sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                {sortDir === 'asc' ? 'ASC' : 'DESC'}
              </button>
            )}
          </div>
        </div>

        <div
          className={
            isMobileLandscape
              ? 'flex-1 min-h-0 space-y-1 overflow-y-auto pr-1'
              : 'space-y-1.5 max-h-[580px] overflow-y-auto pr-1'
          }
        >
          {sortedPlayers.map((p) => {
            const isSel = p.id === selectedPlayer?.id;
            const isInjured = (p.injuredMatches ?? 0) > 0;
            const isSuspended = p.suspendedMatches > 0;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectPlayer(p)}
                className={`w-full flex items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-left border transition-colors cursor-pointer ${
                  isSel
                    ? 'border-[#00FF85] bg-[#00FF85]/12 shadow-[0_0_20px_-10px_rgba(0,255,133,0.6)]'
                    : isInjured || isSuspended
                    ? 'border-rose-500/45 bg-rose-950/25 hover:bg-rose-950/35'
                    : p.loanInfo?.direction === 'OUT'
                    ? 'border-amber-400/25 bg-amber-950/15 hover:bg-amber-950/25'
                    : 'border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/15'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <PlayerAvatar
                    playerId={p.id}
                    name={p.name}
                    shirtNumber={p.shirtNumber}
                    position={p.position}
                    primaryColor={club.primaryColor}
                    secondaryColor={club.secondaryColor}
                    size={42}
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                      <span className="truncate">{p.name}</span>
                      {p.loanInfo?.direction === 'IN' && (
                        <span className="rounded border border-sky-400/45 bg-sky-500/15 px-1.5 py-0.2 text-[9px] font-mono font-bold text-sky-200 shrink-0">
                          {t(language, 'loanInBadge')}
                        </span>
                      )}
                      {p.loanInfo?.direction === 'OUT' && (
                        <span className="rounded border border-amber-400/45 bg-amber-500/15 px-1.5 py-0.2 text-[9px] font-mono font-bold text-amber-200 shrink-0">
                          {t(language, 'loanOutBadge')}
                        </span>
                      )}
                      {p.forSale && <span className="text-amber-300 font-normal shrink-0">· Listed</span>}
                      {p.forLoan && <span className="text-sky-300 font-normal shrink-0">· Loan List</span>}
                      {isSuspended && (
                        <span className="text-[10px] font-mono text-rose-300 shrink-0">
                          · {t(language, 'suspended')} ({p.suspendedMatches})
                        </span>
                      )}
                      {isInjured && (
                        <span className="text-[10px] font-mono text-rose-300 shrink-0">
                          · {t(language, 'injured')} ({p.injuredMatches})
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono tabular-nums truncate flex items-center gap-1.5 mt-0.5">
                      <span className={`px-1.5 py-0.2 rounded border text-[9px] font-bold ${posBadgeClass(p.position)}`}>
                        {p.detailedPosition ?? p.position}
                      </span>
                      <span className="truncate">
                        {formatCurrency(p.marketValue)} · {formatCurrency(p.weeklyWage)}/wk · {p.contractExpiry}
                      </span>
                    </div>
                  </div>
                </div>
                <span className="font-mono text-sm font-bold text-[#00FF85] tabular-nums shrink-0 px-1.5 py-0.5 rounded bg-black/35 border border-white/[0.06]">
                  {p.ovr}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Right Concise Player Card + View Profile CTA */}
      {selectedPlayer && normalizedPlayer && (() => {
        const isLoaned = Boolean(normalizedPlayer.loanInfo);

        return (
          <section
            className={
              isMobileLandscape
                ? 'col-span-7 h-full min-h-0 overflow-y-auto pitch-panel rounded-2xl p-2.5 pb-10 space-y-2'
                : 'lg:col-span-7 pitch-panel rounded-2xl p-6 space-y-5 relative overflow-hidden'
            }
          >
            <div
              className="pointer-events-none absolute top-0 left-0 right-0 h-24 opacity-20"
              style={{
                background: `linear-gradient(180deg, ${club.primaryColor}88 0%, transparent 100%)`,
              }}
              aria-hidden="true"
            />
            <div className={`relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 ${isMobileLandscape ? 'pb-2' : 'pb-4 gap-4'}`}>
              <div className="flex items-center gap-3 min-w-0">
                <PlayerAvatar
                  playerId={normalizedPlayer.id}
                  name={normalizedPlayer.name}
                  shirtNumber={normalizedPlayer.shirtNumber}
                  position={normalizedPlayer.position}
                  primaryColor={club.primaryColor}
                  secondaryColor={club.secondaryColor}
                  size={isMobileLandscape ? 54 : 76}
                />
                <div className="min-w-0">
                  <h2 className={`font-display font-bold text-white truncate ${isMobileLandscape ? 'text-2xl' : 'text-3xl'}`}>
                    {normalizedPlayer.name}
                  </h2>
                  <div className="text-xs text-slate-300 flex flex-wrap items-center gap-2 mt-0.5">
                    <span className="font-semibold text-emerald-300">
                      {normalizedPlayer.detailedPosition ?? normalizedPlayer.position}
                      {normalizedPlayer.secondaryPositions && normalizedPlayer.secondaryPositions.length > 0
                        ? ` / ${normalizedPlayer.secondaryPositions.join(', ')}`
                        : ''}
                    </span>
                    <span>·</span>
                    <span>{normalizedPlayer.nationality}</span>
                    <span>·</span>
                    <span>Age {normalizedPlayer.age}</span>
                    <span>·</span>
                    <span>{normalizedPlayer.heightCm} cm</span>
                  </div>
                  {normalizedPlayer.loanInfo && (
                    <div className="mt-1.5 text-xs font-mono">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-semibold ${
                          normalizedPlayer.loanInfo.direction === 'IN'
                            ? 'border-sky-400/45 bg-sky-500/15 text-sky-200'
                            : 'border-amber-400/45 bg-amber-500/15 text-amber-200'
                        }`}
                      >
                        {normalizedPlayer.loanInfo.direction === 'IN'
                          ? `${t(language, 'loanInBadge')} · From ${normalizedPlayer.loanInfo.counterpartyClubName}`
                          : `${t(language, 'loanOutBadge')} · At ${normalizedPlayer.loanInfo.counterpartyClubName}`}{' '}
                        · Returns {normalizedPlayer.loanInfo.returnSeasonYear}
                      </span>
                    </div>
                  )}
                  {((normalizedPlayer.injuredMatches ?? 0) > 0 || normalizedPlayer.suspendedMatches > 0) && (
                    <div className="mt-1.5 text-xs font-mono text-rose-300">
                      {normalizedPlayer.suspendedMatches > 0 &&
                        `${t(language, 'suspended')}: ${normalizedPlayer.suspendedMatches} match(es)`}
                      {normalizedPlayer.suspendedMatches > 0 && (normalizedPlayer.injuredMatches ?? 0) > 0 && ' · '}
                      {(normalizedPlayer.injuredMatches ?? 0) > 0 &&
                        `${t(language, 'injured')}: ${normalizedPlayer.injuryNote ?? 'Knock'} (${normalizedPlayer.injuredMatches}m)`}
                    </div>
                  )}
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="font-display text-4xl font-extrabold text-[#00FF85] tabular-nums leading-none">
                  {normalizedPlayer.ovr}
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-1">
                  POT {normalizedPlayer.potential}
                </div>
              </div>
            </div>

            {/* Optional Comparison Picker */}
            {comparing && (
              <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/8 p-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-medium text-emerald-200">
                  {language === 'vi' ? 'So sánh với:' : 'Compare with:'}
                </span>
                <select
                  value={compareId ?? ''}
                  onChange={(e) => setCompareId(e.target.value)}
                  className="rounded-lg border border-white/15 bg-black/50 px-3 py-1.5 text-xs text-white"
                >
                  {club.players
                    .filter((p) => p.id !== normalizedPlayer.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.detailedPosition ?? p.position} · OVR {p.ovr})
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* Concise Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                <div className="text-slate-400">{t(language, 'marketValue')}</div>
                <div className="font-mono font-bold text-white text-sm mt-1 tabular-nums">
                  {formatCurrency(normalizedPlayer.marketValue)}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                <div className="text-slate-400">{t(language, 'weeklyWage')}</div>
                <div className="font-mono font-bold text-white text-sm mt-1 tabular-nums">
                  {formatCurrency(normalizedPlayer.weeklyWage)}/wk
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                <div className="text-slate-400">{t(language, 'contractExpiry')}</div>
                <div className="font-mono font-bold text-white text-sm mt-1 tabular-nums">
                  June {normalizedPlayer.contractExpiry}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                <div className="text-slate-400">{t(language, 'squadStatus')}</div>
                <div className="font-semibold text-white text-sm mt-1">
                  {normalizedPlayer.squadStatus}
                </div>
              </div>
            </div>

            {/* Compact 7-Stat General Strip */}
            <div className={`rounded-xl border border-white/10 bg-black/30 ${isMobileLandscape ? 'p-2.5 space-y-1.5' : 'p-4 space-y-2.5'}`}>
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>{language === 'vi' ? 'Chỉ số chung' : 'General Face Stats'}</span>
                <span>
                  {normalizedPlayer.appearances} Apps · {normalizedPlayer.goals}G · {normalizedPlayer.assists}A
                </span>
              </div>
              <div className={isMobileLandscape ? 'grid grid-cols-7 gap-1.5' : 'grid grid-cols-4 sm:grid-cols-7 gap-2'}>
                {[
                  ['PAC', normalizedPlayer.attributes.pace, normalizedCompare?.attributes.pace],
                  ['SHO', normalizedPlayer.attributes.finishing, normalizedCompare?.attributes.finishing],
                  ['PAS', normalizedPlayer.attributes.passing, normalizedCompare?.attributes.passing],
                  ['DRI', normalizedPlayer.attributes.dribbling, normalizedCompare?.attributes.dribbling],
                  ['DEF', normalizedPlayer.attributes.defending, normalizedCompare?.attributes.defending],
                  ['PHY', normalizedPlayer.attributes.physical, normalizedCompare?.attributes.physical],
                  ['GK', normalizedPlayer.attributes.goalkeeper, normalizedCompare?.attributes.goalkeeper],
                ].map(([label, val, cmpVal]) => {
                  const num = Number(val);
                  const cmp = typeof cmpVal === 'number' ? cmpVal : undefined;
                  return (
                    <div
                      key={String(label)}
                      className={`rounded-lg border border-white/10 bg-white/4 text-center ${isMobileLandscape ? 'px-1 py-1' : 'px-2 py-2'}`}
                    >
                      <div className="text-[10px] font-mono text-slate-400">{label}</div>
                      <div className={`font-mono font-extrabold tabular-nums ${isMobileLandscape ? 'text-sm' : 'text-base'} ${statTextColor(num)}`}>
                        {num}
                      </div>
                      {cmp !== undefined && (
                        <div className="text-[10px] font-mono">{renderDelta(num, cmp)}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Primary Profile CTA */}
            <div className={`flex flex-wrap items-center pt-1 ${isMobileLandscape ? 'gap-1.5 pr-10' : 'gap-3'}`}>
              <button
                type="button"
                onClick={() => setShowProfileModal(true)}
                className={`inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 hover:bg-white/18 text-white font-semibold text-xs cursor-pointer whitespace-nowrap ${
                  isMobileLandscape ? 'px-2.5 py-1.5' : 'px-4 py-2.5 gap-2'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 text-[#00FF85]" />
                {t(language, 'viewProfile')}
              </button>

              {!isLoaned && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowNegotiation(true)}
                    className={`rounded-lg bg-[#00FF85] hover:bg-emerald-300 text-slate-950 font-bold text-xs cursor-pointer whitespace-nowrap ${
                      isMobileLandscape ? 'px-2.5 py-1.5' : 'px-4 py-2.5'
                    }`}
                  >
                    {t(language, 'negotiateRenewal')}
                  </button>

                  <button
                    type="button"
                    onClick={() => onToggleForSale(selectedPlayer.id)}
                    className={`rounded-lg border font-semibold text-xs cursor-pointer whitespace-nowrap ${
                      isMobileLandscape ? 'px-2.5 py-1.5' : 'px-4 py-2.5'
                    } ${
                      selectedPlayer.forSale
                        ? 'border-amber-400/50 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25'
                        : 'border-white/20 bg-white/8 hover:bg-white/15 text-white'
                    }`}
                  >
                    {selectedPlayer.forSale
                      ? language === 'vi'
                        ? 'Gỡ khỏi danh sách bán'
                        : 'Remove From Transfer List'
                      : t(language, 'sellInviteBids')}
                  </button>

                  <button
                    type="button"
                    onClick={() => onToggleForLoan(selectedPlayer.id)}
                    className={`rounded-lg border font-semibold text-xs cursor-pointer whitespace-nowrap ${
                      isMobileLandscape ? 'px-2.5 py-1.5' : 'px-4 py-2.5'
                    } ${
                      selectedPlayer.forLoan
                        ? 'border-sky-400/50 bg-sky-500/15 text-sky-200 hover:bg-sky-500/25'
                        : 'border-white/20 bg-white/8 hover:bg-white/15 text-white'
                    }`}
                  >
                    {selectedPlayer.forLoan
                      ? language === 'vi'
                        ? 'Gỡ khỏi danh sách cho mượn'
                        : 'Remove From Loan List'
                      : t(language, 'inviteLoanBids')}
                  </button>

                  <button
                    type="button"
                    disabled={club.players.length <= 13}
                    onClick={() => onReleasePlayer(selectedPlayer.id)}
                    className={`rounded-lg bg-rose-600/85 hover:bg-rose-500 disabled:opacity-40 text-white font-semibold text-xs cursor-pointer whitespace-nowrap ${
                      isMobileLandscape ? 'px-2.5 py-1.5' : 'px-4 py-2.5'
                    }`}
                  >
                    {t(language, 'releasePlayer')}
                  </button>
                </>
              )}
              {isLoaned && (
                <div className="flex flex-wrap items-center gap-3">
                  {normalizedPlayer.loanInfo?.direction === 'IN' &&
                    (normalizedPlayer.loanInfo.buyOptionFee ?? 0) > 0 &&
                    onExerciseBuyOption && (
                      <button
                        type="button"
                        disabled={availableBudget < (normalizedPlayer.loanInfo.buyOptionFee ?? 0)}
                        onClick={() => onExerciseBuyOption(normalizedPlayer.id)}
                        className="rounded-lg bg-[#00FF85] hover:bg-emerald-300 disabled:opacity-45 disabled:cursor-not-allowed text-slate-950 font-bold text-xs px-4 py-2 cursor-pointer whitespace-nowrap"
                      >
                        {t(language, 'buyClause')} ({formatCurrency(normalizedPlayer.loanInfo.buyOptionFee ?? 0)})
                      </button>
                    )}
                  <span className="text-xs text-slate-400">
                    {language === 'vi'
                      ? 'Cầu thủ mượn tự động trở về CLB chủ quản vào cuối thời hạn mượn.'
                      : 'Loaned players automatically return to their parent club at the end of the loan term.'}
                  </span>
                </div>
              )}
            </div>

            {/* Shirt Number Control */}
            <div className="flex flex-wrap items-end gap-3 pt-3 border-t border-white/10">
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  {t(language, 'changeShirtNumber')}
                </label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={shirtInput}
                  onChange={(e) => setShirtInput(Number(e.target.value))}
                  className="w-24 rounded-lg border border-white/15 bg-black/45 px-3 py-1.5 text-sm font-mono text-white"
                />
              </div>
              <button
                type="button"
                onClick={handleShirtSave}
                className="rounded-lg border border-white/20 bg-white/10 hover:bg-white/15 px-3.5 py-1.5 text-xs font-semibold text-white cursor-pointer"
              >
                {language === 'vi' ? 'Lưu số áo' : 'Save Number'}
              </button>
              {shirtMsg && <span className="text-xs text-emerald-300">{shirtMsg}</span>}
            </div>
          </section>
        );
      })()}

      {showProfileModal && normalizedPlayer && (
        <PlayerProfileModal
          player={normalizedPlayer}
          club={club}
          language={language}
          isScouted
          compareTo={normalizedCompare}
          canAffordBuyOption={
            normalizedPlayer.loanInfo?.direction === 'IN' &&
            (normalizedPlayer.loanInfo.buyOptionFee ?? 0) > 0
              ? availableBudget >= (normalizedPlayer.loanInfo.buyOptionFee ?? 0)
              : false
          }
          onExerciseBuyOption={
            onExerciseBuyOption &&
            normalizedPlayer.loanInfo?.direction === 'IN' &&
            (normalizedPlayer.loanInfo.buyOptionFee ?? 0) > 0
              ? () => onExerciseBuyOption(normalizedPlayer.id)
              : undefined
          }
          onClose={() => setShowProfileModal(false)}
        />
      )}

      {showNegotiation && selectedPlayer && (
        <ContractNegotiationModal
          player={selectedPlayer}
          availableBudget={availableBudget}
          language={language}
          onClose={() => setShowNegotiation(false)}
          onSigned={(offer, cost) => {
            onSignContractRenewal(selectedPlayer.id, offer, cost);
            setShowNegotiation(false);
          }}
        />
      )}
    </div>
  );
};
