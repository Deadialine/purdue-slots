import { CONFIG, dollars } from './config.js';
import { createStore } from './store.js';
import { ReelSet } from './reels.js';

const store = createStore();
let reels;

const refs = {};

const cacheRefs = () => {
  refs.balance = document.getElementById('balance');
  refs.cost = document.getElementById('cost');
  refs.result = document.getElementById('result');
  refs.lastWin = document.getElementById('last-win');
  refs.multiplier = document.getElementById('multiplier');
  refs.total = document.getElementById('total');
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

const initReels = (state) => {
  reels = new ReelSet(document.querySelector('.slot-window'));
  reels.renderStatic(state.lastSymbols);
};

const handleSpin = ({ targets }) => {
  if (!reels) return;
  reels.spinToTargets(targets);
};

window.addEventListener('DOMContentLoaded', () => {
  cacheRefs();
  initReels(store.getState());
  store.subscribe((state) => {
    renderHud(state);
    if (!state.spinning && state.lastSymbols) {
      reels.renderStatic(state.lastSymbols.map((name) => name));
    }
  });
  store.onSpin(handleSpin);

  document.body.classList.add('display-mode');

  const light = document.createElement('div');
  light.className = 'light-strip';
  document.querySelector('.machine-shell').appendChild(light);
});
