export const CONFIG = {
  // Baseline economic values
  startingCredits: 20,
  defaultBet: 1,
  betOptions: [0.5, 1, 2, 5, 10],
  multiplierOptions: [1, 2, 3, 5],

  // Reel and animation settings
  reels: 3,
  visibleRows: 3,
  spinDurationMs: 1200,
  spinStaggerMs: 180,
  minAutoSpinInterval: 600,

  // Symbol configuration used across both screens
  symbols: [
    { name: 'Train', icon: '🚂', payout: 25 },
    { name: 'Block P', icon: '🅿️', payout: 15 },
    { name: 'Boiler', icon: '⚙️', payout: 12 },
    { name: 'Drum', icon: '🥁', payout: 8 },
    { name: 'Hat', icon: '🎩', payout: 5 },
    { name: 'Ticket', icon: '🎟️', payout: 3 },
  ],

  // Celebration tuning
  confettiPieces: 40,
  confettiLifetime: 1800,
};
