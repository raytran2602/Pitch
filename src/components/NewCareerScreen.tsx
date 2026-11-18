import React, { useMemo, useState } from 'react';
import { Search, ShieldCheck, Sparkles } from 'lucide-react';
import { COUNTRY_BY_ID, COUNTRY_CATALOG, LEAGUE_CATALOG } from '../data/competitions';
import { buildWorldClubsForLeague } from '../data/world/worldRegistry';
import {
  COACH_NATIONALITIES,
  COMPETITION_THEMES,
} from '../data/premierLeague2627';
import { CoachProfile, CompetitionId, CountryId, DomesticLeagueId, Language } from '../types/game';
import { formatCurrency, t } from '../utils/i18n';
import { ClubBadge } from './ClubBadge';
import stadiumBg from '../assets/images/stadium_floodlights_1794673279678.jpg';

interface NewCareerScreenProps {
  language: Language;
  onToggleLanguage: (lang: Language) => void;
  onStartCareer: (coach: CoachProfile, clubId: string, leagueId: CompetitionId) => void;
}

export const NewCareerScreen: React.FC<NewCareerScreenProps> = ({
  language,
  onToggleLanguage,
  onStartCareer,
}) => {
  const [firstName, setFirstName] = useState('Alex');
  const [lastName, setLastName] = useState('Mercer');
  const [nickname, setNickname] = useState('Gaffer');
  const [nationality, setNationality] = useState('England');
  const [dob, setDob] = useState('1988-06-15');
  const [selectedCountry, setSelectedCountry] = useState<CountryId>('ENG');
  const [selectedLeague, setSelectedLeague] = useState<DomesticLeagueId>('PL');
  const [selectedClubId, setSelectedClubId] = useState<string>('ars');
  const [clubQuery, setClubQuery] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const countryMeta = COUNTRY_BY_ID[selectedCountry] ?? COUNTRY_CATALOG[0];
  const countryLeagues = countryMeta.leagues;

  const leagueClubs = useMemo(
    () => buildWorldClubsForLeague(selectedLeague),
    [selectedLeague]
  );

  const filteredClubs = useMemo(() => {
    const q = clubQuery.trim().toLowerCase();
    if (!q) return leagueClubs;
    return leagueClubs.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.shortName.toLowerCase().includes(q) ||
        c.stadium.toLowerCase().includes(q)
    );
  }, [leagueClubs, clubQuery]);

  const selectedClub = leagueClubs.find((c) => c.id === selectedClubId) ?? leagueClubs[0];
  const avgOvr = Math.round(
    selectedClub.players.slice(0, 11).reduce((acc, p) => acc + p.ovr, 0) / 11
  );

  const handleSelectCountry = (countryId: CountryId) => {
    setSelectedCountry(countryId);
    setClubQuery('');
    const meta = COUNTRY_BY_ID[countryId];
    const firstLeague = meta.leagues[0];
    setSelectedLeague(firstLeague);
    const nextClubs = buildWorldClubsForLeague(firstLeague);
    if (nextClubs[0]) {
      setSelectedClubId(nextClubs[0].id);
    }
  };

  const handleSelectLeague = (leagueId: DomesticLeagueId) => {
    setSelectedLeague(leagueId);
    setClubQuery('');
    const nextClubs = buildWorldClubsForLeague(leagueId);
    if (nextClubs[0]) {
      setSelectedClubId(nextClubs[0].id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError(
        language === 'vi'
          ? 'Vui lòng nhập đầy đủ tên và họ HLV.'
          : 'Please enter both first name and last name.'
      );
      return;
    }
    setError(null);
    onStartCareer(
      {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        nickname: nickname.trim() || firstName.trim(),
        nationality: nationality || 'England',
        dob: dob || '1988-06-15',
      },
      selectedClub.id,
      selectedLeague
    );
  };

  const activeTheme = COMPETITION_THEMES[selectedLeague];

  return (
    <div className="safe-area-x min-h-dvh bg-[#090C12] pitch-stadium-ambient text-slate-100 relative overflow-x-hidden">
      {/* Hero Backdrop */}
      <div className="relative min-h-[126px] sm:h-64 lg:landscape:h-64 overflow-hidden border-b border-white/[0.08]">
        <img
          src={stadiumBg}
          alt="English football stadium under floodlights"
          width={1920}
          height={1080}
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover object-center opacity-50 scale-[1.02]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#090C12] via-[#090C12]/78 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#090C12] via-transparent to-black/45" />
        <div
          className="absolute inset-0 opacity-25 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 60% 70% at 75% 25%, ${activeTheme.accentColor}33, transparent 70%)`,
          }}
        />
        <div className="relative z-10 max-w-6xl mx-auto h-full px-4 sm:px-6 py-4 sm:py-6 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                PITCH
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.07] border border-white/15 text-[11px] font-mono font-semibold text-[#00FF85] backdrop-blur-md">
                <Sparkles className="w-3 h-3" />
                {t(language, 'seasonLabel')}
              </span>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-black/55 border border-white/15 backdrop-blur-md">
              <button
                type="button"
                onClick={() => onToggleLanguage('en')}
                className={`px-3.5 py-1.5 min-h-[30px] text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  language === 'en' ? 'bg-[#00FF85] text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => onToggleLanguage('vi')}
                className={`px-3.5 py-1.5 min-h-[30px] text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  language === 'vi' ? 'bg-[#00FF85] text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
                }`}
              >
                VI
              </button>
            </div>
          </div>

          <div className="max-w-2xl">
            <h1 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-white uppercase leading-none">
              {t(language, 'newCareerTitle')}
            </h1>
            <p className="mt-2 text-xs sm:text-base text-slate-300 leading-relaxed">
              {language === 'vi'
                ? 'Chọn giải đấu từ Premier League đến các giải hàng đầu thế giới, dẫn dắt CLB qua mùa giải 2026/27.'
                : 'Take charge of any club across England’s four divisions and global leagues for the 2026/27 season.'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Setup Form & League/Club Picker */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-5 sm:gap-7 items-start">
          {/* Coach License Form */}
          <section className="md:col-span-5 pitch-panel rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-5 relative overflow-hidden">
            <div
              className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ backgroundColor: activeTheme.accentColor }}
            />
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-2xl font-bold text-white tracking-tight">
                  {t(language, 'headCoach')}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  {activeTheme.name} · 2026/27 Managerial License
                </p>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.05] border border-white/10 text-[10px] font-mono text-emerald-300 uppercase">
                <ShieldCheck className="w-3.5 h-3.5" />
                Pro License
              </span>
            </div>

            {error && (
              <div className="rounded-xl border border-rose-500/50 bg-rose-950/60 px-3.5 py-2.5 text-xs text-rose-200">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label htmlFor="coach-first-name" className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  {t(language, 'firstName')}
                </label>
                <input
                  id="coach-first-name"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-xl border border-white/12 bg-black/45 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#00FF85] transition-colors"
                />
              </div>
              <div>
                <label htmlFor="coach-last-name" className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  {t(language, 'lastName')}
                </label>
                <input
                  id="coach-last-name"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded-xl border border-white/12 bg-black/45 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#00FF85] transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label htmlFor="coach-nickname" className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  {t(language, 'nickname')}
                </label>
                <input
                  id="coach-nickname"
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full rounded-xl border border-white/12 bg-black/45 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#00FF85] transition-colors"
                />
              </div>
              <div>
                <label htmlFor="coach-nationality" className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  {t(language, 'nationality')}
                </label>
                <select
                  id="coach-nationality"
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  className="w-full rounded-xl border border-white/12 bg-black/60 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#00FF85] transition-colors cursor-pointer"
                >
                  {COACH_NATIONALITIES.map((nat) => (
                    <option key={nat} value={nat}>
                      {nat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="coach-dob" className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                {t(language, 'dateOfBirth')}
              </label>
              <input
                id="coach-dob"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full rounded-xl border border-white/12 bg-black/45 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#00FF85] transition-colors"
              />
            </div>

            {/* Selected Club Summary */}
            <div
              className="rounded-xl border border-white/12 p-4 relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${selectedClub.primaryColor}22 0%, rgba(7, 10, 16, 0.85) 75%)`,
              }}
            >
              <div className="flex items-center gap-3.5 relative z-10">
                <div className="p-1.5 rounded-xl bg-black/40 border border-white/10 shrink-0">
                  <ClubBadge
                    clubId={selectedClub.id}
                    name={selectedClub.name}
                    shortName={selectedClub.shortName}
                    primaryColor={selectedClub.primaryColor}
                    secondaryColor={selectedClub.secondaryColor}
                    pattern={selectedClub.pattern}
                    size={50}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-mono text-emerald-300 uppercase tracking-wider">
                    {activeTheme.name}
                  </div>
                  <div className="font-display text-xl font-bold text-white truncate leading-tight">
                    {selectedClub.name}
                  </div>
                  <div className="text-xs text-slate-300 truncate mt-0.5">
                    {selectedClub.stadium}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-mono mt-1.5 tabular-nums">
                    <span className="text-slate-300">
                      XI OVR <strong className="text-[#00FF85]">{avgOvr}</strong>
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-200">
                      {t(language, 'openingBudget')}:{' '}
                      <strong className="text-emerald-300">{formatCurrency(selectedClub.openingBudget)}</strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              data-start="true"
              className="w-full rounded-xl pitch-btn-primary font-bold text-sm py-3.5 px-4 cursor-pointer whitespace-nowrap"
            >
              {t(language, 'signContract')}
            </button>
          </section>

          {/* Country + League Tabs & Club Grid */}
          <section className="md:col-span-7 pitch-panel rounded-2xl p-4 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-2xl font-bold text-white tracking-tight">
                {t(language, 'selectLeague')}
              </h2>
              <span className="text-xs text-slate-300 font-mono px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/10">
                {countryMeta.flag} {language === 'vi' ? countryMeta.nameVi : countryMeta.nameEn} · {leagueClubs.length} Clubs
              </span>
            </div>

            {/* Nation Selector Pills */}
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
              {COUNTRY_CATALOG.map((c) => {
                const active = c.id === selectedCountry;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectCountry(c.id)}
                    className={`px-2.5 py-1.5 min-h-[32px] rounded-lg text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                      active
                        ? 'bg-white text-slate-950 font-bold shadow-md'
                        : 'bg-black/40 text-slate-300 border border-white/10 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <span>{c.flag}</span>
                    <span>{language === 'vi' ? c.nameVi : c.nameEn}</span>
                  </button>
                );
              })}
            </div>

            {/* Divisions inside Selected Country */}
            <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-black/50 border border-white/10">
              {countryLeagues.map((lid) => {
                const theme = COMPETITION_THEMES[lid];
                const meta = LEAGUE_CATALOG[lid];
                const active = selectedLeague === lid;
                return (
                  <button
                    key={lid}
                    type="button"
                    onClick={() => handleSelectLeague(lid)}
                    className={`flex-1 min-w-[120px] px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-[#00FF85] text-slate-950 font-bold shadow'
                        : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
                    }`}
                  >
                    {theme.name} ({meta.teamCount})
                  </button>
                );
              })}
            </div>

            {/* Quick Club Filter */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={clubQuery}
                onChange={(e) => setClubQuery(e.target.value)}
                placeholder={
                  language === 'vi'
                    ? 'Tìm nhanh câu lạc bộ hoặc sân vận động…'
                    : 'Filter clubs or stadiums…'
                }
                aria-label="Filter clubs"
                className="w-full rounded-xl border border-white/12 bg-black/45 pl-10 pr-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00FF85] transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
              {filteredClubs.length === 0 ? (
                <div className="col-span-full py-10 text-center text-xs text-slate-400">
                  {language === 'vi' ? 'Không tìm thấy câu lạc bộ phù hợp.' : 'No matching clubs found.'}
                </div>
              ) : (
                filteredClubs.map((club) => {
                  const isSelected = club.id === selectedClub.id;
                  const xiOvr = Math.round(
                    club.players.slice(0, 11).reduce((acc, p) => acc + p.ovr, 0) /
                      Math.max(1, Math.min(11, club.players.length))
                  );
                  return (
                    <button
                      key={club.id}
                      type="button"
                      onClick={() => setSelectedClubId(club.id)}
                      className={`relative flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-all cursor-pointer overflow-hidden ${
                        isSelected
                          ? 'border-[#00FF85] bg-[#00FF85]/12 shadow-[0_0_24px_-8px_rgba(0,255,133,0.45)]'
                          : 'border-white/10 bg-black/30 hover:bg-white/[0.07] hover:border-white/20'
                      }`}
                    >
                      <span
                        className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full"
                        style={{ backgroundColor: club.primaryColor }}
                      />
                      <div className="flex items-center gap-3 min-w-0 pl-1.5">
                        <ClubBadge
                          clubId={club.id}
                          name={club.name}
                          shortName={club.shortName}
                          primaryColor={club.primaryColor}
                          secondaryColor={club.secondaryColor}
                          pattern={club.pattern}
                          size={38}
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white truncate">{club.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono tabular-nums flex items-center gap-1.5">
                            <span>{formatCurrency(club.openingBudget)}</span>
                            {club.conf && (
                              <span className="px-1 rounded bg-white/10 text-[9px] text-sky-300">
                                {club.conf}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 px-2 py-1 rounded-lg bg-black/35 border border-white/[0.07]">
                        <div className="text-sm font-mono font-bold text-[#00FF85] tabular-nums leading-none">
                          {xiOvr}
                        </div>
                        <div className="text-[9px] text-slate-400 uppercase mt-0.5">OVR</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>
        </form>
      </main>
    </div>
  );
};
