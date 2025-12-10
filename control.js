import { CONFIG, dollars, SLOGANS } from './config.js';
import { createStore } from './store.js';

const store = createStore();
const refs = {};
let autoSpinHandle = null;

const cacheRefs = () => {
  refs.balance = document.getElementById('balance');
  refs.result = document.getElementById('result');
  refs.cost = document.getElementById('cost');
  refs.lastWin = document.getElementById('last-win');
  refs.multiplier = document.getElementById('multiplier');
  refs.total = document.getElementById('total');
  refs.betOptions = document.getElementById('bet-options');
  refs.multiplierOptions = document.getElementById('multiplier-options');
  refs.spin = document.getElementById('spin');
  refs.reset = document.getElementById('reset');
  refs.addBalanceInput = document.getElementById('add-balance');
  refs.addBalanceButton = document.getElementById('add-balance-btn');
  refs.quickAddButtons = Array.from(document.querySelectorAll('[data-add]'));
  refs.openDisplay = document.getElementById('open-display');
  refs.autoSpinToggle = document.getElementById('auto-spin-toggle');
  refs.autoSpinInterval = document.getElementById('auto-spin-interval');
  refs.autoSpinStatus = document.getElementById('auto-spin-status');
  refs.slogan = document.getElementById('slogan-banner');
};

const renderHud = (state) => {
  const costPerSpin = state.currentBet * state.betMultiplier;
  refs.balance.textContent = dollars(state.balance);
  refs.cost.textContent = `${dollars(costPerSpin)} (Bet ${dollars(state.currentBet)} x${state.betMultiplier})`;
  refs.result.textContent = state.lastMessage;
  refs.lastWin.textContent = state.lastWin > 0 ? dollars(state.lastWin) : '$0.00';
  refs.multiplier.textContent = `x${state.lastMultiplier}`;
  refs.total.textContent = dollars(state.totalWinnings || 0);
};

const renderBetOptions = (state) => {
  refs.betOptions.innerHTML = '';
  CONFIG.betOptions.forEach((bet) => {
    const label = document.createElement('label');
    label.className = 'bet-option';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'bet';
    input.value = bet;
    input.checked = bet === state.currentBet;
    input.addEventListener('change', () => store.setBet(bet));

    const span = document.createElement('span');
    span.textContent = dollars(bet);
    label.append(input, span);
    if (input.checked) label.classList.add('active');
    refs.betOptions.appendChild(label);
  });
};

const renderMultiplierOptions = (state) => {
  refs.multiplierOptions.innerHTML = '';
  CONFIG.multiplierOptions.forEach((value) => {
    const label = document.createElement('label');
    label.className = 'bet-option';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'bet-multiplier';
    input.value = value;
    input.checked = value === state.betMultiplier;
    input.addEventListener('change', () => store.setBetMultiplier(value));

    const span = document.createElement('span');
    span.textContent = `x${value}`;
    label.append(input, span);
    if (input.checked) label.classList.add('active');
    refs.multiplierOptions.appendChild(label);
  });
};

const openDisplayWindow = () => {
  const displayUrl = new URL('./display.html', window.location.href).toString();
  window.open(displayUrl, 'purdue-display', 'noopener,width=1280,height=720');
};

const startAutoSpin = () => {
  const state = store.getState();
  const interval = Number.parseInt(refs.autoSpinInterval.value, 10) || state.autoSpinInterval;
  store.setAutoSpin(true);
  store.setAutoSpinInterval(interval);
  clearInterval(autoSpinHandle);
  autoSpinHandle = setInterval(() => {
    const current = store.getState();
    const cost = current.currentBet * current.betMultiplier;
    if (current.balance < cost) {
      stopAutoSpin();
      refs.autoSpinStatus.textContent = 'Auto spin stopped: insufficient balance.';
      return;
    }
    if (!current.spinning) store.spin();
  }, interval);
  refs.autoSpinToggle.textContent = 'Stop Auto Spin';
  refs.autoSpinToggle.classList.add('toggled');
  refs.autoSpinStatus.textContent = `Auto spin is ON (every ${interval}ms)`;
};

const stopAutoSpin = () => {
  store.setAutoSpin(false);
  clearInterval(autoSpinHandle);
  autoSpinHandle = null;
  refs.autoSpinToggle.textContent = 'Auto Spin';
  refs.autoSpinToggle.classList.remove('toggled');
  refs.autoSpinStatus.textContent = 'Auto spin is off';
};

const toggleAutoSpin = () => {
  if (store.getState().autoSpin) stopAutoSpin();
  else startAutoSpin();
};

const handleAddBalance = (raw) => {
  const source = raw ?? refs.addBalanceInput.value;
  const added = store.addBalance(source);
  if (added && refs.addBalanceInput) refs.addBalanceInput.value = '';
};

const bindEvents = () => {
  refs.spin?.addEventListener('click', () => store.spin());
  refs.reset?.addEventListener('click', () => {
    stopAutoSpin();
    store.reset();
  });
  refs.addBalanceButton?.addEventListener('click', () => handleAddBalance(refs.addBalanceInput?.value));
  refs.quickAddButtons.forEach((btn) => {
    btn.addEventListener('click', () => handleAddBalance(btn.dataset.add || btn.textContent));
  });
  refs.openDisplay?.addEventListener('click', openDisplayWindow);
  refs.autoSpinToggle?.addEventListener('click', toggleAutoSpin);
  refs.autoSpinInterval?.addEventListener('change', () => {
    const value = Number.parseInt(refs.autoSpinInterval.value, 10);
    if (Number.isFinite(value) && value > 0) store.setAutoSpinInterval(value);
  });
};

window.addEventListener('DOMContentLoaded', () => {
  cacheRefs();
  renderHud(store.getState());
  renderBetOptions(store.getState());
  renderMultiplierOptions(store.getState());
  if (refs.autoSpinInterval) refs.autoSpinInterval.value = store.getState().autoSpinInterval;
  bindEvents();
  document.body.classList.add('control-mode');

  store.subscribe((state) => {
    renderHud(state);
    renderBetOptions(state);
    renderMultiplierOptions(state);
    refs.spin.disabled = !!state.spinning;
    if (state.autoSpin && !autoSpinHandle) startAutoSpin();
    if (!state.autoSpin && autoSpinHandle) stopAutoSpin();
    if (refs.slogan && !state.spinning) {
      const index = Math.floor(Math.random() * SLOGANS.length);
      refs.slogan.textContent = SLOGANS[index];
    }
  });
});
