import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ModalPortal } from './ModalPortal';
import {
  BuildUpStyle,
  CalendarDay,
  CareerState,
  Club,
  DefensiveApproach,
  FormationName,
  Language,
  MatchdayLineupOverride,
  MatchReport,
  Player,
  PlayerRole,
  StandingRow,
  TacticalPreset,
  TacticsConfig,
  TeamRoles,
} from '../types/game';
import { getCountryForLeague } from '../data/competitions';
import { ALL_FORMATIONS, COMPETITION_THEMES, deriveDefaultTeamRoles, FORMATION_SLOTS } from '../data/premierLeague2627';
import {
  applyMatchdayOverrideToClub,
  autoReplaceUnavailableStarters,
  formatSeasonLabel,
  getTotalRoundsForLeague,
  resolveClubForMatch,
  simulateMatch,
  validateStartingXI,
} from '../engine/gameLogic';
import {
  createLiveMatchSession,
  finalizeLiveMatchReport,
  finishLiveMatchToEnd,
  LiveMatchSession,
  stepLiveMatchMinute,
} from '../engine/liveMatchEngine';
import {
  getAllowedRolesForSlot,
  getPlayerRoleMastery,
  getPlayerSlotEvaluation,
  getRoleMasteryBadgeClasses,
  isPlayerAvailableForMatchday,
  migrateLegacyRole,
  slotLabelToDetailedPosition,
} from '../utils/playerAttributes';
import { playSound } from '../utils/sound';
import { formatCurrency, t } from '../utils/i18n';
import { useIsMobileLandscape } from '../utils/useMobileLandscape';
import { ClubBadge, PlayerAvatar } from './ClubBadge';
import { LiveMatchArena } from './LiveMatchArena';
import { MatchReportPanel } from './MatchReportPanel';
import { FitnessBar, PitchBoard } from './PitchBoard';
import { PlayerComparisonModal } from './PlayerComparisonModal';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  Award,
  Bell,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  Crosshair,
  Eye,
  FastForward,
  Flag,
  Lock,
  Play,
  RotateCcw,
  Shield,
  ShieldAlert,
  Sliders,
  Sparkles,
  Square,
  Trophy,
  Users,
  X,
} from 'lucide-react';

interface MatchdayViewProps {
  state: CareerState;
  userClub: Club;
  standings: StandingRow[];
  onAdvanceDay: () => void;
  onAdvanceDeadlineHour?: () => void;
  onAutoAdvanceDeadlineDay?: () => void;
  onSaveMatchdayOverride: (override: MatchdayLineupOverride | null) => void;
  onApplyAutoReplaceSave?: (nextStartingIds: string[], nextBenchIds: string[]) => void;
  onCompleteMatch: (report: MatchReport) => void;
  onPendingReportChange?: (report: MatchReport | null) => void;
  onAdvanceNextSeason: () => void;
  onOpenJobMarket?: () => void;
}

const PRESETS: TacticalPreset[] = [
  'Gegenpress',
  'Tiki-Taka',
  'Counter-Attack',
  'Wing Play',
  'Park the Bus',
  'Balanced',
];
const FORMATIONS: FormationName[] = ALL_FORMATIONS;
const BUILD_UP_STYLES: BuildUpStyle[] = ['Short Passing', 'Balanced', 'Direct Passing', 'Long Ball'];
const DEF_APPROACHES: DefensiveApproach[] = ['High Press', 'Balanced', 'Mid Block', 'Deep Block'];

export const MatchdayView: React.FC<MatchdayViewProps> = ({
  state,
  userClub,
  standings,
  onAdvanceDay,
  onAdvanceDeadlineHour,
  onAutoAdvanceDeadlineDay,
  onSaveMatchdayOverride,
  onApplyAutoReplaceSave,
  onCompleteMatch,
  onPendingReportChange,
  onAdvanceNextSeason,
  onOpenJobMarket,
}) => {
  const lang: Language = state.settings.language;
  const isMobileLandscape = useIsMobileLandscape();
  const userLeagueId = state.userLeagueId ?? 'PL';
  const totalRounds = getTotalRoundsForLeague(userLeagueId);
  const currentDay: CalendarDay | undefined = state.calendar[state.currentDayIndex];
  const isMatchday = currentDay?.type === 'MATCHDAY';
  const isSacked = state.managerContract?.status === 'SACKED';
  const probationLeft = state.managerContract?.probationMatchesRemaining ?? null;

  const findFixtureById = (fixtureId?: string) => {
    if (!fixtureId) return undefined;
    return (
      state.fixtures.find((f) => f.id === fixtureId) ??
      Object.values(state.contextFixtures)
        .flat()
        .find((f) => f?.id === fixtureId)
    );
  };

  const upcomingMatchDay = state.calendar
    .slice(state.currentDayIndex)
    .find((d) => d.type === 'MATCHDAY' && d.matchFixtureId);

  const nextMatchFixture = isMatchday
    ? findFixtureById(currentDay?.matchFixtureId)
    : findFixtureById(upcomingMatchDay?.matchFixtureId) ??
      state.fixtures.find(
        (f) => !f.played && (f.homeClubId === userClub.id || f.awayClubId === userClub.id)
      );

  const coachFullName =
    `${state.coach.firstName} ${state.coach.lastName}`.trim() ||
    state.coach.nickname ||
    userClub.managerName;

  const effectiveUserClub = useMemo(
    () => ({
      ...applyMatchdayOverrideToClub(userClub, state.matchdayOverride, nextMatchFixture?.id),
      managerName: coachFullName,
    }),
    [userClub, state.matchdayOverride, nextMatchFixture?.id, coachFullName]
  );

  const hasTempOverride = Boolean(
    state.matchdayOverride &&
      nextMatchFixture &&
      state.matchdayOverride.fixtureId === nextMatchFixture.id
  );

  const rawHomeClub = nextMatchFixture
    ? resolveClubForMatch(state.clubs, nextMatchFixture.homeClubId)
    : undefined;
  const rawAwayClub = nextMatchFixture
    ? resolveClubForMatch(state.clubs, nextMatchFixture.awayClubId)
    : undefined;

  const homeClub = rawHomeClub?.id === userClub.id ? effectiveUserClub : rawHomeClub;
  const awayClub = rawAwayClub?.id === userClub.id ? effectiveUserClub : rawAwayClub;

  const opponentClub = homeClub?.id === userClub.id ? awayClub : homeClub;

  const getRank = (clubId?: string) => {
    if (!clubId) return '-';
    const idx = standings.findIndex((r) => r.clubId === clubId);
    return idx >= 0 ? `#${idx + 1}` : '-';
  };

  // Auto-advance timer (slow, stoppable + auto-pause on matching alert notifications)
  const [autoAdvancing, setAutoAdvancing] = useState(false);
  const [autoAdvanceStopMsg, setAutoAdvanceStopMsg] = useState<string | null>(null);
  const seenNotificationIdsRef = useRef<Set<string>>(
    new Set((state.notifications ?? []).map((n) => n.id))
  );

  useEffect(() => {
    const notifications = state.notifications ?? [];
    const stopPrefs = state.settings.autoAdvanceStopOn;
    const newlyTriggered = notifications.filter(
      (n) => !seenNotificationIdsRef.current.has(n.id)
    );
    seenNotificationIdsRef.current = new Set(notifications.map((n) => n.id));

    if (autoAdvancing && newlyTriggered.length > 0) {
      const stopMatch = newlyTriggered.find((n) => {
        if (!stopPrefs) return true;
        return stopPrefs[n.type] !== false;
      });
      if (stopMatch) {
        setAutoAdvancing(false);
        setAutoAdvanceStopMsg(stopMatch.title);
      }
    }
  }, [state.notifications, autoAdvancing, state.settings.autoAdvanceStopOn]);

  useEffect(() => {
    if (!autoAdvancing) return;
    if (isSacked || isMatchday || currentDay?.isDeadlineDay) {
      setAutoAdvancing(false);
      return;
    }
    const timer = window.setTimeout(() => {
      playSound('tick', state.settings.soundEnabled);
      onAdvanceDay();
    }, 420);
    return () => window.clearTimeout(timer);
  }, [autoAdvancing, isSacked, isMatchday, currentDay?.isDeadlineDay, state.currentDayIndex, onAdvanceDay, state.settings.soundEnabled]);

  // Temporary 1-Match Starting XI Modal State
  const [showStartingModal, setShowStartingModal] = useState(false);
  const [showOpponentModal, setShowOpponentModal] = useState(false);
  const [modalTab, setModalTab] = useState<'squad' | 'tactical' | 'roles'>('squad');
  const [modalBenchTab, setModalBenchTab] = useState<'subs' | 'reserves'>('subs');
  const [draftFormation, setDraftFormation] = useState<FormationName>(effectiveUserClub.formation);
  const [draftStarting, setDraftStarting] = useState<string[]>(effectiveUserClub.startingIds);
  const [draftBench, setDraftBench] = useState<string[]>(effectiveUserClub.benchIds);
  const [draftTactics, setDraftTactics] = useState<TacticsConfig>(effectiveUserClub.tactics);
  const [draftSlotRoles, setDraftSlotRoles] = useState<Record<number, PlayerRole>>(
    effectiveUserClub.slotRoles ?? {}
  );
  const [draftTeamRoles, setDraftTeamRoles] = useState<TeamRoles>(
    effectiveUserClub.teamRoles ?? deriveDefaultTeamRoles(effectiveUserClub.players)
  );
  const [draftCompareIds, setDraftCompareIds] = useState<string[]>([]);
  const [draftComparisonOpen, setDraftComparisonOpen] = useState(false);
  const [draftDragOverCol2Id, setDraftDragOverCol2Id] = useState<string | null>(null);
  const [draftTacticalPlayerId, setDraftTacticalPlayerId] = useState<string>(
    effectiveUserClub.startingIds[9] ?? effectiveUserClub.startingIds[0] ?? ''
  );

  // Unavailable starter pre-match modal & live simulation
  const [unavailableModalMode, setUnavailableModalMode] = useState<'quick' | 'live' | null>(null);
  const [lineupError, setLineupError] = useState<string | null>(null);
  const [liveReport, setLiveReport] = useState<MatchReport | null>(null);
  const [liveSession, setLiveSession] = useState<LiveMatchSession | null>(null);
  const [livePlaying, setLivePlaying] = useState(false);
  const [liveSpeed, setLiveSpeed] = useState<1 | 2 | 4>(1);
  const [finalizedMatchId, setFinalizedMatchId] = useState<string | null>(null);

  const isSimulatingLive = Boolean(liveSession && !liveSession.finished);

  useEffect(() => {
    if (!liveSession || !livePlaying || liveSession.finished) return;
    const delayMs = liveSpeed === 4 ? 280 : liveSpeed === 2 ? 550 : 1000;
    const timer = window.setTimeout(() => {
      const { next, stepAudio } = stepLiveMatchMinute(liveSession);
      if (stepAudio) {
        playSound(stepAudio, state.settings.soundEnabled);
      }
      if (next.finished) {
        setLivePlaying(false);
        setLiveSession(next);
      } else if (liveSession.minute < 45 && next.minute === 45) {
        if (stepAudio !== 'whistle') {
          playSound('whistle', state.settings.soundEnabled);
        }
        setLivePlaying(false);
        setLiveSession(next);
      } else {
        setLiveSession(next);
      }
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [liveSession, livePlaying, liveSpeed, state.settings.soundEnabled]);

  // Notify parent App whenever a completed match report is awaiting Continue confirmation
  useEffect(() => {
    if (liveReport && !isSimulatingLive && finalizedMatchId !== liveReport.fixtureId) {
      onPendingReportChange?.(liveReport);
    } else {
      onPendingReportChange?.(null);
    }
  }, [liveReport, isSimulatingLive, finalizedMatchId, onPendingReportChange]);

  const openStartingModal = () => {
    setModalTab('squad');
    setModalBenchTab('subs');
    setDraftFormation(effectiveUserClub.formation);
    setDraftStarting([...effectiveUserClub.startingIds]);
    setDraftBench([...effectiveUserClub.benchIds]);
    setDraftTactics({ ...effectiveUserClub.tactics });
    setDraftSlotRoles({ ...(effectiveUserClub.slotRoles ?? {}) });
    setDraftTeamRoles({
      ...(effectiveUserClub.teamRoles ?? deriveDefaultTeamRoles(effectiveUserClub.players)),
    });
    setDraftCompareIds([]);
    setDraftComparisonOpen(false);
    setDraftDragOverCol2Id(null);
    setDraftTacticalPlayerId(
      effectiveUserClub.startingIds[9] ?? effectiveUserClub.startingIds[0] ?? ''
    );
    setShowStartingModal(true);
  };

  const resetDraftToSaved = () => {
    setDraftFormation(userClub.formation);
    setDraftStarting([...userClub.startingIds]);
    setDraftBench([...userClub.benchIds]);
    setDraftTactics({ ...userClub.tactics });
    setDraftSlotRoles({ ...(userClub.slotRoles ?? {}) });
    setDraftTeamRoles({ ...(userClub.teamRoles ?? deriveDefaultTeamRoles(userClub.players)) });
    setDraftCompareIds([]);
    setDraftComparisonOpen(false);
    setDraftDragOverCol2Id(null);
    onSaveMatchdayOverride(null);
  };

  const draftClub: Club = useMemo(
    () => ({
      ...userClub,
      formation: draftFormation,
      startingIds: draftStarting,
      benchIds: draftBench,
      tactics: draftTactics,
      slotRoles: draftSlotRoles,
      teamRoles: draftTeamRoles,
    }),
    [userClub, draftFormation, draftStarting, draftBench, draftTactics, draftSlotRoles, draftTeamRoles]
  );

  const draftBenchPlayers = useMemo(() => {
    const map = new Map(userClub.players.map((p) => [p.id, p]));
    return draftBench.map((id) => map.get(id)).filter((p): p is Player => Boolean(p));
  }, [userClub.players, draftBench]);

  const draftReserves = useMemo(() => {
    const active = new Set([...draftStarting, ...draftBench]);
    return userClub.players.filter((p) => !active.has(p.id) && isPlayerAvailableForMatchday(p));
  }, [userClub.players, draftStarting, draftBench]);

  const draftTacticalPlayer =
    userClub.players.find((p) => p.id === draftTacticalPlayerId) ??
    userClub.players.find((p) => p.id === draftStarting[0]) ??
    userClub.players[0];

  const draftTacticalSlotIndex = draftTacticalPlayer
    ? draftStarting.indexOf(draftTacticalPlayer.id)
    : -1;

  const draftTacticalSlotLabel = useMemo(() => {
    if (!draftTacticalPlayer) return '';
    if (draftTacticalSlotIndex === -1) {
      return draftTacticalPlayer.detailedPosition ?? draftTacticalPlayer.position;
    }
    const slots = FORMATION_SLOTS[draftFormation] ?? FORMATION_SLOTS['4-3-3'];
    return slots[draftTacticalSlotIndex]?.label ?? draftTacticalPlayer.detailedPosition ?? draftTacticalPlayer.position;
  }, [draftTacticalPlayer, draftTacticalSlotIndex, draftFormation]);

  const draftAllowedRoles = useMemo(() => {
    if (!draftTacticalPlayer) return [] as PlayerRole[];
    return getAllowedRolesForSlot(
      draftTacticalSlotLabel || draftTacticalPlayer.detailedPosition || draftTacticalPlayer.position,
      draftTacticalPlayer.position
    );
  }, [draftTacticalPlayer, draftTacticalSlotLabel]);

  const draftActiveSlotRole: PlayerRole | undefined = useMemo(() => {
    if (!draftTacticalPlayer) return undefined;
    const candidate =
      (draftTacticalSlotIndex >= 0 ? draftSlotRoles[draftTacticalSlotIndex] : undefined) ??
      draftTacticalPlayer.role;
    if (draftAllowedRoles.includes(candidate)) return candidate;
    return migrateLegacyRole(
      candidate,
      slotLabelToDetailedPosition(draftTacticalSlotLabel, draftTacticalPlayer.position)
    );
  }, [draftTacticalPlayer, draftTacticalSlotIndex, draftSlotRoles, draftAllowedRoles, draftTacticalSlotLabel]);

  const handleDraftSwapByIds = (id1: string, id2: string) => {
    if (id1 === id2) return;
    playSound('swap', state.settings.soundEnabled);
    const nextStart = [...draftStarting];
    const nextBench = [...draftBench];

    const s1 = nextStart.indexOf(id1);
    const s2 = nextStart.indexOf(id2);
    const b1 = nextBench.indexOf(id1);
    const b2 = nextBench.indexOf(id2);

    if (s1 === -1 && b1 === -1 && s2 === -1 && b2 === -1) return;

    if (s1 !== -1 && s2 !== -1) {
      [nextStart[s1], nextStart[s2]] = [nextStart[s2], nextStart[s1]];
    } else if (s1 !== -1 && b2 !== -1) {
      [nextStart[s1], nextBench[b2]] = [nextBench[b2], nextStart[s1]];
    } else if (b1 !== -1 && s2 !== -1) {
      [nextBench[b1], nextStart[s2]] = [nextStart[s2], nextBench[b1]];
    } else if (b1 !== -1 && b2 !== -1) {
      [nextBench[b1], nextBench[b2]] = [nextBench[b2], nextBench[b1]];
    } else if (s1 !== -1 && b2 === -1 && s2 === -1) {
      nextStart[s1] = id2;
    } else if (s2 !== -1 && b1 === -1 && s1 === -1) {
      nextStart[s2] = id1;
    } else if (b1 !== -1 && b2 === -1 && s2 === -1) {
      nextBench[b1] = id2;
    } else if (b2 !== -1 && b1 === -1 && s1 === -1) {
      nextBench[b2] = id1;
    }
    setDraftStarting(nextStart);
    setDraftBench(nextBench);
    setDraftCompareIds([]);
    setDraftComparisonOpen(false);
    setDraftDragOverCol2Id(null);
  };

  const handleDraftCompareClick = (playerId: string) => {
    playSound('click', state.settings.soundEnabled);
    setDraftComparisonOpen(false);
    setDraftCompareIds((prev) => {
      if (prev.length === 0) return [playerId];
      if (prev.length === 1) {
        if (prev[0] === playerId) return [];
        return [prev[0], playerId];
      }
      if (prev[0] === playerId) return [prev[1]];
      if (prev[1] === playerId) return [prev[0]];
      return [playerId];
    });
  };

  const applyDraftPreset = (preset: TacticalPreset) => {
    const map: Record<TacticalPreset, Partial<TacticsConfig>> = {
      Gegenpress: { buildUpStyle: 'Direct Passing', defensiveApproach: 'High Press', playersInBox: 7, attackingWidth: 7, defensiveLine: 8 },
      'Tiki-Taka': { buildUpStyle: 'Short Passing', defensiveApproach: 'High Press', playersInBox: 8, attackingWidth: 7, defensiveLine: 8 },
      'Counter-Attack': { buildUpStyle: 'Direct Passing', defensiveApproach: 'Mid Block', playersInBox: 6, attackingWidth: 7, defensiveLine: 5 },
      'Wing Play': { buildUpStyle: 'Balanced', defensiveApproach: 'High Press', playersInBox: 7, attackingWidth: 9, defensiveLine: 6 },
      'Park the Bus': { buildUpStyle: 'Long Ball', defensiveApproach: 'Deep Block', playersInBox: 4, attackingWidth: 5, defensiveLine: 3 },
      Balanced: { buildUpStyle: 'Balanced', defensiveApproach: 'Balanced', playersInBox: 6, attackingWidth: 6, defensiveLine: 6 },
    };
    setDraftTactics((prev) => ({ ...prev, preset, ...map[preset] }));
  };

  const runSimulation = (liveMode: boolean, clubOverride?: Club) => {
    if (isSacked) return;
    if (!nextMatchFixture || !rawHomeClub || !rawAwayClub) return;
    const activeUserClub = clubOverride ?? effectiveUserClub;
    const matchHome = rawHomeClub.id === userClub.id ? activeUserClub : rawHomeClub;
    const matchAway = rawAwayClub.id === userClub.id ? activeUserClub : rawAwayClub;
    const validation = validateStartingXI(activeUserClub, activeUserClub.startingIds);
    if (!validation.valid) {
      if (!clubOverride) {
        setUnavailableModalMode(liveMode ? 'live' : 'quick');
        playSound('reject', state.settings.soundEnabled);
        return;
      }
      const parts: string[] = [];
      if (validation.suspendedPlayers.length > 0) {
        parts.push(
          `${t(lang, 'suspendedWarning')} (${validation.suspendedPlayers.map((p) => p.name).join(', ')})`
        );
      }
      if (validation.injuredPlayers.length > 0) {
        parts.push(
          `${t(lang, 'injuredWarning')} (${validation.injuredPlayers.map((p) => p.name).join(', ')})`
        );
      }
      if (validation.loanedOutPlayers.length > 0) {
        parts.push(
          `${t(lang, 'loanOutBadge')} (${validation.loanedOutPlayers.map((p) => p.name).join(', ')})`
        );
      }
      setLineupError(parts.join(' ') || 'Invalid Starting XI');
      playSound('reject', state.settings.soundEnabled);
      return;
    }
    setLineupError(null);
    setUnavailableModalMode(null);
    setFinalizedMatchId(null);
    if (liveMode) {
      playSound('kickoff', state.settings.soundEnabled);
      const userSide: 'HOME' | 'AWAY' = matchHome.id === userClub.id ? 'HOME' : 'AWAY';
      const session = createLiveMatchSession(
        matchHome,
        matchAway,
        nextMatchFixture,
        userSide,
        state.currentDayIndex + 1
      );
      setLiveReport(null);
      setLiveSession(session);
      setLivePlaying(true);
    } else {
      playSound('whistle', state.settings.soundEnabled);
      const rep = simulateMatch(matchHome, matchAway, nextMatchFixture, state.currentDayIndex + 1);
      setLiveSession(null);
      setLivePlaying(false);
      setLiveReport(rep);
    }
  };

  const handleUnavailableAutoReplace = (savePermanent: boolean) => {
    if (!unavailableModalMode || !nextMatchFixture) return;
    const liveMode = unavailableModalMode === 'live';
    const fixed = autoReplaceUnavailableStarters(effectiveUserClub);
    if (savePermanent) {
      onApplyAutoReplaceSave?.(fixed.nextStartingIds, fixed.nextBenchIds);
      onSaveMatchdayOverride(null);
    } else {
      onSaveMatchdayOverride({
        fixtureId: nextMatchFixture.id,
        formation: effectiveUserClub.formation,
        startingIds: fixed.nextStartingIds,
        benchIds: fixed.nextBenchIds,
        tactics: effectiveUserClub.tactics,
        slotRoles: effectiveUserClub.slotRoles,
        teamRoles: effectiveUserClub.teamRoles,
      });
    }
    const patchedClub: Club = {
      ...effectiveUserClub,
      startingIds: fixed.nextStartingIds,
      benchIds: fixed.nextBenchIds,
    };
    setUnavailableModalMode(null);
    runSimulation(liveMode, patchedClub);
  };

  const handleConfirmReport = () => {
    if (!liveReport) return;
    setFinalizedMatchId(liveReport.fixtureId);
    onPendingReportChange?.(null);
    onCompleteMatch(liveReport);
    setLiveReport(null);
  };

  const avgFitness = Math.round(
    effectiveUserClub.players
      .filter((p) => effectiveUserClub.startingIds.includes(p.id))
      .reduce((acc, p) => acc + p.fitness, 0) / 11
  );

  const xiValidation = validateStartingXI(effectiveUserClub, effectiveUserClub.startingIds);
  const suspendedStarters = xiValidation.suspendedPlayers;
  const injuredStarters = xiValidation.injuredPlayers;
  const draftValidation = validateStartingXI(draftClub, draftStarting);

  const activeBannerTheme =
    COMPETITION_THEMES[
      isMatchday && nextMatchFixture ? nextMatchFixture.competitionId : userLeagueId
    ];
  const pendingSummary = state.pendingSeasonSummary ?? null;
  const nextSeasonLabel = formatSeasonLabel((state.seasonIndex ?? 0) + 1);

  const roleConfigs: {
    key: keyof TeamRoles;
    label: string;
    icon: React.ReactNode;
    metricLabel: string;
    getMetric: (p: Player) => number;
  }[] = [
    { key: 'captainId', label: t(lang, 'captainRole'), icon: <Shield className="w-4 h-4 text-amber-300" />, metricLabel: 'OVR', getMetric: (p) => p.ovr },
    { key: 'penaltyId', label: t(lang, 'penaltyTaker'), icon: <Crosshair className="w-4 h-4 text-[#00FF85]" />, metricLabel: 'PEN', getMetric: (p) => p.attributes.shootingDetails?.penalties ?? p.attributes.finishing },
    { key: 'freeKickId', label: t(lang, 'freeKickTaker'), icon: <Sparkles className="w-4 h-4 text-sky-300" />, metricLabel: 'FKA', getMetric: (p) => p.attributes.passingDetails?.fkAccuracy ?? p.attributes.passing },
    { key: 'leftCornerId', label: t(lang, 'leftCornerTaker'), icon: <Flag className="w-4 h-4 text-emerald-300" />, metricLabel: 'CRO', getMetric: (p) => p.attributes.passingDetails?.crossing ?? p.attributes.passing },
    { key: 'rightCornerId', label: t(lang, 'rightCornerTaker'), icon: <Flag className="w-4 h-4 text-teal-300" />, metricLabel: 'CRO', getMetric: (p) => p.attributes.passingDetails?.crossing ?? p.attributes.passing },
  ];

  return (
    <div
      className={
        isMobileLandscape
          ? 'h-full min-h-0 flex flex-col gap-2.5 overflow-y-auto'
          : 'space-y-6'
      }
    >
      {/* Calendar Strip & Day Actions */}
      <div
        className={`shrink-0 pitch-panel rounded-2xl flex flex-col md:flex-row md:items-center justify-between relative overflow-hidden ${
          isMobileLandscape ? 'p-3 gap-2.5' : 'p-4 sm:p-5 gap-4'
        }`}
      >
        <div
          className="absolute top-0 left-0 right-0 h-[2px] opacity-80"
          style={{ backgroundColor: isMatchday ? '#00FF85' : activeBannerTheme.accentColor }}
        />
        <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
          <div
            className="w-11 h-11 rounded-xl border border-white/15 flex items-center justify-center shrink-0 shadow-inner"
            style={{ backgroundColor: activeBannerTheme.headerBg }}
          >
            <Calendar className="w-5 h-5" style={{ color: activeBannerTheme.accentColor }} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-400">
              <span>
                {pendingSummary
                  ? `${pendingSummary.seasonLabel} · ${t(lang, 'seasonComplete')}`
                  : `${currentDay?.dateIso ?? 'Season Complete'} · ${
                      currentDay?.type === 'MATCHDAY' && nextMatchFixture && nextMatchFixture.competitionId !== userLeagueId
                        ? `${COMPETITION_THEMES[nextMatchFixture.competitionId].name} · ${
                            nextMatchFixture.stageLabel ?? `Round ${nextMatchFixture.round}`
                          }`
                        : `Round ${state.currentRound}/${totalRounds}`
                    }`}
              </span>
              {!pendingSummary && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    isMatchday
                      ? 'bg-[#00FF85]/15 text-[#00FF85] border-[#00FF85]/40'
                      : currentDay?.isDeadlineDay
                      ? 'bg-amber-400/15 text-amber-300 border-amber-400/40'
                      : currentDay?.type === 'RECOVERY'
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-400/25'
                      : 'bg-sky-500/10 text-sky-300 border-sky-400/25'
                  }`}
                >
                  {currentDay?.isDeadlineDay
                    ? 'DEADLINE'
                    : currentDay?.type ?? 'DAY'}
                </span>
              )}
            </div>
            <div className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight mt-0.5">
              {pendingSummary
                ? t(lang, 'seasonComplete')
                : currentDay?.isDeadlineDay
                ? t(lang, 'deadlineDayTitle')
                : currentDay?.type === 'RECOVERY'
                ? t(lang, 'recoveryDay')
                : currentDay?.type === 'TRAINING'
                ? t(lang, 'trainingDay')
                : t(lang, 'matchdayLabel')}
            </div>
            <div className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              {currentDay?.isDeadlineDay && !pendingSummary && (
                <span className="font-mono font-bold text-amber-300 tabular-nums">
                  {state.deadlineHoursRemaining ?? 24} / 24 {t(lang, 'hoursRemaining')} ·
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <span className="text-slate-400">XI Avg Fitness:</span>
                <span className="inline-block w-12 h-1.5 rounded-full bg-white/15 overflow-hidden">
                  <span
                    className={`block h-full rounded-full ${
                      avgFitness >= 80 ? 'bg-[#00FF85]' : avgFitness >= 65 ? 'bg-amber-400' : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.max(8, Math.min(100, avgFitness))}%` }}
                  />
                </span>
                <span className="font-mono font-semibold text-emerald-300 tabular-nums">{avgFitness}%</span>
              </span>
              {hasTempOverride && (
                <span className="px-2 py-0.5 rounded-md bg-[#00FF85]/12 border border-[#00FF85]/30 text-[#00FF85] text-[11px] font-semibold">
                  {t(lang, 'tempMatchdayXI')}
                </span>
              )}
              {suspendedStarters.length > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/35 text-rose-300 text-[11px] font-medium">
                  {suspendedStarters.length} {t(lang, 'suspended')}
                </span>
              )}
              {injuredStarters.length > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/35 text-rose-300 text-[11px] font-medium">
                  {injuredStarters.length} {t(lang, 'injured')}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isMatchday && !pendingSummary && (
            currentDay?.isDeadlineDay && onAdvanceDeadlineHour && onAutoAdvanceDeadlineDay ? (
              <>
                <button
                  type="button"
                  disabled={isSacked}
                  onClick={() => {
                    playSound('click', state.settings.soundEnabled);
                    onAdvanceDeadlineHour();
                  }}
                  className="rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold text-xs px-4 py-2.5 cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap shadow-md transition-colors"
                >
                  <Clock className="w-3.5 h-3.5" />
                  {t(lang, 'advanceOneHour')}
                </button>
                <button
                  type="button"
                  disabled={isSacked}
                  onClick={() => {
                    playSound('click', state.settings.soundEnabled);
                    onAutoAdvanceDeadlineDay();
                  }}
                  className="rounded-xl border border-amber-300/45 bg-amber-500/15 hover:bg-amber-500/25 disabled:opacity-40 disabled:cursor-not-allowed text-amber-200 font-semibold text-xs px-4 py-2.5 cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
                >
                  <FastForward className="w-3.5 h-3.5" />
                  {t(lang, 'autoAdvance24h')}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={isSacked}
                  onClick={() => {
                    playSound('click', state.settings.soundEnabled);
                    onAdvanceDay();
                  }}
                  className="rounded-xl pitch-btn-primary disabled:opacity-40 disabled:cursor-not-allowed font-bold text-xs px-4 py-2.5 cursor-pointer whitespace-nowrap"
                >
                  {t(lang, 'advance')}
                </button>
                {!autoAdvancing ? (
                  <button
                    type="button"
                    disabled={isSacked}
                    onClick={() => {
                      setAutoAdvanceStopMsg(null);
                      setAutoAdvancing(true);
                    }}
                    className="rounded-xl border border-white/18 bg-white/[0.07] hover:bg-white/[0.14] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-xs px-4 py-2.5 cursor-pointer whitespace-nowrap transition-colors"
                  >
                    {t(lang, 'autoAdvance')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAutoAdvancing(false)}
                    className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs px-4 py-2.5 cursor-pointer flex items-center gap-1.5 whitespace-nowrap shadow-md transition-colors"
                  >
                    <Square className="w-3.5 h-3.5" />
                    {t(lang, 'stopAdvance')}
                  </button>
                )}
              </>
            )
          )}
          <button
            type="button"
            onClick={openStartingModal}
            className="rounded-xl border border-white/18 bg-white/[0.07] hover:bg-white/[0.14] text-white font-semibold text-xs px-4 py-2.5 cursor-pointer flex items-center gap-1.5 whitespace-nowrap transition-colors"
          >
            <Users className="w-3.5 h-3.5 text-[#00FF85]" />
            {t(lang, 'startingXI')}
          </button>
          {opponentClub && (
            <button
              type="button"
              onClick={() => setShowOpponentModal(true)}
              className="rounded-xl border border-white/18 bg-white/[0.07] hover:bg-white/[0.14] text-white font-semibold text-xs px-4 py-2.5 cursor-pointer whitespace-nowrap transition-colors"
            >
              {t(lang, 'opponentXI')}
            </button>
          )}
        </div>
      </div>

      {isSacked && (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/60 bg-rose-950/75 px-5 py-4 flex flex-wrap items-center justify-between gap-4 text-sm text-rose-100"
        >
          <div className="flex items-start gap-3 min-w-0">
            <Briefcase className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="font-bold text-white">{t(lang, 'sackedTitle')}</div>
              <p className="text-xs text-rose-200 mt-0.5">{t(lang, 'sackedDesc')}</p>
            </div>
          </div>
          {onOpenJobMarket && (
            <button
              type="button"
              onClick={onOpenJobMarket}
              className="rounded-lg bg-[#00FF85] hover:bg-emerald-300 text-slate-950 font-bold text-xs px-4 py-2.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              {t(lang, 'goToJobMarket')}
            </button>
          )}
        </div>
      )}

      {!isSacked && probationLeft !== null && state.boardSatisfaction < 30 && (
        <div
          role="status"
          className="rounded-xl border border-amber-400/50 bg-amber-950/60 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-100"
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />
            <span>
              <strong className="text-amber-300">{t(lang, 'probationWarning')}:</strong>{' '}
              {state.boardSatisfaction}% · <span className="font-mono font-bold">{probationLeft}</span>{' '}
              {t(lang, 'matchesRemaining')}
            </span>
          </div>
          {onOpenJobMarket && (
            <button
              type="button"
              onClick={onOpenJobMarket}
              className="text-xs font-semibold text-amber-200 hover:text-white underline cursor-pointer whitespace-nowrap"
            >
              {t(lang, 'goToJobMarket')}
            </button>
          )}
        </div>
      )}

      {autoAdvanceStopMsg && (
        <div
          role="status"
          className="rounded-xl border border-amber-400/50 bg-amber-950/60 px-4 py-3 flex items-center justify-between gap-3 text-xs text-amber-100"
        >
          <div className="flex items-center gap-2.5">
            <Bell className="w-4 h-4 text-amber-300 shrink-0" />
            <span>
              <strong className="text-amber-300">{t(lang, 'stoppedByAlert')}:</strong>{' '}
              {autoAdvanceStopMsg}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setAutoAdvanceStopMsg(null)}
            className="text-amber-200 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {lineupError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/60 bg-rose-950/70 px-4 py-3 flex items-center gap-3 text-sm text-rose-100"
        >
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{lineupError}</span>
        </div>
      )}

      {/* End-of-Season Promotion & Relegation Summary */}
      {pendingSummary && (
        <section
          className={`rounded-xl border border-white/15 bg-gradient-to-br ${
            COMPETITION_THEMES[pendingSummary.userNextLeagueId].bgGradient
          } p-6 space-y-5`}
        >
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/12">
            <div className="flex items-center gap-3.5">
              <ClubBadge
                clubId={userClub.id}
                name={userClub.name}
                shortName={userClub.shortName}
                primaryColor={userClub.primaryColor}
                secondaryColor={userClub.secondaryColor}
                pattern={userClub.pattern}
                size={52}
              />
              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-emerald-300">
                  {pendingSummary.seasonLabel} · {COMPETITION_THEMES[pendingSummary.userPreviousLeagueId].name}
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
                  {userClub.name} — #{pendingSummary.userFinishRank} ·{' '}
                  {pendingSummary.userOutcome === 'PROMOTED'
                    ? `${t(lang, 'promotedStatus')} → ${COMPETITION_THEMES[pendingSummary.userNextLeagueId].name}`
                    : pendingSummary.userOutcome === 'RELEGATED'
                    ? `${t(lang, 'relegatedStatus')} → ${COMPETITION_THEMES[pendingSummary.userNextLeagueId].name}`
                    : t(lang, 'stayedStatus')}
                </h2>
                <div className="text-xs text-slate-300 mt-0.5 font-mono">
                  {lang === 'vi' ? 'Tiền thưởng cuối mùa' : 'End-of-Season Prize & TV Share'}:{' '}
                  <strong className="text-[#00FF85]">{formatCurrency(pendingSummary.prizeMoney)}</strong>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                playSound('accept', state.settings.soundEnabled);
                onAdvanceNextSeason();
              }}
              className="rounded-lg bg-[#00FF85] hover:bg-emerald-300 text-slate-950 font-bold text-sm px-5 py-3 cursor-pointer flex items-center gap-2 whitespace-nowrap"
            >
              <Trophy className="w-4 h-4" />
              {t(lang, 'advanceNextSeason')} ({nextSeasonLabel})
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {getCountryForLeague(userLeagueId).leagues.map((tier) => {
              const ch = pendingSummary.leagueChampions[tier];
              if (!ch) return null;
              return (
                <div key={tier} className="rounded-lg border border-white/10 bg-black/35 p-3.5">
                  <div className="text-[11px] font-mono text-slate-400">{COMPETITION_THEMES[tier].name}</div>
                  <div className="text-sm font-bold text-white mt-0.5 truncate">{ch.clubName}</div>
                  <div className="text-xs font-mono text-amber-300">{ch.points} pts · Champion</div>
                </div>
              );
            })}
            {(() => {
              const userCountry = getCountryForLeague(userLeagueId);
              const cupId = userCountry.primaryCupId;
              const cupWin = pendingSummary.nationalCupWinners?.[cupId] ?? (cupId === 'FACUP' ? pendingSummary.faCupWinner : undefined);
              if (!cupWin) return null;
              return (
                <div className="rounded-lg border border-white/10 bg-black/35 p-3.5">
                  <div className="text-[11px] font-mono text-rose-300">{COMPETITION_THEMES[cupId].name} Winner</div>
                  <div className="text-sm font-bold text-white mt-0.5 truncate">{cupWin.clubName}</div>
                </div>
              );
            })()}
            {pendingSummary.carabaoWinner && getCountryForLeague(userLeagueId).id === 'ENG' && (
              <div className="rounded-lg border border-white/10 bg-black/35 p-3.5">
                <div className="text-[11px] font-mono text-teal-300">Carabao Cup Winner</div>
                <div className="text-sm font-bold text-white mt-0.5 truncate">
                  {pendingSummary.carabaoWinner.clubName}
                </div>
              </div>
            )}
            {pendingSummary.mlsCupWinner && getCountryForLeague(userLeagueId).id === 'USA' && (
              <div className="rounded-lg border border-white/10 bg-black/35 p-3.5">
                <div className="text-[11px] font-mono text-sky-300">MLS Cup Champion</div>
                <div className="text-sm font-bold text-white mt-0.5 truncate">
                  {pendingSummary.mlsCupWinner.clubName}
                </div>
              </div>
            )}
            {pendingSummary.supercopaWinner && getCountryForLeague(userLeagueId).id === 'ESP' && (
              <div className="rounded-lg border border-amber-400/20 bg-amber-950/30 p-3.5">
                <div className="text-[11px] font-mono text-amber-300">Supercopa de España</div>
                <div className="text-sm font-bold text-white mt-0.5 truncate">
                  {pendingSummary.supercopaWinner.clubName}
                </div>
              </div>
            )}
            {pendingSummary.uefaSuperCupWinner && (
              <div className="rounded-lg border border-sky-400/20 bg-sky-950/35 p-3.5">
                <div className="text-[11px] font-mono text-sky-300">UEFA Super Cup</div>
                <div className="text-sm font-bold text-white mt-0.5 truncate">
                  {pendingSummary.uefaSuperCupWinner.clubName}
                </div>
              </div>
            )}
            {pendingSummary.uclWinner && (
              <div className="rounded-lg border border-blue-400/20 bg-blue-950/35 p-3.5">
                <div className="text-[11px] font-mono text-blue-300">UEFA Champions League</div>
                <div className="text-sm font-bold text-white mt-0.5 truncate">
                  {pendingSummary.uclWinner.clubName}
                </div>
              </div>
            )}
            {pendingSummary.uelWinner && (
              <div className="rounded-lg border border-orange-400/20 bg-orange-950/30 p-3.5">
                <div className="text-[11px] font-mono text-orange-300">UEFA Europa League</div>
                <div className="text-sm font-bold text-white mt-0.5 truncate">
                  {pendingSummary.uelWinner.clubName}
                </div>
              </div>
            )}
            {pendingSummary.ueclWinner && (
              <div className="rounded-lg border border-emerald-400/20 bg-emerald-950/30 p-3.5">
                <div className="text-[11px] font-mono text-emerald-300">UEFA Conference League</div>
                <div className="text-sm font-bold text-white mt-0.5 truncate">
                  {pendingSummary.ueclWinner.clubName}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingSummary.movements
              .filter((mv) => {
                const uc = getCountryForLeague(userLeagueId);
                return uc.leagues.includes(mv.fromLeague as typeof uc.leagues[number]) || mv.clubIds.includes(userClub.id);
              })
              .map((mv) => (
              <div
                key={`${mv.fromLeague}_${mv.toLeague}`}
                className="rounded-lg border border-white/10 bg-black/35 p-3.5 space-y-2"
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-white">
                    {mv.direction === 'PROMOTED' ? (
                      <ArrowUpRight className="w-4 h-4 text-[#00FF85]" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4 text-rose-400" />
                    )}
                    {COMPETITION_THEMES[mv.fromLeague].shortName} → {COMPETITION_THEMES[mv.toLeague].shortName}
                  </span>
                  <span
                    className={`font-mono text-[11px] ${
                      mv.direction === 'PROMOTED' ? 'text-[#00FF85]' : 'text-rose-400'
                    }`}
                  >
                    {mv.direction === 'PROMOTED' ? t(lang, 'promotedStatus') : t(lang, 'relegatedStatus')}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {mv.clubNames.map((name, idx) => (
                    <span
                      key={mv.clubIds[idx]}
                      className={`px-2 py-0.5 rounded text-xs font-medium border ${
                        mv.clubIds[idx] === userClub.id
                          ? 'border-[#00FF85] bg-[#00FF85]/15 text-white font-bold'
                          : 'border-white/10 bg-white/5 text-slate-200'
                      }`}
                    >
                      {name}
                      {mv.viaPlayoffClubId === mv.clubIds[idx] ? ' (PO)' : ''}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {pendingSummary.playoffs.length > 0 && (
            <div className="text-xs text-slate-300 border-t border-white/10 pt-3 flex flex-wrap gap-x-5 gap-y-1">
              {pendingSummary.playoffs.map((po) => (
                <span key={po.competitionId} className="font-mono">
                  <strong className="text-white">{COMPETITION_THEMES[po.competitionId].shortName} PO Final:</strong>{' '}
                  {po.finalSummary}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Interactive 2D Live Tactical Match Sim Popup (Locked until Full Time) */}
      {!pendingSummary && liveSession && (
        <LiveMatchArena
          session={liveSession}
          language={lang}
          soundEnabled={state.settings.soundEnabled}
          isPlaying={livePlaying}
          speed={liveSpeed}
          stepDurationMs={liveSpeed === 4 ? 280 : liveSpeed === 2 ? 550 : 1000}
          onTogglePlay={() => setLivePlaying((prev) => !prev)}
          onPauseForTactics={() => setLivePlaying(false)}
          onChangeSpeed={setLiveSpeed}
          onUpdateSession={setLiveSession}
          onJumpToFullTime={() => {
            const finished = finishLiveMatchToEnd(liveSession);
            setLivePlaying(false);
            setLiveSession(finished);
          }}
          onFinishMatch={() => {
            const finalReport = finalizeLiveMatchReport(liveSession);
            setLivePlaying(false);
            setLiveSession(null);
            setLiveReport(finalReport);
          }}
        />
      )}

      {/* Locked Post-Match Result & Report Popup (Only closes when match is confirmed) */}
      {!pendingSummary && !liveSession && liveReport && homeClub && awayClub && (
        <ModalPortal>
        <div
          className="safe-area-x fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Match Result & Report"
        >
          <div className="animate-modal-pop w-full max-w-5xl max-h-[96dvh] overflow-y-auto rounded-2xl pitch-modal-shell">
            <div
              className={`px-4 sm:px-6 py-3 sm:py-4 border-b border-white/10 bg-gradient-to-br ${
                COMPETITION_THEMES[liveReport.competitionId].bgGradient
              } space-y-3 sm:space-y-4`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                <div className="font-mono uppercase tracking-wider">
                  {COMPETITION_THEMES[liveReport.competitionId].name} ·{' '}
                  {nextMatchFixture?.stageLabel ?? `Round ${liveReport.round}`} · {homeClub.stadium}
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/35 px-2.5 py-0.5 text-[10px] font-mono text-slate-300">
                    <Lock className="w-3 h-3 text-[#00FF85]" />
                    {lang === 'vi' ? 'Hoàn tất để đóng bảng trận đấu' : 'Confirm result to exit'}
                  </span>
                  <span className="font-mono font-bold text-[#00FF85]">FULL TIME</span>
                </div>
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
                <div className="flex items-center justify-end gap-3 min-w-0 text-right">
                  <div className="min-w-0">
                    <div className="font-display text-lg sm:text-2xl font-bold text-white truncate">
                      {homeClub.name}
                    </div>
                    <div className="text-xs text-slate-400 font-mono">
                      Rank {getRank(homeClub.id)}
                    </div>
                  </div>
                  <ClubBadge
                    clubId={homeClub.id}
                    name={homeClub.name}
                    shortName={homeClub.shortName}
                    primaryColor={homeClub.primaryColor}
                    secondaryColor={homeClub.secondaryColor}
                    pattern={homeClub.pattern}
                    size={48}
                  />
                </div>

                <div className="px-4 py-2 rounded-xl bg-black/60 border border-white/15 text-center">
                  <div className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white tabular-nums leading-none">
                    {liveReport.homeGoals} <span className="text-slate-500">:</span> {liveReport.awayGoals}
                  </div>
                  <div className="text-[10px] font-mono text-[#00FF85] mt-1">90&apos; FT</div>
                </div>

                <div className="flex items-center justify-start gap-3 min-w-0 text-left">
                  <ClubBadge
                    clubId={awayClub.id}
                    name={awayClub.name}
                    shortName={awayClub.shortName}
                    primaryColor={awayClub.primaryColor}
                    secondaryColor={awayClub.secondaryColor}
                    pattern={awayClub.pattern}
                    size={48}
                  />
                  <div className="min-w-0">
                    <div className="font-display text-lg sm:text-2xl font-bold text-white truncate">
                      {awayClub.name}
                    </div>
                    <div className="text-xs text-slate-400 font-mono">
                      Rank {getRank(awayClub.id)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 sm:p-6">
              <MatchReportPanel
                report={liveReport}
                homeClub={homeClub}
                awayClub={awayClub}
                language={lang}
                liveMinute={90}
                actionSlot={
                  finalizedMatchId !== liveReport.fixtureId ? (
                    <button
                      type="button"
                      onClick={() => {
                        playSound('accept', state.settings.soundEnabled);
                        handleConfirmReport();
                      }}
                      className="rounded-lg bg-[#00FF85] hover:bg-emerald-300 text-slate-950 font-bold text-xs px-4 py-2 cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap shadow-lg"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {t(lang, 'finishAndExitMatch')}
                    </button>
                  ) : null
                }
              />
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Pre-Match Card (Inside Matchday; match & report live in the locked popup above) */}
      {!pendingSummary && !liveSession && !liveReport && nextMatchFixture && homeClub && awayClub && (() => {
        const compTheme = COMPETITION_THEMES[nextMatchFixture.competitionId];
        const calcXiOvr = (c: Club) => {
          const xi = c.startingIds
            .map((id) => c.players.find((p) => p.id === id))
            .filter((p): p is Player => Boolean(p));
          const pool = xi.length > 0 ? xi : c.players.slice(0, 11);
          return Math.round(pool.reduce((s, p) => s + p.ovr, 0) / Math.max(1, pool.length));
        };
        const homeXiOvr = calcXiOvr(homeClub);
        const awayXiOvr = calcXiOvr(awayClub);
        return (
        <section
          className={`relative overflow-hidden rounded-2xl border border-white/14 bg-gradient-to-br ${compTheme.bgGradient} shadow-[0_20px_50px_-20px_rgba(0,0,0,0.85)] ${
            isMobileLandscape ? 'p-3.5 flex-1 min-h-0 flex flex-col justify-between' : 'p-5 sm:p-7'
          }`}
        >
          {/* Dual-club atmospheric radial split glow */}
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              background: `radial-gradient(circle at 18% 50%, ${homeClub.primaryColor}55, transparent 48%), radial-gradient(circle at 82% 50%, ${awayClub.primaryColor}55, transparent 48%)`,
            }}
            aria-hidden="true"
          />
          <div
            className="absolute top-0 left-0 right-0 h-[2px]"
            style={{ backgroundColor: compTheme.accentColor }}
          />

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 pb-3 sm:pb-4 border-b border-white/10 text-xs text-slate-200">
            <div className="flex items-center gap-2 font-medium">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: compTheme.accentColor }}
              />
              <span>
                {compTheme.name} · {nextMatchFixture.stageLabel ?? `Round ${nextMatchFixture.round}`} · {homeClub.stadium}
              </span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/40 border border-white/12 font-mono text-[11px] font-bold text-[#00FF85]">
              {isMatchday && <span className="w-1.5 h-1.5 rounded-full bg-[#00FF85] animate-pulse" />}
              {t(lang, 'preMatch')}
            </div>
          </div>

          <div className={`relative z-10 ${isMobileLandscape ? 'py-2' : 'py-5 sm:py-8'} grid grid-cols-3 items-center gap-3 sm:gap-6`}>
            <div className="flex flex-col sm:flex-row items-center sm:justify-end gap-3 sm:gap-4 text-center sm:text-right min-w-0">
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                  {lang === 'vi' ? 'Sân nhà' : 'Home'} · {homeClub.formation}
                </div>
                <div className="font-display text-xl sm:text-3xl font-extrabold text-white tracking-tight truncate">
                  {homeClub.name}
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-center sm:justify-end gap-1.5 text-[11px] font-mono">
                  <span className="px-2 py-0.5 rounded bg-black/40 border border-white/10 text-slate-200">
                    Rank {getRank(homeClub.id)}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-[#00FF85]/30 text-[#00FF85] font-bold">
                    XI {homeXiOvr}
                  </span>
                </div>
              </div>
              <div className="p-2 rounded-2xl bg-black/35 border border-white/10 shadow-lg shrink-0">
                <ClubBadge
                  clubId={homeClub.id}
                  name={homeClub.name}
                  shortName={homeClub.shortName}
                  primaryColor={homeClub.primaryColor}
                  secondaryColor={homeClub.secondaryColor}
                  pattern={homeClub.pattern}
                  size={isMobileLandscape ? 42 : 60}
                />
              </div>
            </div>

            <div className="text-center flex flex-col items-center justify-center">
              <div className="px-4 py-2 rounded-2xl bg-black/50 border border-white/12 backdrop-blur-md shadow-inner">
                <div className="font-display text-3xl sm:text-4xl font-extrabold tracking-widest text-white/90 leading-none">
                  VS
                </div>
                <div className="text-[11px] text-slate-300 font-mono mt-1 tabular-nums">
                  {nextMatchFixture.dateIso}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center sm:justify-start gap-3 sm:gap-4 text-center sm:text-left min-w-0">
              <div className="p-2 rounded-2xl bg-black/35 border border-white/10 shadow-lg shrink-0">
                <ClubBadge
                  clubId={awayClub.id}
                  name={awayClub.name}
                  shortName={awayClub.shortName}
                  primaryColor={awayClub.primaryColor}
                  secondaryColor={awayClub.secondaryColor}
                  pattern={awayClub.pattern}
                  size={isMobileLandscape ? 42 : 60}
                />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                  {lang === 'vi' ? 'Sân khách' : 'Away'} · {awayClub.formation}
                </div>
                <div className="font-display text-xl sm:text-3xl font-extrabold text-white tracking-tight truncate">
                  {awayClub.name}
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-center sm:justify-start gap-1.5 text-[11px] font-mono">
                  <span className="px-2 py-0.5 rounded bg-black/40 border border-white/10 text-slate-200">
                    Rank {getRank(awayClub.id)}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-sky-500/15 border border-sky-400/30 text-sky-300 font-bold">
                    XI {awayXiOvr}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {isMatchday && (
            <div className="relative z-10 pt-4 border-t border-white/10 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                disabled={isSacked}
                onClick={() => runSimulation(false)}
                className="rounded-xl pitch-btn-primary disabled:opacity-40 disabled:cursor-not-allowed font-bold text-sm px-6 py-2.5 cursor-pointer flex items-center gap-2 whitespace-nowrap"
              >
                <Play className="w-4 h-4" />
                {t(lang, 'quickSim')}
              </button>
              <button
                type="button"
                disabled={isSacked}
                onClick={() => runSimulation(true)}
                className="rounded-xl border border-white/25 bg-white/[0.1] hover:bg-white/[0.18] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm px-6 py-2.5 cursor-pointer flex items-center gap-2 whitespace-nowrap backdrop-blur-md transition-colors"
              >
                <Eye className="w-4 h-4 text-[#00FF85]" />
                {t(lang, 'liveSim')}
              </button>
            </div>
          )}

          {!isMatchday && (
            <div className="relative z-10 pt-3 border-t border-white/10 text-center text-xs text-slate-300">
              {currentDay?.isDeadlineDay
                ? lang === 'vi'
                  ? `Transfer Deadline Day: còn ${state.deadlineHoursRemaining ?? 24} giờ — tiến từng giờ (+1h) hoặc tua nhanh 24 giờ.`
                  : `Transfer Deadline Day: ${state.deadlineHoursRemaining ?? 24}h remaining — advance hour by hour (+1h) or auto-advance 24h.`
                : lang === 'vi'
                ? 'Nhấn Tiếp tục hoặc Tự động tiến qua ngày Hồi phục & Tập luyện để tới Ngày đấu.'
                : 'Advance through Recovery and Training days to reach Matchday.'}
            </div>
          )}
        </section>
        );
      })()}

      {/* Full Temporary 1-Match Starting XI Editor Modal */}
      {showStartingModal && (
        <ModalPortal>
        <div
          className={`safe-area-x fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center ${
            isMobileLandscape ? 'p-2' : 'p-4'
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="Starting XI"
        >
          <div
            className={`animate-modal-pop w-full max-w-6xl rounded-2xl pitch-modal-shell text-slate-100 overflow-hidden flex flex-col ${
              isMobileLandscape ? 'h-[94dvh] max-h-[94dvh]' : 'max-h-[92vh]'
            }`}
          >
            {/* Modal Header */}
            <div
              className={`shrink-0 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-black/35 ${
                isMobileLandscape ? 'px-3.5 py-2' : 'gap-3 px-5 py-3.5'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <ClubBadge
                  clubId={userClub.id}
                  name={userClub.name}
                  shortName={userClub.shortName}
                  primaryColor={userClub.primaryColor}
                  secondaryColor={userClub.secondaryColor}
                  pattern={userClub.pattern}
                  size={isMobileLandscape ? 28 : 34}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3
                      className={`font-display font-bold text-white ${
                        isMobileLandscape ? 'text-lg' : 'text-xl'
                      }`}
                    >
                      {t(lang, 'startingXI')} · {userClub.name}
                    </h3>
                    <span className="text-[11px] font-mono font-bold text-[#00FF85]">
                      · {t(lang, 'tempMatchdayXI')}
                    </span>
                  </div>
                  {!isMobileLandscape && (
                    <p className="text-[11px] text-slate-400">{t(lang, 'tempMatchdayNote')}</p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={resetDraftToSaved}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/6 hover:bg-white/12 text-slate-200 font-semibold text-xs px-3 py-1.5 cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {t(lang, 'resetSavedLineup')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!nextMatchFixture) return;
                    onSaveMatchdayOverride({
                      fixtureId: nextMatchFixture.id,
                      formation: draftFormation,
                      startingIds: draftStarting,
                      benchIds: draftBench,
                      tactics: draftTactics,
                      slotRoles: draftSlotRoles,
                      teamRoles: draftTeamRoles,
                    });
                    setShowStartingModal(false);
                  }}
                  className="rounded-lg bg-[#00FF85] hover:bg-emerald-300 text-slate-950 font-bold text-xs px-4 py-1.5 cursor-pointer whitespace-nowrap"
                >
                  {t(lang, 'applyOneMatch')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowStartingModal(false)}
                  className="rounded-lg border border-white/20 bg-white/8 hover:bg-white/15 text-white font-semibold text-xs px-3.5 py-1.5 cursor-pointer whitespace-nowrap"
                >
                  {t(lang, 'cancel')}
                </button>
              </div>
            </div>

            {/* Sub-Tabs Bar + Formation Select */}
            <div
              className={`shrink-0 border-b border-white/10 bg-black/25 flex flex-wrap items-center justify-between gap-2 ${
                isMobileLandscape ? 'px-3.5 py-1.5' : 'px-5 py-2.5 gap-3'
              }`}
            >
              <div className="flex items-center gap-1 p-1 rounded-lg bg-black/45 border border-white/15">
                {(
                  [
                    ['squad', t(lang, 'lineupTabSquad'), <Users className="w-3.5 h-3.5" key="s" />],
                    ['tactical', t(lang, 'lineupTabTactical'), <Sliders className="w-3.5 h-3.5" key="t" />],
                    ['roles', t(lang, 'lineupTabRoles'), <Award className="w-3.5 h-3.5" key="r" />],
                  ] as const
                ).map(([id, label, icon]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setModalTab(id)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap ${
                      modalTab === id
                        ? 'bg-[#00FF85] text-slate-950 font-bold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {icon}
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{t(lang, 'formation')}:</span>
                <select
                  aria-label="Matchday Formation"
                  value={draftFormation}
                  onChange={(e) => {
                    const nextF = e.target.value as FormationName;
                    setDraftFormation(nextF);
                    setDraftTactics((prev) => ({ ...prev, formation: nextF }));
                  }}
                  className="rounded-lg border border-white/20 bg-black/50 px-3 py-1.5 text-xs font-mono text-white"
                >
                  {FORMATIONS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Modal Body */}
            <div
              className={
                isMobileLandscape
                  ? 'p-2.5 flex-1 min-h-0 flex flex-col gap-2 overflow-hidden'
                  : 'p-5 overflow-y-auto space-y-5'
              }
            >
              {(draftValidation.suspendedPlayers.length > 0 ||
                draftValidation.injuredPlayers.length > 0 ||
                draftValidation.loanedOutPlayers.length > 0) && (
                <div className="shrink-0 rounded-lg border border-rose-500/50 bg-rose-950/50 px-3.5 py-2 flex flex-wrap items-center gap-2 text-xs text-rose-200">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  {draftValidation.suspendedPlayers.length > 0 && (
                    <span>
                      {t(lang, 'suspended')}: {draftValidation.suspendedPlayers.map((p) => p.name).join(', ')}
                    </span>
                  )}
                  {draftValidation.injuredPlayers.length > 0 && (
                    <span>
                      {t(lang, 'injured')}: {draftValidation.injuredPlayers.map((p) => p.name).join(', ')}
                    </span>
                  )}
                  {draftValidation.loanedOutPlayers.length > 0 && (
                    <span>
                      {t(lang, 'loanOutBadge')}: {draftValidation.loanedOutPlayers.map((p) => p.name).join(', ')}
                    </span>
                  )}
                </div>
              )}

              {modalTab === 'squad' && (
                <div
                  className={
                    isMobileLandscape
                      ? 'grid grid-cols-12 gap-2 flex-1 min-h-0 overflow-hidden'
                      : 'grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-5 items-start'
                  }
                >
                  {isMobileLandscape ? (
                    <>
                      {/* Mobile Landscape Col 1: 2D Pitch */}
                      <div className="col-span-5 h-full min-h-0 flex flex-col rounded-xl border border-white/12 bg-black/30 p-2 overflow-hidden">
                        <PitchBoard
                          club={draftClub}
                          formation={draftFormation}
                          startingIds={draftStarting}
                          benchIds={draftBench}
                          selectedPlayerIds={draftCompareIds}
                          displayMode="squad"
                          hideBench
                          teamRoles={draftTeamRoles}
                          onSelectPlayer={handleDraftCompareClick}
                          onSwapPlayers={handleDraftSwapByIds}
                        />
                      </div>

                      {/* Mobile Landscape Col 2: Tabbed Subs (9) / Reserves */}
                      <div className="col-span-3 h-full min-h-0 flex flex-col rounded-xl border border-white/12 bg-black/35 p-2 overflow-hidden">
                        <div className="shrink-0 grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-black/50 border border-white/10 mb-1.5">
                          <button
                            type="button"
                            onClick={() => setModalBenchTab('subs')}
                            onDragOver={(e) => {
                              e.preventDefault();
                              if (modalBenchTab !== 'subs') setModalBenchTab('subs');
                            }}
                            className={`py-1 px-1 rounded text-[11px] font-semibold cursor-pointer truncate ${
                              modalBenchTab === 'subs'
                                ? 'bg-[#00FF85] text-slate-950 font-bold'
                                : 'text-slate-300 hover:text-white'
                            }`}
                          >
                            {lang === 'vi'
                              ? `Dự bị (${draftBenchPlayers.length}/9)`
                              : `Subs (${draftBenchPlayers.length}/9)`}
                          </button>
                          <button
                            type="button"
                            onClick={() => setModalBenchTab('reserves')}
                            onDragOver={(e) => {
                              e.preventDefault();
                              if (modalBenchTab !== 'reserves') setModalBenchTab('reserves');
                            }}
                            className={`py-1 px-1 rounded text-[11px] font-semibold cursor-pointer truncate ${
                              modalBenchTab === 'reserves'
                                ? 'bg-[#00FF85] text-slate-950 font-bold'
                                : 'text-slate-300 hover:text-white'
                            }`}
                          >
                            {lang === 'vi'
                              ? `Dự phòng (${draftReserves.length})`
                              : `Reserves (${draftReserves.length})`}
                          </button>
                        </div>

                        <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1">
                          {(modalBenchTab === 'subs' ? draftBenchPlayers : draftReserves).length === 0 ? (
                            <div className="text-[11px] text-slate-400 py-6 text-center">
                              {modalBenchTab === 'subs'
                                ? lang === 'vi'
                                  ? 'Chưa có cầu thủ dự bị.'
                                  : 'No substitutes selected.'
                                : lang === 'vi'
                                ? 'Không có cầu thủ dự phòng.'
                                : 'No reserve players.'}
                            </div>
                          ) : (
                            (modalBenchTab === 'subs' ? draftBenchPlayers : draftReserves).map((player) => {
                              const isSuspended = player.suspendedMatches > 0;
                              const isInjured = (player.injuredMatches ?? 0) > 0;
                              const isDropTarget = draftDragOverCol2Id === player.id;
                              return (
                                <button
                                  key={player.id}
                                  type="button"
                                  draggable
                                  data-player-id={player.id}
                                  data-bench={modalBenchTab === 'subs' ? 'true' : undefined}
                                  onDragStart={(e) => {
                                    e.dataTransfer.effectAllowed = 'move';
                                    e.dataTransfer.setData('text/plain', player.id);
                                  }}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = 'move';
                                    if (draftDragOverCol2Id !== player.id) setDraftDragOverCol2Id(player.id);
                                  }}
                                  onDragLeave={() => {
                                    if (draftDragOverCol2Id === player.id) setDraftDragOverCol2Id(null);
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    const sourceId = e.dataTransfer.getData('text/plain');
                                    setDraftDragOverCol2Id(null);
                                    if (sourceId && sourceId !== player.id) handleDraftSwapByIds(sourceId, player.id);
                                  }}
                                  onClick={() => handleDraftCompareClick(player.id)}
                                  className={`w-full flex items-center justify-between gap-1.5 rounded-lg border px-2 py-1 text-left cursor-grab active:cursor-grabbing ${
                                    isDropTarget
                                      ? 'border-[#00FF85] bg-emerald-500/20'
                                      : draftCompareIds.includes(player.id)
                                      ? 'border-sky-400 bg-sky-500/15'
                                      : isSuspended || isInjured
                                      ? 'border-rose-500/55 bg-rose-950/35'
                                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <PlayerAvatar
                                      playerId={player.id}
                                      name={player.name}
                                      shirtNumber={player.shirtNumber}
                                      position={player.position}
                                      primaryColor={userClub.primaryColor}
                                      secondaryColor={userClub.secondaryColor}
                                      size={26}
                                    />
                                    <div className="min-w-0">
                                      <div className="text-[11px] font-semibold text-white truncate">
                                        {player.name}
                                      </div>
                                      <div className="text-[9px] font-mono text-slate-400 flex items-center gap-1">
                                        <span>{player.detailedPosition ?? player.position}</span>
                                        <FitnessBar fitness={player.fitness} widthClass="w-7" />
                                        {(isSuspended || isInjured) && (
                                          <span className="text-rose-300">{isSuspended ? 'SUS' : 'INJ'}</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <span className="font-mono text-xs font-bold text-emerald-300 tabular-nums shrink-0">
                                    {player.ovr}
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Original Desktop 2-Col Squad Layout */
                    <div className="md:col-span-7 space-y-4 sm:space-y-5">
                      <PitchBoard
                        club={draftClub}
                        formation={draftFormation}
                        startingIds={draftStarting}
                        benchIds={draftBench}
                        selectedPlayerIds={draftCompareIds}
                        displayMode="squad"
                        teamRoles={draftTeamRoles}
                        onSelectPlayer={handleDraftCompareClick}
                        onSwapPlayers={handleDraftSwapByIds}
                      />

                      {draftReserves.length > 0 && (
                        <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
                          <div className="flex items-center justify-between text-xs border-b border-white/10 pb-2">
                            <span className="font-bold text-white">
                              {lang === 'vi' ? `Cầu thủ dự phòng (${draftReserves.length})` : `Reserves (${draftReserves.length})`}
                            </span>
                            <span className="text-slate-400">
                              {lang === 'vi'
                                ? 'Kéo thả 2 chiều với sân / dự bị'
                                : 'Drag & drop with pitch or bench'}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {draftReserves.map((player) => {
                              const isSuspended = player.suspendedMatches > 0;
                              const isInjured = (player.injuredMatches ?? 0) > 0;
                              const isDropTarget = draftDragOverCol2Id === player.id;
                              return (
                                <button
                                  key={player.id}
                                  type="button"
                                  draggable
                                  onDragStart={(e) => {
                                    e.dataTransfer.effectAllowed = 'move';
                                    e.dataTransfer.setData('text/plain', player.id);
                                  }}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = 'move';
                                    if (draftDragOverCol2Id !== player.id) setDraftDragOverCol2Id(player.id);
                                  }}
                                  onDragLeave={() => {
                                    if (draftDragOverCol2Id === player.id) setDraftDragOverCol2Id(null);
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    const sourceId = e.dataTransfer.getData('text/plain');
                                    setDraftDragOverCol2Id(null);
                                    if (sourceId && sourceId !== player.id) handleDraftSwapByIds(sourceId, player.id);
                                  }}
                                  onClick={() => handleDraftCompareClick(player.id)}
                                  className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left cursor-grab active:cursor-grabbing ${
                                    isDropTarget
                                      ? 'border-[#00FF85] bg-emerald-500/20'
                                      : draftCompareIds.includes(player.id)
                                      ? 'border-sky-400 bg-sky-500/15'
                                      : isSuspended || isInjured
                                      ? 'border-rose-500/55 bg-rose-950/35'
                                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <PlayerAvatar
                                      playerId={player.id}
                                      name={player.name}
                                      shirtNumber={player.shirtNumber}
                                      position={player.position}
                                      primaryColor={userClub.primaryColor}
                                      secondaryColor={userClub.secondaryColor}
                                      size={34}
                                    />
                                    <div className="min-w-0">
                                      <div className="text-xs font-semibold text-white truncate">
                                        {player.name}
                                      </div>
                                      <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5">
                                        <span>{player.detailedPosition ?? player.position}</span>
                                        <FitnessBar fitness={player.fitness} />
                                        {(isSuspended || isInjured) && (
                                          <span className="text-rose-300">{isSuspended ? 'SUS' : 'INJ'}</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <span className="font-mono text-xs font-bold text-emerald-300 tabular-nums">
                                    {player.ovr}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Inspector / 2-Player Side-by-Side Overview */}
                  <aside
                    className={
                      isMobileLandscape
                        ? 'col-span-4 rounded-xl border border-white/12 bg-black/35 p-2.5 space-y-2.5 h-full min-h-0 overflow-y-auto'
                        : 'md:col-span-5 rounded-xl border border-white/12 bg-black/35 p-3.5 sm:p-4 space-y-4'
                    }
                  >
                    {draftCompareIds.length === 0 && (
                      <div className="py-10 px-3 text-center space-y-2.5">
                        <Users className="w-7 h-7 text-[#00FF85] mx-auto opacity-80" />
                        <div className="font-display text-base font-bold text-white">
                          {lang === 'vi' ? 'Kiểm tra & So sánh cầu thủ' : 'Player Inspector & Comparison'}
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {t(lang, 'selectToInspect')}
                        </p>
                      </div>
                    )}

                    {draftCompareIds.length === 1 && (() => {
                      const p = userClub.players.find((pl) => pl.id === draftCompareIds[0]);
                      if (!p) return null;
                      const sIdx = draftStarting.indexOf(p.id);
                      const slots = FORMATION_SLOTS[draftFormation] ?? FORMATION_SLOTS['4-3-3'];
                      const slotLabel = sIdx >= 0 ? slots[sIdx]?.label ?? p.detailedPosition ?? p.position : p.detailedPosition ?? p.position;
                      const slotEval = sIdx >= 0 ? getPlayerSlotEvaluation(p, slotLabel) : { effectiveOvr: p.ovr, delta: 0 };
                      const faceStats = [
                        ['PAC', p.attributes.pace],
                        ['SHO', p.attributes.finishing],
                        ['PAS', p.attributes.passing],
                        ['DRI', p.attributes.dribbling],
                        ['DEF', p.attributes.defending],
                        ['PHY', p.attributes.physical],
                        ['GK', p.attributes.goalkeeper],
                      ] as const;

                      return (
                        <div className="space-y-3.5">
                          <div className="flex items-center justify-between border-b border-white/10 pb-2">
                            <span className="text-[11px] font-mono text-sky-300">
                              {lang === 'vi' ? 'Chọn thêm 1 cầu thủ để so sánh' : 'Select another player to compare'}
                            </span>
                            <button
                              type="button"
                              onClick={() => setDraftCompareIds([])}
                              className="text-xs text-slate-400 hover:text-white cursor-pointer"
                            >
                              {t(lang, 'clearSelection')}
                            </button>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <PlayerAvatar
                                playerId={p.id}
                                name={p.name}
                                shirtNumber={p.shirtNumber}
                                position={p.position}
                                primaryColor={userClub.primaryColor}
                                secondaryColor={userClub.secondaryColor}
                                size={54}
                              />
                              <div className="min-w-0">
                                <div className="font-display text-xl font-bold text-white truncate">{p.name}</div>
                                <div className="text-xs font-mono text-[#00FF85]">
                                  {p.detailedPosition ?? p.position} · #{p.shirtNumber} · Fit {p.fitness}%
                                </div>
                              </div>
                            </div>
                            <div className="text-right font-mono shrink-0">
                              <div className="text-3xl font-extrabold text-[#00FF85] tabular-nums">{slotEval.effectiveOvr}</div>
                              <div className="text-[10px] text-slate-400">POT {p.potential}</div>
                            </div>
                          </div>

                          <div className="grid grid-cols-7 gap-1 text-center">
                            {faceStats.map(([lbl, val]) => (
                              <div key={lbl} className="rounded bg-white/5 py-1.5">
                                <div className="text-[9px] font-mono text-slate-400">{lbl}</div>
                                <div className="text-xs font-mono font-bold text-white tabular-nums">{val}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {draftCompareIds.length === 2 && (() => {
                      const pA = userClub.players.find((p) => p.id === draftCompareIds[0]);
                      const pB = userClub.players.find((p) => p.id === draftCompareIds[1]);
                      if (!pA || !pB) return null;
                      return (
                        <div className="space-y-3.5">
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-white/10">
                            <span className="font-display text-base font-bold text-white">
                              {lang === 'vi' ? 'Tổng quan 2 cầu thủ' : 'Overview Comparison'}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setDraftComparisonOpen(true)}
                                className="inline-flex items-center gap-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs px-2.5 py-1.5 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                {lang === 'vi' ? 'View' : 'View'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDraftSwapByIds(pA.id, pB.id)}
                                className="inline-flex items-center gap-1 rounded-lg bg-[#00FF85] hover:bg-emerald-300 text-slate-950 font-bold text-xs px-2.5 py-1.5 cursor-pointer"
                              >
                                <ArrowLeftRight className="w-3.5 h-3.5" />
                                {t(lang, 'swapSelected')}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDraftCompareIds([]);
                                  setDraftComparisonOpen(false);
                                }}
                                className="rounded-lg border border-white/20 bg-white/8 hover:bg-white/15 text-slate-200 text-xs px-2 py-1.5 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {[
                              { p: pA, other: pB, border: 'border-[#00FF85]/45' },
                              { p: pB, other: pA, border: 'border-sky-400/45' },
                            ].map(({ p, other, border }) => {
                              const sIdx = draftStarting.indexOf(p.id);
                              const slots = FORMATION_SLOTS[draftFormation] ?? FORMATION_SLOTS['4-3-3'];
                              const slotLabel = sIdx >= 0 ? slots[sIdx]?.label ?? p.detailedPosition ?? p.position : p.detailedPosition ?? p.position;
                              const slotEval = sIdx >= 0 ? getPlayerSlotEvaluation(p, slotLabel) : { effectiveOvr: p.ovr, delta: 0 };
                              const stats = [
                                ['PAC', p.attributes.pace, other.attributes.pace],
                                ['SHO', p.attributes.finishing, other.attributes.finishing],
                                ['PAS', p.attributes.passing, other.attributes.passing],
                                ['DRI', p.attributes.dribbling, other.attributes.dribbling],
                                ['DEF', p.attributes.defending, other.attributes.defending],
                                [p.position === 'GK' ? 'GK' : 'PHY', p.position === 'GK' ? p.attributes.goalkeeper : p.attributes.physical, p.position === 'GK' ? other.attributes.goalkeeper : other.attributes.physical],
                              ] as const;

                              return (
                                <div key={p.id} className={`rounded-lg border ${border} bg-black/35 p-3 space-y-2.5`}>
                                  <div className="flex items-center gap-2 min-w-0">
                                    <PlayerAvatar
                                      playerId={p.id}
                                      name={p.name}
                                      shirtNumber={p.shirtNumber}
                                      position={p.position}
                                      primaryColor={userClub.primaryColor}
                                      secondaryColor={userClub.secondaryColor}
                                      size={40}
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="text-xs font-bold text-white truncate">{p.name}</div>
                                      <div className="text-[10px] font-mono text-[#00FF85]">
                                        {p.detailedPosition ?? p.position} · #{p.shirtNumber} · OVR {slotEval.effectiveOvr}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="space-y-1 text-[10px] border-t border-white/10 pt-2">
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Fit / Age</span>
                                      <span className="font-mono text-white">{p.fitness}% · {p.age}y</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">{t(lang, 'marketValue')}</span>
                                      <span className="font-mono text-white">{formatCurrency(p.marketValue)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">{t(lang, 'weeklyWage')}</span>
                                      <span className="font-mono text-white">{formatCurrency(p.weeklyWage)}</span>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-white/10 text-center">
                                    {stats.map(([lbl, v1, v2]) => (
                                      <div key={lbl} className="rounded bg-white/5 py-1">
                                        <div className="text-[8px] font-mono text-slate-400">{lbl}</div>
                                        <div
                                          className={`text-[11px] font-mono font-bold tabular-nums ${
                                            v1 > v2 ? 'text-[#00FF85]' : v1 < v2 ? 'text-rose-300' : 'text-white'
                                          }`}
                                        >
                                          {v1}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </aside>
                </div>
              )}

              {modalTab === 'tactical' && (
                <div
                  className={
                    isMobileLandscape
                      ? 'grid grid-cols-12 gap-2.5 flex-1 min-h-0 overflow-hidden'
                      : 'grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-5 items-start'
                  }
                >
                  <div className={isMobileLandscape ? 'col-span-6 h-full min-h-0 flex flex-col' : 'md:col-span-7'}>
                    <PitchBoard
                      club={draftClub}
                      formation={draftFormation}
                      startingIds={draftStarting}
                      benchIds={draftBench}
                      selectedPlayerId={draftTacticalPlayer?.id ?? null}
                      displayMode="tactical"
                      hideBench
                      teamRoles={draftTeamRoles}
                      onSelectPlayer={(pid) => setDraftTacticalPlayerId(pid)}
                    />
                  </div>
                  <div
                    className={
                      isMobileLandscape
                        ? 'col-span-6 rounded-xl border border-white/12 bg-black/35 p-2.5 space-y-2.5 h-full min-h-0 overflow-y-auto'
                        : 'md:col-span-5 rounded-xl border border-white/12 bg-black/35 p-3.5 sm:p-4 space-y-4'
                    }
                  >
                    {draftTacticalPlayer && draftActiveSlotRole && (() => {
                      const slotEval = getPlayerSlotEvaluation(draftTacticalPlayer, draftTacticalSlotLabel);
                      const activeMastery = getPlayerRoleMastery(draftTacticalPlayer, draftActiveSlotRole);
                      return (
                        <div className="rounded-lg border border-[#00FF85]/35 bg-[#00FF85]/8 p-3.5 space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-[11px] font-mono text-[#00FF85]">
                                {draftTacticalSlotLabel} · {draftTacticalPlayer.detailedPosition ?? draftTacticalPlayer.position}
                              </div>
                              <div className="text-sm font-bold text-white truncate flex items-center gap-2">
                                <span>{draftTacticalPlayer.name}</span>
                                <span
                                  className={`px-1.5 py-0.5 rounded border text-[10px] font-mono font-bold ${getRoleMasteryBadgeClasses(
                                    activeMastery
                                  ).badge}`}
                                >
                                  {activeMastery}
                                </span>
                              </div>
                            </div>
                            <div className="font-mono text-lg font-extrabold text-white tabular-nums">
                              {slotEval.effectiveOvr}
                              {slotEval.delta < 0 ? ` (${slotEval.delta})` : ''}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs text-slate-300 mb-1">
                              {t(lang, 'playerRole')}
                            </label>
                            <select
                              value={draftActiveSlotRole}
                              onChange={(e) => {
                                if (draftTacticalSlotIndex < 0) return;
                                const nextRole = e.target.value as PlayerRole;
                                setDraftSlotRoles((prev) => ({
                                  ...prev,
                                  [draftTacticalSlotIndex]: nextRole,
                                }));
                              }}
                              className="w-full rounded-lg border border-white/20 bg-black/55 px-3 py-2 text-xs text-white"
                            >
                              {draftAllowedRoles.map((r) => (
                                <option key={r} value={r}>
                                  {r} [{getPlayerRoleMastery(draftTacticalPlayer, r)}]
                                </option>
                              ))}
                            </select>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {draftAllowedRoles.map((r) => {
                                const mastery = getPlayerRoleMastery(draftTacticalPlayer, r);
                                const isSel = r === draftActiveSlotRole;
                                return (
                                  <button
                                    key={r}
                                    type="button"
                                    onClick={() => {
                                      if (draftTacticalSlotIndex < 0) return;
                                      setDraftSlotRoles((prev) => ({
                                        ...prev,
                                        [draftTacticalSlotIndex]: r,
                                      }));
                                    }}
                                    className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-semibold cursor-pointer ${
                                      isSel
                                        ? getRoleMasteryBadgeClasses(mastery).badge
                                        : 'border-white/15 bg-black/35 text-slate-300 hover:text-white'
                                    }`}
                                  >
                                    <span>{r}</span>
                                    <span className="font-mono opacity-85">{mastery}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-300 mb-1">{t(lang, 'tacticalPreset')}</label>
                        <select
                          value={draftTactics.preset}
                          onChange={(e) => applyDraftPreset(e.target.value as TacticalPreset)}
                          className="w-full rounded-lg border border-white/15 bg-black/50 px-2.5 py-2 text-white"
                        >
                          {PRESETS.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-300 mb-1">{t(lang, 'buildUpStyle')}</label>
                        <select
                          value={draftTactics.buildUpStyle}
                          onChange={(e) =>
                            setDraftTactics((prev) => ({ ...prev, buildUpStyle: e.target.value as BuildUpStyle }))
                          }
                          className="w-full rounded-lg border border-white/15 bg-black/50 px-2.5 py-2 text-white"
                        >
                          {BUILD_UP_STYLES.map((b) => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-300 mb-1">{t(lang, 'defensiveApproach')}</label>
                        <select
                          value={draftTactics.defensiveApproach}
                          onChange={(e) =>
                            setDraftTactics((prev) => ({
                              ...prev,
                              defensiveApproach: e.target.value as DefensiveApproach,
                            }))
                          }
                          className="w-full rounded-lg border border-white/15 bg-black/50 px-2.5 py-2 text-white"
                        >
                          {DEF_APPROACHES.map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2.5 pt-2 border-t border-white/10">
                      {[
                        ['playersInBox', draftTactics.playersInBox, 'playersInBox'],
                        ['attackingWidth', draftTactics.attackingWidth, 'attackingWidth'],
                        ['defensiveLine', draftTactics.defensiveLine, 'defensiveLine'],
                      ].map(([key, val, labelKey]) => (
                        <div key={String(key)}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-300">{t(lang, String(labelKey))}</span>
                            <span className="font-mono text-emerald-300 tabular-nums">{val}/10</span>
                          </div>
                          <input
                            type="range"
                            min={1}
                            max={10}
                            value={Number(val)}
                            onChange={(e) =>
                              setDraftTactics((prev) => ({
                                ...prev,
                                [key as string]: Number(e.target.value),
                              }))
                            }
                            className="w-full accent-[#00FF85]"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {modalTab === 'roles' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 flex-1 min-h-0 overflow-y-auto content-start">
                  {roleConfigs.map((rc) => {
                    const availablePool = userClub.players.filter(isPlayerAvailableForMatchday);
                    const currentId = draftTeamRoles[rc.key] ?? availablePool[0]?.id ?? userClub.players[0]?.id;
                    const sortedPool = [...availablePool].sort((a, b) => rc.getMetric(b) - rc.getMetric(a));
                    return (
                      <div key={rc.key} className="rounded-lg border border-white/12 bg-black/35 p-3.5 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-white">
                          {rc.icon}
                          <span>{rc.label}</span>
                        </div>
                        <select
                          value={currentId}
                          onChange={(e) =>
                            setDraftTeamRoles((prev) => ({ ...prev, [rc.key]: e.target.value }))
                          }
                          className="w-full rounded-lg border border-white/15 bg-black/55 px-2.5 py-2 text-xs text-white"
                        >
                          {sortedPool.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.detailedPosition ?? p.position} · {rc.metricLabel} {rc.getMetric(p)})
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {draftComparisonOpen &&
            draftCompareIds.length === 2 &&
            (() => {
              const pA = userClub.players.find((p) => p.id === draftCompareIds[0]);
              const pB = userClub.players.find((p) => p.id === draftCompareIds[1]);
              if (!pA || !pB) return null;
              return (
                <PlayerComparisonModal
                  club={userClub}
                  playerA={pA}
                  playerB={pB}
                  language={lang}
                  onSwapPlayers={handleDraftSwapByIds}
                  onClose={() => setDraftComparisonOpen(false)}
                />
              );
            })()}
        </div>
        </ModalPortal>
      )}

      {/* Pre-Match Unavailable Starters Guard Modal */}
      {unavailableModalMode && (
        <ModalPortal>
        <div
          className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t(lang, 'unavailableStartersTitle')}
        >
          <div className="animate-modal-pop w-full max-w-lg rounded-2xl border border-rose-500/45 bg-[#120A14] shadow-2xl p-6 space-y-4 text-slate-100">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
                <h3 className="font-display text-xl font-bold text-white">
                  {t(lang, 'unavailableStartersTitle')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setUnavailableModalMode(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {t(lang, 'unavailableStartersBody')}
            </p>

            <div className="space-y-1.5 max-h-44 overflow-y-auto">
              {[
                ...xiValidation.suspendedPlayers.map((p) => ({ p, reason: t(lang, 'suspended') })),
                ...xiValidation.injuredPlayers.map((p) => ({
                  p,
                  reason: `${t(lang, 'injured')} (${p.injuryNote ?? ''})`.trim(),
                })),
                ...xiValidation.loanedOutPlayers.map((p) => ({ p, reason: t(lang, 'loanOutBadge') })),
              ].map(({ p, reason }) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-rose-500/35 bg-rose-950/35 px-3 py-2 text-xs"
                >
                  <span className="font-semibold text-white">
                    {p.name} ({p.detailedPosition ?? p.position})
                  </span>
                  <span className="font-mono text-rose-300">{reason}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setUnavailableModalMode(null)}
                className="rounded-lg border border-white/20 bg-white/8 hover:bg-white/15 text-slate-200 font-semibold text-xs px-3.5 py-2 cursor-pointer"
              >
                {t(lang, 'cancel')}
              </button>
              <button
                type="button"
                onClick={() => handleUnavailableAutoReplace(false)}
                className="rounded-lg border border-sky-400/50 bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 font-bold text-xs px-3.5 py-2 cursor-pointer"
              >
                {t(lang, 'autoReplaceMatchOnly')}
              </button>
              <button
                type="button"
                onClick={() => handleUnavailableAutoReplace(true)}
                className="rounded-lg bg-[#00FF85] hover:bg-emerald-300 text-slate-950 font-bold text-xs px-4 py-2 cursor-pointer"
              >
                {t(lang, 'autoReplaceAndSave')}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Opponent XI Read-Only Modal */}
      {showOpponentModal && opponentClub && (
        <ModalPortal>
        <div
          className={`safe-area-x fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center ${
            isMobileLandscape ? 'p-2' : 'p-4'
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="Opponent XI"
        >
          <div
            className={`animate-modal-pop w-full max-w-5xl rounded-2xl pitch-modal-shell text-slate-100 overflow-hidden flex flex-col ${
              isMobileLandscape ? 'h-[92dvh] max-h-[92dvh]' : 'max-h-[92vh]'
            }`}
          >
            <div
              className={`shrink-0 flex items-center justify-between gap-3 border-b border-white/10 bg-black/35 ${
                isMobileLandscape ? 'px-3.5 py-2' : 'px-5 py-3.5'
              }`}
            >
              <div className="flex items-center gap-3">
                <ClubBadge
                  clubId={opponentClub.id}
                  name={opponentClub.name}
                  shortName={opponentClub.shortName}
                  primaryColor={opponentClub.primaryColor}
                  secondaryColor={opponentClub.secondaryColor}
                  pattern={opponentClub.pattern}
                  size={isMobileLandscape ? 28 : 36}
                />
                <div>
                  <h3 className={`font-display font-bold text-white ${isMobileLandscape ? 'text-lg' : 'text-xl'}`}>
                    {t(lang, 'opponentXI')} · {opponentClub.name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Head Coach: {opponentClub.managerName} · Formation {opponentClub.formation} (Read-Only)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOpponentModal(false)}
                aria-label="Close Opponent XI"
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {isMobileLandscape ? (
              <div className="p-2.5 flex-1 min-h-0 grid grid-cols-12 gap-2.5 overflow-hidden">
                <div className="col-span-7 h-full min-h-0 flex flex-col">
                  <PitchBoard
                    club={opponentClub}
                    formation={opponentClub.formation}
                    startingIds={opponentClub.startingIds}
                    benchIds={opponentClub.benchIds}
                    selectedPlayerId={null}
                    readOnly
                    hideBench
                  />
                </div>
                <div className="col-span-5 h-full min-h-0 flex flex-col rounded-xl border border-white/10 bg-black/35 p-2.5 overflow-hidden">
                  <h4 className="shrink-0 text-xs font-semibold text-white pb-1.5 border-b border-white/10 mb-1.5">
                    Substitutes ({opponentClub.benchIds.length}/9)
                  </h4>
                  <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1">
                    {opponentClub.benchIds
                      .map((id) => opponentClub.players.find((p) => p.id === id))
                      .filter((p): p is Player => Boolean(p))
                      .map((player) => (
                        <div
                          key={player.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <PlayerAvatar
                              playerId={player.id}
                              name={player.name}
                              shirtNumber={player.shirtNumber}
                              position={player.position}
                              primaryColor={opponentClub.primaryColor}
                              secondaryColor={opponentClub.secondaryColor}
                              size={26}
                            />
                            <div className="min-w-0">
                              <div className="text-[11px] font-semibold text-white truncate">{player.name}</div>
                              <div className="text-[9px] font-mono text-slate-400">
                                {player.detailedPosition ?? player.position}
                              </div>
                            </div>
                          </div>
                          <span className="font-mono text-xs font-bold text-emerald-300 tabular-nums">
                            {player.ovr}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-5 overflow-y-auto">
                <PitchBoard
                  club={opponentClub}
                  formation={opponentClub.formation}
                  startingIds={opponentClub.startingIds}
                  benchIds={opponentClub.benchIds}
                  selectedPlayerId={null}
                  readOnly
                />
              </div>
            )}
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
};
