# Deckout

**English** · [한국어](README.ko.md)

> Classic Breakout × deckbuilding roguelite. **Every ball you fire is a card in your deck.**

### [▶ Play in your browser](https://xgeekover.github.io/deckout/)

No install. Works on desktop (mouse · keyboard) and on phones (touch). Records are stored only in your own browser. The game is in English by default; switch to Korean under **Settings → Language**.

> 📱 **On a phone, turn it sideways** — the playfield is a wide 900×640, so the game gets much bigger. On Android the `⛶` button goes fullscreen (and locks landscape). On iPhone, use Safari's Share → **Add to Home Screen** and launch it from the icon to get rid of the address bar.

![Deckout gameplay](docs/gameplay.gif)

<sub>A real recording — two bomb-brick chain explosions (9 and 11 bricks) with a combo → wave 1 clear → picking a relic (Wide Paddle) with the `3` key → wave 2 (Checkerboard). Every brick break and the wave clear happened through the normal game path; the only automated part is the paddle following the ball.</sub>

## Features

- **Turn-based Breakout** — draw a card from your deck and fire that kind of ball. Lose the ball and the turn ends: every brick drops one row and a new row slides in from the top. If a brick reaches the warning line (the deadline), you lose.
- **Deckbuilding** — clear a wave to pick one of three rewards. Grow your deck with new ball cards (Basic · Heavy · Pierce · Bomb · Split) or take a passive relic.
- **4 relics** — 🏓 Wide Paddle · 🔥 Flame Trail · 🕸️ Safety Net · ♻️ Scrap Cycle.
- **6 wave patterns** — Standard · Checkerboard · Inverted Triangle · Shield Wall · Diamond · Columns. HP and the share of tough bricks rise with each wave.
- **Game feel** — particles, screen shake, hit-stop, ball trails, combo popups, chained bomb explosions, synthesized WebAudio sound effects.
- **Arcade cabinet layout** — the playfield fills the window on every screen size; the score line runs along the top (SCORE · HI · WAVE · COMBO · DEADLINE) and the status line along the bottom (current card · relics · a blinking PRESS SPACE prompt), in pixel fonts, with optional CRT scanlines. Deck, records and settings sit behind `☰`.
- **Fully playable from the keyboard** — launch, pick rewards (`1` `2` `3`), skip, mute and retry, all without a mouse.
- **Saved records** — high score, best wave, all-time bricks destroyed and your settings persist in LocalStorage.
- **English and Korean** — every on-screen string lives in one dictionary; the language is a saved setting.
- **Engine fully separated from UI** — the 60fps canvas loop runs in a class-based engine that knows nothing about React; React only subscribes to state snapshots.

Stack: Vite · React 19 · TypeScript · Tailwind CSS 4 · Canvas 2D. React is the only runtime dependency.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build
npm run lint     # oxlint
```

### Deployment

Pushing to `main` makes GitHub Actions (`.github/workflows/deploy.yml`) lint → build → deploy to GitHub Pages. Pages serves from a sub-path named after the repository (`https://<user>.github.io/deckout/`), so `base` in `vite.config.ts` is a relative path (`./`) — built with the default (`/`), the page looks for `/assets/...` at the domain root, gets 404s, and renders blank. It is a static site with no server, so `dist/` can go on any static host.

## Controls

| Input | Action |
|---|---|
| Mouse move | The paddle follows (damped interpolation). It tracks x **anywhere in the window**, so the paddle still reaches the wall when the cursor leaves the canvas. Set paddle control to `Keyboard` in the HUD and the mouse no longer drags it around |
| Touch | **Drag on the canvas to move the paddle (never launches); a short tap launches.** Picking rewards and retrying are button taps. Always works, whatever the control setting |
| `A` `D` / `←` `→` | Move the paddle |
| `Space` / `Enter` / left click | Launch the waiting ball (right and middle clicks are ignored) |
| `1` `2` `3` | Pick a reward card (reward screen) |
| `0` / `S` | Skip the reward (reward screen) |
| `M` | Toggle mute |
| `⛶` button | Enter/exit fullscreen (the browser's `Esc` exits too). Hidden in browsers without support (iPhone Safari) |
| `☰` button | Open the panel with deck · relics · records · settings (sound, paddle control, CRT effect, language) · new game. **The game is paused while it is open** |
| `R` | Try again — only on the game-over and victory screens. To restart mid-run use "New game" in the HUD; if a run is in progress you must **press it again within 3 seconds** to confirm |

You can launch → pick rewards → retry entirely from the keyboard. The bottom line shows the prompt for the current phase, and the `☰` panel lists every key that works right now.

Before launch the ball sits on the paddle, and **the aim line tilts in the direction you move the paddle** (up to ±36°).

## Rules

**One turn = one card = one ball.**

1. When a wave starts, your deck is shuffled into a draw pile. The starting deck is Basic Ball ×4 and Heavy Ball ×1.
2. Each turn draws one card and puts that ball on the paddle. The aim line tilts with the paddle's movement; launching sends the ball into the field.
3. When the ball (or, after a split, **every** ball) has fully left the bottom, the turn ends — the used card goes to the discard pile, and **every remaining brick drops one row while a new row enters at the top.** New rows arrive only up to a per-wave budget (the reinforcement budget: 5 rows on wave 1, +1 per wave); the descent continues after that. When the draw pile is empty the discard pile is reshuffled into it.
4. If the bottom of a brick reaches the **deadline** (40px above the paddle), the game is over. From the starting layout, doing nothing gets you there in 8 turns.
5. Destroy every brick on the field to clear the wave → choose one of three rewards (a ball or a relic; you may skip) → next wave. Clear wave 10 to win.

Combo rises with every brick hit, **is not broken by paddle bounces**, and resets to 0 only when you lose the ball. Score is brick max HP × 100, plus 500 per wave clear and 120 for each card left in the draw pile.

### Balls

| Card | Radius | Speed | Damage | Trait | Reward rarity |
|---|---|---|---|---|---|
| Basic Ball | 8 | 480 | 1 | — | COMMON |
| Heavy Ball | 12 | 390 | 3 | Slow and heavy | COMMON |
| Pierce Ball | 7 | 540 | 1 | Passes through bricks (does not bounce off them) | RARE |
| Bomb Ball | 11 | 420 | 1 | Every brick it destroys explodes: radius 74, damage 2 | RARE |
| Split Ball | 8 | 470 | 1 | Splits into three on its first brick hit (±28° around the bounce direction). The copies do not split again | RARE |

### Bricks

Color follows **current HP**, stepping down with each hit (red 5+ → orange 4 → pink 3 → purple 2 → blue 1). Bricks with 2+ HP also show the number and a health bar along the bottom. A **bomb brick**, with its blinking fuse, explodes when destroyed (radius 96, damage 2) and chains into other bomb bricks.

### Relics and reward odds

| Relic | Rarity | Effect |
|---|---|---|
| 🏓 Wide Paddle | COMMON | Paddle width +20% |
| 🔥 Flame Trail | RARE | All balls +15% speed, +1 damage |
| 🕸️ Safety Net | RARE | Once per wave, catches a ball falling off the bottom and bounces it back up |
| ♻️ Scrap Cycle | LEGENDARY | Reaching a 5 combo in one turn creates a Bomb Ball in the discard pile (gone when the wave ends) |

Rarity odds are COMMON 70% · RARE 25% · LEGENDARY 5%. Among the three cards at least one ball and one relic are guaranteed, and relics you already own never reappear.

## Screenshots

| Wave clear reward (pick 1 of 3) | Results (new record) |
|---|---|
| ![Reward modal](docs/reward-modal.png) | ![Result modal](docs/result-modal.png) |

## Architecture

```
React render tree          Canvas 60fps loop
─────────────────          ─────────────────
App / HUD / RewardModal    GameEngine (rAF, fixed timestep 1/120s)
      ▲        │             ├─ Physics (pure functions, no DOM)
      │        │             ├─ ParticleSystem (pooling + trauma shake)
      │        ▼             └─ entities/ Paddle · Ball · Brick
  GameState  commands
  snapshots  (launch/chooseReward/restart)
      └──── GameCanvas ────┘
```

- **The engine does not know React.** It does not listen to DOM events either; input is injected through the public methods `setPointer / setKeyDirection / launch`.
- **The UI does not know the canvas.** It only receives `GameState` snapshots through `engine.subscribe(listener)`. `patchState` does a shallow compare and emits only on frames where something changed, so there is no 60fps re-rendering.
- Physics runs in fixed-timestep substeps (1/120s), so it behaves identically at any frame rate; the per-frame accumulator is clamped to 0.25s to prevent a death spiral when a tab comes back.

### Files

| Path | Role |
|---|---|
| `src/config/balance.ts` | **Single source of balance/tuning parameters** + scaling formulas + consistency checks |
| `src/i18n/strings.ts` · `useStrings.ts` | **Single source of on-screen text** (English · Korean) / the React context that hands out the current language's dictionary |
| `src/utils/storage.ts` | LocalStorage persistence — records · settings (sanitized, failure-tolerant) |
| `src/engine/InputManager.ts` | DOM input → game command adapter. Per-phase key mapping |
| `src/audio/SoundManager.ts` | Synthesized WebAudio sound effects |
| `src/types/game.ts` | Contracts shared by engine and UI (`BallType` · `DeckCard` · `GameState` …), the `BALL_STATS` table |
| `src/engine/Physics.ts` | Circle–AABB collision and face detection, simultaneous multi-rect resolution, walls, angled paddle bounce (pure functions) |
| `src/engine/GameEngine.ts` | rAF loop, turn · wave · deck state machine, state emission |
| `src/engine/ParticleSystem.ts` | `Particle` class + fixed pool, spark/debris/explosion presets |
| `src/engine/FloatingText.ts` | Floating damage numbers · BOOM! · combo popups (capped at 140 at once) |
| `src/engine/Relics.ts` | Catalog of 4 passive relics + summing of always-on modifiers |
| `src/engine/Rewards.ts` | Three-card wave clear reward roll (rarity weights, one relic guaranteed) |
| `src/engine/WavePatterns.ts` | 6 per-wave layout patterns + HP scaling |
| `src/engine/ScreenShake.ts` | Intensity/duration screen shake (pure logic, no dependencies) |
| `src/engine/entities/*.ts` | Paddle / Ball / Brick |
| `src/components/GameCanvas.tsx` | Canvas DOM binding, DPR resize, input → engine |
| `src/components/HUD.tsx` | The full panel behind `☰`: wave · deck · current card · records · settings · new game |
| `src/components/ArcadeBar.tsx` | The arcade score line (top) and status line (bottom); one merged line on short landscape screens |
| `public/fonts/` | Press Start 2P (Latin) and a Galmuri 11 subset (Hangul) — the pixel fonts of the score line, both OFL |
| `src/components/useFullscreen.ts` · `useMediaQuery.ts` | Fullscreen API (support check · landscape lock attempt) / `matchMedia` subscription |
| `public/manifest.webmanifest` · icons | Launches fullscreen in landscape, without an address bar, when added to the home screen |
| `src/components/GameOverModal.tsx` | Results — stats · final deck · relics · NEW RECORD fireworks |
| `src/components/KeyHints.tsx` | Control guide (per phase, keyboard or touch) — in the `☰` panel, and over the playfield for the first turns on short landscape screens |
| `src/components/RewardModal.tsx` | Wave clear reward card picker |

---

Everything below is **design notes**: the decisions made while building this, and why.

## Collision handling

Brick collisions go through two stages: `Physics.resolveAABBBounce` → `Physics.resolveCircleVsRects`.

**1. Which face was hit** — `circleVsRect` takes the vector from the circle's center to the closest point on the AABB to get the normal, penetration depth and contact point, and picks the face (`top`/`bottom`/`left`/`right`) from the normal's dominant axis. If the center is inside the rectangle, it pushes out along the axis with the smallest distance to an edge. Corner hits, where the normal is close to diagonal, are re-decided by the **dominant axis of the incoming velocity**.

**2. Correct the position, then set the velocity** — instead of pushing out by the penetration depth, the ball is **snapped just outside that face** (`rect.x - r - skin`, etc.), leaving zero residual overlap, and the velocity on that axis is **forced to a sign** with `-Math.abs()` / `+Math.abs()`. Because that is not a plain sign flip, a ball that was already leaving never gets turned back inward → getting stuck is impossible by construction.

**3. All overlapping bricks at once** — handling only the deepest brick makes a ball straddling two bricks get pushed back and forth every step. `resolveCircleVsRects` gathers every overlapping rectangle and corrects/reflects **at most once per axis (x/y)**.

**4. Squeezed from both sides** — the gap between bricks (8px) is narrower than a ball's diameter (14–24px), so on that axis no position separates them. In that case the axis is left alone and the ball is sent back **along the orthogonal axis, against its direction of travel (the way it came)**. Pushing toward the nearest face instead would let a ball that burrowed in from below escape upward, straight through a row of bricks.

Verified by running `src/engine/Physics.ts` directly under Node 24's type stripping: across 11 launch angles × 60 seconds of simulation, 0 residual overlap · 0 field escapes · speed error < 1e-13 · 0 stuck frames, plus all 9 adversarial gap/corner cases passing.

## Turn cycle and state machine

```
        launch input            ball falls             descent animation ends
AIMING ──────────▶ PLAYING ──────────▶ TURN_RESOLVING ──────────────────▶ AIMING
  ▲                   │                      │
  │                   │ field emptied        │ a brick reaches the deadline
  │                   ▼                      ▼
  └── REWARD ◀── (wave < 10)              GAME_OVER
            (wave = 10) ▼
                   VICTORY
```

- **AIMING** — draws one card and pins that kind of ball just above the paddle's center. Launch input is accepted only while `turn.canLaunch = true`.
- **PLAYING** — when the ball has **fully** left the bottom (`y - radius > canvasHeight`), the `onBallLost` hook fires and turn resolution begins.
- **TURN_RESOLVING** — every remaining brick moves down one row (`height + gap` = 36px) and a new row slides into the vacated top row. A 0.34s ease-out, during which the paddle can still move. The turn counter goes up by 1 when it completes.
- **GAME_OVER** — entered if, right after the descent, the bottom of a brick touches the deadline (40px above the paddle, y=536). The `onGameOver(summary)` hook fires and React's `GameOverModal` shows the results. The loop stops 0.7s later so shake and particles can finish.
- **VICTORY** — clearing the target wave (`VICTORY_WAVE = 10`). The spec did not define a win condition, so this is an arbitrary value, adjustable through one constant.

### Making sure a turn always ends

With the paddle parked dead center, `aimAngle = -π/2` so `vx ≈ 0`; the ball reflects axis-aligned off the underside of a brick and returns to the exact center of the paddle (`offset = 0`, paddle velocity 0 → no spin), **bouncing straight up and down forever**. Two layers prevent this.

1. `Physics.ensureMinHorizontalSpeed` — right after a paddle bounce, keeps the speed but guarantees a minimum horizontal component (2% of speed), breaking the symmetry. Only 2%, to preserve the feel of "firing straight up". Once the ball is off-center, the offset-based bounce widens the angle by itself.
2. A `MAX_TURN_SECONDS = 45` stall watchdog — if a turn fails to end for any reason, it is resolved by force. A normal round trip takes about 2 seconds, so ordinary play never reaches this; it is insurance.

Verified: with the paddle fixed dead center and a vertical launch, before the fix the turn had not ended after 120 seconds / 54 paddle hits (`|vx| = 2.9e-14`); after it, the ball falls normally at 5.7s. All 7 cases with paddle x at 450/449/451/300/600/120/780 end in finite time.

The per-cell HP of new rows gets tougher **as waves go up** (and slightly more the longer you drag one wave out), while the chance of an empty cell goes down (`spawnDifficulty` · `spawnCellHp`). Empty cells are always left on purpose: if all 8 cells were filled every turn, one ball could never clear a row and the game would not work.

In the starting layout the bottom of the lowest row is at 264px, the deadline at 536px, and rows are 36px apart, so **untouched, you lose in 8 turns**.

## Game feel

| Effect | Implementation | Tuning |
|---|---|---|
| Particles | `ParticleSystem` — `Particle` objects (position · velocity · size · color · life · gravity · drag) in a fixed pool of 700; each frame only the live range is compacted forward with swap-remove | 4–6 sparks per hit / 15–20 shards per break / 52 per explosion (38 fire + 14 smoke) |
| Screen shake | `ScreenShake` — intensity (px) + duration (ms). **Requests weaker than what currently remains are ignored** | hit 1.5/70ms · break 2.6/100ms · explosion 9/250ms · paddle & ball loss 4/150ms |
| Hit-stop | Freezes physics and particles; only the shake keeps running | break 32ms · explosion 50ms |
| Ball trail | `Ball.history` — a queue of the last 8 frame positions, drawn additively with shrinking radius and alpha | Normal white · Bomb orange · Pierce neon blue · Heavy gold |
| Combo | +1 per brick hit. **Not broken by paddle bounces; resets only when the ball is lost** | Shown from 3 hits. One popup per collision |

**If there is nothing to draw, don't draw** — on the reward screen the modal covers the canvas and physics is stopped. Once the particles, text and shake from the clear have settled, update and render are skipped entirely (main thread 111ms/s → 19.8ms/s). `devicePixelRatio` is capped at 2 — the back buffer grows with DPR², so at DPR 3 that is 5.2 million pixels repainted every frame, and with glow-heavy graphics nothing visible is gained beyond 2. The width of each floating text is measured once, the first time it is drawn (`measureText` 3,116 calls → 82, for 82 texts).

**Why hit-stop leaves the `accumulator` alone** — saving up the frozen time and running it all afterward makes physics briefly speed up right after the freeze. The frame has to simply exit so that physics time does not pass at all (time-scale 0); only then does it read as the intended "hitch".

**One combo popup per collision** — a popup per brick hit means a chain explosion stacks several in one frame, producing unreadable text like `13 COMBO!BOOM!`. It is shown once with the final combo after collision handling is done, and in an ordinary rally (one hit at a time) only on odd combos, to keep the screen calm. `BOOM!` likewise appears only for the first two blasts of a chain; the rest is particles only.

**A weak shake must not extend a strong one forever** — with a condition like "ignore only if weaker **and** shorter", a frequent request such as the paddle rumble (4/150ms) keeps resetting the `elapsed` of an explosion (9/250ms) to 0, and the screen shakes at full strength for the whole rally. Requests are compared with the strength remaining right now (`intensity × (1 - elapsed/duration)`) and ignored outright if weaker.

**Settle window at the end of a run** — calling `stop()` the instant the phase becomes `GAME_OVER`/`VICTORY` gives the active shake no frames to decay, freezing the scene at a non-zero offset forever. Every later `render()` triggered by `resize()` would then be misaligned, so the loop runs 0.7s longer (`TERMINAL_SETTLE_SECONDS`) before stopping.

**Bounces are recomputed after an explosion** — the collision result is computed from the geometry *before* damage is applied. If an explosion removed those bricks in the meantime, the ball would bounce off bricks that no longer exist. After the blast the bounce is computed once more against the survivors.

**Why shake is applied in logical coordinates** — the order is `ctx.save()` → transform to logical units → `ctx.translate(offset)` → render → `ctx.restore()`, so the perceived strength is the same however CSS scales the canvas. Clearing the screen (`clearRect`) and the game-over overlay happen **outside** the shake — to avoid edge ghosting and unreadable text respectively.

### Bombs

- **Bomb Ball** (`BallType 'bomb'`) — every brick it destroys explodes at the hit point, radius 74, damage 2. Appears in the reward pool as a rare.
- **Bomb brick** (`BrickType 'bomb'`) — explodes when destroyed, radius 96, damage 2, and **chains**. Spawn chance rises with turns, 5% → 14% max.
- Chains are processed with a queue, not recursion, and cut off at `MAX_CHAIN_BLASTS = 24`. Confirmed numerically that even the worst case — every cell a bomb — ends at 24 blasts.

## Waves · rewards · relics

### Wave clear → reward → next wave

The moment every active brick is destroyed, `clearWave()` runs: pin the ball to the paddle's center → send the card in use to the discard pile → `phase = 'REWARD'` (in this phase `step()` does nothing, so physics stops) → roll three rewards → emit them through `GameState.rewardChoices` and the `onWaveClear(rewards, wave)` hook. React's `RewardModal` appears purely from that state; on a pick or skip it calls `engine.chooseReward(id)` / `engine.skipReward()`, and the engine advances the wave and returns to `AIMING`.

### Rewards (`RewardItem`)

`{ type: 'BALL', ball }` or `{ type: 'RELIC', relic }`. Relics you already own never come up again. While there are relics you do not yet have, **at least 1 of the 3 cards is a relic**, and **at least 1 is always a ball** — three balls would bury the relic system, and three relics would leave no way to grow the deck that wave, removing the core choice of "deck growth vs. passive". Once you own every relic, only balls appear.

### Relics (`Relic`)

Relics act in two ways — **always-on modifiers** (`modifiers`) that apply simply by being owned, and **hooks** the engine calls at particular moments. Hooks can affect the engine only through a `RelicContext` (spend a charge · create a card in the discard pile · announce); they cannot touch its internals. Runtime state such as remaining charges is held by the engine, not the relic object, so the catalog definitions are immutable.

| Relic | Rarity | Effect | How |
|---|---|---|---|
| 🏓 Wide Paddle | COMMON | Paddle width +20% | `modifiers.paddleWidthMul` — applied the moment you take it |
| 🔥 Flame Trail | RARE | Ball speed +15%, damage +1 (+ ember trail) | `modifiers` — from the next ball created |
| 🕸️ Safety Net | RARE | Prevents one fall per wave | `onBallFall` + `chargesPerWave: 1`. Recharged at wave start |
| ♻️ Scrap Cycle | LEGENDARY | Reaching a 5 combo in one turn creates a Bomb Ball in the discard pile | `onCombo(before, after)` |

The engine calls the spec's three hooks (`onPaddleHit` / `onBrickDestroy` / `onTurnEnd`) at the right moments, but none of the initial four relics fit them, so `onBallFall` and `onCombo` were added. Because an explosion can jump the combo from 3 to 9, Scrap Cycle asks not "did it reach 5?" but "did it **pass** 5?". The bomb it creates is a **temporary card** that disappears when the wave ends (so the permanent deck does not swell every turn).

### Reward feedback

A reward is applied the moment you pick it — a ball card joins the permanent deck (and is in the next wave's draw pile), a relic's modifiers take effect immediately — but that was easy to miss in play: the new card only shows up when the shuffle draws it, a wider paddle or a faster ball is subtle, and on a phone the deck and relics sit behind `☰`. So the next wave opens with a banner on the canvas — `+1 HEAVY BALL` in the ball's color, or `🏓 WIDE PADDLE` — and the newest relic icon pops on the status line. (Real-play feedback: "the items I got don't seem to apply.")

### Deck cycling

Three piles: `deck` (permanent) / `drawPile` / `discardPile`. At the end of a turn the used card goes to the discard pile, and when the draw pile runs out the discard pile is reshuffled into it. The permanent deck is reshuffled at the start of each wave, so a ball chosen as a reward is **already in the next wave's draw pile**.

### Wave scaling

| Wave | 1 | 2 | 3 | 4 | 5 | 6 | 7… |
|---|---|---|---|---|---|---|---|
| Pattern | Standard (40) | Checkerboard (20) | Inverted Triangle (20) | Shield Wall (32) | Diamond (18) | Columns (20) | cycles from #2 |

If `setGridConfig` makes the grid very small (say 2×2), a pattern like Diamond may fill no cells at all. A wave that starts with 0 bricks never reaches its "last brick destroyed" moment and would never end, so in that case the layout falls back to Standard.

`VICTORY_WAVE = 10`. Four things change together as waves go up (all in `src/config/balance.ts`).

| Wave | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| HP bonus on every brick `floor((w-1)×0.75)` | +0 | +0 | +1 | +2 | +3 | +3 | +4 | +5 | +6 | +6 |
| Tough brick (+1) chance | 0% | 12% | 24% | 36% | 48% | 60% | 60% | 60% | 60% | 60% |
| Starting rows lower (turns of slack before the deadline) | 0 rows (8) | 0 (8) | 0 (8) | 1 row (7) | 1 (7) | 1 (7) | 2 rows (6) | 2 (6) | 2 (6) | 3 rows (5) |
| Reinforcement budget (new rows) | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 |
| Expected HP of one new row | 7.3 | 8.1 | 8.9 | 9.8 | 10.6 | 13.4 | 16.4 | 17.6 | 18.7 | 23.0 |

Base HP per row, from the top, is `2, 2, 1, 1, 1`.

#### Why these numbers (bot measurements)

Driving the engine's `step()` in a synchronous loop simulates a several-minute run in a few seconds. Three bots of different skill were used (missing the ball 3% / 15% / 35% of the times it comes down).

The original balance had three problems.

1. **Wave 1 was the heaviest** — for the expert bot, wave 1 took 140s and wave 2 took 70s. The game opened on a full 40-cell, 72-HP grid, while later patterns had 18–32 cells.
2. **New rows got tougher with "turns elapsed since the start of the game"** — slower players accumulate more turns, get tougher rows, and get slower still: a vicious circle. The average bot's wave 3 became a 16-turn, 202-second swamp. → Difficulty now follows wave progress, plus a small surcharge only for how long you have dragged out the current wave.
3. **New rows never stopped coming** — for a player who clears bricks about as fast as they arrive, a wave had no upper bound on length. The beginner bot cleared wave 1 only 23% of the time, and so **never saw the reward screen (the game's core loop).** → A per-wave reinforcement budget.

With the budget in, it became too easy the other way (even the beginner bot won 14 of 30 runs), because endless new rows had been practically the only threat. Raising HP alone does not make a wave *more dangerous*, only *longer* (20+ minutes a run), so instead **later waves start lower down**, raising deadline pressure without adding length.

| Bot | Before | After |
|---|---|---|
| Expert (3% misses) | wave 1 140s / wave 2 70s | wave 1 66s, rising gently from 66 → 133s per wave · 73% win rate (the rest hit the 25-minute limit) |
| Average (15%) | wave 3 took 16 turns · 202s · median wave reached 5 | wave clear rate declines gently from 100% → 80% (wave 8) · median 9 · 43% win rate |
| Beginner (35%) | cleared wave 1 23% of the time · lost on waves 1–3 in all 30 runs | clears waves 1–3 100% of the time (so sees three rewards) → wave 4 73% → wave 8 23% · median 6 · 3% win rate |

The "after" figures are for a bot that, like a person, **moves the paddle under the lowest brick and fires straight up**. Taking the beginner bot's losses apart: in all 33 of them, the bottom row that touched the deadline held 2 bricks or fewer (just 1 in 25 of them) — what ends a run is not total HP but **a single straggler brick drifting down**. Every turn's launch is a free aimed shot you can spend on that straggler, and that is the key decision in this game.

Bots neither tire nor learn, so these figures are for **relative comparison** only. If real play disagrees, just change the numbers in the table above.

A ball bounced back by the Safety Net **passes through the paddle** on its way up. This is intentional — if it were blocked by the paddle's underside it would fall right back down, making the net useless whenever the paddle is above the ball.

### Dev handle

Only in DEV builds, the engine is exposed as `window.__deckout` (confirmed that not even the string survives in the production bundle). `__deckout.debugClearBricks()` destroys every remaining brick **through the normal damage path**, reproducing the wave clear flow deterministically — if the reward modal could only be reached by actually breaking all 40 cells, automated verification would be impossible.

## Balance · persistence · input

### Balance parameters (`src/config/balance.ts`)

The magic numbers once scattered across the engine, entities, physics, rewards and relics are gathered into a single `BALANCE` object. It is a pure module with no dependencies at all, so any layer can read it. Formulas are functions — `waveHpBonus(wave)` · `toughBrickChance(wave)` · `bombBrickChance(turn)` · `spawnDifficulty(wave, turnsInWave)` · `spawnCellHp(difficulty, r)` · `clampBallSpeed(speed)`.

- **Ball speed cap** `ball.maxSpeed = 720`. However many relic multipliers stack, it is never exceeded. Once travel per substep (720 × 1/120 = 6px) exceeds half the thinnest collider (the 16px paddle), discrete collision detection starts missing the ball, so `validateBalance()` checks consistency including this relationship, and in dev builds `main.tsx` calls it on startup and reports problems to the console. A guard against reintroducing tunneling while tweaking numbers.
- **Paddle forgiveness** `paddle.hitForgiveness = 4px`. It only rescues balls that narrowly miss the **corners of the top face** — the ball did not hit the real paddle, its center is above the top face, and even against the widened paddle the hit is still a "top" hit. Widening the whole paddle sideways also widens its side faces, producing a "ghost paddle" where balls passing beside the paddle bounce off thin air (it was first built that way and caught in review: a sweep of 160,000 positions around the paddle found 2,864 ghost collisions → 0). The bounce angle is computed from the real paddle, so the feel is unchanged.
- **Reward rarity odds** COMMON 70% · RARE 25% · LEGENDARY 5%. Rolling once over per-candidate weights lets the number of candidates at a rarity distort the odds (6 COMMON candidates inflate it 6×), so **the rarity is rolled first, then a candidate is chosen uniformly within it**. Rarities with no candidates are dropped and their probability redistributed proportionally. With a pool of 6 COMMON · 1 RARE · 1 LEGENDARY, 200,000 rolls → 69.91 / 25.10 / 4.99%.
- Behavior was unchanged by the refactor: all 7 physics · stuck-ball · soft-lock · juice · reward · pattern regressions pass, and the new-row HP formula showed 0 mismatches over 2 million continuous random samples.

### Persistence (`src/utils/storage.ts`)

`deckout:records:v1` (high score · best wave · all-time bricks destroyed) and `deckout:settings:v1` (mute · control mode · language · CRT effect). Storage is assumed to fail at any time — every access is wrapped in try/catch, every value read is sanitized (negatives · NaN · Infinity · strings · arrays · broken JSON → defaults), and if a write fails the game carries on with the in-memory values. The backend is injected as an argument, so it is verified without a DOM. Settings saved before the language field existed load as English with their other values intact.

New records: a score counts when it **beats** the previous one (ties and 0 do not), a wave when it beats the previous one and is at least wave 2 (so a first run does not announce "New record: wave 1"). A finished run is counted **exactly once**, from the engine's `onGameOver`/`onVictory` hooks; abandoning a run in progress with "New game" only adds its bricks destroyed.

### Languages (`src/i18n/strings.ts`)

Every on-screen string lives in one dictionary with two entries, `en` (the default) and `ko`, both typed by the same `Strings` interface — a key missing from one language is a compile error. Strings with numbers in them are functions (`turns(n)`, `reinforcementsLeft(rows)`), which is where English plurals are handled, and descriptions that quote balance values (`+20%`, `5 combo`) are built from `balance.ts`, so retuning updates the text too.

The engine stays language-agnostic. Its data (ball · relic · wave pattern names) takes the English text from the same dictionary, and the UI looks the current language up again **by id** (`ballType`, `relic.id`, `wavePatternId`), falling back to the data's own text for anything not in the dictionary. Text drawn on the canvas (`BOOM!`, `SAFETY NET!`, `+ BOMB BALL`, `DEADLINE`) is English in both languages. The language is a saved setting and also sets `<html lang>`; switching it mid-run does not remount the canvas, so the run carries on.

### Input (`src/engine/InputManager.ts`)

`resolveKey(key, phase)` reads the same key differently per phase — `1·2·3`/`0·S` are taken only on the reward screen, `R` only on the end screens, `Space`/`Enter` only during play (while a modal is up they are left to the focused button's default action). Beyond that: Ctrl/Cmd/Alt combinations are left alone (so `Cmd+R` refresh does not turn into a restart), one-shot commands fire once even when the key is held, and held keys are tracked normalized to lowercase (fixing a bug where pressing `a`, then releasing Shift, delivered the keyup as `A` and the paddle never stopped).

### Pointer following and touch

Pointer movement is listened to on the **whole window**, not the canvas, and the x at the moment the mouse leaves the window is taken too. An out-of-range x snaps to the nearer wall. It originally listened only on the canvas and set the follow target to `null` on leaving, which meant a mouse flung toward the wall to save a ball froze the paddle mid-interpolation as the cursor left the canvas — 69.6px short on a 129ms sweep, 143.2px (more than the 130px paddle) short on a 108ms sweep. Now the shortfall is 0px even on a 5ms teleport sweep.

Touch/pen follows **only drags that start on the canvas** (tracked by `pointerId`) — listening on the whole window meant a finger put down to scroll the HUD would drag the paddle too. And the only thing `Keyboard` control mode ignores is the mouse position: touch is always deliberate, so it is accepted in any mode. Otherwise, on a phone with no keyboard, one tap on `Keyboard` would remove every way to move the paddle, and because the setting is saved, a refresh would not fix it.

### Arcade layout (`src/App.tsx` · `src/components/ArcadeBar.tsx`)

There is one layout for every screen size: a score line on top, the playfield in the middle, a status line at the bottom — the way an arcade cabinet puts "1UP 012340 HI-SCORE" above the action and nothing else beside it. Everything that is not needed while a ball is in flight (deck, records, settings, new game, the key guide) lives behind `☰`.

- The playfield is the **largest 900:640 that fits between the two lines**: the middle area is a size container (`container-type: size`) and the inner box's width is `min(100cqw, 100cqh × 900/640)`, so whichever dimension is the tight one decides. On a 1280×800 window that is 1016×722 (72% of the window); the previous layout, with a full HUD beside the canvas, gave 902×641.
- **Short landscape screens** (`(orientation: landscape) and (max-height: 560px)`, i.e. a phone held sideways) merge both lines into one 32px line at the top and drop the less urgent fields (HI, TURN, ROWS, the card count), because every pixel of height goes straight to the playfield: 501×356 on an 844×390 screen. That is 8% less area than the previous side-column layout for landscape phones — the price of the consistent top-line look — while a phone held upright gets the full two lines plus a rotate hint under the canvas.
- Each line is `[a field area that may scroll sideways][buttons that never move]`. With the buttons inside the scrolling area, `☰ 🔊 ⛶` slid off the right edge on a 667px-wide phone and could not be tapped. On portrait phones the field area wraps onto two rows instead (height is free there), and the launch prompt takes a row of its own.
- **`GameCanvas` is never remounted** when the bars change shape (two lines ↔ one line, fullscreen on/off). A remount would create a new engine and wipe the run in progress. The siblings carry `key`s so the canvas keeps its position in the tree.
- While the `☰` panel covers the screen the engine is paused (`engine.setPaused`); `lastTime` keeps updating, so no backlog of time is simulated when it resumes.
- **Pixel fonts**: Press Start 2P for Latin and digits, and for Hangul a subset of Galmuri 11 containing only the 271 syllables used in the string dictionary (10KB instead of 505KB). Press Start 2P has no Hangul, so Korean labels fall through to Galmuri via the `font-family` list. Both are OFL and bundled in `public/fonts/`. The rest of the UI stays in the system sans — pixel type at modal sizes is tiring.
- **CRT effect**: a scanline pattern (`repeating-linear-gradient`, multiply-blended) plus a vignette, as two pseudo-elements over the canvas. Static gradients composite once and cost nothing per frame; the screen shake happens inside the canvas, so the "glass" stays still like a real tube. It can be turned off in settings (saved).
- The launch prompt blinks (`steps(1)` opacity), and stays lit under `prefers-reduced-motion`.
- **iPhone Safari does not support page fullscreen (the Fullscreen API)** — only video. So support is detected, the `⛶` button is hidden, and "Add to Home Screen" is suggested under the canvas in portrait — thanks to `manifest.webmanifest` (`display: fullscreen`, `orientation: landscape`) and the `apple-mobile-web-app-capable` meta tag, launching from the home screen icon opens without an address bar. The notch and home indicator are avoided with `viewport-fit=cover` + `env(safe-area-inset-*)`. Entering fullscreen attempts `screen.orientation.lock('landscape')`, which only works in Android Chrome's fullscreen, so failure is silently ignored.

### Modals

- Having declared `aria-modal`, the HUD is made **`inert`** while a modal is up. Otherwise 8 presses of Tab reach "New game" behind the modal, and a mouse can simply click it.
- Focus in the reward modal goes to the **dialog itself**, not the first card. On the first card, a finger still hitting Space to launch would pick it straight away. For the same reason clicks/Enter are ignored for the first 0.5–0.6s after a modal appears (`useActivationGrace`) — the `1·2·3` and `R` keys are deliberate input and are accepted immediately.
- Below `lg`, the modal is a **scrollable overlay covering the whole screen** rather than the canvas box, and a deck/relic summary is placed inside it in place of the hidden HUD. Confined to the canvas box (around 250px on a phone) with flex centering, the first of the vertically stacked cards gets pushed above the document (y=−236), where not even scrolling can reach it.
- The DMG/SPD on a reward card are not the base stat table but **the numbers of the ball that will actually fly, with your relics applied**.

### Results (`src/components/GameOverModal.tsx`)

A React modal replaced the canvas text overlay. Final wave · score · best combo · bricks destroyed, a summary of the final deck and relics, and on a new record a NEW RECORD badge on that tile + neon pulse + CSS fireworks (hidden under `prefers-reduced-motion`). The retry button is auto-focused, so `R` · `Enter` · `Space` · click all work.

### Sound (`src/audio/SoundManager.ts`)

Synthesized from oscillators and noise, with no audio files, and the engine knows nothing about sound — `App` receives the engine's hooks and passes them along. Per browser policy the context opens on the first key press or click.

## Engine hooks

Subscribe to gameplay events with `engine.setHooks({ ... })`. The engine knows neither sound nor storage — this is where those outer layers attach.

```ts
engine.setHooks({
  onTurnStart: (turn) => {},
  onLaunch: () => {},
  onPaddleHit: () => {},
  onBrickHit: () => {},                       // hit but not destroyed
  onBrickDestroyed: (brick) => {},            // brick is a plain data snapshot
  onExplosion: () => {},                      // several times in a chain
  onBallSplit: (count) => {},                 // number of copies spawned
  onBallLost: (turn) => {},
  onTurnEnd: (turn) => {},                    // descent resolved
  onWaveClear: (rewards, wave) => {},         // the three rewards rolled
  onRewardResolved: (picked) => {},           // null on skip
  onGameOver: (summary) => {},                // RunSummary: wave · score · combo · bricks · deck · relics
  onVictory: (summary) => {},
});
engine.setGridConfig({ rows: 6, cols: 10 }); // applies from the next wave
```

`src/App.tsx` uses these hooks to play sound effects, and in `onGameOver` / `onVictory` saves the records and then shows the results.

## How this was verified

There is no test runner yet. Instead, three things were run at every step.

- **Numerical simulation** — the pure modules (`Physics` · `balance` · `storage` · `strings` · `Rewards` · `Relics` · `WavePatterns` · `InputManager.resolveKey` · `ParticleSystem` · `ScreenShake`) have no DOM dependency and import with `.ts` extensions, so Node 24's type stripping runs **the real source as is**. Examples: 0 residual overlap · 0 field escapes · speed error < 1e-13 over 11 launch angles × 60 seconds of play; 0 ghost collisions in a 160,000-position sweep around the paddle; 69.91 / 25.10 / 4.99% over 200,000 rarity rolls; identical key structure across the English and Korean dictionaries, with no Korean in the English one.
- **Adversarial code review** — independent reviews were given the task "refute the claim that this code is correct", and only findings that came with an executed reproduction were accepted as bugs and fixed. That is how tunneling through the gap between adjacent bricks, the infinite vertical rally off the paddle's dead center (a soft-lock), weak shakes extending strong ones forever, ghost bounces off bricks an explosion had removed, and the ghost paddle were caught.
- **Browser measurement** — Playwright drives the real build and measures canvas pixels and the DOM (36px brick descent, a 36ms hit-stop freeze, paddle width 130→156px, LocalStorage values matching the numbers on the results screen, no Korean text anywhere on screen in any phase in English mode, the score line's buttons on screen and no clipped fields on six screen sizes × two languages × three phases, and so on).

## Known limitations and next steps

- Balance was tuned with bots. It is not data from people actually playing, and a full 10-wave run takes 17–19 minutes, which may be long for a light web game (adjust with `waves.victoryWave`).
- Bomb bricks always have 1 HP regardless of wave HP scaling (the intent: a bomb is a detonator, not a wall). Where one lands on the Shield Wall pattern's +2 row, only that cell is weak.
- The `tough`/`core` brick classification (`BrickType`) is emitted as data only and drives no behavior.
- Performance was measured only on an Apple M4 (headless with GPU acceleration): `render()` averages 0.35–0.58ms, worst case 3.1ms, 0 long tasks. Headless rAF is not vsync-locked, so **frame pacing on a real display and the cost on low-end/mobile GPUs are unmeasured**. Per-brick gradient/shadow caching was confirmed to change call counts but never shown to save time, so it was not applied.
- The layout was verified with device emulation (portrait 390×844 · landscape 844×390 and 667×375, touch, DPR 2–3). **Address bar collapsing, the notch, and home-screen launch on a real phone are unconfirmed.** Inside an iPhone Safari browser tab there is no way to remove the address bar (you have to add it to the home screen).
- The Hangul pixel font is subset to the syllables used in `src/i18n/strings.ts`; a new Korean string with a syllable outside that set falls back to the system font on the score line until the subset is regenerated (`pyftsubset`, see `public/fonts/README.md`).
- The English text has not been reviewed by a native-speaking editor. Code comments and commit messages are in Korean.
- If two tabs finish a run within about 1ms of each other, their record writes can overwrite one another (read-modify-write). It is practically impossible to happen naturally, so it was left alone. Record updates from other tabs reach the HUD through the `storage` event.
- The sound effects are synthesized and have not been tuned by ear. Bricks destroyed in a run in progress are not added to the total if you just close the page.
- Some numbers, such as `VICTORY_WAVE = 10`, are arbitrary — all of them are adjusted in `src/config/balance.ts`.
- Candidates: card upgrades/removal, boss waves, moving/healing bricks, seeded replays, adopting a test runner (moving the current Node simulation scripts into it).
