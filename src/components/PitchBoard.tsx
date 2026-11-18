import React, { useEffect, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import { FORMATION_SLOTS } from '../data/premierLeague2627';
import { Club, FormationName, Player, TeamRoles } from '../types/game';
import { getPlayerRoleMastery, getPlayerSlotEvaluation, getRoleMasteryBadgeClasses } from '../utils/playerAttributes';
import { PlayerAvatar } from './ClubBadge';

export const FitnessBar: React.FC<{ fitness: number; widthClass?: string }> = ({
  fitness,
  widthClass = 'w-12',
}) => {
  const pct = Math.max(0, Math.min(100, Math.round(fitness)));
  const barColor =
    pct >= 75 ? 'bg-[#00FF85]' : pct >= 50 ? 'bg-amber-400' : 'bg-rose-500';
  return (
    <span
      className={`inline-block ${widthClass} h-1.5 rounded-full bg-white/15 overflow-hidden align-middle shrink-0`}
      title={`${pct}% Fitness`}
      aria-label={`Fitness ${pct}%`}
    >
      <span className={`block h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
    </span>
  );
};

interface PitchBoardProps {
  club: Club;
  formation: FormationName;
  startingIds: string[];
  benchIds: string[];
  selectedPlayerId?: string | null;
  selectedPlayerIds?: string[];
  readOnly?: boolean;
  displayMode?: 'squad' | 'tactical';
  hideBench?: boolean;
  teamRoles?: TeamRoles;
  onSelectPlayer?: (playerId: string, slotIndex?: number) => void;
  onSwapPlayers?: (sourcePlayerId: string, targetPlayerId: string) => void;
}

const MarqueeText: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflowPx, setOverflowPx] = useState(0);

  useEffect(() => {
    const measure = () => {
      const container = containerRef.current;
      const span = textRef.current;
      if (!container || !span) return;
      const diff = Math.ceil(span.scrollWidth - container.clientWidth);
      setOverflowPx(diff > 2 ? diff + 4 : 0);
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro && containerRef.current) ro.observe(containerRef.current);
    return () => ro?.disconnect();
  }, [text]);

  const duration = Math.max(2.6, Math.min(7, overflowPx / 18 + 2.2));

  return (
    <div ref={containerRef} className={`w-full overflow-hidden whitespace-nowrap ${className}`}>
      <span
        ref={textRef}
        className={overflowPx > 0 ? 'inline-block animate-marquee-pingpong' : 'inline-block'}
        style={
          overflowPx > 0
            ? ({
                '--marquee-offset': `-${overflowPx}px`,
                '--marquee-duration': `${duration}s`,
              } as React.CSSProperties)
            : undefined
        }
      >
        {text}
      </span>
    </div>
  );
};

export const PitchBoard: React.FC<PitchBoardProps> = ({
  club,
  formation,
  startingIds,
  benchIds,
  selectedPlayerId = null,
  selectedPlayerIds,
  readOnly = false,
  displayMode = 'squad',
  hideBench = false,
  teamRoles,
  onSelectPlayer,
  onSwapPlayers,
}) => {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const slots = FORMATION_SLOTS[formation] ?? FORMATION_SLOTS['4-3-3'];
  const playerMap = new Map(club.players.map((p) => [p.id, p]));

  const starters: (Player | undefined)[] = startingIds.map((id) => playerMap.get(id));
  const bench: Player[] = benchIds
    .map((id) => playerMap.get(id))
    .filter((p): p is Player => Boolean(p));

  const activeSet = new Set(
    selectedPlayerIds && selectedPlayerIds.length > 0
      ? selectedPlayerIds
      : selectedPlayerId
      ? [selectedPlayerId]
      : []
  );

  const handleDragStart = (e: React.DragEvent, playerId: string) => {
    if (readOnly) return;
    setDraggedId(playerId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', playerId);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    if (readOnly) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverId !== targetId) {
      setDragOverId(targetId);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    if (readOnly) return;
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain') || draggedId;
    setDraggedId(null);
    setDragOverId(null);
    if (sourceId && sourceId !== targetId) {
      onSwapPlayers?.(sourceId, targetId);
    }
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const roles = teamRoles ?? club.teamRoles;
  const allowDrag = !readOnly && displayMode === 'squad';
  const isTactical = displayMode === 'tactical';

  return (
    <div className={hideBench ? 'flex flex-col h-full min-h-0' : 'space-y-4'}>
      {/* 2D Football Pitch */}
      <div
        className={`pitch-board-surface pitch-turf w-full relative rounded-2xl overflow-hidden border border-white/15 ${
          hideBench ? 'flex-1 min-h-[380px] sm:min-h-[460px]' : 'min-h-[420px] sm:min-h-[520px]'
        }`}
      >
        {/* Turf mow stripes & crisp pitch markings */}
        <svg
          viewBox="0 0 100 130"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full pointer-events-none opacity-60"
          aria-hidden="true"
        >
          <rect x="0" y="0" width="100" height="13" fill="rgba(255,255,255,0.035)" />
          <rect x="0" y="26" width="100" height="13" fill="rgba(255,255,255,0.035)" />
          <rect x="0" y="52" width="100" height="13" fill="rgba(255,255,255,0.035)" />
          <rect x="0" y="78" width="100" height="13" fill="rgba(255,255,255,0.035)" />
          <rect x="0" y="104" width="100" height="13" fill="rgba(255,255,255,0.035)" />
          {/* Touchline & Goal Lines */}
          <rect x="4" y="4" width="92" height="122" fill="none" stroke="rgba(255,255,255,0.52)" strokeWidth="0.65" />
          {/* Halfway Line & Center Circle */}
          <line x1="4" y1="65" x2="96" y2="65" stroke="rgba(255,255,255,0.52)" strokeWidth="0.65" />
          <circle cx="50" cy="65" r="12" fill="none" stroke="rgba(255,255,255,0.52)" strokeWidth="0.65" />
          <circle cx="50" cy="65" r="1" fill="rgba(255,255,255,0.8)" />
          {/* Top Penalty Box, 6-yard Box, Spot & Arc */}
          <rect x="24" y="4" width="52" height="18" fill="none" stroke="rgba(255,255,255,0.52)" strokeWidth="0.65" />
          <rect x="37" y="4" width="26" height="7" fill="none" stroke="rgba(255,255,255,0.52)" strokeWidth="0.65" />
          <circle cx="50" cy="15.5" r="0.7" fill="rgba(255,255,255,0.75)" />
          <path d="M 41 22 A 11 9 0 0 0 59 22" fill="none" stroke="rgba(255,255,255,0.52)" strokeWidth="0.65" />
          <rect x="43" y="2.2" width="14" height="1.8" fill="rgba(255,255,255,0.16)" stroke="rgba(255,255,255,0.5)" strokeWidth="0.45" />
          {/* Bottom Penalty Box, 6-yard Box, Spot & Arc */}
          <rect x="24" y="108" width="52" height="18" fill="none" stroke="rgba(255,255,255,0.52)" strokeWidth="0.65" />
          <rect x="37" y="119" width="26" height="7" fill="none" stroke="rgba(255,255,255,0.52)" strokeWidth="0.65" />
          <circle cx="50" cy="114.5" r="0.7" fill="rgba(255,255,255,0.75)" />
          <path d="M 41 108 A 11 9 0 0 1 59 108" fill="none" stroke="rgba(255,255,255,0.52)" strokeWidth="0.65" />
          <rect x="43" y="126" width="14" height="1.8" fill="rgba(255,255,255,0.16)" stroke="rgba(255,255,255,0.5)" strokeWidth="0.45" />
          {/* Corner Arcs */}
          <path d="M 4 7 A 3 3 0 0 0 7 4" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.55" />
          <path d="M 93 4 A 3 3 0 0 0 96 7" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.55" />
          <path d="M 4 123 A 3 3 0 0 1 7 126" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.55" />
          <path d="M 93 126 A 3 3 0 0 1 96 123" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.55" />
        </svg>

        {/* Formation tokens */}
        {slots.map((slot, idx) => {
          const player = starters[idx];
          if (!player) return null;
          const isSelected = activeSet.has(player.id);
          const isDragging = draggedId === player.id;
          const isDropTarget = dragOverId === player.id && draggedId !== player.id;
          const isSuspended = player.suspendedMatches > 0;
          const isInjured = (player.injuredMatches ?? 0) > 0;
          const slotEval = getPlayerSlotEvaluation(player, slot.label);
          const assignedRole = club.slotRoles?.[slot.slotIndex] ?? player.role;
          const mastery = getPlayerRoleMastery(player, assignedRole);
          const masteryStyle = getRoleMasteryBadgeClasses(mastery);

          const fitnessColor =
            player.fitness >= 82
              ? 'bg-[#00FF85]'
              : player.fitness >= 65
              ? 'bg-amber-400'
              : 'bg-rose-500';

          const ovrBadgeColor =
            slotEval.fitLevel === 'OutOfPosition'
              ? 'text-rose-300 border-rose-400/65 bg-rose-950/90'
              : slotEval.delta < 0
              ? 'text-amber-300 border-amber-400/55 bg-amber-950/85'
              : 'text-[#00FF85] border-white/25 bg-[#070B12]/95';

          const isCaptain = roles?.captainId === player.id;
          const surname = player.name.split(' ').slice(-1)[0];

          return (
            <button
              key={slot.slotIndex}
              type="button"
              disabled={readOnly}
              draggable={allowDrag}
              data-player-id={player.id}
              data-slot-index={slot.slotIndex}
              onDragStart={(e) => allowDrag && handleDragStart(e, player.id)}
              onDragOver={(e) => allowDrag && handleDragOver(e, player.id)}
              onDragLeave={() => dragOverId === player.id && setDragOverId(null)}
              onDrop={(e) => allowDrag && handleDrop(e, player.id)}
              onDragEnd={handleDragEnd}
              onClick={() => !readOnly && onSelectPlayer?.(player.id, slot.slotIndex)}
              style={{
                left: `${slot.x}%`,
                top: `${slot.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
              title={`${player.name} · ${slot.label} OVR ${slotEval.effectiveOvr}${slotEval.delta < 0 ? ` (${slotEval.delta})` : ''} · ${assignedRole} (${mastery})${isInjured ? ` · Injured (${player.injuredMatches}m)` : ''}${isSuspended ? ` · Suspended (${player.suspendedMatches}m)` : ''}`}
              aria-label={`${slot.label} ${player.name} Effective OVR ${slotEval.effectiveOvr}`}
              className={`pitch-token absolute flex flex-col items-center rounded-xl px-1.5 py-1.5 backdrop-blur-sm border shadow-[0_8px_20px_rgba(0,0,0,0.55)] transition-all duration-150 focus-visible:outline-2 focus-visible:outline-[#00FF85] ${
                isTactical
                  ? 'w-[116px] h-[86px] justify-between overflow-hidden'
                  : 'gap-1'
              } ${
                readOnly
                  ? 'cursor-default'
                  : allowDrag
                  ? 'cursor-grab active:cursor-grabbing hover:border-white/35'
                  : 'cursor-pointer hover:border-white/35'
              } ${
                isDragging
                  ? 'opacity-45 scale-95'
                  : isDropTarget
                  ? 'ring-2 ring-[#00FF85] border-[#00FF85] bg-emerald-950/85 z-30 scale-105'
                  : isSelected
                  ? 'ring-2 ring-sky-400 border-sky-400 bg-[#080E18]/95 z-20'
                  : isSuspended || isInjured
                  ? 'bg-rose-950/90 border-rose-500/75 ring-1 ring-rose-500/70 z-10'
                  : 'bg-[#070B12]/80 border-white/15 hover:bg-[#070B12]/95'
              }`}
            >
              <div className="relative shrink-0">
                <PlayerAvatar
                  playerId={player.id}
                  name={player.name}
                  shirtNumber={player.shirtNumber}
                  position={player.position}
                  primaryColor={club.primaryColor}
                  secondaryColor={club.secondaryColor}
                  size={isTactical ? 42 : 46}
                />
                {!isTactical && (
                  <span
                    className={`absolute -top-1 -right-2 px-1 py-0.2 rounded-md border text-[10px] font-mono font-bold tabular-nums shadow ${ovrBadgeColor}`}
                  >
                    {slotEval.effectiveOvr}
                    {slotEval.delta < 0 ? `!` : ''}
                  </span>
                )}
                {isCaptain && !isSuspended && !isInjured && (
                  <span
                    title="Captain"
                    className="absolute -top-1 -left-2 px-1 rounded bg-amber-400 text-slate-950 text-[9px] font-mono font-black leading-tight shadow"
                  >
                    C
                  </span>
                )}
                {isSuspended && (
                  <span
                    title="Suspended"
                    className="absolute -top-1 -left-2 px-1 rounded-[2px] bg-rose-600 border border-white/70 text-[8px] font-mono font-black text-white shadow"
                  >
                    RC
                  </span>
                )}
                {!isSuspended && isInjured && (
                  <span
                    title={player.injuryNote ?? 'Injured'}
                    className="absolute -top-1 -left-2 px-1 rounded-[2px] bg-rose-600 border border-white/70 text-[9px] font-mono font-black text-white shadow"
                  >
                    +
                  </span>
                )}
              </div>

              {isTactical ? (
                <div className="w-full text-center leading-tight min-w-0">
                  <MarqueeText
                    text={surname}
                    className="text-[11px] font-semibold text-white"
                  />
                  <MarqueeText
                    text={`${slot.label} · ${assignedRole} (${mastery})`}
                    className={`text-[9px] font-medium ${masteryStyle.text}`}
                  />
                </div>
              ) : (
                <>
                  <div className="text-center leading-tight max-w-[116px]">
                    <div className="text-[11px] font-semibold text-white truncate">
                      {surname}
                    </div>
                    <div className="text-[9px] text-slate-300 font-mono uppercase flex items-center justify-center gap-1">
                      <span>{slot.label}</span>
                      <span className={`font-bold ${masteryStyle.text}`}>{masteryStyle.shortLabel}</span>
                    </div>
                  </div>
                  {/* Fitness bar */}
                  <div className="w-12 h-1 rounded-full bg-white/20 overflow-hidden">
                    <div
                      className={`h-full ${fitnessColor}`}
                      style={{ width: `${Math.max(8, Math.min(100, player.fitness))}%` }}
                    />
                  </div>
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Substitutes Bench directly below Pitch (no Role+ mastery display) */}
      {!hideBench && (
        <div className="pitch-panel rounded-2xl p-3.5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <h4 className="font-display text-base font-bold text-white tracking-wide uppercase">
              Substitutes ({bench.length}/9)
            </h4>
            <span className="text-xs text-emerald-300 font-mono px-2 py-0.5 rounded bg-white/[0.05] border border-white/10">
              {formation}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {bench.map((player) => {
              const isSelected = activeSet.has(player.id);
              const isDragging = draggedId === player.id;
              const isDropTarget = dragOverId === player.id && draggedId !== player.id;
              const isSuspended = player.suspendedMatches > 0;
              const isInjured = (player.injuredMatches ?? 0) > 0;
              return (
                <button
                  key={player.id}
                  type="button"
                  disabled={readOnly}
                  draggable={!readOnly}
                  data-player-id={player.id}
                  data-bench="true"
                  onDragStart={(e) => handleDragStart(e, player.id)}
                  onDragOver={(e) => handleDragOver(e, player.id)}
                  onDragLeave={() => dragOverId === player.id && setDragOverId(null)}
                  onDrop={(e) => handleDrop(e, player.id)}
                  onDragEnd={handleDragEnd}
                  onClick={() => !readOnly && onSelectPlayer?.(player.id)}
                  aria-label={`Bench ${player.name} OVR ${player.ovr}`}
                  className={`w-full flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left border transition-colors ${
                    readOnly ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
                  } ${
                    isDragging
                      ? 'opacity-45'
                      : isDropTarget
                      ? 'border-[#00FF85] bg-emerald-500/20'
                      : isSelected
                      ? 'border-sky-400 bg-sky-500/15'
                      : isSuspended || isInjured
                      ? 'border-rose-500/70 bg-rose-950/40'
                      : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.09] hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {!readOnly && <GripVertical className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
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
                        {isSuspended && (
                          <span className="text-[10px] font-mono font-bold text-rose-300 shrink-0" title="Suspended">
                            [SUS]
                          </span>
                        )}
                        {isInjured && (
                          <span className="text-[10px] font-mono font-bold text-rose-300 shrink-0" title={player.injuryNote ?? 'Injured'}>
                            [INJ]
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono whitespace-nowrap flex items-center gap-1.5">
                        <span className="px-1 rounded bg-white/[0.07] text-slate-200">{player.detailedPosition ?? player.position}</span>
                        <FitnessBar fitness={player.fitness} />
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-mono font-bold tabular-nums text-[#00FF85] shrink-0">
                    {player.ovr}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
