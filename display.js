import { createSharedGame } from './store.js';
import { createReels } from './reels.js';
import { CONFIG } from './config.js';

const game = createSharedGame();
const reels = createReels();

const elements = {
  balance: document.getElementById('balance'),
  cost: document.getElementById('cost'),
  result: document.getElementById('result'),
  lastWin: document.getElementById('last-win'),
  multiplier: document.getElementById('multiplier'),
  total: document.getElementById('total'),
  celebration: document.getElementById('celebration-layer'),
};

const formatMoney = (value) => `$${value.toFixed(2)}`;

const updateText = (state) => {
  const wager = state.bet * state.multiplier;
  elements.balance.textContent = formatMoney(state.credits);
  elements.cost.textContent = `${formatMoney(state.bet)} / x${state.multiplier} (${formatMoney(wager)})`;
  elements.result.textContent = state.lastResult;
  elements.lastWin.textContent = formatMoney(state.lastWin);
  elements.multiplier.textContent = `x${state.multiplier}`;
  elements.total.textContent = formatMoney(state.totalWon);
};

const spawnConfetti = () => {
  elements.celebration.innerHTML = '';
  const count = CONFIG.confettiPieces;
  for (let i = 0; i < count; i += 1) {
    const piece = document.createElement('div');
    piece.className = 'confetti';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = `hsl(${Math.random() * 50 + 35}, 70%, 60%)`;
    piece.style.animationDelay = `${Math.random() * 0.3}s`;
    piece.style.animationDuration = `${1 + Math.random()}s`;
    elements.celebration.appendChild(piece);
  }
  elements.celebration.classList.add('active');
  setTimeout(() => elements.celebration.classList.remove('active'), CONFIG.confettiLifetime);
};

game.subscribe(updateText);

game.onSpin((payload) => {
  if (payload.type === 'start') {
    reels.spin(payload.targets);
    return;
  }
  if (payload.type === 'settle' && payload.payout > 0) {
    spawnConfetti();
  }
});
