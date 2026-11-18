import React, { useMemo, useState } from 'react';
import { ModalPortal } from './ModalPortal';
import { evaluateTransferOffer } from '../engine/gameLogic';
import { Club, Language, Player, TransferOffer } from '../types/game';
import { formatCurrency, t } from '../utils/i18n';
import { ClubBadge, PlayerAvatar } from './ClubBadge';
import { FormattedNumberInput } from './FormattedNumberInput';
import { X } from 'lucide-react';

interface TransferNegotiationModalProps {
  targetPlayer: Player;
  sellingClub: Club;
  userClub: Club;
  availableBudget: number;
  language: Language;
  isScouted?: boolean;
  onClose: () => void;
  onOfferAccepted: (offer: TransferOffer, paidNow: number) => void;
  onLoanAccepted?: (offer: TransferOffer) => void;
  onOfferRejected: (message: string) => void;
}

export const TransferNegotiationModal: React.FC<TransferNegotiationModalProps> = ({
  targetPlayer,
  sellingClub,
  userClub,
  availableBudget,
  language,
  isScouted = true,
  onClose,
  onOfferAccepted,
  onLoanAccepted,
  onOfferRejected,
}) => {
  const [dealType, setDealType] = useState<'PERMANENT' | 'LOAN'>('PERMANENT');
  const [startDate, setStartDate] = useState<'Immediate' | 'Next Window'>('Immediate');
  const [transferFee, setTransferFee] = useState(
    isScouted ? Math.round(targetPlayer.marketValue * 1.05) : 15_000_000
  );
  const [upfrontPct, setUpfrontPct] = useState<number>(100);
  const [installmentSeasons, setInstallmentSeasons] = useState<number>(0);
  const [exchangePlayerId, setExchangePlayerId] = useState<string>('');
  const [bonusAfterAppearances, setBonusAfterAppearances] = useState<number>(0);
  const [sellOnShare, setSellOnShare] = useState<number>(10);

  // Loan In terms
  const [loanDurationSeasons, setLoanDurationSeasons] = useState<0.5 | 1 | 2>(1);
  const [loanWageSplitPct, setLoanWageSplitPct] = useState<number>(60);
  const [loanFee, setLoanFee] = useState<number>(
    isScouted ? Math.round(targetPlayer.marketValue * 0.08) : 1_500_000
  );
  const [buyOptionFee, setBuyOptionFee] = useState<number>(
    isScouted ? Math.round(targetPlayer.marketValue * 1.1) : 0
  );
  const [feedback, setFeedback] = useState<string | null>(null);

  const exchangePlayer = useMemo(
    () => userClub.players.find((p) => p.id === exchangePlayerId) ?? null,
    [userClub.players, exchangePlayerId]
  );

  const offer: TransferOffer = useMemo(
    () =>
      dealType === 'LOAN'
        ? {
            dealType: 'LOAN',
            startDate: 'Immediate',
            transferFee: 0,
            installments: 0,
            exchangePlayerId: null,
            bonusAfterAppearances: 0,
            sellOnShare: 0,
            loanDurationSeasons,
            loanWageSplitPct,
            loanFee,
            buyOptionFee,
          }
        : {
            dealType: 'PERMANENT',
            startDate,
            transferFee,
            installments: installmentSeasons * 12,
            upfrontPct: installmentSeasons === 0 ? 100 : upfrontPct,
            installmentSeasons,
            exchangePlayerId: exchangePlayerId || null,
            bonusAfterAppearances,
            sellOnShare,
          },
    [
      dealType,
      startDate,
      transferFee,
      upfrontPct,
      installmentSeasons,
      exchangePlayerId,
      bonusAfterAppearances,
      sellOnShare,
      loanDurationSeasons,
      loanWageSplitPct,
      loanFee,
      buyOptionFee,
    ]
  );

  const evaluation = useMemo(
    () => evaluateTransferOffer(targetPlayer, offer, availableBudget, exchangePlayer),
    [targetPlayer, offer, availableBudget, exchangePlayer]
  );

  const handleSubmit = () => {
    if (evaluation.insufficientBudget) {
      setFeedback(evaluation.message);
      return;
    }
    if (evaluation.status === 'ACCEPTED') {
      if (dealType === 'LOAN') {
        if (onLoanAccepted) {
          onLoanAccepted(offer);
        } else {
          onOfferAccepted(offer, evaluation.paidNow);
        }
      } else {
        onOfferAccepted(offer, evaluation.paidNow);
      }
    } else if (evaluation.status === 'REJECTED') {
      onOfferRejected(evaluation.message);
    } else {
      setFeedback(evaluation.message);
    }
  };

  return (
    <ModalPortal>
    <div
      className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Transfer Negotiation"
    >
      <div className="animate-modal-pop w-full max-w-5xl rounded-2xl pitch-modal-shell text-slate-100 overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/30">
          <div className="flex items-center gap-3">
            <ClubBadge
              name={sellingClub.name}
              shortName={sellingClub.shortName}
              primaryColor={sellingClub.primaryColor}
              secondaryColor={sellingClub.secondaryColor}
              pattern={sellingClub.pattern}
              size={36}
            />
            <div>
              <h3 className="font-display text-2xl font-bold text-white">
                {dealType === 'LOAN' ? t(language, 'loanInDeal') : t(language, 'permanentDeal')} ·{' '}
                {targetPlayer.name}
              </h3>
              <p className="text-xs text-slate-400">
                Negotiating with {sellingClub.name} (Head Coach: {sellingClub.managerName})
                {!isScouted ? ' · Unscouted Blind Bid' : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close transfer negotiation"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto">
          {/* Left Offer Builder */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center gap-1 p-1 rounded-lg bg-black/45 border border-white/10 w-fit">
              <button
                type="button"
                onClick={() => {
                  setDealType('PERMANENT');
                  setFeedback(null);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                  dealType === 'PERMANENT'
                    ? 'bg-[#00FF85] text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {t(language, 'permanentDeal')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDealType('LOAN');
                  setFeedback(null);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                  dealType === 'LOAN'
                    ? 'bg-sky-400 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {t(language, 'loanInDeal')}
              </button>
            </div>

            {dealType === 'PERMANENT' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Start Date</label>
                  <select
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value as 'Immediate' | 'Next Window')}
                    className="w-full rounded-lg border border-white/15 bg-black/45 px-3 py-2 text-sm text-white"
                  >
                    <option value="Immediate">Immediate</option>
                    <option value="Next Window">Next Window</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Transfer Fee</label>
                  <FormattedNumberInput
                    step={500000}
                    min={0}
                    value={transferFee}
                    onChange={setTransferFee}
                    className="w-full rounded-lg border border-white/15 bg-black/45 px-3 py-2 text-sm font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    {t(language, 'installmentSeasonsLabel')}
                  </label>
                  <select
                    value={installmentSeasons}
                    onChange={(e) => {
                      const nextSeasons = Number(e.target.value);
                      setInstallmentSeasons(nextSeasons);
                      if (nextSeasons === 0) {
                        setUpfrontPct(100);
                      } else if (upfrontPct === 100) {
                        setUpfrontPct(50);
                      }
                    }}
                    className="w-full rounded-lg border border-white/15 bg-black/45 px-3 py-2 text-sm text-white"
                  >
                    <option value={0}>0 (100% Upfront)</option>
                    <option value={1}>1 {t(language, 'seasonUnit')}</option>
                    <option value={2}>2 {t(language, 'seasonUnit')}</option>
                    <option value={3}>3 {t(language, 'seasonUnit')}</option>
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                    <span>{t(language, 'upfrontPctLabel')}</span>
                    <span className="font-mono font-bold text-white tabular-nums">
                      {installmentSeasons === 0 ? 100 : upfrontPct}% /{' '}
                      {installmentSeasons === 0 ? 0 : 100 - upfrontPct}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={100}
                    step={5}
                    disabled={installmentSeasons === 0}
                    value={installmentSeasons === 0 ? 100 : upfrontPct}
                    onChange={(e) => setUpfrontPct(Number(e.target.value))}
                    className="w-full accent-[#00FF85] mt-2 disabled:opacity-45 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Exchange Player</label>
                  <select
                    value={exchangePlayerId}
                    onChange={(e) => setExchangePlayerId(e.target.value)}
                    className="w-full rounded-lg border border-white/15 bg-black/45 px-3 py-2 text-sm text-white"
                  >
                    <option value="">None</option>
                    {userClub.players
                      .filter((p) => !p.loanInfo)
                      .map((p) => {
                        const squadRole = userClub.startingIds.includes(p.id)
                          ? 'XI'
                          : userClub.benchIds.includes(p.id)
                          ? 'SUB'
                          : 'RES';
                        return (
                          <option key={p.id} value={p.id}>
                            [{squadRole}] {p.name} ({formatCurrency(p.marketValue)})
                          </option>
                        );
                      })}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Bonus After Appearances
                  </label>
                  <FormattedNumberInput
                    step={250000}
                    min={0}
                    value={bonusAfterAppearances}
                    onChange={setBonusAfterAppearances}
                    className="w-full rounded-lg border border-white/15 bg-black/45 px-3 py-2 text-sm font-mono text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-300 mb-1">Sell-on Share (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={25}
                    value={sellOnShare}
                    onChange={(e) =>
                      setSellOnShare(Math.min(25, Math.max(0, Number(e.target.value) || 0)))
                    }
                    className="w-full rounded-lg border border-white/15 bg-black/45 px-3 py-2 text-sm font-mono text-white"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    {t(language, 'loanDuration')}
                  </label>
                  <select
                    value={loanDurationSeasons}
                    onChange={(e) =>
                      setLoanDurationSeasons(Number(e.target.value) as 0.5 | 1 | 2)
                    }
                    className="w-full rounded-lg border border-white/15 bg-black/45 px-3 py-2 text-sm text-white"
                  >
                    <option value={0.5}>{t(language, 'halfSeasonLoan')}</option>
                    <option value={1}>{t(language, 'oneSeason')}</option>
                    <option value={2}>{t(language, 'twoSeasons')}</option>
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                    <span>{t(language, 'wageSplit')}</span>
                    <span className="font-mono font-bold text-white tabular-nums">
                      {loanWageSplitPct}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={loanWageSplitPct}
                    onChange={(e) => setLoanWageSplitPct(Number(e.target.value))}
                    className="w-full accent-sky-400 mt-2 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    {t(language, 'loanFeeLabel')}
                  </label>
                  <FormattedNumberInput
                    step={100000}
                    min={0}
                    value={loanFee}
                    onChange={setLoanFee}
                    className="w-full rounded-lg border border-white/15 bg-black/45 px-3 py-2 text-sm font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    {t(language, 'buyClause')} (0 = None)
                  </label>
                  <FormattedNumberInput
                    step={500000}
                    min={0}
                    value={buyOptionFee}
                    onChange={setBuyOptionFee}
                    className="w-full rounded-lg border border-white/15 bg-black/45 px-3 py-2 text-sm font-mono text-white"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/10 text-xs">
              <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                <div className="text-slate-400">Paid Now</div>
                <div className="font-mono font-bold text-white tabular-nums mt-0.5">
                  {formatCurrency(evaluation.paidNow)}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                <div className="text-slate-400">Future Payments</div>
                <div className="font-mono font-bold text-slate-200 tabular-nums mt-0.5">
                  {formatCurrency(evaluation.futurePayments)}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                <div className="text-slate-400">
                  {dealType === 'LOAN' ? t(language, 'buyClause') : 'Potential Add-ons'}
                </div>
                <div className="font-mono font-bold text-slate-200 tabular-nums mt-0.5">
                  {formatCurrency(evaluation.potentialAddons)}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                <div className="text-slate-400">Budget Remaining</div>
                <div
                  className={`font-mono font-bold tabular-nums mt-0.5 ${
                    evaluation.insufficientBudget ? 'text-rose-400' : 'text-emerald-300'
                  }`}
                >
                  {formatCurrency(availableBudget - evaluation.paidNow)}
                </div>
              </div>
            </div>
          </div>

          {/* Right Selling Club & Player Card */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-4 rounded-xl border border-white/12 bg-black/35 p-5">
            <div className="space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                <PlayerAvatar
                  playerId={targetPlayer.id}
                  name={targetPlayer.name}
                  shirtNumber={targetPlayer.shirtNumber}
                  position={targetPlayer.position}
                  primaryColor={sellingClub.primaryColor}
                  secondaryColor={sellingClub.secondaryColor}
                  size={58}
                />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white truncate">{targetPlayer.name}</div>
                  <div className="text-xs text-slate-400">
                    {targetPlayer.nationality} · Age {targetPlayer.age} · {targetPlayer.position} · OVR{' '}
                    {isScouted ? targetPlayer.ovr : '??'}
                  </div>
                  <div className="text-xs font-mono text-emerald-300 mt-0.5 tabular-nums">
                    Val {isScouted ? formatCurrency(targetPlayer.marketValue) : 'Hidden'} · Wage{' '}
                    {isScouted ? `${formatCurrency(targetPlayer.weeklyWage)}/wk` : 'Hidden'}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-300">Selling Club Satisfaction</span>
                  <span className="font-mono font-bold text-white tabular-nums">
                    {evaluation.satisfaction}%
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-200 ${
                      evaluation.satisfaction >= 70
                        ? 'bg-emerald-400'
                        : evaluation.satisfaction >= 50
                        ? 'bg-amber-400'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${evaluation.satisfaction}%` }}
                  />
                </div>
                <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">
                  {feedback ?? evaluation.message}
                </p>
              </div>
            </div>

            <div className="space-y-2.5 pt-3 border-t border-white/10">
              <button
                type="button"
                disabled={evaluation.insufficientBudget}
                onClick={handleSubmit}
                className="w-full rounded-lg bg-[#00FF85] hover:bg-emerald-300 disabled:opacity-45 disabled:cursor-not-allowed text-slate-950 font-bold text-sm py-2.5 px-4 cursor-pointer"
              >
                {evaluation.insufficientBudget
                  ? t(language, 'insufficientBudget')
                  : t(language, 'submitOffer')}
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
