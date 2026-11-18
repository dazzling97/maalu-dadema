
// Who each villager is: colours, hair, clothes, moustache. charactersHD.ts draws them.
export interface CharSpec {
  skin: [string, string, string]; // light, base, shade
  hair: 'mop' | 'sidepart' | 'bald';
  hairCol: [string, string];
  headband?: string;
  shirt: 'vest' | 'shirt';
  shirtCol: [string, string]; // base, shade
  sarong: [string, string, string]; // base, stripe, shade
  sarongShort?: boolean;
  moustache: 0 | 1 | 2;
  belly?: boolean;
  rod?: boolean;
  brows?: boolean;
}

export const SPECS: Record<string, CharSpec> = {
  podipasiya: {
    skin: ['#c98a5a', '#a86a42', '#84502f'], hair: 'mop', hairCol: ['#2a2030', '#4a3a55'], headband: '#e8433f',
    shirt: 'vest', shirtCol: ['#f7f1e0', '#cfc6ae'], sarong: ['#2f7fb8', '#8fd0f0', '#215a8a'], sarongShort: true,
    moustache: 0, rod: true,
  },
  lekam: {
    skin: ['#bd8256', '#9c6340', '#7a4a2e'], hair: 'sidepart', hairCol: ['#4a4650', '#8a8690'],
    shirt: 'shirt', shirtCol: ['#f3ead2', '#cdbf9c'], sarong: ['#7a3f5f', '#d9a9c0', '#572a44'],
    moustache: 1, rod: true, brows: true,
  },
  sabapathi: {
    skin: ['#c08456', '#a0643e', '#7c4a2c'], hair: 'bald', hairCol: ['#2a2030', '#4a3a55'],
    shirt: 'shirt', shirtCol: ['#f2b632', '#c98a1c'], sarong: ['#8a2f7a', '#f6d24a', '#5f1f58'],
    moustache: 2, belly: true, brows: true,
  },
};

export type Dir = 'down' | 'left' | 'right' | 'up';
export const DIRS: Dir[] = ['down', 'left', 'right', 'up'];
