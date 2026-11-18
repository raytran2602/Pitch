import React, { useState } from 'react';
import { Award } from 'lucide-react';
import { Club, DetailedPosition, Language, MatchReport, PlayerMatchRating } from '../types/game';
import { t } from '../utils/i18n';
import { ClubBadge } from './ClubBadge';

interface MatchReportPanelProps {
  report: MatchReport;
  homeClub: Pick<Club, 'id' | 'name' | 'shortName' | 'primaryColor' | 'secondaryColor' | 'pattern'>;
  awayClub: Pick<Club, 'id' | 'name' | 'shortName' | 'primaryColor' | 'secondaryColor' | 'pattern'>;
  language: Language;
  liveMinute?: number;
  initialTab?: 'timeline' | 'stats' | 'ratings';
  actionSlot?: React.ReactNode;
}

type RatingSortKey = 'position' | 'rating';

const RATING_POS_ORDER: Record<DetailedPosition | string, number> = {
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

function sortSideRatings(list: PlayerMatchRating[], sortKey: RatingSortKey): PlayerMatchRating[] {
  const copy = [...list];
  copy.sort((a, b) => {
    if (sortKey === 'position') {
      const aSub = a.isSub ? 1 : 0;
      const bSub = b.isSub ? 1 : 0;
      if (aSub !== bSub) return aSub - bSub;
      if (!a.isSub && a.slotIndex !== undefined && b.slotIndex !== undefined) {
        return a.slotIndex - b.slotIndex;
      }
      const aPlayed = a.didNotPlay || a.rating === null ? 1 : 0;
      const bPlayed = b.didNotPlay || b.rating === null ? 1 : 0;
      if (aPlayed !== bPlayed) return aPlayed - bPlayed;
      const pa = RATING_POS_ORDER[a.detailedPosition ?? a.position] ?? 99;
      const pb = RATING_POS_ORDER[b.detailedPosition ?? b.position] ?? 99;
      return pa - pb || (b.rating ?? -1) - (a.rating ?? -1);
    }
    const aHas = a.rating !== null && !a.didNotPlay;
    const bHas = b.rating !== null && !b.didNotPlay;
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    if (aHas && bHas) {
      return (b.rating ?? 0) - (a.rating ?? 0);
    }
    const pa = RATING_POS_ORDER[a.detailedPosition ?? a.position] ?? 99;
    const pb = RATING_POS_ORDER[b.detailedPosition ?? b.position] ?? 99;
    return pa - pb;
  });
  return copy;
}

export const MatchReportPanel: React.FC<MatchReportPanelProps> = ({
  report,
  homeClub,
  awayClub,
  language,
  liveMinute = 90,
  initialTab = 'timeline',
  actionSlot,
}) => {
  const [reportTab, setReportTab] = useState<'timeline' | 'stats' | 'ratings'>(initialTab);
  const [ratingSort, setRatingSort] = useState<RatingSortKey>('position');
  const visibleEvents = report.events.filter((ev) => ev.minute <= liveMinute);

  const eventPillStyle = (type: string) => {
    if (type === 'GOAL') return 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/35';
    if (type === 'YELLOW') return 'bg-amber-400/20 text-amber-300 border border-amber-400/35';
    if (type === 'RED') return 'bg-rose-500/25 text-rose-300 border border-rose-400/40';
    return 'bg-white/10 text-slate-300 border border-white/15';
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-black/40 border border-white/10">
          {(['timeline', 'stats', 'ratings'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setReportTab(tab)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap ${
                reportTab === tab
                  ? 'bg-[#00FF85] text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {t(language, tab)}
            </button>
          ))}
        </div>

        {actionSlot}
      </div>

      {reportTab === 'timeline' && (
        <div className="rounded-xl border border-white/10 bg-black/30 p-3.5 space-y-3">
          {/* Two-Team Timeline Header */}
          <div className="grid grid-cols-[1fr_52px_1fr] items-center gap-2 pb-2.5 border-b border-white/10 text-xs">
            <div className="flex items-center justify-end gap-2 min-w-0">
              <span className="font-semibold text-white truncate">{homeClub.name}</span>
              <ClubBadge
                clubId={homeClub.id}
                name={homeClub.name}
                shortName={homeClub.shortName}
                primaryColor={homeClub.primaryColor}
                secondaryColor={homeClub.secondaryColor}
                pattern={homeClub.pattern}
                size={24}
              />
            </div>
            <div className="text-center text-[10px] font-mono uppercase tracking-wider text-slate-400">
              Min
            </div>
            <div className="flex items-center justify-start gap-2 min-w-0">
              <ClubBadge
                clubId={awayClub.id}
                name={awayClub.name}
                shortName={awayClub.shortName}
                primaryColor={awayClub.primaryColor}
                secondaryColor={awayClub.secondaryColor}
                pattern={awayClub.pattern}
                size={24}
              />
              <span className="font-semibold text-white truncate">{awayClub.name}</span>
            </div>
          </div>

          {/* Split Timeline Rows */}
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {visibleEvents.length === 0 ? (
              <div className="text-xs text-slate-400 py-6 text-center">
                {language === 'vi'
                  ? 'Chưa có diễn biến đáng chú ý nào.'
                  : 'No major match events recorded yet.'}
              </div>
            ) : (
              visibleEvents.map((ev) => {
                const isHome = ev.teamSide === 'HOME';
                return (
                  <div
                    key={ev.id}
                    className="grid grid-cols-[1fr_52px_1fr] items-center gap-2 text-xs"
                  >
                    {/* Home Side (Left) */}
                    <div className="min-w-0 flex justify-end">
                      {isHome ? (
                        <div className="w-full rounded-lg border border-emerald-400/20 bg-emerald-950/25 px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-semibold text-white truncate">
                              {ev.playerName}
                            </span>
                            <span
                              className={`font-semibold px-1.5 py-0.5 rounded text-[10px] shrink-0 ${eventPillStyle(ev.type)}`}
                            >
                              {ev.type}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-300 mt-0.5 truncate">
                            {ev.description}
                          </div>
                        </div>
                      ) : (
                        <div className="h-1 w-full border-t border-dashed border-white/6" />
                      )}
                    </div>

                    {/* Center Minute Axis */}
                    <div className="flex items-center justify-center">
                      <span className="inline-flex items-center justify-center w-11 py-1 rounded-md bg-white/8 border border-white/15 font-mono font-bold text-emerald-300 tabular-nums text-[11px]">
                        {ev.minute}&apos;
                      </span>
                    </div>

                    {/* Away Side (Right) */}
                    <div className="min-w-0 flex justify-start">
                      {!isHome ? (
                        <div className="w-full rounded-lg border border-sky-400/20 bg-sky-950/25 px-3 py-2 text-left">
                          <div className="flex items-center justify-start gap-2">
                            <span
                              className={`font-semibold px-1.5 py-0.5 rounded text-[10px] shrink-0 ${eventPillStyle(ev.type)}`}
                            >
                              {ev.type}
                            </span>
                            <span className="font-semibold text-white truncate">
                              {ev.playerName}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-300 mt-0.5 truncate">
                            {ev.description}
                          </div>
                        </div>
                      ) : (
                        <div className="h-1 w-full border-t border-dashed border-white/6" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {reportTab === 'stats' && (
        <div className="space-y-2.5">
          {[
            ['shots', report.stats.homeShots, report.stats.awayShots, ''],
            ['shotsOnTarget', report.stats.homeShotsOnTarget, report.stats.awayShotsOnTarget, ''],
            ['possession', report.stats.homePossession, report.stats.awayPossession, '%'],
            ['passes', report.stats.homePasses, report.stats.awayPasses, ''],
            ['passAccuracy', report.stats.homePassAccuracy, report.stats.awayPassAccuracy, '%'],
            ['fouls', report.stats.homeFouls, report.stats.awayFouls, '', true],
            ['yellowCards', report.stats.homeYellowCards, report.stats.awayYellowCards, '', true],
            ['redCards', report.stats.homeRedCards, report.stats.awayRedCards, '', true],
            ['offsides', report.stats.homeOffsides, report.stats.awayOffsides, '', true],
            ['corners', report.stats.homeCorners, report.stats.awayCorners, ''],
          ].map(([labelKey, hVal, aVal, suffix, lowerBetter]) => {
            const homeN = Number(hVal);
            const awayN = Number(aVal);
            const homeBetter = lowerBetter ? homeN < awayN : homeN > awayN;
            const awayBetter = lowerBetter ? awayN < homeN : awayN > homeN;
            return (
              <div
                key={String(labelKey)}
                className="grid grid-cols-3 items-center py-1.5 border-b border-white/6 text-xs"
              >
                <div className="text-left">
                  <span
                    className={`font-mono tabular-nums inline-block ${
                      homeBetter
                        ? 'bg-[#00FF85]/20 text-[#00FF85] rounded-full px-2.5 py-0.5 font-bold'
                        : 'text-slate-300 px-2.5 py-0.5'
                    }`}
                  >
                    {homeN}
                    {suffix}
                  </span>
                </div>
                <div className="text-center text-slate-300 font-medium">
                  {t(language, String(labelKey))}
                </div>
                <div className="text-right">
                  <span
                    className={`font-mono tabular-nums inline-block ${
                      awayBetter
                        ? 'bg-[#00FF85]/20 text-[#00FF85] rounded-full px-2.5 py-0.5 font-bold'
                        : 'text-slate-300 px-2.5 py-0.5'
                    }`}
                  >
                    {awayN}
                    {suffix}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {reportTab === 'ratings' && (
        <div className="space-y-3">
          {/* Interactive Rating Sort Bar (Default: Position Order) */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-slate-400">
              {t(language, 'sortBy')}:
            </span>
            <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-black/40 border border-white/10">
              {(
                [
                  ['position', 'sortPos'],
                  ['rating', 'sortRating'],
                ] as const
              ).map(([key, labelKey]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRatingSort(key)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                    ratingSort === key
                      ? 'bg-white text-slate-950 font-bold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {t(language, labelKey)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(['HOME', 'AWAY'] as const).map((side) => {
              const club = side === 'HOME' ? homeClub : awayClub;
              const sideRatings = sortSideRatings(
                report.ratings.filter((r) => r.teamSide === side),
                ratingSort
              );
              return (
                <div key={side} className="rounded-lg border border-white/10 bg-black/30 p-3.5">
                  <div className="text-xs font-bold text-white mb-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <ClubBadge
                        clubId={club.id}
                        name={club.name}
                        shortName={club.shortName}
                        primaryColor={club.primaryColor}
                        secondaryColor={club.secondaryColor}
                        pattern={club.pattern}
                        size={20}
                      />
                      <span className="truncate">{club.name}</span>
                    </div>
                    <span className="font-mono text-slate-400">Rating</span>
                  </div>
                  <div className="space-y-1.5">
                    {sideRatings.map((r) => {
                      const isUnusedSub = Boolean(r.didNotPlay || r.rating === null);
                      return (
                        <div
                          key={r.playerId}
                          className={`flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-xs ${
                            r.isMvp
                              ? 'bg-amber-400/20 border border-amber-400/50 text-amber-100'
                              : isUnusedSub
                              ? 'bg-white/[0.02] text-slate-500'
                              : 'bg-white/4 text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-[10px] text-slate-400 w-8 shrink-0">
                              {r.detailedPosition ?? r.position}
                            </span>
                            <span className="truncate font-medium">{r.playerName}</span>
                            {r.isSub && (
                              <span
                                className={`text-[9px] font-mono px-1 py-0.2 rounded shrink-0 ${
                                  isUnusedSub
                                    ? 'bg-white/6 text-slate-500'
                                    : 'bg-sky-500/20 text-sky-300 border border-sky-400/30'
                                }`}
                              >
                                {isUnusedSub ? 'SUB' : `SUB ${r.subMinute ? `${r.subMinute}'` : ''}`.trim()}
                              </span>
                            )}
                            {r.goals > 0 && (
                              <span className="text-[10px] font-mono text-emerald-300 shrink-0">
                                {r.goals}G
                              </span>
                            )}
                            {r.assists > 0 && (
                              <span className="text-[10px] font-mono text-sky-300 shrink-0">
                                {r.assists}A
                              </span>
                            )}
                            {r.isMvp && (
                              <span className="inline-flex items-center gap-1 rounded bg-amber-400 text-slate-950 px-1.5 py-0.5 text-[10px] font-extrabold shrink-0">
                                <Award className="w-3 h-3" />
                                MVP
                              </span>
                            )}
                          </div>
                          <span className="font-mono font-bold tabular-nums w-10 text-right shrink-0">
                            {!isUnusedSub && r.rating !== null ? r.rating.toFixed(1) : '-'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
