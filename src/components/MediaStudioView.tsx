import React, { useMemo, useState } from 'react';
import { Award, Shield, Sparkles, Trophy } from 'lucide-react';
import { getCountryForLeague } from '../data/competitions';
import {
  CLUB_HISTORICAL_HONOURS,
  COMPETITION_THEMES,
} from '../data/premierLeague2627';
import { CareerState, Club, CompetitionId, Fixture } from '../types/game';
import { t } from '../utils/i18n';
import { useIsMobileLandscape } from '../utils/useMobileLandscape';
import { ClubBadge, PlayerAvatar } from './ClubBadge';

interface MediaStudioViewProps {
  userClub: Club;
  state: CareerState;
}

function SilverwareSvg({
  variant,
  unlocked = true,
}: {
  variant: 'league' | 'facup' | 'carabao' | 'europe' | 'shield';
  unlocked?: boolean;
}) {
  const gold = unlocked ? '#FBBF24' : '#64748B';
  const silver = unlocked ? '#E2E8F0' : '#475569';
  const accent = unlocked ? '#00FF85' : '#334155';

  if (variant === 'shield') {
    return (
      <svg viewBox="0 0 64 64" className="w-12 h-12" aria-hidden="true">
        <circle cx="32" cy="32" r="24" fill={silver} stroke={gold} strokeWidth="3" />
        <circle cx="32" cy="32" r="14" fill="none" stroke={gold} strokeWidth="2" />
        <path d="M32 16l4 10h10l-8 6 3 10-9-6-9 6 3-10-8-6h10z" fill={gold} />
      </svg>
    );
  }
  if (variant === 'europe') {
    return (
      <svg viewBox="0 0 64 64" className="w-12 h-12" aria-hidden="true">
        <path d="M18 14h28l-4 22c-2 7-7 11-10 11s-8-4-10-11z" fill={silver} stroke={accent} strokeWidth="1.5" />
        <path d="M18 18c-8 0-9 12 0 14M46 18c8 0 9 12 0 14" fill="none" stroke={silver} strokeWidth="3" strokeLinecap="round" />
        <rect x="27" y="47" width="10" height="6" fill={silver} />
        <rect x="20" y="53" width="24" height="5" rx="2" fill={gold} />
      </svg>
    );
  }
  if (variant === 'carabao') {
    return (
      <svg viewBox="0 0 64 64" className="w-12 h-12" aria-hidden="true">
        <path d="M21 15h22l-3 22c-1 6-5 9-8 9s-7-3-8-9z" fill={silver} />
        <path d="M21 18c-7 1-7 12 0 14M43 18c7 1 7 12 0 14" fill="none" stroke={silver} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="32" y1="15" x2="32" y2="46" stroke={accent} strokeWidth="2" opacity="0.7" />
        <rect x="26" y="46" width="12" height="6" fill={silver} />
        <rect x="19" y="52" width="26" height="5" rx="2" fill="#0F766E" />
      </svg>
    );
  }
  if (variant === 'facup') {
    return (
      <svg viewBox="0 0 64 64" className="w-12 h-12" aria-hidden="true">
        <path d="M22 14h20l-2 21c-1 6-5 10-8 10s-7-4-8-10z" fill={silver} />
        <path d="M22 18c-6 0-6 10 0 12M42 18c6 0 6 10 0 12" fill="none" stroke={silver} strokeWidth="2.5" strokeLinecap="round" />
        <polygon points="32,8 36,14 28,14" fill={gold} />
        <rect x="27" y="45" width="10" height="6" fill={silver} />
        <rect x="20" y="51" width="24" height="6" rx="2" fill="#881337" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 64" className="w-12 h-12" aria-hidden="true">
      <path d="M16 12h32l-4 7H20z" fill={gold} />
      <path d="M20 19h24l-3 19c-1 5-5 8-9 8s-8-3-9-8z" fill={gold} />
      <path d="M20 21c-6 0-6 10 0 12M44 21c6 0 6 10 0 12" fill="none" stroke={gold} strokeWidth="2.5" strokeLinecap="round" />
      <rect x="26" y="46" width="12" height="5" fill={gold} />
      <rect x="18" y="51" width="28" height="6" rx="2" fill="#581C87" />
    </svg>
  );
}

export const MediaStudioView: React.FC<MediaStudioViewProps> = ({ userClub, state }) => {
  const isMobileLandscape = useIsMobileLandscape();
  const [honoursTab, setHonoursTab] = useState<'career' | 'historical' | 'records'>('career');
  const lang = state.settings.language;
  const userLeagueId: CompetitionId = state.userLeagueId ?? 'PL';
  const seasonLabel = state.seasonLabel ?? '2026/27';
  const careerTrophies = state.careerTrophies ?? [];

  const historical = CLUB_HISTORICAL_HONOURS[userClub.id] ?? {
    leagueTitles: 0,
    faCups: 0,
    leagueCups: 0,
    europeanTrophies: 0,
    communityShields: 0,
  };

  const totalHistorical =
    historical.leagueTitles +
    historical.faCups +
    historical.leagueCups +
    historical.europeanTrophies +
    historical.communityShields;

  const userStandingIndex =
    (state.contextStandings[userLeagueId] ?? []).findIndex((r) => r.clubId === userClub.id) + 1;

  const seasonSummary = useMemo(() => {
    const allUserMatches: Fixture[] = [
      ...state.fixtures,
      ...Object.values(state.contextFixtures).flat(),
    ].filter(
      (f) => f && f.played && (f.homeClubId === userClub.id || f.awayClubId === userClub.id)
    );

    let wins = 0;
    let draws = 0;
    let losses = 0;
    let gf = 0;
    let ga = 0;
    let biggestWin: { margin: number; score: string; opponent: string; comp: string } | null = null;

    for (const f of allUserMatches) {
      const isHome = f.homeClubId === userClub.id;
      const scored = isHome ? (f.homeGoals ?? 0) : (f.awayGoals ?? 0);
      const conceded = isHome ? (f.awayGoals ?? 0) : (f.homeGoals ?? 0);
      gf += scored;
      ga += conceded;
      if (scored > conceded) {
        wins++;
        const margin = scored - conceded;
        if (!biggestWin || margin > biggestWin.margin) {
          biggestWin = {
            margin,
            score: `${scored}-${conceded}`,
            opponent: isHome ? f.awayClubName : f.homeClubName,
            comp: COMPETITION_THEMES[f.competitionId].shortName,
          };
        }
      } else if (scored === conceded) {
        draws++;
      } else {
        losses++;
      }
    }

    const topScorer = [...userClub.players].sort((a, b) => b.goals - a.goals || b.ovr - a.ovr)[0];
    const topAssister = [...userClub.players].sort((a, b) => b.assists - a.assists || b.ovr - a.ovr)[0];
    const topClean = [...userClub.players]
      .filter((p) => p.position === 'GK' || p.position === 'DEF')
      .sort((a, b) => b.cleanSheets - a.cleanSheets || b.ovr - a.ovr)[0];

    return {
      played: allUserMatches.length,
      wins,
      draws,
      losses,
      gf,
      ga,
      biggestWin,
      topScorer,
      topAssister,
      topClean,
    };
  }, [state.fixtures, state.contextFixtures, userClub]);

  const userCountry = getCountryForLeague(userLeagueId);
  const primaryCupId = userCountry.primaryCupId;
  const activeTargets: {
    compId: CompetitionId;
    title: string;
    variant: 'league' | 'facup' | 'carabao' | 'europe';
    statusText: string;
    unlocked: boolean;
  }[] = [
    {
      compId: userLeagueId,
      title: COMPETITION_THEMES[userLeagueId].name,
      variant: 'league',
      statusText:
        userStandingIndex > 0
          ? lang === 'vi'
            ? `Hạng hiện tại: #${userStandingIndex}`
            : `Current Rank: #${userStandingIndex}`
          : seasonLabel,
      unlocked: careerTrophies.some((tr) => tr.competitionId === userLeagueId),
    },
    {
      compId: primaryCupId,
      title: COMPETITION_THEMES[primaryCupId].name,
      variant: 'facup',
      statusText: lang === 'vi' ? 'Đang tranh tài' : `${seasonLabel} Campaign`,
      unlocked: careerTrophies.some((tr) => tr.competitionId === primaryCupId),
    },
    ...(userCountry.id === 'ESP'
      ? [
          {
            compId: 'SUPERCOPA' as CompetitionId,
            title: 'Supercopa de España',
            variant: 'carabao' as const,
            statusText: lang === 'vi' ? 'Siêu cúp Tây Ban Nha' : `${seasonLabel} Super Cup`,
            unlocked: careerTrophies.some((tr) => tr.competitionId === 'SUPERCOPA'),
          },
        ]
      : []),
    ...((state.contextFixtures.UEFASUPERCUP ?? []).some(
      (f) => f.homeClubId === userClub.id || f.awayClubId === userClub.id
    )
      ? [
          {
            compId: 'UEFASUPERCUP' as CompetitionId,
            title: 'UEFA Super Cup',
            variant: 'europe' as const,
            statusText: lang === 'vi' ? 'Siêu cúp Châu Âu' : `${seasonLabel} Super Cup`,
            unlocked: careerTrophies.some((tr) => tr.competitionId === 'UEFASUPERCUP'),
          },
        ]
      : []),
    ...(userCountry.id === 'ENG'
      ? [
          {
            compId: 'CARABAO' as CompetitionId,
            title: 'Carabao Cup',
            variant: 'carabao' as const,
            statusText: lang === 'vi' ? 'Đang tranh tài' : `${seasonLabel} Campaign`,
            unlocked: careerTrophies.some((tr) => tr.competitionId === 'CARABAO'),
          },
        ]
      : (['UCL', 'UEL', 'UECL'] as const)
          .filter((u) => (state.uefaParticipants?.[u] ?? []).includes(userClub.id))
          .map((u) => ({
            compId: u as CompetitionId,
            title: COMPETITION_THEMES[u].name,
            variant: 'europe' as const,
            statusText: lang === 'vi' ? 'Đấu trường Châu Âu' : `${seasonLabel} UEFA`,
            unlocked: careerTrophies.some((tr) => tr.competitionId === u),
          }))),
  ];

  const cabinetItems: {
    key: string;
    label: string;
    count: number;
    variant: 'league' | 'facup' | 'carabao' | 'europe' | 'shield';
  }[] = [
    {
      key: 'league',
      label: lang === 'vi' ? 'Vô địch Quốc gia' : 'Top-Flight & League Titles',
      count: historical.leagueTitles,
      variant: 'league',
    },
    {
      key: 'facup',
      label: 'FA Cup',
      count: historical.faCups,
      variant: 'facup',
    },
    {
      key: 'carabao',
      label: lang === 'vi' ? 'Cúp Liên đoàn' : 'League / Carabao Cup',
      count: historical.leagueCups,
      variant: 'carabao',
    },
    {
      key: 'europe',
      label: lang === 'vi' ? 'Cúp Châu Âu' : 'European Honours',
      count: historical.europeanTrophies,
      variant: 'europe',
    },
    {
      key: 'shield',
      label: 'Community Shield',
      count: historical.communityShields,
      variant: 'shield',
    },
  ];

  return (
    <div
      className={
        isMobileLandscape
          ? 'h-full min-h-0 flex flex-col gap-2 overflow-hidden'
          : 'space-y-5 lg:h-[calc(100vh-8.5rem)] lg:flex lg:flex-col lg:overflow-hidden'
      }
    >
      {/* Club Honours Hero Banner */}
      <section
        className={`shrink-0 relative overflow-hidden pitch-panel rounded-2xl flex flex-wrap items-center justify-between ${
          isMobileLandscape ? 'p-3 gap-3' : 'p-6 gap-6'
        }`}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            background: `radial-gradient(circle at 12% 50%, ${userClub.primaryColor}66, transparent 55%)`,
          }}
          aria-hidden="true"
        />
        <div className="flex items-center gap-4 min-w-0">
          <ClubBadge
            clubId={userClub.id}
            name={userClub.name}
            shortName={userClub.shortName}
            primaryColor={userClub.primaryColor}
            secondaryColor={userClub.secondaryColor}
            pattern={userClub.pattern}
            size={isMobileLandscape ? 44 : 68}
          />
          <div className="min-w-0">
            <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-300">
              {t(lang, 'trophyCabinet')} · {userClub.stadium}
            </div>
            <h2
              className={`font-display font-bold text-white truncate ${
                isMobileLandscape ? 'text-xl' : 'text-3xl sm:text-4xl'
              }`}
            >
              {userClub.name}
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              {COMPETITION_THEMES[userLeagueId].name} ·{' '}
              {userStandingIndex > 0 ? `Rank #${userStandingIndex}` : seasonLabel} · Head Coach{' '}
              {state.coach.firstName} {state.coach.lastName}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="grid grid-cols-2 gap-3">
            <div className={`rounded-lg border border-white/12 bg-black/40 text-center ${isMobileLandscape ? 'px-3 py-1.5' : 'px-4 py-3'}`}>
              <div className="text-[11px] text-slate-400">
                {lang === 'vi' ? 'Danh hiệu lịch sử' : 'Historical Silverware'}
              </div>
              <div className={`font-display font-extrabold text-amber-300 tabular-nums mt-0.5 ${isMobileLandscape ? 'text-xl' : 'text-3xl'}`}>
                {totalHistorical}
              </div>
            </div>
            <div className={`rounded-lg border border-emerald-400/25 bg-emerald-500/10 text-center ${isMobileLandscape ? 'px-3 py-1.5' : 'px-4 py-3'}`}>
              <div className="text-[11px] text-emerald-200">
                {lang === 'vi' ? 'Cúp sự nghiệp' : 'Career Trophies'}
              </div>
              <div className={`font-display font-extrabold text-[#00FF85] tabular-nums mt-0.5 ${isMobileLandscape ? 'text-xl' : 'text-3xl'}`}>
                {careerTrophies.length}
              </div>
            </div>
          </div>

          {isMobileLandscape && (
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-black/50 border border-white/15">
              {(
                [
                  ['career', t(lang, 'careerHonours'), <Trophy className="w-3.5 h-3.5" key="c" />],
                  ['historical', t(lang, 'historicalHonours'), <Award className="w-3.5 h-3.5" key="h" />],
                  ['records', t(lang, 'seasonRecords'), <Sparkles className="w-3.5 h-3.5" key="r" />],
                ] as const
              ).map(([id, label, icon]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setHonoursTab(id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap ${
                    honoursTab === id
                      ? 'bg-[#00FF85] text-slate-950 font-bold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {icon}
                  <span>{label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className={isMobileLandscape ? 'flex-1 min-h-0 overflow-y-auto pr-1' : 'space-y-5 lg:flex-1 lg:min-h-0 lg:overflow-y-auto pr-1'}>
      {/* Active Campaign & Career Honours */}
      {(!isMobileLandscape || honoursTab === 'career') && (
      <section className={`rounded-xl border border-white/12 bg-black/35 ${isMobileLandscape ? 'p-4' : 'p-6'} space-y-4`}>
        <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#00FF85]" />
            <h3 className="font-display text-lg font-bold text-white">
              {t(lang, 'careerHonours')}
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {careerTrophies.length > 0
              ? `${careerTrophies.length} ${lang === 'vi' ? 'Đã giành được' : 'Unlocked'}`
              : lang === 'vi'
              ? 'Chinh phục danh hiệu đầu tiên'
              : 'Target silverware this season'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {activeTargets.map((item) => (
            <div
              key={item.compId}
              className={`rounded-xl border p-4 flex items-center gap-4 ${
                item.unlocked
                  ? 'border-amber-400/45 bg-amber-500/10'
                  : 'border-white/10 bg-black/30'
              }`}
            >
              <div className="shrink-0">
                <SilverwareSvg variant={item.variant} unlocked={item.unlocked} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate">{item.title}</div>
                <div className="text-xs text-slate-300 mt-0.5">{item.statusText}</div>
                <div
                  className={`text-[11px] font-mono mt-1.5 font-semibold ${
                    item.unlocked ? 'text-amber-300' : 'text-slate-400'
                  }`}
                >
                  {item.unlocked
                    ? lang === 'vi'
                      ? `VÔ ĐỊCH ${seasonLabel}`
                      : `CHAMPION ${seasonLabel}`
                    : lang === 'vi'
                    ? 'Đang cạnh tranh'
                    : 'Contested'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
      )}

      {/* Historical Trophy Cabinet Pedestals */}
      {(!isMobileLandscape || honoursTab === 'historical') && (
      <section className={`rounded-xl border border-white/12 bg-black/35 ${isMobileLandscape ? 'p-4' : 'p-6'} space-y-4`}>
        <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-300" />
            <h3 className="font-display text-lg font-bold text-white">
              {t(lang, 'historicalHonours')}
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">{userClub.shortName} Heritage</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {cabinetItems.map((c) => (
            <div
              key={c.key}
              className="rounded-xl border border-white/10 bg-gradient-to-b from-white/5 to-black/50 p-4 flex flex-col items-center text-center"
            >
              <SilverwareSvg variant={c.variant} unlocked={c.count > 0} />
              <div className="font-display text-3xl font-extrabold text-white tabular-nums mt-2">
                {c.count}
              </div>
              <div className="text-xs text-slate-300 mt-1">{c.label}</div>
            </div>
          ))}
        </div>
      </section>
      )}

      {/* Season Records & Milestones */}
      {(!isMobileLandscape || honoursTab === 'records') && (
      <section className={`rounded-xl border border-white/12 bg-black/35 ${isMobileLandscape ? 'p-4' : 'p-6'} space-y-4`}>
        <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-300" />
            <h3 className="font-display text-lg font-bold text-white">
              {t(lang, 'seasonRecords')}
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">{seasonLabel} All Competitions</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="rounded-lg border border-white/10 bg-black/30 p-3">
            <div className="text-slate-400">{lang === 'vi' ? 'Trận đã đấu' : 'Matches Played'}</div>
            <div className="font-mono text-2xl font-extrabold text-white tabular-nums mt-1">
              {seasonSummary.played}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/30 p-3">
            <div className="text-slate-400">{lang === 'vi' ? 'Thắng / Hoà / Thua' : 'W / D / L Record'}</div>
            <div className="font-mono text-xl font-extrabold text-[#00FF85] tabular-nums mt-1">
              {seasonSummary.wins} - {seasonSummary.draws} - {seasonSummary.losses}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/30 p-3">
            <div className="text-slate-400">{lang === 'vi' ? 'Bàn thắng / Bàn thua' : 'Goals For / Against'}</div>
            <div className="font-mono text-xl font-extrabold text-white tabular-nums mt-1">
              {seasonSummary.gf} / {seasonSummary.ga}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/30 p-3">
            <div className="text-slate-400">{lang === 'vi' ? 'Chiến thắng đậm nhất' : 'Biggest Win'}</div>
            <div className="font-mono text-sm font-bold text-amber-300 mt-1 truncate">
              {seasonSummary.biggestWin
                ? `${seasonSummary.biggestWin.score} vs ${seasonSummary.biggestWin.opponent}`
                : '—'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
          {[
            {
              title: lang === 'vi' ? 'Chân sút số 1 mùa giải' : 'Season Top Scorer',
              player: seasonSummary.topScorer,
              statVal: seasonSummary.topScorer ? `${seasonSummary.topScorer.goals} G` : '0 G',
            },
            {
              title: lang === 'vi' ? 'Vua kiến tạo CLB' : 'Club Assist Leader',
              player: seasonSummary.topAssister,
              statVal: seasonSummary.topAssister ? `${seasonSummary.topAssister.assists} A` : '0 A',
            },
            {
              title: lang === 'vi' ? 'Giữ sạch lưới nhiều nhất' : 'Clean Sheet Leader',
              player: seasonSummary.topClean,
              statVal: seasonSummary.topClean ? `${seasonSummary.topClean.cleanSheets} CS` : '0 CS',
            },
          ].map((card) => (
            <div
              key={card.title}
              className="rounded-xl border border-white/10 bg-black/30 p-3.5 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                {card.player ? (
                  <PlayerAvatar
                    playerId={card.player.id}
                    name={card.player.name}
                    shirtNumber={card.player.shirtNumber}
                    position={card.player.position}
                    primaryColor={userClub.primaryColor}
                    secondaryColor={userClub.secondaryColor}
                    size={40}
                  />
                ) : (
                  <Shield className="w-8 h-8 text-slate-500" />
                )}
                <div className="min-w-0">
                  <div className="text-[11px] text-slate-400">{card.title}</div>
                  <div className="text-sm font-bold text-white truncate">
                    {card.player?.name ?? '—'}
                  </div>
                </div>
              </div>
              <div className="font-mono text-lg font-extrabold text-[#00FF85] tabular-nums shrink-0">
                {card.statVal}
              </div>
            </div>
          ))}
        </div>
      </section>
      )}
      </div>
    </div>
  );
};
