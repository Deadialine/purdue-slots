import { CONFIG, dollars } from './config.js';
import { createStore } from './store.js';

const store = createStore();
const refs = {};
let autoSpinTimer = null;

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
  refs.quickAddButtons = document.querySelectorAll('[data-add]');
  refs.openDisplay = document.getElementById('open-display');
  refs.autoSpinToggle = document.getElementById('auto-spin-toggle');
  refs.autoSpinInterval = document.getElementById('auto-spin-interval');
  refs.autoSpinStatus = document.getElementById('auto-spin-status');
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
    const option = document.createElement('label');
    option.className = 'bet-option';

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'bet';
    input.value = bet;
    input.checked = bet === state.currentBet;
    input.addEventListener('change', () => store.setBet(bet));

    const text = document.createElement('span');
    text.textContent = dollars(bet);

    option.appendChild(input);
    option.appendChild(text);
    if (input.checked) option.classList.add('active');
    refs.betOptions.appendChild(option);
  });
};

const renderMultiplierOptions = (state) => {
  refs.multiplierOptions.innerHTML = '';
  [1, 2, 3].forEach((value) => {
    const option = document.createElement('label');
    option.className = 'bet-option';

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'bet-multiplier';
    input.value = value;
    input.checked = value === state.betMultiplier;
    input.addEventListener('change', () => store.setBetMultiplier(value));

    const text = document.createElement('span');
    text.textContent = `x${value}`;

    option.appendChild(input);
    option.appendChild(text);
    if (input.checked) option.classList.add('active');
    refs.multiplierOptions.appendChild(option);
  });
};

const openDisplayWindow = () => {
  window.open('/display.html', 'purdue-display', 'noopener,width=1280,height=720');
};

const startAutoSpin = (skipStateUpdate = false) => {
  const interval = parseInt(refs.autoSpinInterval.value, 10);
  if (!interval || interval <= 0) {
    refs.autoSpinStatus.textContent = 'Enter a valid interval in ms to start auto spin.';
    return;
  }
  if (!skipStateUpdate) {
    store.setAutoSpin(true);
  }
  clearInterval(autoSpinTimer);
  autoSpinTimer = setInterval(() => {
    const state = store.getState();
    const cost = state.currentBet * state.betMultiplier;
    if (state.balance < cost) {
      stopAutoSpin();
      refs.autoSpinStatus.textContent = 'Auto spin stopped: insufficient balance.';
      return;
    }
    if (!state.spinning) {
      const result = store.spin();
      if (!result && state.balance < cost) {
        stopAutoSpin();
        refs.autoSpinStatus.textContent = 'Auto spin stopped: insufficient balance.';
      }
    }
  }, interval);
  refs.autoSpinStatus.textContent = `Auto spin is ON (every ${interval}ms)`;
  refs.autoSpinToggle.textContent = 'Stop Auto Spin';
  refs.autoSpinToggle.classList.add('toggled');
};

const stopAutoSpin = (skipStateUpdate = false) => {
  if (!skipStateUpdate) {
    store.setAutoSpin(false);
  }
  clearInterval(autoSpinTimer);
  autoSpinTimer = null;
  refs.autoSpinStatus.textContent = 'Auto spin is off';
  refs.autoSpinToggle.textContent = 'Auto Spin';
  refs.autoSpinToggle.classList.remove('toggled');
};

const toggleAutoSpin = () => {
  if (store.getState().autoSpin) {
    stopAutoSpin();
  } else {
    startAutoSpin();
  }
};

const bindEvents = () => {
  refs.spin.addEventListener('click', () => store.spin());
  refs.reset.addEventListener('click', () => {
    stopAutoSpin();
    store.reset();
  });
  refs.addBalanceButton.addEventListener('click', () => {
    const amount = parseFloat(refs.addBalanceInput.value) || 0;
    if (amount > 0) {
      store.addBalance(amount);
      refs.addBalanceInput.value = '';
    } else {
      store.addBalance(NaN);
    }
  });
  refs.quickAddButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const amount = parseFloat(btn.dataset.add);
      store.addBalance(amount);
    });
  });
  refs.openDisplay.addEventListener('click', openDisplayWindow);
  refs.autoSpinToggle.addEventListener('click', toggleAutoSpin);
};

window.addEventListener('DOMContentLoaded', () => {
  cacheRefs();
  renderBetOptions(store.getState());
  renderMultiplierOptions(store.getState());
  bindEvents();

  store.subscribe((state) => {
    renderHud(state);
    renderBetOptions(state);
    renderMultiplierOptions(state);
    refs.spin.disabled = state.spinning;
    if (state.autoSpin && !autoSpinTimer) {
      startAutoSpin(true);
    }
    if (!state.autoSpin && autoSpinTimer) {
      stopAutoSpin(true);
    }
  });

  document.body.classList.add('control-mode');
});
