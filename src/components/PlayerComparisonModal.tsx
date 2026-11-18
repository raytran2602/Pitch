import React from 'react';
import { ModalPortal } from './ModalPortal';
import { ArrowLeftRight, X } from 'lucide-react';
import { Club, Language, Player } from '../types/game';
import { normalizePlayer } from '../utils/playerAttributes';
import { PlayerAvatar } from './ClubBadge';
import { FifaAttributesGrid } from './FifaAttributesGrid';

interface PlayerComparisonModalProps {
  club: Club;
  playerA: Player;
  playerB: Player;
  language: Language;
  onSwapPlayers?: (idA: string, idB: string) => void;
  onClose: () => void;
}

export const PlayerComparisonModal: React.FC<PlayerComparisonModalProps> = ({
  club,
  playerA: rawA,
  playerB: rawB,
  language,
  onSwapPlayers,
  onClose,
}) => {
  const playerA = normalizePlayer(rawA);
  const playerB = normalizePlayer(rawB);
  const isVi = language === 'vi';

  const isStarterA = club.startingIds.includes(playerA.id);
  const isStarterB = club.startingIds.includes(playerB.id);

  return (
    <ModalPortal>
    <div
      className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Player Comparison"
    >
      <div className="animate-modal-pop w-full max-w-5xl rounded-2xl pitch-modal-shell text-slate-100 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-white/10 bg-black/40">
          <div>
            <h3 className="font-display text-2xl font-bold text-white">
              {isVi ? 'So sánh cầu thủ (FIFA / FC Attributes)' : 'Head-to-Head Player Comparison'}
            </h3>
            <p className="text-xs text-slate-400">
              {playerA.name} vs {playerB.name} · {club.name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onSwapPlayers && (
              <button
                type="button"
                onClick={() => {
                  onSwapPlayers(playerA.id, playerB.id);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#00FF85] hover:bg-emerald-300 text-slate-950 font-bold text-xs px-3.5 py-2 cursor-pointer"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                {isVi ? 'Đổi chỗ / Thay người' : 'Swap Positions'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Player Comparison"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Two Player Identity Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { p: playerA, starter: isStarterA, label: isVi ? 'Cầu thủ 1' : 'Player A', accent: 'border-[#00FF85]/50' },
              { p: playerB, starter: isStarterB, label: isVi ? 'Cầu thủ 2' : 'Player B', accent: 'border-sky-400/50' },
            ].map(({ p, starter, label, accent }) => (
              <div
                key={p.id}
                className={`rounded-xl border ${accent} bg-black/35 p-4 flex items-center justify-between gap-4`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <PlayerAvatar
                    playerId={p.id}
                    name={p.name}
                    shirtNumber={p.shirtNumber}
                    position={p.position}
                    primaryColor={club.primaryColor}
                    secondaryColor={club.secondaryColor}
                    size={76}
                  />
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      {label} · {starter ? (isVi ? 'Đá chính' : 'Starter') : (isVi ? 'Dự bị' : 'Bench')}
                    </div>
                    <div className="font-display text-2xl font-bold text-white truncate">
                      {p.name}
                    </div>
                    <div className="text-xs text-slate-300 mt-0.5">
                      {p.position} · #{p.shirtNumber} · {p.role}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 mt-1">
                      Age {p.age} · {p.heightCm}cm · {p.preferredFoot} · Fit{' '}
                      <span className="text-emerald-300 font-bold">{p.fitness}%</span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-display text-4xl font-extrabold text-[#00FF85] tabular-nums leading-none">
                    {p.ovr}
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-1">
                    POT {p.potential}
                  </div>
                  <div className="text-[11px] font-mono text-slate-300 mt-1">
                    {p.goals}G · {p.assists}A
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Full Side-by-Side Detailed FIFA / FC Attributes */}
          <FifaAttributesGrid player={playerA} compareTo={playerB} />
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};
