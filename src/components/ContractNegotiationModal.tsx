import React, { useMemo, useState } from 'react';
import { ModalPortal } from './ModalPortal';
import { evaluateContractOffer } from '../engine/gameLogic';
import { ContractOffer, Language, Player, SquadStatus } from '../types/game';
import { formatCurrency, t } from '../utils/i18n';
import { FormattedNumberInput } from './FormattedNumberInput';
import { X } from 'lucide-react';

interface ContractNegotiationModalProps {
  player: Player;
  availableBudget: number;
  language: Language;
  mode?: 'RENEWAL' | 'NEW_SIGNING';
  onClose: () => void;
  onSigned: (offer: ContractOffer, immediateCost: number) => void;
}

const SQUAD_STATUSES: SquadStatus[] = [
  'Crucial',
  'Important',
  'Rotation',
  'Sporadic',
  'Prospect',
];

export const ContractNegotiationModal: React.FC<ContractNegotiationModalProps> = ({
  player,
  availableBudget,
  language,
  mode = 'RENEWAL',
  onClose,
  onSigned,
}) => {
  const [weeklyWage, setWeeklyWage] = useState(Math.round(player.weeklyWage * 1.1));
  const [extendByYears, setExtendByYears] = useState(3);
  const [signingFee, setSigningFee] = useState(Math.round(player.weeklyWage * 4));
  const [agentFee, setAgentFee] = useState(Math.round(player.weeklyWage * 2));
  const [squadStatus, setSquadStatus] = useState<SquadStatus>(player.squadStatus);
  const [bonusPerGoal, setBonusPerGoal] = useState(player.goalBonus);
  const [releaseCompensation, setReleaseCompensation] = useState(player.releaseClause);
  const [outcomeNote, setOutcomeNote] = useState<string | null>(null);

  const offer: ContractOffer = useMemo(
    () => ({
      weeklyWage,
      extendByYears,
      signingFee,
      agentFee,
      squadStatus,
      bonusPerGoal,
      releaseCompensation,
    }),
    [weeklyWage, extendByYears, signingFee, agentFee, squadStatus, bonusPerGoal, releaseCompensation]
  );

  const evalResult = useMemo(
    () => evaluateContractOffer(player, offer, availableBudget),
    [player, offer, availableBudget]
  );

  const totalDueNow = signingFee + agentFee;
  const remainingAfter = availableBudget - totalDueNow;

  const handleSubmit = () => {
    if (evalResult.accepted) {
      onSigned(offer, evalResult.immediateCost);
    } else {
      setOutcomeNote(evalResult.recommendation);
    }
  };

  return (
    <ModalPortal>
    <div
      className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Player Negotiation"
    >
      <div className="animate-modal-pop w-full max-w-4xl rounded-2xl pitch-modal-shell text-slate-100 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/30">
          <div>
            <h3 className="font-display text-2xl font-bold text-white">
              {mode === 'NEW_SIGNING' ? `Contract Terms · ${player.name}` : `Player Negotiation · ${player.name}`}
            </h3>
            <p className="text-xs text-slate-400">
              {player.position} · OVR {player.ovr} · Current Wage {formatCurrency(player.weeklyWage)}/wk
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close negotiation"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto">
          {/* Left Form Controls */}
          <div className="lg:col-span-7 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1">{t(language, 'weeklyWage')}</label>
                <FormattedNumberInput
                  step={5000}
                  min={5000}
                  value={weeklyWage}
                  onChange={setWeeklyWage}
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Extend By (Years)</label>
                <select
                  value={extendByYears}
                  onChange={(e) => setExtendByYears(Number(e.target.value))}
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm font-mono text-white"
                >
                  {[1, 2, 3, 4, 5].map((y) => (
                    <option key={y} value={y}>
                      +{y} {y === 1 ? 'Year' : 'Years'} (until {player.contractExpiry + y})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Signing Fee</label>
                <FormattedNumberInput
                  step={50000}
                  min={0}
                  value={signingFee}
                  onChange={setSigningFee}
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Agent Fee</label>
                <FormattedNumberInput
                  step={25000}
                  min={0}
                  value={agentFee}
                  onChange={setAgentFee}
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">{t(language, 'squadStatus')}</label>
                <select
                  value={squadStatus}
                  onChange={(e) => setSquadStatus(e.target.value as SquadStatus)}
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                >
                  {SQUAD_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Bonus Per Goal</label>
                <FormattedNumberInput
                  step={1000}
                  min={0}
                  value={bonusPerGoal}
                  onChange={setBonusPerGoal}
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm font-mono text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">{t(language, 'releaseClause')}</label>
              <FormattedNumberInput
                step={500000}
                min={0}
                value={releaseCompensation}
                onChange={setReleaseCompensation}
                className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm font-mono text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10 text-xs">
              <div className="rounded-lg bg-black/30 border border-white/10 p-3">
                <div className="text-slate-400">Total Fee Due Now</div>
                <div className="text-base font-mono font-bold text-white tabular-nums mt-0.5">
                  {formatCurrency(totalDueNow)}
                </div>
              </div>
              <div className="rounded-lg bg-black/30 border border-white/10 p-3">
                <div className="text-slate-400">Budget Remaining</div>
                <div
                  className={`text-base font-mono font-bold tabular-nums mt-0.5 ${
                    remainingAfter < 0 ? 'text-rose-400' : 'text-emerald-300'
                  }`}
                >
                  {formatCurrency(remainingAfter)}
                </div>
              </div>
            </div>
          </div>

          {/* Right Scout Recommendation & Satisfaction */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-4 rounded-xl border border-white/12 bg-black/30 p-5">
            <div className="space-y-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                  Scout Recommendation
                </div>
                <div className="text-sm font-semibold text-white mt-1">
                  Player & Agent Representative ({player.name})
                </div>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  {outcomeNote ?? evalResult.recommendation}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-300">Satisfaction</span>
                  <span className="font-mono font-bold text-white tabular-nums">
                    {evalResult.satisfaction}%
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-200 ${
                      evalResult.satisfaction >= 68
                        ? 'bg-emerald-400'
                        : evalResult.satisfaction >= 45
                        ? 'bg-amber-400'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${evalResult.satisfaction}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2.5 pt-3 border-t border-white/10">
              <button
                type="button"
                disabled={remainingAfter < 0}
                onClick={handleSubmit}
                className="w-full rounded-lg bg-[#00FF85] hover:bg-emerald-300 disabled:opacity-45 disabled:cursor-not-allowed text-slate-950 font-bold text-sm py-2.5 px-4 cursor-pointer"
              >
                {remainingAfter < 0 ? t(language, 'insufficientBudget') : t(language, 'submitOffer')}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm py-2.5 px-4 cursor-pointer"
              >
                {t(language, 'endNegotiation')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};
