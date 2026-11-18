import React, { useEffect, useMemo, useState } from 'react';
import { ModalPortal } from './ModalPortal';
import {
  Clock,
  Eye,
  Lock,
  Shield,
  Sparkles,
  Star,
  Trophy,
  X,
} from 'lucide-react';
import { Club, Language, Player, ScoutStatus } from '../types/game';
import { formatCurrency, t } from '../utils/i18n';
import {
  getPlayerRoleFamiliarityMatrix,
  getPlayerRoleMastery,
  getRoleMasteryBadgeClasses,
  normalizePlayer,
} from '../utils/playerAttributes';
import { ClubBadge, PlayerAvatar } from './ClubBadge';
import { FifaAttributesGrid } from './FifaAttributesGrid';

interface PlayerProfileModalProps {
  player: Player;
  club: Club;
  language: Language;
  isScouted: boolean;
  compareTo?: Player | null;
  scoutStatus?: ScoutStatus;
  scoutDaysRemaining?: number;
  onStartScout?: () => void;
  canAffordBuyOption?: boolean;
  onExerciseBuyOption?: () => void;
  onClose: () => void;
}

function statTextColor(val: number): string {
  if (val >= 85) return 'text-[#00FF85]';
  if (val >= 75) return 'text-emerald-300';
  if (val >= 65) return 'text-amber-300';
  return 'text-slate-400';
}

function statBarColor(val: number): string {
  if (val >= 85) return 'bg-[#00FF85]';
  if (val >= 75) return 'bg-emerald-400';
  if (val >= 65) return 'bg-amber-400';
  return 'bg-slate-500';
}

export const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({
  player,
  club,
  language,
  isScouted,
  compareTo = null,
  scoutStatus = isScouted ? 'SCOUTED' : 'UNSCOUTED',
  scoutDaysRemaining = 0,
  onStartScout,
  canAffordBuyOption = false,
  onExerciseBuyOption,
  onClose,
}) => {
  const [tab, setTab] = useState<'overview' | 'attributes' | 'stats' | 'contract'>('overview');
  const normalized = useMemo(() => normalizePlayer(player), [player]);
  const normalizedCompare = useMemo(
    () => (compareTo && compareTo.id !== player.id ? normalizePlayer(compareTo) : null),
    [compareTo, player.id]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const renderDelta = (val: number, otherVal?: number) => {
    if (!isScouted || otherVal === undefined) return null;
    const diff = val - otherVal;
    if (diff === 0) return <span className="ml-1 text-[10px] font-mono text-slate-400">(=)</span>;
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

  const apps = normalized.appearances;
  const goals = normalized.goals;
  const assists = normalized.assists;
  const ga = goals + assists;
  const goalsPerMatch = apps > 0 ? (goals / apps).toFixed(2) : '0.00';
  const gaPerMatch = apps > 0 ? (ga / apps).toFixed(2) : '0.00';

  const primaryDetailed = normalized.detailedPosition ?? normalized.position;
  const allNaturalPositions = [
    primaryDetailed,
    ...(normalized.secondaryPositions ?? []),
  ].join(' · ');
  const roleMatrix = useMemo(() => getPlayerRoleFamiliarityMatrix(normalized), [normalized]);

  const renderScoutingBanner = () => (
    <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
      <div className="flex items-start gap-2.5 text-slate-200 max-w-xl">
        <Lock className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold text-white">
            {language === 'vi'
              ? 'Chưa hoàn tất báo cáo tuyển trạch'
              : 'Scouting Report Required'}
          </div>
          <p className="text-slate-300 mt-0.5">
            {scoutStatus === 'SCOUTING'
              ? language === 'vi'
                ? `Đang tuyển trạch (còn ${scoutDaysRemaining} ngày). Tiến hành qua ngày để hoàn tất báo cáo và mở khoá toàn bộ chỉ số.`
                : `Scouting in progress (${scoutDaysRemaining} day(s) remaining). Advance days to unlock full ratings and contract terms.`
              : language === 'vi'
              ? 'Chỉ số chi tiết, OVR chính xác và giá trị hợp đồng sẽ hiển thị sau khi đội ngũ tuyển trạch hoàn tất báo cáo.'
              : 'Exact OVR, detailed FIFA/FC attributes, and contract figures unlock once your scouts complete a report.'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {scoutStatus === 'UNSCOUTED' && onStartScout && (
          <button
            type="button"
            onClick={onStartScout}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#00FF85] hover:bg-emerald-300 text-slate-950 font-bold px-3.5 py-2 cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            {t(language, 'scoutPlayer')}
          </button>
        )}
        {scoutStatus === 'SCOUTING' && (
          <span className="inline-flex items-center gap-1 text-amber-300 font-mono font-semibold px-2">
            <Clock className="w-3.5 h-3.5" />
            {scoutDaysRemaining}d left
          </span>
        )}
      </div>
    </div>
  );

  return (
    <ModalPortal>
    <div
      className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${normalized.name} Profile`}
    >
      <div className="animate-modal-pop w-full max-w-4xl rounded-2xl pitch-modal-shell text-slate-100 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-white/10 bg-black/35 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <PlayerAvatar
              playerId={normalized.id}
              name={normalized.name}
              shirtNumber={normalized.shirtNumber}
              position={normalized.position}
              primaryColor={club.primaryColor}
              secondaryColor={club.secondaryColor}
              size={78}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <ClubBadge
                  clubId={club.id}
                  name={club.name}
                  shortName={club.shortName}
                  primaryColor={club.primaryColor}
                  secondaryColor={club.secondaryColor}
                  pattern={club.pattern}
                  size={20}
                />
                <span className="text-xs font-semibold text-slate-300 truncate">{club.name}</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-white truncate">
                {normalized.name}
              </h2>
              <div className="text-xs text-slate-300 flex flex-wrap items-center gap-2 mt-0.5">
                <span className="font-semibold text-[#00FF85]">{allNaturalPositions}</span>
                <span>·</span>
                {(() => {
                  const m = getPlayerRoleMastery(normalized, normalized.role);
                  const style = getRoleMasteryBadgeClasses(m);
                  return (
                    <span className={`rounded border px-2 py-0.5 font-mono text-[11px] font-bold ${style.badge}`}>
                      {normalized.role} · {m}
                    </span>
                  );
                })()}
                {normalized.loanInfo && (
                  <span
                    className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold ${
                      normalized.loanInfo.direction === 'IN'
                        ? 'border-sky-400/45 bg-sky-500/15 text-sky-200'
                        : 'border-amber-400/45 bg-amber-500/15 text-amber-200'
                    }`}
                  >
                    {normalized.loanInfo.direction === 'IN' ? 'LOAN IN' : 'LOAN OUT'} · {normalized.loanInfo.counterpartyClubName}
                  </span>
                )}
                <span>·</span>
                <span>{normalized.nationality}</span>
                <span>·</span>
                <span>Age {normalized.age}</span>
                <span>·</span>
                <span>{normalized.heightCm} cm</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="text-right">
              <div className="font-display text-4xl font-extrabold text-[#00FF85] tabular-nums leading-none">
                {isScouted ? normalized.ovr : '??'}
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-1">
                POT {isScouted ? normalized.potential : '??'} · #{normalized.shirtNumber}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close player profile"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 4 Tabs: Overview, Attributes, Stats, Contract */}
        <div className="px-6 pt-4 pb-2 border-b border-white/10 bg-black/20">
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-black/45 border border-white/10 w-fit">
            {(['overview', 'attributes', 'stats', 'contract'] as const).map((tabKey) => {
              const i18nKey =
                tabKey === 'overview'
                  ? 'overviewTab'
                  : tabKey === 'attributes'
                  ? 'attributesTab'
                  : tabKey === 'stats'
                  ? 'statsTab'
                  : 'contractTab';
              return (
                <button
                  key={tabKey}
                  type="button"
                  onClick={() => setTab(tabKey)}
                  className={`px-4 py-1.5 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap ${
                    tab === tabKey
                      ? 'bg-white text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {t(language, i18nKey)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {!isScouted && tab !== 'stats' && renderScoutingBanner()}

          {tab === 'overview' && (
            <div className="space-y-5">
              {/* General Face Stats */}
              <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                    {language === 'vi' ? 'Chỉ số chung' : 'General Face Stats'}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    OVR {isScouted ? normalized.ovr : '??'} / POT {isScouted ? normalized.potential : '??'}
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
                  {[
                    ['PAC', normalized.attributes.pace, normalizedCompare?.attributes.pace],
                    ['SHO', normalized.attributes.finishing, normalizedCompare?.attributes.finishing],
                    ['PAS', normalized.attributes.passing, normalizedCompare?.attributes.passing],
                    ['DRI', normalized.attributes.dribbling, normalizedCompare?.attributes.dribbling],
                    ['DEF', normalized.attributes.defending, normalizedCompare?.attributes.defending],
                    ['PHY', normalized.attributes.physical, normalizedCompare?.attributes.physical],
                    ['GK', normalized.attributes.goalkeeper, normalizedCompare?.attributes.goalkeeper],
                  ].map(([label, val, cmpVal]) => {
                    const num = Number(val);
                    const cmp = typeof cmpVal === 'number' ? cmpVal : undefined;
                    return (
                      <div
                        key={String(label)}
                        className="rounded-lg border border-white/10 bg-white/4 px-2.5 py-2 text-center"
                      >
                        <div className="text-[10px] font-mono text-slate-400">{label}</div>
                        <div
                          className={`font-mono text-lg font-extrabold tabular-nums ${
                            isScouted ? statTextColor(num) : 'text-slate-500'
                          }`}
                        >
                          {isScouted ? num : '??'}
                        </div>
                        {cmp !== undefined && isScouted && (
                          <div className="text-[10px] font-mono">{renderDelta(num, cmp)}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Player Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                  <div className="text-slate-400">{t(language, 'naturalPositions')}</div>
                  <div className="font-semibold text-[#00FF85] mt-1 font-mono">{allNaturalPositions}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                  <div className="text-slate-400">{language === 'vi' ? 'Vai trò chiến thuật' : 'Primary Role'}</div>
                  <div className="font-semibold text-white mt-1">
                    {normalized.role} · {getPlayerRoleMastery(normalized, normalized.role)}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                  <div className="text-slate-400">{t(language, 'squadStatus')}</div>
                  <div className="font-semibold text-white mt-1">
                    {isScouted ? normalized.squadStatus : 'Hidden'}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                  <div className="text-slate-400">{language === 'vi' ? 'Chân thuận / Không thuận' : 'Foot / Weak Foot'}</div>
                  <div className="font-semibold text-white mt-1 flex items-center gap-1.5">
                    <span>{normalized.preferredFoot}</span>
                    <span className="text-slate-500">·</span>
                    <span className="inline-flex items-center gap-0.5 text-amber-300 font-mono">
                      {normalized.weakFoot ?? 3}
                      <Star className="w-3 h-3 fill-amber-300" />
                    </span>
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                  <div className="text-slate-400">{language === 'vi' ? 'Kỹ thuật & Work Rate' : 'Skill Moves / Work Rate'}</div>
                  <div className="font-semibold text-white mt-1 flex items-center gap-1.5">
                    <span className="text-amber-300 font-mono">{normalized.skillMoves}*</span>
                    <span className="text-slate-500">·</span>
                    <span>{normalized.attackingWorkRate ?? 'Medium'} / {normalized.defensiveWorkRate ?? 'Medium'}</span>
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                  <div className="text-slate-400">{language === 'vi' ? 'Thể lực & Tình trạng' : 'Fitness & Status'}</div>
                  <div className="mt-1 flex items-center justify-between font-mono font-bold text-emerald-300 tabular-nums">
                    <span>{normalized.fitness}%</span>
                    {(normalized.injuredMatches ?? 0) > 0 && (
                      <span className="text-rose-300">{t(language, 'injured')} ({normalized.injuredMatches})</span>
                    )}
                    {normalized.suspendedMatches > 0 && (
                      <span className="text-rose-300">{t(language, 'suspended')} ({normalized.suspendedMatches})</span>
                    )}
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full ${statBarColor(normalized.fitness)}`}
                      style={{ width: `${Math.max(4, Math.min(100, normalized.fitness))}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Full Role Familiarity Matrix Across Positions */}
              <div className="rounded-lg border border-white/10 bg-black/30 p-3.5 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                    {t(language, 'roleFamiliarityMatrix')}
                  </span>
                  <div className="flex items-center gap-2 text-[10px] font-mono">
                    <span className="rounded border border-[#00FF85]/55 bg-[#00FF85]/14 text-[#00FF85] px-1.5 py-0.5 font-bold">
                      Role++
                    </span>
                    <span className="rounded border border-amber-400/55 bg-amber-500/14 text-amber-300 px-1.5 py-0.5 font-bold">
                      Role+
                    </span>
                    <span className="rounded border border-white/20 bg-white/8 text-slate-300 px-1.5 py-0.5 font-bold">
                      Base
                    </span>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {roleMatrix.map((sec) => (
                    <div
                      key={sec.group}
                      className={`rounded-lg border p-2.5 ${
                        sec.isNaturalOrSecondary
                          ? 'border-emerald-400/25 bg-emerald-500/[0.04]'
                          : 'border-white/8 bg-white/[0.02]'
                      }`}
                    >
                      <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-2">
                        <span>{sec.label}</span>
                        {sec.isNaturalOrSecondary && (
                          <span className="text-[9px] text-[#00FF85] font-semibold">
                            · {language === 'vi' ? 'Vị trí phù hợp' : 'Natural / Secondary'}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                        {sec.roles.map((r) => {
                          const style = getRoleMasteryBadgeClasses(r.mastery);
                          return (
                            <div
                              key={`${sec.group}_${r.role}`}
                              className="rounded-md border border-white/10 bg-black/35 px-2 py-1.5 flex items-center justify-between gap-1.5"
                            >
                              <span className="text-[11px] text-slate-200 truncate">
                                {r.role}
                              </span>
                              <span
                                className={`rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold shrink-0 ${style.badge}`}
                              >
                                {r.mastery}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* PlayStyles & Financial Snapshot */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border border-white/10 bg-black/30 p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-slate-400">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                    <span>PlayStyles</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(normalized.playStyles && normalized.playStyles.length > 0
                      ? normalized.playStyles
                      : ['First Touch']
                    ).map((ps) => (
                      <span
                        key={ps}
                        className="px-2 py-1 rounded border border-emerald-400/30 bg-emerald-500/10 text-emerald-200 text-[11px] font-semibold"
                      >
                        {ps}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-black/30 p-3.5 space-y-2">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                    {language === 'vi' ? 'Giá trị & Hợp đồng' : 'Valuation Snapshot'}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <div className="text-[11px] text-slate-400">{t(language, 'marketValue')}</div>
                      <div className="font-mono font-bold text-white tabular-nums mt-0.5">
                        {isScouted ? formatCurrency(normalized.marketValue) : 'Hidden'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400">{t(language, 'weeklyWage')}</div>
                      <div className="font-mono font-bold text-white tabular-nums mt-0.5">
                        {isScouted ? formatCurrency(normalized.weeklyWage) : 'Hidden'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400">{t(language, 'contractExpiry')}</div>
                      <div className="font-mono font-bold text-white tabular-nums mt-0.5">
                        {isScouted ? normalized.contractExpiry : 'Hidden'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'attributes' && (
            <div>
              {isScouted ? (
                <FifaAttributesGrid player={normalized} compareTo={normalizedCompare} />
              ) : (
                <div className="rounded-xl border border-white/10 bg-black/30 p-8 text-center text-xs text-slate-300 space-y-2">
                  <Lock className="w-6 h-6 text-amber-300 mx-auto" />
                  <p className="font-semibold text-white">
                    {language === 'vi'
                      ? '29+ chỉ số chi tiết FIFA/FC đang bị ẩn'
                      : 'Detailed FIFA/FC Sub-Attributes Locked'}
                  </p>
                  <p className="text-slate-400">
                    {language === 'vi'
                      ? 'Hãy bắt đầu tuyển trạch ở phía trên và qua ngày để mở khoá toàn bộ chỉ số chi tiết Pace, Shooting, Passing, Dribbling, Defending, Physical & Goalkeeping.'
                      : 'Start scouting above and advance days to reveal full Pace, Shooting, Passing, Dribbling, Defending, Physical & Goalkeeping breakdowns.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {tab === 'stats' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="rounded-lg border border-white/10 bg-black/30 p-3.5">
                  <div className="text-slate-400">{language === 'vi' ? 'Số trận đã đá' : 'Appearances'}</div>
                  <div className="font-mono text-2xl font-extrabold text-white tabular-nums mt-1">
                    {apps}
                    {renderDelta(apps, normalizedCompare?.appearances)}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/30 p-3.5">
                  <div className="text-slate-400">{language === 'vi' ? 'Bàn thắng' : 'Goals'}</div>
                  <div className="font-mono text-2xl font-extrabold text-[#00FF85] tabular-nums mt-1">
                    {goals}
                    {renderDelta(goals, normalizedCompare?.goals)}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/30 p-3.5">
                  <div className="text-slate-400">{language === 'vi' ? 'Kiến tạo' : 'Assists'}</div>
                  <div className="font-mono text-2xl font-extrabold text-sky-300 tabular-nums mt-1">
                    {assists}
                    {renderDelta(assists, normalizedCompare?.assists)}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/30 p-3.5">
                  <div className="text-slate-400">{language === 'vi' ? 'Đóng góp bàn thắng (G+A)' : 'Goal Contributions (G+A)'}</div>
                  <div className="font-mono text-xl font-bold text-white tabular-nums mt-1">
                    {ga}
                    {renderDelta(ga, normalizedCompare ? normalizedCompare.goals + normalizedCompare.assists : undefined)}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/30 p-3.5">
                  <div className="text-slate-400">{language === 'vi' ? 'Hiệu suất / Trận' : 'Goals / G+A Per Match'}</div>
                  <div className="font-mono text-xl font-bold text-emerald-300 tabular-nums mt-1">
                    {goalsPerMatch} <span className="text-xs text-slate-400">/ {gaPerMatch}</span>
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/30 p-3.5">
                  <div className="text-slate-400">{language === 'vi' ? 'Giữ sạch lưới' : 'Clean Sheets'}</div>
                  <div className="font-mono text-xl font-bold text-white tabular-nums mt-1">
                    {normalized.cleanSheets}
                    {renderDelta(normalized.cleanSheets, normalizedCompare?.cleanSheets)}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-slate-400">
                    <Shield className="w-3.5 h-3.5 text-amber-300" />
                    <span>{language === 'vi' ? 'Kỷ luật & Tình trạng' : 'Discipline & Availability'}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-300">
                    <Trophy className="w-3 h-3 text-emerald-300" />
                    2026/27 Season
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg border border-white/8 bg-white/4 p-2.5">
                    <div className="text-slate-400">{t(language, 'yellowCards')}</div>
                    <div className="font-mono text-lg font-bold text-amber-300 tabular-nums mt-0.5">
                      {normalized.yellowCards}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/8 bg-white/4 p-2.5">
                    <div className="text-slate-400">{t(language, 'redCards')}</div>
                    <div className="font-mono text-lg font-bold text-rose-400 tabular-nums mt-0.5">
                      {normalized.redCards}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/8 bg-white/4 p-2.5">
                    <div className="text-slate-400">{language === 'vi' ? 'Án treo giò / Chấn thương' : 'Suspended / Injured'}</div>
                    <div className="font-mono text-lg font-bold text-white tabular-nums mt-0.5">
                      {normalized.suspendedMatches} / {normalized.injuredMatches ?? 0}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/8 bg-white/4 p-2.5">
                    <div className="text-slate-400">{language === 'vi' ? 'Thể lực' : 'Fitness'}</div>
                    <div className="font-mono text-lg font-bold text-emerald-300 tabular-nums mt-0.5">
                      {normalized.fitness}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'contract' && (
            <div className="space-y-4">
              {normalized.loanInfo && (
                <div className="rounded-xl border border-sky-400/35 bg-sky-500/10 p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="font-mono font-bold text-sky-200 uppercase">
                      {normalized.loanInfo.direction === 'IN' ? t(language, 'loanInBadge') : t(language, 'loanOutBadge')} · {normalized.loanInfo.counterpartyClubName}
                    </div>
                    <div className="text-slate-200 font-mono">
                      {t(language, 'wageSplit')}: {normalized.loanInfo.wageSharePct}% ·{' '}
                      {normalized.loanInfo.durationSeasons === 0.5
                        ? t(language, 'halfSeasonLoan')
                        : normalized.loanInfo.durationSeasons === 2
                        ? t(language, 'twoSeasons')
                        : t(language, 'oneSeason')}{' '}
                      (Return {normalized.loanInfo.returnSeasonYear})
                      {(normalized.loanInfo.buyOptionFee ?? 0) > 0 &&
                        ` · ${t(language, 'buyClause')}: ${formatCurrency(normalized.loanInfo.buyOptionFee!)}`}
                    </div>
                  </div>
                  {normalized.loanInfo.direction === 'IN' &&
                    (normalized.loanInfo.buyOptionFee ?? 0) > 0 &&
                    onExerciseBuyOption && (
                      <button
                        type="button"
                        disabled={!canAffordBuyOption}
                        onClick={() => {
                          onExerciseBuyOption();
                          onClose();
                        }}
                        className="rounded-lg bg-[#00FF85] hover:bg-emerald-300 disabled:opacity-45 disabled:cursor-not-allowed text-slate-950 font-bold text-xs px-4 py-2 cursor-pointer whitespace-nowrap"
                      >
                        {t(language, 'buyClause')} ({formatCurrency(normalized.loanInfo.buyOptionFee ?? 0)})
                      </button>
                    )}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="rounded-lg border border-white/10 bg-black/30 p-3.5">
                  <div className="text-slate-400">{t(language, 'marketValue')}</div>
                  <div className="font-mono font-bold text-white text-sm mt-1 tabular-nums">
                    {isScouted ? formatCurrency(normalized.marketValue) : 'Hidden'}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/30 p-3.5">
                  <div className="text-slate-400">{t(language, 'weeklyWage')}</div>
                  <div className="font-mono font-bold text-white text-sm mt-1 tabular-nums">
                    {isScouted ? `${formatCurrency(normalized.weeklyWage)}/wk` : 'Hidden'}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/30 p-3.5">
                  <div className="text-slate-400">{t(language, 'contractExpiry')}</div>
                  <div className="font-mono font-bold text-white text-sm mt-1 tabular-nums">
                    {isScouted ? `June ${normalized.contractExpiry}` : 'Hidden'}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/30 p-3.5">
                  <div className="text-slate-400">{t(language, 'squadStatus')}</div>
                  <div className="font-semibold text-white text-sm mt-1">
                    {isScouted ? normalized.squadStatus : 'Hidden'}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/30 p-3.5">
                  <div className="text-slate-400">{t(language, 'shirtNumber')}</div>
                  <div className="font-mono font-bold text-white text-sm mt-1 tabular-nums">
                    #{normalized.shirtNumber}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/30 p-3.5">
                  <div className="text-slate-400">{t(language, 'releaseClause')}</div>
                  <div className="font-mono font-bold text-white text-sm mt-1 tabular-nums">
                    {isScouted ? formatCurrency(normalized.releaseClause) : 'Hidden'}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/30 p-3.5">
                  <div className="text-slate-400">{t(language, 'goalBonuses')}</div>
                  <div className="font-mono font-bold text-white text-sm mt-1 tabular-nums">
                    {isScouted ? formatCurrency(normalized.goalBonus) : 'Hidden'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};
