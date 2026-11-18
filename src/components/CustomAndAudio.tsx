import React, { useEffect, useRef, useState } from 'react';
import { COACH_NATIONALITIES, SPOTIFY_PLAYLISTS } from '../data/premierLeague2627';
import { CareerState, CoachProfile, NotificationType } from '../types/game';
import { t } from '../utils/i18n';
import { useIsMobileLandscape } from '../utils/useMobileLandscape';
import { Music2, Pause, Play, Radio, RotateCcw, Volume2, VolumeX, X } from 'lucide-react';

interface CustomSettingsViewProps {
  state: CareerState;
  onUpdateCoach: (coach: CoachProfile) => void;
  onToggleLanguage: (lang: 'en' | 'vi') => void;
  onToggleSound: (enabled: boolean) => void;
  onUpdateAutoAdvanceStops: (stops: Record<NotificationType, boolean>) => void;
  onResetCareer: () => void;
}

const ALERT_FILTER_OPTIONS: { type: NotificationType; labelKey: string }[] = [
  { type: 'TRANSFER_BID', labelKey: 'incomingOffer' },
  { type: 'LOAN_BID', labelKey: 'loanBidAlert' },
  { type: 'INJURY', labelKey: 'injuryAlert' },
  { type: 'SUSPENSION', labelKey: 'suspensionAlert' },
  { type: 'CONTRACT', labelKey: 'contractAlert' },
  { type: 'BOARD', labelKey: 'boardAlert' },
];

export const CustomSettingsView: React.FC<CustomSettingsViewProps> = ({
  state,
  onUpdateCoach,
  onToggleLanguage,
  onToggleSound,
  onUpdateAutoAdvanceStops,
  onResetCareer,
}) => {
  const lang = state.settings.language;
  const [coach, setCoach] = useState<CoachProfile>(state.coach);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const nationalityOptions = COACH_NATIONALITIES.includes(coach.nationality)
    ? COACH_NATIONALITIES
    : [coach.nationality, ...COACH_NATIONALITIES];

  const handleSaveCoach = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateCoach(coach);
    setSavedNote(lang === 'vi' ? 'Đã lưu hồ sơ HLV.' : 'Coach profile updated.');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <section className="lg:col-span-7 pitch-panel rounded-2xl p-6 space-y-4">
        <h2 className="font-display text-2xl font-bold text-white">
          {t(lang, 'headCoach')}
        </h2>

        <form onSubmit={handleSaveCoach} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-300 mb-1">{t(lang, 'firstName')}</label>
              <input
                type="text"
                value={coach.firstName}
                onChange={(e) => setCoach({ ...coach, firstName: e.target.value })}
                className="w-full rounded-lg border border-white/15 bg-black/45 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">{t(lang, 'lastName')}</label>
              <input
                type="text"
                value={coach.lastName}
                onChange={(e) => setCoach({ ...coach, lastName: e.target.value })}
                className="w-full rounded-lg border border-white/15 bg-black/45 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">{t(lang, 'nickname')}</label>
              <input
                type="text"
                value={coach.nickname}
                onChange={(e) => setCoach({ ...coach, nickname: e.target.value })}
                className="w-full rounded-lg border border-white/15 bg-black/45 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label htmlFor="custom-coach-nationality" className="block text-xs text-slate-300 mb-1">
                {t(lang, 'nationality')}
              </label>
              <select
                id="custom-coach-nationality"
                value={coach.nationality}
                onChange={(e) => setCoach({ ...coach, nationality: e.target.value })}
                className="w-full rounded-lg border border-white/15 bg-black/55 px-3 py-2 text-sm text-white"
              >
                {nationalityOptions.map((nat) => (
                  <option key={nat} value={nat}>
                    {nat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="rounded-lg bg-[#00FF85] hover:bg-emerald-300 text-slate-950 font-bold text-xs px-4 py-2 cursor-pointer"
            >
              {lang === 'vi' ? 'Lưu hồ sơ' : 'Save Profile'}
            </button>
            {savedNote && <span className="text-xs text-emerald-300">{savedNote}</span>}
          </div>
        </form>
      </section>

      <section className="lg:col-span-5 pitch-panel rounded-2xl p-6 space-y-5">
        <h2 className="font-display text-2xl font-bold text-white">
          Preferences & Career Save
        </h2>

        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-200">{t(lang, 'languageLabel')}</span>
          <div className="flex items-center gap-1 p-1 rounded-lg bg-black/45 border border-white/15">
            <button
              type="button"
              onClick={() => onToggleLanguage('en')}
              className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                lang === 'en' ? 'bg-white text-slate-950' : 'text-slate-300 hover:text-white'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => onToggleLanguage('vi')}
              className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                lang === 'vi' ? 'bg-white text-slate-950' : 'text-slate-300 hover:text-white'
              }`}
            >
              Tiếng Việt
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-200">{t(lang, 'soundFxLabel')}</span>
          <button
            type="button"
            onClick={() => onToggleSound(!state.settings.soundEnabled)}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold border cursor-pointer ${
              state.settings.soundEnabled
                ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300'
                : 'border-white/15 bg-white/5 text-slate-400'
            }`}
          >
            {state.settings.soundEnabled ? (
              <>
                <Volume2 className="w-4 h-4" /> Enabled
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4" /> Muted
              </>
            )}
          </button>
        </div>

        <div className="pt-4 border-t border-white/10 space-y-2.5">
          <div>
            <div className="text-sm font-semibold text-white">
              {t(lang, 'autoAdvanceAlertsTitle')}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {t(lang, 'autoAdvanceAlertsDesc')}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ALERT_FILTER_OPTIONS.map((opt) => {
              const stops: Record<NotificationType, boolean> = {
                TRANSFER_BID: state.settings.autoAdvanceStopOn?.TRANSFER_BID ?? true,
                LOAN_BID: state.settings.autoAdvanceStopOn?.LOAN_BID ?? true,
                INJURY: state.settings.autoAdvanceStopOn?.INJURY ?? true,
                SUSPENSION: state.settings.autoAdvanceStopOn?.SUSPENSION ?? true,
                CONTRACT: state.settings.autoAdvanceStopOn?.CONTRACT ?? true,
                BOARD: state.settings.autoAdvanceStopOn?.BOARD ?? true,
              };
              const checked = stops[opt.type];
              return (
                <label
                  key={opt.type}
                  className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-slate-200 cursor-pointer hover:bg-white/5"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      onUpdateAutoAdvanceStops({
                        ...stops,
                        [opt.type]: e.target.checked,
                      })
                    }
                    className="accent-[#00FF85] rounded cursor-pointer"
                  />
                  <span>{t(lang, opt.labelKey)}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="pt-4 border-t border-white/10 space-y-3">
          <p className="text-xs text-slate-400">
            Local browser career storage key: <span className="font-mono text-slate-300">premierLeague2627CoachV2</span>
          </p>
          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-600/85 hover:bg-rose-500 text-white font-semibold text-xs px-4 py-2.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t(lang, 'resetCareer')}
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onResetCareer}
                className="rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-4 py-2 cursor-pointer"
              >
                {t(lang, 'resetConfirm')}
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="rounded-lg border border-white/20 bg-white/10 text-white text-xs px-3.5 py-2 cursor-pointer"
              >
                {t(lang, 'cancel')}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

interface SpotifyWidgetProps {
  playlistIndex: number;
  onChangePlaylist: (idx: number) => void;
}

// Persistent FIFA / EA FC style warm synth chord loop via Web Audio API
const SYNTH_CHORDS: number[][] = [
  [220.0, 277.18, 329.63, 440.0], // A maj7 warm pad
  [196.0, 246.94, 293.66, 392.0], // G maj7
  [174.61, 220.0, 261.63, 349.23], // F maj7
  [164.81, 196.0, 246.94, 329.63], // Em7
];

export const SpotifyWidget: React.FC<SpotifyWidgetProps> = ({
  playlistIndex,
  onChangePlaylist,
}) => {
  const [open, setOpen] = useState(false);
  const [radioPlaying, setRadioPlaying] = useState(false);
  const [radioVolume, setRadioVolume] = useState(0.25);
  const isMobileLandscape = useIsMobileLandscape();

  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const timerRef = useRef<number | null>(null);
  const stepRef = useRef(0);

  const current = SPOTIFY_PLAYLISTS[playlistIndex] ?? SPOTIFY_PLAYLISTS[0];

  useEffect(() => {
    if (masterGainRef.current && audioCtxRef.current) {
      masterGainRef.current.gain.setTargetAtTime(
        radioVolume * 0.16,
        audioCtxRef.current.currentTime,
        0.08
      );
    }
  }, [radioVolume]);

  useEffect(() => {
    if (!radioPlaying) {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
        audioCtxRef.current.suspend().catch(() => {});
      }
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    if (!audioCtxRef.current) {
      const ctx = new AudioCtx();
      const gain = ctx.createGain();
      gain.gain.value = radioVolume * 0.16;
      gain.connect(ctx.destination);
      audioCtxRef.current = ctx;
      masterGainRef.current = gain;
    }

    const ctx = audioCtxRef.current;
    const master = masterGainRef.current!;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const playChordStep = () => {
      if (!audioCtxRef.current || audioCtxRef.current.state !== 'running') return;
      const now = ctx.currentTime;
      const chord = SYNTH_CHORDS[(stepRef.current + playlistIndex) % SYNTH_CHORDS.length];
      stepRef.current++;

      chord.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        osc.type = i === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, now);
        noteGain.gain.setValueAtTime(0.0001, now);
        noteGain.gain.exponentialRampToValueAtTime(0.18 / chord.length, now + 0.35);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.3);
        osc.connect(noteGain);
        noteGain.connect(master);
        osc.start(now);
        osc.stop(now + 2.35);
      });
    };

    playChordStep();
    const intervalMs = Math.max(1500, Math.round((60 / (current.tempoBpm ?? 118)) * 4 * 1000));
    timerRef.current = window.setInterval(playChordStep, intervalMs);

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [radioPlaying, playlistIndex, current.tempoBpm, radioVolume]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
    };
  }, []);

  return (
    <div className={`fixed z-40 ${isMobileLandscape ? 'bottom-2 right-2' : 'bottom-3 right-3 sm:bottom-4 sm:right-4'}`}>
      {/* Keep panel & Spotify iframe persistently mounted in DOM so audio keeps playing when minimized */}
      <div
        aria-hidden={!open}
        className={`rounded-2xl pitch-modal-shell overflow-hidden transition-opacity duration-150 ${
          isMobileLandscape ? 'w-72 max-h-[82dvh] overflow-y-auto' : 'w-80'
        } ${
          open
            ? 'opacity-100 pointer-events-auto relative'
            : 'opacity-0 pointer-events-none fixed bottom-4 right-4 -z-10'
        }`}
      >
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/10 bg-black/40">
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <Music2 className="w-4 h-4 text-[#00FF85]" />
            <span>EA FC / FIFA Soundtrack</span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Minimize soundtrack"
            className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 space-y-2.5">
          <select
            aria-label="Select FIFA / FC soundtrack playlist"
            value={playlistIndex}
            onChange={(e) => onChangePlaylist(Number(e.target.value))}
            className="w-full rounded-lg border border-white/15 bg-black/50 px-2.5 py-1.5 text-xs text-white"
          >
            {SPOTIFY_PLAYLISTS.map((pl, idx) => (
              <option key={pl.name} value={idx}>
                {pl.name}
              </option>
            ))}
          </select>

          {/* Offline Stadium Synth Radio (always audible & keeps running while minimized) */}
          <div className="rounded-lg border border-white/10 bg-black/40 px-2.5 py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Radio className={`w-3.5 h-3.5 shrink-0 ${radioPlaying ? 'text-[#00FF85]' : 'text-slate-400'}`} />
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-white truncate">FC Menu Synth Radio</div>
                <div className="text-[10px] font-mono text-slate-400 truncate">
                  {radioPlaying ? 'Playing continuously' : 'Click play · Continues minimized'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <input
                type="range"
                aria-label="Radio volume"
                min={0}
                max={1}
                step={0.05}
                value={radioVolume}
                onChange={(e) => setRadioVolume(Number(e.target.value))}
                className="w-14 accent-[#00FF85]"
              />
              <button
                type="button"
                onClick={() => setRadioPlaying((v) => !v)}
                aria-label={radioPlaying ? 'Pause radio' : 'Play radio'}
                className="p-1.5 rounded-md bg-[#00FF85] text-slate-950 hover:bg-emerald-300 cursor-pointer"
              >
                {radioPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <iframe
            title={current.name}
            src={current.embedUrl}
            width="100%"
            height="152"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            className="rounded-lg border-0"
          />
        </div>
      </div>

      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open soundtrack player"
          title="EA FC / FIFA Soundtrack"
          className={
            isMobileLandscape
              ? 'relative flex items-center justify-center w-9 h-9 rounded-full border border-white/20 bg-[#0B0F17]/85 backdrop-blur-md hover:bg-[#141B29] hover:border-[#00FF85]/50 text-white shadow-[0_8px_20px_rgba(0,0,0,0.65)] transition-colors cursor-pointer'
              : 'flex items-center gap-2 rounded-full border border-white/20 bg-[#0B0F17]/90 backdrop-blur-md hover:bg-[#141B29] hover:border-[#00FF85]/50 px-4 py-2 text-xs font-semibold text-white shadow-[0_10px_28px_rgba(0,0,0,0.65)] transition-colors cursor-pointer'
          }
        >
          <Music2 className="w-4 h-4 text-[#00FF85]" />
          {!isMobileLandscape && <span>Soundtrack</span>}
          {radioPlaying && (
            <span
              className={`w-2 h-2 rounded-full bg-[#00FF85] animate-pulse ${
                isMobileLandscape ? 'absolute top-1 right-1' : ''
              }`}
            />
          )}
        </button>
      )}
    </div>
  );
};
