import React, { useEffect, useMemo, useState } from 'react';
import { ModalPortal } from './ModalPortal';
import {
  ALL_FORMATIONS,
  COMPETITION_THEMES,
  deriveDefaultTeamRoles,
  FORMATION_SLOTS,
} from '../data/premierLeague2627';
import {
  applyLiveSubstitution,
  getTeamActivePitchList,
  getTeamBenchDisplayList,
  LiveMatchSession,
  LivePlayerRuntime,
  swapLivePitchPlayers,
  updateLiveTeamTactics,
} from '../engine/liveMatchEngine';
import {
  BuildUpStyle,
  Club,
  DefensiveApproach,
  FormationName,
  Language,
  Player,
  PlayerRole,
  TacticalPreset,
  TacticsConfig,
  TeamRoles,
} from '../types/game';
import {
  getAllowedRolesForSlot,
  getPlayerRoleMastery,
  getPlayerSlotEvaluation,
  getRoleMasteryBadgeClasses,
  isPlayerAvailableForMatchday,
  migrateLegacyRole,
  slotLabelToDetailedPosition,
} from '../utils/playerAttributes';
import { formatCurrency, t } from '../utils/i18n';
import { playSound } from '../utils/sound';
import { useIsMobileLandscape } from '../utils/useMobileLandscape';
import { ClubBadge, PlayerAvatar } from './ClubBadge';
import { FitnessBar, PitchBoard } from './PitchBoard';
import { PlayerComparisonModal } from './PlayerComparisonModal';
import {
  Activity,
  ArrowLeft,
  ArrowLeftRight,
  Award,
  BarChart3,
  CheckCircle2,
  Crosshair,
  Eye,
  FastForward,
  Flag,
  Lock,
  Pause,
  Play,
  Shield,
  Sliders,
  Sparkles,
  Star,
  Tv,
  Users,
  X,
} from 'lucide-react';

interface LiveMatchArenaProps {
  session: LiveMatchSession;
  language: Language;
  soundEnabled: boolean;
  isPlaying: boolean;
  speed: 1 | 2 | 4;
  stepDurationMs?: number;
  onTogglePlay: () => void;
  onPauseForTactics: () => void;
  onChangeSpeed: (speed: 1 | 2 | 4) => void;
  onUpdateSession: (next: LiveMatchSession) => void;
  onJumpToFullTime: () => void;
  onFinishMatch: () => void;
}

type ArenaMainTab = 'pitch' | 'fitness' | 'ratings' | 'stats';

const PRESETS: TacticalPreset[] = [
  'Gegenpress',
  'Tiki-Taka',
  'Counter-Attack',
  'Wing Play',
  'Park the Bus',
  'Balanced',
];
const BUILD_UP_STYLES: BuildUpStyle[] = ['Short Passing', 'Balanced', 'Direct Passing', 'Long Ball'];
const DEF_APPROACHES: DefensiveApproach[] = ['High Press', 'Balanced', 'Mid Block', 'Deep Block'];

function contrastTextColor(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return '#ffffff';
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.65 ? '#0f172a' : '#ffffff';
}

export const LiveMatchArena: React.FC<LiveMatchArenaProps> = ({
  session,
  language,
  soundEnabled,
  isPlaying,
  speed,
  stepDurationMs = 1000,
  onTogglePlay,
  onPauseForTactics,
  onChangeSpeed,
  onUpdateSession,
  onJumpToFullTime,
  onFinishMatch,
}) => {
  const isMobileLandscape = useIsMobileLandscape();
  const [homeListTab, setHomeListTab] = useState<'xi' | 'bench'>('xi');
  const [awayListTab, setAwayListTab] = useState<'xi' | 'bench'>('xi');
  const [arenaTab, setArenaTab] = useState<ArenaMainTab>('pitch');
  const [isTacticsView, setIsTacticsView] = useState(false);
  const [tacticsSubTab, setTacticsSubTab] = useState<'squad' | 'tactical' | 'roles'>('squad');
  const [tacticsBenchTab, setTacticsBenchTab] = useState<'bench' | 'unavailable'>('bench');
  const [dragOverLiveCol2Id, setDragOverLiveCol2Id] = useState<string | null>(null);
  const [selectedSwapIds, setSelectedSwapIds] = useState<string[]>([]);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [subFeedback, setSubFeedback] = useState<{ text: string; isError?: boolean } | null>(null);
  const [hoveredPlayerId, setHoveredPlayerId] = useState<string | null>(null);

  const userTeam = session.userSide === 'HOME' ? session.home : session.away;
  const userActivePlayers = useMemo(() => getTeamActivePitchList(userTeam), [userTeam]);
  const userBenchPlayers = useMemo(() => getTeamBenchDisplayList(userTeam), [userTeam]);

  const [tacticalPlayerId, setTacticalPlayerId] = useState<string>(
    userTeam.activeIds[9] ?? userTeam.activeIds[0] ?? ''
  );

  const liveUserClub: Club = useMemo(() => {
    const runtimeById = new Map<string, LivePlayerRuntime>();
    userTeam.starters.forEach((p) => runtimeById.set(p.player.id, p));
    userTeam.bench.forEach((p) => runtimeById.set(p.player.id, p));
    return {
      ...userTeam.club,
      startingIds: [...userTeam.activeIds],
      benchIds: userTeam.bench
        .filter((b) => !b.onPitch && !b.subbedOff && !userTeam.activeIds.includes(b.player.id))
        .map((b) => b.player.id),
      players: userTeam.club.players.map((p) => {
        const rt = runtimeById.get(p.id);
        if (!rt) return p;
        return {
          ...p,
          fitness: Math.round(rt.liveFitness),
          suspendedMatches: rt.redCarded ? Math.max(1, p.suspendedMatches) : p.suspendedMatches,
        };
      }),
    };
  }, [userTeam]);

  const unavailableOutPlayers = useMemo(
    () => [...userTeam.starters, ...userTeam.bench].filter((p) => p.subbedOff || p.redCarded),
    [userTeam]
  );

  const liveBenchPlayers = useMemo(() => {
    const map = new Map(liveUserClub.players.map((p) => [p.id, p]));
    return liveUserClub.benchIds.map((id) => map.get(id)).filter((p): p is Player => Boolean(p));
  }, [liveUserClub.players, liveUserClub.benchIds]);

  const homeActive = useMemo(() => getTeamActivePitchList(session.home), [session.home]);
  const homeBench = useMemo(() => getTeamBenchDisplayList(session.home), [session.home]);
  const awayActive = useMemo(() => getTeamActivePitchList(session.away), [session.away]);
  const awayBench = useMemo(() => getTeamBenchDisplayList(session.away), [session.away]);

  const homeCaptainId = session.home.club.teamRoles?.captainId;
  const awayCaptainId = session.away.club.teamRoles?.captainId;

  const isHalfTime = session.minute === 45 && !isPlaying && !session.finished;
  const playerTransitionMs = isPlaying ? stepDurationMs : 320;
  const ballTransitionMs = isPlaying ? Math.round(stepDurationMs * 0.85) : 280;

  const totalPossTicks = Math.max(
    1,
    session.home.possessionTicks + session.away.possessionTicks
  );
  const homePossPct = Math.round((session.home.possessionTicks / totalPossTicks) * 100);
  const awayPossPct = 100 - homePossPct;

  const showGoalFlash =
    session.lastGoalMinute !== null &&
    session.minute - session.lastGoalMinute <= 2 &&
    session.minute > 0;

  const lastGoalEvent = useMemo(() => {
    for (let i = session.events.length - 1; i >= 0; i--) {
      if (session.events[i].type === 'GOAL') return session.events[i];
    }
    return null;
  }, [session.events]);

  useEffect(() => {
    const validIds = new Set<string>([
      ...userActivePlayers.filter((p) => !p.redCarded).map((p) => p.player.id),
      ...userBenchPlayers.filter((p) => !p.subbedOff).map((p) => p.player.id),
    ]);
    setSelectedSwapIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [userActivePlayers, userBenchPlayers]);

  useEffect(() => {
    if (!userTeam.activeIds.includes(tacticalPlayerId)) {
      setTacticalPlayerId(userTeam.activeIds[9] ?? userTeam.activeIds[0] ?? '');
    }
  }, [userTeam.activeIds, tacticalPlayerId]);

  const compTheme = COMPETITION_THEMES[session.fixture.competitionId];

  const handleOpenTacticsView = () => {
    if (isPlaying) {
      onPauseForTactics();
    }
    playSound('tab', soundEnabled);
    setIsTacticsView(true);
  };

  const handleBackToMatch = () => {
    playSound('tab', soundEnabled);
    setIsTacticsView(false);
  };

  const handleSelectSwapPlayer = (playerId: string) => {
    playSound('click', soundEnabled);
    setComparisonOpen(false);
    setSubFeedback(null);
    setSelectedSwapIds((prev) => {
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

  const handleSelectPlayerFromArena = (playerId: string) => {
    if (!isTacticsView) {
      handleOpenTacticsView();
      setTacticsSubTab('squad');
      setSelectedSwapIds([playerId]);
      setSubFeedback(null);
      setComparisonOpen(false);
      return;
    }
    setTacticsSubTab('squad');
    handleSelectSwapPlayer(playerId);
  };

  const handleLiveSwapOrSub = (id1: string, id2: string) => {
    if (!id1 || !id2 || id1 === id2 || session.finished) return;
    const onPitch1 = userTeam.activeIds.includes(id1);
    const onPitch2 = userTeam.activeIds.includes(id2);

    if (onPitch1 && onPitch2) {
      const res = swapLivePitchPlayers(session, session.userSide, id1, id2);
      if (!res.ok) {
        playSound('reject', soundEnabled);
        setSubFeedback({ text: res.reason ?? 'Cannot swap players.', isError: true });
        return;
      }
      playSound('swap', soundEnabled);
      onUpdateSession(res.next);
      setSelectedSwapIds([]);
      setComparisonOpen(false);
      setSubFeedback({
        text: language === 'vi' ? 'Đã đổi vị trí trên sân.' : 'Pitch positions swapped.',
      });
      return;
    }

    if (onPitch1 !== onPitch2) {
      const offId = onPitch1 ? id1 : id2;
      const onId = onPitch1 ? id2 : id1;
      const res = applyLiveSubstitution(session, session.userSide, offId, onId);
      if (!res.ok) {
        playSound('reject', soundEnabled);
        setSubFeedback({ text: res.reason ?? 'Cannot complete substitution.', isError: true });
        return;
      }
      playSound('sub', soundEnabled);
      onUpdateSession(res.next);
      setSelectedSwapIds([]);
      setComparisonOpen(false);
      setSubFeedback({ text: t(language, 'subCompleted') });
      return;
    }

    playSound('reject', soundEnabled);
    setSubFeedback({
      text:
        language === 'vi'
          ? 'Chọn ít nhất 1 cầu thủ trên sân để thay người hoặc đổi vị trí.'
          : 'Select at least one pitch player to substitute or swap positions.',
      isError: true,
    });
  };

  const handleUpdateFormation = (nextFormation: FormationName) => {
    playSound('swap', soundEnabled);
    const nextTactics: TacticsConfig = {
      ...userTeam.club.tactics,
      formation: nextFormation,
    };
    onUpdateSession(
      updateLiveTeamTactics(session, session.userSide, nextFormation, nextTactics)
    );
  };

  const handleUpdatePreset = (preset: TacticalPreset) => {
    const presetMap: Record<TacticalPreset, Partial<TacticsConfig>> = {
      Gegenpress: { buildUpStyle: 'Direct Passing', defensiveApproach: 'High Press', playersInBox: 7, attackingWidth: 7, defensiveLine: 8 },
      'Tiki-Taka': { buildUpStyle: 'Short Passing', defensiveApproach: 'High Press', playersInBox: 8, attackingWidth: 7, defensiveLine: 8 },
      'Counter-Attack': { buildUpStyle: 'Direct Passing', defensiveApproach: 'Mid Block', playersInBox: 6, attackingWidth: 7, defensiveLine: 5 },
      'Wing Play': { buildUpStyle: 'Balanced', defensiveApproach: 'High Press', playersInBox: 7, attackingWidth: 9, defensiveLine: 6 },
      'Park the Bus': { buildUpStyle: 'Long Ball', defensiveApproach: 'Deep Block', playersInBox: 4, attackingWidth: 5, defensiveLine: 3 },
      Balanced: { buildUpStyle: 'Balanced', defensiveApproach: 'Balanced', playersInBox: 6, attackingWidth: 6, defensiveLine: 6 },
    };
    playSound('click', soundEnabled);
    const nextTactics: TacticsConfig = {
      ...userTeam.club.tactics,
      preset,
      ...presetMap[preset],
    };
    onUpdateSession(
      updateLiveTeamTactics(session, session.userSide, userTeam.club.formation, nextTactics)
    );
  };

  const handlePatchTacticField = (patch: Partial<TacticsConfig>) => {
    playSound('click', soundEnabled);
    const nextTactics: TacticsConfig = { ...userTeam.club.tactics, ...patch };
    onUpdateSession(
      updateLiveTeamTactics(session, session.userSide, userTeam.club.formation, nextTactics)
    );
  };

  const handleUpdateSlotRole = (slotIndex: number, nextRole: PlayerRole) => {
    playSound('click', soundEnabled);
    const nextSlotRoles = {
      ...(userTeam.club.slotRoles ?? {}),
      [slotIndex]: nextRole,
    };
    onUpdateSession(
      updateLiveTeamTactics(
        session,
        session.userSide,
        userTeam.club.formation,
        userTeam.club.tactics,
        nextSlotRoles
      )
    );
  };

  const handleUpdateTeamRoles = (nextRoles: TeamRoles) => {
    playSound('click', soundEnabled);
    onUpdateSession(
      updateLiveTeamTactics(
        session,
        session.userSide,
        userTeam.club.formation,
        userTeam.club.tactics,
        undefined,
        nextRoles
      )
    );
  };

  const slots = FORMATION_SLOTS[liveUserClub.formation] ?? FORMATION_SLOTS['4-2-3-1'];
  const tacticalPlayer =
    liveUserClub.players.find((p) => p.id === tacticalPlayerId) ??
    liveUserClub.players.find((p) => p.id === liveUserClub.startingIds[0]) ??
    liveUserClub.players[0];
  const tacticalSlotIndex = tacticalPlayer ? liveUserClub.startingIds.indexOf(tacticalPlayer.id) : -1;
  const tacticalSlotLabel = tacticalPlayer
    ? tacticalSlotIndex >= 0
      ? slots[tacticalSlotIndex]?.label ?? tacticalPlayer.detailedPosition ?? tacticalPlayer.position
      : tacticalPlayer.detailedPosition ?? tacticalPlayer.position
    : '';
  const allowedRolesForSlot = useMemo(() => {
    if (!tacticalPlayer) return [] as PlayerRole[];
    return getAllowedRolesForSlot(
      tacticalSlotLabel || tacticalPlayer.detailedPosition || tacticalPlayer.position,
      tacticalPlayer.position
    );
  }, [tacticalPlayer, tacticalSlotLabel]);
  const activeSlotRole: PlayerRole | undefined = useMemo(() => {
    if (!tacticalPlayer) return undefined;
    const candidate =
      (tacticalSlotIndex >= 0 ? liveUserClub.slotRoles?.[tacticalSlotIndex] : undefined) ??
      tacticalPlayer.role;
    if (allowedRolesForSlot.includes(candidate)) return candidate;
    return migrateLegacyRole(
      candidate,
      slotLabelToDetailedPosition(tacticalSlotLabel, tacticalPlayer.position)
    );
  }, [tacticalPlayer, tacticalSlotIndex, liveUserClub.slotRoles, allowedRolesForSlot, tacticalSlotLabel]);

  const activeTeamRoles: TeamRoles = useMemo(
    () => liveUserClub.teamRoles ?? deriveDefaultTeamRoles(liveUserClub.players),
    [liveUserClub.teamRoles, liveUserClub.players]
  );

  const roleConfigs: {
    key: keyof TeamRoles;
    label: string;
    icon: React.ReactNode;
    metricLabel: string;
    getMetric: (p: Player) => number;
  }[] = [
    { key: 'captainId', label: t(language, 'captainRole'), icon: <Shield className="w-4 h-4 text-amber-300" />, metricLabel: 'OVR', getMetric: (p) => p.ovr },
    { key: 'penaltyId', label: t(language, 'penaltyTaker'), icon: <Crosshair className="w-4 h-4 text-[#00FF85]" />, metricLabel: 'PEN', getMetric: (p) => p.attributes.shootingDetails?.penalties ?? p.attributes.finishing },
    { key: 'freeKickId', label: t(language, 'freeKickTaker'), icon: <Sparkles className="w-4 h-4 text-sky-300" />, metricLabel: 'FKA', getMetric: (p) => p.attributes.passingDetails?.fkAccuracy ?? p.attributes.passing },
    { key: 'leftCornerId', label: t(language, 'leftCornerTaker'), icon: <Flag className="w-4 h-4 text-emerald-300" />, metricLabel: 'CRO', getMetric: (p) => p.attributes.passingDetails?.crossing ?? p.attributes.passing },
    { key: 'rightCornerId', label: t(language, 'rightCornerTaker'), icon: <Flag className="w-4 h-4 text-teal-300" />, metricLabel: 'CRO', getMetric: (p) => p.attributes.passingDetails?.crossing ?? p.attributes.passing },
  ];

  const renderSidebarRow = (
    entry: LivePlayerRuntime,
    side: 'HOME' | 'AWAY',
    isCaptain: boolean
  ) => {
    const isUserTeam = side === session.userSide;
    const isSelectedForSwap = isUserTeam && selectedSwapIds.includes(entry.player.id);
    const isSelectedPitch = isSelectedForSwap && entry.onPitch;
    const isSelectedBench = isSelectedForSwap && !entry.onPitch;
    const canPickInTactics =
      isUserTeam &&
      !session.finished &&
      (entry.onPitch ? !entry.redCarded : !entry.subbedOff && isPlayerAvailableForMatchday(entry.player));

    const shortLastName = entry.player.name.split(' ').slice(-1)[0];

    return (
      <div
        key={entry.player.id}
        onClick={() => {
          if (!canPickInTactics) return;
          handleSelectPlayerFromArena(entry.player.id);
        }}
        className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
          isSelectedPitch
            ? 'bg-sky-500/20 border border-sky-400/60'
            : isSelectedBench
            ? 'bg-[#00FF85]/20 border border-[#00FF85]/60'
            : canPickInTactics
            ? 'hover:bg-white/10 cursor-pointer border border-transparent'
            : 'border border-transparent'
        } ${entry.redCarded || entry.subbedOff ? 'opacity-45' : ''}`}
      >
        <div
          className={`flex items-center gap-2 min-w-0 flex-1 ${
            side === 'AWAY' ? 'flex-row-reverse text-right' : ''
          }`}
        >
          <span className="font-mono text-[11px] text-slate-400 w-5 shrink-0 tabular-nums">
            {entry.player.shirtNumber}
          </span>
          <span className="font-medium text-white truncate">
            {shortLastName}
            {isCaptain ? ' (C)' : ''}
          </span>
          {entry.goals > 0 && (
            <span className="text-[10px] font-mono font-bold text-[#00FF85] shrink-0">
              ⚽{entry.goals > 1 ? entry.goals : ''}
            </span>
          )}
          {entry.yellowCards > 0 && !entry.redCarded && (
            <span className="inline-block w-2 h-2.5 rounded-[1px] bg-amber-400 shrink-0" />
          )}
          {entry.redCarded && (
            <span className="inline-block w-2 h-2.5 rounded-[1px] bg-rose-500 shrink-0" />
          )}
          {entry.subInMinute !== undefined && (
            <span className="text-[9px] font-mono text-emerald-300 shrink-0">▲{entry.subInMinute}'</span>
          )}
          {entry.subOutMinute !== undefined && (
            <span className="text-[9px] font-mono text-rose-300 shrink-0">▼{entry.subOutMinute}'</span>
          )}
        </div>

        <div className="shrink-0">
          <FitnessBar fitness={Math.round(entry.liveFitness)} widthClass="w-12" />
        </div>
      </div>
    );
  };

  const homeDiscBg = session.home.club.primaryColor;
  const homeDiscText = contrastTextColor(homeDiscBg);
  const awayDiscBg =
    session.away.club.primaryColor.toLowerCase() === homeDiscBg.toLowerCase()
      ? session.away.club.secondaryColor
      : session.away.club.primaryColor;
  const awayDiscText = contrastTextColor(awayDiscBg);

  const activeBottomStatsTab: 'fitness' | 'ratings' | 'stats' =
    arenaTab === 'pitch' ? 'fitness' : arenaTab;

  const renderAnalyticsContent = (tab: 'fitness' | 'ratings' | 'stats') => (
    <>
      {tab === 'fitness' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-lg border border-white/10 bg-black/35 p-3.5 space-y-2">
            <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>{t(language, 'liveMatchEvents')}</span>
              <span className="font-mono text-[11px] text-slate-400">
                {session.events.length} events
              </span>
            </div>
            {session.events.length === 0 ? (
              <div className="text-xs text-slate-400 py-6 text-center">
                {language === 'vi'
                  ? 'Trận đấu đang diễn ra, chưa có sự kiện nổi bật.'
                  : 'Match underway — awaiting key moments.'}
              </div>
            ) : (
              <div className={`${isMobileLandscape ? 'max-h-56' : 'max-h-52'} overflow-y-auto space-y-1.5 pr-1`}>
                {[...session.events].reverse().map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-start justify-between gap-2 text-xs py-1.5 px-2.5 rounded bg-white/[0.03] border border-white/8"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-bold text-[#00FF85] shrink-0 tabular-nums">
                        {ev.minute}&apos;
                      </span>
                      <span className="text-slate-200 truncate">{ev.description}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">
                      {ev.teamSide === 'HOME'
                        ? session.home.club.shortName
                        : session.away.club.shortName}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-white/10 bg-black/35 p-3.5 space-y-2.5">
            <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>
                {userTeam.club.name} · {t(language, 'fitnessTab')}
              </span>
              <span className="font-mono text-[11px] text-slate-400">
                {t(language, 'subsUsed')}: {userTeam.subsUsed}/5
              </span>
            </div>
            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 ${isMobileLandscape ? 'max-h-56' : 'max-h-52'} overflow-y-auto pr-1`}>
              {[...userActivePlayers]
                .sort((a, b) => a.liveFitness - b.liveFitness)
                .map((p) => (
                  <div
                    key={p.player.id}
                    className="flex items-center justify-between gap-2 rounded bg-white/[0.03] border border-white/8 px-2.5 py-1.5 text-xs"
                  >
                    <span className="text-white truncate">
                      <span className="font-mono text-slate-400 mr-1">{p.slotLabel}</span>
                      {p.player.name.split(' ').slice(-1)[0]}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-mono text-[10px] text-slate-300 tabular-nums">
                        {Math.round(p.liveFitness)}%
                      </span>
                      <FitnessBar fitness={Math.round(p.liveFitness)} widthClass="w-14" />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'ratings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {([
            { team: session.home, list: [...homeActive, ...homeBench] },
            { team: session.away, list: [...awayActive, ...awayBench] },
          ] as const).map(({ team, list }) => (
            <div
              key={team.club.id}
              className="rounded-lg border border-white/10 bg-black/35 p-3.5 space-y-2"
            >
              <div className="text-xs font-bold text-white border-b border-white/10 pb-2">
                {team.club.name}
              </div>
              <div className={`${isMobileLandscape ? '' : 'max-h-56 overflow-y-auto'} divide-y divide-white/8 text-xs`}>
                {list.map((p) => {
                  const played = p.onPitch || p.subOutMinute !== undefined;
                  return (
                    <div key={p.player.id} className="py-1.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[10px] text-slate-400 w-7 shrink-0">
                          {p.slotLabel}
                        </span>
                        <span className="text-slate-100 truncate">{p.player.name}</span>
                        {p.goals > 0 && (
                          <span className="px-1 py-0.2 rounded bg-emerald-500/20 border border-emerald-400/35 text-[9px] text-[#00FF85] font-mono font-bold">
                            G{p.goals > 1 ? `×${p.goals}` : ''}
                          </span>
                        )}
                        {p.assists > 0 && (
                          <span className="px-1 py-0.2 rounded bg-sky-500/20 border border-sky-400/35 text-[9px] text-sky-300 font-mono font-bold">
                            A{p.assists > 1 ? `×${p.assists}` : ''}
                          </span>
                        )}
                      </div>
                      <span
                        className={`font-mono font-bold tabular-nums shrink-0 ${
                          !played || p.liveRating === null
                            ? 'text-slate-500'
                            : p.liveRating >= 7.8
                            ? 'text-[#00FF85]'
                            : p.liveRating >= 6.8
                            ? 'text-emerald-200'
                            : 'text-amber-300'
                        }`}
                      >
                        {played && p.liveRating !== null ? p.liveRating.toFixed(1) : '-'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'stats' && (
        <div className="rounded-lg border border-white/10 bg-black/35 p-4 space-y-3 max-w-3xl mx-auto">
          {(
            [
              [t(language, 'possession'), `${homePossPct}%`, `${awayPossPct}%`, homePossPct, awayPossPct],
              [t(language, 'shots'), session.home.shots, session.away.shots, session.home.shots, session.away.shots],
              [t(language, 'shotsOnTarget'), session.home.shotsOnTarget, session.away.shotsOnTarget, session.home.shotsOnTarget, session.away.shotsOnTarget],
              [t(language, 'xgLabel'), session.home.xg.toFixed(2), session.away.xg.toFixed(2), session.home.xg, session.away.xg],
              [t(language, 'corners'), session.home.corners, session.away.corners, session.home.corners, session.away.corners],
              [t(language, 'fouls'), session.home.fouls, session.away.fouls, session.home.fouls, session.away.fouls],
              [t(language, 'yellowCards'), session.home.yellowCards, session.away.yellowCards, session.home.yellowCards, session.away.yellowCards],
            ] as const
          ).map(([label, hDisp, aDisp, hVal, aVal]) => {
            const sum = Math.max(0.01, Number(hVal) + Number(aVal));
            const hWidth = Math.round((Number(hVal) / sum) * 100);
            return (
              <div key={label} className="space-y-1 text-xs">
                <div className="flex justify-between font-mono tabular-nums">
                  <span className="font-bold text-white">{hDisp}</span>
                  <span className="text-slate-300 font-sans">{label}</span>
                  <span className="font-bold text-white">{aDisp}</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden flex">
                  <div
                    className="h-full bg-[#00FF85] transition-all duration-300"
                    style={{ width: `${hWidth}%` }}
                  />
                  <div
                    className="h-full bg-sky-400 transition-all duration-300"
                    style={{ width: `${100 - hWidth}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  return (
    <ModalPortal>
    <div
      className={`safe-area-x fixed inset-0 z-[70] bg-black/82 backdrop-blur-sm flex items-center justify-center ${
        isMobileLandscape ? 'p-1.5 overflow-hidden' : 'p-2 sm:p-4 overflow-y-auto'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Live Match Center"
    >
      <div
        className={`animate-modal-pop w-full max-w-7xl rounded-2xl pitch-modal-shell ${
          isMobileLandscape
            ? 'h-[95dvh] max-h-[95dvh] overflow-hidden flex flex-col'
            : 'max-h-[96dvh] overflow-y-auto space-y-0'
        }`}
      >
        {!isTacticsView ? (
          <>
        {/* Top Broadcast Scoreboard */}
        <div
          className={`relative overflow-hidden shrink-0 border-b border-white/10 bg-black/65 flex flex-col ${
            isMobileLandscape ? 'px-3 py-1.5 gap-1.5' : 'px-4 sm:px-6 py-3.5 gap-3'
          }`}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-25"
            style={{
              background: `radial-gradient(circle at 12% 50%, ${session.home.club.primaryColor}66, transparent 42%), radial-gradient(circle at 88% 50%, ${session.away.club.primaryColor}66, transparent 42%)`,
            }}
            aria-hidden="true"
          />
          <div
            className="absolute top-0 left-0 right-0 h-[2px]"
            style={{ backgroundColor: compTheme.accentColor }}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
            <div className="font-mono uppercase tracking-wider text-slate-300 truncate">
              {compTheme.name} · {session.fixture.stageLabel ?? `Round ${session.fixture.round}`} ·{' '}
              {session.home.club.stadium}
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {!session.finished && (
                <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/6 px-2.5 py-0.5 text-[10px] font-mono text-slate-300">
                  <Lock className="w-3 h-3 text-amber-300" />
                  {language === 'vi'
                    ? 'Không thể thoát khi trận đấu chưa kết thúc'
                    : 'Locked until Full Time'}
                </span>
              )}
              {!session.finished ? (
                isPlaying ? (
                  <span className="inline-flex items-center gap-1.5 font-mono font-bold text-[#00FF85]">
                    <span className="w-2 h-2 rounded-full bg-[#00FF85] animate-pulse" />
                    LIVE
                  </span>
                ) : isHalfTime ? (
                  <span className="inline-flex items-center gap-1.5 font-mono font-bold text-amber-300">
                    <span className="w-2 h-2 rounded-full bg-amber-300" />
                    {language === 'vi' ? 'HALF-TIME · NGHỈ GIỮA HIỆP' : 'HALF-TIME · BREAK'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 font-mono font-bold text-amber-300">
                    <span className="w-2 h-2 rounded-full bg-amber-300" />
                    {t(language, 'pauseToManage')}
                  </span>
                )
              ) : (
                <span className="font-mono font-bold text-[#00FF85]">FULL TIME</span>
              )}
            </div>
          </div>

        <div className={`grid grid-cols-[1fr_auto_1fr] items-center ${isMobileLandscape ? 'gap-2.5' : 'gap-3 sm:gap-6'}`}>
          {/* Home Broadcast Side */}
          <div className="flex items-center justify-end gap-2 min-w-0 text-right">
            <div className="min-w-0">
              <div
                className={`font-display font-bold text-white truncate ${
                  isMobileLandscape ? 'text-base' : 'text-lg sm:text-2xl'
                }`}
              >
                {session.home.club.name}
              </div>
              {!isMobileLandscape && (
                <div className="text-[11px] text-slate-400 truncate">
                  {session.home.club.managerName} · {session.home.club.formation}
                </div>
              )}
            </div>
            <span
              className="w-3.5 h-3.5 rounded-full border border-white/40 shrink-0 hidden sm:inline-block"
              style={{ backgroundColor: homeDiscBg }}
            />
            <ClubBadge
              clubId={session.home.club.id}
              name={session.home.club.name}
              shortName={session.home.club.shortName}
              primaryColor={session.home.club.primaryColor}
              secondaryColor={session.home.club.secondaryColor}
              pattern={session.home.club.pattern}
              size={isMobileLandscape ? 28 : 40}
            />
          </div>

          {/* Center Score & Clock */}
          <div
            className={`px-3.5 py-1 rounded-lg bg-black/65 border border-white/15 text-center ${
              showGoalFlash ? 'animate-goal-flash ring-2 ring-[#00FF85]/70' : ''
            }`}
          >
            <div
              className={`font-display font-extrabold text-white tracking-tight tabular-nums leading-none ${
                isMobileLandscape ? 'text-2xl' : 'text-3xl sm:text-4xl'
              }`}
            >
              {session.homeGoals} <span className="text-slate-500">:</span> {session.awayGoals}
            </div>
            <div className="font-mono text-xs font-bold text-[#00FF85] tabular-nums mt-0.5">
              {session.minute}&apos;
            </div>
          </div>

          {/* Away Broadcast Side */}
          <div className="flex items-center justify-start gap-2 min-w-0 text-left">
            <ClubBadge
              clubId={session.away.club.id}
              name={session.away.club.name}
              shortName={session.away.club.shortName}
              primaryColor={session.away.club.primaryColor}
              secondaryColor={session.away.club.secondaryColor}
              pattern={session.away.club.pattern}
              size={isMobileLandscape ? 28 : 40}
            />
            <span
              className="w-3.5 h-3.5 rounded-full border border-white/40 shrink-0 hidden sm:inline-block"
              style={{ backgroundColor: awayDiscBg }}
            />
            <div className="min-w-0">
              <div
                className={`font-display font-bold text-white truncate ${
                  isMobileLandscape ? 'text-base' : 'text-lg sm:text-2xl'
                }`}
              >
                {session.away.club.name}
              </div>
              {!isMobileLandscape && (
                <div className="text-[11px] text-slate-400 truncate">
                  {session.away.club.managerName} · {session.away.club.formation}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Transport & Speed Controls (plus View Tabs on Mobile Landscape only) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-white/10">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={session.finished}
              onClick={() => {
                playSound('click', soundEnabled);
                onTogglePlay();
              }}
              className="rounded-lg bg-[#00FF85] hover:bg-emerald-300 disabled:opacity-45 text-slate-950 font-bold text-xs px-3 py-1 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isPlaying
                ? t(language, 'pauseMatch')
                : isHalfTime
                ? language === 'vi'
                  ? 'Bắt đầu Hiệp 2'
                  : 'Start 2nd Half'
                : t(language, 'resumeMatch')}
            </button>

            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-black/50 border border-white/12">
              {([1, 2, 4] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={session.finished}
                  onClick={() => {
                    playSound('click', soundEnabled);
                    onChangeSpeed(s);
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold cursor-pointer whitespace-nowrap disabled:opacity-45 ${
                    speed === s
                      ? 'bg-white text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleOpenTacticsView}
              className="rounded-lg border border-white/20 bg-white/8 hover:bg-white/15 text-white text-xs font-semibold px-2.5 py-1 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Sliders className="w-3.5 h-3.5 text-[#00FF85]" />
              {t(language, 'tacticsSubsTab')} ({userTeam.subsUsed}/5)
            </button>
          </div>

          {isMobileLandscape && (
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-black/50 border border-white/15">
              {(
                [
                  { id: 'pitch', label: language === 'vi' ? 'Sân 2D' : '2D Pitch', icon: <Tv className="w-3 h-3" /> },
                  { id: 'fitness', label: t(language, 'fitnessTab'), icon: <Activity className="w-3 h-3" /> },
                  { id: 'ratings', label: t(language, 'ratingsTab'), icon: <Star className="w-3 h-3" /> },
                  { id: 'stats', label: t(language, 'stats'), icon: <BarChart3 className="w-3 h-3" /> },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    playSound('tab', soundEnabled);
                    setArenaTab(tab.id);
                  }}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
                    arenaTab === tab.id
                      ? 'bg-[#00FF85] text-slate-950 font-bold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          )}

          {!session.finished ? (
            <button
              type="button"
              onClick={() => {
                playSound('fulltime', soundEnabled);
                onJumpToFullTime();
              }}
              className="rounded-lg border border-white/20 bg-white/8 hover:bg-white/15 text-white font-semibold text-xs px-3 py-1 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <FastForward className="w-3.5 h-3.5" />
              {t(language, 'jumpToEnd')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                playSound('accept', soundEnabled);
                onFinishMatch();
              }}
              className="rounded-lg bg-[#00FF85] hover:bg-emerald-300 text-slate-950 font-bold text-xs px-3.5 py-1.5 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 shadow-lg"
            >
              <CheckCircle2 className="w-4 h-4" />
              {language === 'vi' ? 'Kết thúc & Xem báo cáo' : 'Finish & View Match Report'}
            </button>
          )}
        </div>
      </div>

      {/* Main Arena Body */}
      <div className={isMobileLandscape ? 'flex-1 min-h-0 overflow-hidden flex flex-col' : ''}>
        {(!isMobileLandscape || arenaTab === 'pitch') && (
          <div
            className={`grid grid-cols-1 ${
              isMobileLandscape
                ? 'grid-cols-[155px_1fr_155px] flex-1 min-h-0 overflow-hidden'
                : 'md:grid-cols-[160px_1fr_160px] lg:grid-cols-[235px_1fr_235px] border-b border-white/10'
            } gap-0`}
          >
            {/* Left Home Panel */}
            <div
              className={`border-r border-white/10 bg-black/35 flex flex-col gap-1.5 ${
                isMobileLandscape ? 'p-1.5 h-full min-h-0 overflow-hidden' : 'p-2.5 sm:p-3 border-b md:border-b-0'
              }`}
            >
              <div className="shrink-0 flex items-center justify-between border-b border-white/10 pb-1.5">
                <div className="flex items-center gap-1 text-[10px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setHomeListTab('xi')}
                    className={`px-2 py-0.5 rounded cursor-pointer whitespace-nowrap ${
                      homeListTab === 'xi' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {t(language, 'starting11Tab')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setHomeListTab('bench')}
                    className={`px-2 py-0.5 rounded cursor-pointer whitespace-nowrap ${
                      homeListTab === 'bench' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {t(language, 'benchTab')} ({homeBench.length})
                  </button>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {session.home.subsUsed}/5
                </span>
              </div>

              <div
                className={`space-y-0.5 overflow-y-auto pr-0.5 ${
                  isMobileLandscape ? 'flex-1 min-h-0' : 'max-h-[340px]'
                }`}
              >
                {(homeListTab === 'xi' ? homeActive : homeBench).map((p) =>
                  renderSidebarRow(p, 'HOME', p.player.id === homeCaptainId)
                )}
              </div>
            </div>

            {/* Center 2D Tactical Pitch */}
            <div
              className={`bg-[#07110E] flex flex-col justify-between ${
                isMobileLandscape ? 'p-2 gap-1.5 h-full min-h-0 overflow-hidden' : 'p-2.5 sm:p-4 gap-2.5 sm:gap-3'
              }`}
            >
              <div
                className={`pitch-turf relative w-full rounded-xl border-2 border-white/35 overflow-hidden select-none ${
                  isMobileLandscape ? 'flex-1 min-h-[155px]' : 'aspect-[16/10] min-h-[190px] sm:min-h-[240px]'
                }`}
              >
            {/* Mowed Grass Vertical Stripes */}
            <div
              className="absolute inset-0 opacity-35 pointer-events-none"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.06) 8.33%, transparent 8.33%, transparent 16.66%)',
              }}
            />

            {/* Crisp SVG Horizontal Pitch Markings */}
            <svg
              viewBox="0 0 1000 625"
              preserveAspectRatio="none"
              className="absolute inset-0 w-full h-full pointer-events-none"
            >
              {/* Halfway Line & Center Circle */}
              <line x1="500" y1="0" x2="500" y2="625" stroke="rgba(255,255,255,0.45)" strokeWidth="2.5" />
              <circle cx="500" cy="312.5" r="78" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2.5" />
              <circle cx="500" cy="312.5" r="5" fill="rgba(255,255,255,0.75)" />

              {/* Left Penalty Area & 6-yard Box */}
              <rect x="0" y="128" width="155" height="369" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2.5" />
              <rect x="0" y="226" width="54" height="173" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2.5" />
              <circle cx="108" cy="312.5" r="4.5" fill="rgba(255,255,255,0.7)" />
              <path d="M 155 246 A 75 75 0 0 1 155 379" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2.5" />
              <rect x="0" y="274" width="6" height="77" fill="rgba(255,255,255,0.45)" />

              {/* Right Penalty Area & 6-yard Box */}
              <rect x="845" y="128" width="155" height="369" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2.5" />
              <rect x="946" y="226" width="54" height="173" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2.5" />
              <circle cx="892" cy="312.5" r="4.5" fill="rgba(255,255,255,0.7)" />
              <path d="M 845 246 A 75 75 0 0 0 845 379" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2.5" />
              <rect x="994" y="274" width="6" height="77" fill="rgba(255,255,255,0.45)" />

              {/* Corner Arcs */}
              <path d="M 0 16 A 16 16 0 0 0 16 0" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
              <path d="M 0 609 A 16 16 0 0 1 16 625" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
              <path d="M 984 0 A 16 16 0 0 0 1000 16" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
              <path d="M 984 625 A 16 16 0 0 1 1000 609" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
            </svg>

            {/* Goal Celebration Banner */}
            {showGoalFlash && lastGoalEvent && (
              <div className="animate-goal-flash absolute top-3 left-1/2 -translate-x-1/2 z-30 rounded-lg border border-[#00FF85] bg-black/85 px-4 py-1.5 text-center shadow-xl pointer-events-none">
                <span className="font-display text-lg font-extrabold tracking-wider text-[#00FF85] mr-2">
                  {t(language, 'goalBannerText')}
                </span>
                <span className="text-xs font-semibold text-white">
                  {lastGoalEvent.playerName} ({lastGoalEvent.minute}&apos;)
                </span>
              </div>
            )}

            {/* Half-Time Interactive Overlay */}
            {isHalfTime && (
              <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4">
                <div className="rounded-xl border border-amber-400/50 bg-[#0F172A]/95 px-5 py-4 text-center space-y-3 max-w-sm shadow-2xl">
                  <div className="text-[11px] font-mono uppercase tracking-widest text-amber-300 font-bold">
                    {language === 'vi' ? 'Nghỉ giữa hiệp · 45\'' : 'Half-Time · 45\''}
                  </div>
                  <div className="font-display text-2xl font-extrabold text-white tabular-nums">
                    {session.home.club.shortName} {session.homeGoals} - {session.awayGoals}{' '}
                    {session.away.club.shortName}
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        playSound('whistle', soundEnabled);
                        onTogglePlay();
                      }}
                      className="rounded-lg bg-[#00FF85] hover:bg-emerald-300 text-slate-950 font-bold text-xs px-4 py-2 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      {language === 'vi' ? 'Bắt đầu Hiệp 2' : 'Start 2nd Half'}
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenTacticsView}
                      className="rounded-lg border border-white/25 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs px-3.5 py-2 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5 text-[#00FF85]" />
                      {t(language, 'tacticsSubsTab')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Full-Time Completion Overlay */}
            {session.finished && (
              <div className="absolute inset-0 z-30 bg-black/65 backdrop-blur-[2px] flex items-center justify-center p-4">
                <div className="rounded-xl border border-[#00FF85]/55 bg-[#0F172A]/95 px-6 py-4 text-center space-y-3 max-w-sm shadow-2xl">
                  <div className="text-[11px] font-mono uppercase tracking-widest text-[#00FF85] font-bold">
                    {language === 'vi' ? 'Hết giờ · 90\'' : 'Full Time · 90\''}
                  </div>
                  <div className="font-display text-2xl font-extrabold text-white tabular-nums">
                    {session.home.club.shortName} {session.homeGoals} - {session.awayGoals}{' '}
                    {session.away.club.shortName}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      playSound('accept', soundEnabled);
                      onFinishMatch();
                    }}
                    className="rounded-lg bg-[#00FF85] hover:bg-emerald-300 text-slate-950 font-bold text-xs px-4 py-2 inline-flex items-center gap-1.5 cursor-pointer shadow-lg"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {language === 'vi' ? 'Kết thúc & Xem báo cáo' : 'Finish & View Match Report'}
                  </button>
                </div>
              </div>
            )}

            {/* Home 11 Player Discs */}
            {homeActive
              .filter((p) => p.onPitch && !p.redCarded)
              .map((p) => {
                const isCarrier = session.ballCarrierId === p.player.id;
                const isHovered = hoveredPlayerId === p.player.id;
                const isUserSelectable = session.userSide === 'HOME' && !session.finished;
                const isSelectedSubOff = isUserSelectable && selectedSwapIds.includes(p.player.id);
                const showNameTag = isCarrier || isHovered || isSelectedSubOff;
                return (
                  <div
                    key={p.player.id}
                    role={isUserSelectable ? 'button' : undefined}
                    tabIndex={isUserSelectable ? 0 : undefined}
                    aria-label={isUserSelectable ? `Select ${p.player.name} for substitution` : undefined}
                    onMouseEnter={() => setHoveredPlayerId(p.player.id)}
                    onMouseLeave={() => setHoveredPlayerId(null)}
                    onClick={() => {
                      if (!isUserSelectable) return;
                      handleSelectPlayerFromArena(p.player.id);
                    }}
                    onKeyDown={(e) => {
                      if (!isUserSelectable) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectPlayerFromArena(p.player.id);
                      }
                    }}
                    style={{
                      left: `${p.x}%`,
                      top: `${p.y}%`,
                      transition: `left ${playerTransitionMs}ms linear, top ${playerTransitionMs}ms linear`,
                    }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center ${
                      isUserSelectable ? 'cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    <div
                      style={{
                        backgroundColor: homeDiscBg,
                        color: homeDiscText,
                        borderColor: session.home.club.secondaryColor,
                      }}
                      className={`rounded-full border-2 shadow-md flex items-center justify-center font-mono font-extrabold tabular-nums transition-transform duration-150 ${
                        isMobileLandscape ? 'w-5 h-5 text-[9px]' : 'w-6 h-6 sm:w-7 sm:h-7 text-[10px]'
                      } ${
                        isSelectedSubOff
                          ? 'scale-115 ring-2 ring-sky-400'
                          : isCarrier
                          ? 'scale-115 ring-2 ring-white'
                          : ''
                      }`}
                    >
                      {p.player.shirtNumber}
                    </div>
                    {showNameTag && (
                      <span className="mt-0.5 px-1.5 py-0.2 rounded bg-black/80 text-[9px] font-semibold text-white whitespace-nowrap pointer-events-none">
                        {p.player.name.split(' ').slice(-1)[0]}
                      </span>
                    )}
                  </div>
                );
              })}

            {/* Away 11 Player Discs */}
            {awayActive
              .filter((p) => p.onPitch && !p.redCarded)
              .map((p) => {
                const isCarrier = session.ballCarrierId === p.player.id;
                const isHovered = hoveredPlayerId === p.player.id;
                const isUserSelectable = session.userSide === 'AWAY' && !session.finished;
                const isSelectedSubOff = isUserSelectable && selectedSwapIds.includes(p.player.id);
                const showNameTag = isCarrier || isHovered || isSelectedSubOff;
                return (
                  <div
                    key={p.player.id}
                    role={isUserSelectable ? 'button' : undefined}
                    tabIndex={isUserSelectable ? 0 : undefined}
                    aria-label={isUserSelectable ? `Select ${p.player.name} for substitution` : undefined}
                    onMouseEnter={() => setHoveredPlayerId(p.player.id)}
                    onMouseLeave={() => setHoveredPlayerId(null)}
                    onClick={() => {
                      if (!isUserSelectable) return;
                      handleSelectPlayerFromArena(p.player.id);
                    }}
                    onKeyDown={(e) => {
                      if (!isUserSelectable) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectPlayerFromArena(p.player.id);
                      }
                    }}
                    style={{
                      left: `${p.x}%`,
                      top: `${p.y}%`,
                      transition: `left ${playerTransitionMs}ms linear, top ${playerTransitionMs}ms linear`,
                    }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center ${
                      isUserSelectable ? 'cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    <div
                      style={{
                        backgroundColor: awayDiscBg,
                        color: awayDiscText,
                        borderColor: session.away.club.secondaryColor,
                      }}
                      className={`rounded-full border-2 shadow-md flex items-center justify-center font-mono font-extrabold tabular-nums transition-transform duration-150 ${
                        isMobileLandscape ? 'w-5 h-5 text-[9px]' : 'w-6 h-6 sm:w-7 sm:h-7 text-[10px]'
                      } ${
                        isSelectedSubOff
                          ? 'scale-115 ring-2 ring-sky-400'
                          : isCarrier
                          ? 'scale-115 ring-2 ring-white'
                          : ''
                      }`}
                    >
                      {p.player.shirtNumber}
                    </div>
                    {showNameTag && (
                      <span className="mt-0.5 px-1.5 py-0.2 rounded bg-black/80 text-[9px] font-semibold text-white whitespace-nowrap pointer-events-none">
                        {p.player.name.split(' ').slice(-1)[0]}
                      </span>
                    )}
                  </div>
                );
              })}

            {/* Live Match Ball */}
            <div
              style={{
                left: `${session.ballPos.x}%`,
                top: `${session.ballPos.y}%`,
                transition: `left ${ballTransitionMs}ms cubic-bezier(0.25, 0.1, 0.25, 1), top ${ballTransitionMs}ms cubic-bezier(0.25, 0.1, 0.25, 1)`,
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none"
            >
              {isPlaying && (
                <span className="animate-ball-pulse absolute inset-0 -m-1.5 rounded-full bg-white/40" />
              )}
              <span className="relative block w-3 h-3 rounded-full bg-white border border-slate-900 shadow-lg" />
            </div>
          </div>

          {/* Live Commentary + Quick Split Metrics Under Pitch */}
          <div className="shrink-0 space-y-1.5">
            <div className="rounded-lg border border-white/10 bg-black/45 px-2.5 py-1.5 text-xs text-slate-200 flex items-center justify-between gap-2">
              <span className="truncate font-medium">{session.lastCommentary}</span>
              <span className="font-mono text-[11px] text-[#00FF85] shrink-0 tabular-nums">
                {session.minute}&apos;
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-mono bg-black/30 rounded-lg border border-white/10 py-1.5 px-3">
              <div>
                <div className="text-[10px] text-slate-400">{t(language, 'shots')}</div>
                <div className="text-white font-bold tabular-nums">
                  {session.home.shots} — {session.away.shots}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">{t(language, 'possession')}</div>
                <div className="text-[#00FF85] font-bold tabular-nums">
                  {homePossPct}% — {awayPossPct}%
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">{t(language, 'xgLabel')}</div>
                <div className="text-white font-bold tabular-nums">
                  {session.home.xg.toFixed(2)} — {session.away.xg.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Away Panel */}
        <div
          className={`border-l border-white/10 bg-black/35 flex flex-col gap-1.5 ${
            isMobileLandscape ? 'p-1.5 h-full min-h-0 overflow-hidden' : 'p-2.5 sm:p-3 border-t md:border-t-0'
          }`}
        >
          <div className="shrink-0 flex items-center justify-between border-b border-white/10 pb-1.5">
            <span className="text-[10px] font-mono text-slate-400">
              {session.away.subsUsed}/5
            </span>
            <div className="flex items-center gap-1 text-[10px] font-semibold">
              <button
                type="button"
                onClick={() => setAwayListTab('xi')}
                className={`px-2 py-0.5 rounded cursor-pointer whitespace-nowrap ${
                  awayListTab === 'xi' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t(language, 'starting11Tab')}
              </button>
              <button
                type="button"
                onClick={() => setAwayListTab('bench')}
                className={`px-2 py-0.5 rounded cursor-pointer whitespace-nowrap ${
                  awayListTab === 'bench' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t(language, 'benchTab')} ({awayBench.length})
              </button>
            </div>
          </div>

          <div
            className={`space-y-0.5 overflow-y-auto pr-0.5 ${
              isMobileLandscape ? 'flex-1 min-h-0' : 'max-h-[340px]'
            }`}
          >
            {(awayListTab === 'xi' ? awayActive : awayBench).map((p) =>
              renderSidebarRow(p, 'AWAY', p.player.id === awayCaptainId)
            )}
          </div>
        </div>
      </div>
        )}

        {/* Mobile Landscape Dedicated Tab View */}
        {isMobileLandscape && arenaTab !== 'pitch' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-3 bg-black/40">
            {renderAnalyticsContent(arenaTab)}
          </div>
        )}

        {/* Desktop Bottom 3 Sub-Tabs Below Arena: Fitness | Ratings | Stats */}
        {!isMobileLandscape && (
          <div className="p-4 sm:p-5 bg-black/40 space-y-4">
            <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-black/50 border border-white/10 w-fit">
              {(
                [
                  { id: 'fitness', label: t(language, 'fitnessTab'), icon: <Activity className="w-3.5 h-3.5" /> },
                  { id: 'ratings', label: t(language, 'ratingsTab'), icon: <Star className="w-3.5 h-3.5" /> },
                  { id: 'stats', label: t(language, 'stats'), icon: <BarChart3 className="w-3.5 h-3.5" /> },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    playSound('tab', soundEnabled);
                    setArenaTab(tab.id);
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                    activeBottomStatsTab === tab.id
                      ? 'bg-[#00FF85] text-slate-950 font-bold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
            {renderAnalyticsContent(activeBottomStatsTab)}
          </div>
        )}
      </div>
          </>
        ) : (
          <div className={isMobileLandscape ? 'flex flex-col h-full min-h-0 overflow-hidden' : 'space-y-0'}>
            {/* Tactical Screen Header with Back Button */}
            <div
              className={`shrink-0 border-b border-white/10 bg-black/60 flex flex-wrap items-center justify-between gap-2 ${
                isMobileLandscape ? 'px-3 py-2' : 'px-4 sm:px-6 py-3.5 gap-3'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={handleBackToMatch}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-3.5 py-2 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <ArrowLeft className="w-4 h-4 text-[#00FF85]" />
                  <span>{t(language, 'backToMatch')}</span>
                </button>
                <div className="min-w-0">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-[#00FF85] truncate">
                    {t(language, 'tacticsSubsTab')} · {userTeam.club.name}
                  </div>
                  {!isMobileLandscape && (
                    <div className="text-xs text-slate-300 truncate">
                      {compTheme.name} · {session.fixture.stageLabel ?? `Round ${session.fixture.round}`}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {!session.finished && (
                  <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/6 px-2.5 py-0.5 text-[10px] font-mono text-slate-300">
                    <Lock className="w-3 h-3 text-amber-300" />
                    {language === 'vi'
                      ? 'Không thể thoát khi trận đấu chưa kết thúc'
                      : 'Locked until Full Time'}
                  </span>
                )}
                <span className="rounded-lg border border-white/15 bg-black/50 px-3 py-1.5 font-mono text-xs font-bold text-white tabular-nums">
                  {session.home.club.shortName} {session.homeGoals} - {session.awayGoals}{' '}
                  {session.away.club.shortName} ·{' '}
                  <span className="text-[#00FF85]">{session.minute}&apos;</span>
                </span>
              </div>
            </div>

            <div
              className={
                isMobileLandscape
                  ? 'p-2.5 bg-black/40 flex-1 min-h-0 flex flex-col gap-2 overflow-hidden'
                  : 'p-4 sm:p-5 bg-black/40 space-y-4'
              }
            >
            {/* Sub-Tabs Bar + Formation Select + Subs Counter */}
            <div
              className={`shrink-0 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/35 ${
                isMobileLandscape ? 'px-3 py-1.5' : 'gap-3 px-4 py-2.5'
              }`}
            >
              <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-black/50 border border-white/15">
                {(
                  [
                    ['squad', t(language, 'lineupTabSquad'), <Users className="w-3.5 h-3.5" key="s" />],
                    ['tactical', t(language, 'lineupTabTactical'), <Sliders className="w-3.5 h-3.5" key="t" />],
                    ['roles', t(language, 'lineupTabRoles'), <Award className="w-3.5 h-3.5" key="r" />],
                  ] as const
                ).map(([id, label, icon]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      playSound('tab', soundEnabled);
                      setTacticsSubTab(id);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap ${
                      tacticsSubTab === id
                        ? 'bg-[#00FF85] text-slate-950 font-bold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {icon}
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-xs text-[#00FF85] font-bold tabular-nums">
                  {t(language, 'subsUsed')}: {userTeam.subsUsed}/5
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{t(language, 'formation')}:</span>
                  <select
                    aria-label="Live Formation"
                    disabled={session.finished}
                    value={liveUserClub.formation}
                    onChange={(e) => handleUpdateFormation(e.target.value as FormationName)}
                    className="rounded-lg border border-white/20 bg-black/55 px-3 py-1.5 text-xs font-mono text-white"
                  >
                    {ALL_FORMATIONS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {subFeedback && (
              <div
                className={`shrink-0 rounded-lg border px-3.5 py-2 text-xs font-medium flex items-center justify-between gap-2 ${
                  subFeedback.isError
                    ? 'border-rose-500/45 bg-rose-950/45 text-rose-200'
                    : 'border-[#00FF85]/45 bg-[#00FF85]/12 text-emerald-200'
                }`}
              >
                <span>{subFeedback.text}</span>
                <button
                  type="button"
                  onClick={() => setSubFeedback(null)}
                  className="text-slate-300 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Tactics Sub-Tab 1: PitchBoard Squad & Live Substitution */}
            {tacticsSubTab === 'squad' && (
              <div
                className={
                  isMobileLandscape
                    ? 'grid grid-cols-12 gap-2 flex-1 min-h-0 overflow-hidden'
                    : 'grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-5 items-start'
                }
              >
                {isMobileLandscape ? (
                  <>
                    {/* Mobile Landscape Col 1: Live 2D Pitch */}
                    <div className="col-span-5 h-full min-h-0 flex flex-col rounded-xl border border-white/12 bg-black/30 p-2 overflow-hidden">
                      <PitchBoard
                        club={liveUserClub}
                        formation={liveUserClub.formation}
                        startingIds={liveUserClub.startingIds}
                        benchIds={liveUserClub.benchIds}
                        readOnly={session.finished}
                        hideBench
                        selectedPlayerIds={selectedSwapIds}
                        displayMode="squad"
                        teamRoles={activeTeamRoles}
                        onSelectPlayer={handleSelectSwapPlayer}
                        onSwapPlayers={handleLiveSwapOrSub}
                      />
                    </div>

                    {/* Mobile Landscape Col 2: Tabbed Live Bench & Subbed-Off List */}
                    <div className="col-span-3 h-full min-h-0 flex flex-col rounded-xl border border-white/12 bg-black/35 p-2 overflow-hidden">
                      <div className="shrink-0 grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-black/50 border border-white/10 mb-1.5">
                        <button
                          type="button"
                          onClick={() => setTacticsBenchTab('bench')}
                          onDragOver={(e) => {
                            e.preventDefault();
                            if (tacticsBenchTab !== 'bench') setTacticsBenchTab('bench');
                          }}
                          className={`py-1 px-1 rounded text-[11px] font-semibold cursor-pointer truncate ${
                            tacticsBenchTab === 'bench'
                              ? 'bg-[#00FF85] text-slate-950 font-bold'
                              : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          {language === 'vi'
                            ? `Dự bị (${liveBenchPlayers.length})`
                            : `Bench (${liveBenchPlayers.length})`}
                        </button>
                        <button
                          type="button"
                          onClick={() => setTacticsBenchTab('unavailable')}
                          className={`py-1 px-1 rounded text-[11px] font-semibold cursor-pointer truncate ${
                            tacticsBenchTab === 'unavailable'
                              ? 'bg-[#00FF85] text-slate-950 font-bold'
                              : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          {language === 'vi'
                            ? `Đã ra sân (${unavailableOutPlayers.length})`
                            : `Out (${unavailableOutPlayers.length})`}
                        </button>
                      </div>

                      <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1">
                        {tacticsBenchTab === 'bench' ? (
                          liveBenchPlayers.length === 0 ? (
                            <div className="text-[11px] text-slate-400 py-6 text-center">
                              {language === 'vi' ? 'Không còn cầu thủ dự bị.' : 'No bench players remaining.'}
                            </div>
                          ) : (
                            liveBenchPlayers.map((player) => {
                              const isSel = selectedSwapIds.includes(player.id);
                              const isDropTarget = dragOverLiveCol2Id === player.id;
                              return (
                                <button
                                  key={player.id}
                                  type="button"
                                  disabled={session.finished}
                                  draggable={!session.finished}
                                  data-player-id={player.id}
                                  data-bench="true"
                                  onDragStart={(e) => {
                                    e.dataTransfer.effectAllowed = 'move';
                                    e.dataTransfer.setData('text/plain', player.id);
                                  }}
                                  onDragOver={(e) => {
                                    if (session.finished) return;
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = 'move';
                                    if (dragOverLiveCol2Id !== player.id) setDragOverLiveCol2Id(player.id);
                                  }}
                                  onDragLeave={() => {
                                    if (dragOverLiveCol2Id === player.id) setDragOverLiveCol2Id(null);
                                  }}
                                  onDrop={(e) => {
                                    if (session.finished) return;
                                    e.preventDefault();
                                    const sourceId = e.dataTransfer.getData('text/plain');
                                    setDragOverLiveCol2Id(null);
                                    if (sourceId && sourceId !== player.id) handleLiveSwapOrSub(sourceId, player.id);
                                  }}
                                  onClick={() => handleSelectSwapPlayer(player.id)}
                                  className={`w-full flex items-center justify-between gap-1.5 rounded-lg border px-2 py-1 text-left ${
                                    session.finished ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
                                  } ${
                                    isDropTarget
                                      ? 'border-[#00FF85] bg-emerald-500/20'
                                      : isSel
                                      ? 'border-sky-400 bg-sky-500/15'
                                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <PlayerAvatar
                                      playerId={player.id}
                                      name={player.name}
                                      shirtNumber={player.shirtNumber}
                                      position={player.position}
                                      primaryColor={liveUserClub.primaryColor}
                                      secondaryColor={liveUserClub.secondaryColor}
                                      size={26}
                                    />
                                    <div className="min-w-0">
                                      <div className="text-[11px] font-semibold text-white truncate">
                                        {player.name}
                                      </div>
                                      <div className="text-[9px] font-mono text-slate-400 flex items-center gap-1">
                                        <span>{player.detailedPosition ?? player.position}</span>
                                        <FitnessBar fitness={player.fitness} widthClass="w-7" />
                                      </div>
                                    </div>
                                  </div>
                                  <span className="font-mono text-xs font-bold text-emerald-300 tabular-nums shrink-0">
                                    {player.ovr}
                                  </span>
                                </button>
                              );
                            })
                          )
                        ) : unavailableOutPlayers.length === 0 ? (
                          <div className="text-[11px] text-slate-400 py-6 text-center">
                            {language === 'vi'
                              ? 'Chưa có cầu thủ rời sân hoặc thẻ đỏ.'
                              : 'No subbed-off or red-carded players yet.'}
                          </div>
                        ) : (
                          unavailableOutPlayers.map((p) => (
                            <div
                              key={p.player.id}
                              className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-slate-300 opacity-75"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono text-slate-400">#{p.player.shirtNumber}</span>
                                <span className="truncate">{p.player.name}</span>
                              </div>
                              <div className="shrink-0 font-mono text-[10px]">
                                {p.redCarded && <span className="text-rose-400 font-bold">RC</span>}
                                {p.subOutMinute !== undefined && (
                                  <span className="text-rose-300">▼{p.subOutMinute}&apos;</span>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  /* Original Desktop Left PitchBoard + Bench Below + Unavailable */
                  <div className="md:col-span-7 space-y-4">
                    <PitchBoard
                      club={liveUserClub}
                      formation={liveUserClub.formation}
                      startingIds={liveUserClub.startingIds}
                      benchIds={liveUserClub.benchIds}
                      readOnly={session.finished}
                      selectedPlayerIds={selectedSwapIds}
                      displayMode="squad"
                      teamRoles={activeTeamRoles}
                      onSelectPlayer={handleSelectSwapPlayer}
                      onSwapPlayers={handleLiveSwapOrSub}
                    />

                    {unavailableOutPlayers.length > 0 && (
                      <div className="rounded-xl border border-white/10 bg-black/35 p-3.5 space-y-2">
                        <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                          <span>
                            {language === 'vi'
                              ? 'Đã rời sân / Thẻ đỏ (Không thể vào lại)'
                              : 'Subbed Off / Red Carded (Unavailable)'}
                          </span>
                          <span className="font-mono text-[11px] text-slate-400">
                            {unavailableOutPlayers.length}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {unavailableOutPlayers.map((p) => (
                            <span
                              key={p.player.id}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300"
                            >
                              <span className="font-mono text-slate-400">#{p.player.shirtNumber}</span>
                              <span>{p.player.name}</span>
                              {p.redCarded && (
                                <span className="font-mono text-rose-400 font-bold">RC</span>
                              )}
                              {p.subOutMinute !== undefined && (
                                <span className="font-mono text-rose-300">▼{p.subOutMinute}&apos;</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Right Live Player Inspector & Swap/Sub Actions */}
                <aside
                  className={
                    isMobileLandscape
                      ? 'col-span-4 rounded-xl border border-white/12 bg-black/35 p-2.5 space-y-2.5 h-full min-h-0 overflow-y-auto'
                      : 'md:col-span-5 rounded-xl border border-white/12 bg-black/35 p-3.5 sm:p-4 space-y-4'
                  }
                >
                  {selectedSwapIds.length === 0 && (
                    <div className="py-10 px-3 text-center space-y-2.5">
                      <Users className="w-7 h-7 text-[#00FF85] mx-auto opacity-80" />
                      <div className="font-display text-base font-bold text-white">
                        {language === 'vi'
                          ? 'Sắp xếp đội hình & Thay người trực tiếp'
                          : 'Live Lineup & Substitution Inspector'}
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {language === 'vi'
                          ? 'Kéo thả 2 chiều hoặc chọn 2 cầu thủ giữa Sân chính và Dự bị để đổi vị trí hoặc thay người (tối đa 5 lượt).'
                          : 'Drag & drop or pick 2 players across Pitch and Bench to swap positions or substitute (max 5 subs).'}
                      </p>
                    </div>
                  )}

                  {selectedSwapIds.length === 1 && (() => {
                    const p = liveUserClub.players.find((pl) => pl.id === selectedSwapIds[0]);
                    if (!p) return null;
                    const sIdx = liveUserClub.startingIds.indexOf(p.id);
                    const slotLabel =
                      sIdx >= 0
                        ? slots[sIdx]?.label ?? p.detailedPosition ?? p.position
                        : p.detailedPosition ?? p.position;
                    const slotEval =
                      sIdx >= 0
                        ? getPlayerSlotEvaluation(p, slotLabel)
                        : { effectiveOvr: p.ovr, delta: 0 };
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
                            {language === 'vi'
                              ? sIdx >= 0
                                ? 'Chọn thêm 1 cầu thủ trên sân hoặc dự bị để đổi/thay'
                                : 'Chọn 1 cầu thủ trên sân để thay vào'
                              : sIdx >= 0
                              ? 'Pick another pitch or bench player to swap/sub'
                              : 'Pick a pitch player to replace'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedSwapIds([])}
                            className="text-xs text-slate-400 hover:text-white cursor-pointer"
                          >
                            {t(language, 'clearSelection')}
                          </button>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <PlayerAvatar
                              playerId={p.id}
                              name={p.name}
                              shirtNumber={p.shirtNumber}
                              position={p.position}
                              primaryColor={liveUserClub.primaryColor}
                              secondaryColor={liveUserClub.secondaryColor}
                              size={54}
                            />
                            <div className="min-w-0">
                              <div className="font-display text-xl font-bold text-white truncate">
                                {p.name}
                              </div>
                              <div className="text-xs font-mono text-[#00FF85]">
                                {slotLabel} · #{p.shirtNumber} · Fit {p.fitness}%
                              </div>
                            </div>
                          </div>
                          <div className="text-right font-mono shrink-0">
                            <div className="text-3xl font-extrabold text-[#00FF85] tabular-nums">
                              {slotEval.effectiveOvr}
                            </div>
                            <div className="text-[10px] text-slate-400">POT {p.potential}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-7 gap-1 text-center">
                          {faceStats.map(([lbl, val]) => (
                            <div key={lbl} className="rounded bg-white/5 py-1.5">
                              <div className="text-[9px] font-mono text-slate-400">{lbl}</div>
                              <div className="text-xs font-mono font-bold text-white tabular-nums">
                                {val}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {selectedSwapIds.length === 2 && (() => {
                    const pA = liveUserClub.players.find((p) => p.id === selectedSwapIds[0]);
                    const pB = liveUserClub.players.find((p) => p.id === selectedSwapIds[1]);
                    if (!pA || !pB) return null;
                    const onPitchA = userTeam.activeIds.includes(pA.id);
                    const onPitchB = userTeam.activeIds.includes(pB.id);
                    const isPitchSwap = onPitchA && onPitchB;
                    const isSub = onPitchA !== onPitchB;
                    const actionDisabled =
                      session.finished || (!isPitchSwap && !isSub) || (isSub && userTeam.subsUsed >= 5);

                    return (
                      <div className="space-y-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-white/10">
                          <span className="font-display text-base font-bold text-white">
                            {language === 'vi' ? 'Tổng quan 2 cầu thủ' : 'Overview Comparison'}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setComparisonOpen(true)}
                              className="inline-flex items-center gap-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs px-2.5 py-1.5 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View
                            </button>
                            <button
                              type="button"
                              disabled={actionDisabled}
                              onClick={() => handleLiveSwapOrSub(pA.id, pB.id)}
                              className="inline-flex items-center gap-1 rounded-lg bg-[#00FF85] hover:bg-emerald-300 disabled:opacity-45 text-slate-950 font-bold text-xs px-2.5 py-1.5 cursor-pointer"
                            >
                              <ArrowLeftRight className="w-3.5 h-3.5" />
                              {isPitchSwap
                                ? language === 'vi'
                                  ? 'Đổi vị trí trên sân'
                                  : 'Swap Pitch Positions'
                                : isSub
                                ? language === 'vi'
                                  ? `Xác nhận Thay người (${userTeam.subsUsed}/5)`
                                  : `Confirm Substitution (${userTeam.subsUsed}/5)`
                                : language === 'vi'
                                ? 'Cần chọn 1 cầu thủ trên sân'
                                : 'Pick a pitch player'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSwapIds([]);
                                setComparisonOpen(false);
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
                            const sIdx = liveUserClub.startingIds.indexOf(p.id);
                            const slotLabel =
                              sIdx >= 0
                                ? slots[sIdx]?.label ?? p.detailedPosition ?? p.position
                                : p.detailedPosition ?? p.position;
                            const slotEval =
                              sIdx >= 0
                                ? getPlayerSlotEvaluation(p, slotLabel)
                                : { effectiveOvr: p.ovr, delta: 0 };
                            const stats = [
                              ['PAC', p.attributes.pace, other.attributes.pace],
                              ['SHO', p.attributes.finishing, other.attributes.finishing],
                              ['PAS', p.attributes.passing, other.attributes.passing],
                              ['DRI', p.attributes.dribbling, other.attributes.dribbling],
                              ['DEF', p.attributes.defending, other.attributes.defending],
                              [
                                p.position === 'GK' ? 'GK' : 'PHY',
                                p.position === 'GK' ? p.attributes.goalkeeper : p.attributes.physical,
                                p.position === 'GK'
                                  ? other.attributes.goalkeeper
                                  : other.attributes.physical,
                              ],
                            ] as const;

                            return (
                              <div key={p.id} className={`rounded-lg border ${border} bg-black/35 p-3 space-y-2.5`}>
                                <div className="flex items-center gap-2 min-w-0">
                                  <PlayerAvatar
                                    playerId={p.id}
                                    name={p.name}
                                    shirtNumber={p.shirtNumber}
                                    position={p.position}
                                    primaryColor={liveUserClub.primaryColor}
                                    secondaryColor={liveUserClub.secondaryColor}
                                    size={40}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs font-bold text-white truncate">{p.name}</div>
                                    <div className="text-[10px] font-mono text-[#00FF85]">
                                      {slotLabel} · #{p.shirtNumber} · OVR {slotEval.effectiveOvr}
                                    </div>
                                  </div>
                                </div>
                                <div className="space-y-1 text-[10px] border-t border-white/10 pt-2">
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Fit / Age</span>
                                    <span className="font-mono text-white">
                                      {p.fitness}% · {p.age}y
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">{t(language, 'marketValue')}</span>
                                    <span className="font-mono text-white">
                                      {formatCurrency(p.marketValue)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">{t(language, 'weeklyWage')}</span>
                                    <span className="font-mono text-white">
                                      {formatCurrency(p.weeklyWage)}
                                    </span>
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

            {/* Tactics Sub-Tab 2: Player Slot Role & Team Tactics */}
            {tacticsSubTab === 'tactical' && (
              <div
                className={
                  isMobileLandscape
                    ? 'grid grid-cols-12 gap-2.5 flex-1 min-h-0 overflow-hidden'
                    : 'grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-5 items-start'
                }
              >
                <div className={isMobileLandscape ? 'col-span-6 h-full min-h-0 flex flex-col' : 'md:col-span-7'}>
                  <PitchBoard
                    club={liveUserClub}
                    formation={liveUserClub.formation}
                    startingIds={liveUserClub.startingIds}
                    benchIds={liveUserClub.benchIds}
                    readOnly={session.finished}
                    selectedPlayerId={tacticalPlayer?.id ?? null}
                    displayMode="tactical"
                    hideBench
                    teamRoles={activeTeamRoles}
                    onSelectPlayer={(pid) => setTacticalPlayerId(pid)}
                  />
                </div>
                <div
                  className={
                    isMobileLandscape
                      ? 'col-span-6 rounded-xl border border-white/12 bg-black/35 p-2.5 space-y-2.5 h-full min-h-0 overflow-y-auto'
                      : 'md:col-span-5 rounded-xl border border-white/12 bg-black/35 p-3.5 sm:p-4 space-y-4'
                  }
                >
                  {tacticalPlayer && activeSlotRole && (() => {
                    const slotEval = getPlayerSlotEvaluation(tacticalPlayer, tacticalSlotLabel);
                    const activeMastery = getPlayerRoleMastery(tacticalPlayer, activeSlotRole);
                    return (
                      <div className="rounded-lg border border-[#00FF85]/35 bg-[#00FF85]/8 p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[11px] font-mono text-[#00FF85]">
                              {tacticalSlotLabel} · {tacticalPlayer.detailedPosition ?? tacticalPlayer.position}
                            </div>
                            <div className="text-sm font-bold text-white truncate flex items-center gap-2">
                              <span>{tacticalPlayer.name}</span>
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
                            {t(language, 'playerRole')}
                          </label>
                          <select
                            disabled={session.finished || tacticalSlotIndex < 0}
                            value={activeSlotRole}
                            onChange={(e) => {
                              if (tacticalSlotIndex < 0) return;
                              handleUpdateSlotRole(tacticalSlotIndex, e.target.value as PlayerRole);
                            }}
                            className="w-full rounded-lg border border-white/20 bg-black/55 px-3 py-2 text-xs text-white"
                          >
                            {allowedRolesForSlot.map((r) => (
                              <option key={r} value={r}>
                                {r} [{getPlayerRoleMastery(tacticalPlayer, r)}]
                              </option>
                            ))}
                          </select>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {allowedRolesForSlot.map((r) => {
                              const mastery = getPlayerRoleMastery(tacticalPlayer, r);
                              const isSel = r === activeSlotRole;
                              return (
                                <button
                                  key={r}
                                  type="button"
                                  disabled={session.finished || tacticalSlotIndex < 0}
                                  onClick={() => {
                                    if (tacticalSlotIndex < 0) return;
                                    handleUpdateSlotRole(tacticalSlotIndex, r);
                                  }}
                                  className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-semibold cursor-pointer disabled:opacity-45 ${
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
                      <label className="block text-slate-300 mb-1">{t(language, 'tacticalPreset')}</label>
                      <select
                        disabled={session.finished}
                        value={liveUserClub.tactics.preset}
                        onChange={(e) => handleUpdatePreset(e.target.value as TacticalPreset)}
                        className="w-full rounded-lg border border-white/15 bg-black/50 px-2.5 py-2 text-white"
                      >
                        {PRESETS.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-300 mb-1">{t(language, 'buildUpStyle')}</label>
                      <select
                        disabled={session.finished}
                        value={liveUserClub.tactics.buildUpStyle}
                        onChange={(e) =>
                          handlePatchTacticField({ buildUpStyle: e.target.value as BuildUpStyle })
                        }
                        className="w-full rounded-lg border border-white/15 bg-black/50 px-2.5 py-2 text-white"
                      >
                        {BUILD_UP_STYLES.map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-300 mb-1">{t(language, 'defensiveApproach')}</label>
                      <select
                        disabled={session.finished}
                        value={liveUserClub.tactics.defensiveApproach}
                        onChange={(e) =>
                          handlePatchTacticField({
                            defensiveApproach: e.target.value as DefensiveApproach,
                          })
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
                    {(
                      [
                        ['playersInBox', liveUserClub.tactics.playersInBox, 'playersInBox'],
                        ['attackingWidth', liveUserClub.tactics.attackingWidth, 'attackingWidth'],
                        ['defensiveLine', liveUserClub.tactics.defensiveLine, 'defensiveLine'],
                      ] as const
                    ).map(([key, val, labelKey]) => (
                      <div key={key}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-300">{t(language, labelKey)}</span>
                          <span className="font-mono text-emerald-300 tabular-nums">{val}/10</span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={10}
                          disabled={session.finished}
                          value={Number(val)}
                          onChange={(e) =>
                            handlePatchTacticField({ [key]: Number(e.target.value) })
                          }
                          className="w-full accent-[#00FF85] cursor-pointer"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tactics Sub-Tab 3: Team Set-Piece & Captain Roles */}
            {tacticsSubTab === 'roles' && (
              <div
                className={
                  isMobileLandscape
                    ? 'grid grid-cols-2 lg:grid-cols-3 gap-2.5 flex-1 min-h-0 overflow-y-auto content-start'
                    : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5'
                }
              >
                {roleConfigs.map((rc) => {
                  const activePool = userActivePlayers
                    .filter((rt) => !rt.redCarded)
                    .map((rt) => rt.player);
                  const currentId = activeTeamRoles[rc.key] ?? activePool[0]?.id ?? '';
                  const sortedPool = [...activePool].sort((a, b) => rc.getMetric(b) - rc.getMetric(a));
                  return (
                    <div key={rc.key} className="rounded-lg border border-white/12 bg-black/35 p-3.5 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-white">
                        {rc.icon}
                        <span>{rc.label}</span>
                      </div>
                      <select
                        disabled={session.finished}
                        value={currentId}
                        onChange={(e) =>
                          handleUpdateTeamRoles({
                            ...activeTeamRoles,
                            [rc.key]: e.target.value,
                          })
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
        )}

      {comparisonOpen &&
        selectedSwapIds.length === 2 &&
        (() => {
          const pA = liveUserClub.players.find((p) => p.id === selectedSwapIds[0]);
          const pB = liveUserClub.players.find((p) => p.id === selectedSwapIds[1]);
          if (!pA || !pB) return null;
          return (
            <PlayerComparisonModal
              club={liveUserClub}
              playerA={pA}
              playerB={pB}
              language={language}
              onSwapPlayers={handleLiveSwapOrSub}
              onClose={() => setComparisonOpen(false)}
            />
          );
        })()}
    </div>
  </div>
  </ModalPortal>
  );
};
