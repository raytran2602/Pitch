import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Award,
  Crosshair,
  Eye,
  Flag,
  Shield,
  Sliders,
  Sparkles,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { ALL_FORMATIONS, deriveDefaultTeamRoles, FORMATION_SLOTS } from '../data/premierLeague2627';
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
import { playSound } from '../utils/sound';
import { formatCurrency, t } from '../utils/i18n';
import { useIsMobileLandscape } from '../utils/useMobileLandscape';
import { PlayerAvatar } from './ClubBadge';
import { FitnessBar, PitchBoard } from './PitchBoard';
import { PlayerComparisonModal } from './PlayerComparisonModal';
import { PlayerProfileModal } from './PlayerProfileModal';

interface LineupTacticsViewProps {
  club: Club;
  language: Language;
  soundEnabled: boolean;
  onUpdateLineup: (startingIds: string[], benchIds: string[]) => void;
  onUpdateTactics: (tactics: TacticsConfig) => void;
  onUpdatePlayerRole: (playerId: string, role: PlayerRole) => void;
  onUpdateSlotRole?: (slotIndex: number, role: PlayerRole, playerId: string) => void;
  onUpdateTeamRoles: (teamRoles: TeamRoles) => void;
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

const BUILD_UP_STYLES: BuildUpStyle[] = [
  'Short Passing',
  'Balanced',
  'Direct Passing',
  'Long Ball',
];

const DEF_APPROACHES: DefensiveApproach[] = [
  'High Press',
  'Balanced',
  'Mid Block',
  'Deep Block',
];

export const LineupTacticsView: React.FC<LineupTacticsViewProps> = ({
  club,
  language,
  soundEnabled,
  onUpdateLineup,
  onUpdateTactics,
  onUpdatePlayerRole,
  onUpdateSlotRole,
  onUpdateTeamRoles,
}) => {
  const isMobileLandscape = useIsMobileLandscape();
  const [subTab, setSubTab] = useState<'squad' | 'tactical' | 'roles'>('squad');
  const [benchSubTab, setBenchSubTab] = useState<'subs' | 'reserves'>('subs');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [dragOverCol2Id, setDragOverCol2Id] = useState<string | null>(null);
  const [profileModalPlayer, setProfileModalPlayer] = useState<Player | null>(null);
  const [tacticalPlayerId, setTacticalPlayerId] = useState<string>(
    club.startingIds[9] ?? club.startingIds[0] ?? club.players[0]?.id ?? ''
  );

  const bench = useMemo(() => {
    const map = new Map(club.players.map((p) => [p.id, p]));
    return club.benchIds.map((id) => map.get(id)).filter((p): p is Player => Boolean(p));
  }, [club.players, club.benchIds]);

  const reserves = useMemo(() => {
    const active = new Set([...club.startingIds, ...club.benchIds]);
    return club.players.filter((p) => !active.has(p.id) && isPlayerAvailableForMatchday(p));
  }, [club.players, club.startingIds, club.benchIds]);

  const activeTeamRoles: TeamRoles = useMemo(
    () => club.teamRoles ?? deriveDefaultTeamRoles(club.players),
    [club.teamRoles, club.players]
  );

  const slots = FORMATION_SLOTS[club.formation] ?? FORMATION_SLOTS['4-3-3'];

  const getPlayerContextInfo = (player: Player) => {
    const startIdx = club.startingIds.indexOf(player.id);
    if (startIdx >= 0) {
      const slot = slots[startIdx];
      const slotLabel = slot?.label ?? player.detailedPosition ?? player.position;
      const assignedRole = club.slotRoles?.[startIdx] ?? player.role;
      const slotEval = getPlayerSlotEvaluation(player, slotLabel);
      const mastery = getPlayerRoleMastery(player, assignedRole);
      return {
        zone: language === 'vi' ? `Đá chính (${slotLabel})` : `Starter (${slotLabel})`,
        slotLabel,
        assignedRole,
        slotEval,
        mastery,
      };
    }
    const benchIdx = club.benchIds.indexOf(player.id);
    const mastery = getPlayerRoleMastery(player, player.role);
    return {
      zone: benchIdx >= 0 ? (language === 'vi' ? 'Dự bị' : 'Substitutes') : language === 'vi' ? 'Dự phòng' : 'Reserves',
      slotLabel: player.detailedPosition ?? player.position,
      assignedRole: player.role,
      slotEval: {
        targetPos: player.detailedPosition ?? player.position,
        effectiveOvr: player.ovr,
        delta: 0,
        fitLevel: 'Natural' as const,
      },
      mastery,
    };
  };

  const tacticalPlayer =
    club.players.find((p) => p.id === tacticalPlayerId) ??
    club.players.find((p) => p.id === club.startingIds[0]) ??
    club.players[0];

  const tacticalSlotIndex = useMemo(() => {
    if (!tacticalPlayer) return -1;
    return club.startingIds.indexOf(tacticalPlayer.id);
  }, [tacticalPlayer, club.startingIds]);

  const tacticalSlotLabel = useMemo(() => {
    if (!tacticalPlayer) return '';
    if (tacticalSlotIndex === -1) return tacticalPlayer.detailedPosition ?? tacticalPlayer.position;
    return slots[tacticalSlotIndex]?.label ?? tacticalPlayer.detailedPosition ?? tacticalPlayer.position;
  }, [tacticalPlayer, tacticalSlotIndex, slots]);

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
      (tacticalSlotIndex >= 0 ? club.slotRoles?.[tacticalSlotIndex] : undefined) ??
      tacticalPlayer.role;
    if (allowedRolesForSlot.includes(candidate)) return candidate;
    const targetDp = slotLabelToDetailedPosition(tacticalSlotLabel, tacticalPlayer.position);
    return migrateLegacyRole(candidate, targetDp);
  }, [tacticalPlayer, tacticalSlotIndex, club.slotRoles, allowedRolesForSlot, tacticalSlotLabel]);

  const tacticalSlotEval = useMemo(() => {
    if (!tacticalPlayer) return null;
    return getPlayerSlotEvaluation(tacticalPlayer, tacticalSlotLabel);
  }, [tacticalPlayer, tacticalSlotLabel]);

  const selectedPlayers = useMemo(
    () =>
      selectedIds
        .map((id) => club.players.find((p) => p.id === id))
        .filter((p): p is Player => Boolean(p)),
    [selectedIds, club.players]
  );

  const playerOne = selectedPlayers[0] ?? null;
  const playerTwo = selectedPlayers[1] ?? null;

  const handleSwapPlayers = (id1: string, id2: string) => {
    if (id1 === id2) return;
    playSound('swap', soundEnabled);
    const nextStart = [...club.startingIds];
    const nextBench = [...club.benchIds];

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

    onUpdateLineup(nextStart, nextBench);
    setSelectedIds([]);
    setComparisonOpen(false);
    setDragOverCol2Id(null);
  };

  const handleSquadPlayerClick = (playerId: string) => {
    playSound('click', soundEnabled);
    setComparisonOpen(false);
    setSelectedIds((prev) => {
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

  const applyPreset = (preset: TacticalPreset) => {
    const map: Record<TacticalPreset, Partial<TacticsConfig>> = {
      Gegenpress: { buildUpStyle: 'Direct Passing', defensiveApproach: 'High Press', playersInBox: 7, attackingWidth: 7, defensiveLine: 8 },
      'Tiki-Taka': { buildUpStyle: 'Short Passing', defensiveApproach: 'High Press', playersInBox: 8, attackingWidth: 7, defensiveLine: 8 },
      'Counter-Attack': { buildUpStyle: 'Direct Passing', defensiveApproach: 'Mid Block', playersInBox: 6, attackingWidth: 7, defensiveLine: 5 },
      'Wing Play': { buildUpStyle: 'Balanced', defensiveApproach: 'High Press', playersInBox: 7, attackingWidth: 9, defensiveLine: 6 },
      'Park the Bus': { buildUpStyle: 'Long Ball', defensiveApproach: 'Deep Block', playersInBox: 4, attackingWidth: 5, defensiveLine: 3 },
      Balanced: { buildUpStyle: 'Balanced', defensiveApproach: 'Balanced', playersInBox: 6, attackingWidth: 6, defensiveLine: 6 },
    };
    onUpdateTactics({
      ...club.tactics,
      preset,
      ...map[preset],
    });
  };

  const roleConfigs: {
    key: keyof TeamRoles;
    label: string;
    icon: React.ReactNode;
    metricLabel: string;
    getMetric: (p: Player) => number;
  }[] = [
    {
      key: 'captainId',
      label: t(language, 'captainRole'),
      icon: <Shield className="w-4 h-4 text-amber-300" />,
      metricLabel: 'OVR',
      getMetric: (p) => p.ovr,
    },
    {
      key: 'penaltyId',
      label: t(language, 'penaltyTaker'),
      icon: <Crosshair className="w-4 h-4 text-[#00FF85]" />,
      metricLabel: 'PEN',
      getMetric: (p) => p.attributes.shootingDetails?.penalties ?? p.attributes.finishing,
    },
    {
      key: 'freeKickId',
      label: t(language, 'freeKickTaker'),
      icon: <Sparkles className="w-4 h-4 text-sky-300" />,
      metricLabel: 'FKA',
      getMetric: (p) => p.attributes.passingDetails?.fkAccuracy ?? p.attributes.passing,
    },
    {
      key: 'leftCornerId',
      label: t(language, 'leftCornerTaker'),
      icon: <Flag className="w-4 h-4 text-emerald-300" />,
      metricLabel: 'CRO',
      getMetric: (p) => p.attributes.passingDetails?.crossing ?? p.attributes.passing,
    },
    {
      key: 'rightCornerId',
      label: t(language, 'rightCornerTaker'),
      icon: <Flag className="w-4 h-4 text-teal-300" />,
      metricLabel: 'CRO',
      getMetric: (p) => p.attributes.passingDetails?.crossing ?? p.attributes.passing,
    },
  ];

  return (
    <div
      className={
        isMobileLandscape
          ? 'h-full min-h-0 flex flex-col gap-2 overflow-hidden'
          : 'space-y-4 lg:h-[calc(100vh-8.5rem)] lg:flex lg:flex-col lg:overflow-hidden'
      }
    >
      {/* Header + 3 Sub-Tabs: Squad / Tactical / Team Roles */}
      <div
        className={`shrink-0 flex flex-wrap items-center justify-between gap-2 pitch-panel rounded-2xl ${
          isMobileLandscape ? 'px-3 py-1.5' : 'sm:gap-4 px-4 py-3 sm:px-5 sm:py-3.5'
        }`}
      >
        <div className="min-w-0">
          <h2
            className={`font-display font-bold text-white truncate ${
              isMobileLandscape ? 'text-lg' : 'text-xl sm:text-2xl'
            }`}
          >
            {club.name} · {t(language, 'navLineup')}
          </h2>
          {!isMobileLandscape && (
            <p className="hidden sm:block text-xs text-slate-400">
              {subTab === 'squad'
                ? language === 'vi'
                  ? 'Nhấn 1 cầu thủ để xem chi tiết · Nhấn 2 cầu thủ để so sánh trực tiếp ở cột phải · Kéo thả để thay người'
                  : 'Click 1 player to inspect · Click 2 players to compare side-by-side on the right · Drag & drop to swap'
                : subTab === 'tactical'
                ? language === 'vi'
                  ? 'Nhấn trực tiếp cầu thủ trên sơ đồ để chỉnh Role theo vị trí (Base / Role+ / Role++) và chiến thuật'
                  : 'Click any starter on the pitch to customize position-specific Role (Base / Role+ / Role++) & tactics'
                : language === 'vi'
                ? 'Phân công Đội trưởng và các chuyên gia đá phạt cố định của đội bóng'
                : 'Assign Captain and set-piece specialists (Penalties, Free Kicks & Corners)'}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-black/45 border border-white/15">
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
                playSound('click', soundEnabled);
                setSubTab(id);
              }}
              className={`inline-flex items-center gap-1.5 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap ${
                isMobileLandscape ? 'px-2.5 py-1' : 'px-4 py-1.5'
              } ${
                subTab === id
                  ? 'bg-[#00FF85] text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: SQUAD */}
      {subTab === 'squad' && (
        <div
          className={
            isMobileLandscape
              ? 'grid grid-cols-12 gap-2 flex-1 min-h-0 overflow-hidden'
              : 'grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-5 items-stretch lg:flex-1 lg:min-h-0'
          }
        >
          {isMobileLandscape ? (
            <>
              {/* Mobile Landscape Column 1: 2D Pitch filling 100% height */}
              <div className="col-span-5 h-full min-h-0 flex flex-col pitch-panel rounded-2xl p-2 overflow-hidden">
                <PitchBoard
                  club={club}
                  formation={club.formation}
                  startingIds={club.startingIds}
                  benchIds={club.benchIds}
                  selectedPlayerIds={selectedIds}
                  displayMode="squad"
                  hideBench
                  teamRoles={activeTeamRoles}
                  onSelectPlayer={handleSquadPlayerClick}
                  onSwapPlayers={handleSwapPlayers}
                />
              </div>

              {/* Mobile Landscape Column 2: Tabbed Substitutes (9) / Reserves List */}
              <div className="col-span-3 h-full min-h-0 flex flex-col pitch-panel rounded-2xl p-2 overflow-hidden">
                <div className="shrink-0 grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-black/50 border border-white/10 mb-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      playSound('click', soundEnabled);
                      setBenchSubTab('subs');
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (benchSubTab !== 'subs') setBenchSubTab('subs');
                    }}
                    className={`py-1 px-1 rounded text-[11px] font-semibold cursor-pointer truncate ${
                      benchSubTab === 'subs'
                        ? 'bg-[#00FF85] text-slate-950 font-bold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {language === 'vi' ? `Dự bị (${bench.length}/9)` : `Subs (${bench.length}/9)`}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playSound('click', soundEnabled);
                      setBenchSubTab('reserves');
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (benchSubTab !== 'reserves') setBenchSubTab('reserves');
                    }}
                    className={`py-1 px-1 rounded text-[11px] font-semibold cursor-pointer truncate ${
                      benchSubTab === 'reserves'
                        ? 'bg-[#00FF85] text-slate-950 font-bold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {language === 'vi' ? `Dự phòng (${reserves.length})` : `Reserves (${reserves.length})`}
                  </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1">
                  {(benchSubTab === 'subs' ? bench : reserves).length === 0 ? (
                    <div className="text-[11px] text-slate-400 py-6 text-center">
                      {benchSubTab === 'subs'
                        ? language === 'vi'
                          ? 'Chưa có cầu thủ dự bị.'
                          : 'No substitutes selected.'
                        : language === 'vi'
                        ? 'Không có cầu thủ dự phòng.'
                        : 'No reserve players.'}
                    </div>
                  ) : (
                    (benchSubTab === 'subs' ? bench : reserves).map((player) => {
                      const isSel = selectedIds.includes(player.id);
                      const isDropTarget = dragOverCol2Id === player.id;
                      const isSuspended = player.suspendedMatches > 0;
                      const isInjured = (player.injuredMatches ?? 0) > 0;
                      return (
                        <button
                          key={player.id}
                          type="button"
                          draggable
                          data-player-id={player.id}
                          data-bench={benchSubTab === 'subs' ? 'true' : undefined}
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', player.id);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                            if (dragOverCol2Id !== player.id) setDragOverCol2Id(player.id);
                          }}
                          onDragLeave={() => {
                            if (dragOverCol2Id === player.id) setDragOverCol2Id(null);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const sourceId = e.dataTransfer.getData('text/plain');
                            setDragOverCol2Id(null);
                            if (sourceId && sourceId !== player.id) handleSwapPlayers(sourceId, player.id);
                          }}
                          onClick={() => handleSquadPlayerClick(player.id)}
                          className={`w-full flex items-center justify-between gap-1.5 rounded-lg border px-2 py-1 text-left cursor-grab active:cursor-grabbing transition-colors ${
                            isDropTarget
                              ? 'border-[#00FF85] bg-emerald-500/20'
                              : isSel
                              ? 'border-sky-400 bg-sky-500/15'
                              : isSuspended || isInjured
                              ? 'border-rose-500/60 bg-rose-950/35'
                              : 'border-white/10 bg-white/5 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <PlayerAvatar
                              playerId={player.id}
                              name={player.name}
                              shirtNumber={player.shirtNumber}
                              position={player.position}
                              primaryColor={club.primaryColor}
                              secondaryColor={club.secondaryColor}
                              size={26}
                            />
                            <div className="min-w-0">
                              <div className="text-[11px] font-semibold text-white truncate flex items-center gap-1">
                                <span className="truncate">{player.name}</span>
                                {player.loanInfo?.direction === 'IN' && (
                                  <span className="text-[8px] font-mono text-sky-300 shrink-0">[LN]</span>
                                )}
                                {isSuspended && (
                                  <span className="text-[9px] font-mono text-rose-300 shrink-0">[SUS]</span>
                                )}
                                {isInjured && (
                                  <span className="text-[9px] font-mono text-rose-300 shrink-0">[INJ]</span>
                                )}
                              </div>
                              <div className="text-[9px] text-slate-400 font-mono flex items-center gap-1">
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
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Original Desktop Left Column: Pitch + Substitutes (9) + Reserves (Internal Scroll) */
            <div className="md:col-span-7 space-y-5 lg:h-full lg:overflow-y-auto lg:pr-1">
              <div className="pitch-panel rounded-2xl p-4 sm:p-5">
                <PitchBoard
                  club={club}
                  formation={club.formation}
                  startingIds={club.startingIds}
                  benchIds={club.benchIds}
                  selectedPlayerIds={selectedIds}
                  displayMode="squad"
                  teamRoles={activeTeamRoles}
                  onSelectPlayer={handleSquadPlayerClick}
                  onSwapPlayers={handleSwapPlayers}
                />
              </div>

              <section className="rounded-xl border border-white/12 bg-black/30 p-4 sm:p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                  <h3 className="font-display text-lg font-bold text-white">
                    {t(language, 'reserves')} ({reserves.length})
                  </h3>
                  <span className="text-xs text-slate-400">
                    {language === 'vi'
                      ? 'Kéo thả 2 chiều giữa Đá chính / Dự bị / Dự phòng · Nhấn để xem / so sánh'
                      : 'Drag & drop with Pitch or Subs · Click to inspect or compare'}
                  </span>
                </div>

                {reserves.length === 0 ? (
                  <div className="text-xs text-slate-400 py-4 text-center">
                    {language === 'vi'
                      ? 'Hiện chưa có cầu thủ dự phòng ngoài danh sách đăng ký trận đấu.'
                      : 'No reserve players outside the active matchday 20.'}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {reserves.map((player) => {
                      const isSel = selectedIds.includes(player.id);
                      const isDropTarget = dragOverCol2Id === player.id;
                      const isSuspended = player.suspendedMatches > 0;
                      const isInjured = (player.injuredMatches ?? 0) > 0;
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
                            if (dragOverCol2Id !== player.id) setDragOverCol2Id(player.id);
                          }}
                          onDragLeave={() => {
                            if (dragOverCol2Id === player.id) setDragOverCol2Id(null);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const sourceId = e.dataTransfer.getData('text/plain');
                            setDragOverCol2Id(null);
                            if (sourceId && sourceId !== player.id) handleSwapPlayers(sourceId, player.id);
                          }}
                          onClick={() => handleSquadPlayerClick(player.id)}
                          className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left cursor-grab active:cursor-grabbing transition-colors ${
                            isDropTarget
                              ? 'border-[#00FF85] bg-emerald-500/20'
                              : isSel
                              ? 'border-sky-400 bg-sky-500/15'
                              : isSuspended || isInjured
                              ? 'border-rose-500/60 bg-rose-950/35'
                              : 'border-white/10 bg-white/5 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <PlayerAvatar
                              playerId={player.id}
                              name={player.name}
                              shirtNumber={player.shirtNumber}
                              position={player.position}
                              primaryColor={club.primaryColor}
                              secondaryColor={club.secondaryColor}
                              size={36}
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-white truncate flex items-center gap-1">
                                <span className="truncate">{player.name}</span>
                                {player.loanInfo?.direction === 'IN' && (
                                  <span className="text-[9px] font-mono text-sky-300 shrink-0">[LOAN]</span>
                                )}
                                {isSuspended && (
                                  <span className="text-[10px] font-mono text-rose-300 shrink-0">[SUS]</span>
                                )}
                                {isInjured && (
                                  <span className="text-[10px] font-mono text-rose-300 shrink-0">[INJ]</span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
                                <span>{player.detailedPosition ?? player.position}</span>
                                <FitnessBar fitness={player.fitness} />
                              </div>
                            </div>
                          </div>
                          <span className="font-mono text-sm font-bold text-emerald-300 tabular-nums shrink-0">
                            {player.ovr}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* Inspector Column (col-span-4 on Mobile Landscape, col-span-5 on Desktop) */}
          <aside
            className={
              isMobileLandscape
                ? 'col-span-4 pitch-panel rounded-2xl p-2.5 space-y-2.5 h-full min-h-0 overflow-y-auto'
                : 'md:col-span-5 pitch-panel rounded-2xl p-4 sm:p-5 space-y-4 lg:h-full lg:overflow-y-auto'
            }
          >
            {!playerOne && (
              <div className="py-12 px-4 text-center space-y-3">
                <Users className="w-8 h-8 text-[#00FF85] mx-auto opacity-80" />
                <div className="font-display text-lg font-bold text-white">
                  {language === 'vi' ? 'Kiểm tra & So sánh cầu thủ' : 'Player Inspector & Comparison'}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                  {t(language, 'selectToInspect')}
                </p>
              </div>
            )}

            {/* Case 1: Single Player Selected */}
            {playerOne && !playerTwo && (() => {
              const info = getPlayerContextInfo(playerOne);
              const masteryStyle = getRoleMasteryBadgeClasses(info.mastery);
              const faceStats = [
                ['PAC', playerOne.attributes.pace],
                ['SHO', playerOne.attributes.finishing],
                ['PAS', playerOne.attributes.passing],
                ['DRI', playerOne.attributes.dribbling],
                ['DEF', playerOne.attributes.defending],
                ['PHY', playerOne.attributes.physical],
                ['GK', playerOne.attributes.goalkeeper],
              ] as const;

              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-sky-300">
                      {info.zone} · {language === 'vi' ? 'Chọn thêm 1 người để so sánh' : 'Click another player to compare'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedIds([])}
                      className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      {t(language, 'clearSelection')}
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <PlayerAvatar
                        playerId={playerOne.id}
                        name={playerOne.name}
                        shirtNumber={playerOne.shirtNumber}
                        position={playerOne.position}
                        primaryColor={club.primaryColor}
                        secondaryColor={club.secondaryColor}
                        size={64}
                      />
                      <div className="min-w-0">
                        <h3 className="font-display text-2xl font-bold text-white truncate">
                          {playerOne.name}
                        </h3>
                        <div className="text-xs text-slate-300 flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span className="font-mono font-bold text-[#00FF85]">
                            {playerOne.detailedPosition ?? playerOne.position}
                            {playerOne.secondaryPositions && playerOne.secondaryPositions.length > 0
                              ? ` / ${playerOne.secondaryPositions.join(', ')}`
                              : ''}
                          </span>
                          <span>·</span>
                          <span>#{playerOne.shirtNumber}</span>
                          <span>·</span>
                          <span>Age {playerOne.age}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-mono font-bold ${masteryStyle.badge}`}
                          >
                            {info.assignedRole} · {info.mastery}
                          </span>
                          {playerOne.loanInfo?.direction === 'IN' && (
                            <span className="rounded border border-sky-400/45 bg-sky-500/15 px-2 py-0.5 text-[10px] font-mono font-bold text-sky-200">
                              {t(language, 'loanInBadge')} ({playerOne.loanInfo.counterpartyClubName})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-display text-4xl font-extrabold text-[#00FF85] tabular-nums leading-none">
                        {info.slotEval.effectiveOvr}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 mt-1 tabular-nums">
                        {info.slotEval.delta < 0
                          ? `Base ${playerOne.ovr} (${info.slotEval.delta})`
                          : `POT ${playerOne.potential}`}
                      </div>
                    </div>
                  </div>

                  {((playerOne.suspendedMatches ?? 0) > 0 || (playerOne.injuredMatches ?? 0) > 0) && (
                    <div className="rounded-lg border border-rose-500/50 bg-rose-950/50 px-3 py-2 text-xs font-mono text-rose-200">
                      {playerOne.suspendedMatches > 0 &&
                        `${t(language, 'suspended')}: ${playerOne.suspendedMatches} match(es) `}
                      {(playerOne.injuredMatches ?? 0) > 0 &&
                        `${t(language, 'injured')}: ${playerOne.injuryNote ?? 'Injury'} (${playerOne.injuredMatches}m)`}
                    </div>
                  )}

                  {/* Quick Financial / Availability Strip */}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-lg border border-white/10 bg-black/35 p-2.5">
                      <div className="text-slate-400 text-[11px]">Fitness</div>
                      <div className="font-mono font-bold text-emerald-300 tabular-nums mt-0.5">
                        {playerOne.fitness}%
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/35 p-2.5">
                      <div className="text-slate-400 text-[11px]">{t(language, 'marketValue')}</div>
                      <div className="font-mono font-bold text-white tabular-nums mt-0.5">
                        {formatCurrency(playerOne.marketValue)}
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/35 p-2.5">
                      <div className="text-slate-400 text-[11px]">{t(language, 'weeklyWage')}</div>
                      <div className="font-mono font-bold text-white tabular-nums mt-0.5">
                        {formatCurrency(playerOne.weeklyWage)}/wk
                      </div>
                    </div>
                  </div>

                  {/* 7 General Face Stats */}
                  <div className="grid grid-cols-7 gap-1.5 text-center">
                    {faceStats.map(([label, val]) => (
                      <div key={label} className="rounded-lg border border-white/10 bg-white/5 py-2 px-1">
                        <div className="text-[10px] font-mono text-slate-400">{label}</div>
                        <div className="font-mono text-sm font-extrabold text-white tabular-nums mt-0.5">
                          {val}
                        </div>
                      </div>
                    ))}
                  </div>

                  {playerOne.playStyles && playerOne.playStyles.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {playerOne.playStyles.map((ps) => (
                        <span
                          key={ps}
                          className="rounded border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-200"
                        >
                          {ps}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="pt-2 border-t border-white/10 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setProfileModalPlayer(playerOne)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#00FF85] hover:bg-emerald-300 text-slate-950 font-bold text-xs px-3.5 py-2 cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      {t(language, 'viewProfile')}
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Case 2: Two Players Selected — Two-Column Side-by-Side Overview + View Popup */}
            {playerOne && playerTwo && (() => {
              const infoA = getPlayerContextInfo(playerOne);
              const infoB = getPlayerContextInfo(playerTwo);
              const masteryA = getRoleMasteryBadgeClasses(infoA.mastery);
              const masteryB = getRoleMasteryBadgeClasses(infoB.mastery);
              const ovrDiff = infoA.slotEval.effectiveOvr - infoB.slotEval.effectiveOvr;

              return (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
                    <span className="font-display text-base font-bold text-white">
                      {language === 'vi' ? 'Tổng quan 2 cầu thủ' : 'Overview Comparison'}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setComparisonOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs px-3 py-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {language === 'vi' ? 'View Chi tiết' : 'View'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSwapPlayers(playerOne.id, playerTwo.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#00FF85] hover:bg-emerald-300 text-slate-950 font-bold text-xs px-3 py-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                        {t(language, 'swapSelected')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedIds([]);
                          setComparisonOpen(false);
                        }}
                        className="rounded-lg border border-white/20 bg-white/8 hover:bg-white/15 text-slate-200 font-semibold text-xs px-2.5 py-1.5 cursor-pointer"
                      >
                        {t(language, 'clearSelection')}
                      </button>
                    </div>
                  </div>

                  {/* Two Side-by-Side Overview Columns */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { p: playerOne, other: playerTwo, info: infoA, masteryStyle: masteryA, diff: ovrDiff, accent: 'border-[#00FF85]/45' },
                      { p: playerTwo, other: playerOne, info: infoB, masteryStyle: masteryB, diff: -ovrDiff, accent: 'border-sky-400/45' },
                    ].map(({ p, other, info, masteryStyle, diff, accent }) => {
                      const faceStats = [
                        ['PAC', p.attributes.pace, other.attributes.pace],
                        ['SHO', p.attributes.finishing, other.attributes.finishing],
                        ['PAS', p.attributes.passing, other.attributes.passing],
                        ['DRI', p.attributes.dribbling, other.attributes.dribbling],
                        ['DEF', p.attributes.defending, other.attributes.defending],
                        [p.position === 'GK' ? 'GK' : 'PHY', p.position === 'GK' ? p.attributes.goalkeeper : p.attributes.physical, p.position === 'GK' ? other.attributes.goalkeeper : other.attributes.physical],
                      ] as const;

                      return (
                        <div key={p.id} className={`rounded-xl border ${accent} bg-black/35 p-3.5 space-y-3`}>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <PlayerAvatar
                              playerId={p.id}
                              name={p.name}
                              shirtNumber={p.shirtNumber}
                              position={p.position}
                              primaryColor={club.primaryColor}
                              secondaryColor={club.secondaryColor}
                              size={46}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-[10px] font-mono text-slate-400 truncate">{info.zone}</div>
                              <div className="text-sm font-bold text-white truncate">{p.name}</div>
                              <div className="text-[11px] font-mono text-[#00FF85] truncate">
                                {p.detailedPosition ?? p.position} · #{p.shirtNumber}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                            <span className={`rounded border px-1.5 py-0.5 text-[10px] font-mono font-bold truncate ${masteryStyle.badge}`}>
                              {info.assignedRole} · {info.mastery}
                            </span>
                            <div className="text-right font-mono shrink-0 tabular-nums">
                              <span className="text-xl font-extrabold text-[#00FF85]">
                                {info.slotEval.effectiveOvr}
                              </span>
                              {diff !== 0 && (
                                <span
                                  className={`ml-1 text-[11px] font-bold ${
                                    diff > 0 ? 'text-emerald-400' : 'text-rose-400'
                                  }`}
                                >
                                  ({diff > 0 ? `+${diff}` : diff})
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="space-y-1.5 text-[11px] border-t border-white/10 pt-2">
                            <div className="flex justify-between">
                              <span className="text-slate-400">{language === 'vi' ? 'Tuổi / Chân' : 'Age / Foot'}</span>
                              <span className="font-mono text-white">{p.age} · {p.preferredFoot}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">{language === 'vi' ? 'Thể lực' : 'Fitness'}</span>
                              <span className="font-mono font-bold text-emerald-300 tabular-nums">{p.fitness}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">{t(language, 'marketValue')}</span>
                              <span className="font-mono text-white tabular-nums">{formatCurrency(p.marketValue)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">{t(language, 'weeklyWage')}</span>
                              <span className="font-mono text-white tabular-nums">{formatCurrency(p.weeklyWage)}/wk</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">{t(language, 'contractExpiry')}</span>
                              <span className="font-mono text-slate-200 tabular-nums">{p.contractExpiry}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-white/10 text-center">
                            {faceStats.map(([lbl, v1, v2]) => (
                              <div key={lbl} className="rounded bg-white/5 px-1.5 py-1">
                                <div className="text-[9px] font-mono text-slate-400">{lbl}</div>
                                <div
                                  className={`font-mono text-xs font-bold tabular-nums ${
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

      {/* TAB 2: TACTICAL */}
      {subTab === 'tactical' && (
        <div
          className={
            isMobileLandscape
              ? 'grid grid-cols-12 gap-2.5 items-stretch flex-1 min-h-0 overflow-hidden'
              : 'grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 items-stretch lg:flex-1 lg:min-h-0'
          }
        >
          <div
            className={
              isMobileLandscape
                ? 'col-span-6 pitch-panel rounded-2xl p-2 space-y-1.5 h-full min-h-0 flex flex-col overflow-hidden'
                : 'md:col-span-7 pitch-panel rounded-2xl p-3.5 sm:p-5 space-y-3 lg:h-full lg:overflow-y-auto'
            }
          >
            <div className="shrink-0 flex items-center justify-between text-xs text-slate-300 pb-2 border-b border-white/10">
              <span className="truncate">
                {language === 'vi'
                  ? 'Sơ đồ vai trò chiến thuật · Nhấn cầu thủ để chỉnh Role'
                  : 'Tactical Roles Pitch · Click any starter to edit their role'}
              </span>
              <span className="font-mono font-bold text-[#00FF85] shrink-0">{club.formation}</span>
            </div>

            <div className={isMobileLandscape ? 'flex-1 min-h-0' : ''}>
              <PitchBoard
                club={club}
                formation={club.formation}
                startingIds={club.startingIds}
                benchIds={club.benchIds}
                selectedPlayerId={tacticalPlayer?.id ?? null}
                displayMode="tactical"
                hideBench
                teamRoles={activeTeamRoles}
                onSelectPlayer={(pid) => {
                  playSound('click', soundEnabled);
                  setTacticalPlayerId(pid);
                }}
              />
            </div>
          </div>

          <div
            className={
              isMobileLandscape
                ? 'col-span-6 pitch-panel rounded-2xl p-3 space-y-3 h-full min-h-0 overflow-y-auto'
                : 'md:col-span-5 pitch-panel rounded-2xl p-4 sm:p-5 space-y-4 sm:space-y-5 lg:h-full lg:overflow-y-auto'
            }
          >
            {tacticalPlayer && tacticalSlotEval && activeSlotRole && (() => {
              const activeMastery = getPlayerRoleMastery(tacticalPlayer, activeSlotRole);
              const activeMasteryStyle = getRoleMasteryBadgeClasses(activeMastery);
              return (
                <div className="rounded-xl border border-[#00FF85]/35 bg-[#00FF85]/8 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <PlayerAvatar
                        playerId={tacticalPlayer.id}
                        name={tacticalPlayer.name}
                        shirtNumber={tacticalPlayer.shirtNumber}
                        position={tacticalPlayer.position}
                        primaryColor={club.primaryColor}
                        secondaryColor={club.secondaryColor}
                        size={46}
                      />
                      <div className="min-w-0">
                        <div className="text-[11px] font-mono text-[#00FF85]">
                          Slot {tacticalSlotLabel} · Natural: {tacticalPlayer.detailedPosition ?? tacticalPlayer.position}
                          {tacticalPlayer.secondaryPositions && tacticalPlayer.secondaryPositions.length > 0
                            ? ` / ${tacticalPlayer.secondaryPositions.join(', ')}`
                            : ''}
                        </div>
                        <div className="text-sm font-bold text-white truncate">{tacticalPlayer.name}</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-xl font-extrabold text-white tabular-nums">
                        {tacticalSlotEval.effectiveOvr}
                      </div>
                      <div className="text-[10px] font-mono text-slate-300 tabular-nums">
                        {tacticalSlotEval.delta === 0
                          ? `Base ${tacticalPlayer.ovr}`
                          : `Base ${tacticalPlayer.ovr} (${tacticalSlotEval.delta})`}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <label htmlFor="pitch-player-role" className="text-slate-300">
                        {t(language, 'playerRole')} ({tacticalSlotLabel})
                      </label>
                      <span
                        className={`rounded border px-2 py-0.5 font-mono text-[11px] font-bold ${activeMasteryStyle.badge}`}
                      >
                        {activeMastery}
                      </span>
                    </div>
                    <select
                      id="pitch-player-role"
                      value={activeSlotRole}
                      onChange={(e) => {
                        const nextRole = e.target.value as PlayerRole;
                        playSound('click', soundEnabled);
                        if (onUpdateSlotRole && tacticalSlotIndex >= 0) {
                          onUpdateSlotRole(tacticalSlotIndex, nextRole, tacticalPlayer.id);
                        } else {
                          onUpdatePlayerRole(tacticalPlayer.id, nextRole);
                        }
                      }}
                      className="w-full rounded-lg border border-white/20 bg-black/55 px-3 py-2 text-sm text-white"
                    >
                      {allowedRolesForSlot.map((role) => {
                        const m = getPlayerRoleMastery(tacticalPlayer, role);
                        return (
                          <option key={role} value={role}>
                            {role} [{m}]
                          </option>
                        );
                      })}
                    </select>

                    {/* Color-coded Role Mastery quick selector chips */}
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      {allowedRolesForSlot.map((role) => {
                        const m = getPlayerRoleMastery(tacticalPlayer, role);
                        const style = getRoleMasteryBadgeClasses(m);
                        const isChosen = role === activeSlotRole;
                        return (
                          <button
                            key={role}
                            type="button"
                            onClick={() => {
                              playSound('click', soundEnabled);
                              if (onUpdateSlotRole && tacticalSlotIndex >= 0) {
                                onUpdateSlotRole(tacticalSlotIndex, role, tacticalPlayer.id);
                              } else {
                                onUpdatePlayerRole(tacticalPlayer.id, role);
                              }
                            }}
                            className={`flex items-center justify-between gap-1.5 rounded-md border px-2 py-1.5 text-[11px] cursor-pointer transition-colors ${
                              isChosen
                                ? 'border-white/50 bg-white/15 text-white font-bold'
                                : 'border-white/10 bg-black/35 text-slate-300 hover:bg-white/10'
                            }`}
                          >
                            <span className="truncate">{role}</span>
                            <span className={`font-mono text-[10px] font-bold shrink-0 ${style.text}`}>
                              {m}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}

            <h3 className="font-display text-xl font-bold text-white border-b border-white/10 pb-2">
              {t(language, 'tacticsTitle')}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs text-slate-300 mb-1">{t(language, 'tacticalPreset')}</label>
                <select
                  value={club.tactics.preset}
                  onChange={(e) => applyPreset(e.target.value as TacticalPreset)}
                  className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
                >
                  {PRESETS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">{t(language, 'formation')}</label>
                <select
                  value={club.tactics.formation}
                  onChange={(e) =>
                    onUpdateTactics({ ...club.tactics, formation: e.target.value as FormationName })
                  }
                  className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm font-mono text-white"
                >
                  {FORMATIONS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">{t(language, 'buildUpStyle')}</label>
                <select
                  value={club.tactics.buildUpStyle}
                  onChange={(e) =>
                    onUpdateTactics({ ...club.tactics, buildUpStyle: e.target.value as BuildUpStyle })
                  }
                  className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
                >
                  {BUILD_UP_STYLES.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">{t(language, 'defensiveApproach')}</label>
                <select
                  value={club.tactics.defensiveApproach}
                  onChange={(e) =>
                    onUpdateTactics({
                      ...club.tactics,
                      defensiveApproach: e.target.value as DefensiveApproach,
                    })
                  }
                  className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
                >
                  {DEF_APPROACHES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-white/10">
              {[
                ['playersInBox', club.tactics.playersInBox, 'playersInBox'],
                ['attackingWidth', club.tactics.attackingWidth, 'attackingWidth'],
                ['defensiveLine', club.tactics.defensiveLine, 'defensiveLine'],
              ].map(([key, val, labelKey]) => (
                <div key={String(key)}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">{t(language, String(labelKey))}</span>
                    <span className="font-mono text-emerald-300 tabular-nums">{val}/10</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={Number(val)}
                    onChange={(e) =>
                      onUpdateTactics({
                        ...club.tactics,
                        [key as string]: Number(e.target.value),
                      })
                    }
                    className="w-full accent-[#00FF85]"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TEAM ROLES */}
      {subTab === 'roles' && (
        <div
          className={
            isMobileLandscape
              ? 'rounded-xl border border-white/12 bg-black/35 p-3 space-y-3 flex-1 min-h-0 overflow-y-auto'
              : 'rounded-xl border border-white/12 bg-black/35 p-6 space-y-5 lg:flex-1 lg:min-h-0 lg:overflow-y-auto'
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div>
              <h3 className="font-display text-xl font-bold text-white">
                {t(language, 'lineupTabRoles')}
              </h3>
              <p className="text-xs text-slate-400">
                {language === 'vi'
                  ? 'Đội trưởng giúp tăng tổ chức đội hình; cầu thủ đá phạt cố định hưởng trọng số ghi bàn và kiến tạo trong trận.'
                  : 'Your Captain boosts tactical composure; designated set-piece takers earn match simulation scoring and assist priority.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                playSound('accept', soundEnabled);
                onUpdateTeamRoles(deriveDefaultTeamRoles(club.players));
              }}
              className="rounded-lg border border-white/20 bg-white/10 hover:bg-white/15 px-3.5 py-2 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
            >
              {language === 'vi' ? 'Tự động chọn tốt nhất' : 'Auto-Assign Best Specialists'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {roleConfigs.map((rc) => {
              const eligible = club.players.filter(isPlayerAvailableForMatchday);
              const currentId = activeTeamRoles[rc.key] ?? eligible[0]?.id;
              const currentPlayer =
                eligible.find((p) => p.id === currentId) ?? eligible[0];
              const sortedPool = [...eligible].sort((a, b) => rc.getMetric(b) - rc.getMetric(a));

              return (
                <div
                  key={rc.key}
                  className="rounded-xl border border-white/12 bg-black/40 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-bold text-white">
                      {rc.icon}
                      <span>{rc.label}</span>
                    </div>
                    {currentPlayer && (
                      <span className="font-mono text-xs font-bold text-[#00FF85] tabular-nums">
                        {rc.metricLabel} {rc.getMetric(currentPlayer)}
                      </span>
                    )}
                  </div>

                  {currentPlayer && (
                    <div className="flex items-center gap-3 rounded-lg border border-white/8 bg-white/4 p-2.5">
                      <PlayerAvatar
                        playerId={currentPlayer.id}
                        name={currentPlayer.name}
                        shirtNumber={currentPlayer.shirtNumber}
                        position={currentPlayer.position}
                        primaryColor={club.primaryColor}
                        secondaryColor={club.secondaryColor}
                        size={42}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-white truncate">
                          {currentPlayer.name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {currentPlayer.detailedPosition ?? currentPlayer.position} · #{currentPlayer.shirtNumber} · OVR {currentPlayer.ovr}
                        </div>
                      </div>
                    </div>
                  )}

                  <select
                    aria-label={rc.label}
                    value={currentPlayer?.id ?? ''}
                    onChange={(e) => {
                      playSound('click', soundEnabled);
                      onUpdateTeamRoles({
                        ...activeTeamRoles,
                        [rc.key]: e.target.value,
                      });
                    }}
                    className="w-full rounded-lg border border-white/15 bg-black/55 px-3 py-2 text-xs text-white"
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
        </div>
      )}

      {profileModalPlayer && (
        <PlayerProfileModal
          player={profileModalPlayer}
          club={club}
          language={language}
          isScouted
          onClose={() => setProfileModalPlayer(null)}
        />
      )}

      {comparisonOpen && playerOne && playerTwo && (
        <PlayerComparisonModal
          club={club}
          playerA={playerOne}
          playerB={playerTwo}
          language={language}
          onSwapPlayers={handleSwapPlayers}
          onClose={() => setComparisonOpen(false)}
        />
      )}
    </div>
  );
};
