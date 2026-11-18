import React from 'react';
import { CareerState, Club } from '../types/game';
import { formatCurrency, t } from '../utils/i18n';
import { useIsMobileLandscape } from '../utils/useMobileLandscape';
import { ArrowUpRight } from 'lucide-react';

interface AcademyViewProps {
  state: CareerState;
  onPromotePlayer: (academyId: string) => void;
}

export const AcademyView: React.FC<AcademyViewProps> = ({ state, onPromotePlayer }) => {
  const lang = state.settings.language;
  const isMobileLandscape = useIsMobileLandscape();
  const totalMatches = state.academy.reduce((s, a) => s + a.matches, 0);
  const totalGoals = state.academy.reduce((s, a) => s + a.goals, 0);
  const totalAssists = state.academy.reduce((s, a) => s + a.assists, 0);

  return (
    <div
      className={
        isMobileLandscape
          ? 'h-full min-h-0 flex flex-col gap-2 overflow-hidden'
          : 'space-y-5 lg:h-[calc(100vh-8.5rem)] lg:flex lg:flex-col lg:overflow-hidden'
      }
    >
      <div className={isMobileLandscape ? 'grid grid-cols-3 gap-2 shrink-0' : 'grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0'}>
        <div
          className={`pitch-panel rounded-2xl ${
            isMobileLandscape ? 'px-3 py-2 flex items-center justify-between gap-2' : 'p-4'
          }`}
        >
          <div className="text-xs text-slate-400">Youth Squad Matches</div>
          <div className={`font-display font-bold text-white tabular-nums ${isMobileLandscape ? 'text-2xl' : 'text-3xl mt-1'}`}>
            {totalMatches}
          </div>
        </div>
        <div
          className={`pitch-panel rounded-2xl ${
            isMobileLandscape ? 'px-3 py-2 flex items-center justify-between gap-2' : 'p-4'
          }`}
        >
          <div className="text-xs text-slate-400">Academy Goals</div>
          <div className={`font-display font-bold text-[#00FF85] tabular-nums ${isMobileLandscape ? 'text-2xl' : 'text-3xl mt-1'}`}>
            {totalGoals}
          </div>
        </div>
        <div
          className={`pitch-panel rounded-2xl ${
            isMobileLandscape ? 'px-3 py-2 flex items-center justify-between gap-2' : 'p-4'
          }`}
        >
          <div className="text-xs text-slate-400">Academy Assists</div>
          <div className={`font-display font-bold text-white tabular-nums ${isMobileLandscape ? 'text-2xl' : 'text-3xl mt-1'}`}>
            {totalAssists}
          </div>
        </div>
      </div>

      <div className="lg:flex-1 lg:min-h-0 flex-1 min-h-0 overflow-y-auto pr-1">
        <div
          className={
            isMobileLandscape
              ? 'grid grid-cols-2 lg:grid-cols-4 gap-2.5 content-start'
              : 'grid grid-cols-1 md:grid-cols-2 gap-4'
          }
        >
        {state.academy.map((ap) => (
          <div
            key={ap.id}
            className="pitch-panel rounded-2xl p-4 flex flex-col justify-between gap-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-display text-base font-bold text-white truncate">{ap.name}</h3>
                <div className="text-[11px] text-slate-400">
                  {ap.position} · {ap.nationality} · Age {ap.age}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono text-xl font-bold text-emerald-300 tabular-nums leading-none">
                  {ap.ovr}
                </div>
                <div className="text-[10px] font-mono text-slate-400 tabular-nums mt-0.5">
                  POT {ap.potential}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] text-slate-300">
                <span>Progress</span>
                <span className="font-mono tabular-nums">{ap.developmentProgress}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-[#00FF85]"
                  style={{ width: `${ap.developmentProgress}%` }}
                />
              </div>
              <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                {ap.matches}M · {ap.goals}G · {ap.assists}A
              </div>
            </div>

            <div>
              {ap.promoted ? (
                <div className="text-[11px] font-semibold text-emerald-300">
                  Promoted to First Team Squad
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onPromotePlayer(ap.id)}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#00FF85] hover:bg-emerald-300 text-slate-950 font-bold text-xs px-3 py-1.5 cursor-pointer"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  {t(lang, 'promotePlayer')}
                </button>
              )}
            </div>
          </div>
        ))}
        </div>
      </div>
    </div>
  );
};

interface FinanceViewProps {
  state: CareerState;
  userClub: Club;
}

export const FinanceView: React.FC<FinanceViewProps> = ({ state, userClub }) => {
  const lang = state.settings.language;
  const isMobileLandscape = useIsMobileLandscape();
  const weeklyPayroll = userClub.players.reduce((s, p) => s + p.weeklyWage, 0);

  const sumCategory = (cat: string) =>
    state.financeLedger
      .filter((e) => e.category === cat)
      .reduce((s, e) => s + e.amount, 0);

  const metrics = [
    [t(lang, 'openingBudget'), formatCurrency(state.openingBudget)],
    [t(lang, 'availableBudget'), formatCurrency(state.budget)],
    [t(lang, 'weeklyPayroll'), formatCurrency(weeklyPayroll)],
    [t(lang, 'playerSales'), formatCurrency(sumCategory('PLAYER_SALE'))],
    [t(lang, 'transferFees'), formatCurrency(sumCategory('TRANSFER_FEE'))],
    [t(lang, 'renewalFees'), formatCurrency(sumCategory('RENEWAL_FEE'))],
    [t(lang, 'releaseCompensation'), formatCurrency(sumCategory('RELEASE_COMPENSATION'))],
    [t(lang, 'goalBonuses'), formatCurrency(sumCategory('GOAL_BONUS'))],
  ];

  return (
    <div
      className={
        isMobileLandscape
          ? 'h-full min-h-0 grid grid-cols-12 gap-2 overflow-hidden'
          : 'space-y-6'
      }
    >
      <div
        className={
          isMobileLandscape
            ? 'col-span-5 h-full min-h-0 overflow-y-auto grid grid-cols-2 gap-2 content-start pr-0.5'
            : 'grid grid-cols-2 lg:grid-cols-4 gap-4'
        }
      >
        {metrics.map(([label, val]) => (
          <div
            key={label}
            className={`pitch-panel rounded-2xl ${isMobileLandscape ? 'p-3' : 'p-4'}`}
          >
            <div className="text-xs text-slate-400 truncate">{label}</div>
            <div
              className={`font-mono font-bold text-white tabular-nums mt-1 ${
                isMobileLandscape ? 'text-base' : 'text-xl'
              }`}
            >
              {val}
            </div>
          </div>
        ))}
      </div>

      <div
        className={
          isMobileLandscape
            ? 'col-span-7 h-full min-h-0 flex flex-col pitch-panel rounded-2xl p-3 overflow-hidden'
            : 'pitch-panel rounded-2xl p-5'
        }
      >
        <h3
          className={`shrink-0 font-display font-bold text-white ${
            isMobileLandscape ? 'text-lg pb-2 border-b border-white/10 mb-2' : 'text-xl mb-4'
          }`}
        >
          {t(lang, 'transactionLedger')}
        </h3>
        <div
          className={
            isMobileLandscape ? 'flex-1 min-h-0 overflow-auto' : 'overflow-x-auto max-h-[420px] overflow-y-auto'
          }
        >
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-[#1B0721] border-b border-white/10 text-slate-400">
              <tr>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Description</th>
                <th className="py-2 pr-3">Category</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8">
              {state.financeLedger.map((entry) => (
                <tr key={entry.id}>
                  <td className="py-2 pr-3 font-mono text-slate-400 whitespace-nowrap">
                    {entry.dateIso}
                  </td>
                  <td className="py-2 pr-3 text-slate-200">{entry.description}</td>
                  <td className="py-2 pr-3 font-mono text-slate-400">{entry.category}</td>
                  <td
                    className={`py-2 text-right font-mono font-bold tabular-nums whitespace-nowrap ${
                      entry.type === 'INCOME' ? 'text-emerald-300' : 'text-rose-400'
                    }`}
                  >
                    {entry.type === 'INCOME' ? '+' : '-'}
                    {formatCurrency(entry.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
