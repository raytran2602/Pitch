import test from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptIncomingTransferBid,
  advanceCalendarDay,
  advanceDeadlineHour,
  advanceToNextSeason,
  applyMatchdayOverrideToClub,
  applyMatchReportAndSimulateRound,
  autoAdvanceDeadlineDay,
  autoReplaceUnavailableStarters,
  buildSeasonObjectivesForClub,
  completeLoanInDeal,
  computeSeasonEndSummary,
  createInitialCareer,
  evaluateContractOffer,
  evaluateIncomingBidCounter,
  evaluateManagerJobApplication,
  evaluateSeasonObjectives,
  evaluateTransferOffer,
  exerciseLoanBuyOption,
  getRejectionCooldownUntil,
  getScoutDurationDays,
  getTotalRoundsForLeague,
  getTransferWindowStatusForDate,
  promoteAcademyProspect,
  rejectIncomingTransferBid,
  renewManagerContract,
  resolveClubForMatch,
  simulateMatch,
  skipCalendarToDate,
  switchUserClub,
  validateStartingXI,
} from './gameLogic';
import { COUNTRY_CATALOG, LEAGUE_CATALOG } from '../data/competitions';
import { buildAllInitialLeagueTeams } from '../data/world/worldRegistry';
import {
  applyLiveSubstitution,
  createLiveMatchSession,
  finalizeLiveMatchReport,
  finishLiveMatchToEnd,
  stepLiveMatchMinute,
  swapLivePitchPlayers,
  updateLiveTeamTactics,
} from './liveMatchEngine';
import { formatCurrency } from '../utils/i18n';
import { ALL_FORMATIONS, BENCH_SIZE, FORMATION_SLOTS } from '../data/premierLeague2627';
import {
  AVAILABLE_BADGE_IDS,
  getClubBadgeUrl,
  getPlayerPhotoUrl,
  PLAYER_NAME_TO_PHOTO_ID,
} from '../data/mediaManifest';
import {
  computeFc27Ovr,
  getAllowedRolesForSlot,
  getPlayerRoleMastery,
  getPlayerSlotEvaluation,
  normalizePlayer,
} from '../utils/playerAttributes';

const sampleCoach = {
  firstName: 'Ray',
  lastName: 'Tran',
  nickname: 'Boss',
  nationality: 'Vietnam',
  dob: '1992-05-14',
};

test('createInitialCareer initializes 2026/27 PL clubs (Coventry, Hull, Ipswich promoted), 380 fixtures, and budget', () => {
  const state = createInitialCareer(sampleCoach, 'ars');
  assert.equal(state.clubs.length, 20);
  assert.equal(state.fixtures.length, 380);
  assert.equal(state.clubId, 'ars');
  assert.ok(state.calendar.length > 100);
  assert.ok(state.academy.length === 8);
  assert.ok(state.transferTargets.length > 300);

  const plIds = new Set(state.clubs.map((c) => c.id));
  assert.ok(plIds.has('ch_cov'), 'Coventry City should be in 2026/27 PL');
  assert.ok(plIds.has('ch_hul'), 'Hull City should be in 2026/27 PL');
  assert.ok(plIds.has('ch_ips'), 'Ipswich Town should be in 2026/27 PL');
  assert.ok(!plIds.has('whu'), 'West Ham should be relegated to Championship');
  assert.ok(!plIds.has('wol'), 'Wolves should be relegated to Championship');
  assert.ok(!plIds.has('bur'), 'Burnley should be relegated to Championship');

  const champIds = new Set(state.leagueTeams?.CHAMP.map((t) => t.id) ?? []);
  assert.ok(champIds.has('whu') && champIds.has('wol') && champIds.has('bur'));

  const arsenal = state.clubs.find((c) => c.id === 'ars')!;
  assert.equal(arsenal.managerName, 'Ray Tran');
  assert.equal(arsenal.startingIds.length, 11);
  assert.equal(arsenal.benchIds.length, BENCH_SIZE);
  assert.ok(arsenal.players.length >= 24, 'Squad should include starters, 9 bench, reserves, and loans');
  assert.ok(arsenal.players.some((p) => p.loanInfo?.direction === 'IN'));
  assert.ok(arsenal.players.some((p) => p.loanInfo?.direction === 'OUT'));
  assert.ok(arsenal.players.some((p) => p.name === 'Mikel Merino'));
  assert.ok(arsenal.players.some((p) => p.name === 'Noni Madueke'));
  assert.ok(arsenal.players.some((p) => p.name === 'Bukayo Saka'));
  assert.ok(arsenal.players.some((p) => p.name === 'William Saliba'));

  const manCity = state.clubs.find((c) => c.id === 'mci')!;
  assert.equal(manCity.managerName, 'Enzo Maresca');
  assert.ok(manCity.players.some((p) => p.name === 'Erling Haaland'));
  assert.ok(manCity.players.some((p) => p.name === 'Gianluigi Donnarumma'));

  const chelsea = state.clubs.find((c) => c.id === 'che')!;
  assert.equal(chelsea.managerName, 'Xabi Alonso');
  assert.ok(chelsea.players.some((p) => p.name === 'Cole Palmer'));

  const manUtd = state.clubs.find((c) => c.id === 'mun')!;
  assert.equal(manUtd.managerName, 'Mauricio Pochettino');
  assert.ok(manUtd.players.some((p) => p.name === 'Benjamin Šeško'));
  assert.ok(manUtd.players.some((p) => p.name === 'Bryan Mbeumo'));
  assert.ok(manUtd.players.some((p) => p.name === 'Carlos Baleba'));
  assert.ok(!manUtd.players.some((p) => p.name === 'Casemiro'));

  // Official EA SPORTS FC 27 OVR matches EA database (89) and computeFc27Ovr fallback stays aligned
  const bruno = manUtd.players.find((p) => p.name === 'Bruno Fernandes')!;
  assert.equal(bruno.ovr, 89, 'Bruno Fernandes must match live EA FC 27 OVR (89)');
  const formulaOvr = computeFc27Ovr(bruno.detailedPosition ?? 'CAM', bruno.attributes);
  assert.ok(
    Math.abs(formulaOvr - bruno.ovr) <= 2,
    `computeFc27Ovr (${formulaOvr}) must stay closely aligned with official EA OVR (${bruno.ovr})`
  );

  assert.equal(state.calendar[0].dateIso, '2026-07-01');
});

test('advanceCalendarDay handles training/recovery fitness and stops at matchday', () => {
  let state = createInitialCareer(sampleCoach, 'liv');
  const firstDay = state.calendar[state.currentDayIndex];
  assert.equal(firstDay.type, 'TRAINING');
  assert.equal(firstDay.dateIso, '2026-07-01');

  state = advanceCalendarDay(state);
  assert.equal(state.currentDayIndex, 1);

  let sawRecovery = false;
  let safety = 0;
  while (state.calendar[state.currentDayIndex]?.type !== 'MATCHDAY' && safety < 80) {
    if (state.calendar[state.currentDayIndex]?.type === 'RECOVERY') sawRecovery = true;
    state = advanceCalendarDay(state);
    safety++;
  }
  assert.equal(sawRecovery, true);
  const matchdayIdx = state.currentDayIndex;
  assert.equal(state.calendar[matchdayIdx].type, 'MATCHDAY');

  // Cannot advance past MATCHDAY via advanceCalendarDay without playing match
  const stuck = advanceCalendarDay(state);
  assert.equal(stuck.currentDayIndex, matchdayIdx);
});

test('validateStartingXI blocks suspended and injured players from starting', () => {
  const state = createInitialCareer(sampleCoach, 'che');
  const chelsea = state.clubs.find((c) => c.id === 'che')!;
  const starter = chelsea.players.find((p) => p.id === chelsea.startingIds[0])!;
  starter.suspendedMatches = 1;

  const checkSuspended = validateStartingXI(chelsea, chelsea.startingIds);
  assert.equal(checkSuspended.valid, false);
  assert.equal(checkSuspended.suspendedPlayers.length, 1);
  assert.equal(checkSuspended.suspendedPlayers[0].id, starter.id);

  starter.suspendedMatches = 0;
  starter.injuredMatches = 2;
  starter.injuryNote = 'Hamstring strain';
  const checkInjured = validateStartingXI(chelsea, chelsea.startingIds);
  assert.equal(checkInjured.valid, false);
  assert.equal(checkInjured.injuredPlayers.length, 1);
  assert.equal(checkInjured.injuredPlayers[0].id, starter.id);
});

test('simulateMatch produces consistent stats, single MVP, detailedPosition ratings, and updates round standings', () => {
  let state = createInitialCareer(sampleCoach, 'mci');
  let safety = 0;
  while (state.calendar[state.currentDayIndex]?.type !== 'MATCHDAY' && safety < 80) {
    state = advanceCalendarDay(state);
    safety++;
  }
  const matchday = state.calendar[state.currentDayIndex];
  assert.equal(matchday.type, 'MATCHDAY');

  const fixture = state.fixtures.find((f) => f.id === matchday.matchFixtureId)!;
  const home = state.clubs.find((c) => c.id === fixture.homeClubId)!;
  const away = state.clubs.find((c) => c.id === fixture.awayClubId)!;

  const report = simulateMatch(home, away, fixture);
  assert.equal(report.stats.homePossession + report.stats.awayPossession, 100);
  assert.ok(report.stats.homeShots >= report.stats.homeShotsOnTarget);
  assert.ok(report.stats.homeShotsOnTarget >= report.homeGoals);
  assert.equal(report.ratings.filter((r) => r.isMvp).length, 1);
  assert.ok(report.ratings.every((r) => r.detailedPosition && r.slotIndex !== undefined));

  const nextState = applyMatchReportAndSimulateRound(state, report);
  assert.equal(nextState.currentRound, 2);
  const playedRound1 = nextState.fixtures.filter((f) => f.round === 1 && f.played);
  assert.equal(playedRound1.length, 10);
  const plTable = nextState.contextStandings.PL;
  assert.equal(plTable.reduce((s, r) => s + r.played, 0), 20);
});

test('position-specific 28 roles, Role++ mastery, and dynamic slot effectiveOvr evaluation', () => {
  assert.deepEqual(getAllowedRolesForSlot('GK'), ['Goalkeeper', 'Sweeper Keeper', 'Ball-Playing Keeper']);
  assert.deepEqual(getAllowedRolesForSlot('CB'), ['Defender', 'Stopper', 'Ball-Playing Defender', 'Wide Back']);
  assert.deepEqual(getAllowedRolesForSlot('LB'), ['Fullback', 'Falseback', 'Wingback', 'Attacking Wingback', 'Inverted Wingback']);
  assert.deepEqual(getAllowedRolesForSlot('CDM'), ['Holding', 'Centre-Half', 'Deep-Lying Playmaker', 'Wide Half', 'Box Crasher']);
  assert.deepEqual(getAllowedRolesForSlot('CAM'), ['Box-to-Box', 'Playmaker', 'Half-Winger', 'Classic 10', 'Shadow Striker']);
  assert.deepEqual(getAllowedRolesForSlot('RW'), ['Winger', 'Wide Midfielder', 'Wide Playmaker', 'Inside Forward']);
  assert.deepEqual(getAllowedRolesForSlot('ST'), ['Advanced Forward', 'Poacher', 'False 9', 'Target Forward']);

  const state = createInitialCareer(sampleCoach, 'ars');
  const arsenal = state.clubs.find((c) => c.id === 'ars')!;
  const striker = arsenal.players.find((p) => p.detailedPosition === 'ST')!;
  const naturalEval = getPlayerSlotEvaluation(striker, 'ST');
  const outOfPosEval = getPlayerSlotEvaluation(striker, 'GK');
  assert.equal(naturalEval.fitLevel, 'Natural');
  assert.equal(naturalEval.effectiveOvr, striker.ovr);
  assert.equal(outOfPosEval.fitLevel, 'OutOfPosition');
  assert.ok(outOfPosEval.effectiveOvr < striker.ovr - 10);

  const mastery = getPlayerRoleMastery(striker, striker.role);
  assert.ok(['Base', 'Role+', 'Role++'].includes(mastery));
});

test('temporary MatchdayLineupOverride applies only to target fixture and clears after match completion', () => {
  let state = createInitialCareer(sampleCoach, 'ars');
  let safety = 0;
  while (state.calendar[state.currentDayIndex]?.type !== 'MATCHDAY' && safety < 80) {
    state = advanceCalendarDay(state);
    safety++;
  }
  const matchday = state.calendar[state.currentDayIndex];
  const fixture = state.fixtures.find((f) => f.id === matchday.matchFixtureId)!;
  const arsenal = state.clubs.find((c) => c.id === 'ars')!;
  const originalFirstStarter = arsenal.startingIds[0];
  const benchPlayerId = arsenal.benchIds[0];

  const override = {
    fixtureId: fixture.id,
    formation: '3-5-2' as const,
    startingIds: [benchPlayerId, ...arsenal.startingIds.slice(1)],
    benchIds: [originalFirstStarter, ...arsenal.benchIds.slice(1)],
    tactics: { ...arsenal.tactics, formation: '3-5-2' as const },
  };
  state = { ...state, matchdayOverride: override };

  const effectiveForMatch = applyMatchdayOverrideToClub(arsenal, state.matchdayOverride, fixture.id);
  assert.equal(effectiveForMatch.formation, '3-5-2');
  assert.equal(effectiveForMatch.startingIds[0], benchPlayerId);
  // Permanent saved Line Up remains untouched
  assert.equal(arsenal.startingIds[0], originalFirstStarter);

  const home = resolveClubForMatch(state.clubs, fixture.homeClubId);
  const away = resolveClubForMatch(state.clubs, fixture.awayClubId);
  const report = simulateMatch(
    home.id === arsenal.id ? effectiveForMatch : home,
    away.id === arsenal.id ? effectiveForMatch : away,
    fixture
  );
  const nextState = applyMatchReportAndSimulateRound(state, report);
  assert.equal(nextState.matchdayOverride, null);
  const savedAfter = nextState.clubs.find((c) => c.id === 'ars')!;
  assert.equal(savedAfter.startingIds[0], originalFirstStarter);
});

test('incoming transfer bid negotiation, acceptance, and rejection update budget and notifications', () => {
  let state = createInitialCareer(sampleCoach, 'ars');
  const arsenal = state.clubs.find((c) => c.id === 'ars')!;
  const target = arsenal.players[arsenal.players.length - 1];
  const bid = {
    id: 'bid_test_1',
    playerId: target.id,
    playerName: target.name,
    buyingClubId: 'che',
    buyingClubName: 'Chelsea',
    buyingClubShortName: 'CHE',
    offeredFee: 20_000_000,
    initialFee: 20_000_000,
    sellOnShare: 0,
    buyerMaxFee: 28_000_000,
    patience: 85,
    roundCount: 1,
    status: 'PENDING' as const,
    lastMessage: 'Initial offer',
    dateIso: '2026-08-10',
  };
  state = {
    ...state,
    incomingBids: [bid],
    notifications: [
      {
        id: 'notif_bid_test_1',
        dateIso: '2026-08-10',
        type: 'TRANSFER_BID',
        title: `Bid for ${target.name}`,
        message: 'Chelsea bid £20.0M',
        read: false,
        bidId: bid.id,
        playerId: target.id,
      },
    ],
  };

  // Counter within buyerMaxFee is accepted
  const counterRes = evaluateIncomingBidCounter(state, bid.id, 24_000_000, 10);
  assert.equal(counterRes.outcome, 'ACCEPTED');
  assert.equal(counterRes.nextState.incomingBids?.[0].offeredFee, 24_000_000);

  const beforeBudget = counterRes.nextState.budget;
  const acceptedState = acceptIncomingTransferBid(counterRes.nextState, bid.id);
  assert.equal(acceptedState.budget, beforeBudget + 24_000_000);
  assert.equal(acceptedState.incomingBids?.[0].status, 'ACCEPTED');
  assert.equal(acceptedState.notifications?.[0].resolved, true);
  assert.ok(!acceptedState.clubs.find((c) => c.id === 'ars')!.players.some((p) => p.id === target.id));

  // Rejection flow
  const rejectedState = rejectIncomingTransferBid(state, bid.id);
  assert.equal(rejectedState.incomingBids?.[0].status, 'REJECTED');
  assert.equal(rejectedState.notifications?.[0].read, true);
});

test('contract renewal and transfer offers respect budget and valuations', () => {
  const state = createInitialCareer(sampleCoach, 'ars');
  const arsenal = state.clubs.find((c) => c.id === 'ars')!;
  const player = arsenal.players[0];

  const goodContract = evaluateContractOffer(
    player,
    {
      weeklyWage: Math.round(player.weeklyWage * 1.25),
      extendByYears: 3,
      signingFee: player.weeklyWage * 5,
      agentFee: 200_000,
      squadStatus: 'Crucial',
      bonusPerGoal: player.goalBonus + 2000,
      releaseCompensation: player.releaseClause,
    },
    state.budget
  );
  assert.equal(goodContract.accepted, true);

  const poorTransfer = evaluateTransferOffer(
    player,
    {
      startDate: 'Immediate',
      transferFee: 100_000,
      installments: 0,
      exchangePlayerId: null,
      bonusAfterAppearances: 0,
      sellOnShare: 0,
    },
    state.budget,
    null
  );
  assert.equal(poorTransfer.status, 'REJECTED');

  const overBudget = evaluateTransferOffer(
    player,
    {
      startDate: 'Immediate',
      transferFee: 900_000_000,
      installments: 0,
      exchangePlayerId: null,
      bonusAfterAppearances: 0,
      sellOnShare: 0,
    },
    state.budget,
    null
  );
  assert.equal(overBudget.insufficientBudget, true);
});

test('promoteAcademyProspect moves youth player into first team squad', () => {
  const state = createInitialCareer(sampleCoach, 'tot');
  const initialCount = state.clubs.find((c) => c.id === 'tot')!.players.length;
  const prospect = state.academy[0];
  const next = promoteAcademyProspect(state, prospect.id);
  const spurs = next.clubs.find((c) => c.id === 'tot')!;
  assert.equal(spurs.players.length, initialCount + 1);
  assert.equal(next.academy[0].promoted, true);

  const promoted = spurs.players[spurs.players.length - 1];
  assert.ok(promoted.detailedPosition);
  assert.ok(promoted.roleMastery);
  assert.ok(promoted.attributes.paceDetails?.acceleration);
  assert.ok(promoted.attributes.shootingDetails?.finishing);
  assert.ok(promoted.attributes.goalkeeperDetails?.reflexes);
  assert.ok(Array.isArray(promoted.playStyles) && promoted.playStyles.length >= 1);
});

test('all PL clubs and players have detailed EA FC attributes, roles, and valid media resolution', () => {
  const state = createInitialCareer(sampleCoach, 'ars');
  for (const club of state.clubs) {
    if (AVAILABLE_BADGE_IDS.has(club.id)) {
      assert.ok(getClubBadgeUrl({ clubId: club.id, name: club.name }), `Missing badge for ${club.id}`);
    }
    for (const p of club.players) {
      const normalizedKey = p.name.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
      if (PLAYER_NAME_TO_PHOTO_ID[normalizedKey]) {
        assert.ok(getPlayerPhotoUrl({ playerId: p.id, name: p.name }), `Missing photo for ${p.name}`);
      }
      assert.ok(p.detailedPosition, `Missing detailedPosition for ${p.name}`);
      assert.ok(p.roleMastery, `Missing roleMastery for ${p.name}`);
      assert.ok(p.attributes.paceDetails && p.attributes.physicalDetails && p.attributes.goalkeeperDetails);
      assert.ok((p.weakFoot ?? 0) >= 1 && (p.weakFoot ?? 0) <= 5);
    }
  }

  // Legacy save normalization preserves top-level numbers and populates sub-attributes + roles
  const ars = state.clubs[0];
  const rawLegacy = {
    ...ars.players[0],
    detailedPosition: undefined,
    secondaryPositions: undefined,
    roleMastery: undefined,
    weakFoot: undefined,
    playStyles: undefined,
    attributes: {
      pace: 70,
      finishing: 30,
      passing: 75,
      dribbling: 62,
      defending: 38,
      physical: 80,
      goalkeeper: 89,
    },
  };
  const hydrated = normalizePlayer(rawLegacy);
  assert.equal(hydrated.attributes.goalkeeper, 89);
  assert.ok(hydrated.detailedPosition);
  assert.ok(hydrated.roleMastery);
  assert.ok(hydrated.attributes.goalkeeperDetails?.reflexes);
  assert.ok(hydrated.attributes.physicalDetails?.stamina);
  assert.ok(hydrated.playStyles && hydrated.playStyles.length > 0);
});

test('parallel leagues and cups simulate alongside PL and advance cup brackets', () => {
  let state = createInitialCareer(sampleCoach, 'ars');

  const champRounds = new Set(state.contextFixtures.CHAMP.map((f) => f.round));
  assert.equal(champRounds.size, 46);

  let safety = 0;
  let playedCarabaoR3 = false;
  while (safety < 120) {
    safety++;
    const day = state.calendar[state.currentDayIndex];
    if (!day) break;
    if (day.dateIso > '2026-09-28') break;

    if (day.type === 'MATCHDAY' && day.matchFixtureId) {
      const fix =
        state.fixtures.find((f) => f.id === day.matchFixtureId) ??
        Object.values(state.contextFixtures)
          .flat()
          .find((f) => f?.id === day.matchFixtureId);
      assert.ok(fix, `Missing fixture for calendar day ${day.matchFixtureId}`);

      const home = resolveClubForMatch(state.clubs, fix.homeClubId);
      const away = resolveClubForMatch(state.clubs, fix.awayClubId);
      const report = simulateMatch(home, away, fix, safety);
      if (fix.competitionId === 'CARABAO' && fix.round === 3) {
        playedCarabaoR3 = true;
      }
      state = applyMatchReportAndSimulateRound(state, report);
    } else if (day.isDeadlineDay) {
      state = autoAdvanceDeadlineDay(state);
    } else {
      state = advanceCalendarDay(state);
    }
  }

  assert.ok(state.contextStandings.CHAMP.every((r) => r.played >= 1));
  assert.ok(state.contextStandings.L1.every((r) => r.played >= 1));
  assert.ok(state.contextStandings.L2.every((r) => r.played >= 1));
  const shield = state.contextFixtures.SHIELD[0];
  assert.equal(shield.played, true);
  assert.ok(shield.report && shield.report.ratings.filter((r) => !r.isSub).length === 22);

  assert.equal(playedCarabaoR3, true);
  const maxChampPlayed = Math.max(...state.contextStandings.CHAMP.map((r) => r.played));
  assert.ok(maxChampPlayed >= 6, `Expected CHAMP played >= 6, got ${maxChampPlayed}`);

  const carabaoR3 = state.contextFixtures.CARABAO.filter((f) => f.round === 3);
  const carabaoR4 = state.contextFixtures.CARABAO.filter((f) => f.round === 4);
  assert.equal(carabaoR3.length, 16);
  assert.ok(carabaoR3.every((f) => f.played));
  assert.equal(carabaoR4.length, 8);
});

test('playable EFL Championship career initializes 24 clubs, runs PL in parallel, and includes user in cups', () => {
  let state = createInitialCareer(sampleCoach, 'whu', 'CHAMP');
  assert.equal(state.userLeagueId, 'CHAMP');
  assert.equal(state.clubId, 'whu');
  assert.equal(state.contextStandings.CHAMP.length, 24);
  assert.equal(state.clubs.length, 44);
  assert.equal(getTotalRoundsForLeague('CHAMP'), 46);
  assert.equal(state.fixtures.length, 552);
  assert.equal(state.contextStandings.PL.length, 20);
  assert.equal(state.contextFixtures.PL.length, 380);

  const userClub = state.clubs.find((c) => c.id === 'whu')!;
  assert.ok(userClub.teamRoles?.captainId);
  assert.ok(userClub.teamRoles?.penaltyId);

  const inCarabao = state.contextFixtures.CARABAO.some(
    (f) => f.homeClubId === 'whu' || f.awayClubId === 'whu'
  );
  assert.equal(inCarabao, true);

  for (let round = 0; round < 5; round++) {
    let safety = 0;
    while (state.calendar[state.currentDayIndex]?.type !== 'MATCHDAY' && safety < 80) {
      state = advanceCalendarDay(state);
      safety++;
    }
    const day = state.calendar[state.currentDayIndex];
    const fix =
      state.fixtures.find((f) => f.id === day.matchFixtureId) ??
      state.contextFixtures.CARABAO.find((f) => f.id === day.matchFixtureId) ??
      state.contextFixtures.FACUP.find((f) => f.id === day.matchFixtureId)!;
    const home = resolveClubForMatch(state.clubs, fix.homeClubId);
    const away = resolveClubForMatch(state.clubs, fix.awayClubId);
    const report = simulateMatch(home, away, fix, round + 1);
    state = applyMatchReportAndSimulateRound(state, report);
  }

  const plPlayed = state.contextFixtures.PL.filter((f) => f.played);
  assert.ok(plPlayed.length >= 20, `Expected PL to simulate in parallel, got ${plPlayed.length}`);
});

test('parallel league Poisson simulation yields realistic multi-goal scorelines instead of 0-0 / 0-1', () => {
  let state = createInitialCareer(sampleCoach, 'ars', 'PL');
  for (let round = 0; round < 4; round++) {
    let safety = 0;
    while (state.calendar[state.currentDayIndex]?.type !== 'MATCHDAY' && safety < 80) {
      const curDay = state.calendar[state.currentDayIndex];
      state = curDay?.isDeadlineDay ? autoAdvanceDeadlineDay(state) : advanceCalendarDay(state);
      safety++;
    }
    const day = state.calendar[state.currentDayIndex];
    const fix =
      state.fixtures.find((f) => f.id === day.matchFixtureId) ??
      state.contextFixtures.CARABAO.find((f) => f.id === day.matchFixtureId) ??
      state.contextFixtures.FACUP.find((f) => f.id === day.matchFixtureId)!;
    const home = resolveClubForMatch(state.clubs, fix.homeClubId);
    const away = resolveClubForMatch(state.clubs, fix.awayClubId);
    state = applyMatchReportAndSimulateRound(state, simulateMatch(home, away, fix, round + 7));
  }

  const playedParallel = [
    ...state.contextFixtures.CHAMP.filter((f) => f.played),
    ...state.contextFixtures.L1.filter((f) => f.played),
    ...state.contextFixtures.L2.filter((f) => f.played),
  ];
  assert.ok(playedParallel.length >= 100);
  const totalGoals = playedParallel.reduce((s, f) => s + (f.homeGoals ?? 0) + (f.awayGoals ?? 0), 0);
  const avgGoals = totalGoals / playedParallel.length;
  const multiGoalTeams = playedParallel.filter((f) => (f.homeGoals ?? 0) >= 2 || (f.awayGoals ?? 0) >= 2);
  assert.ok(avgGoals >= 2.0 && avgGoals <= 3.6, `Unexpected parallel goal average: ${avgGoals}`);
  assert.ok(multiGoalTeams.length / playedParallel.length >= 0.45, 'Expected realistic 2+ goal games in parallel leagues');
});

test('transfer window calendar starts 2026-07-01, runs 24h Deadline Day countdown, and includes winter window', () => {
  let state = createInitialCareer(sampleCoach, 'ars');
  assert.equal(state.calendar[0].dateIso, '2026-07-01');
  const summerOpen = getTransferWindowStatusForDate('2026-07-01', 2026);
  assert.equal(summerOpen.isOpen, true);
  assert.equal(summerOpen.windowType, 'SUMMER');
  assert.equal(summerOpen.isDeadlineDay, false);

  const summerDeadlineStatus = getTransferWindowStatusForDate('2026-09-01', 2026);
  assert.equal(summerDeadlineStatus.isDeadlineDay, true);
  const winterDeadlineStatus = getTransferWindowStatusForDate('2027-02-01', 2026);
  assert.equal(winterDeadlineStatus.isDeadlineDay, true);

  const deadlineIdx = state.calendar.findIndex((d) => d.dateIso === '2026-09-01' && d.isDeadlineDay);
  assert.ok(deadlineIdx > 0, 'Expected Summer Deadline Day 2026-09-01 in calendar');

  state = {
    ...state,
    currentDayIndex: deadlineIdx,
    deadlineHoursRemaining: 24,
  };

  state = advanceDeadlineHour(state);
  assert.equal(state.currentDayIndex, deadlineIdx);
  assert.equal(state.deadlineHoursRemaining, 23);

  state = autoAdvanceDeadlineDay(state);
  assert.equal(state.currentDayIndex, deadlineIdx + 1);
  assert.equal(state.deadlineHoursRemaining, null);
});

test('season rollover auto-returns LOAN IN and LOAN OUT players and full TransferOffer counter works on incoming bids', () => {
  let state = createInitialCareer(sampleCoach, 'ars');
  const arsenal = state.clubs.find((c) => c.id === 'ars')!;
  const loanIn = arsenal.players.find((p) => p.loanInfo?.direction === 'IN')!;
  const loanOut = arsenal.players.find((p) => p.loanInfo?.direction === 'OUT')!;
  assert.ok(loanIn && loanOut);

  // Loaned out players are blocked from Starting XI
  const invalidCheck = validateStartingXI(arsenal, [loanOut.id, ...arsenal.startingIds.slice(1)]);
  assert.equal(invalidCheck.valid, false);
  assert.equal(invalidCheck.loanedOutPlayers.length, 1);

  // Full TransferOffer counter-bid with installments + exchange + bonus + sellOn
  const chelsea = state.clubs.find((c) => c.id === 'che')!;
  const exchangeCandidate = chelsea.players.find((p) => !chelsea.startingIds.includes(p.id) && !p.loanInfo)!;
  const target = arsenal.players[arsenal.players.length - 1];
  const bid = {
    id: 'bid_full_offer',
    playerId: target.id,
    playerName: target.name,
    buyingClubId: 'che',
    buyingClubName: 'Chelsea',
    buyingClubShortName: 'CHE',
    offeredFee: 18_000_000,
    initialFee: 18_000_000,
    sellOnShare: 0,
    buyerMaxFee: 32_000_000 + exchangeCandidate.marketValue,
    patience: 80,
    roundCount: 1,
    status: 'PENDING' as const,
    lastMessage: 'Opening bid',
    dateIso: '2026-07-05',
  };
  const withBid = { ...state, incomingBids: [bid] };
  const counterRes = evaluateIncomingBidCounter(withBid, bid.id, {
    startDate: 'Immediate',
    transferFee: 20_000_000,
    installments: 12,
    exchangePlayerId: exchangeCandidate.id,
    bonusAfterAppearances: 2_000_000,
    sellOnShare: 10,
  });
  assert.equal(counterRes.outcome, 'ACCEPTED');
  const acceptedBid = counterRes.nextState.incomingBids![0];
  assert.equal(acceptedBid.paidNow, 11_000_000);
  assert.equal(acceptedBid.futurePayments, 9_000_000);
  assert.equal(acceptedBid.potentialAddons, 2_000_000);

  const afterAccept = acceptIncomingTransferBid(counterRes.nextState, bid.id);
  const arsAfterAccept = afterAccept.clubs.find((c) => c.id === 'ars')!;
  assert.ok(arsAfterAccept.players.some((p) => p.id === exchangeCandidate.id));

  // End-of-season rollover returns LOAN IN and restores LOAN OUT
  const nextSeason = advanceToNextSeason(state);
  const nextArsenal = nextSeason.clubs.find((c) => c.id === 'ars')!;
  assert.ok(!nextArsenal.players.some((p) => p.id === loanIn.id), 'LOAN IN player should return to parent club');
  const returnedOut = nextArsenal.players.find((p) => p.id === loanOut.id);
  assert.ok(returnedOut, 'LOAN OUT player should return to Arsenal');
  assert.equal(returnedOut.loanInfo, undefined);
  assert.equal(nextArsenal.benchIds.length, BENCH_SIZE);
});

test('Berger schedule balances Home/Away streaks <= 2 across 38 rounds', () => {
  const state = createInitialCareer(sampleCoach, 'ars');
  for (const club of state.clubs) {
    const clubFixtures = state.fixtures
      .filter((f) => f.homeClubId === club.id || f.awayClubId === club.id)
      .sort((a, b) => a.round - b.round);
    assert.equal(clubFixtures.length, 38);
    let maxStreak = 0;
    let curStreak = 0;
    let prevHome: boolean | null = null;
    for (const f of clubFixtures) {
      const isHome = f.homeClubId === club.id;
      if (isHome === prevHome) {
        curStreak++;
      } else {
        curStreak = 1;
        prevHome = isHome;
      }
      if (curStreak > maxStreak) maxStreak = curStreak;
    }
    assert.ok(maxStreak <= 2, `${club.name} had Home/Away streak of ${maxStreak}`);
  }
});

test('ALL_FORMATIONS provides 19 formations with 11 valid slots each, and match report includes bench subs', () => {
  assert.ok(ALL_FORMATIONS.length >= 19);
  assert.ok(ALL_FORMATIONS.includes('4-2-4'));
  assert.ok(ALL_FORMATIONS.includes('4-1-2-1-2 Diamond'));
  for (const fm of ALL_FORMATIONS) {
    assert.equal(FORMATION_SLOTS[fm].length, 11, `${fm} must have 11 slots`);
  }

  let state = createInitialCareer(sampleCoach, 'liv');
  let safety = 0;
  while (state.calendar[state.currentDayIndex]?.type !== 'MATCHDAY' && safety < 80) {
    state = advanceCalendarDay(state);
    safety++;
  }
  const day = state.calendar[state.currentDayIndex];
  const fix = state.fixtures.find((f) => f.id === day.matchFixtureId)!;
  const home = resolveClubForMatch(state.clubs, fix.homeClubId);
  const away = resolveClubForMatch(state.clubs, fix.awayClubId);
  const report = simulateMatch(home, away, fix, 42);
  const homeRatings = report.ratings.filter((r) => r.teamSide === 'HOME');
  assert.ok(homeRatings.length > 11, 'Expected starting XI + bench ratings');
  assert.ok(
    homeRatings.some((r) => r.isSub === true),
    'Expected bench players tagged with isSub'
  );
  assert.ok(
    homeRatings.some((r) => r.didNotPlay === true && r.rating === null),
    'Expected unused substitutes with didNotPlay=true and rating=null'
  );
});

test('autoReplaceUnavailableStarters and skipCalendarToDate handle unavailable starters and advance fixtures', () => {
  let state = createInitialCareer(sampleCoach, 'ars');
  const arsenal = state.clubs.find((c) => c.id === 'ars')!;
  const injuredStarter = arsenal.players.find((p) => p.id === arsenal.startingIds[2])!;
  injuredStarter.injuredMatches = 3;
  injuredStarter.injuryNote = 'Ankle sprain';

  const replaced = autoReplaceUnavailableStarters(arsenal);
  assert.equal(replaced.replacedCount, 1);
  assert.equal(replaced.nextStartingIds.length, 11);
  assert.ok(!replaced.nextStartingIds.includes(injuredStarter.id));

  // Persist injured starter in state and skip past first two fixtures
  state = {
    ...state,
    clubs: state.clubs.map((c) =>
      c.id === 'ars'
        ? {
            ...c,
            players: c.players.map((p) =>
              p.id === injuredStarter.id ? { ...p, injuredMatches: 3, injuryNote: 'Ankle sprain' } : p
            ),
          }
        : c
    ),
  };

  const targetDate = '2026-08-25';
  const skipped = skipCalendarToDate(state, targetDate);
  assert.ok(skipped.calendar[skipped.currentDayIndex].dateIso >= targetDate);
  assert.ok(skipped.currentRound >= 2, `Expected skipCalendarToDate to simulate early rounds, got R${skipped.currentRound}`);
});

test('variable scout duration (1..5 days), rejection cooldown (+10d / +2d), and Loan In / Buy Option / 2-season loans', () => {
  let state = createInitialCareer(sampleCoach, 'ars');
  const chelsea = state.clubs.find((c) => c.id === 'che')!;
  const chePlayer = chelsea.players.find((p) => !p.loanInfo)!;
  const days = getScoutDurationDays(chePlayer);
  assert.ok(days >= 1 && days <= 5, `Unexpected scout days: ${days}`);

  assert.equal(getRejectionCooldownUntil('2026-07-10', false), '2026-07-20');
  assert.equal(getRejectionCooldownUntil('2026-09-01', true), '2026-09-03');

  // Half-season loan in should auto-return on 2027-01-01
  const halfLoanOffer = {
    dealType: 'LOAN' as const,
    startDate: 'Immediate' as const,
    transferFee: 0,
    installments: 0,
    exchangePlayerId: null,
    bonusAfterAppearances: 0,
    sellOnShare: 0,
    loanDurationSeasons: 0.5 as const,
    loanWageSplitPct: 75,
    loanFee: 1_500_000,
    buyOptionFee: 0,
  };
  const withHalfLoan = completeLoanInDeal(state, chePlayer.id, chelsea.id, halfLoanOffer);
  assert.ok(
    withHalfLoan.clubs.find((c) => c.id === 'ars')!.players.some((p) => p.id === chePlayer.id && p.loanInfo?.durationSeasons === 0.5)
  );
  const janOpenIdx = withHalfLoan.calendar.findIndex((d) => d.dateIso === '2027-01-01');
  assert.ok(janOpenIdx > 0);
  const dayBeforeJan = { ...withHalfLoan, currentDayIndex: janOpenIdx - 1 };
  const onJanOpen = advanceCalendarDay(dayBeforeJan);
  assert.ok(
    !onJanOpen.clubs.find((c) => c.id === 'ars')!.players.some((p) => p.id === chePlayer.id),
    'Half-season loan should auto-return on Jan 1'
  );

  // Two-season loan with buy option: persists across 1 season rollover, or converts permanently via buy option
  const targetTwoSeason = chelsea.players.find((p) => !p.loanInfo && p.id !== chePlayer.id)!;
  const twoSeasonOffer = {
    ...halfLoanOffer,
    loanDurationSeasons: 2 as const,
    buyOptionFee: 12_000_000,
  };
  const withTwoSeason = completeLoanInDeal(state, targetTwoSeason.id, chelsea.id, twoSeasonOffer);
  const afterSeason1 = advanceToNextSeason(withTwoSeason);
  assert.ok(
    afterSeason1.clubs.find((c) => c.id === 'ars')!.players.some((p) => p.id === targetTwoSeason.id),
    '2-season loan should persist after first season rollover'
  );

  const afterBuyOption = exerciseLoanBuyOption(withTwoSeason, targetTwoSeason.id);
  const boughtPlayer = afterBuyOption.clubs
    .find((c) => c.id === 'ars')!
    .players.find((p) => p.id === targetTwoSeason.id)!;
  assert.equal(boughtPlayer.loanInfo, undefined, 'Buy option should convert loan into permanent signing');
});

test('full contiguous daily calendar (1-day ticks) and full comma currency formatting', () => {
  const state = createInitialCareer(sampleCoach, 'ars');
  assert.ok(state.calendar.length >= 320, `Expected full daily calendar >= 320 days, got ${state.calendar.length}`);
  for (let i = 1; i < Math.min(40, state.calendar.length); i++) {
    const prev = new Date(`${state.calendar[i - 1].dateIso}T12:00:00Z`).getTime();
    const cur = new Date(`${state.calendar[i].dateIso}T12:00:00Z`).getTime();
    assert.equal(Math.round((cur - prev) / 86400_000), 1, `Expected 1-day tick at index ${i}`);
  }

  const skippedExact = skipCalendarToDate(state, '2026-09-05');
  assert.equal(skippedExact.calendar[skippedExact.currentDayIndex].dateIso, '2026-09-05');
  assert.ok(skippedExact.currentRound >= 3, 'Expected skip past Sep 1 to simulate early rounds & deadline day');

  assert.equal(formatCurrency(15_500_000), '£15,500,000');
  assert.equal(formatCurrency(85_000), '£85,000');
  assert.equal(formatCurrency(-1_250_000), '-£1,250,000');
});

test('board satisfaction <30% triggers 5-match probation warning, sacking after 5 matches, and Job Market switching', () => {
  let state = createInitialCareer(sampleCoach, 'ars');
  assert.equal(state.managerContract?.status, 'ACTIVE');
  assert.ok(state.clubManagers && Object.keys(state.clubManagers).length >= 60);

  // Force low satisfaction so a loss keeps satisfaction < 30%
  state = { ...state, boardSatisfaction: 25 };

  const playForcedLoss = (currState: typeof state) => {
    let s = currState;
    let guard = 0;
    while (s.calendar[s.currentDayIndex]?.type !== 'MATCHDAY' && guard < 80) {
      const d = s.calendar[s.currentDayIndex];
      s = d?.isDeadlineDay ? autoAdvanceDeadlineDay(s) : advanceCalendarDay(s);
      guard++;
    }
    const day = s.calendar[s.currentDayIndex];
    const fix =
      s.fixtures.find((f) => f.id === day.matchFixtureId) ??
      Object.values(s.contextFixtures)
        .flat()
        .find((f) => f?.id === day.matchFixtureId)!;
    const home = resolveClubForMatch(s.clubs, fix.homeClubId);
    const away = resolveClubForMatch(s.clubs, fix.awayClubId);
    const rep = simulateMatch(home, away, fix, guard + 1);
    const forcedRep =
      fix.homeClubId === s.clubId
        ? { ...rep, homeGoals: 0, awayGoals: 3 }
        : { ...rep, homeGoals: 3, awayGoals: 0 };
    return applyMatchReportAndSimulateRound(s, forcedRep);
  };

  // Match 1 < 30% -> probation starts at 5 matches remaining
  state = playForcedLoss(state);
  assert.equal(state.managerContract?.status, 'ACTIVE');
  assert.equal(state.managerContract?.probationMatchesRemaining, 5);

  // Matches 2..6 (5 probation matches remaining) -> SACKED at match 6
  for (let i = 0; i < 5; i++) {
    state = playForcedLoss(state);
  }
  assert.equal(state.managerContract?.status, 'SACKED');
  assert.equal(state.managerContract?.probationMatchesRemaining, 0);

  // Advance day is blocked once SACKED
  const idxBefore = state.currentDayIndex;
  const blocked = advanceCalendarDay(state);
  assert.equal(blocked.currentDayIndex, idxBefore);

  // Apply to a Championship club (e.g. West Ham or Derby) and verify cross-division switch
  const targetId = state.leagueTeams!.CHAMP[0].id;
  const evalGood = evaluateManagerJobApplication({ ...state, boardSatisfaction: 70 }, targetId, 20_000, 2);
  assert.ok(typeof evalGood.maxWageOffer === 'number');

  const switched = switchUserClub(state, targetId, 22_000, 3);
  assert.equal(switched.clubId, targetId);
  assert.equal(switched.userLeagueId, 'CHAMP');
  assert.equal(switched.managerContract?.status, 'ACTIVE');
  assert.equal(switched.managerContract?.weeklyWage, 22_000);
  assert.equal(switched.fixtures.length, 552);
  assert.equal(switched.contextFixtures.PL.length, 380);

  // Contract renewal works on active contract
  const renewRes = renewManagerContract(switched, 26_000, 2);
  assert.equal(renewRes.ok, true);
  assert.equal(renewRes.nextState.managerContract?.weeklyWage, 26_000);
});

test('2D live match engine supports minute stepping, live subs (max 5), mid-match tactics shift, and valid MatchReport finalization', () => {
  const state = createInitialCareer(sampleCoach, 'ars', 'PL');
  const firstFixture = state.fixtures[0];
  const home = resolveClubForMatch(state.clubs, firstFixture.homeClubId);
  const away = resolveClubForMatch(state.clubs, firstFixture.awayClubId);
  const userSide: 'HOME' | 'AWAY' = firstFixture.homeClubId === 'ars' ? 'HOME' : 'AWAY';

  let session = createLiveMatchSession(home, away, firstFixture, userSide, 11);
  assert.equal(session.minute, 0);
  assert.equal(session.home.starters.length, 11);
  assert.equal(session.away.starters.length, 11);
  assert.ok(session.home.starters.every((p) => p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100));

  // Step 30 minutes and confirm per-minute player coordinates move smoothly without large jumps
  let maxDeltaPerTick = 0;
  for (let i = 0; i < 30; i++) {
    const prevPositions = new Map(
      [...session.home.starters, ...session.away.starters]
        .filter((p) => p.onPitch && !p.redCarded)
        .map((p) => [p.player.id, { x: p.x, y: p.y }])
    );
    session = stepLiveMatchMinute(session).next;
    for (const p of [...session.home.starters, ...session.away.starters]) {
      if (!p.onPitch || p.redCarded) continue;
      const prev = prevPositions.get(p.player.id);
      if (prev) {
        maxDeltaPerTick = Math.max(
          maxDeltaPerTick,
          Math.abs(p.x - prev.x),
          Math.abs(p.y - prev.y)
        );
      }
    }
  }
  assert.equal(session.minute, 30);
  assert.ok(maxDeltaPerTick <= 4.9, `expected smooth per-minute delta <= 4.9, got ${maxDeltaPerTick}`);

  // Step up to Half-Time (minute 45) and verify half-time step works cleanly
  while (session.minute < 45) {
    session = stepLiveMatchMinute(session).next;
  }
  assert.equal(session.minute, 45);
  assert.equal(session.finished, false);

  // Swap two on-pitch players' positions without spending a substitution
  const activeBeforeSwap = userSide === 'HOME' ? session.home : session.away;
  const subsBeforeSwap = activeBeforeSwap.subsUsed;
  const pA = activeBeforeSwap.activeIds[9];
  const pB = activeBeforeSwap.activeIds[10];
  const swapRes = swapLivePitchPlayers(session, userSide, pA, pB);
  assert.equal(swapRes.ok, true);
  session = swapRes.next;
  const activeAfterSwap = userSide === 'HOME' ? session.home : session.away;
  assert.equal(activeAfterSwap.subsUsed, subsBeforeSwap);
  assert.equal(activeAfterSwap.activeIds[9], pB);
  assert.equal(activeAfterSwap.activeIds[10], pA);

  // Switch formation & tactics mid-match (with optional teamRoles)
  const userClub = userSide === 'HOME' ? home : away;
  session = updateLiveTeamTactics(session, userSide, '4-2-4', {
    ...userClub.tactics,
    preset: 'Gegenpress',
    defensiveLine: 9,
  });
  const activeUserTeam = userSide === 'HOME' ? session.home : session.away;
  assert.equal(activeUserTeam.club.formation, '4-2-4');

  // Execute 5 live substitutions for user side, then confirm 6th is blocked
  for (let i = 0; i < 5; i++) {
    const teamNow = userSide === 'HOME' ? session.home : session.away;
    const starterOff = teamNow.starters.find((p) => p.onPitch && !p.redCarded && p.slotPos !== 'GK')!;
    const benchOn = teamNow.bench.find((p) => !p.onPitch && !p.subbedOff)!;
    const subRes = applyLiveSubstitution(session, userSide, starterOff.player.id, benchOn.player.id);
    assert.equal(subRes.ok, true);
    session = subRes.next;
  }
  const teamAfter5 = userSide === 'HOME' ? session.home : session.away;
  assert.equal(teamAfter5.subsUsed, 5);
  const extraOff = teamAfter5.starters.find((p) => p.onPitch && !p.redCarded)!;
  const extraOn = teamAfter5.bench.find((p) => !p.onPitch && !p.subbedOff);
  if (extraOn) {
    const blockedSub = applyLiveSubstitution(session, userSide, extraOff.player.id, extraOn.player.id);
    assert.equal(blockedSub.ok, false);
  }

  // Finish to full time and apply to career state
  const finished = finishLiveMatchToEnd(session);
  assert.equal(finished.finished, true);
  assert.equal(finished.minute, 90);

  const report = finalizeLiveMatchReport(finished);
  assert.equal(report.fixtureId, firstFixture.id);
  const subRatingsPlayed = report.ratings.filter((r) => r.teamSide === userSide && r.isSub && !r.didNotPlay);
  assert.equal(subRatingsPlayed.length, 5);

  const nextState = applyMatchReportAndSimulateRound(state, report);
  const updatedFix = nextState.fixtures.find((f) => f.id === firstFixture.id)!;
  assert.equal(updatedFix.played, true);
});

test('multi-season promotion/relegation movements persist across advanceToNextSeason and advanceCalendarDay', () => {
  const state = createInitialCareer(sampleCoach, 'ars', 'PL');
  const { summary } = computeSeasonEndSummary(state);
  assert.ok(summary.movements.length > 0, 'season end should produce promotion/relegation movements');

  const champToPl = summary.movements.find((m) => m.fromLeague === 'CHAMP' && m.toLeague === 'PL' && m.direction === 'PROMOTED');
  const plToChamp = summary.movements.find((m) => m.fromLeague === 'PL' && m.toLeague === 'CHAMP' && m.direction === 'RELEGATED');
  const l1ToChamp = summary.movements.find((m) => m.fromLeague === 'L1' && m.toLeague === 'CHAMP' && m.direction === 'PROMOTED');
  const champToL1 = summary.movements.find((m) => m.fromLeague === 'CHAMP' && m.toLeague === 'L1' && m.direction === 'RELEGATED');
  const l2ToL1 = summary.movements.find((m) => m.fromLeague === 'L2' && m.toLeague === 'L1' && m.direction === 'PROMOTED');
  const l1ToL2 = summary.movements.find((m) => m.fromLeague === 'L1' && m.toLeague === 'L2' && m.direction === 'RELEGATED');

  assert.ok(champToPl && champToPl.clubIds.length > 0, 'expected CHAMP -> PL promotions');
  assert.ok(plToChamp && plToChamp.clubIds.length > 0, 'expected PL -> CHAMP relegations');
  assert.ok(l1ToChamp && l1ToChamp.clubIds.length > 0, 'expected L1 -> CHAMP promotions');
  assert.ok(champToL1 && champToL1.clubIds.length > 0, 'expected CHAMP -> L1 relegations');
  assert.ok(l2ToL1 && l2ToL1.clubIds.length > 0, 'expected L2 -> L1 promotions');
  assert.ok(l1ToL2 && l1ToL2.clubIds.length > 0, 'expected L1 -> L2 relegations');

  let nextSeason = advanceToNextSeason(state);
  assert.equal(nextSeason.clubs.find((c) => c.id === 'ars')?.managerName, 'Ray Tran');
  assert.equal(nextSeason.leagueTeams?.PL.length, 20);
  assert.equal(nextSeason.leagueTeams?.CHAMP.length, 24);
  assert.equal(nextSeason.leagueTeams?.L1.length, 24);
  assert.equal(nextSeason.leagueTeams?.L2.length, 24);

  const assertMovementsApplied = (s: typeof nextSeason, label: string) => {
    const activeClubIds = new Set(s.clubs.map((c) => c.id));
    const plIds = new Set(s.leagueTeams?.PL.map((t) => t.id) ?? []);
    const champIds = new Set(s.leagueTeams?.CHAMP.map((t) => t.id) ?? []);
    const l1Ids = new Set(s.leagueTeams?.L1.map((t) => t.id) ?? []);
    const l2Ids = new Set(s.leagueTeams?.L2.map((t) => t.id) ?? []);

    for (const id of champToPl.clubIds) {
      assert.ok(activeClubIds.has(id), `${label}: promoted CHAMP club ${id} should be in active clubs`);
      assert.ok(plIds.has(id), `${label}: promoted CHAMP club ${id} should be in leagueTeams.PL`);
      assert.ok(!champIds.has(id), `${label}: promoted CHAMP club ${id} should leave CHAMP`);
    }
    for (const id of plToChamp.clubIds) {
      assert.ok(champIds.has(id), `${label}: relegated PL club ${id} should be in CHAMP`);
      assert.ok(!plIds.has(id), `${label}: relegated PL club ${id} should leave PL`);
    }
    for (const id of l1ToChamp.clubIds) {
      assert.ok(champIds.has(id), `${label}: promoted L1 club ${id} should be in CHAMP`);
      assert.ok(!l1Ids.has(id), `${label}: promoted L1 club ${id} should leave L1`);
    }
    for (const id of champToL1.clubIds) {
      assert.ok(l1Ids.has(id), `${label}: relegated CHAMP club ${id} should be in L1`);
      assert.ok(!champIds.has(id), `${label}: relegated CHAMP club ${id} should leave CHAMP`);
    }
    for (const id of l2ToL1.clubIds) {
      assert.ok(l1Ids.has(id), `${label}: promoted L2 club ${id} should be in L1`);
      assert.ok(!l2Ids.has(id), `${label}: promoted L2 club ${id} should leave L2`);
    }
    for (const id of l1ToL2.clubIds) {
      assert.ok(l2Ids.has(id), `${label}: relegated L1 club ${id} should be in L2`);
      assert.ok(!l1Ids.has(id), `${label}: relegated L1 club ${id} should leave L1`);
    }
  };

  assertMovementsApplied(nextSeason, 'after advanceToNextSeason');

  // advanceCalendarDay triggers syncParallelCompetitions -> getLeagueTeamsFromState,
  // which previously rejected L1/L2 (24 teams !== 12) and reset Season 2+ divisions back to Season 1.
  nextSeason = advanceCalendarDay(nextSeason);
  assertMovementsApplied(nextSeason, 'after advanceCalendarDay');
  assert.equal(nextSeason.contextStandings?.CHAMP?.length, 24);
  assert.equal(nextSeason.contextStandings?.L1?.length, 24);
  assert.equal(nextSeason.contextStandings?.L2?.length, 24);
});

test('season objectives scale by club strength/league, evaluate live progress, and impact board satisfaction', () => {
  const arsState = createInitialCareer(sampleCoach, 'ars', 'PL');
  assert.equal(arsState.seasonObjectives?.length, 3);
  const arsLeagueObj = arsState.seasonObjectives!.find((o) => o.competitionId === 'PL')!;
  const arsFaObj = arsState.seasonObjectives!.find((o) => o.competitionId === 'FACUP')!;
  const arsCarabaoObj = arsState.seasonObjectives!.find((o) => o.competitionId === 'CARABAO')!;
  assert.ok((arsLeagueObj.targetLeagueRank ?? 99) <= 4, 'Top PL club should have top-4 or title target');
  assert.ok((arsFaObj.targetCupRound ?? 0) >= 6, 'Top PL club should target FA Cup Semi-Final or Final');
  assert.ok((arsCarabaoObj.targetCupRound ?? 0) >= 5, 'Top PL club should target Carabao Cup QF or SF');

  // Newly promoted Coventry City in PL should have lower-half/survival target
  const covObjectives = buildSeasonObjectivesForClub(
    'ch_cov',
    'PL',
    arsState.leagueTeams!,
    arsState.clubs,
    0
  );
  const covLeagueObj = covObjectives.find((o) => o.competitionId === 'PL')!;
  assert.ok((covLeagueObj.targetLeagueRank ?? 0) >= 14, 'Promoted PL side should target survival / mid-table');

  // Championship club has Championship objectives
  const whuState = createInitialCareer(sampleCoach, 'whu', 'CHAMP');
  assert.equal(whuState.seasonObjectives?.length, 3);
  assert.ok(whuState.seasonObjectives!.some((o) => o.competitionId === 'CHAMP'));

  // Simulate Carabao Cup R3 elimination -> FAILED objective + -6 board satisfaction delta
  let cupState = arsState;
  const carabaoDayIdx = cupState.calendar.findIndex(
    (d) => d.type === 'MATCHDAY' && d.competitionId === 'CARABAO'
  );
  assert.ok(carabaoDayIdx > 0, 'Expected Carabao Cup R3 matchday on calendar');
  const carabaoDay = cupState.calendar[carabaoDayIdx];
  const carabaoFix = cupState.contextFixtures.CARABAO.find((f) => f.id === carabaoDay.matchFixtureId)!;
  const home = resolveClubForMatch(cupState.clubs, carabaoFix.homeClubId);
  const away = resolveClubForMatch(cupState.clubs, carabaoFix.awayClubId);
  const baseRep = simulateMatch(home, away, carabaoFix, 11);
  const forcedCupLoss =
    carabaoFix.homeClubId === 'ars'
      ? { ...baseRep, homeGoals: 0, awayGoals: 2 }
      : { ...baseRep, homeGoals: 2, awayGoals: 0 };

  const satBefore = cupState.boardSatisfaction;
  const afterCupLoss = applyMatchReportAndSimulateRound(
    { ...cupState, currentDayIndex: carabaoDayIdx },
    forcedCupLoss
  );
  const carabaoAfter = afterCupLoss.seasonObjectives!.find((o) => o.competitionId === 'CARABAO')!;
  assert.equal(carabaoAfter.status, 'FAILED');
  assert.equal(carabaoAfter.satisfactionApplied, true);
  // Loss gives -3 match result and -6 cup objective failure = -9
  assert.equal(afterCupLoss.boardSatisfaction, satBefore - 9);
  assert.ok(
    afterCupLoss.notifications?.some((n) => n.type === 'BOARD' && n.title.includes('Objective Missed'))
  );

  // Re-evaluating preserves completed/failed status cleanly
  const reEvaluated = evaluateSeasonObjectives(afterCupLoss);
  assert.equal(reEvaluated.find((o) => o.competitionId === 'CARABAO')?.status, 'FAILED');

  // Advancing to next season resets objectives cleanly for the new season
  const nextSeason = advanceToNextSeason(afterCupLoss);
  assert.equal(nextSeason.seasonObjectives?.length, 3);
  assert.ok(nextSeason.seasonObjectives!.every((o) => o.status === 'IN_PROGRESS' && !o.satisfactionApplied));

  // Switching club builds new objectives for the new club
  const switched = switchUserClub(arsState, whuState.clubId, 20_000, 2);
  assert.equal(switched.seasonObjectives?.length, 3);
  assert.ok(switched.seasonObjectives!.some((o) => o.competitionId === 'CHAMP'));
});

test('all 34 global leagues, 22 national cups, MLS East/West & UEFA C1/C2/C3 36-club Swiss phase initialize cleanly', () => {
  const allLeagueTeams = buildAllInitialLeagueTeams();
  for (const [lid, meta] of Object.entries(LEAGUE_CATALOG)) {
    const teams = allLeagueTeams[lid as keyof typeof LEAGUE_CATALOG];
    assert.equal(teams.length, meta.teamCount, `League ${lid} expected ${meta.teamCount} teams`);
  }
  assert.equal(COUNTRY_CATALOG.length, 22);

  // Start career in Spain (LALIGA EA SPORTS)
  const realId = allLeagueTeams.ESP1.find((t) => t.name.includes('Real Madrid'))!.id;
  const spainCareer = createInitialCareer(sampleCoach, realId, 'ESP1');
  assert.equal(spainCareer.clubs.length, 20);
  assert.equal(spainCareer.userLeagueId, 'ESP1');
  assert.equal(spainCareer.fixtures.length, 380);
  assert.ok((spainCareer.contextFixtures.COPADELREY ?? []).length >= 16);
  assert.ok((spainCareer.contextFixtures.UCL ?? []).length === 144);
  assert.ok((spainCareer.contextFixtures.UEL ?? []).length === 144);
  assert.ok((spainCareer.contextFixtures.UECL ?? []).length === 108);
  assert.equal(spainCareer.contextStandings.UCL.length, 36);
  assert.equal(spainCareer.contextStandings.UEL.length, 36);
  assert.equal(spainCareer.contextStandings.UECL.length, 36);

  // Real Madrid badge & player minifaces resolve cleanly
  assert.ok(getClubBadgeUrl({ clubId: realId })?.includes('fotmob.com'));
  const realClub = spainCareer.clubs.find((c) => c.id === realId)!;
  assert.ok(realClub.players.length >= 20);
  assert.ok(realClub.players.some((p) => Boolean(getPlayerPhotoUrl({ name: p.name }))));

  // Verify MLS 30-club Eastern/Western 34-round structure
  const miamiId = allLeagueTeams.USA1.find((t) => t.name.includes('Miami'))?.id ?? allLeagueTeams.USA1[0].id;
  const mlsCareer = createInitialCareer(sampleCoach, miamiId, 'USA1');
  assert.equal(mlsCareer.clubs.length, 30);
  assert.equal(getTotalRoundsForLeague('USA1'), 34);
  assert.equal(mlsCareer.fixtures.length, 510); // 30 teams * 34 matches / 2 = 510
  assert.equal(mlsCareer.clubs.filter((c) => c.conf === 'EAST').length, 15);
  assert.equal(mlsCareer.clubs.filter((c) => c.conf === 'WEST').length, 15);
});

test('non-English pyramids promote/relegate cleanly and Season 2+ UEFA C1/C2/C3 resolve champions & qualify dynamically', () => {
  const allLeagueTeams = buildAllInitialLeagueTeams();
  const realId = allLeagueTeams.ESP1[0].id;
  const spainCareer = createInitialCareer(sampleCoach, realId, 'ESP1');
  const { finalizedState, summary } = computeSeasonEndSummary(spainCareer);

  // Verify UEFA champions & Super Cups decided
  assert.ok(summary.uclWinner?.clubId, 'UCL champion should be decided at season end');
  assert.ok(summary.uelWinner?.clubId, 'UEL champion should be decided at season end');
  assert.ok(summary.ueclWinner?.clubId, 'UECL champion should be decided at season end');
  assert.ok(summary.uefaSuperCupWinner?.clubId, 'UEFA Super Cup champion should be decided');
  assert.ok(summary.supercopaWinner?.clubId, 'Supercopa de España champion should be decided');
  assert.ok(summary.nationalCupWinners?.COPADELREY?.clubId, 'Copa del Rey winner should be decided');
  assert.ok(summary.mlsCupWinner?.clubId, 'MLS Cup Playoffs champion should be decided');

  // Verify Spanish, German, and Saudi movements exist
  assert.ok(summary.movements.some((m) => m.fromLeague === 'ESP2' && m.toLeague === 'ESP1'));
  assert.ok(summary.movements.some((m) => m.fromLeague === 'GER3' && m.toLeague === 'GER2'));
  assert.ok(summary.movements.some((m) => m.fromLeague === 'KSA2' && m.toLeague === 'KSA1'));

  // Verify Season 1 Real Madrid calendar includes Supercopa Semi-Final and PSG/Villa calendar includes UEFA Super Cup
  assert.ok(spainCareer.contextFixtures.SUPERCOPA.length === 2);
  assert.ok(
    spainCareer.calendar.some((d) => d.competitionId === 'SUPERCOPA'),
    'Real Madrid Season 1 calendar should schedule Supercopa de España'
  );
  const psgId = allLeagueTeams.FRA1.find((t) => t.name.includes('Paris Saint-Germain'))!.id;
  const psgCareer = createInitialCareer(sampleCoach, psgId, 'FRA1');
  assert.ok(
    psgCareer.calendar.some((d) => d.competitionId === 'UEFASUPERCUP'),
    'PSG Season 1 calendar should schedule UEFA Super Cup'
  );

  // Advance to Season 2 and verify UEFA Super Cup pairs previous UCL vs UEL winner & Supercopa has 4 Spanish clubs
  const season2 = advanceToNextSeason(finalizedState);
  assert.equal(season2.contextFixtures.UEFASUPERCUP.length, 1);
  assert.equal(season2.contextFixtures.UEFASUPERCUP[0].homeClubId, summary.uclWinner!.clubId);
  assert.equal(season2.contextFixtures.UEFASUPERCUP[0].awayClubId, summary.uelWinner!.clubId);
  assert.equal(season2.contextFixtures.SUPERCOPA.length, 2);
  assert.equal(season2.seasonIndex, 1);
  assert.equal(season2.contextStandings.UCL.length, 36);
  assert.equal(season2.contextStandings.UEL.length, 36);
  assert.equal(season2.contextStandings.UECL.length, 36);
  const allUefaIds = [
    ...(season2.uefaParticipants?.UCL ?? []),
    ...(season2.uefaParticipants?.UEL ?? []),
    ...(season2.uefaParticipants?.UECL ?? []),
  ];
  assert.equal(new Set(allUefaIds).size, 108, 'All 108 UEFA League Phase clubs across C1/C2/C3 must be distinct');
});




