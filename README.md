# Malu Dadayama (මාළු දඩයම) — The Great Fish Heist

**Just want to play?** Double-click `play.html`. It is the whole game in one file and needs no install or server (an internet connection only adds the Sinhala title font). `index.html` is the developer entry point and only works through `npm run dev`, because it loads the TypeScript source.

To rebuild `play.html` after changing the code: `npm run build:play`.

A stylised 2.5D fishing survival game set in a Sri Lankan village. Phaser 3 + TypeScript + Vite.

**The challenge:** three fixed stages played in order. Get 10 fish into the stationary bag in 3:00,
then 24 in 3:30, then 34 in 4:00, with 3 hearts per stage, while crocodiles hunt you at the
water and Sabapathi raids the bag. Beat Stage 3 and the fisherman pays Sabapathi's shop a visit.

```bash
npm install
npm run dev          # local dev server
npm run build        # typecheck + production build to dist/ (Vercel-ready)
npm run build:embed  # single-file IIFE to dist-embed/ (window.MaluDadayama.mount)
npm test             # 30 unit tests
npm run build && node tests/playtest.cjs   # six bot player types play Stage 1 headlessly
node tests/playtest.cjs average:2,skilled:3   # chosen bots on chosen stages
```

## Controls

WASD / arrows move, Shift dashes. Point at the water and press Space to cast; Space again on the `!`.
E stores carried fish at the bag and opens the gear stall. Q switches equipment. Walk over rocks to pick them up; left click throws one at the cursor. Esc pauses (Resume Game, Restart Stage, Settings, Quit Game; quitting asks first and returns to the title screen without reloading the page). X dismisses the tutorial card on screen.

### Sinhala voice lines

The fisherman and Sabapathi can react out loud in Sinhala: fishing, crocodile warnings, thefts, rock throws, deposits, purchases, stage clear and game over. There are 23 events with 1 to 3 variations each, recorded separately for Podipasiya and Lekam Thuma: 84 clips in all. Settings has **Voice volume** and **Voices On/Off**. There are no on-screen subtitles: the voices are heard, not read.

- **Lines** (Sinhala text, English meaning, priority, cooldown) live in `src/config/voices.json`.
- **Recordings** go in `public/voice/<speaker>/<event>/<NN>.mp3` (OGG, M4A and WAV also work). `public/voice/SCRIPT.md` lists every file with its line: run `npm run voices` to refresh it, its folders and the recorded count after changing lines or adding clips.
- **No recordings ship yet.** A line without a file is skipped silently, so the game sounds as before until clips are added. No synthetic or English voices stand in for the Sinhala.
- **Rules:** one speaker at a time; warnings (priority 3) cut off casual talk, nothing else interrupts; each event has a cooldown, casual events speak only some of the time with a short quiet gap after any line; variations are random and never repeat back to back; the music dips under a line; the title screen stays silent.
- The dev server lists recordings live and every build writes `voice/index.json`, so only files that exist are ever requested. `play.html` (opened from disk) has no voices.

### Phones and tablets

Touch controls appear automatically on phones and tablets (Settings → Touch: Auto / On / Off; `?touch=1` or `?touch=0` in the address overrides it). Desktop keyboard and mouse controls are unchanged, and the on-screen controls never show on a desktop unless switched on.

- **Joystick** (left thumb, anywhere on the lower left): full speed in any direction, same as the keyboard. It follows the thumb and springs back when released.
- **FISH**: casts onto the open water the fisherman is facing (no cursor needed), and reels in when a fish bites; the button glows when a cast is possible and says REEL! on a bite.
- **ROCK**: arms a throw and shows the throwing range. Tap a crocodile or Sabapathi to throw at where they are right now (a moving target can still be missed). Tap ROCK again, or tap empty ground, to cancel without spending a rock. Out of range says TOO FAR; an empty pocket says so too.
- **USE**: deposits fish at the bag or opens the shop; it is labelled Deposit or Shop when one is in reach.
- **DASH**, **GEAR** (appears once you own two pieces of equipment) and **pause** in the top-right corner.
- Tap a tutorial card to skip it. Tap the name box on the character screen to type a name.

Each control tracks its own finger, so moving and pressing at the same time works, and every way a touch can end (lifting, the browser cancelling it, switching apps or tabs, rotating, pausing) releases everything. The game area blocks page scrolling, pinch and double-tap zoom, text selection and long-press menus; the rest of the page is left alone. In portrait a card suggests turning the device; "Play anyway" dismisses it. Controls keep clear of notches and the home indicator, and are sized for the physical screen: larger on tablets, never smaller than a fingertip.

## Rules (all in `src/config/balance.ts`)

- `STAGES`: the three stages. Each sets target, time limit, carry limit, bite speed, reaction window,
  fish stock, crocodile speed / frequency / cap, Sabapathi's frequency / speed / grab time, and rock supply.
  `applyStage()` loads one; `scenes/flow.ts` rebuilds the world for it, so nothing carries over except
  the chosen fisherman, name and running totals. Failing a stage retries that stage only.
- `GEAR`: Fishing Rod (1 fish), Fishing Net (up to 3, 5 coins, from Stage 2), Advanced Net (up to 5,
  12 coins, from Stage 3). `systems/Gear.ts` holds coins and equipment; fish sold from the bag become
  coins 1:1 and stop counting toward the target. Equipment carries into later stages; a retry restores
  the coins and equipment the stage started with; a new game resets both.
- The shop (`scenes/ShopScene.ts`) shows Fish in Bag, fish carried and Fish Coins, a price on each item, and one
  line saying what to do next (catch, deposit, sell or buy, from `shopHint()` in `systems/Gear.ts`). Only fish
  already in the bag can be sold, and only as many as the purchase needs; the stage target is not required.
  Sell and Buy buttons are faded when unavailable and say why when pressed.
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

The world is laid out in a 480 x 270 view and the canvas is three times that. Every texture is drawn
at that 3x density (`ART` in `src/art/hd.ts`) and shown at 1/3 scale, so at the default zoom each texture
pixel lands on exactly one screen pixel: sharp edges, no upscaling blur. On a slow machine add `?zoom=1`
to the address, or pass `zoom: 1` to `mount()`, for a low-resolution mode.

Cost, measured in a desktop browser: about 2.5 s to paint all textures at boot (the ground is most of
it), 85 MB of texture memory, no texture larger than 1440 px, and under 1 ms of CPU+GPU per frame.

## Code map

```
src/config/      game.ts (resolution, palette), balance.ts (every tunable number)
src/world/       layout.ts: pond shape, docks, paths, props, collision grid, zones, rock spots
src/art/         procedural HD art (*HD.ts) and the texture registry
src/systems/     Economy, Zones, Director, Events, Pathfind (A*), StateMachine, Input, Touch, Page, Storage, Audio, Voice
src/entities/    Player, Fishing, Crocodile, Thief, Stones, Loot, Ambient
src/scenes/      Boot, World, Hud, Touch (on-screen controls), Menu, Pause, Result, UiScene (shared kit), flow.ts
tests/           systems.test.ts (unit), playtest.cjs (bots)
```

## Art direction

- Stylised 2.5D: smooth vector shapes with gradients, a soft ink outline and soft contact shadows,
  drawn at 3x density. No pixel art, no blur filters, no heavy bloom.
- Low sun in the upper-left: lit edges on that side, shadows to the lower-right, warm grade and a light vignette.
- Water: a painted pond bed with see-through shallows, plus drifting ripple, swell and shore-foam layers (WebGL).
- Interface: rounded plum glass panels, gold primary buttons, Nunito display headings with a rim and shadow.
- Palette lives in `src/config/game.ts` (`PAL`).

All art is original and generated in code at boot (`src/art/*`), so the build
ships no image files. That keeps style, grid and lighting consistent.

### Where the art lives

| File | Draws |
| --- | --- |
| `hd.ts` | density constants, `addHD` / `addHDSheet` registration, colour helpers |
| `groundHD.ts`, `waterHD.ts` | ground tiles (pond bed, grass, paths, sand, light), water layers and masks, grade and vignette |
| `charactersHD.ts` | Podipasiya, Lekam Thuma and Sabapathi from one parametric renderer: idle, blink, walk, fish, throw, hurt; menu portraits |
| `fxHD.ts` | crocodiles (swim, walk, open, lunge, stunned), wakes, splashes, sparkles, bobber, nets, fish, rocks |
| `sceneryHD.ts` | palms, trees, bushes, reeds, lilies, docks, canoe, shop, fences, props, birds and insects |
| `uiHD.ts` | panels, buttons, keycaps, HUD icons, menu backdrops, logo |

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
  art/                   procedural HD art (ground, water, characters,
                         effects, scenery, ui) + texture registry
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
