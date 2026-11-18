import React from 'react';
import { Player } from '../types/game';
import { normalizePlayer } from '../utils/playerAttributes';

interface FifaAttributesGridProps {
  player: Player;
  compareTo?: Player | null;
  compact?: boolean;
}

function ratingTextClass(val: number): string {
  if (val >= 85) return 'text-[#00FF85]';
  if (val >= 75) return 'text-lime-300';
  if (val >= 65) return 'text-amber-300';
  return 'text-slate-400';
}

function ratingBarClass(val: number): string {
  if (val >= 85) return 'bg-[#00FF85]';
  if (val >= 75) return 'bg-lime-400';
  if (val >= 65) return 'bg-amber-400';
  return 'bg-slate-500';
}

export const FifaAttributesGrid: React.FC<FifaAttributesGridProps> = ({
  player: rawPlayer,
  compareTo: rawCompare = null,
  compact = false,
}) => {
  const player = normalizePlayer(rawPlayer);
  const other = rawCompare ? normalizePlayer(rawCompare) : null;
  const a = player.attributes;
  const b = other?.attributes ?? null;

  const faceStats: [string, number, number | undefined][] = [
    ['PAC', a.pace, b?.pace],
    ['SHO', a.finishing, b?.finishing],
    ['PAS', a.passing, b?.passing],
    ['DRI', a.dribbling, b?.dribbling],
    ['DEF', a.defending, b?.defending],
    ['PHY', a.physical, b?.physical],
    ['GK', a.goalkeeper, b?.goalkeeper],
  ];

  const categories: {
    title: string;
    overall: number;
    otherOverall?: number;
    items: [string, number, number | undefined][];
  }[] = [
    {
      title: 'Pace',
      overall: a.pace,
      otherOverall: b?.pace,
      items: [
        ['Acceleration', a.paceDetails!.acceleration, b?.paceDetails?.acceleration],
        ['Sprint Speed', a.paceDetails!.sprintSpeed, b?.paceDetails?.sprintSpeed],
      ],
    },
    {
      title: 'Shooting',
      overall: a.finishing,
      otherOverall: b?.finishing,
      items: [
        ['Att. Positioning', a.shootingDetails!.positioning, b?.shootingDetails?.positioning],
        ['Finishing', a.shootingDetails!.finishing, b?.shootingDetails?.finishing],
        ['Shot Power', a.shootingDetails!.shotPower, b?.shootingDetails?.shotPower],
        ['Long Shots', a.shootingDetails!.longShots, b?.shootingDetails?.longShots],
        ['Volleys', a.shootingDetails!.volleys, b?.shootingDetails?.volleys],
        ['Penalties', a.shootingDetails!.penalties, b?.shootingDetails?.penalties],
      ],
    },
    {
      title: 'Passing',
      overall: a.passing,
      otherOverall: b?.passing,
      items: [
        ['Vision', a.passingDetails!.vision, b?.passingDetails?.vision],
        ['Crossing', a.passingDetails!.crossing, b?.passingDetails?.crossing],
        ['FK Accuracy', a.passingDetails!.fkAccuracy, b?.passingDetails?.fkAccuracy],
        ['Short Passing', a.passingDetails!.shortPassing, b?.passingDetails?.shortPassing],
        ['Long Passing', a.passingDetails!.longPassing, b?.passingDetails?.longPassing],
        ['Curve', a.passingDetails!.curve, b?.passingDetails?.curve],
      ],
    },
    {
      title: 'Dribbling',
      overall: a.dribbling,
      otherOverall: b?.dribbling,
      items: [
        ['Agility', a.dribblingDetails!.agility, b?.dribblingDetails?.agility],
        ['Balance', a.dribblingDetails!.balance, b?.dribblingDetails?.balance],
        ['Reactions', a.dribblingDetails!.reactions, b?.dribblingDetails?.reactions],
        ['Ball Control', a.dribblingDetails!.ballControl, b?.dribblingDetails?.ballControl],
        ['Dribbling', a.dribblingDetails!.dribbling, b?.dribblingDetails?.dribbling],
        ['Composure', a.dribblingDetails!.composure, b?.dribblingDetails?.composure],
      ],
    },
    {
      title: 'Defending',
      overall: a.defending,
      otherOverall: b?.defending,
      items: [
        ['Interceptions', a.defendingDetails!.interceptions, b?.defendingDetails?.interceptions],
        ['Heading Acc.', a.defendingDetails!.headingAccuracy, b?.defendingDetails?.headingAccuracy],
        ['Def. Awareness', a.defendingDetails!.defAwareness, b?.defendingDetails?.defAwareness],
        ['Stand Tackle', a.defendingDetails!.standingTackle, b?.defendingDetails?.standingTackle],
        ['Slide Tackle', a.defendingDetails!.slidingTackle, b?.defendingDetails?.slidingTackle],
      ],
    },
    {
      title: 'Physical',
      overall: a.physical,
      otherOverall: b?.physical,
      items: [
        ['Jumping', a.physicalDetails!.jumping, b?.physicalDetails?.jumping],
        ['Stamina', a.physicalDetails!.stamina, b?.physicalDetails?.stamina],
        ['Strength', a.physicalDetails!.strength, b?.physicalDetails?.strength],
        ['Aggression', a.physicalDetails!.aggression, b?.physicalDetails?.aggression],
      ],
    },
    {
      title: 'Goalkeeper',
      overall: a.goalkeeper,
      otherOverall: b?.goalkeeper,
      items: [
        ['GK Diving', a.goalkeeperDetails!.diving, b?.goalkeeperDetails?.diving],
        ['GK Handling', a.goalkeeperDetails!.handling, b?.goalkeeperDetails?.handling],
        ['GK Kicking', a.goalkeeperDetails!.kicking, b?.goalkeeperDetails?.kicking],
        ['GK Positioning', a.goalkeeperDetails!.positioning, b?.goalkeeperDetails?.positioning],
        ['GK Reflexes', a.goalkeeperDetails!.reflexes, b?.goalkeeperDetails?.reflexes],
      ],
    },
  ];

  return (
    <div className="space-y-4">
      {/* EA FC Summary Strip + Meta */}
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
        {faceStats.map(([label, val, otherVal]) => {
          const diff = otherVal !== undefined ? val - otherVal : null;
          return (
            <div
              key={label}
              className="rounded-lg border border-white/10 bg-black/40 px-2.5 py-2 text-center"
            >
              <div className="text-[10px] font-semibold tracking-wider text-slate-400">{label}</div>
              <div className={`font-mono text-lg font-extrabold tabular-nums ${ratingTextClass(val)}`}>
                {val}
              </div>
              {diff !== null && (
                <div
                  className={`font-mono text-[10px] tabular-nums ${
                    diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-rose-400' : 'text-slate-500'
                  }`}
                >
                  {otherVal} ({diff > 0 ? `+${diff}` : diff})
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Weak Foot / Skill Moves / Work Rates / PlayStyles */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/30 px-3.5 py-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <span className="text-slate-400">Weak Foot: </span>
            <span className="font-mono font-bold text-amber-300">{player.weakFoot ?? 3}★</span>
          </div>
          <div>
            <span className="text-slate-400">Skill Moves: </span>
            <span className="font-mono font-bold text-amber-300">{player.skillMoves}★</span>
          </div>
          <div>
            <span className="text-slate-400">Work Rate: </span>
            <span className="font-mono font-semibold text-white">
              {player.attackingWorkRate ?? 'Medium'} / {player.defensiveWorkRate ?? 'Medium'}
            </span>
          </div>
        </div>
        {player.playStyles && player.playStyles.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {player.playStyles.map((ps) => (
              <span
                key={ps}
                className="rounded border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-200"
              >
                {ps}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Detailed FIFA / FC Attribute Groups (all 7 always expanded) */}
      <div
        className={`grid gap-3 ${
          compact ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
        }`}
      >
        {categories.map((cat) => (
          <div
            key={cat.title}
            className="rounded-lg border border-white/10 bg-black/35 p-3 space-y-2"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                {cat.title}
              </span>
              <div className="flex items-center gap-1.5 font-mono text-sm font-extrabold tabular-nums">
                <span className={ratingTextClass(cat.overall)}>{cat.overall}</span>
                {cat.otherOverall !== undefined && (
                  <span className="text-[11px] text-slate-400 font-normal">
                    vs {cat.otherOverall}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              {cat.items.map(([subLabel, val, otherVal]) => {
                const diff = otherVal !== undefined ? val - otherVal : null;
                return (
                  <div key={subLabel} className="space-y-0.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-300">{subLabel}</span>
                      <div className="flex items-center gap-1.5 font-mono tabular-nums">
                        <span className={`font-bold ${ratingTextClass(val)}`}>{val}</span>
                        {diff !== null && (
                          <span
                            className={`text-[10px] ${
                              diff > 0
                                ? 'text-emerald-400'
                                : diff < 0
                                ? 'text-rose-400'
                                : 'text-slate-500'
                            }`}
                          >
                            ({diff > 0 ? `+${diff}` : diff === 0 ? '0' : diff})
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={`h-full ${ratingBarClass(val)}`}
                        style={{ width: `${Math.max(10, Math.min(100, val))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
