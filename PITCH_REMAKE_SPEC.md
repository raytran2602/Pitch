# PITCH — Tài Liệu Thiết Kế & Kiến Trúc Kỹ Thuật (Remix / Remake Blueprint)

> Tài liệu mô tả toàn bộ **Game Design Document (GDD)**, **Data Schema**, **Simulation Engine**, **UI/UX Architecture**, và **Design System** của **PITCH** (Football Career Management Simulation) nhằm phục vụ việc **remix, mở rộng hoặc remake** sang bất kỳ nền tảng/framework nào.

---

## 1. Tổng Quan Sản Phẩm (Product Overview)

- **Tên ứng dụng:** `PITCH`
- **Thể loại:** Quản lý sự nghiệp Huấn luyện viên Bóng đá (Football Career Management Simulation), lấy cảm hứng từ chế độ **Career Mode của EA Sports FC / FIFA** kết hợp **Football Manager Lite**.
- **Bối cảnh khởi điểm:** Mùa giải **2026/27** tại hệ thống bóng đá chuyên nghiệp Anh (từ Premier League đến EFL League Two, kèm cúp quốc nội).
- **Ngôn ngữ:** Song ngữ **Tiếng Việt (`vi`)** & **Tiếng Anh (`en`)**, chuyển đổi tức thì (realtime i18n).
- **Lưu trữ:** Client-side persistence qua `localStorage` (`premierLeague2627CoachV2`), có hỗ trợ backend Express để phục vụ Vite dev middleware và endpoint AI Media Studio dự phòng (`/api/media/*`).
- **Điểm nhấn trải nghiệm:**
  - Chạy đa giải đấu **song song theo thời gian thực trên lịch** (Premier League, Championship, League One, League Two, FA Cup, Carabao Cup, Community Shield).
  - Giao diện **Broadcast Dark** đổi màu động theo từng giải đấu (`COMPETITION_THEMES`).
  - Bộ chỉ số cầu thủ chuẩn **EA FC / FIFA** (7 nhóm tổng quát + 34 chỉ số chi tiết + PlayStyles + Work Rate + Weak Foot / Skill Moves).
  - Trình phát **EA FC / FIFA Soundtrack** (Spotify embed + **FC Menu Synth Radio** tổng hợp bằng Web Audio API vẫn chạy liên tục khi thu nhỏ).

---

## 2. Core Gameplay Loop (Vòng Lặp Lối Chơi Cốt Lõi)

```text
[1. New Career Setup]
   ├─ Nhập hồ sơ HLV (Tên, Họ, Biệt danh, Quốc tịch, Ngày sinh)
   ├─ Chọn 1 trong 4 hạng đấu (PL / CHAMP / L1 / L2)
   └─ Chọn CLB & Ngân sách mở màn
        │
        ▼
[2. Daily Preparation Loop] (Calendar-Driven)
   ├─ Recovery Day: Hồi phục thể lực cầu thủ (+11% fitness)
   ├─ Training Day: Tiêu hao nhẹ thể lực (-2%/-3%), cơ hội tăng OVR cầu thủ trẻ (<= 22 tuổi), tiến độ Học viện (+8%)
   ├─ Tuyển trạch (Scouting): Đếm ngược ngày mở khóa báo cáo cầu thủ mục tiêu
   └─ Song song mỗi ngày: Các giải đấu khác & Cúp quốc gia tự động mô phỏng các trận <= ngày hiện tại
        │
        ▼
[3. Pre-Match & Tactical Setup]
   ├─ Line Up -> Squad: Kéo thả đổi chỗ 11 đá chính / 7 dự bị / Reserves; click 2 cầu thủ để so sánh
   ├─ Line Up -> Tactical: Chọn sơ đồ (6 sơ đồ), Preset, Build-up, Defensive Line/Width/Box, chỉnh Player Role trực tiếp trên sân
   ├─ Line Up -> Team Roles: Chỉ định Đội trưởng, Đá phạt đền, Đá phạt trực tiếp, Phạt góc trái/phải
   └─ Validate Starting XI: Bắt buộc đủ 11 người & không có cầu thủ bị treo giò (`suspendedMatches > 0`)
        │
        ▼
[4. Matchday Simulation]
   ├─ Kick Off (Live 90 phút tua nhanh) hoặc Quick Sim (kết quả tức thì)
   ├─ Timeline 2 cánh (Home trái / Away phải) + Match Stats + Player Ratings (4.5 - 10.0) + MVP
   └─ Cập nhật BXH, Vua phá lưới/kiến tạo, Thẻ phạt/Treo giò, Ngân sách (Vé + Thưởng bàn thắng - Lương tuần), Độ hài lòng Ban lãnh đạo
        │
        ▼
[5. Off-Pitch Management (Bất cứ lúc nào)]
   ├─ Squad Hub: Xem nhanh, So sánh, View Profile 4 tab, Gia hạn hợp đồng, Đổi số áo, Treo bảng bán, Thanh lý
   ├─ Transfers: Tìm kiếm -> Tuyển trạch (2 ngày hoặc Khẩn) -> Shortlist -> Đàm phán CLB -> Đàm phán cá nhân
   ├─ Academy: Theo dõi U18/U21 và Đôn lên đội 1 (Promote)
   └─ Club Honours / Finance: Theo dõi tủ cúp lịch sử + kỷ lục mùa giải + sổ cái thu chi
        │
        ▼
[6. End of Season -> Promotion / Relegation -> Next Season]
   ├─ Chốt tất cả giải song song & Chung kết Cúp đến 30/06
   ├─ Tính Play-off thăng hạng (Champions / L1 / L2)
   ├─ Tổng kết Thăng hạng / Xuống hạng / Trụ hạng & Tiền thưởng mùa giải
   └─ Sang mùa mới: Cầu thủ +1 tuổi, phát triển/lão hóa OVR, reset thẻ & chỉ số mùa, tạo lịch & cúp năm kế tiếp
```

---

## 3. Kiến Trúc Kỹ Thuật & Cấu Trúc Thư Mục

### 3.1 Tech Stack
| Thành phần | Công nghệ / Thư viện | Vai trò |
|---|---|---|
| Frontend Framework | **React 19** (`react`, `react-dom`) + **TypeScript** | SPA quản lý trạng thái career toàn cục tại `App.tsx` |
| Bundler & Dev Server | **Vite 8** + **Express 4** (`tsx server.ts`) | Chạy port `3000`, mount `vite.middlewares` ở dev, serve `dist/` ở prod |
| Styling | **Tailwind CSS v4** (`@import "tailwindcss";`) | Utility-first, responsive grid, tabular numbers |
| Typography | `Barlow Condensed` (Display), `Plus Jakarta Sans` (UI), `JetBrains Mono` (Số liệu/OVR) | Phân cấp số liệu thể thao sắc nét |
| Icons & Animation | `lucide-react`, `motion` | Iconography sạch, hiệu ứng mượt |
| Audio | **Web Audio API** (`AudioContext`) + Spotify iFrame Embed | SFX tương tác + FC Menu Synth Radio chạy nền |
| Optional Server AI | `@google/genai` (`server.ts`) | `/api/media/generate-image`, `/api/media/animate-image` (nếu mở rộng Studio AI) |

### 3.2 Cấu Trúc Thư Mục Hiện Tại
```text
/
├── index.html                        # Khai báo Google Fonts & metadata
├── metadata.json                     # Tên app & mô tả ngắn
├── package.json                      # Scripts: dev (tsx server.ts), build (vite build), lint (tsc --noEmit)
├── server.ts                         # Express server (port 3000) + Vite middleware + /api/health & /api/media/*
├── public/
│   └── media/                        # Badges CLB (.png/.svg) & Minifaces cầu thủ (.png)
└── src/
    ├── index.css                     # Tailwind v4 + font tokens + custom scrollbar
    ├── main.tsx                      # Entry point mount <App />
    ├── App.tsx                       # Root state (CareerState), localStorage sync, Sidebar, Topbar, Theme CSS vars
    ├── types/
    │   └── game.ts                   # Toàn bộ TypeScript interfaces & unions
    ├── data/
    │   ├── premierLeague2627.ts      # 20 CLB PL chi tiết, dữ liệu EFL (CHAMP/L1/L2), COMPETITION_THEMES, FORMATION_SLOTS, HONORs, PLAYLISTS
    │   └── mediaManifest.ts          # Map ID/Tên CLB & Cầu thủ -> đường dẫn ảnh cục bộ /public/media/
    ├── engine/
    │   ├── gameLogic.ts              # Round-robin, Cup brackets, Calendar, Match Sim, Poisson parallel sim, Transfer/Contract eval, Promotion/Relegation
    │   └── gameLogic.test.ts         # Unit tests cho engine
    ├── utils/
    │   ├── i18n.ts                   # Từ điển song ngữ EN/VI + formatCurrency (£M / £K)
    │   ├── playerAttributes.ts       # Sinh 34 sub-attributes EA FC từ 7 chỉ số gốc & normalizePlayer()
    │   └── sound.ts                  # Web Audio SFX (click, swap, whistle, goal, accept, reject)
    └── components/
        ├── NewCareerScreen.tsx       # Màn hình tạo HLV & chọn giải/CLB
        ├── MatchdayView.tsx          # Trung tâm ngày thi đấu (Training/Recovery/Pre-Match/Live/Post-Match)
        ├── MatchReportPanel.tsx      # Báo cáo trận đấu 3 tab: Timeline 2 cánh, Stats, Player Ratings
        ├── TeamCalendarView.tsx      # Lịch tháng (7 cột Mon-Sun) + Advance tới ngày mục tiêu
        ├── LineupTacticsView.tsx     # 3 tab: Squad (kéo thả), Tactical (Role trên sân + slider), Team Roles
        ├── PitchBoard.tsx            # Sân bóng 2D SVG + Token cầu thủ kéo thả + hiển thị Captain/Suspended/Fitness
        ├── SquadHubView.tsx          # Danh sách đội + thẻ tóm tắt + View Profile + Đổi số áo/Bán/Thanh lý
        ├── PlayerProfileModal.tsx    # Modal 4 tab (Overview, Attributes, Stats, Contract) + Scouting gate
        ├── PlayerComparisonModal.tsx # Modal so sánh song song 2 cầu thủ
        ├── FifaAttributesGrid.tsx    # Lưới 7 nhóm chỉ số + thanh tiến độ màu theo ngưỡng 85/75/65
        ├── TransfersView.tsx         # 3 tab (Search, Scouting, Transfer Hub) + filter/sort
        ├── TransferNegotiationModal.tsx # Đàm phán phí chuyển nhượng với CLB bán
        ├── ContractNegotiationModal.tsx # Đàm phán lương, năm hợp đồng, lót tay, thưởng bàn thắng
        ├── StandingsFixturesView.tsx # Standings (League + Cup + Thống kê Vua phá lưới/Kiến tạo) & Fixtures
        ├── AcademyFinanceView.tsx    # Học viện trẻ (AcademyView) & Tài chính/Sổ cái (FinanceView)
        ├── MediaStudioView.tsx       # Tủ danh hiệu & Kỷ lục CLB (Club Honours)
        ├── CustomAndAudio.tsx        # Cài đặt HLV/Ngôn ngữ/Âm thanh/Reset + Widget Spotify & Synth Radio
        └── ClubBadge.tsx             # Component ClubBadge & PlayerAvatar (ưu tiên ảnh thật, fallback SVG thông minh)
```

---

## 4. Hệ Thống Giải Đấu Anh & Vận Hành Song Song

### 4.1 Tháp Bóng Đá Anh (4 Hạng Đấu Chơi Được + 3 Cúp)

| ID | Tên giải đấu | Số CLB | Số vòng đấu | Quy tắc lịch | Ghi chú mô phỏng |
|---|---|---|---|---|---|
| `PL` | Premier League | **20** | **38 vòng** | 1 chu kỳ lượt đi - về (7 ngày/vòng, bắt đầu `15/08`) | Đầy đủ đội hình 20 CLB thật |
| `CHAMP` | EFL Championship | **24** | **46 vòng** | 1 chu kỳ lượt đi - về (trải đều 273 ngày, bắt đầu `08/08`) | Hỗ trợ chọn cầm quân & đầy đủ BXH |
| `L1` | EFL League One | **12** (mô phỏng đại diện) | **44 vòng** | **2 chu kỳ** lượt đi - về (`11 * 2 * 2 = 44`) | Dùng `buildSynthesizedEflClub` khi cầm quân |
| `L2` | EFL League Two | **12** (mô phỏng đại diện) | **44 vòng** | **2 chu kỳ** lượt đi - về (`11 * 2 * 2 = 44`) | Dùng `buildSynthesizedEflClub` khi cầm quân |
| `FACUP` | FA Cup | **32 đội** | Round 3 → Final (R3..R7) | Knock-out 1 lượt (hòa đá Penalty), tháng 01–05 | 20 đội PL + 12 đội top CHAMP (đảm bảo có CLB người chơi) |
| `CARABAO` | Carabao Cup | **32 đội** | Round 3 → Final (R3..R7) | Knock-out 1 lượt (hòa đá Penalty), tháng 09–02 | Tự động bốc thăm vòng kế khi vòng trước đá hết |
| `SHIELD` | Community Shield | **2 đội** | 1 trận (Final) | `09/08` đầu mùa | Vô địch PL vs Vô địch FA Cup (hoặc á quân/CLB mặc định mùa 1) |

### 4.2 Cơ Chế Thăng Hạng & Xuống Hạng (Promotion & Relegation)
Được xử lý ở cuối mùa bởi `computeSeasonEndSummary()` và `advanceToNextSeason()`:
- **Premier League ↔ Championship:**
  - Xuống hạng: **3 đội cuối bảng PL** (hạng 18, 19, 20).
  - Thăng hạng: **Top 2 CHAMP** lên thẳng + **Play-off (hạng 3–6)** lấy 1 suất (Bán kết #3 vs #6, #4 vs #5 → Chung kết 1 lượt).
- **Championship ↔ League One:**
  - Xuống hạng: **3 đội cuối bảng CHAMP**.
  - Thăng hạng: **Top 2 L1** lên thẳng + **Play-off (hạng 3–6 L1)** lấy 1 suất.
- **League One ↔ League Two:**
  - Xuống hạng: **2 đội cuối bảng L1**.
  - Thăng hạng: **Hạng 1 L2** lên thẳng + **Play-off (hạng 2–5 L2)** lấy 1 suất.
- **Thưởng mùa giải (`prizeMoney`):**
  - `baseTierPrize`: PL `£42M`, CHAMP `£14M`, L1 `£5.2M`, L2 `£2.4M` nhân hệ số thứ hạng (`1.35 - (rank - 1) * 0.045`, min `0.35`).
  - `promotionBonus`: Lên PL `+£45M`, lên CHAMP `+£8M`, lên L1 `+£2.5M`.

---

## 5. Mô Hình Dữ Liệu Cốt Lõi (Core Data Schema)

### 5.1 `CareerState` (Trạng thái lưu trong `localStorage`)
```ts
export interface CareerState {
  version: number;                        // 2
  seasonIndex?: number;                   // 0 = 2026/27, 1 = 2027/28...
  seasonLabel?: string;                   // "2026/27"
  coach: CoachProfile;                    // { firstName, lastName, nickname, nationality, dob }
  clubId: string;                         // ID CLB đang dẫn dắt
  userLeagueId?: CompetitionId;           // 'PL' | 'CHAMP' | 'L1' | 'L2'
  boardSatisfaction: number;              // 0..100 (khởi đầu 72)
  currentDayIndex: number;                // Con trỏ ngày hiện tại trong calendar[]
  currentRound: number;                   // Vòng giải VĐQG hiện tại
  calendar: CalendarDay[];                // Chuỗi ngày TRAINING / RECOVERY / MATCHDAY
  clubs: Club[];                          // Các CLB đầy đủ cầu thủ (PL + giải người chơi)
  leagueTeams?: Record<'PL'|'CHAMP'|'L1'|'L2', ContextTeam[]>; // Danh sách đội mỗi tier sau thăng/xuống hạng
  fixtures: Fixture[];                    // Lịch thi đấu giải VĐQG của người chơi
  contextStandings: Record<CompetitionId, StandingRow[]>;
  contextFixtures: Record<CompetitionId, Fixture[]>;
  transferTargets: TransferTarget[];      // Toàn bộ cầu thủ các CLB khác để scout/mua
  academy: AcademyPlayer[];               // 8 cầu thủ trẻ học viện
  financeLedger: FinanceEntry[];          // Sổ cái thu chi chi tiết
  openingBudget: number;
  budget: number;
  careerTrophies?: CareerTrophy[];        // Các danh hiệu HLV đã giành được
  pendingSeasonSummary?: SeasonEndSummary | null;
  seasonHistory?: SeasonEndSummary[];
  settings: {
    language: 'en' | 'vi';
    soundEnabled: boolean;
    spotifyPlaylistIndex: number;
  };
}
```

### 5.2 `Player` & Hệ Thống Chỉ Số EA FC / FIFA
- **Thông tin cơ bản:** `id`, `name`, `nationality`, `age`, `heightCm`, `preferredFoot` (`Right`/`Left`), `weakFoot` (`1..5`), `skillMoves` (`1..5`), `attackingWorkRate` & `defensiveWorkRate` (`Low`/`Medium`/`High`), `playStyles` (`string[]`), `shirtNumber`, `position` (`GK | DEF | MID | FWD`), `ovr`, `potential`.
- **Trạng thái mùa giải:** `fitness` (`0..100`), `suspendedMatches`, `yellowCards`, `redCards`, `goals`, `assists`, `cleanSheets`, `appearances`.
- **Hợp đồng & Chuyển nhượng:** `marketValue`, `weeklyWage`, `contractExpiry` (năm hết hạn), `squadStatus` (`Crucial | Important | Rotation | Sporadic | Prospect`), `releaseClause`, `goalBonus`, `forSale`, `role` (`15 PlayerRole` từ `Sweeper Keeper` đến `Complete Forward`).
- **34 Sub-Attributes thuộc 7 nhóm (`PlayerAttributes`):**
  1. **Pace (`pace`):** `acceleration`, `sprintSpeed`
  2. **Shooting (`finishing`):** `positioning`, `finishing`, `shotPower`, `longShots`, `volleys`, `penalties`
  3. **Passing (`passing`):** `vision`, `crossing`, `fkAccuracy`, `shortPassing`, `longPassing`, `curve`
  4. **Dribbling (`dribbling`):** `agility`, `balance`, `reactions`, `ballControl`, `dribbling`, `composure`
  5. **Defending (`defending`):** `interceptions`, `headingAccuracy`, `defAwareness`, `standingTackle`, `slidingTackle`
  6. **Physical (`physical`):** `jumping`, `stamina`, `strength`, `aggression`
  7. **Goalkeeper (`goalkeeper`):** `diving`, `handling`, `kicking`, `positioning`, `reflexes`
- **Cơ chế tự đồng bộ (`normalizePlayer`):** Nếu dữ liệu cầu thủ chỉ có 7 chỉ số gốc, `buildDetailedAttributes()` dùng PRNG theo hạt giống (seeded by `player.id + ovr + position`) để sinh ra 34 chỉ số phụ nhất quán.

### 5.3 `Club`, `TacticsConfig`, `TeamRoles`
- **Sơ đồ (`FORMATION_SLOTS`):** `4-3-3`, `4-2-3-1`, `4-4-2`, `3-5-2`, `3-4-3`, `5-3-2` — mỗi vị trí có tọa độ `(x%, y%)` trên sân 2D và `label` (`GK`, `LB`, `CB`, `CDM`, `CM`, `CAM`, `LW`, `RW`, `ST`...).
- **Chiến thuật (`TacticsConfig`):**
  - `preset`: `Gegenpress` | `Tiki-Taka` | `Counter-Attack` | `Wing Play` | `Park the Bus` | `Balanced`
  - `buildUpStyle`: `Short Passing` | `Balanced` | `Direct Passing` | `Long Ball`
  - `defensiveApproach`: `High Press` | `Balanced` | `Mid Block` | `Deep Block`
  - Thanh trượt `1..10`: `playersInBox`, `attackingWidth`, `defensiveLine`
- **Vai trò đội (`TeamRoles`):** `captainId`, `penaltyId`, `freeKickId`, `leftCornerId`, `rightCornerId`.

---

## 6. Engine Mô Phỏng & Công Thức Logic (`src/engine/gameLogic.ts`)

### 6.1 Xếp Lịch Thi Đấu (Berger Double Round-Robin)
- Thuật toán vòng tròn Berger cho `n` đội:
  - Cố định phần tử đầu tiên, xoay vòng `n-1` phần tử còn lại qua `halfRounds = n - 1` vòng.
  - Lượt về đảo ngược sân nhà/sân khách của lượt đi.
  - Nếu `cycles = 2` (L1, L2 12 đội), lặp lại quy trình để đạt `44` vòng.
- `buildCalendarForUserClub()`: Lấy mọi trận của CLB người chơi (League + Cup), tự động chèn các ngày `RECOVERY` (sau trận +1 ngày) và `TRAINING` (giữa tuần nếu khoảng nghỉ >= 4 ngày). Khi user thắng cúp tiến vào vòng tiếp theo, `insertCupMatchdayIntoCalendar()` tự động chèn lịch đấu cúp mới vào Calendar.

### 6.2 Mô Phỏng Trận Đấu Chi Tiết (`simulateMatch`)
1. **Tính sức mạnh tuyến (`getTeamStrength`):**
   - `playerEffectiveOvr = ovr * (0.8 + (fitness / 100) * 0.2)`
   - Chia 4 tuyến: `attack` (FWD), `midfield` (MID), `defense` (DEF), `gk` (GK.goalkeeper).
   - `tacticalBonus`:
     - `Gegenpress` & `fitnessAvg > 82`: `+1.4`
     - `Tiki-Taka`: `+1.1`
     - `High Press` & `defensiveLine >= 7`: `+0.6`
     - `playersInBox >= 7`: `+0.5`
     - Có `captainId` trong đội hình đá chính: `+0.45`
2. **Vòng lặp 90 phút (bước nhảy 3 phút: `4', 7', ..., 90'`):**
   - Lợi thế sân nhà `+2.2`; chênh lệch người trên sân (thẻ đỏ) `±0.35`.
   - Mối bước quay `rand()` xác định cơ hội đội nhà (`~0.26 + edge`), cơ hội đội khách (`~0.24 + edge`), hoặc pha phạm lỗi/thẻ vàng/thẻ đỏ thứ 2 (`roll < 0.72`).
   - Chọn cầu thủ ghi bàn & kiến tạo theo trọng số (`scoreWeight`, `assistWeight`) — **cầu thủ giữ `penaltyId`, `freeKickId`, `leftCornerId`, `rightCornerId` được cộng trực tiếp `+3` đến `+5` trọng số**.
   - Phút `64'` và `76'`: Tự động ghi nhận sự kiện thay người (`SUB`) từ ghế dự bị.
3. **Thống kê & Chấm điểm (`MatchStats` & `PlayerMatchRating`):**
   - Kiểm soát bóng: `50 + (midDiff + ShortPassingBonus) * 1.4 ± 3` (kẹp trong `32%..68%`).
   - Điểm cầu thủ: `6.3 + (ovr - 78)*0.05 ± random + 1.15*goals + 0.65*assists - 0.25*yellow - 1.6*red + 0.6(cleanSheet GK/DEF) + 0.35(win)`, kẹp `4.5..10.0`. Cầu thủ điểm cao nhất nhận danh hiệu **MVP**.
4. **Thẻ phạt & Treo giò:**
   - Đủ bội số **5 thẻ vàng** (`yellowCards % 5 === 0`) → `suspendedMatches += 1`.
   - **Thẻ đỏ** → `suspendedMatches += 1`.
   - Mỗi trận qua đi giảm `suspendedMatches` đi 1 cho các cầu thủ đang thụ án.

### 6.3 Mô Phỏng Giải Đấu Song Song (Poisson Model)
- Các giải người chơi không cầm quân (3 giải còn lại) được tính theo phân phối Poisson (`samplePoisson`) dựa trên chênh lệch `OVR` trung bình đội hình + lợi thế sân nhà (`+2.2`):
  - `lambdaHome = clamp(0.55, 3.15, 1.48 + ((hOvr + 2.2 - aOvr) / 14) * 0.55)`
  - `lambdaAway = clamp(0.45, 2.85, 1.18 - ((hOvr + 2.2 - aOvr) / 14) * 0.50)`
- Đảm bảo tỉ số tự nhiên đa dạng (`0-0`, `2-1`, `3-0`, `4-2`...) thay vì kẹt `0-0`/`0-1`.

### 6.4 Đàm Phán Chuyển Nhượng & Hợp Đồng
- **Chuyển nhượng (`evaluateTransferOffer`):**
  - Trả trước theo kỳ hạn (`installments`): `0` (100%), `12` (55%), `24` (40%), `36` (30%).
  - Giá trị trao đổi cầu thủ (`exchangePlayer`) được định giá `85% marketValue`.
  - `askingPrice = marketValue * 1.08`.
  - `totalPackage = transferFee + exchangeValue + bonusAfterAppearances * 0.6`.
  - Nếu `ratio >= 0.96` → **ACCEPTED** (chuyển sang đàm phán điều khoản cá nhân); `0.72..0.95` → **IN_PROGRESS**; `< 0.72` → **REJECTED**.
- **Hợp đồng (`evaluateContractOffer`):**
  - Yêu cầu ngay: `signingFee + agentFee <= availableBudget`.
  - Đánh giá điểm hài lòng `satisfaction` theo tỷ lệ lương đề nghị vs `110% lương hiện tại`, phí lót tay, thời hạn `2..4 năm`, cam kết `squadStatus`, thưởng bàn thắng. Ngưỡng ký thành công: `satisfaction >= 68%`.

### 6.5 Tài Chính & Phát Triển Theo Mùa
- **Thu chi ngày thi đấu:**
  - Doanh thu vé + bản quyền theo hạng đấu (Sân nhà `100%`, Sân khách `35%`): PL `£1.45M`, CHAMP `£520K`, L1 `£240K`, L2 `£120K`.
  - Chi phí mỗi vòng VĐQG: Tổng `weeklyWage` của đội + `goals * goalBonus`.
- **Chuyển mùa (`rollOverClub`):**
  - `age + 1`; nếu `age <= 23` và `ovr < potential` → `ovr + 1`; nếu `age >= 33` và `ovr > 62` → `ovr - 1`.
  - Hợp đồng sắp hết hạn được gia hạn tự động tối thiểu `+1` năm; reset `yellowCards`, `redCards`, `goals`, `assists`, `cleanSheets`, `appearances`, `fitness = 100`.

---

## 7. Chi Tiết 12 Màn Hình & Luồng UI/UX

1. **New Career (`NewCareerScreen.tsx`):**
   - Hero ảnh SVĐ ban đêm, toggle EN/VI.
   - Form HLV: First Name, Last Name, Nickname, Nationality (dropdown 30 quốc gia), DOB.
   - 4 Tab giải đấu (`PL`, `CHAMP`, `L1`, `L2`) + lưới chọn CLB hiển thị badge, ngân sách mở màn, OVR trung bình 11 cầu thủ chính.
2. **Matchday (`MatchdayView.tsx`):**
   - Thanh điều khiển ngày hiện tại: `Advance` (qua ngày Training/Recovery), `Auto Advance` (tua nhanh tới ngày Matchday kế tiếp), `Starting XI` / `Opponent XI` (modal xem đội hình 2 bên).
   - Khi là ngày `MATCHDAY`: Nút `Kick Off (Live Sim)` chạy đồng hồ `1' -> 90'` kèm phát sự kiện & âm thanh bàn thắng/còi, hoặc `Quick Sim` trả kết quả ngay, nút `Continue to Next Day` sau trận.
   - Cảnh báo chặn đá nếu đội hình chính thiếu 11 người hoặc có cầu thủ bị treo giò.
3. **Calendar (`TeamCalendarView.tsx`):**
   - Lưới lịch tháng 7 cột (Mon–Sun), chọn tháng, điều hướng từng ngày.
   - Hiển thị icon đối thủ / badge giải đấu ngay trên ô ngày thi đấu; nhấn chọn ngày bất kỳ để `Advance to Date` (tự động chạy qua các ngày tập/hồi phục hoặc dừng nếu gặp Matchday chưa đá).
4. **Line Up (`LineupTacticsView.tsx` + `PitchBoard.tsx`):**
   - **Tab 1 — Squad:** Sân bóng 2D + Ghế dự bị (7 người) + Danh sách dự phòng (Reserves). Kéo thả HTML5 (`draggable`) để hoán đổi bất kỳ 2 vị trí nào; click 2 cầu thủ bất kỳ để mở `PlayerComparisonModal`.
   - **Tab 2 — Tactical:** Sân bóng hiển thị `Slot · PlayerRole`; click trực tiếp cầu thủ trên sân để đổi 1 trong 15 `PlayerRole`; bảng chọn Preset, Formation (6 sơ đồ), Build-up, Defensive Approach và 3 thanh trượt 1–10.
   - **Tab 3 — Team Roles:** 5 thẻ phân công **Captain (OVR)**, **Penalty (PEN)**, **Free Kick (FKA)**, **Left Corner (CRO)**, **Right Corner (CRO)** kèm nút `Auto-Assign Best Specialists`.
5. **Squad Hub (`SquadHubView.tsx` + `PlayerProfileModal.tsx`):**
   - Danh sách cầu thủ bên trái + nút bật chế độ so sánh (`Compare Players`).
   - Thẻ tóm tắt bên phải (Avatar, OVR/POT, Giá trị, Lương, Hết hạn HĐ, Squad Status, 7 Face Stats).
   - Nút **View Profile** mở modal 4 tab đầy đủ (`Overview`, `Attributes` 34 chỉ số, `Stats` mùa giải + kỷ luật, `Contract`), kèm các nút `Negotiate Renewal`, `Sell / Invite Bids`, `Release Player`, `Change Shirt Number`.
6. **Transfers (`TransfersView.tsx` + Modals):**
   - 3 sub-tab: `Search Players`, `Scouting` (đang/đã do thám), `Transfer Hub` (Shortlisted / Đang đàm phán).
   - Lọc theo tên/CLB, vị trí (`GK/DEF/MID/FWD`), CLB; sắp xếp theo cột.
   - Cầu thủ chưa scout sẽ ẩn OVR/Value/Sub-attributes (`??` / `Hidden`); hỗ trợ **Scout (2 ngày)** hoặc **Priority Report (lập tức)** cả trong panel và trong `PlayerProfileModal`.
   - Quy trình mua 2 bước: `TransferNegotiationModal` (tiền mặt, trả góp 12/24/36 tháng, cầu thủ trao đổi, thưởng số trận, % bán lại) → `ContractNegotiationModal`.
7. **Standings (`StandingsFixturesView.tsx`):**
   - Bộ lọc chuyển đổi giữa **7 giải đấu** (`PL`, `CHAMP`, `L1`, `L2`, `FACUP`, `CARABAO`, `SHIELD`).
   - Hiển thị BXH (`Pos`, `Club`, `P`, `W`, `D`, `L`, `GF`, `GA`, `GD`, `Pts`, `Form` 5 trận gần nhất W/D/L) + bảng **Top Scorers & Assist Leaders** (đặc biệt tính chuẩn từ toàn bộ `fixtures` khi là giải của người chơi).
8. **Fixtures (`StandingsFixturesView.tsx`):**
   - Xem lịch thi đấu theo từng giải & từng vòng (`Round 1..N` / `Round 3..Final`), click vào trận đã đấu để xem lại toàn bộ `MatchReportPanel`.
9. **Academy (`AcademyFinanceView.tsx`):**
   - Thống kê trận/bàn/kiến tạo đội trẻ; 8 thẻ cầu thủ U18–U20 kèm thanh `Development Progress` và nút `Promote to First Team`.
10. **Finance (`AcademyFinanceView.tsx`):**
    - 8 thẻ KPI tài chính (`Opening Budget`, `Available Budget`, `Weekly Payroll`, `Player Sales`, `Transfer Fees`, `Renewal Fees`, `Release Compensation`, `Goal Bonuses`) + Bảng `Transaction Ledger` lịch sử giao dịch.
11. **Club Honours (`MediaStudioView.tsx`):**
    - Không gian trưng bày thành tích CLB: Hero Banner, Cúp mục tiêu chiến dịch hiện tại (`Active Campaign`), Tủ cúp lịch sử 5 hạng mục (`League Titles`, `FA Cup`, `League Cup`, `European Honours`, `Community Shield` với SVG từng chiếc cúp), Kỷ lục mùa giải (`Matches`, `W-D-L`, `GF/GA`, `Biggest Win`, `Top Scorer`, `Assist Leader`, `Clean Sheet Leader`).
12. **Custom & Soundtrack (`CustomAndAudio.tsx`):**
    - Chỉnh sửa hồ sơ HLV (bao gồm Quốc tịch), chọn ngôn ngữ EN/VI, bật/tắt Sound FX, `Reset Career` (có xác nhận 2 bước).
    - **Floating Soundtrack Widget** (góc dưới bên phải): Luôn được mount cố định trong DOM (khi thu nhỏ chỉ ẩn bằng `opacity-0 pointer-events-none`, **không unmount iframe Spotify hay ngắt Web Audio Context**), giúp nhạc Spotify & **FC Menu Synth Radio** (4 hợp âm synth `A maj7 - G maj7 - F maj7 - Em7` chạy theo `tempoBpm` của playlist) tiếp tục phát xuyên suốt mọi màn hình.

---

## 8. Design System, Media & Âm Thanh

### 8.1 Bảng Màu Động Theo Giải Đấu (`COMPETITION_THEMES`)
App tự inject biến CSS vào `:root` (`--pitch-header-bg`, `--pitch-modal-bg`, `--pitch-accent`) dựa trên `userLeagueId`:

| Giải đấu | `bgGradient` | `headerBg` | `accentColor` | Nhận diện |
|---|---|---|---|---|
| **PL** (Premier League) | `from-[#1D0022] via-[#120016] to-[#08010D]` | `#38003C` | `#00FF85` | Tím hoàng gia + Xanh neon |
| **CHAMP** (EFL Championship) | `from-[#091834] via-[#061024] to-[#030712]` | `#0C234B` | `#38BDF8` | Xanh Navy EFL + Sky Blue |
| **L1** (EFL League One) | `from-[#2B0914] via-[#1B060D] to-[#0B0206]` | `#4C0519` | `#FB7185` | Đỏ rượu vang + Rose |
| **L2** (EFL League Two) | `from-[#05231D] via-[#041713] to-[#020B09]` | `#064E3B` | `#34D399` | Xanh lục bảo + Emerald |
| **FACUP** | `from-[#2B0712] via-[#1A050C] to-[#090205]` | `#881337` | `#FB7185` | Crimson |
| **CARABAO** | `from-[#062320] via-[#041715] to-[#020B0A]` | `#0F766E` | `#2DD4BF` | Teal |
| **SHIELD** | `from-[#231906] via-[#171004] to-[#090602]` | `#78350F` | `#FBBF24` | Gold / Amber |

### 8.2 Hệ Thống Tài Nguyên Media (`ClubBadge.tsx` & `mediaManifest.ts`)
- **Logo CLB (`ClubBadge`):** Tra cứu trong `AVAILABLE_BADGE_IDS` tại `/public/media/badges/`; nếu chưa có file ảnh hoặc load lỗi (`onError`), tự render huy hiệu khiên SVG 5 họa tiết (`solid`, `stripes`, `hoops`, `sash`, `halves`) theo màu áo CLB + `shortName`.
- **Ảnh cầu thủ (`PlayerAvatar`):** Tra cứu miniface từ `AVAILABLE_PLAYER_PHOTO_IDS` tại `/public/media/players/`; crop khung tròn tập trung phần đầu vai (`object-[50%_10%] scale-[1.24]`), viền màu CLB (hoặc vàng `#F59E0B` cho GK). Nếu chưa có ảnh, fallback SVG áo đấu mang số áo + chữ cái đầu tên.

### 8.3 Hệ Thống Âm Thanh Web Audio (`utils/sound.ts`)
6 hiệu ứng tổng hợp không cần file MP3 ngoài:
- `click`: Triangle wave `520Hz -> 280Hz` (60ms)
- `swap`: Sine wave `420Hz -> 680Hz` (100ms)
- `whistle`: Tiếng còi trọng tài `2400Hz -> 2650Hz -> 2380Hz` (250ms)
- `goal`: Hợp âm arpeggio `C5 (523.25) -> E5 (659.25) -> G5 (783.99)` (360ms)
- `accept`: `480Hz -> 720Hz` (220ms)
- `reject`: Sawtooth `260Hz -> 160Hz` (200ms)

---

## 9. Hướng Dẫn Remix / Remake (Extension Points & Prompt Mẫu)

### 9.1 Các Ý Tưởng Nâng Cấp Khi Remix / Remake
1. **Trung Tâm Thông Báo Góc Phải (Notification Inbox / Toast Feed):**
   - Theo dõi đề nghị mua cầu thủ từ các CLB AI (Incoming Bids), cảnh báo cầu thủ bị treo giò/chấn thương, cầu thủ sắp hết hạn hợp đồng (< 1 năm), cầu thủ trẻ học viện sẵn sàng lên đội 1.
2. **Hệ Thống Chấn Thương & Y Tế:**
   - Thêm thuộc tính `injuredMatches: number` và `injuryType` vào `Player`, phát sinh ngẫu nhiên trong trận hoặc ngày `TRAINING` nếu `fitness < 60%`.
3. **Nâng Cấp UX Bảng & Danh Sách:**
   - **Squad Hub:** Thêm thanh sort theo `OVR`, `Position`, `Market Value`, `Weekly Wage`, `Contract Expiry`.
   - **Match Report Ratings:** Mặc định sắp xếp theo thứ tự vị trí (`GK -> DEF -> MID -> FWD`), cho phép user click đổi sort theo `Rating` cao-thấp hoặc tên.
   - **Standings Zone Indicators:** Tô vạch màu & chú thích trực quan khu vực Vô địch / Cúp châu Âu / Play-off / Xuống hạng ngay trong bảng xếp hạng từng giải (`PL`, `CHAMP`, `L1`, `L2`).
   - **Auto-Confirm Post-Match:** Khi hoàn thành trận ở `MatchdayView` mà người chơi chuyển thẳng sang tab khác, tự động đánh dấu hoàn tất ngày thi đấu (`Continue to next day`) để tránh kẹt trạng thái.
   - **Season-End Modal/Banner tại MatchdayView:** Hiển thị màn hình tổng kết `pendingSeasonSummary` (Danh sách đội lên/xuống hạng, kết quả Play-off, nút `Start Next Season`) gọi `advanceToNextSeason()`.
4. **Mở Rộng Giải Đấu Toàn Cầu:**
   - Nhân bản cấu trúc `PL/CHAMP/L1/L2` để thêm La Liga, Bundesliga, Serie A, Champions League (UEFA League Phase + Knockout) dựa trên cùng mô hình `ContextTeam` + `syncParallelCompetitions()`.
5. **AI Commentary & Media Studio:**
   - Kích hoạt lại endpoint `/api/media/generate-image` (`gemini-3-pro-image-preview`) và `/api/media/animate-image` (`gemini-omni-1.2-flash`) có sẵn trong `server.ts` để tạo poster ngày thi đấu hoặc video ăn mừng chức vô địch.

### 9.2 Prompt Mẫu Để AI Assistant Remake Nhanh
```text
Hãy xây dựng ứng dụng web Quản lý Bóng đá "PITCH" bằng React + TypeScript + Tailwind CSS v4 theo kiến trúc trong file PITCH_REMAKE_SPEC.md:
- Giao diện Broadcast Dark đổi màu động theo giải đấu (COMPETITION_THEMES).
- Hỗ trợ 4 hạng đấu Anh chơi được (PL 20 đội/38 vòng, CHAMP 24 đội/46 vòng, L1 44 vòng, L2 44 vòng) + FA Cup, Carabao Cup, Community Shield mô phỏng song song theo ngày bằng Poisson + Berger Round-Robin.
- Đầy đủ 11 màn hình quản lý: Matchday (Live Sim 90p / Quick Sim), Calendar (chọn ngày tua lịch), Line Up (3 tab: Squad kéo thả + so sánh, Tactical Role trên sân 2D, Team Roles đá phạt/đội trưởng), Squad Hub (có View Profile 4 tab & sort Value/Wage/Contract), Transfers (Scout 2 ngày/Khẩn + Đàm phán CLB + Hợp đồng), Standings (vạch màu lên/xuống hạng + Vua phá lưới/kiến tạo), Fixtures, Academy, Finance, Club Honours (Tủ cúp), Custom & Spotify/WebAudio Synth Radio chạy nền khi thu nhỏ.
- Cuối mùa tự động chạy Play-off và thực thi Thăng hạng / Xuống hạng chuyển sang mùa giải kế tiếp, lưu toàn bộ trạng thái vào localStorage.
```
