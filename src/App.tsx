import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  acceptIncomingTransferBid,
  advanceCalendarDay,
  advanceDeadlineHour,
  advanceToNextSeason,
  applyMatchReportAndSimulateRound,
  autoAdvanceDeadlineDay,
  buildDefaultManagerContract,
  buildInitialClubManagers,
  buildSeasonObjectivesForClub,
  completeLoanInDeal,
  createInitialCareer,
  ensureTargetClubInState,
  evaluateIncomingBidCounter,
  evaluateSeasonObjectives,
  exerciseLoanBuyOption,
  getLeagueTeamsFromState,
  getRejectionCooldownUntil,
  getScoutDurationDays,
  getTotalRoundsForLeague,
  promoteAcademyProspect,
  rejectIncomingTransferBid,
  renewManagerContract,
  skipCalendarToDate,
  switchUserClub,
} from './engine/gameLogic';
import { clearSavedCareer, loadSavedCareer as loadCareerFromIdb, saveCareerState } from './utils/careerStorage';
import { BENCH_SIZE, COMPETITION_THEMES, deriveDefaultTeamRoles } from './data/premierLeague2627';
import {
  CareerState,
  Club,
  CoachProfile,
  CompetitionId,
  ContractOffer,
  Language,
  MatchdayLineupOverride,
  MatchReport,
  NavSection,
  NotificationType,
  PlayerRole,
  TacticsConfig,
  TeamRoles,
  TransferOffer,
  TransferTarget,
} from './types/game';
import { formatCurrency, t } from './utils/i18n';
import { normalizePlayer } from './utils/playerAttributes';
import { playSound } from './utils/sound';
import { useIsMobileLandscape } from './utils/useMobileLandscape';
import { ClubBadge } from './components/ClubBadge';
import { NewCareerScreen } from './components/NewCareerScreen';
import { MatchdayView } from './components/MatchdayView';
import { TeamCalendarView } from './components/TeamCalendarView';
import { LineupTacticsView } from './components/LineupTacticsView';
import { SquadHubView } from './components/SquadHubView';
import { TransfersView } from './components/TransfersView';
import { FixturesView, StandingsView } from './components/StandingsFixturesView';
import { AcademyView, FinanceView } from './components/AcademyFinanceView';
import { MediaStudioView } from './components/MediaStudioView';
import { CustomSettingsView, SpotifyWidget } from './components/CustomAndAudio';
import { NotificationCenter } from './components/NotificationCenter';
import { IncomingBidModal } from './components/IncomingBidModal';
import { JobMarketView } from './components/JobMarketView';
import {
  ArrowLeftRight,
  Award,
  Building2,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  Landmark,
  Menu,
  Settings,
  Shield,
  Smartphone,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';

const PortraitRotateOverlay: React.FC<{ language: Language }> = ({ language }) => (
  <div
    role="alertdialog"
    aria-modal="true"
    aria-label={language === 'vi' ? 'Vui lòng xoay ngang điện thoại' : 'Please rotate your device'}
    className="portrait-lock-overlay fixed inset-0 z-[9999] bg-[#0B0F14] text-slate-100 flex-col items-center justify-center p-6 text-center select-none"
  >
    <div className="w-20 h-20 rounded-2xl border border-[#00FF85]/35 bg-[#00FF85]/10 flex items-center justify-center mb-5 shadow-lg">
      <Smartphone className="w-10 h-10 text-[#00FF85] rotate-90 transition-transform" />
    </div>
    <h2 className="font-display text-2xl font-extrabold text-white tracking-tight">
      {language === 'vi' ? 'Vui lòng xoay ngang màn hình' : 'Rotate to Landscape'}
    </h2>
    <p className="text-sm text-slate-300 max-w-xs mt-2 leading-relaxed">
      {language === 'vi'
        ? 'Trò chơi được thiết kế tối ưu cho màn hình ngang. Hãy xoay ngang điện thoại của bạn để tiếp tục chơi.'
        : 'This game is designed for landscape orientation. Please rotate your phone horizontally to play.'}
    </p>
  </div>
);

function hydrateCareerState(parsed: CareerState | null): CareerState | null {
  try {
    if (parsed && parsed.version === 2 && Array.isArray(parsed.clubs) && parsed.clubId) {
      const seasonIdx = parsed.seasonIndex ?? 0;
      const seasonStartYear = 2026 + seasonIdx;
      const userLeagueId = parsed.userLeagueId ?? 'PL';
      const curDateIso = parsed.calendar?.[parsed.currentDayIndex ?? 0]?.dateIso ?? `${seasonStartYear}-07-01`;
      const coachFullName =
        `${parsed.coach?.firstName ?? ''} ${parsed.coach?.lastName ?? ''}`.trim() ||
        parsed.coach?.nickname ||
        'Manager';
      const hydratedClubs = parsed.clubs.map((club) => {
        const players = club.players.map((p) => normalizePlayer(p));
        const isUserClub = club.id === parsed.clubId && parsed.managerContract?.status !== 'SACKED';
        return {
          ...club,
          leagueId: club.leagueId ?? 'PL',
          managerName: isUserClub ? coachFullName : club.managerName,
          players,
          slotRoles: club.slotRoles,
          teamRoles: club.teamRoles ?? deriveDefaultTeamRoles(players),
        };
      });
      const userClubObj = hydratedClubs.find((c) => c.id === parsed.clubId) ?? hydratedClubs[0];
      const leagueTeams = getLeagueTeamsFromState(parsed);

      const baseHydrated: CareerState = {
        ...parsed,
        seasonIndex: seasonIdx,
        seasonLabel: parsed.seasonLabel ?? '2026/27',
        userLeagueId,
        leagueTeams,
        careerTrophies: parsed.careerTrophies ?? [],
        pendingSeasonSummary: parsed.pendingSeasonSummary ?? null,
        seasonHistory: parsed.seasonHistory ?? [],
        notifications: parsed.notifications ?? [],
        incomingBids: parsed.incomingBids ?? [],
        matchdayOverride: parsed.matchdayOverride ?? null,
        deadlineHoursRemaining: parsed.deadlineHoursRemaining ?? null,
        managerContract:
          parsed.managerContract ??
          buildDefaultManagerContract(userLeagueId, curDateIso, seasonStartYear, userClubObj),
        clubManagers:
          parsed.clubManagers ??
          buildInitialClubManagers(
            hydratedClubs,
            leagueTeams,
            parsed.clubId,
            coachFullName,
            seasonStartYear
          ),
        settings: {
          ...parsed.settings,
          autoAdvanceStopOn: {
            TRANSFER_BID: true,
            LOAN_BID: true,
            INJURY: true,
            SUSPENSION: true,
            CONTRACT: true,
            BOARD: true,
            ...(parsed.settings?.autoAdvanceStopOn ?? {}),
          },
        },
        clubs: hydratedClubs,
      };
      const seasonObjectives =
        parsed.seasonObjectives && parsed.seasonObjectives.length > 0
          ? evaluateSeasonObjectives(baseHydrated)
          : evaluateSeasonObjectives({
              ...baseHydrated,
              seasonObjectives: buildSeasonObjectivesForClub(
                parsed.clubId,
                userLeagueId,
                leagueTeams,
                hydratedClubs,
                seasonIdx
              ),
            });
      return {
        ...baseHydrated,
        seasonObjectives,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export default function App() {
  const [onboardingLang, setOnboardingLang] = useState<Language>('en');
  const [hydratingStorage, setHydratingStorage] = useState(true);
  const [career, setCareer] = useState<CareerState | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        return createInitialCareer(
          {
            firstName: 'Alex',
            lastName: 'Mercer',
            nickname: 'Gaffer',
            nationality: 'England',
            dob: '1988-06-15',
          },
          'ars'
        );
      }
    }
    return null;
  });

  useEffect(() => {
    let active = true;
    loadCareerFromIdb()
      .then((saved) => {
        if (!active) return;
        const hydrated = hydrateCareerState(saved);
        if (hydrated) {
          setCareer((prev) => prev ?? hydrated);
          setSelectedCompetition(hydrated.userLeagueId ?? 'PL');
        }
      })
      .finally(() => {
        if (active) setHydratingStorage(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const [activeNav, setActiveNav] = useState<NavSection>('matchday');
  const [selectedCompetition, setSelectedCompetition] = useState<CompetitionId>(
    () => career?.userLeagueId ?? 'PL'
  );
  const isMobileLandscape = useIsMobileLandscape();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerHeight <= 560 && window.innerWidth > window.innerHeight : false
  );
  const [pendingMatchReport, setPendingMatchReport] = useState<MatchReport | null>(null);
  const [activeBidId, setActiveBidId] = useState<string | null>(null);

  useEffect(() => {
    setSidebarCollapsed(isMobileLandscape);
  }, [isMobileLandscape]);

  useEffect(() => {
    document.body.dataset.state = career ? 'playing' : 'title';
    if (career) {
      void saveCareerState(career);
    }
  }, [career]);

  const userClub = useMemo(() => {
    const club = career?.clubs.find((c) => c.id === career.clubId) ?? career?.clubs[0] ?? null;
    if (!club || !career || career.managerContract?.status === 'SACKED') return club;
    const coachFullName =
      `${career.coach.firstName} ${career.coach.lastName}`.trim() ||
      career.coach.nickname ||
      club.managerName;
    return club.managerName === coachFullName ? club : { ...club, managerName: coachFullName };
  }, [career]);

  const handleStartCareer = useCallback(
    (coach: CoachProfile, clubId: string, leagueId: CompetitionId = 'PL') => {
      const next = createInitialCareer(coach, clubId, leagueId);
      next.settings.language = onboardingLang;
      setCareer(next);
      setActiveNav('matchday');
      setPendingMatchReport(null);
      setActiveBidId(null);
      setSelectedCompetition(leagueId);
    },
    [onboardingLang]
  );

  const handleAdvanceDay = useCallback(() => {
    setCareer((prev) => (prev ? advanceCalendarDay(prev) : prev));
  }, []);

  const handleAdvanceDeadlineHour = useCallback(() => {
    setCareer((prev) => (prev ? advanceDeadlineHour(prev) : prev));
  }, []);

  const handleAutoAdvanceDeadlineDay = useCallback(() => {
    setCareer((prev) => (prev ? autoAdvanceDeadlineDay(prev) : prev));
  }, []);

  const handleCompleteMatch = useCallback((report: MatchReport) => {
    setCareer((prev) => (prev ? applyMatchReportAndSimulateRound(prev, report) : prev));
    setPendingMatchReport(null);
  }, []);

  const handleNavChange = useCallback(
    (nextNav: NavSection) => {
      if (activeNav === 'matchday' && nextNav !== 'matchday' && pendingMatchReport) {
        handleCompleteMatch(pendingMatchReport);
      }
      setActiveNav(nextNav);
      setMobileMenuOpen(false);
    },
    [activeNav, pendingMatchReport, handleCompleteMatch]
  );

  const handleAdvanceNextSeason = useCallback(() => {
    setCareer((prev) => {
      if (!prev) return prev;
      const next = advanceToNextSeason(prev);
      setSelectedCompetition(next.userLeagueId ?? 'PL');
      return next;
    });
  }, []);

  if (hydratingStorage && !career) {
    return (
      <div className="min-h-dvh bg-[#090C12] pitch-stadium-ambient text-slate-100 flex items-center justify-center p-6">
        <div className="pitch-panel rounded-2xl px-8 py-7 text-center space-y-3 max-w-xs w-full">
          <div className="w-10 h-10 border-2 border-[#00FF85] border-t-transparent rounded-full animate-spin mx-auto shadow-[0_0_20px_rgba(0,255,133,0.3)]" />
          <div className="font-display text-2xl font-extrabold tracking-wide text-white">PITCH</div>
          <p className="text-xs font-mono text-slate-300">Loading 2026/27 World Database...</p>
        </div>
      </div>
    );
  }

  if (!career || !userClub) {
    return (
      <>
        <PortraitRotateOverlay language={onboardingLang} />
        <NewCareerScreen
          language={onboardingLang}
          onToggleLanguage={setOnboardingLang}
          onStartCareer={handleStartCareer}
        />
      </>
    );
  }

  const lang = career.settings.language;
  const userLeagueId = career.userLeagueId ?? 'PL';
  const totalRounds = getTotalRoundsForLeague(userLeagueId);
  const currentDay = career.calendar[career.currentDayIndex];
  const isTodayMatchday = currentDay?.type === 'MATCHDAY';
  const pendingBidsCount = (career.incomingBids ?? []).filter((b) => b.status === 'PENDING').length;
  const roundProgressPct = Math.max(
    4,
    Math.min(100, Math.round((career.currentRound / Math.max(1, totalRounds)) * 100))
  );
  const activeCompTheme =
    activeNav === 'standings' || activeNav === 'fixtures'
      ? COMPETITION_THEMES[selectedCompetition]
      : COMPETITION_THEMES[userLeagueId];

  const navItems: {
    id: NavSection;
    label: string;
    icon: React.ReactNode;
    group: 'match' | 'club' | 'world';
  }[] = [
    { id: 'matchday', label: t(lang, 'navMatchday'), icon: <Shield className="w-4 h-4" />, group: 'match' },
    { id: 'calendar', label: t(lang, 'navCalendar'), icon: <Calendar className="w-4 h-4" />, group: 'match' },
    { id: 'lineup', label: t(lang, 'navLineup'), icon: <ClipboardList className="w-4 h-4" />, group: 'match' },
    { id: 'squad', label: t(lang, 'navSquad'), icon: <Users className="w-4 h-4" />, group: 'match' },
    { id: 'transfers', label: t(lang, 'navTransfers'), icon: <ArrowLeftRight className="w-4 h-4" />, group: 'club' },
    { id: 'academy', label: t(lang, 'navAcademy'), icon: <GraduationCap className="w-4 h-4" />, group: 'club' },
    { id: 'finance', label: t(lang, 'navFinance'), icon: <Landmark className="w-4 h-4" />, group: 'club' },
    { id: 'standings', label: t(lang, 'navStandings'), icon: <Trophy className="w-4 h-4" />, group: 'world' },
    { id: 'fixtures', label: t(lang, 'navFixtures'), icon: <CalendarDays className="w-4 h-4" />, group: 'world' },
    { id: 'media', label: t(lang, 'navMedia'), icon: <Award className="w-4 h-4" />, group: 'world' },
    { id: 'office', label: t(lang, 'navOffice'), icon: <Building2 className="w-4 h-4" />, group: 'world' },
    { id: 'custom', label: t(lang, 'navCustom'), icon: <Settings className="w-4 h-4" />, group: 'world' },
  ];

  const navGroupLabels: Record<'match' | 'club' | 'world', string> = {
    match: lang === 'vi' ? 'Trận đấu & Đội hình' : 'Match & Squad',
    club: lang === 'vi' ? 'Điều hành CLB' : 'Club Operations',
    world: lang === 'vi' ? 'Giải đấu & Sự nghiệp' : 'World & Career',
  };

  const updateUserClub = (updater: (club: Club) => Club) => {
    setCareer((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        clubs: prev.clubs.map((c) => (c.id === prev.clubId ? updater(c) : c)),
      };
    });
  };

  const activeBid = activeBidId
    ? (career.incomingBids ?? []).find((b) => b.id === activeBidId) ?? null
    : null;
  const activeBidPlayer = activeBid
    ? userClub.players.find((p) => p.id === activeBid.playerId) ?? null
    : null;
  const activeBidBuyer = activeBid
    ? career.clubs.find((c) => c.id === activeBid.buyingClubId) ?? null
    : null;

  const boardColorClass =
    career.managerContract?.status === 'SACKED' || career.boardSatisfaction < 30
      ? 'text-rose-400'
      : career.boardSatisfaction < 50
      ? 'text-amber-300'
      : 'text-[#00FF85]';

  const boardBarClass =
    career.managerContract?.status === 'SACKED' || career.boardSatisfaction < 30
      ? 'bg-rose-500'
      : career.boardSatisfaction < 50
      ? 'bg-amber-400'
      : 'bg-[#00FF85]';

  return (
    <div
      style={
        {
          '--pitch-header-bg': activeCompTheme.headerBg,
          '--pitch-modal-bg': activeCompTheme.modalBg,
          '--pitch-accent': activeCompTheme.accentColor,
        } as React.CSSProperties
      }
      className={`safe-area-x relative bg-gradient-to-br ${activeCompTheme.bgGradient} text-slate-100 flex ${
        isMobileLandscape ? 'h-dvh overflow-hidden flex-row' : 'min-h-dvh lg:h-dvh lg:overflow-hidden flex-col lg:flex-row'
      } transition-colors duration-300`}
    >
      {/* Subtle stadium floodlight & grid atmosphere */}
      <div className="pointer-events-none fixed inset-0 pitch-stadium-ambient opacity-80 z-0" aria-hidden="true" />

      <PortraitRotateOverlay language={lang} />

      {/* Collapsible Left Sidebar (Desktop open by default + Toggle, Mobile Landscape collapsed rail + Toggle) */}
      <aside
        className={`relative z-20 ${
          isMobileLandscape ? 'flex' : 'hidden lg:flex'
        } flex-col shrink-0 border-r border-white/[0.08] backdrop-blur-xl transition-all duration-200 ${
          isMobileLandscape
            ? `bg-[#060910]/88 ${sidebarCollapsed ? 'w-12' : 'w-44'}`
            : `bg-[#060910]/78 ${sidebarCollapsed ? 'w-[68px]' : 'w-64'}`
        }`}
      >
        <div
          className={`border-b border-white/[0.08] flex items-center shrink-0 ${
            sidebarCollapsed
              ? `flex-col gap-1.5 ${isMobileLandscape ? 'px-1 py-1.5' : 'px-2 py-3'}`
              : `justify-between gap-2 ${isMobileLandscape ? 'px-2.5 py-2' : 'px-4 py-3.5'}`
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="shrink-0 rounded-xl p-1 bg-white/[0.04] border border-white/[0.08] shadow-inner">
              <ClubBadge
                clubId={userClub.id}
                name={userClub.name}
                shortName={userClub.shortName}
                primaryColor={userClub.primaryColor}
                secondaryColor={userClub.secondaryColor}
                pattern={userClub.pattern}
                size={isMobileLandscape ? 22 : 32}
              />
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`font-display font-extrabold tracking-tight text-white leading-none ${
                      isMobileLandscape ? 'text-base' : 'text-xl'
                    }`}
                  >
                    PITCH
                  </span>
                  {!isMobileLandscape && (
                    <span className="px-1.5 py-0.5 rounded bg-white/[0.07] border border-white/10 text-[9px] font-mono font-semibold text-[#00FF85] tracking-wider uppercase leading-none">
                      {career.seasonLabel ?? '26/27'}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-300 truncate mt-0.5 font-medium">{userClub.name}</div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            title={
              sidebarCollapsed
                ? lang === 'vi'
                  ? 'Mở rộng menu'
                  : 'Expand menu'
                : lang === 'vi'
                ? 'Thu gọn menu'
                : 'Collapse menu'
            }
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`rounded-lg border border-white/12 bg-white/[0.04] text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0 flex items-center justify-center ${
              isMobileLandscape ? 'w-8 h-8' : 'p-1.5'
            }`}
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav
          aria-label="Primary Navigation"
          className={`flex-1 overflow-y-auto no-scrollbar ${
            isMobileLandscape ? 'p-1 space-y-0.5' : 'px-2.5 py-3 space-y-1'
          }`}
        >
          {navItems.map((item, idx) => {
            const active = activeNav === item.id;
            const prevGroup = idx > 0 ? navItems[idx - 1].group : null;
            const showGroupHeader = !sidebarCollapsed && !isMobileLandscape && item.group !== prevGroup;
            const showMatchPulse = item.id === 'matchday' && isTodayMatchday && !active;
            const showBidBadge = item.id === 'transfers' && pendingBidsCount > 0;

            return (
              <React.Fragment key={item.id}>
                {showGroupHeader && (
                  <div className={`px-3 text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-500 ${idx > 0 ? 'pt-3 pb-1' : 'pb-1'}`}>
                    {navGroupLabels[item.group]}
                  </div>
                )}
                <button
                  type="button"
                  title={item.label}
                  aria-label={item.label}
                  onClick={() => {
                    playSound('tab', career.settings.soundEnabled);
                    handleNavChange(item.id);
                    if (isMobileLandscape && !sidebarCollapsed) setSidebarCollapsed(true);
                  }}
                  className={`relative w-full flex items-center rounded-lg font-medium transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                    sidebarCollapsed
                      ? `justify-center px-0 ${isMobileLandscape ? 'min-h-[32px] py-1.5' : 'py-2.5'}`
                      : isMobileLandscape
                      ? 'gap-2 px-2.5 min-h-[34px] py-1.5 text-xs'
                      : 'gap-3 px-3 py-2 text-[13px]'
                  } ${
                    active
                      ? 'bg-[#00FF85] text-slate-950 font-bold shadow-[0_4px_18px_-4px_rgba(0,255,133,0.5)]'
                      : 'text-slate-300 hover:text-white hover:bg-white/[0.07]'
                  }`}
                >
                  <span className="shrink-0 relative">
                    {item.icon}
                    {sidebarCollapsed && showMatchPulse && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#00FF85] animate-pulse" />
                    )}
                    {sidebarCollapsed && showBidBadge && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400" />
                    )}
                  </span>
                  {!sidebarCollapsed && (
                    <span className="truncate flex-1 text-left">{item.label}</span>
                  )}
                  {!sidebarCollapsed && showMatchPulse && (
                    <span className="w-2 h-2 rounded-full bg-[#00FF85] animate-pulse shrink-0" title="Matchday" />
                  )}
                  {!sidebarCollapsed && showBidBadge && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold tabular-nums shrink-0 ${
                        active ? 'bg-slate-950/20 text-slate-950' : 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                      }`}
                    >
                      {pendingBidsCount}
                    </span>
                  )}
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        <div
          title={`${lang === 'vi' ? 'Mùa' : 'Season'} ${career.seasonLabel ?? '2026/27'} · R${career.currentRound}/${totalRounds} · ${t(lang, 'budgetLabel')}: ${formatCurrency(career.budget)}`}
          className={`shrink-0 border-t border-white/[0.08] bg-black/35 ${
            sidebarCollapsed
              ? 'px-1 py-2 text-center space-y-0.5'
              : isMobileLandscape
              ? 'p-2 text-[11px] space-y-0.5'
              : 'p-3.5 text-xs space-y-2'
          }`}
        >
          {sidebarCollapsed ? (
            <>
              <div className="text-[10px] font-mono font-bold text-slate-200 leading-tight">
                R{career.currentRound}
              </div>
              <div className={`text-[9px] font-mono font-bold leading-tight ${boardColorClass}`}>
                {Math.round(career.boardSatisfaction)}%
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[11px] text-slate-400">
                  <span className="truncate font-medium text-slate-300">
                    {lang === 'vi' ? `Mùa ${career.seasonLabel ?? '2026/27'}` : `Season ${career.seasonLabel ?? '2026/27'}`}
                  </span>
                  <span className="font-mono font-semibold text-slate-200 tabular-nums">
                    R{career.currentRound}/{totalRounds}
                  </span>
                </div>
                {!isMobileLandscape && (
                  <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#00FF85]/80 transition-all duration-300"
                      style={{ width: `${roundProgressPct}%` }}
                    />
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center text-slate-400 pt-0.5">
                <span className="text-[11px]">{t(lang, 'budgetLabel')}</span>
                <span className="font-mono font-bold text-[#00FF85] tabular-nums">
                  {formatCurrency(career.budget)}
                </span>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {/* Top Broadcast Telemetry Bar (relative z-40 fixes Notification dropdown stacking above <main>) */}
        <header
          className={`relative z-40 shrink-0 border-b border-white/[0.08] backdrop-blur-xl flex items-center justify-between gap-3 ${
            isMobileLandscape
              ? 'landscape-compact-header bg-[#060910]/85 px-3 py-1.5'
              : 'bg-[#060910]/72 px-3 sm:px-6 py-2.5'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {!isMobileLandscape && (
              <button
                type="button"
                onClick={() => setMobileMenuOpen((v) => !v)}
                aria-label="Toggle navigation menu"
                className="lg:hidden p-2 rounded-lg border border-white/15 bg-white/[0.06] hover:bg-white/12 text-white cursor-pointer transition-colors"
              >
                {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            )}
            {isMobileLandscape ? (
              <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                <div className="text-slate-400 truncate">
                  {t(lang, 'headCoach')}:{' '}
                  <span className="text-white font-semibold">
                    {career.coach.firstName} {career.coach.lastName}
                  </span>
                </div>
                <span className="text-slate-600">·</span>
                <span className="text-slate-300 whitespace-nowrap">
                  {t(lang, 'boardSatisfaction')}:{' '}
                  <strong className={`font-mono tabular-nums ${boardColorClass}`}>
                    {career.boardSatisfaction}%
                    {career.managerContract?.status === 'SACKED'
                      ? ` (${t(lang, 'sackedContract')})`
                      : career.managerContract?.probationMatchesRemaining !== null &&
                        career.managerContract?.probationMatchesRemaining !== undefined &&
                        career.boardSatisfaction < 30
                      ? ` (${career.managerContract.probationMatchesRemaining}m)`
                      : ''}
                  </strong>
                </span>
                <span className="text-slate-600">·</span>
                <span className="font-mono text-[#00FF85] font-semibold tabular-nums">
                  {formatCurrency(career.budget)}
                </span>
              </div>
            ) : (
              <div className="min-w-0 flex items-center gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-slate-400 truncate">
                    {t(lang, 'headCoach')}:{' '}
                    <span className="text-white font-semibold">
                      {career.coach.firstName} {career.coach.lastName}
                    </span>{' '}
                    <span className="text-slate-400">({career.coach.nickname})</span>
                  </div>
                  <div className="text-xs text-slate-300 flex items-center gap-2.5 mt-1">
                    <span className="inline-flex items-center gap-2">
                      <span className="text-slate-400">{t(lang, 'boardSatisfaction')}:</span>
                      <span className="hidden sm:inline-block w-14 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <span
                          className={`block h-full rounded-full ${boardBarClass}`}
                          style={{ width: `${Math.max(4, Math.min(100, career.boardSatisfaction))}%` }}
                        />
                      </span>
                      <strong className={`font-mono tabular-nums ${boardColorClass}`}>
                        {career.boardSatisfaction}%
                        {career.managerContract?.status === 'SACKED'
                          ? ` (${t(lang, 'sackedContract')})`
                          : career.managerContract?.probationMatchesRemaining !== null &&
                            career.managerContract?.probationMatchesRemaining !== undefined &&
                            career.boardSatisfaction < 30
                          ? ` (${career.managerContract.probationMatchesRemaining}m)`
                          : ''}
                      </strong>
                    </span>
                    <span className="hidden sm:inline text-slate-600">·</span>
                    <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-500/10 border border-[#00FF85]/25 font-mono text-[11px] font-bold text-[#00FF85] tabular-nums">
                      {formatCurrency(career.budget)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <div className="hidden md:inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-slate-200">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: activeCompTheme.accentColor }}
              />
              <span className="truncate max-w-[160px]">{activeCompTheme.name}</span>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-white/[0.08] border border-white/12 text-xs font-mono font-semibold text-white">
              {navItems.find((n) => n.id === activeNav)?.label}
            </span>
            <button
              type="button"
              onClick={() =>
                setCareer((prev) =>
                  prev
                    ? {
                        ...prev,
                        settings: {
                          ...prev.settings,
                          soundEnabled: !prev.settings.soundEnabled,
                        },
                      }
                    : prev
                )
              }
              title={
                career.settings.soundEnabled
                  ? lang === 'vi'
                    ? 'Tắt âm thanh'
                    : 'Mute sound FX'
                  : lang === 'vi'
                  ? 'Bật âm thanh'
                  : 'Enable sound FX'
              }
              aria-label={career.settings.soundEnabled ? 'Mute sound FX' : 'Enable sound FX'}
              className={`inline-flex items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                isMobileLandscape ? 'w-8 h-8' : 'w-9 h-9'
              } ${
                career.settings.soundEnabled
                  ? 'border-white/15 bg-white/[0.06] hover:bg-white/12 text-emerald-300'
                  : 'border-white/10 bg-black/30 hover:bg-white/10 text-slate-500'
              }`}
            >
              {career.settings.soundEnabled ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
            </button>
            <NotificationCenter
              notifications={career.notifications ?? []}
              incomingBids={career.incomingBids ?? []}
              language={lang}
              onMarkRead={(id) =>
                setCareer((prev) =>
                  prev
                    ? {
                        ...prev,
                        notifications: (prev.notifications ?? []).map((n) =>
                          n.id === id ? { ...n, read: true } : n
                        ),
                      }
                    : prev
                )
              }
              onMarkAllRead={() =>
                setCareer((prev) =>
                  prev
                    ? {
                        ...prev,
                        notifications: (prev.notifications ?? []).map((n) => ({
                          ...n,
                          read: true,
                        })),
                      }
                    : prev
                )
              }
              onOpenBid={(bidId) => setActiveBidId(bidId)}
              onNavigate={(nav) => handleNavChange(nav)}
            />
          </div>
        </header>

        {/* Compact Navigation Drawer on Narrow Non-Desktop Screens */}
        {mobileMenuOpen && !isMobileLandscape && (
          <nav
            aria-label="Mobile Navigation"
            className="lg:hidden relative z-30 shrink-0 border-b border-white/12 bg-[#070A12]/95 backdrop-blur-xl p-3 grid grid-cols-3 sm:grid-cols-4 gap-1.5 shadow-xl"
          >
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  playSound('tab', career.settings.soundEnabled);
                  handleNavChange(item.id);
                }}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  activeNav === item.id
                    ? 'bg-[#00FF85] text-slate-950 font-bold'
                    : 'bg-white/[0.06] text-slate-200 hover:bg-white/12'
                }`}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </nav>
        )}

        <main
          className={
            isMobileLandscape
              ? 'landscape-compact-main flex-1 min-h-0 overflow-hidden p-2 max-w-7xl w-full mx-auto flex flex-col'
              : `flex-1 min-h-0 p-4 sm:p-6 max-w-7xl w-full mx-auto ${
                  activeNav === 'lineup' ||
                  activeNav === 'standings' ||
                  activeNav === 'academy' ||
                  activeNav === 'media'
                    ? 'overflow-y-auto pb-20 lg:overflow-hidden lg:pb-6'
                    : 'overflow-y-auto pb-20'
                }`
          }
        >
          <div
            key={activeNav}
            className={
              isMobileLandscape
                ? 'animate-view-enter flex-1 min-h-0 h-full overflow-y-auto flex flex-col'
                : 'animate-view-enter h-full'
            }
          >
          {activeNav === 'matchday' && (
            <MatchdayView
              state={career}
              userClub={userClub}
              standings={career.contextStandings[userLeagueId] ?? career.contextStandings.PL}
              onAdvanceDay={handleAdvanceDay}
              onAdvanceDeadlineHour={handleAdvanceDeadlineHour}
              onAutoAdvanceDeadlineDay={handleAutoAdvanceDeadlineDay}
              onSaveMatchdayOverride={(override: MatchdayLineupOverride | null) =>
                setCareer((prev) => (prev ? { ...prev, matchdayOverride: override } : prev))
              }
              onApplyAutoReplaceSave={(nextStartingIds, nextBenchIds) =>
                setCareer((prev) =>
                  prev
                    ? {
                        ...prev,
                        matchdayOverride: null,
                        clubs: prev.clubs.map((c) =>
                          c.id === prev.clubId
                            ? { ...c, startingIds: nextStartingIds, benchIds: nextBenchIds }
                            : c
                        ),
                      }
                    : prev
                )
              }
              onCompleteMatch={handleCompleteMatch}
              onPendingReportChange={setPendingMatchReport}
              onAdvanceNextSeason={handleAdvanceNextSeason}
              onOpenJobMarket={() => handleNavChange('office')}
            />
          )}

          {activeNav === 'calendar' && (
            <TeamCalendarView
              state={career}
              userClub={userClub}
              onSkipToDate={(targetDateIso) =>
                setCareer((prev) => (prev ? skipCalendarToDate(prev, targetDateIso) : prev))
              }
            />
          )}

          {activeNav === 'lineup' && (
            <LineupTacticsView
              club={userClub}
              language={lang}
              soundEnabled={career.settings.soundEnabled}
              onUpdateLineup={(startingIds, benchIds) =>
                updateUserClub((c) => ({ ...c, startingIds, benchIds }))
              }
              onUpdateTactics={(tactics: TacticsConfig) =>
                updateUserClub((c) => ({ ...c, formation: tactics.formation, tactics }))
              }
              onUpdatePlayerRole={(playerId: string, role: PlayerRole) =>
                updateUserClub((c) => ({
                  ...c,
                  players: c.players.map((p) => (p.id === playerId ? { ...p, role } : p)),
                }))
              }
              onUpdateSlotRole={(slotIndex: number, role: PlayerRole, playerId: string) =>
                updateUserClub((c) => ({
                  ...c,
                  slotRoles: { ...(c.slotRoles ?? {}), [slotIndex]: role },
                  players: c.players.map((p) => (p.id === playerId ? { ...p, role } : p)),
                }))
              }
              onUpdateTeamRoles={(teamRoles: TeamRoles) =>
                updateUserClub((c) => ({ ...c, teamRoles }))
              }
            />
          )}

          {activeNav === 'squad' && (
            <SquadHubView
              club={userClub}
              availableBudget={career.budget}
              language={lang}
              onChangeShirtNumber={(playerId, nextShirt) => {
                if (nextShirt < 1 || nextShirt > 99) {
                  return { ok: false, error: 'Shirt number must be 1–99.' };
                }
                const taken = userClub.players.some(
                  (p) => p.id !== playerId && p.shirtNumber === nextShirt
                );
                if (taken) {
                  return { ok: false, error: `#${nextShirt} is already worn by a teammate.` };
                }
                updateUserClub((c) => ({
                  ...c,
                  players: c.players.map((p) =>
                    p.id === playerId ? { ...p, shirtNumber: nextShirt } : p
                  ),
                }));
                return { ok: true };
              }}
              onToggleForSale={(playerId) =>
                updateUserClub((c) => ({
                  ...c,
                  players: c.players.map((p) =>
                    p.id === playerId ? { ...p, forSale: !p.forSale } : p
                  ),
                }))
              }
              onToggleForLoan={(playerId) =>
                updateUserClub((c) => ({
                  ...c,
                  players: c.players.map((p) =>
                    p.id === playerId && !p.loanInfo ? { ...p, forLoan: !p.forLoan } : p
                  ),
                }))
              }
              onExerciseBuyOption={(playerId) => {
                playSound('accept', career.settings.soundEnabled);
                setCareer((prev) => (prev ? exerciseLoanBuyOption(prev, playerId) : prev));
              }}
              onReleasePlayer={(playerId) => {
                const target = userClub.players.find((p) => p.id === playerId);
                if (!target || userClub.players.length <= 13) return;
                const comp = Math.round(target.weeklyWage * 12);
                setCareer((prev) => {
                  if (!prev) return prev;
                  const dateIso = prev.calendar[prev.currentDayIndex]?.dateIso ?? '2026-08-15';
                  return {
                    ...prev,
                    budget: Math.max(0, prev.budget - comp),
                    clubs: prev.clubs.map((c) => {
                      if (c.id !== prev.clubId) return c;
                      const remaining = c.players.filter((p) => p.id !== playerId);
                      const nextStart = c.startingIds.filter((id) => id !== playerId);
                      const nextBench = c.benchIds.filter((id) => id !== playerId);
                      while (nextStart.length < 11) {
                        const filler = remaining.find(
                          (p) =>
                            !nextStart.includes(p.id) &&
                            !nextBench.includes(p.id) &&
                            p.loanInfo?.direction !== 'OUT'
                        ) ?? remaining.find(
                          (p) => !nextStart.includes(p.id) && p.loanInfo?.direction !== 'OUT'
                        );
                        if (!filler) break;
                        nextStart.push(filler.id);
                      }
                      return {
                        ...c,
                        players: remaining,
                        startingIds: nextStart,
                        benchIds: nextBench.filter((id) => !nextStart.includes(id)),
                      };
                    }),
                    incomingBids: (prev.incomingBids ?? []).map((b) =>
                      b.playerId === playerId && b.status === 'PENDING'
                        ? { ...b, status: 'REJECTED' as const, lastMessage: 'Player released by club.' }
                        : b
                    ),
                    financeLedger: [
                      {
                        id: `fin_rel_${Date.now()}`,
                        dateIso,
                        type: 'EXPENSE',
                        category: 'RELEASE_COMPENSATION',
                        description: `Contract termination compensation (${target.name})`,
                        amount: comp,
                      },
                      ...prev.financeLedger,
                    ],
                  };
                });
              }}
              onSignContractRenewal={(playerId: string, offer: ContractOffer, immediateCost: number) => {
                const target = userClub.players.find((p) => p.id === playerId);
                if (!target) return;
                playSound('accept', career.settings.soundEnabled);
                setCareer((prev) => {
                  if (!prev) return prev;
                  const dateIso = prev.calendar[prev.currentDayIndex]?.dateIso ?? '2026-08-15';
                  return {
                    ...prev,
                    budget: Math.max(0, prev.budget - immediateCost),
                    clubs: prev.clubs.map((c) =>
                      c.id === prev.clubId
                        ? {
                            ...c,
                            players: c.players.map((p) =>
                              p.id === playerId
                                ? {
                                    ...p,
                                    weeklyWage: offer.weeklyWage,
                                    contractExpiry: p.contractExpiry + offer.extendByYears,
                                    squadStatus: offer.squadStatus,
                                    goalBonus: offer.bonusPerGoal,
                                    releaseClause: offer.releaseCompensation,
                                  }
                                : p
                            ),
                          }
                        : c
                    ),
                    financeLedger: [
                      {
                        id: `fin_ren_${Date.now()}`,
                        dateIso,
                        type: 'EXPENSE',
                        category: 'RENEWAL_FEE',
                        description: `Contract renewal signing & agent fees (${target.name})`,
                        amount: immediateCost,
                      },
                      ...prev.financeLedger,
                    ],
                  };
                });
              }}
            />
          )}

          {activeNav === 'transfers' && (
            <TransfersView
              state={career}
              userClub={userClub}
              onAdvanceDeadlineHour={handleAdvanceDeadlineHour}
              onAutoAdvanceDeadlineDay={handleAutoAdvanceDeadlineDay}
              onEnsureClubLoaded={(clubId) =>
                setCareer((prev) => (prev ? ensureTargetClubInState(prev, clubId) : prev))
              }
              onStartScout={(playerId, targetClubId) =>
                setCareer((prev) => {
                  if (!prev) return prev;
                  const hydrated = targetClubId ? ensureTargetClubInState(prev, targetClubId) : prev;
                  const targetObj = hydrated.clubs
                    .flatMap((c) => c.players)
                    .find((p) => p.id === playerId);
                  const scoutDays = targetObj ? getScoutDurationDays(targetObj) : 3;
                  return {
                    ...hydrated,
                    transferTargets: hydrated.transferTargets.map((tItem) =>
                      tItem.playerId === playerId
                        ? { ...tItem, scoutStatus: 'SCOUTING', scoutDaysRemaining: scoutDays }
                        : tItem
                    ),
                  };
                })
              }
              onToggleShortlist={(playerId, targetClubId) =>
                setCareer((prev) => {
                  if (!prev) return prev;
                  const hydrated = targetClubId ? ensureTargetClubInState(prev, targetClubId) : prev;
                  return {
                    ...hydrated,
                    transferTargets: hydrated.transferTargets.map((tItem) =>
                      tItem.playerId === playerId
                        ? { ...tItem, shortlisted: !tItem.shortlisted }
                        : tItem
                    ),
                  };
                })
              }
              onUpdateTransferStatus={(
                playerId: string,
                status: TransferTarget['negotiationStatus'],
                offer?: TransferOffer,
                feedback?: string,
                targetClubId?: string
              ) =>
                setCareer((prev) => {
                  if (!prev) return prev;
                  const hydrated = targetClubId ? ensureTargetClubInState(prev, targetClubId) : prev;
                  const curDay = hydrated.calendar[hydrated.currentDayIndex];
                  const dateIso = curDay?.dateIso ?? '2026-07-01';
                  const isDeadlineDay = Boolean(curDay?.isDeadlineDay);
                  return {
                    ...hydrated,
                    transferTargets: hydrated.transferTargets.map((tItem) =>
                      tItem.playerId === playerId
                        ? {
                            ...tItem,
                            negotiationStatus: status,
                            lastOffer: offer ?? tItem.lastOffer,
                            feedbackMessage: feedback ?? tItem.feedbackMessage,
                            cooldownUntilDateIso:
                              status === 'REJECTED'
                                ? getRejectionCooldownUntil(dateIso, isDeadlineDay)
                                : tItem.cooldownUntilDateIso,
                          }
                        : tItem
                    ),
                  };
                })
              }
              onCompleteLoanSigning={(playerId, parentClubId, offer) => {
                playSound('accept', career.settings.soundEnabled);
                setCareer((prev) =>
                  prev ? completeLoanInDeal(ensureTargetClubInState(prev, parentClubId), playerId, parentClubId, offer) : prev
                );
              }}
              onCompleteTransferSigning={(
                playerId,
                sellingClubId,
                paidNow,
                exchangePlayerId,
                contractOffer,
                contractCost
              ) => {
                playSound('accept', career.settings.soundEnabled);
                setCareer((prev) => {
                  if (!prev) return prev;
                  prev = ensureTargetClubInState(prev, sellingClubId);
                  const sellingClub = prev.clubs.find((c) => c.id === sellingClubId);
                  const incoming = sellingClub?.players.find((p) => p.id === playerId);
                  if (!sellingClub || !incoming) return prev;

                  const dateIso = prev.calendar[prev.currentDayIndex]?.dateIso ?? '2026-08-15';
                  const myClub = prev.clubs.find((c) => c.id === prev.clubId)!;
                  const usedNumbers = new Set(myClub.players.map((p) => p.shirtNumber));
                  let nextShirt = incoming.shirtNumber;
                  while (usedNumbers.has(nextShirt) && nextShirt < 99) nextShirt++;

                  const signedPlayer = {
                    ...incoming,
                    shirtNumber: nextShirt,
                    weeklyWage: contractOffer.weeklyWage,
                    contractExpiry: 2026 + (prev.seasonIndex ?? 0) + contractOffer.extendByYears,
                    squadStatus: contractOffer.squadStatus,
                    goalBonus: contractOffer.bonusPerGoal,
                    releaseClause: contractOffer.releaseCompensation,
                    forSale: false,
                    forLoan: false,
                  };

                  const exchanged = exchangePlayerId
                    ? myClub.players.find((p) => p.id === exchangePlayerId)
                    : null;

                  const totalOutlay = paidNow + contractCost;

                  return {
                    ...prev,
                    budget: Math.max(0, prev.budget - totalOutlay),
                    clubs: prev.clubs.map((c) => {
                      if (c.id === prev.clubId) {
                        const filtered = exchanged
                          ? c.players.filter((p) => p.id !== exchanged.id)
                          : c.players;
                        const updatedPlayers = [...filtered, signedPlayer];
                        let nextStart = c.startingIds.filter((id) => id !== exchangePlayerId);
                        let nextBench = c.benchIds.filter((id) => id !== exchangePlayerId);
                        if (nextStart.length < 11) {
                          if (nextStart.length === 10 && !nextStart.includes(signedPlayer.id)) {
                            nextStart = [...nextStart, signedPlayer.id];
                          } else {
                            const filler = updatedPlayers.find(
                              (p) => !nextStart.includes(p.id) && p.loanInfo?.direction !== 'OUT'
                            );
                            if (filler) nextStart = [...nextStart, filler.id];
                          }
                        }
                        if (!nextStart.includes(signedPlayer.id) && nextBench.length < BENCH_SIZE) {
                          nextBench = [...nextBench, signedPlayer.id];
                        }
                        nextBench = nextBench.filter((id) => !nextStart.includes(id));
                        return {
                          ...c,
                          players: updatedPlayers,
                          benchIds: nextBench,
                          startingIds: nextStart,
                        };
                      }
                      if (c.id === sellingClubId) {
                        const withoutSigned = c.players.filter((p) => p.id !== playerId);
                        let exchangedForSeller = exchanged;
                        if (exchanged) {
                          const sellerUsedNumbers = new Set(withoutSigned.map((p) => p.shirtNumber));
                          let sellerShirt = exchanged.shirtNumber;
                          while (sellerUsedNumbers.has(sellerShirt) && sellerShirt < 99) sellerShirt++;
                          if (sellerUsedNumbers.has(sellerShirt)) {
                            sellerShirt = 1;
                            while (sellerUsedNumbers.has(sellerShirt) && sellerShirt < 99) sellerShirt++;
                          }
                          exchangedForSeller = { ...exchanged, shirtNumber: sellerShirt };
                        }
                        const updatedPlayers = exchangedForSeller
                          ? [...withoutSigned, exchangedForSeller]
                          : withoutSigned;
                        const nextStart = c.startingIds.filter((id) => id !== playerId);
                        if (nextStart.length < 11) {
                          const fill = updatedPlayers.find(
                            (p) => !nextStart.includes(p.id) && p.loanInfo?.direction !== 'OUT'
                          );
                          if (fill) nextStart.push(fill.id);
                        }
                        return {
                          ...c,
                          players: updatedPlayers,
                          startingIds: nextStart,
                          benchIds: c.benchIds.filter((id) => id !== playerId && !nextStart.includes(id)),
                        };
                      }
                      return c;
                    }),
                    transferTargets: prev.transferTargets.map((tItem) =>
                      tItem.playerId === playerId
                        ? {
                            ...tItem,
                            negotiationStatus: 'COMPLETED',
                            feedbackMessage: `Signed for ${myClub.name}.`,
                          }
                        : tItem
                    ),
                    financeLedger: [
                      {
                        id: `fin_trf_${Date.now()}`,
                        dateIso,
                        type: 'EXPENSE',
                        category: 'TRANSFER_FEE',
                        description: `Transfer fee & signing bonus (${signedPlayer.name} from ${sellingClub.name})`,
                        amount: totalOutlay,
                      },
                      ...prev.financeLedger,
                    ],
                  };
                });
              }}
            />
          )}

          {activeNav === 'standings' && (
            <StandingsView
              state={career}
              selectedCompetition={selectedCompetition}
              onSelectCompetition={setSelectedCompetition}
            />
          )}

          {activeNav === 'fixtures' && (
            <FixturesView
              state={career}
              selectedCompetition={selectedCompetition}
              onSelectCompetition={setSelectedCompetition}
            />
          )}

          {activeNav === 'academy' && (
            <AcademyView
              state={career}
              onPromotePlayer={(academyId) => {
                playSound('accept', career.settings.soundEnabled);
                setCareer((prev) => (prev ? promoteAcademyProspect(prev, academyId) : prev));
              }}
            />
          )}

          {activeNav === 'finance' && <FinanceView state={career} userClub={userClub} />}

          {activeNav === 'media' && <MediaStudioView userClub={userClub} state={career} />}

          {(activeNav === 'office' || activeNav === 'jobs') && (
            <JobMarketView
              state={career}
              userClub={userClub}
              language={lang}
              onRenewContract={(requestedWage, extendYears) => {
                const res = renewManagerContract(career, requestedWage, extendYears);
                if (res.ok) {
                  playSound('accept', career.settings.soundEnabled);
                  setCareer(res.nextState);
                } else {
                  playSound('reject', career.settings.soundEnabled);
                }
                return { ok: res.ok, message: res.message };
              }}
              onApplyAndSwitchClub={(targetClubId, agreedWage, contractYears) => {
                playSound('accept', career.settings.soundEnabled);
                const next = switchUserClub(career, targetClubId, agreedWage, contractYears);
                setCareer(next);
                setSelectedCompetition(next.userLeagueId ?? 'PL');
                setActiveNav('matchday');
              }}
            />
          )}

          {activeNav === 'custom' && (
            <CustomSettingsView
              state={career}
              onUpdateCoach={(coach) =>
                setCareer((prev) => (prev ? { ...prev, coach } : prev))
              }
              onToggleLanguage={(language) =>
                setCareer((prev) =>
                  prev ? { ...prev, settings: { ...prev.settings, language } } : prev
                )
              }
              onToggleSound={(soundEnabled) =>
                setCareer((prev) =>
                  prev ? { ...prev, settings: { ...prev.settings, soundEnabled } } : prev
                )
              }
              onUpdateAutoAdvanceStops={(autoAdvanceStopOn: Record<NotificationType, boolean>) =>
                setCareer((prev) =>
                  prev ? { ...prev, settings: { ...prev.settings, autoAdvanceStopOn } } : prev
                )
              }
              onResetCareer={() => {
                void clearSavedCareer();
                setCareer(null);
                setPendingMatchReport(null);
                setActiveBidId(null);
              }}
            />
          )}
          </div>
        </main>
      </div>

      {activeBid && (
        <IncomingBidModal
          bid={activeBid}
          player={activeBidPlayer}
          buyingClub={activeBidBuyer}
          userClub={userClub}
          language={lang}
          onAcceptBid={(bidId) => {
            playSound('accept', career.settings.soundEnabled);
            setCareer((prev) => (prev ? acceptIncomingTransferBid(prev, bidId) : prev));
            setActiveBidId(null);
          }}
          onCounterBid={(bidId, counterOffer) => {
            const evaluated = evaluateIncomingBidCounter(career, bidId, counterOffer);
            setCareer(evaluated.nextState);
            playSound(
              evaluated.outcome === 'WALKED'
                ? 'reject'
                : evaluated.outcome === 'ACCEPTED'
                ? 'accept'
                : 'click',
              career.settings.soundEnabled
            );
            return { outcome: evaluated.outcome, message: evaluated.message };
          }}
          onRejectBid={(bidId) => {
            playSound('reject', career.settings.soundEnabled);
            setCareer((prev) => (prev ? rejectIncomingTransferBid(prev, bidId) : prev));
            setActiveBidId(null);
          }}
          onClose={() => setActiveBidId(null)}
        />
      )}

      <SpotifyWidget
        playlistIndex={career.settings.spotifyPlaylistIndex}
        onChangePlaylist={(spotifyPlaylistIndex) =>
          setCareer((prev) =>
            prev ? { ...prev, settings: { ...prev.settings, spotifyPlaylistIndex } } : prev
          )
        }
      />
    </div>
  );
}
