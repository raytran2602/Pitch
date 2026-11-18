import React, { useEffect, useMemo, useState } from 'react';
import { ModalPortal } from './ModalPortal';
import { Calendar as CalendarIcon, Dumbbell, FastForward, HeartPulse, ShieldCheck, Trophy, X } from 'lucide-react';
import { getCountryForLeague } from '../data/competitions';
import { COMPETITION_THEMES } from '../data/premierLeague2627';
import { getTransferWindowStatusForDate, resolveClubForMatch } from '../engine/gameLogic';
import { CalendarDay, CareerState, Club, CompetitionId, Fixture } from '../types/game';
import { t } from '../utils/i18n';
import { useIsMobileLandscape } from '../utils/useMobileLandscape';
import { ClubBadge } from './ClubBadge';
import { MatchReportPanel } from './MatchReportPanel';

interface TeamCalendarViewProps {
  state: CareerState;
  userClub: Club;
  onSkipToDate?: (targetDateIso: string) => void;
}

interface SeasonMonth {
  key: string; // YYYY-MM
  year: number;
  monthIndex: number; // 0-based
  shortLabel: string;
  viLabel: string;
  fullLabel: string;
}

function buildSeasonMonths(seasonStartYear: number): SeasonMonth[] {
  const nextYear = seasonStartYear + 1;
  return [
    { key: `${seasonStartYear}-07`, year: seasonStartYear, monthIndex: 6, shortLabel: 'Jul', viLabel: 'Th7', fullLabel: 'July' },
    { key: `${seasonStartYear}-08`, year: seasonStartYear, monthIndex: 7, shortLabel: 'Aug', viLabel: 'Th8', fullLabel: 'August' },
    { key: `${seasonStartYear}-09`, year: seasonStartYear, monthIndex: 8, shortLabel: 'Sep', viLabel: 'Th9', fullLabel: 'September' },
    { key: `${seasonStartYear}-10`, year: seasonStartYear, monthIndex: 9, shortLabel: 'Oct', viLabel: 'Th10', fullLabel: 'October' },
    { key: `${seasonStartYear}-11`, year: seasonStartYear, monthIndex: 10, shortLabel: 'Nov', viLabel: 'Th11', fullLabel: 'November' },
    { key: `${seasonStartYear}-12`, year: seasonStartYear, monthIndex: 11, shortLabel: 'Dec', viLabel: 'Th12', fullLabel: 'December' },
    { key: `${nextYear}-01`, year: nextYear, monthIndex: 0, shortLabel: 'Jan', viLabel: 'Th1', fullLabel: 'January' },
    { key: `${nextYear}-02`, year: nextYear, monthIndex: 1, shortLabel: 'Feb', viLabel: 'Th2', fullLabel: 'February' },
    { key: `${nextYear}-03`, year: nextYear, monthIndex: 2, shortLabel: 'Mar', viLabel: 'Th3', fullLabel: 'March' },
    { key: `${nextYear}-04`, year: nextYear, monthIndex: 3, shortLabel: 'Apr', viLabel: 'Th4', fullLabel: 'April' },
    { key: `${nextYear}-05`, year: nextYear, monthIndex: 4, shortLabel: 'May', viLabel: 'Th5', fullLabel: 'May' },
  ];
}

function formatDateHeading(dateIso: string): { weekdayMonthDay: string; year: string } {
  const dt = new Date(`${dateIso}T12:00:00Z`);
  const weekday = dt.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }).toUpperCase();
  const month = dt.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase();
  const day = dt.getUTCDate();
  const year = String(dt.getUTCFullYear());
  return {
    weekdayMonthDay: `${weekday}, ${month} ${day}`,
    year,
  };
}

function diffDays(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T12:00:00Z`).getTime();
  const b = new Date(`${toIso}T12:00:00Z`).getTime();
  return Math.max(0, Math.round((b - a) / 86400_000));
}

function addDaysIso(dateIso: string, delta: number): string {
  const dt = new Date(`${dateIso}T12:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function getTransferWindowInfo(
  dateIso: string,
  lang: 'en' | 'vi',
  deadlineHoursRemaining: number | null | undefined,
  seasonStartYear: number
) {
  const win = getTransferWindowStatusForDate(dateIso, seasonStartYear);
  if (win.isDeadlineDay) {
    const hrs = deadlineHoursRemaining ?? 24;
    return {
      isOpen: true,
      isDeadlineDay: true,
      title: lang === 'vi' ? 'Ngày chót chuyển nhượng' : 'Transfer Deadline Day',
      headline: `${hrs}h`,
      subtext: lang === 'vi' ? 'Giờ còn lại hôm nay' : 'Hours Left Today',
    };
  }
  if (win.isOpen && win.windowType === 'SUMMER') {
    const daysLeft = Math.max(1, diffDays(dateIso, win.summerEndIso));
    return {
      isOpen: true,
      isDeadlineDay: false,
      title: lang === 'vi' ? 'Thị trường chuyển nhượng hè đang mở' : 'Summer Window Opened',
      headline: lang === 'vi' ? `${daysLeft} Ngày` : `${daysLeft} Days`,
      subtext: lang === 'vi' ? 'Đến Deadline Day' : 'Until Deadline Day',
    };
  }
  if (dateIso < win.winterStartIso) {
    const daysToJan = diffDays(dateIso, win.winterStartIso);
    return {
      isOpen: false,
      isDeadlineDay: false,
      title: lang === 'vi' ? 'Thị trường chuyển nhượng đóng' : 'Transfer Window Closed',
      headline: lang === 'vi' ? `${daysToJan} Ngày` : `${daysToJan} Days`,
      subtext: lang === 'vi' ? 'Tới kỳ chuyển nhượng mùa đông' : 'Until Winter Window',
    };
  }
  if (win.isOpen && win.windowType === 'WINTER') {
    const daysLeft = Math.max(1, diffDays(dateIso, win.winterEndIso));
    return {
      isOpen: true,
      isDeadlineDay: false,
      title: lang === 'vi' ? 'Kỳ mùa đông đang mở' : 'Winter Window Opened',
      headline: lang === 'vi' ? `${daysLeft} Ngày` : `${daysLeft} Days`,
      subtext: lang === 'vi' ? 'Đến Deadline Day' : 'Until Deadline Day',
    };
  }
  const daysToEnd = diffDays(dateIso, `${seasonStartYear + 1}-05-16`);
  return {
    isOpen: false,
    isDeadlineDay: false,
    title: lang === 'vi' ? 'Giai đoạn nước rút' : 'Transfer Window Closed',
    headline: lang === 'vi' ? `${daysToEnd} Ngày` : `${daysToEnd} Days`,
    subtext: lang === 'vi' ? 'Đến cuối mùa giải' : 'Until End of Season',
  };
}

function buildMonthGridCells(year: number, monthIndex: number): {
  dateIso: string;
  dayNum: number;
  inMonth: boolean;
}[] {
  const firstDay = new Date(Date.UTC(year, monthIndex, 1, 12, 0, 0));
  // Convert Sunday=0..Saturday=6 into Monday=0..Sunday=6
  const startOffset = (firstDay.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0, 12, 0, 0)).getUTCDate();
  const totalCells = startOffset + daysInMonth > 35 ? 42 : 35;

  const cells: { dateIso: string; dayNum: number; inMonth: boolean }[] = [];
  for (let i = 0; i < totalCells; i++) {
    const dt = new Date(Date.UTC(year, monthIndex, 1 - startOffset + i, 12, 0, 0));
    cells.push({
      dateIso: dt.toISOString().slice(0, 10),
      dayNum: dt.getUTCDate(),
      inMonth: dt.getUTCMonth() === monthIndex,
    });
  }
  return cells;
}

function compShortTag(compId: CompetitionId): string {
  if (compId === 'CARABAO') return 'EFL CUP';
  if (compId === 'FACUP') return 'FA CUP';
  if (compId === 'SHIELD') return 'SHIELD';
  return COMPETITION_THEMES[compId]?.shortName ?? compId;
}

function upcomingMatchTileStyle(compId: CompetitionId, isHome: boolean): string {
  if (compId === 'UEFASUPERCUP') {
    return isHome
      ? 'bg-gradient-to-br from-[#133A75] to-[#081B38] border-sky-300/80 text-white hover:brightness-110'
      : 'bg-gradient-to-br from-[#0C264D] to-[#050F24] border-sky-300/45 text-white hover:brightness-110';
  }
  if (compId === 'SUPERCOPA') {
    return isHome
      ? 'bg-gradient-to-br from-[#66310C] to-[#3B1A05] border-amber-300/80 text-white hover:brightness-110'
      : 'bg-gradient-to-br from-[#422008] to-[#241003] border-amber-300/45 text-white hover:brightness-110';
  }
  if (compId === 'UCL') {
    return isHome
      ? 'bg-gradient-to-br from-[#0B2A6B] to-[#061840] border-blue-400/75 text-white hover:brightness-110'
      : 'bg-gradient-to-br from-[#071B47] to-[#040E29] border-blue-300/40 text-white hover:brightness-110';
  }
  if (compId === 'UEL') {
    return isHome
      ? 'bg-gradient-to-br from-[#6B2A08] to-[#401804] border-orange-400/75 text-white hover:brightness-110'
      : 'bg-gradient-to-br from-[#471C06] to-[#290F03] border-orange-300/40 text-white hover:brightness-110';
  }
  if (compId === 'UECL') {
    return isHome
      ? 'bg-gradient-to-br from-[#0B522D] to-[#06331B] border-emerald-400/75 text-white hover:brightness-110'
      : 'bg-gradient-to-br from-[#07381F] to-[#042112] border-emerald-300/40 text-white hover:brightness-110';
  }
  if (compId === 'PL') {
    return isHome
      ? 'bg-gradient-to-br from-[#520C63] to-[#340640] border-[#00FF85]/70 text-white hover:brightness-110'
      : 'bg-gradient-to-br from-[#2B0C38] to-[#1A0724] border-fuchsia-300/35 text-white hover:brightness-110';
  }
  if (compId === 'CHAMP') {
    return isHome
      ? 'bg-gradient-to-br from-[#12357A] to-[#0B1E45] border-amber-400/70 text-white hover:brightness-110'
      : 'bg-gradient-to-br from-[#0B1E45] to-[#060E22] border-sky-300/35 text-white hover:brightness-110';
  }
  if (compId === 'L1') {
    return isHome
      ? 'bg-gradient-to-br from-[#2B2F73] to-[#191B42] border-sky-400/70 text-white hover:brightness-110'
      : 'bg-gradient-to-br from-[#191B42] to-[#0B0C1F] border-indigo-300/35 text-white hover:brightness-110';
  }
  if (compId === 'L2') {
    return isHome
      ? 'bg-gradient-to-br from-[#184B3E] to-[#102B24] border-emerald-400/70 text-white hover:brightness-110'
      : 'bg-gradient-to-br from-[#102B24] to-[#071310] border-emerald-300/35 text-white hover:brightness-110';
  }
  if (compId === 'CARABAO') {
    return isHome
      ? 'bg-gradient-to-br from-[#0F8A79] to-[#08544A] border-[#00FF85]/65 text-white hover:brightness-110'
      : 'bg-gradient-to-br from-[#0B5A4F] to-[#063831] border-teal-300/35 text-white hover:brightness-110';
  }
  const cupCountry = getCountryForLeague(compId);
  if (compId === cupCountry.primaryCupId || compId === 'FACUP') {
    return isHome
      ? 'bg-gradient-to-br from-[#A61B54] to-[#6E1036] border-[#00FF85]/65 text-white hover:brightness-110'
      : 'bg-gradient-to-br from-[#70123A] to-[#4A0A25] border-rose-300/35 text-white hover:brightness-110';
  }
  return isHome
    ? 'bg-gradient-to-br from-slate-700 to-slate-900 border-[#00FF85]/65 text-white hover:brightness-110'
    : 'bg-gradient-to-br from-slate-800 to-slate-950 border-white/25 text-white hover:brightness-110';
}

export const TeamCalendarView: React.FC<TeamCalendarViewProps> = ({ state, userClub, onSkipToDate }) => {
  const lang = state.settings.language;
  const isMobileLandscape = useIsMobileLandscape();
  const userLeagueId = state.userLeagueId ?? 'PL';
  const userLeagueTheme = COMPETITION_THEMES[userLeagueId];
  const seasonStartYear = 2026 + (state.seasonIndex ?? 0);
  const seasonMonths = useMemo(() => buildSeasonMonths(seasonStartYear), [seasonStartYear]);
  const currentDay = state.calendar[state.currentDayIndex];
  const currentDateIso = currentDay?.dateIso ?? `${seasonStartYear}-07-01`;
  const currentMonthKey = currentDateIso.slice(0, 7);

  const maxSeasonIso = state.calendar[state.calendar.length - 1]?.dateIso ?? `${seasonStartYear + 1}-05-24`;
  const tomorrowIso = currentDateIso < maxSeasonIso ? addDaysIso(currentDateIso, 1) : maxSeasonIso;
  const isSkipBlocked = Boolean(state.pendingSeasonSummary || state.managerContract?.status === 'SACKED');

  const initialMonth =
    seasonMonths.find((m) => m.key === currentMonthKey)?.key ?? seasonMonths[0].key;
  const [activeMonthKey, setActiveMonthKey] = useState<string>(initialMonth);
  const [selectedDateIso, setSelectedDateIso] = useState<string>(currentDateIso);
  const [skipDateInput, setSkipDateInput] = useState<string>(tomorrowIso);
  const [modalFixture, setModalFixture] = useState<Fixture | null>(null);

  useEffect(() => {
    const mKey = currentDateIso.slice(0, 7);
    if (seasonMonths.some((m) => m.key === mKey)) {
      setActiveMonthKey(mKey);
    }
    setSelectedDateIso(currentDateIso);
    setSkipDateInput((prev) => (!prev || prev <= currentDateIso || prev > maxSeasonIso ? tomorrowIso : prev));
  }, [currentDateIso, maxSeasonIso, tomorrowIso, seasonMonths]);

  const activeMonth = useMemo(
    () => seasonMonths.find((m) => m.key === activeMonthKey) ?? seasonMonths[0],
    [seasonMonths, activeMonthKey]
  );

  // Index all user fixtures across league + domestic cups + UEFA
  const userFixturesByDate = useMemo(() => {
    const map = new Map<string, Fixture>();
    const all = [
      ...state.fixtures,
      ...Object.values(state.contextFixtures).flat(),
    ];
    for (const f of all) {
      if (f && (f.homeClubId === userClub.id || f.awayClubId === userClub.id)) {
        map.set(f.dateIso, f);
      }
    }
    return map;
  }, [state.fixtures, state.contextFixtures, userClub.id]);

  // Index training/recovery/matchday calendar entries
  const calendarDayByDate = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    for (const d of state.calendar) {
      map.set(d.dateIso, d);
    }
    return map;
  }, [state.calendar]);

  const gridCells = useMemo(
    () => buildMonthGridCells(activeMonth.year, activeMonth.monthIndex),
    [activeMonth]
  );

  const selectedFixture = userFixturesByDate.get(selectedDateIso) ?? null;
  const selectedCalDay = calendarDayByDate.get(selectedDateIso) ?? null;
  const leftDateInfo = formatDateHeading(selectedDateIso);
  const transferWindow = getTransferWindowInfo(
    currentDateIso,
    lang,
    state.deadlineHoursRemaining,
    seasonStartYear
  );

  const activeCompetitionLabel = selectedFixture
    ? COMPETITION_THEMES[selectedFixture.competitionId].name.toUpperCase()
    : userLeagueTheme.name.toUpperCase();

  const getMatchOutcome = (f: Fixture): { code: 'W' | 'D' | 'L'; scoreText: string } => {
    const isHome = f.homeClubId === userClub.id;
    const myGoals = isHome ? f.homeGoals ?? 0 : f.awayGoals ?? 0;
    const oppGoals = isHome ? f.awayGoals ?? 0 : f.homeGoals ?? 0;
    let code: 'W' | 'D' | 'L' =
      myGoals > oppGoals ? 'W' : myGoals < oppGoals ? 'L' : 'D';
    if (myGoals === oppGoals && f.penaltiesWinnerId) {
      code = f.penaltiesWinnerId === userClub.id ? 'W' : 'L';
    }
    return {
      code,
      scoreText: `${f.homeGoals ?? 0}-${f.awayGoals ?? 0}`,
    };
  };

  const weekdayHeaders =
    lang === 'vi'
      ? ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
      : ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

  const handleJumpToday = () => {
    const m = seasonMonths.find((item) => item.key === currentMonthKey) ?? seasonMonths[0];
    setActiveMonthKey(m.key);
    setSelectedDateIso(currentDateIso);
    setSkipDateInput(currentDateIso);
  };

  const normalizedSkipTarget =
    skipDateInput && skipDateInput > currentDateIso
      ? skipDateInput > maxSeasonIso
        ? maxSeasonIso
        : skipDateInput
      : '';
  const canSkipToInput = Boolean(onSkipToDate && !isSkipBlocked && normalizedSkipTarget);
  const canSkipToSelected = Boolean(
    onSkipToDate && !isSkipBlocked && selectedDateIso > currentDateIso && selectedDateIso <= maxSeasonIso
  );

  const handleSkip = (targetIso: string) => {
    if (!onSkipToDate || isSkipBlocked || targetIso <= currentDateIso) return;
    const clamped = targetIso > maxSeasonIso ? maxSeasonIso : targetIso;
    onSkipToDate(clamped);
  };

  const modalHomeClub = modalFixture
    ? resolveClubForMatch(state.clubs, modalFixture.homeClubId)
    : null;
  const modalAwayClub = modalFixture
    ? resolveClubForMatch(state.clubs, modalFixture.awayClubId)
    : null;

  return (
    <div className={isMobileLandscape ? 'h-full min-h-0 flex flex-col gap-2 overflow-hidden' : 'space-y-5'}>
      {/* Top Month Navigation Bar (inspired by EA FC Calendar) */}
      <div
        className={`shrink-0 pitch-panel rounded-2xl flex flex-wrap items-center justify-between ${
          isMobileLandscape ? 'px-3 py-1.5 gap-2' : 'px-4 py-3 gap-3'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`flex items-center gap-2 text-white font-display font-bold tracking-wide shrink-0 ${
              isMobileLandscape ? 'text-lg' : 'text-xl'
            }`}
          >
            <CalendarIcon className="w-4 h-4 text-[#00FF85]" />
            <span>{lang === 'vi' ? 'Lịch trình đội bóng' : 'Calendar'}</span>
          </div>
          <span className="h-4 w-px bg-white/15 hidden sm:inline-block" />
          <div className="flex items-center gap-1 overflow-x-auto py-0.5 no-scrollbar">
            {seasonMonths.map((m) => {
              const active = m.key === activeMonthKey;
              const isCurrentMonth = m.key === currentMonthKey;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setActiveMonthKey(m.key)}
                  className={`relative px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-white text-slate-950'
                      : isCurrentMonth
                      ? 'text-[#00FF85] hover:bg-white/8'
                      : 'text-slate-300 hover:text-white hover:bg-white/6'
                  }`}
                >
                  {lang === 'vi' ? m.viLabel : m.shortLabel}
                  {isCurrentMonth && !active && (
                    <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-[#00FF85] align-middle" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onSkipToDate && (
            <div className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/45 px-2 py-1">
              <input
                type="date"
                aria-label={t(lang, 'skipToDate')}
                min={tomorrowIso <= maxSeasonIso ? tomorrowIso : currentDateIso}
                max={maxSeasonIso}
                value={skipDateInput}
                disabled={isSkipBlocked}
                onChange={(e) => setSkipDateInput(e.target.value)}
                className="bg-transparent text-xs font-mono text-white focus:outline-none disabled:opacity-45"
              />
              <button
                type="button"
                disabled={!canSkipToInput}
                onClick={() => normalizedSkipTarget && handleSkip(normalizedSkipTarget)}
                className="inline-flex items-center gap-1 rounded bg-[#00FF85] hover:bg-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold text-[11px] px-2.5 py-1 cursor-pointer whitespace-nowrap"
              >
                <FastForward className="w-3 h-3" />
                {t(lang, 'skipToDate')}
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleJumpToday}
            className="rounded-lg border border-white/20 bg-white/8 hover:bg-white/15 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
          >
            {lang === 'vi' ? 'Hôm nay' : 'Today'} · {currentDateIso}
          </button>
        </div>
      </div>

      {/* Main Two-Column Calendar Board */}
      <div
        className={
          isMobileLandscape
            ? 'flex-1 min-h-0 overflow-hidden grid grid-cols-12 gap-2 items-stretch'
            : 'grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch'
        }
      >
        {/* Left Context Column (Club Crest, Selected Date, Transfer Window Countdown, Day Focus) */}
        <aside
          className={`${
            isMobileLandscape
              ? 'col-span-3 h-full min-h-0 overflow-y-auto p-3 gap-2.5'
              : 'lg:col-span-3 p-5 gap-5'
          } pitch-panel rounded-2xl relative overflow-hidden flex flex-col justify-between`}
        >
          <div className={`text-center ${isMobileLandscape ? 'space-y-2' : 'space-y-4'}`}>
            <div>
              <div className="font-display text-lg font-extrabold tracking-wide text-white">
                {leftDateInfo.weekdayMonthDay}
              </div>
              <div className="font-mono text-xs text-slate-400 mt-0.5">{leftDateInfo.year}</div>
              <div className="font-display text-sm font-bold tracking-widest text-slate-200 mt-2">
                {activeCompetitionLabel}
              </div>
            </div>

            <div className="flex flex-col items-center py-2">
              <ClubBadge
                clubId={userClub.id}
                name={userClub.name}
                shortName={userClub.shortName}
                primaryColor={userClub.primaryColor}
                secondaryColor={userClub.secondaryColor}
                pattern={userClub.pattern}
                size={isMobileLandscape ? 52 : 88}
              />
              <div
                className={`font-display font-bold text-white ${
                  isMobileLandscape ? 'text-lg mt-1.5' : 'text-2xl mt-3'
                }`}
              >
                {userClub.name}
              </div>
            </div>

            <div className="pt-3 border-t border-white/10 space-y-1">
              <div
                className={`text-xs font-semibold ${
                  transferWindow.isDeadlineDay
                    ? 'text-amber-300'
                    : transferWindow.isOpen
                    ? 'text-[#00FF85]'
                    : 'text-slate-400'
                }`}
              >
                {transferWindow.title}
              </div>
              <div
                className={`font-display font-extrabold text-white tabular-nums leading-tight ${
                  isMobileLandscape ? 'text-2xl' : 'text-3xl'
                }`}
              >
                {transferWindow.headline}
              </div>
              <div className="text-[11px] text-slate-400">{transferWindow.subtext}</div>
            </div>
          </div>

          {/* Selected Day Focus Box */}
          <div className={`rounded-xl border border-white/12 bg-black/45 ${isMobileLandscape ? 'p-2.5 space-y-2' : 'p-4 space-y-3'} text-xs`}>
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>{lang === 'vi' ? 'CHI TIẾT NGÀY' : 'DAY SCHEDULE'}</span>
              <span>{selectedDateIso}</span>
            </div>

            {selectedFixture ? (
              (() => {
                const isHome = selectedFixture.homeClubId === userClub.id;
                const oppId = isHome ? selectedFixture.awayClubId : selectedFixture.homeClubId;
                const oppClub = resolveClubForMatch(state.clubs, oppId);
                const compTheme = COMPETITION_THEMES[selectedFixture.competitionId];
                const outcome = selectedFixture.played ? getMatchOutcome(selectedFixture) : null;

                return (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5">
                      <ClubBadge
                        clubId={oppClub.id}
                        name={oppClub.name}
                        shortName={oppClub.shortName}
                        primaryColor={oppClub.primaryColor}
                        secondaryColor={oppClub.secondaryColor}
                        pattern={oppClub.pattern}
                        size={36}
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-white truncate">
                          {isHome ? 'vs ' : '@ '}
                          {oppClub.name}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {compTheme.name} · {selectedFixture.stageLabel ?? `Round ${selectedFixture.round}`} ·{' '}
                          {isHome ? (lang === 'vi' ? 'Sân nhà' : 'Home') : lang === 'vi' ? 'Sân khách' : 'Away'}
                        </div>
                      </div>
                    </div>

                    {selectedFixture.played && outcome ? (
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-5 h-5 rounded-full font-mono text-[11px] font-bold flex items-center justify-center ${
                              outcome.code === 'W'
                                ? 'bg-emerald-500/25 text-emerald-300'
                                : outcome.code === 'D'
                                ? 'bg-slate-500/35 text-slate-200'
                                : 'bg-rose-500/25 text-rose-300'
                            }`}
                          >
                            {outcome.code}
                          </span>
                          <span className="font-mono text-base font-extrabold text-white tabular-nums">
                            {selectedFixture.homeGoals} - {selectedFixture.awayGoals}
                          </span>
                        </div>
                        {selectedFixture.report && (
                          <button
                            type="button"
                            onClick={() => setModalFixture(selectedFixture)}
                            className="rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold px-2.5 py-1.5 cursor-pointer"
                          >
                            {lang === 'vi' ? 'Xem báo cáo' : 'Match Report'}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="text-[11px] text-emerald-300 font-medium pt-1 border-t border-white/10">
                        {selectedDateIso === currentDateIso
                          ? lang === 'vi'
                            ? 'Trận đấu hôm nay — Vào mục Ngày đấu để thi đấu'
                            : 'Matchday today — Head to Matchday to play'
                          : lang === 'vi'
                          ? 'Trận đấu sắp tới trong lịch trình'
                          : 'Upcoming fixture scheduled'}
                      </div>
                    )}
                  </div>
                );
              })()
            ) : selectedCalDay?.type === 'TRAINING' ? (
              <div className="flex items-center gap-2.5 text-slate-200">
                <Dumbbell className="w-4 h-4 text-sky-400 shrink-0" />
                <div>
                  <div className="font-semibold text-white">
                    {lang === 'vi' ? 'Ngày tập luyện' : 'Training Session'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {lang === 'vi'
                      ? 'Phát triển cầu thủ trẻ & bài tập chiến thuật'
                      : 'Tactical drills & youth academy progression'}
                  </div>
                </div>
              </div>
            ) : selectedCalDay?.type === 'RECOVERY' ? (
              <div className="flex items-center gap-2.5 text-slate-200">
                <HeartPulse className="w-4 h-4 text-[#00FF85] shrink-0" />
                <div>
                  <div className="font-semibold text-white">
                    {lang === 'vi' ? 'Ngày hồi phục' : 'Recovery Day'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {lang === 'vi'
                      ? 'Hồi phục thể lực toàn đội (+10% Fitness)'
                      : 'Squad fitness regeneration (+10% Fitness)'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-slate-400">
                {lang === 'vi'
                  ? 'Không có sự kiện hoặc trận đấu cố định trong ngày này.'
                  : 'Rest day — No scheduled club event.'}
              </div>
            )}

            {canSkipToSelected && (
              <div className="pt-2.5 border-t border-white/10 space-y-1.5">
                <button
                  type="button"
                  onClick={() => handleSkip(selectedDateIso)}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#00FF85] hover:bg-emerald-300 text-slate-950 font-bold text-xs px-3 py-2 cursor-pointer"
                >
                  <FastForward className="w-3.5 h-3.5" />
                  {t(lang, 'skipToDate')} · {selectedDateIso}
                </button>
                <div className="text-[10px] text-slate-400 text-center">
                  {t(lang, 'skipToDateHint')}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Right 7-Column Calendar Grid */}
        <section
          className={
            isMobileLandscape
              ? 'col-span-9 h-full min-h-0 pitch-panel rounded-2xl p-2.5 flex flex-col overflow-hidden'
              : 'lg:col-span-9 pitch-panel rounded-2xl p-4 sm:p-5 flex flex-col'
          }
        >
          <div className="shrink-0 flex items-center justify-between gap-3 mb-2.5 pb-2 border-b border-white/10">
            <h2 className={`font-display font-bold text-white ${isMobileLandscape ? 'text-lg' : 'text-2xl'}`}>
              {activeMonth.fullLabel} {activeMonth.year}
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-sm border"
                  style={{
                    backgroundColor: userLeagueTheme.headerBg,
                    borderColor: userLeagueTheme.accentColor,
                  }}
                />
                {userLeagueTheme.shortName}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#9D174D]" />
                {COMPETITION_THEMES[getCountryForLeague(userLeagueId).primaryCupId].shortName}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#0B2A6B]" />
                UEFA
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                {lang === 'vi' ? 'Tập' : 'Training'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#00FF85]" />
                {lang === 'vi' ? 'Hồi phục' : 'Recovery'}
              </span>
            </div>
          </div>

          {/* Weekday Headers */}
          <div className={`shrink-0 grid grid-cols-7 ${isMobileLandscape ? 'gap-1.5 mb-1' : 'gap-2 mb-2'}`}>
            {weekdayHeaders.map((day) => (
              <div
                key={day}
                className="text-center font-mono text-[11px] font-bold tracking-wider text-slate-400 py-1"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Month Cells */}
          <div
            className={`grid grid-cols-7 flex-1 ${
              isMobileLandscape ? 'gap-1.5 min-h-0 overflow-y-auto' : 'gap-2'
            }`}
          >
            {gridCells.map((cell) => {
              const fixture = userFixturesByDate.get(cell.dateIso);
              const calDay = calendarDayByDate.get(cell.dateIso);
              const isToday = cell.dateIso === currentDateIso;
              const isSelected = cell.dateIso === selectedDateIso;

              const isHome = fixture ? fixture.homeClubId === userClub.id : false;

              const isDeadlineTile = Boolean(calDay?.isDeadlineDay);

              // Determine visual tile style
              let tileClasses =
                'border-white/8 bg-white/[0.03] text-slate-200 hover:bg-white/[0.07]';
              if (fixture && !fixture.played) {
                tileClasses = `${upcomingMatchTileStyle(fixture.competitionId, isHome)} ${
                  cell.inMonth ? '' : 'opacity-45'
                }`;
              } else if (fixture && fixture.played) {
                tileClasses = `border-white/15 bg-black/55 text-white hover:bg-white/10 ${
                  cell.inMonth ? '' : 'opacity-45'
                }`;
              } else if (!cell.inMonth) {
                tileClasses = 'border-white/5 bg-black/20 text-slate-600 hover:bg-white/[0.04]';
              } else if (isDeadlineTile) {
                tileClasses =
                  'border-amber-400/70 bg-gradient-to-br from-amber-950/60 to-emerald-950/40 text-amber-100 hover:brightness-110';
              } else if (isToday) {
                tileClasses = 'border-[#00FF85] bg-gradient-to-br from-[#38003C] to-[#1D1038] text-white';
              }
              const oppId = fixture
                ? isHome
                  ? fixture.awayClubId
                  : fixture.homeClubId
                : null;
              const oppClub = oppId ? resolveClubForMatch(state.clubs, oppId) : null;
              const outcome = fixture && fixture.played ? getMatchOutcome(fixture) : null;

              return (
                <button
                  key={cell.dateIso}
                  type="button"
                  onClick={() => {
                    setSelectedDateIso(cell.dateIso);
                    if (cell.dateIso > currentDateIso) {
                      setSkipDateInput(cell.dateIso);
                    }
                    if (fixture?.played && fixture.report) {
                      setModalFixture(fixture);
                    }
                  }}
                  className={`${
                    isMobileLandscape ? 'min-h-[50px] p-1.5' : 'min-h-[82px] sm:min-h-[92px] p-2'
                  } rounded-lg border flex flex-col justify-between text-left transition-all cursor-pointer relative ${tileClasses} ${
                    isToday ? 'ring-2 ring-[#00FF85]' : isSelected ? 'ring-1 ring-white/70' : ''
                  }`}
                >
                  {/* Top Row: Day number + Opponent Crest or Today Indicator */}
                  <div className="flex items-start justify-between gap-1 w-full">
                    <span
                      className={`font-display text-lg font-extrabold leading-none tabular-nums ${
                        !cell.inMonth
                          ? 'text-slate-600'
                          : isToday
                          ? 'text-[#00FF85]'
                          : 'text-white'
                      }`}
                    >
                      {cell.dayNum}
                    </span>

                    {fixture && oppClub && (
                      <ClubBadge
                        clubId={oppClub.id}
                        name={oppClub.name}
                        shortName={oppClub.shortName}
                        primaryColor={oppClub.primaryColor}
                        secondaryColor={oppClub.secondaryColor}
                        pattern={oppClub.pattern}
                        size={26}
                      />
                    )}
                  </div>

                  {/* Bottom Row: Match Info / Outcome / Training / Recovery */}
                  <div className="w-full mt-1">
                    {fixture ? (
                      fixture.played && outcome ? (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1">
                            <span
                              className={`w-4 h-4 rounded-full font-mono text-[9px] font-bold flex items-center justify-center shrink-0 ${
                                outcome.code === 'W'
                                  ? 'bg-emerald-500 text-slate-950'
                                  : outcome.code === 'D'
                                  ? 'bg-slate-400 text-slate-950'
                                  : 'bg-rose-500 text-white'
                              }`}
                            >
                              {outcome.code}
                            </span>
                            <span className="font-mono text-xs font-bold tabular-nums text-white">
                              {outcome.scoreText}
                            </span>
                          </div>
                          <div className="text-[9px] font-mono tracking-wider text-slate-300 truncate">
                            {compShortTag(fixture.competitionId)} · {isHome ? 'H' : 'A'}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-0.5 leading-tight">
                          <span
                            className={`inline-block rounded px-1.5 py-0.2 text-[9px] font-mono font-bold tracking-wider ${
                              isHome
                                ? 'bg-[#00FF85] text-slate-950'
                                : 'bg-black/45 border border-white/25 text-slate-100'
                            }`}
                          >
                            {isHome ? 'HOME' : 'AWAY'}
                          </span>
                          <div className="text-[9px] font-mono tracking-wider text-white/90 truncate">
                            {compShortTag(fixture.competitionId)}
                          </div>
                        </div>
                      )
                    ) : isDeadlineTile && cell.inMonth ? (
                      <div className="space-y-0.5 leading-tight">
                        <div className="text-[10px] font-mono font-bold text-amber-300">
                          DEADLINE
                        </div>
                        <div className="text-[9px] text-amber-100/80">
                          {isToday
                            ? `${state.deadlineHoursRemaining ?? 24}h left`
                            : '24h Window'}
                        </div>
                      </div>
                    ) : calDay && cell.inMonth ? (
                      <div className="flex items-center gap-1 text-[10px] font-medium text-slate-300 truncate">
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            calDay.type === 'RECOVERY' ? 'bg-[#00FF85]' : 'bg-sky-400'
                          }`}
                        />
                        <span className="truncate">
                          {calDay.type === 'RECOVERY'
                            ? lang === 'vi'
                              ? 'Hồi phục'
                              : 'Recovery'
                            : lang === 'vi'
                            ? 'Tập luyện'
                            : 'Training'}
                        </span>
                      </div>
                    ) : isToday ? (
                      <div className="text-[10px] font-mono text-[#00FF85] flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        <span>TODAY</span>
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* Match Report Modal for Completed Fixtures */}
      {modalFixture && modalFixture.report && modalHomeClub && modalAwayClub && (
        <ModalPortal>
        <div
          className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Calendar Match Report"
        >
          <div className="w-full max-w-4xl rounded-xl border border-white/15 bg-[#1B0721] p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
              <div className="flex items-center gap-3 min-w-0">
                <ClubBadge
                  clubId={modalHomeClub.id}
                  name={modalHomeClub.name}
                  shortName={modalHomeClub.shortName}
                  primaryColor={modalHomeClub.primaryColor}
                  secondaryColor={modalHomeClub.secondaryColor}
                  pattern={modalHomeClub.pattern}
                  size={36}
                />
                <div className="min-w-0">
                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-[#00FF85]" />
                    <span>
                      {COMPETITION_THEMES[modalFixture.competitionId].name} ·{' '}
                      {modalFixture.stageLabel ?? `Round ${modalFixture.round}`} · {modalFixture.dateIso}
                    </span>
                  </div>
                  <h3 className="font-display text-2xl font-bold text-white truncate">
                    {modalHomeClub.name} {modalFixture.homeGoals} - {modalFixture.awayGoals}{' '}
                    {modalAwayClub.name}
                  </h3>
                </div>
                <ClubBadge
                  clubId={modalAwayClub.id}
                  name={modalAwayClub.name}
                  shortName={modalAwayClub.shortName}
                  primaryColor={modalAwayClub.primaryColor}
                  secondaryColor={modalAwayClub.secondaryColor}
                  pattern={modalAwayClub.pattern}
                  size={36}
                />
              </div>
              <button
                type="button"
                onClick={() => setModalFixture(null)}
                aria-label="Close match report"
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <MatchReportPanel
              report={modalFixture.report}
              homeClub={modalHomeClub}
              awayClub={modalAwayClub}
              language={lang}
            />
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
};
