# Interactive 2D Matchday Sim, Sound FX, Motion & Formatted Numeric Inputs

Deliver comma-formatted currency/wage inputs across all negotiation screens, a rich Web Audio stadium soundscape paired with smooth UI/pitch motion animations, and an interactive 2D Live Tactical Match Simulator featuring real-time pitch positioning, pause/speed controls, live substitutions, and mid-match tactical adjustments.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> All core architectural choices below incorporate your confirmed preferences from clarification.

- **Confirmed Decision 1 (2D Pitch Interactivity)**: Full interactive 2D horizontal pitch with live moving numbered player discs, animated ball tracking, Play/Pause, simulation speed controls (`1x`, `2x`, `4x`), and `Jump to Full Time`.
- **Confirmed Decision 2 (Live Subs & Tactics)**: Managers can pause at any minute to make up to 5 live substitutions from their 9-man bench and switch formations, presets, or tactical sliders—directly impacting remaining match probabilities, fitness drain, and player ratings.
- **Confirmed Decision 3 (Audio & Motion)**: Synthesized Web Audio stadium SFX (whistles, crowd goal roar, card chirps, sub chimes, negotiation stamps, crisp UI feedback) combined with smooth compositor-only CSS animations across views, modals, and live pitch entities.

---

### 1. Overview & Core Concept

- **What It Does**:
  1. Replaces raw unformatted numeric inputs (`184250`, `115350000`) with a dedicated comma-formatted numeric input control (`184,250`, `115,350,000`) across all contract, transfer, loan, incoming bid counter, and manager job negotiation forms.
  2. Upgrades the audio/visual feedback layer with zero-asset Web Audio stadium sound synthesis and `prefers-reduced-motion`-safe animations across navigation switches, modal reveals, goal flashes, and pitch movement.
  3. Upgrades Matchday `Live Sim` into a broadcast-grade 2D Tactical Arena inspired by EA FC Tactical View and classic 2D Football Manager engines, complete with dual Home/Away Starting XI & Bench sidebars, Fitness/Ratings/Stats/Tactics & Subs tabs, and stateful minute-by-minute simulation.
- **Target Experience**: Managers can read large transfer figures effortlessly at a glance, feel responsive tactile audio/motion feedback throughout career management, and actively coach from the touchline during live matches instead of passively watching static text logs.

---

### 2. User Experience & Visual Design

#### A. Comma-Formatted Numeric Inputs
- Every financial input field (Weekly Wage, Signing Fee, Agent Fee, Bonus Per Goal, Release Compensation, Transfer Fee, Loan Fee, Buy Option Fee, Manager Salary Demands) displays live thousand-separator commas (`184,250`) while preserving exact numeric values underneath.
- Rapid increment/decrement step buttons or keyboard arrow keys continue to step cleanly by contract/transfer increments while keeping cursor handling smooth during typing.

#### B. 2D Live Tactical Match Sim Layout
- **Top Broadcast Header**: Displays Home Club badge, name, scoreline, live match clock (`73:44` / `LIVE`), competition label, and Away Club scoreline, name, and badge—flashing a brief celebratory banner on goals.
- **Three-Zone Tactical Arena**:
  - **Left Panel (Home XI / Bench Toggle)**: Compact rows with shirt number, player name, captain badge (`C`), live fitness progress bar (green/amber/red), position/OVR, plus live goal (`⚽`), card (`🟨`/`🟥`), and sub (`▲`/`▼`) indicators.
  - **Center Interactive 2D Pitch**: Deep emerald mowed-stripe horizontal pitch with crisp markings (halfway line, center circle, penalty boxes, 6-yard boxes, penalty spots, goals). Displays 22 circular numbered player discs in each club's kit colors plus a moving ball marker. Clicking a player or opening **Tactics & Subs** lets the manager act immediately.
  - **Right Panel (Away XI / Bench Toggle)**: Symmetric opponent Starting 11 & Bench view with live match events and fitness bars.
- **Bottom Control Dock & Sub-Tabs**:
  - Control strip: `Play / Pause`, Speed toggle (`1x`, `2x`, `4x`), `Pause & Manage`, and `Jump to End`.
  - Four instant tabs below the pitch:
    1. **Lineup & Fitness**: Side-by-side pitch momentum strip & live commentary ticker.
    2. **Ratings**: Live sortable player ratings for starters and used substitutes.
    3. **Stats**: Live updating Possession %, Shots, Shots on Target, xG, Corners, Fouls, and Cards.
    4. **Tactics & Subs**: Live formation selector, tactical mentality presets, and interactive bench-to-starter substitution swaps (auto-pausing the match clock if running so the manager can make calm touchline decisions).

#### C. Sound FX & Motion System
- **Web Audio Soundscape** (respecting the Sound FX toggle in Custom):
  - *Matchday*: Kickoff whistle, full-time double/triple whistle, layered crowd roar + chord on goals, referee card chirp, shot/save thump, substitution chime.
  - *Career UI*: Crisp subtle clicks on navigation tabs, modal open/close swoosh, transfer/contract gavel stamp on deal completion, calendar tick during Auto Advance.
- **Motion Craft**:
  - Compositor-only (`transform`, `opacity`) modal scale-in and view cross-fade (`150ms–200ms`).
  - Smooth GPU `transform: translate(...)` interpolation on the 22 player discs and ball across ticks so players flow naturally between defensive shape, midfield buildup, and final-third attacks.
  - Scoreboard pulse and goal banner highlight when a goal lands.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Stateful Minute-by-Minute Live Engine vs. Pre-Computed Playback**
  - *Chosen Approach*: Implement a stateful live match simulation stepper that simulates minute-by-minute (`1' -> 90'`) using the active on-pitch players, current fitness levels, and active tactics at that exact minute, while keeping instant `Quick Sim` powered by the fast batch engine.
  - *Why*: Pre-computed playback would ignore mid-match substitutions and formation/mentality changes. Stateful minute stepping guarantees that bringing on a fresh striker at minute `65'` or switching to `Park the Bus` when defending a `1-0` lead genuinely alters shots, possession, goals, stamina, and final player ratings.
- **Decision 2: Formatted Text Inputs vs. Native HTML Number Inputs**
  - *Chosen Approach*: Build a reusable formatted numeric input component backed by numeric state (`inputMode="numeric"` text input displaying `toLocaleString('en-US')`).
  - *Why*: Standard browser `<input type="number">` forbids commas inside the input box. A dedicated formatted numeric input displays `184,250` cleanly while stripping non-digits and clamping bounds before updating parent numeric state.
- **Decision 3: Procedural 2D Tactical Coordinate Mapping vs. Heavy Canvas Physics**
  - *Chosen Approach*: Compute tactical anchor coordinates from each team's live `FormationName`, mentality (`Defensive Line`, `Attacking Width`), possession state, and ball zone (`GK`, `Build-up`, `Midfield`, `Final Third`, `Shot/Box`) with smooth CSS `transform` transitions.
  - *Why*: Produces faithful football team shapes (e.g. `4-3-3`, `4-2-4`, `4-1-2-1-2 Diamond`) shifting dynamically with the ball at high frame rates, crisp DOM accessibility, zero external canvas dependencies, and clean responsiveness across desktop and tablet widths.

---

### 4. Technical Architecture & Data Strategy

#### System Architecture & Data Flow

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                              PITCH Career State                            │
│  clubs[] · tactics · slotRoles · settings.soundEnabled · managerContract   │
└───────────────┬──────────────────────────────────────────┬─────────────────┘
                │                                          │
                ▼                                          ▼
┌───────────────────────────────┐          ┌─────────────────────────────────┐
│    FormattedNumberInput       │          │      Live Match State Engine    │
│  - Parses digits <-> "1,000"  │          │  - Minute cursor (0..90 + mm:ss)│
│  - Used in Contract, Transfer │          │  - Live home/away XI, bench(9), │
│    Loan, Bid Counter, Jobs    │          │    tactics, fitness, stats, xG  │
└───────────────────────────────┘          │  - stepLiveMatchMinute()        │
                                           │  - applyLiveSubstitution()      │
                                           │  - finalizeLiveMatchReport()    │
                                           └───────────────┬─────────────────┘
                                                           │
                                                           ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                        LiveMatchArena (MatchdayView)                       │
│  ┌──────────────┐   ┌───────────────────────────────┐   ┌───────────────┐  │
│  │ Home XI/Bench│   │  Interactive 2D Tactical Pitch│   │ Away XI/Bench │  │
│  │ + FitnessBar │◄──┤  22 Moving Discs + Ball + Log ├──►│ + FitnessBar  │  │
│  │ + Live Icons │   └───────────────┬───────────────┘   │ + Live Icons  │  │
│  └──────────────┘                   │                   └───────────────┘  │
│             ┌───────────────────────┴───────────────────────┐              │
│             │ Dock: Play/Pause · 1x/2x/4x · Jump · Sound FX │              │
│             │ Tabs: Fitness | Ratings | Stats | Tactics&Subs│              │
│             └───────────────────────────────────────────────┘              │
└────────────────────────────────────────────────────────────────────────────┘
```

#### Interactive Component & State Mapping
- **Live Match Lifecycle**:
  - Clicking `Live Sim` initializes a live match session with minute `0`, clock `00:00`, `isPlaying: true`, `speed: 1`, and copies of both clubs' matchday Starting XI, 9 Bench slots, and tactical setups.
  - Each timer tick advances match time according to `speed` (`1x`, `2x`, `4x`), invokes the minute simulation stepper, updates ball/player coordinates, drains active stamina, appends commentary/card/goal/corner events, triggers matching stadium SFX (`goal`, `whistle`, `card`, `shot`), and updates live stats and player ratings.
  - Clicking `Pause` or switching to `Tactics & Subs` pauses the clock; selecting a starter and a bench player (up to 5 total live subs, blocked for red-carded players) swaps them on pitch, logs the substitution event at the current minute, plays a substitution chime, and lets the user adjust Formation, Preset, Build-Up, or Defensive Approach before resuming.
  - Clicking `Jump to Full Time` synchronously executes remaining minutes `currentMinute..90` and displays the final `MatchReportPanel` + `Continue` confirmation to persist results cleanly into career standings, fitness, cards, and injuries.
- **Formatted Numeric Inputs**:
  - All negotiation modals accept and render comma-formatted integers seamlessly without blocking edits or quick multiplier presets (`+5%`, `+15%`, `+25%`, sliders).
- **Audio & Motion Continuity**:
  - Sound dispatcher reads `career.settings.soundEnabled` cleanly on every event (zero background oscillator leaks on pause/unmount).
  - Global CSS keyframe classes drive consistent panel transitions, modal entrances, pitch pulse indicators, and goal celebrations while respecting reduced-motion preferences.
