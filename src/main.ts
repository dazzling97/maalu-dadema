import { mount } from './game';
import { findPath } from './systems/Pathfind';
import { RUN, CUR, GEAR } from './config/balance';
import { sellFish, buyGear } from './systems/Gear';
import { audio } from './systems/Audio';

const game = mount({ parent: 'game' });
// handles for debugging and the automated playtests (tests/playtest.cjs)
Object.assign(window as unknown as Record<string, unknown>, { __game: game, __mh: { findPath, RUN, CUR, GEAR, audio, sellFish, buyGear } });
