export const CONFIG = {
  winBiasChance: 0.35,
  startingCredits: 0,
  costPerSpin: 1,
  betOptions: [0.2, 0.25, 0.5, 1],
  defaultBet: 1,
  visibleSymbols: 3,
  symbolHeight: 120,
  spinDurationMs: 1800,
  spinStaggerMs: 180,
  cyclesPerSpin: 4,
  easing: 'cubic-bezier(0.22, 0.68, 0.24, 1.02)',
  symbols: [
    { name: 'Pete the Mascot', image: 'assets/images/pete.png' },
    { name: 'Purdue "P" Logo', image: 'assets/images/plogo.png' },
    { name: 'Purdue Bell Tower', image: 'assets/images/bell.png' },
    { name: 'Engineering Fountain', image:'assets/images/engineering_fountain.png' },
    { name: 'Unfinished Block "P"', image: 'assets/images/unfinished_p.png' },
    { name: 'Purdue Archway', image: 'assets/images/arhway.png' },
    { name: 'Lionhead Fountain', image: 'assets/images/lionhead_fountain.png' },
    { name: 'Purdue Water Tower', image: 'assets/images/water_tower.png' },
  ],
  payoutMultipliers: {
    'Pete the Mascot': 15,
    'Purdue "P" Logo': 10,
    'Purdue Bell Tower': 5,
    'Engineering Fountain': 5,
    'Unfinished Block "P"': 6,
    'Purdue Archway': 5,
    'Lionhead Fountain': 7,
    'Purdue Water Tower': 6,
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
  'Boiler GOLD Bonus!',
  'Hammer Down!',
  'Boiler Victory!',
  'Unstoppable Boiler Makers!',
];

export const dollars = (val) => `$${val.toFixed(2)}`;
