# Maalu Dadema (මාළු දඩයම) — The Great Fish Heist

**Just want to play?** Double-click `play.html`. It is the whole game in one file and needs no install or server (an internet connection only adds the Sinhala title font). `index.html` is the developer entry point and only works through `npm run dev`, because it loads the TypeScript source.

To rebuild `play.html` after changing the code: `npm run build:play`.

A 2D pixel-art fishing survival game set in a Sri Lankan village. Phaser 3 + TypeScript + Vite.

**The challenge:** three fixed stages played in order. Get 10 fish into the stationary bag in 3:00,
then 24 in 3:30, then 34 in 4:00, with 3 hearts per stage, while crocodiles hunt you at the
water and Sabapathi raids the bag. Beat Stage 3 and the fisherman pays Sabapathi's shop a visit.

```bash
npm install
npm run dev          # local dev server
npm run build        # typecheck + production build to dist/ (Vercel-ready)
npm run build:embed  # single-file IIFE to dist-embed/ (window.MaaluHoru.mount)
npm test             # 30 unit tests
npm run build && node tests/playtest.cjs   # six bot player types play Stage 1 headlessly
node tests/playtest.cjs average:2,skilled:3   # chosen bots on chosen stages
```

## Controls

WASD / arrows move, Shift dashes. Point at the water and press Space to cast; Space again on the `!`.
E stores carried fish at the bag and opens the gear stall. Q switches equipment. Walk over rocks to pick them up; left click throws one at the cursor. Esc pauses (Resume Game, Restart Stage, Settings, Quit Game; quitting asks first and returns to the title screen without reloading the page). X dismisses the tutorial card on screen.

## Rules (all in `src/config/balance.ts`)

- `STAGES`: the three stages. Each sets target, time limit, carry limit, bite speed, reaction window,
  fish stock, crocodile speed / frequency / cap, Sabapathi's frequency / speed / grab time, and rock supply.
  `applyStage()` loads one; `scenes/flow.ts` rebuilds the world for it, so nothing carries over except
  the chosen fisherman, name and running totals. Failing a stage retries that stage only.
- `GEAR`: Fishing Rod (1 fish), Fishing Net (up to 3, 5 coins, from Stage 2), Advanced Net (up to 5,
  12 coins, from Stage 3). `systems/Gear.ts` holds coins and equipment; fish sold from the bag become
  coins 1:1 and stop counting toward the target. Equipment carries into later stages; a retry restores
  the coins and equipment the stage started with; a new game resets both.
- `RUN`: hearts 3, start rocks 2, max rocks 5 (target, duration and carry limit come from the stage).
- Win the moment the bag holds the target. Lose at 0:00 or 0 hearts. Either way everything freezes
  and the result screen shows fish collected, fish stolen, crocodiles stunned and time remaining.
- Fish are in exactly one place: hands, bag, ground, Sabapathi's sack, or lost (`systems/Economy.ts`).
- A bite makes you drop what you carry. Sabapathi steals only from the bag; a rock makes him drop it.
- `BANDS`: four difficulty bands by time (0:00, 1:00, 2:30, 4:00) set crocodile cap, pace and speed,
  Sabapathi's speed and cooldown, and the fishing reaction window.
- `ZONES`: Dock Shallows, River Bend, Deep Swamp. Each depletes as you fish it and recovers when you leave.
- `EVENTS`: Golden Fish (worth 3), Fishing Bonanza, Crocodile Frenzy, Sabapathi Rush.

## First-time tutorials

The first time a player presses Play Game, the four-card How to Play guide opens first; finishing or skipping it starts the game. It is remembered in `howSeen` (`src/systems/Storage.ts`), skipped for anyone who already has a finished run, and brought back by Settings → Reset tutorials.

Short, contextual lessons that appear the first time each thing matters, one at a time, never pausing the game (`src/systems/Tutorial.ts` holds the rules and is unit-tested; `src/entities/Tutor.ts` triggers, highlights and completes them; the card is drawn by the HUD).

| id | appears when | completes when |
|---|---|---|
| first_fishing | Stage 1 starts | the first fish is caught |
| first_deposit | the first fish is caught | fish go into the bag |
| first_crocodile | the first crocodile appears (it is slower and warns longer, once ever) | a rock is thrown |
| first_rock_pickup | rocks run out (a rock is placed nearby if none is close) | a rock is picked up |
| first_sabapathi_entrance | Sabapathi first sets out | the warning has been seen |
| first_sabapathi_theft | he first steals (he runs 25% slower, once ever) | the dropped fish are picked up ("Fish recovered!"); if he escapes it is taught again next time |
| first_shop | Stage 2 starts; updates near the stall and when a Fishing Net is affordable | the first equipment purchase |

Priority: crocodile, then Sabapathi, then fishing/bag, then rocks, then the shop; a more urgent lesson interrupts and the other one returns after. Completed ids are saved in localStorage; Settings has Tutorials On/Off and Reset tutorials.

## Sound

`src/systems/Audio.ts` is the one audio service. Every effect and the music loop are synthesised with
the Web Audio API, so there are no audio files. The context is created on the player's first click or
key press (browsers block sound before that), suspended when the tab is hidden and resumed when it
returns. `MIX` holds each sound's volume, priority and repeat cooldown; high-priority sounds duck the
music. Master, music and effects volume and mute are in Settings and saved in localStorage.

## Rendering

The art is 480 x 270 and the canvas is three times that, so interface text (Nunito, falling back to
the system sans-serif) is drawn sharp while sprites stay pixel-perfect. On a slow machine add `?zoom=1`
to the address, or pass `zoom: 1` to `mount()`, for a low-resolution mode.

## Code map

```
src/config/      game.ts (resolution, palette), balance.ts (every tunable number)
src/world/       layout.ts: pond shape, docks, paths, props, collision grid, zones, rock spots
src/art/         procedural pixel art and the texture registry
src/systems/     Economy, Zones, Director, Events, Pathfind (A*), StateMachine, Input, Storage, Audio
src/entities/    Player, Fishing, Crocodile, Thief, Stones, Loot, Ambient
src/scenes/      Boot, World, Hud, Menu, Pause, Result, UiScene (shared kit), flow.ts
tests/           systems.test.ts (unit), playtest.cjs (bots)
```

## Art direction

- 480 × 270 internal resolution, nearest-neighbour scaling. No rotation or blur.
- Low sun in the upper-left: lit edges on that side, long shadows to the lower-right, warm lens grade.
- 1 px dark outline on actors and props; terrain uses ordered dithering between tones.
- Palette lives in `src/config/game.ts` (`PAL`).

All art is original and generated in code at boot (`src/art/*`), so the build
ships no image files. That keeps style, grid and lighting consistent.

### Asset status (be honest list)

| Asset | Status |
| --- | --- |
| Terrain, water, dock, shop, trees, props | First pass, in-engine. Good enough to ship Phase 1; shop and palms would benefit most from a hand-drawn pass. |
| Podipasiya, Lekam Thuma, Sabapathi | **Temporary.** Idle, walk and a single fishing pose. Proper cast / reel, throwing, hurt, celebrate, lose, sneak, grab, stunned, flee frames are not drawn yet. |
| Crocodile | First pass: swim, walk, jaws-open, lunge, stunned frames. Reads small; wants a larger hand-drawn version. |
| Pixel font | 3 × 5 Latin caps only. Sinhala logotype needs a drawn asset (Phase 5). |
| Audio | None yet (Phase 5). |

## Architecture

```
src/
  main.ts / embed.ts     entry points (page build / embeddable build)
  game.ts                Phaser config + mount()
  config/
    game.ts              resolution, depth layers, palette
    balance.ts           player tuning, characters, difficulty tiers
  world/
    layout.ts            pond shape (distance field), paths, prop placement,
                         collision grid, zones: the single source of truth
  art/                   procedural pixel art (px toolkit, font, terrain,
                         water, props, characters, ui) + texture registry
  systems/
    StateMachine.ts      generic FSM used by player and NPCs
    Input.ts             key bindings -> intent
  entities/
    Player.ts            idle / walk / dash states, grid collision
    Thief.ts             Sabapathi: path-following heist state machine
    Crocodile.ts         crocodile FSM + spawner
    Stones.ts            thrown stones, ammo, pickup piles
    Fishing.ts           cast / bite / reel loop, bucket, score
    Ambient.ts           fish, butterflies, dragonflies, sparkles, leaves (pooled)
  scenes/
    BootScene.ts         builds layout + textures
    WorldScene.ts        world assembly, depth sorting, camera, light
    HudScene.ts          screen-space UI
```

Design decisions:

- **Data-driven world.** `Layout` owns the pond distance field, path lines and
  collision grid. Art, collision, fish steering and (later) NPC path-finding all
  read the same data, so scenery can never disagree with gameplay.
- **Grid collision instead of physics bodies** for actors: cheap, deterministic,
  and the same grid feeds A* for Sabapathi and the crocodiles.
- **Depth = y** for everything standing on the ground; flat things (dock, lily
  pads) and overlays use fixed layers from `DEPTH`.
- **Tunable numbers only in `config/balance.ts`**, including the four
  difficulty tiers the spec calls for.

## Roadmap

5. Polish: menus, character select + custom name, audio, difficulty scaling, high scores.
6. Test pass and Vercel deploy.
