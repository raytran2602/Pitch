import React, { useMemo, useState } from 'react';
import { ModalPortal } from './ModalPortal';
import {
  AlertTriangle,
  Briefcase,
  Building2,
  CheckCircle2,
  Search,
  Target,
  Trophy,
  X,
  XCircle,
} from 'lucide-react';
import { ALL_DOMESTIC_LEAGUE_IDS, COUNTRY_BY_ID, COUNTRY_CATALOG, isDomesticLeagueId, LEAGUE_CATALOG } from '../data/competitions';
import { COMPETITION_THEMES } from '../data/premierLeague2627';
import {
  buildDefaultManagerContract,
  buildInitialClubManagers,
  evaluateManagerJobApplication,
  evaluateSeasonObjectives,
  getLeagueTeamsFromState,
} from '../engine/gameLogic';
import {
  AiManagerStatus,
  CareerState,
  Club,
  ClubManagerInfo,
  CountryId,
  DomesticLeagueId,
  Language,
  ObjectivePriority,
  SeasonObjective,
} from '../types/game';
import { formatCurrency, t } from '../utils/i18n';
import { useIsMobileLandscape } from '../utils/useMobileLandscape';
import { ClubBadge } from './ClubBadge';
import { FormattedNumberInput } from './FormattedNumberInput';

interface JobMarketViewProps {
  state: CareerState;
  userClub: Club;
  language: Language;
  initialTab?: 'objectives' | 'jobs';
  onRenewContract: (requestedWage: number, extendYears: number) => { ok: boolean; message: string };
  onApplyAndSwitchClub: (targetClubId: string, agreedWage: number, contractYears: number) => void;
}

type JobFilterMode = 'open' | 'vacant' | 'expiring' | 'all';
type TierFilter = 'ALL' | DomesticLeagueId;

interface ClubJobRow {
  clubId: string;
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  pattern: Club['pattern'];
  leagueId: DomesticLeagueId;
  countryId: CountryId;
  rank: number;
  ovr: number;
  budget: number;
  managerInfo: ClubManagerInfo;
}

const STATUS_PRIORITY: Record<AiManagerStatus, number> = {
  VACANT: 0,
  UNDER_PRESSURE: 1,
  EXPIRING: 2,
  SECURE: 3,
};

export const JobMarketView: React.FC<JobMarketViewProps> = ({
  state,
  userClub,
  language,
  initialTab,
  onRenewContract,
  onApplyAndSwitchClub,
}) => {
  const isMobileLandscape = useIsMobileLandscape();
  const userLeagueId = state.userLeagueId ?? 'PL';
  const seasonStartYear = 2026 + (state.seasonIndex ?? 0);
  const currentDateIso = state.calendar[state.currentDayIndex]?.dateIso ?? `${seasonStartYear}-07-01`;
  const coachFullName =
    `${state.coach.firstName} ${state.coach.lastName}`.trim() || state.coach.nickname;

  const contract = useMemo(
    () =>
      state.managerContract ??
      buildDefaultManagerContract(userLeagueId, currentDateIso, seasonStartYear, userClub),
    [state.managerContract, userLeagueId, currentDateIso, seasonStartYear, userClub]
  );

  const [activeOfficeTab, setActiveOfficeTab] = useState<'objectives' | 'jobs'>(() =>
    contract.status === 'SACKED' ? 'jobs' : initialTab ?? 'objectives'
  );
  const objectives = useMemo(() => evaluateSeasonObjectives(state), [state]);

  // Contract renewal state
  const [showRenewForm, setShowRenewForm] = useState(false);
  const [renewYears, setRenewYears] = useState<number>(2);
  const [renewWage, setRenewWage] = useState<number>(Math.round(contract.weeklyWage * 1.1));
  const [renewFeedback, setRenewFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  // Job Market list state
  const [filterMode, setFilterMode] = useState<JobFilterMode>('open');
  const [countryFilter, setCountryFilter] = useState<'ALL' | CountryId>('ALL');
  const [tierFilter, setTierFilter] = useState<TierFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Application negotiation modal state
  const [applyingRow, setApplyingRow] = useState<ClubJobRow | null>(null);
  const [desiredWage, setDesiredWage] = useState<number>(40_000);
  const [desiredYears, setDesiredYears] = useState<number>(2);
  const [applyOutcome, setApplyOutcome] = useState<{
    accepted: boolean;
    message: string;
    maxWageOffer: number;
  } | null>(null);

  const leagueTeams = useMemo(() => getLeagueTeamsFromState(state), [state]);
  const managersMap = useMemo(
    () =>
      state.clubManagers ??
      buildInitialClubManagers(
        state.clubs,
        leagueTeams,
        state.clubId,
        coachFullName,
        seasonStartYear
      ),
    [state.clubManagers, state.clubs, leagueTeams, state.clubId, coachFullName, seasonStartYear]
  );

  const jobRows = useMemo<ClubJobRow[]>(() => {
    const clubById = new Map(state.clubs.map((c) => [c.id, c]));
    const rankByTierClub = new Map<string, number>();
    ALL_DOMESTIC_LEAGUE_IDS.forEach((tier) => {
      const table = state.contextStandings[tier] ?? [];
      table.forEach((row, idx) => {
        rankByTierClub.set(row.clubId, idx + 1);
      });
    });

    const rows: ClubJobRow[] = [];
    ALL_DOMESTIC_LEAGUE_IDS.forEach((tier) => {
      const divMeta = LEAGUE_CATALOG[tier];
      for (const team of leagueTeams[tier] ?? []) {
        if (team.id === state.clubId) continue;
        const fullClub = clubById.get(team.id);
        const mgr = managersMap[team.id] ?? {
          clubId: team.id,
          managerName: team.managerName ?? 'Head Coach',
          satisfaction: 62,
          contractEndSeasonYear: seasonStartYear + 2,
          status: 'SECURE' as const,
          weeklyBudgetOffer: Math.max(4_000, team.ovr * 900),
        };
        const approxBudget =
          fullClub?.balance ??
          (divMeta.tier === 1
            ? team.ovr * 700_000
            : divMeta.tier === 2
            ? team.ovr * 160_000
            : divMeta.tier === 3
            ? team.ovr * 65_000
            : team.ovr * 32_000);

        rows.push({
          clubId: team.id,
          name: team.name,
          shortName: team.shortName,
          primaryColor: team.primaryColor,
          secondaryColor: team.secondaryColor,
          pattern: fullClub?.pattern ?? 'solid',
          leagueId: tier,
          countryId: divMeta.countryId,
          rank: rankByTierClub.get(team.id) ?? 10,
          ovr: team.ovr,
          budget: approxBudget,
          managerInfo: mgr,
        });
      }
    });

    rows.sort(
      (a, b) =>
        STATUS_PRIORITY[a.managerInfo.status] - STATUS_PRIORITY[b.managerInfo.status] ||
        b.ovr - a.ovr ||
        a.name.localeCompare(b.name)
    );
    return rows;
  }, [state.clubs, state.contextStandings, state.clubId, leagueTeams, managersMap, seasonStartYear]);

  const counts = useMemo(() => {
    let open = 0;
    let vacant = 0;
    let expiring = 0;
    for (const r of jobRows) {
      if (r.managerInfo.status === 'VACANT') {
        vacant++;
        open++;
      } else if (r.managerInfo.status === 'UNDER_PRESSURE') {
        open++;
      } else if (r.managerInfo.status === 'EXPIRING') {
        expiring++;
        open++;
      }
    }
    return { open, vacant, expiring, all: jobRows.length };
  }, [jobRows]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return jobRows.filter((row) => {
      if (countryFilter !== 'ALL' && row.countryId !== countryFilter) return false;
      if (tierFilter !== 'ALL' && row.leagueId !== tierFilter) return false;
      if (filterMode === 'vacant' && row.managerInfo.status !== 'VACANT') return false;
      if (filterMode === 'expiring' && row.managerInfo.status !== 'EXPIRING') return false;
      if (filterMode === 'open' && row.managerInfo.status === 'SECURE') return false;
      if (
        q &&
        !row.name.toLowerCase().includes(q) &&
        !row.managerInfo.managerName.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [jobRows, countryFilter, tierFilter, filterMode, searchQuery]);

  const getContractStatusText = () => {
    if (contract.status === 'SACKED') return t(language, 'sackedContract');
    if (contract.status === 'EXPIRING') return t(language, 'expiringContract');
    return t(language, 'activeContract');
  };

  const getAiStatusMeta = (status: AiManagerStatus): { label: string; colorClass: string } => {
    if (status === 'VACANT') {
      return { label: t(language, 'vacantStatus'), colorClass: 'text-[#00FF85] font-bold' };
    }
    if (status === 'UNDER_PRESSURE') {
      return { label: t(language, 'underPressureStatus'), colorClass: 'text-rose-400 font-semibold' };
    }
    if (status === 'EXPIRING') {
      return { label: t(language, 'expiringStatus'), colorClass: 'text-amber-300 font-semibold' };
    }
    return { label: t(language, 'secureStatus'), colorClass: 'text-slate-400' };
  };

  const handleOpenApply = (row: ClubJobRow) => {
    setApplyingRow(row);
    setDesiredWage(row.managerInfo.weeklyBudgetOffer);
    setDesiredYears(2);
    setApplyOutcome(null);
  };

  const handleSubmitApplication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyingRow) return;
    const res = evaluateManagerJobApplication(state, applyingRow.clubId, desiredWage, desiredYears);
    setApplyOutcome(res);
  };

  const isSacked = contract.status === 'SACKED';
  const probationLeft = contract.probationMatchesRemaining;
  const completedCount = objectives.filter((o) => o.status === 'COMPLETED').length;

  const getPriorityBadge = (priority: ObjectivePriority) => {
    if (priority === 'CRITICAL') {
      return {
        label: t(language, 'priorityCritical'),
        cls: 'border-amber-400/50 bg-amber-500/15 text-amber-200',
      };
    }
    if (priority === 'HIGH') {
      return {
        label: t(language, 'priorityHigh'),
        cls: 'border-sky-400/45 bg-sky-500/15 text-sky-200',
      };
    }
    return {
      label: t(language, 'priorityMedium'),
      cls: 'border-white/20 bg-white/8 text-slate-300',
    };
  };

  const getObjectiveMeta = (obj: SeasonObjective) => {
    if (obj.status === 'COMPLETED') {
      return {
        label: t(language, 'objCompleted'),
        cls: 'border-[#00FF85]/50 bg-[#00FF85]/18 text-[#00FF85]',
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-[#00FF85]" />,
        barCls: 'bg-[#00FF85]',
        barPct: 100,
      };
    }
    if (obj.status === 'FAILED') {
      return {
        label: t(language, 'objFailed'),
        cls: 'border-rose-500/50 bg-rose-500/18 text-rose-300',
        icon: <XCircle className="w-3.5 h-3.5 text-rose-400" />,
        barCls: 'bg-rose-500',
        barPct: 100,
      };
    }
    if (obj.onTrack !== false) {
      return {
        label: t(language, 'objOnTrack'),
        cls: 'border-sky-400/45 bg-sky-500/15 text-sky-200',
        icon: <Target className="w-3.5 h-3.5 text-sky-300" />,
        barCls: 'bg-sky-400',
        barPct: obj.targetLeagueRank ? 68 : 55,
      };
    }
    return {
      label: t(language, 'objBelowTarget'),
      cls: 'border-amber-400/45 bg-amber-500/15 text-amber-200',
      icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />,
      barCls: 'bg-amber-400',
      barPct: 32,
    };
  };

  return (
    <div className={isMobileLandscape ? 'h-full min-h-0 flex flex-col gap-2 overflow-hidden' : 'space-y-6'}>
      {/* Office Header & Tab Switcher (Objectives | Job Market) */}
      <section
        className={`shrink-0 pitch-panel rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between ${
          isMobileLandscape ? 'p-2.5 gap-2' : 'p-5 gap-4'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`rounded-lg border border-white/15 bg-black/50 flex items-center justify-center shrink-0 ${
              isMobileLandscape ? 'w-9 h-9' : 'w-11 h-11'
            }`}
          >
            <Building2 className={`${isMobileLandscape ? 'w-4 h-4' : 'w-5 h-5'} text-[#00FF85]`} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
              <span>{t(language, 'officeTitle')}</span>
              <span aria-hidden="true">·</span>
              <span>{state.seasonLabel ?? `${seasonStartYear}/${String((seasonStartYear + 1) % 100).padStart(2, '0')}`}</span>
            </div>
            <h1
              className={`font-display font-bold text-white truncate ${
                isMobileLandscape ? 'text-lg' : 'text-2xl sm:text-3xl'
              }`}
            >
              {userClub.name} — {coachFullName}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-lg border border-white/12 bg-black/45 px-3.5 py-2 text-xs flex items-center gap-2">
            <span className="text-slate-400">{t(language, 'boardSatisfaction')}:</span>
            <span
              className={`font-mono font-extrabold tabular-nums ${
                state.boardSatisfaction < 30
                  ? 'text-rose-400'
                  : state.boardSatisfaction < 50
                  ? 'text-amber-300'
                  : 'text-[#00FF85]'
              }`}
            >
              {state.boardSatisfaction}%
            </span>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-black/55 border border-white/15">
            <button
              type="button"
              onClick={() => setActiveOfficeTab('objectives')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap ${
                activeOfficeTab === 'objectives'
                  ? 'bg-[#00FF85] text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>
                {t(language, 'objectivesTab')} ({completedCount}/{objectives.length})
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveOfficeTab('jobs')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap ${
                activeOfficeTab === 'jobs'
                  ? 'bg-[#00FF85] text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>{t(language, 'jobMarketTab')}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Office Tab 1: Season Objectives */}
      {activeOfficeTab === 'objectives' && (
        <div
          className={
            isMobileLandscape
              ? 'flex-1 min-h-0 overflow-y-auto grid grid-cols-12 gap-2 content-start'
              : 'space-y-5'
          }
        >
          {isSacked && (
            <div
              role="alert"
              className={`${
                isMobileLandscape ? 'col-span-12 px-4 py-3' : 'px-5 py-4'
              } rounded-xl border border-rose-500/55 bg-rose-950/65 flex flex-wrap items-center justify-between gap-3 text-xs text-rose-100`}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-white">{t(language, 'sackedTitle')}</div>
                  <p className="text-rose-200 mt-0.5">{t(language, 'sackedDesc')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveOfficeTab('jobs')}
                className="rounded-lg bg-[#00FF85] hover:bg-emerald-300 text-slate-950 font-bold text-xs px-3.5 py-2 cursor-pointer whitespace-nowrap"
              >
                {t(language, 'jobMarketTab')}
              </button>
            </div>
          )}

          {/* Board Expectations Overview */}
          <section
            className={
              isMobileLandscape
                ? 'col-span-4 rounded-xl border border-white/12 bg-black/35 p-3.5 space-y-3'
                : 'rounded-xl border border-white/12 bg-black/35 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4'
            }
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <ClubBadge
                clubId={userClub.id}
                name={userClub.name}
                shortName={userClub.shortName}
                primaryColor={userClub.primaryColor}
                secondaryColor={userClub.secondaryColor}
                pattern={userClub.pattern}
                size={isMobileLandscape ? 40 : 52}
              />
              <div className="min-w-0">
                <h2
                  className={`font-display font-bold text-white ${
                    isMobileLandscape ? 'text-lg truncate' : 'text-xl sm:text-2xl'
                  }`}
                >
                  {t(language, 'objectivesTab')} · {COMPETITION_THEMES[userLeagueId].name}
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  {language === 'vi'
                    ? 'Hoàn thành hoặc bỏ lỡ các mục tiêu giải đấu và cúp sẽ tác động trực tiếp đến Sự hài lòng của Ban lãnh đạo.'
                    : 'League standing pace and Cup milestone completions directly impact your Board Satisfaction rating.'}
                </p>
              </div>
            </div>

            <div className={`flex items-center gap-4 shrink-0 ${isMobileLandscape ? 'justify-between pt-2 border-t border-white/10' : ''}`}>
              <div className={isMobileLandscape ? 'text-left' : 'text-right'}>
                <div className="text-[11px] text-slate-400">
                  {language === 'vi' ? 'Tiến độ mục tiêu' : 'Completed'}
                </div>
                <div className="font-mono text-xl font-extrabold text-[#00FF85] tabular-nums">
                  {completedCount}/{objectives.length}
                </div>
              </div>
              <div className="w-36 space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>{t(language, 'boardSatisfaction')}</span>
                  <span className="font-mono font-bold text-white tabular-nums">
                    {state.boardSatisfaction}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      state.boardSatisfaction < 30
                        ? 'bg-rose-500'
                        : state.boardSatisfaction < 50
                        ? 'bg-amber-400'
                        : 'bg-[#00FF85]'
                    }`}
                    style={{ width: `${state.boardSatisfaction}%` }}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Objective Cards */}
          <div className={isMobileLandscape ? 'col-span-8 grid grid-cols-2 gap-2' : 'grid grid-cols-1 lg:grid-cols-3 gap-4'}>
            {objectives.map((obj) => {
              const compTheme = COMPETITION_THEMES[obj.competitionId];
              const priorityBadge = getPriorityBadge(obj.priority);
              const meta = getObjectiveMeta(obj);
              const isLeague = obj.targetLeagueRank !== undefined;

              return (
                <article
                  key={obj.id}
                  className="rounded-xl border border-white/12 bg-black/35 overflow-hidden flex flex-col justify-between"
                >
                  <div
                    className={`${isMobileLandscape ? 'px-3.5 py-2' : 'px-5 py-3'} border-b border-white/10 flex items-center justify-between gap-2`}
                    style={{ backgroundColor: compTheme.headerBg }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Trophy
                        className="w-4 h-4 shrink-0"
                        style={{ color: compTheme.accentColor }}
                      />
                      <span className="font-mono text-xs font-bold text-white truncate">
                        {compTheme.name}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded border text-[10px] font-bold whitespace-nowrap ${priorityBadge.cls}`}
                    >
                      {priorityBadge.label}
                    </span>
                  </div>

                  <div className={`${isMobileLandscape ? 'p-3.5 space-y-2.5' : 'p-5 space-y-4'} flex-1 flex flex-col justify-between`}>
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className={`font-display font-bold text-white leading-snug ${isMobileLandscape ? 'text-lg' : 'text-xl'}`}>
                          {language === 'vi' ? obj.titleVi : obj.titleEn}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {language === 'vi' ? obj.descVi : obj.descEn}
                      </p>
                    </div>

                    <div className="space-y-2.5 pt-2 border-t border-white/10">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-semibold ${meta.cls}`}
                        >
                          {meta.icon}
                          <span>{meta.label}</span>
                        </span>
                        <span className="font-mono text-[11px] text-slate-400">
                          {t(language, 'boardWeightLabel')}: {obj.boardWeight}%
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <div className="text-xs font-medium text-slate-100">
                          {language === 'vi' ? obj.currentProgressVi : obj.currentProgressEn}
                        </div>
                        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${meta.barCls}`}
                            style={{ width: `${meta.barPct}%` }}
                          />
                        </div>
                      </div>

                      <div className="text-[11px] font-mono text-slate-400">
                        {isLeague
                          ? language === 'vi'
                            ? 'Tác động BLĐ: ±1%/trận theo tiến độ · +10% đạt / -8% trượt cuối mùa'
                            : 'Board impact: ±1%/match pace · +10% achieved / -8% missed at season end'
                          : language === 'vi'
                          ? 'Tác động BLĐ: +6% khi đạt vòng mục tiêu / -6% nếu bị loại sớm'
                          : 'Board impact: +6% when target reached / -6% if eliminated early'}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* Office Tab 2: Manager Contract & Job Market */}
      {activeOfficeTab === 'jobs' && (
        <div
          className={
            isMobileLandscape
              ? 'flex-1 min-h-0 overflow-hidden grid grid-cols-12 gap-2'
              : 'space-y-6'
          }
        >
      {/* Current Manager Contract & Board Standing */}
      <section
        className={
          isMobileLandscape
            ? 'col-span-4 h-full min-h-0 overflow-y-auto rounded-xl border border-white/12 bg-black/35 p-3 space-y-3'
            : 'rounded-xl border border-white/12 bg-black/35 p-6 space-y-5'
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <ClubBadge
              clubId={userClub.id}
              name={userClub.name}
              shortName={userClub.shortName}
              primaryColor={userClub.primaryColor}
              secondaryColor={userClub.secondaryColor}
              pattern={userClub.pattern}
              size={isMobileLandscape ? 38 : 56}
            />
            <div className="min-w-0">
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <span>{t(language, 'managerContract')}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{COMPETITION_THEMES[userLeagueId].shortName}</span>
              </div>
              <h2
                className={`font-display font-bold text-white truncate ${
                  isMobileLandscape ? 'text-lg' : 'text-2xl sm:text-3xl'
                }`}
              >
                {coachFullName} — {userClub.name}
              </h2>
            </div>
          </div>

          {!isSacked && (
            <button
              type="button"
              onClick={() => {
                setRenewWage(Math.round(contract.weeklyWage * 1.1));
                setRenewYears(2);
                setRenewFeedback(null);
                setShowRenewForm((v) => !v);
              }}
              className="rounded-lg bg-[#00FF85] hover:bg-emerald-300 text-slate-950 font-bold text-xs px-4 py-2 cursor-pointer whitespace-nowrap shrink-0"
            >
              {t(language, 'renewContract')}
            </button>
          )}
        </div>

        <div className={`grid ${isMobileLandscape ? 'grid-cols-2 gap-2.5' : 'grid-cols-2 sm:grid-cols-4 gap-4'} text-xs`}>
          <div className="py-1">
            <div className="text-slate-400">{t(language, 'weeklyWageLabel')}</div>
            <div className="font-mono text-base font-bold text-white mt-1 tabular-nums">
              {formatCurrency(contract.weeklyWage)}/wk
            </div>
          </div>
          <div className="py-1">
            <div className="text-slate-400">{t(language, 'contractUntil')}</div>
            <div className="font-mono text-base font-bold text-white mt-1 tabular-nums">
              June {contract.contractEndSeasonYear}
            </div>
          </div>
          <div className="py-1">
            <div className="text-slate-400">{t(language, 'boardSatisfaction')}</div>
            <div
              className={`font-mono text-base font-bold mt-1 tabular-nums ${
                state.boardSatisfaction < 30
                  ? 'text-rose-400'
                  : state.boardSatisfaction < 50
                  ? 'text-amber-300'
                  : 'text-[#00FF85]'
              }`}
            >
              {state.boardSatisfaction}%
            </div>
          </div>
          <div className="py-1">
            <div className="text-slate-400">Contract Status</div>
            <div
              className={`text-sm font-bold mt-1 ${
                isSacked
                  ? 'text-rose-400'
                  : contract.status === 'EXPIRING'
                  ? 'text-amber-300'
                  : 'text-[#00FF85]'
              }`}
            >
              {getContractStatusText()}
            </div>
          </div>
        </div>

        {isSacked && (
          <div
            role="alert"
            className="rounded-lg border border-rose-500/50 bg-rose-950/65 px-4 py-3 flex items-start gap-3 text-xs text-rose-100"
          >
            <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-white">{t(language, 'sackedTitle')}</div>
              <p className="text-rose-200 mt-0.5">{t(language, 'sackedDesc')}</p>
            </div>
          </div>
        )}

        {!isSacked && probationLeft !== null && state.boardSatisfaction < 30 && (
          <div
            role="status"
            className="rounded-lg border border-amber-400/45 bg-amber-950/55 px-4 py-3 flex items-center gap-3 text-xs text-amber-100"
          >
            <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />
            <span>
              <strong className="text-amber-300">{t(language, 'probationWarning')}:</strong>{' '}
              <span className="font-mono font-bold tabular-nums">{probationLeft}</span>{' '}
              {t(language, 'matchesRemaining')}
            </span>
          </div>
        )}

        {showRenewForm && !isSacked && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const res = onRenewContract(renewWage, renewYears);
              setRenewFeedback({ ok: res.ok, message: res.message });
              if (res.ok) {
                setShowRenewForm(false);
              }
            }}
            className={`pt-4 border-t border-white/10 grid grid-cols-1 ${
              isMobileLandscape ? '' : 'sm:grid-cols-3'
            } gap-3 items-end`}
          >
            <div>
              <label htmlFor="renew-mgr-wage" className="block text-xs text-slate-300 mb-1">
                {t(language, 'weeklyWageLabel')} ({formatCurrency(renewWage)}/wk)
              </label>
              <FormattedNumberInput
                id="renew-mgr-wage"
                min={2000}
                step={2500}
                value={renewWage}
                onChange={setRenewWage}
                className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-xs font-mono text-white tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="renew-mgr-years" className="block text-xs text-slate-300 mb-1">
                {language === 'vi' ? 'Gia hạn thêm (năm)' : 'Extend Length (Years)'}
              </label>
              <select
                id="renew-mgr-years"
                value={renewYears}
                onChange={(e) => setRenewYears(Number(e.target.value))}
                className="w-full rounded-lg border border-white/15 bg-black/55 px-3 py-2 text-xs text-white"
              >
                <option value={1}>+1 {language === 'vi' ? 'Năm' : 'Year'}</option>
                <option value={2}>+2 {language === 'vi' ? 'Năm' : 'Years'}</option>
                <option value={3}>+3 {language === 'vi' ? 'Năm' : 'Years'}</option>
                <option value={4}>+4 {language === 'vi' ? 'Năm' : 'Years'}</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="rounded-lg bg-[#00FF85] hover:bg-emerald-300 text-slate-950 font-bold text-xs px-4 py-2 cursor-pointer whitespace-nowrap"
              >
                {language === 'vi' ? 'Đề xuất gia hạn' : 'Submit Renewal'}
              </button>
              <button
                type="button"
                onClick={() => setShowRenewForm(false)}
                className="rounded-lg border border-white/15 bg-white/8 hover:bg-white/15 text-xs text-white px-3 py-2 cursor-pointer whitespace-nowrap"
              >
                {t(language, 'cancel')}
              </button>
            </div>
          </form>
        )}

        {renewFeedback && (
          <div
            className={`text-xs font-medium pt-1 ${
              renewFeedback.ok ? 'text-[#00FF85]' : 'text-rose-400'
            }`}
          >
            {renewFeedback.message}
          </div>
        )}
      </section>

      {/* Club Vacancies & Manager Job Market */}
      <section
        className={
          isMobileLandscape
            ? 'col-span-8 h-full min-h-0 flex flex-col rounded-xl border border-white/12 bg-black/35 p-3 gap-2 overflow-hidden'
            : 'rounded-xl border border-white/12 bg-black/35 p-6 space-y-4'
        }
      >
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <Briefcase className="w-5 h-5 text-[#00FF85]" />
            <div>
              <h2 className={`font-display font-bold text-white ${isMobileLandscape ? 'text-lg' : 'text-2xl'}`}>
                {t(language, 'jobMarketTitle')}
              </h2>
              <div className="text-xs text-slate-400">
                {counts.vacant} {t(language, 'vacantStatus')} · {counts.expiring}{' '}
                {t(language, 'expiringStatus')} · {counts.all} Clubs
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={language === 'vi' ? 'Tìm CLB hoặc HLV...' : 'Search club or manager...'}
                aria-label="Search job market"
                className="rounded-lg border border-white/15 bg-black/50 pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 w-40 sm:w-48"
              />
            </div>

            <select
              aria-label="Filter by country"
              value={countryFilter}
              onChange={(e) => {
                const c = e.target.value as 'ALL' | CountryId;
                setCountryFilter(c);
                setTierFilter('ALL');
              }}
              className="rounded-lg border border-white/15 bg-black/55 px-2.5 py-1.5 text-xs text-white"
            >
              <option value="ALL">All Nations (22)</option>
              {COUNTRY_CATALOG.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.flag} {language === 'vi' ? c.nameVi : c.nameEn}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by division"
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value as TierFilter)}
              className="rounded-lg border border-white/15 bg-black/55 px-2.5 py-1.5 text-xs text-white"
            >
              <option value="ALL">All Leagues ({counts.all})</option>
              {(countryFilter === 'ALL' ? ALL_DOMESTIC_LEAGUE_IDS : COUNTRY_BY_ID[countryFilter].leagues).map((lid) => (
                <option key={lid} value={lid}>
                  {COMPETITION_THEMES[lid].name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Segmented Filter Tabs */}
        <div className="shrink-0 flex flex-wrap items-center gap-1 p-1 rounded-lg bg-black/45 border border-white/10 w-fit">
          {(
            [
              ['open', `${t(language, 'openJobsFilter')} (${counts.open})`],
              ['vacant', `${t(language, 'vacantFilter')} (${counts.vacant})`],
              ['expiring', `${t(language, 'expiringFilter')} (${counts.expiring})`],
              ['all', `${t(language, 'allClubsFilter')} (${counts.all})`],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFilterMode(mode)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                filterMode === mode
                  ? 'bg-white text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {filteredRows.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <p className="text-sm text-slate-400">
              {language === 'vi'
                ? 'Không có vị trí huấn luyện phù hợp bộ lọc hiện tại.'
                : 'No managerial openings match your current filter.'}
            </p>
            <button
              type="button"
              onClick={() => {
                setFilterMode('all');
                setTierFilter('ALL');
                setSearchQuery('');
              }}
              className="rounded-lg border border-white/20 bg-white/8 hover:bg-white/15 text-xs font-semibold text-white px-4 py-2 cursor-pointer"
            >
              {t(language, 'allClubsFilter')}
            </button>
          </div>
        ) : (
          <div className={isMobileLandscape ? 'flex-1 min-h-0 overflow-auto' : 'overflow-x-auto'}>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 text-[11px] font-mono text-slate-400">
                  <th className="py-2.5 pr-3">Club</th>
                  <th className="py-2.5 px-2">Div</th>
                  <th className="py-2.5 px-2 text-right">Rank</th>
                  <th className="py-2.5 px-2 text-right">OVR</th>
                  <th className="py-2.5 px-2 text-right">{t(language, 'budgetLabel')}</th>
                  <th className="py-2.5 px-3">{t(language, 'incumbentManager')}</th>
                  <th className="py-2.5 px-2 text-right">Conf%</th>
                  <th className="py-2.5 px-2">Status</th>
                  <th className="py-2.5 pl-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {filteredRows.map((row) => {
                  const statusMeta = getAiStatusMeta(row.managerInfo.status);
                  return (
                    <tr key={row.clubId} className="hover:bg-white/[0.04] transition-colors">
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ClubBadge
                            clubId={row.clubId}
                            name={row.name}
                            shortName={row.shortName}
                            primaryColor={row.primaryColor}
                            secondaryColor={row.secondaryColor}
                            pattern={row.pattern}
                            size={30}
                          />
                          <span className="font-semibold text-white truncate max-w-[170px]">
                            {row.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 font-mono text-slate-300 whitespace-nowrap">
                        {COMPETITION_THEMES[row.leagueId].shortName}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-200">
                        #{row.rank}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-bold tabular-nums text-emerald-300">
                        {row.ovr}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-200 whitespace-nowrap">
                        {formatCurrency(row.budget)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-200">
                        <div className="truncate max-w-[160px]">{row.managerInfo.managerName}</div>
                        <div className="text-[10px] font-mono text-slate-500">
                          Until {row.managerInfo.contractEndSeasonYear}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-300">
                        {row.managerInfo.satisfaction}%
                      </td>
                      <td className={`py-2.5 px-2 whitespace-nowrap ${statusMeta.colorClass}`}>
                        {statusMeta.label}
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenApply(row)}
                          className="rounded-lg border border-[#00FF85]/45 bg-[#00FF85]/12 hover:bg-[#00FF85] hover:text-slate-950 text-[#00FF85] font-bold text-[11px] px-3 py-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        >
                          {t(language, 'applyJob')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
        </div>
      )}

      {/* Application & Contract Negotiation Modal */}
      {applyingRow && (
        <ModalPortal>
        <div
          className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Apply for ${applyingRow.name}`}
        >
          <div className="animate-modal-pop w-full max-w-lg rounded-xl border border-white/15 bg-[var(--pitch-modal-bg,#1B0721)] p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
              <div className="flex items-center gap-3 min-w-0">
                <ClubBadge
                  clubId={applyingRow.clubId}
                  name={applyingRow.name}
                  shortName={applyingRow.shortName}
                  primaryColor={applyingRow.primaryColor}
                  secondaryColor={applyingRow.secondaryColor}
                  pattern={applyingRow.pattern}
                  size={44}
                />
                <div className="min-w-0">
                  <div className="text-xs font-mono text-slate-400">
                    {COMPETITION_THEMES[applyingRow.leagueId].name} · Rank #{applyingRow.rank}
                  </div>
                  <h3 className="font-display text-2xl font-bold text-white truncate">
                    {applyingRow.name}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setApplyingRow(null)}
                aria-label="Close job application"
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs border-b border-white/10 pb-4">
              <div>
                <div className="text-slate-400">{t(language, 'budgetLabel')}</div>
                <div className="font-mono font-bold text-[#00FF85] mt-0.5 tabular-nums">
                  {formatCurrency(applyingRow.budget)}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Board Wage Guide</div>
                <div className="font-mono font-bold text-white mt-0.5 tabular-nums">
                  {formatCurrency(applyingRow.managerInfo.weeklyBudgetOffer)}/wk
                </div>
              </div>
              <div>
                <div className="text-slate-400">{t(language, 'incumbentManager')}</div>
                <div className={`font-semibold mt-0.5 ${getAiStatusMeta(applyingRow.managerInfo.status).colorClass}`}>
                  {getAiStatusMeta(applyingRow.managerInfo.status).label}
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmitApplication} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="apply-wage-input" className="block text-xs text-slate-300 mb-1">
                    {t(language, 'weeklyWageLabel')} ({formatCurrency(desiredWage)}/wk)
                  </label>
                  <FormattedNumberInput
                    id="apply-wage-input"
                    min={2000}
                    step={2500}
                    value={desiredWage}
                    onChange={(val) => {
                      setDesiredWage(val);
                      setApplyOutcome(null);
                    }}
                    className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-xs font-mono text-white tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="apply-years-select" className="block text-xs text-slate-300 mb-1">
                    {language === 'vi' ? 'Thời hạn hợp đồng' : 'Contract Length'}
                  </label>
                  <select
                    id="apply-years-select"
                    value={desiredYears}
                    onChange={(e) => {
                      setDesiredYears(Number(e.target.value));
                      setApplyOutcome(null);
                    }}
                    className="w-full rounded-lg border border-white/15 bg-black/55 px-3 py-2 text-xs text-white"
                  >
                    <option value={1}>1 {language === 'vi' ? 'Mùa' : 'Season'}</option>
                    <option value={2}>2 {language === 'vi' ? 'Mùa' : 'Seasons'}</option>
                    <option value={3}>3 {language === 'vi' ? 'Mùa' : 'Seasons'}</option>
                    <option value={4}>4 {language === 'vi' ? 'Mùa' : 'Seasons'}</option>
                  </select>
                </div>
              </div>

              {applyOutcome && (
                <div
                  className={`rounded-lg border px-3.5 py-2.5 text-xs flex items-start gap-2.5 ${
                    applyOutcome.accepted
                      ? 'border-[#00FF85]/50 bg-[#00FF85]/12 text-emerald-100'
                      : 'border-rose-500/50 bg-rose-950/60 text-rose-100'
                  }`}
                >
                  {applyOutcome.accepted ? (
                    <CheckCircle2 className="w-4 h-4 text-[#00FF85] shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
                  )}
                  <span>{applyOutcome.message}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setApplyingRow(null)}
                  className="rounded-lg border border-white/20 bg-white/8 hover:bg-white/15 text-xs font-semibold text-white px-4 py-2 cursor-pointer whitespace-nowrap"
                >
                  {t(language, 'cancel')}
                </button>
                {applyOutcome?.accepted ? (
                  <button
                    type="button"
                    onClick={() => {
                      onApplyAndSwitchClub(applyingRow.clubId, desiredWage, desiredYears);
                      setApplyingRow(null);
                    }}
                    className="rounded-lg bg-[#00FF85] hover:bg-emerald-300 text-slate-950 font-bold text-xs px-4 py-2 cursor-pointer whitespace-nowrap"
                  >
                    {language === 'vi' ? 'Ký hợp đồng & Tiếp quản CLB' : 'Sign Contract & Take Charge'}
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="rounded-lg bg-[#00FF85] hover:bg-emerald-300 text-slate-950 font-bold text-xs px-4 py-2 cursor-pointer whitespace-nowrap"
                  >
                    {language === 'vi' ? 'Gửi đơn & Đàm phán' : 'Submit Application'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
};

export const OfficeView = JobMarketView;
