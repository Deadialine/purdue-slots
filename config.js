export const CONFIG = {
  reels: 3,
  visibleSymbols: 3,
  symbolHeight: 140,
  startingCredits: 0,
  costPerSpin: 1,
  betOptions: [1, 2, 5, 10],
  defaultBet: 1,
  multiplierOptions: [1, 2, 3],
  winBiasChance: 0.2,
  spinDurationMs: 1800,
  spinStaggerMs: 180,
  cyclesPerSpin: 4,
  easing: 'cubic-bezier(0.22, 0.68, 0.24, 1.02)',
  autoSpinIntervalDefault: 1200,
  symbols: [
    { name: 'Pete the Mascot', image: 'assets/images/pete.png' },
    { name: 'Purdue "P" Logo', image: 'assets/images/plogo.png' },
    { name: 'Purdue Bell Tower', image: 'assets/images/bell.png' },
    { name: 'Engineering Fountain', image: 'assets/images/engineering_fountain.png' },
    { name: 'Unfinished Block "P"', image: 'assets/images/unfinished_p.png' },
    { name: 'Purdue Archway', image: 'assets/images/arhway.png' },
    { name: 'Lionhead Fountain', image: 'assets/images/lionhead_fountain.png' },
    { name: 'Purdue Water Tower', image: 'assets/images/water_tower.png' },
  ],
  payoutMultipliers: {
    'Pete the Mascot': 15,
    'Purdue "P" Logo': 10,
    'Purdue Bell Tower': 6,
    'Engineering Fountain': 6,
    'Unfinished Block "P"': 7,
    'Purdue Archway': 5,
    'Lionhead Fountain': 8,
    'Purdue Water Tower': 7,
  },
  multipliers: [
    { value: 10, chance: 0.02 },
    { value: 5, chance: 0.05 },
    { value: 2, chance: 0.12 },
  ],
};

export const SLOGANS = [
  'Hail Purdue!',
  'Boiler Up!',
  'Hammer Down!',
  'Unstoppable Boilermakers!',
  'Boiler Gold Bonus!',
  'Tradition Never Graduates.',
];

export const dollars = (value) => `$${Number(value).toFixed(2)}`;
