import { CONFIG } from './config.js';
import { createSharedGame } from './store.js';

const game = createSharedGame();
let autoSpinTimer = null;

const elements = {
  balance: document.getElementById('balance'),
  result: document.getElementById('result'),
  cost: document.getElementById('cost'),
  lastWin: document.getElementById('last-win'),
  multiplier: document.getElementById('multiplier'),
  total: document.getElementById('total'),
  addInput: document.getElementById('add-balance'),
  addButton: document.getElementById('add-balance-btn'),
  quickButtons: document.querySelectorAll('[data-add]'),
  betOptions: document.getElementById('bet-options'),
  multiplierOptions: document.getElementById('multiplier-options'),
  spinButton: document.getElementById('spin'),
  resetButton: document.getElementById('reset'),
  displayButton: document.getElementById('open-display'),
  autoToggle: document.getElementById('auto-spin-toggle'),
  autoStatus: document.getElementById('auto-spin-status'),
  autoInterval: document.getElementById('auto-spin-interval'),
  slogan: document.getElementById('slogan-banner'),
};

const formatMoney = (value) => `$${value.toFixed(2)}`;

const createToggleButtons = (container, values, onSelect, prefix = '$', suffix = '') => {
  container.innerHTML = '';
  values.forEach((value, idx) => {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.type = 'button';
    btn.textContent = `${prefix}${value}${suffix}`;
    btn.dataset.value = value;
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => onSelect(Number(value)));
    if (idx === 0) btn.classList.add('active');
    container.appendChild(btn);
  });
};

const syncSelection = (container, value) => {
  container.querySelectorAll('button').forEach((btn) => {
    const match = Number(btn.dataset.value) === Number(value);
    btn.classList.toggle('active', match);
    btn.setAttribute('aria-pressed', match ? 'true' : 'false');
  });
};

createToggleButtons(elements.betOptions, CONFIG.betOptions, (value) => {
  game.setBet(value);
});

createToggleButtons(elements.multiplierOptions, CONFIG.multiplierOptions, (value) => {
  game.setMultiplier(value);
});

elements.addButton.addEventListener('click', () => {
  game.addCredits(Number(elements.addInput.value || 0));
  elements.addInput.value = '';
});

elements.quickButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const value = Number(btn.dataset.add || 0);
    game.addCredits(value);
  });
});

elements.resetButton.addEventListener('click', () => game.reset());

elements.displayButton.addEventListener('click', () => {
  window.open('./display.html', 'purdue-slot-display');
});

elements.spinButton.addEventListener('click', () => {
  game.startSpin();
});

elements.autoToggle.addEventListener('click', () => {
  const toggled = elements.autoToggle.classList.toggle('active');
  game.setAutoSpin(toggled);
  handleAutoSpin(toggled);
});

elements.autoInterval.addEventListener('change', (event) => {
  const value = Number(event.target.value);
  if (!Number.isFinite(value)) return;
  const safe = Math.max(CONFIG.minAutoSpinInterval, value);
  event.target.value = safe;
  game.setAutoSpinInterval(safe);
  if (elements.autoToggle.classList.contains('active')) handleAutoSpin(true);
});

const handleAutoSpin = (active) => {
  if (autoSpinTimer) {
    clearInterval(autoSpinTimer);
    autoSpinTimer = null;
  }
  if (!active) return;
  const interval = Math.max(CONFIG.minAutoSpinInterval, Number(elements.autoInterval.value));
  autoSpinTimer = setInterval(() => game.startSpin(), interval);
};

const updateView = (state) => {
  const wager = state.bet * state.multiplier;
  elements.balance.textContent = formatMoney(state.credits);
  elements.result.textContent = state.lastResult;
  elements.cost.textContent = `${formatMoney(state.bet)} / x${state.multiplier} (${formatMoney(wager)})`;
  elements.lastWin.textContent = formatMoney(state.lastWin);
  elements.multiplier.textContent = `x${state.multiplier}`;
  elements.total.textContent = formatMoney(state.totalWon);
  syncSelection(elements.betOptions, state.bet);
  syncSelection(elements.multiplierOptions, state.multiplier);
  elements.spinButton.disabled = state.spinning;
  elements.autoToggle.classList.toggle('active', state.autoSpin);
  elements.autoStatus.textContent = state.autoSpin
    ? `Auto spin every ${state.autoSpinInterval} ms`
    : 'Auto spin is off';
};

game.subscribe(updateView);

game.onSpin((payload) => {
  if (payload.type !== 'settle') return;
  if (payload.payout > 0) {
    elements.slogan.textContent = 'Boiler Up! Jackpot!';
    elements.slogan.classList.add('flash');
    setTimeout(() => elements.slogan.classList.remove('flash'), 900);
  } else {
    elements.slogan.textContent = 'Keep pushing!';
  }
});
