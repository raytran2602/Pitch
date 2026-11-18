import React, { useEffect, useMemo, useState } from 'react';
import { ModalPortal } from './ModalPortal';
import { Club, IncomingTransferBid, Language, Player, TransferOffer } from '../types/game';
import { formatCurrency, t } from '../utils/i18n';
import { ClubBadge, PlayerAvatar } from './ClubBadge';
import { FormattedNumberInput } from './FormattedNumberInput';
import { Check, Handshake, X, XCircle } from 'lucide-react';

interface IncomingBidModalProps {
  bid: IncomingTransferBid;
  player: Player | null;
  buyingClub: Club | null;
  userClub: Club;
  language: Language;
  onAcceptBid: (bidId: string) => void;
  onCounterBid: (
    bidId: string,
    counterOffer: TransferOffer
  ) => {
    outcome: 'ACCEPTED' | 'COUNTERED' | 'WALKED';
    message: string;
  };
  onRejectBid: (bidId: string) => void;
  onClose: () => void;
}

export const IncomingBidModal: React.FC<IncomingBidModalProps> = ({
  bid,
  player,
  buyingClub,
  userClub,
  language,
  onAcceptBid,
  onCounterBid,
  onRejectBid,
  onClose,
}) => {
  const isLoanBid = bid.bidType === 'LOAN' || bid.offeredTerms?.dealType === 'LOAN';
  const initialTerms: TransferOffer = bid.offeredTerms ?? {
    dealType: isLoanBid ? 'LOAN' : 'PERMANENT',
    startDate: 'Immediate',
    transferFee: isLoanBid
      ? bid.offeredFee
      : Math.round((bid.offeredFee * 1.1) / 100_000) * 100_000,
    installments: 0,
    upfrontPct: 100,
    installmentSeasons: 0,
    exchangePlayerId: null,
    bonusAfterAppearances: 0,
    sellOnShare: bid.sellOnShare ?? 0,
    loanFee: isLoanBid ? bid.offeredFee : 0,
    loanWageSplitPct: bid.loanWageSplitPct ?? 60,
    loanDurationSeasons: 1,
    buyOptionFee: 0,
  };

  const deriveInitialUpfront = (terms: TransferOffer) => {
    if (typeof terms.upfrontPct === 'number') return terms.upfrontPct;
    if (terms.installments === 12) return 55;
    if (terms.installments === 24) return 40;
    if (terms.installments === 36) return 30;
    return 100;
  };
  const deriveInitialSeasons = (terms: TransferOffer) => {
    if (typeof terms.installmentSeasons === 'number') return terms.installmentSeasons;
    if (terms.installments >= 36) return 3;
    if (terms.installments >= 24) return 2;
    if (terms.installments >= 12) return 1;
    return 0;
  };

  const [startDate, setStartDate] = useState<'Immediate' | 'Next Window'>(initialTerms.startDate);
  const [transferFee, setTransferFee] = useState<number>(initialTerms.transferFee);
  const [upfrontPct, setUpfrontPct] = useState<number>(deriveInitialUpfront(initialTerms));
  const [installmentSeasons, setInstallmentSeasons] = useState<number>(deriveInitialSeasons(initialTerms));
  const [exchangePlayerId, setExchangePlayerId] = useState<string>(initialTerms.exchangePlayerId ?? '');
  const [bonusAfterAppearances, setBonusAfterAppearances] = useState<number>(
    initialTerms.bonusAfterAppearances
  );
  const [sellOnShare, setSellOnShare] = useState<number>(initialTerms.sellOnShare);

  // Loan counter-offer state
  const [loanDurationSeasons, setLoanDurationSeasons] = useState<0.5 | 1 | 2>(
    initialTerms.loanDurationSeasons ?? 1
  );
  const [loanWageSplitPct, setLoanWageSplitPct] = useState<number>(
    initialTerms.loanWageSplitPct ?? bid.loanWageSplitPct ?? 60
  );
  const [loanFee, setLoanFee] = useState<number>(initialTerms.loanFee ?? bid.offeredFee);
  const [buyOptionFee, setBuyOptionFee] = useState<number>(initialTerms.buyOptionFee ?? 0);

  const [feedback, setFeedback] = useState<string>(bid.lastMessage);

  useEffect(() => {
    const loanFlag = bid.bidType === 'LOAN' || bid.offeredTerms?.dealType === 'LOAN';
    const terms: TransferOffer = bid.offeredTerms ?? {
      dealType: loanFlag ? 'LOAN' : 'PERMANENT',
      startDate: 'Immediate',
      transferFee: bid.offeredFee,
      installments: 0,
      upfrontPct: 100,
      installmentSeasons: 0,
      exchangePlayerId: null,
      bonusAfterAppearances: 0,
      sellOnShare: bid.sellOnShare ?? 0,
      loanFee: loanFlag ? bid.offeredFee : 0,
      loanWageSplitPct: bid.loanWageSplitPct ?? 60,
      loanDurationSeasons: 1,
      buyOptionFee: 0,
    };
    setStartDate(terms.startDate);
    setTransferFee(terms.transferFee);
    setUpfrontPct(deriveInitialUpfront(terms));
    setInstallmentSeasons(deriveInitialSeasons(terms));
    setExchangePlayerId(terms.exchangePlayerId ?? '');
    setBonusAfterAppearances(terms.bonusAfterAppearances);
    setSellOnShare(terms.sellOnShare);
    setLoanDurationSeasons(terms.loanDurationSeasons ?? 1);
    setLoanWageSplitPct(terms.loanWageSplitPct ?? bid.loanWageSplitPct ?? 60);
    setLoanFee(terms.loanFee ?? bid.offeredFee);
    setBuyOptionFee(terms.buyOptionFee ?? 0);
    setFeedback(bid.lastMessage);
  }, [bid.id, bid.bidType, bid.offeredFee, bid.sellOnShare, bid.loanWageSplitPct, bid.offeredTerms, bid.lastMessage]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const exchangeCandidates = useMemo(() => {
    if (!buyingClub) return [] as Player[];
    return buyingClub.players.filter((p) => !p.loanInfo);
  }, [buyingClub]);

  const requestedExchange = useMemo(
    () => exchangeCandidates.find((p) => p.id === exchangePlayerId) ?? null,
    [exchangeCandidates, exchangePlayerId]
  );

  const counterOffer: TransferOffer = useMemo(() => {
    if (isLoanBid) {
      return {
        dealType: 'LOAN',
        startDate: 'Immediate',
        transferFee: loanFee,
        installments: 0,
        upfrontPct: 100,
        installmentSeasons: 0,
        exchangePlayerId: null,
        bonusAfterAppearances: 0,
        sellOnShare: 0,
        loanFee,
        loanWageSplitPct,
        loanDurationSeasons,
        buyOptionFee,
      };
    }
    const seasons = upfrontPct >= 100 ? 0 : Math.max(1, installmentSeasons);
    return {
      dealType: 'PERMANENT',
      startDate,
      transferFee,
      installments: seasons * 12,
      upfrontPct,
      installmentSeasons: seasons,
      exchangePlayerId: exchangePlayerId || null,
      bonusAfterAppearances,
      sellOnShare,
    };
  }, [
    isLoanBid,
    startDate,
    transferFee,
    upfrontPct,
    installmentSeasons,
    exchangePlayerId,
    bonusAfterAppearances,
    sellOnShare,
    loanFee,
    loanWageSplitPct,
    loanDurationSeasons,
    buyOptionFee,
  ]);

  const previewPaidNow = isLoanBid
    ? loanFee
    : Math.round((transferFee * Math.max(0, Math.min(100, upfrontPct))) / 100);
  const previewFuturePayments = isLoanBid ? 0 : Math.max(0, transferFee - previewPaidNow);

  const estimatedSatisfaction = useMemo(() => {
    if (isLoanBid) {
      const prevSplit = bid.offeredTerms?.loanWageSplitPct ?? bid.loanWageSplitPct ?? 60;
      const splitPenalty = Math.max(0, loanWageSplitPct - prevSplit) * 28_000;
      const effectiveDemand = loanFee + splitPenalty;
      const ratio = effectiveDemand / Math.max(1, bid.buyerMaxFee);
      return Math.max(8, Math.min(100, Math.round(108 - ratio * 42)));
    }
    const exchangeCost = requestedExchange ? Math.round(requestedExchange.marketValue * 0.9) : 0;
    const totalPackage =
      transferFee + exchangeCost + Math.round(bonusAfterAppearances * 0.55);
    const ratio = totalPackage / Math.max(1, bid.buyerMaxFee);
    return Math.max(8, Math.min(100, Math.round(108 - ratio * 42)));
  }, [
    isLoanBid,
    loanFee,
    loanWageSplitPct,
    bid.offeredTerms?.loanWageSplitPct,
    bid.loanWageSplitPct,
    transferFee,
    requestedExchange,
    bonusAfterAppearances,
    bid.buyerMaxFee,
  ]);

  const isPending = bid.status === 'PENDING' && Boolean(player);

  const handleSubmitCounter = () => {
    if (!isPending) return;
    const res = onCounterBid(bid.id, counterOffer);
    setFeedback(res.message);
  };

  return (
    <ModalPortal>
    <div
      className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Incoming Bid for ${bid.playerName}`}
    >
      <div className="animate-modal-pop w-full max-w-5xl rounded-2xl pitch-modal-shell text-slate-100 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/30">
          <div className="flex items-center gap-3 min-w-0">
            <ClubBadge
              clubId={buyingClub?.id ?? bid.buyingClubId}
              name={bid.buyingClubName}
              shortName={bid.buyingClubShortName}
              primaryColor={buyingClub?.primaryColor ?? '#334155'}
              secondaryColor={buyingClub?.secondaryColor ?? '#94a3b8'}
              pattern={buyingClub?.pattern}
              size={38}
            />
            <div className="min-w-0">
              <h3 className="font-display text-2xl font-bold text-white truncate">
                {isLoanBid ? t(language, 'loanBidAlert') : t(language, 'incomingOffer')} · {bid.playerName}
              </h3>
              <p className="text-xs text-slate-400">
                {bid.buyingClubName} (Head Coach: {buyingClub?.managerName ?? 'Director'}) · Round #{bid.roundCount} ·{' '}
                {bid.dateIso}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close transfer bid modal"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto">
          {/* Left Counter-Offer Builder */}
          <div className="lg:col-span-7 space-y-4">
            {isLoanBid ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">{t(language, 'loanDuration')}</label>
                  <select
                    disabled={!isPending}
                    value={loanDurationSeasons}
                    onChange={(e) => setLoanDurationSeasons(Number(e.target.value) as 0.5 | 1 | 2)}
                    className="w-full rounded-lg border border-white/15 bg-black/45 px-3 py-2 text-sm text-white disabled:opacity-60"
                  >
                    <option value={0.5}>{t(language, 'halfSeasonLoan')}</option>
                    <option value={1}>{t(language, 'oneSeason')}</option>
                    <option value={2}>{t(language, 'twoSeasons')}</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                    <label>{t(language, 'wageSplit')}</label>
                    <span className="font-mono font-bold text-[#00FF85]">{loanWageSplitPct}%</span>
                  </div>
                  <input
                    type="range"
                    disabled={!isPending}
                    min={0}
                    max={100}
                    step={5}
                    value={loanWageSplitPct}
                    onChange={(e) => setLoanWageSplitPct(Number(e.target.value))}
                    className="w-full accent-[#00FF85]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">{t(language, 'loanFeeLabel')}</label>
                  <FormattedNumberInput
                    disabled={!isPending}
                    step={100000}
                    min={0}
                    value={loanFee}
                    onChange={setLoanFee}
                    className="w-full rounded-lg border border-white/15 bg-black/45 px-3 py-2 text-sm font-mono text-white disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">{t(language, 'buyClause')} (0 = None)</label>
                  <FormattedNumberInput
                    disabled={!isPending}
                    step={500000}
                    min={0}
                    value={buyOptionFee}
                    onChange={setBuyOptionFee}
                    className="w-full rounded-lg border border-white/15 bg-black/45 px-3 py-2 text-sm font-mono text-white disabled:opacity-60"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Start Date</label>
                  <select
                    disabled={!isPending}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value as 'Immediate' | 'Next Window')}
                    className="w-full rounded-lg border border-white/15 bg-black/45 px-3 py-2 text-sm text-white disabled:opacity-60"
                  >
                    <option value="Immediate">Immediate</option>
                    <option value="Next Window">Next Window</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-slate-300">{t(language, 'counterOffer')}</label>
                    <div className="flex items-center gap-1">
                      {[1.05, 1.15, 1.25].map((mult) => (
                        <button
                          key={mult}
                          type="button"
                          disabled={!isPending}
                          onClick={() =>
                            setTransferFee(Math.round((bid.offeredFee * mult) / 100_000) * 100_000)
                          }
                          className="px-1.5 py-0.5 rounded border border-white/15 bg-white/6 hover:bg-white/15 text-[10px] font-mono text-emerald-300 cursor-pointer"
                        >
                          +{Math.round((mult - 1) * 100)}%
                        </button>
                      ))}
                    </div>
                  </div>
                  <FormattedNumberInput
                    disabled={!isPending}
                    step={500000}
                    min={0}
                    value={transferFee}
                    onChange={setTransferFee}
                    className="w-full rounded-lg border border-white/15 bg-black/45 px-3 py-2 text-sm font-mono text-white disabled:opacity-60"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                    <label>{t(language, 'upfrontPctLabel')}</label>
                    <span className="font-mono text-emerald-300">
                      {upfrontPct}% / {100 - upfrontPct}% {t(language, 'installmentPctLabel')}
                    </span>
                  </div>
                  <input
                    type="range"
                    disabled={!isPending}
                    min={20}
                    max={100}
                    step={5}
                    value={upfrontPct}
                    onChange={(e) => {
                      const pct = Number(e.target.value);
                      setUpfrontPct(pct);
                      if (pct < 100 && installmentSeasons === 0) setInstallmentSeasons(2);
                      if (pct === 100) setInstallmentSeasons(0);
                    }}
                    className="w-full accent-[#00FF85]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">{t(language, 'installmentSeasonsLabel')}</label>
                  <select
                    disabled={!isPending || upfrontPct >= 100}
                    value={upfrontPct >= 100 ? 0 : installmentSeasons}
                    onChange={(e) => setInstallmentSeasons(Number(e.target.value))}
                    className="w-full rounded-lg border border-white/15 bg-black/45 px-3 py-2 text-sm text-white disabled:opacity-50"
                  >
                    <option value={0}>0 (100% Upfront)</option>
                    <option value={1}>1 {t(language, 'seasonUnit')}</option>
                    <option value={2}>2 {t(language, 'seasonUnit')}</option>
                    <option value={3}>3 {t(language, 'seasonUnit')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Exchange Player (Buyer Full Squad)</label>
                  <select
                    disabled={!isPending}
                    value={exchangePlayerId}
                    onChange={(e) => setExchangePlayerId(e.target.value)}
                    className="w-full rounded-lg border border-white/15 bg-black/45 px-3 py-2 text-sm text-white disabled:opacity-60"
                  >
                    <option value="">None</option>
                    {exchangeCandidates.map((p) => {
                      const tag = buyingClub?.startingIds.includes(p.id)
                        ? 'XI'
                        : buyingClub?.benchIds.includes(p.id)
                        ? 'SUB'
                        : 'RES';
                      return (
                        <option key={p.id} value={p.id}>
                          [{tag}] {p.name} ({p.detailedPosition ?? p.position} · {formatCurrency(p.marketValue)})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Bonus After Appearances</label>
                  <FormattedNumberInput
                    disabled={!isPending}
                    step={250000}
                    min={0}
                    value={bonusAfterAppearances}
                    onChange={setBonusAfterAppearances}
                    className="w-full rounded-lg border border-white/15 bg-black/45 px-3 py-2 text-sm font-mono text-white disabled:opacity-60"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-300 mb-1">{t(language, 'sellOnClause')} (%)</label>
                  <input
                    type="number"
                    disabled={!isPending}
                    min={0}
                    max={25}
                    value={sellOnShare}
                    onChange={(e) => setSellOnShare(Math.min(25, Math.max(0, Number(e.target.value) || 0)))}
                    className="w-full rounded-lg border border-white/15 bg-black/45 px-3 py-2 text-sm font-mono text-white disabled:opacity-60"
                  />
                </div>
              </div>
            )}

            {/* Financial Terms Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/10 text-xs">
              <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                <div className="text-slate-400">{t(language, 'paidNow')}</div>
                <div className="font-mono font-bold text-[#00FF85] tabular-nums mt-0.5">
                  {formatCurrency(previewPaidNow)}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                <div className="text-slate-400">{t(language, 'futurePayments')}</div>
                <div className="font-mono font-bold text-slate-200 tabular-nums mt-0.5">
                  {formatCurrency(previewFuturePayments)}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                <div className="text-slate-400">
                  {isLoanBid ? t(language, 'buyClause') : t(language, 'potentialAddons')}
                </div>
                <div className="font-mono font-bold text-slate-200 tabular-nums mt-0.5">
                  {formatCurrency(isLoanBid ? buyOptionFee : bonusAfterAppearances)}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                <div className="text-slate-400">{t(language, 'buyerPatience')}</div>
                <div
                  className={`font-mono font-bold tabular-nums mt-0.5 ${
                    bid.patience >= 60
                      ? 'text-emerald-300'
                      : bid.patience >= 30
                      ? 'text-amber-300'
                      : 'text-rose-400'
                  }`}
                >
                  {bid.patience}%
                </div>
              </div>
            </div>
          </div>

          {/* Right Player & Buying Club Summary */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-4 rounded-xl border border-white/12 bg-black/35 p-5">
            <div className="space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                {player && (
                  <PlayerAvatar
                    playerId={player.id}
                    name={player.name}
                    shirtNumber={player.shirtNumber}
                    position={player.position}
                    primaryColor={userClub.primaryColor}
                    secondaryColor={userClub.secondaryColor}
                    size={58}
                  />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white truncate">{bid.playerName}</div>
                  <div className="text-xs text-slate-400">
                    {player
                      ? `${player.detailedPosition ?? player.position} · Age ${player.age} · OVR ${player.ovr}`
                      : 'Player status updated'}
                  </div>
                  {player && (
                    <div className="text-xs font-mono text-emerald-300 mt-0.5 tabular-nums">
                      Val {formatCurrency(player.marketValue)} · Wage {formatCurrency(player.weeklyWage)}/wk
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-[#00FF85]/35 bg-[#00FF85]/10 p-3.5">
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-300">
                  {isLoanBid ? t(language, 'loanFeeLabel') : t(language, 'offeredFee')}
                </div>
                <div className="font-mono text-2xl font-extrabold text-[#00FF85] tabular-nums mt-0.5">
                  {formatCurrency(bid.offeredFee)}
                </div>
                <div className="text-[11px] font-mono text-emerald-200 mt-0.5">
                  {isLoanBid ? (
                    <>
                      {(bid.offeredTerms?.loanDurationSeasons ?? 1) === 0.5
                        ? t(language, 'halfSeasonLoan')
                        : (bid.offeredTerms?.loanDurationSeasons ?? 1) === 2
                        ? t(language, 'twoSeasons')
                        : t(language, 'oneSeason')}
                      {` · ${bid.offeredTerms?.loanWageSplitPct ?? bid.loanWageSplitPct ?? 60}% wages`}
                      {(bid.offeredTerms?.buyOptionFee ?? 0) > 0 &&
                        ` · Buy option ${formatCurrency(bid.offeredTerms!.buyOptionFee!)}`}
                    </>
                  ) : (
                    <>
                      {typeof bid.offeredTerms?.upfrontPct === 'number'
                        ? `${bid.offeredTerms.upfrontPct}% upfront`
                        : bid.offeredTerms?.installments
                        ? `${bid.offeredTerms.installments}m installments`
                        : 'Upfront payment'}
                      {bid.sellOnShare > 0 ? ` · +${bid.sellOnShare}% sell-on` : ''}
                      {bid.offeredTerms?.bonusAfterAppearances
                        ? ` · +${formatCurrency(bid.offeredTerms.bonusAfterAppearances)} bonus`
                        : ''}
                    </>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-300">Buying Club Satisfaction</span>
                  <span className="font-mono font-bold text-white tabular-nums">
                    {estimatedSatisfaction}%
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-200 ${
                      estimatedSatisfaction >= 70
                        ? 'bg-emerald-400'
                        : estimatedSatisfaction >= 45
                        ? 'bg-amber-400'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${estimatedSatisfaction}%` }}
                  />
                </div>
                <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">{feedback}</p>
              </div>
            </div>

            <div className="space-y-2 pt-3 border-t border-white/10">
              {isPending ? (
                <>
                  <button
                    type="button"
                    onClick={() => onAcceptBid(bid.id)}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#00FF85] hover:bg-emerald-300 text-slate-950 font-bold text-sm py-2.5 px-4 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    {t(language, 'acceptOffer')} ({formatCurrency(bid.offeredFee)})
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleSubmitCounter}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-400/50 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 font-bold text-xs py-2.5 px-3 cursor-pointer"
                    >
                      <Handshake className="w-3.5 h-3.5" />
                      {t(language, 'submitCounter')}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRejectBid(bid.id)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600/85 hover:bg-rose-500 text-white font-semibold text-xs py-2.5 px-3 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      {t(language, 'rejectOffer')}
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full rounded-lg bg-white/12 hover:bg-white/20 text-white font-semibold text-sm py-2.5 px-4 cursor-pointer"
                >
                  {language === 'vi' ? 'Đóng' : 'Close'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};
