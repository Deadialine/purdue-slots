import { CONFIG, dollars } from './config.js';
import { createStore } from './store.js';
import { ReelSet } from './reels.js';

const store = createStore();
let reels;
let lastCelebratedSpinId = null;

const sounds = {
  small: new Audio('assets/sounds/win_small.mp3'),
  medium: new Audio('assets/sounds/win_medium.mp3'),
  big: new Audio('assets/sounds/win_big.mp3'),
  champion: new Audio('assets/sounds/champion_music.mp3'),
};
const refs = {};

const cacheRefs = () => {
  refs.balance = document.getElementById('balance');
  refs.cost = document.getElementById('cost');
  refs.result = document.getElementById('result');
  refs.lastWin = document.getElementById('last-win');
  refs.multiplier = document.getElementById('multiplier');
  refs.total = document.getElementById('total');
  refs.celebration = document.getElementById('celebration-layer');
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

const playWinSound = (amount) => {
  let key = 'small';
  if (amount >= 50) key = 'champion';
  else if (amount >= 20) key = 'big';
  else if (amount >= 10) key = 'medium';
  const audio = sounds[key];
  if (audio) {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }
};

const launchConfetti = () => {
  if (!refs.celebration) return;
  const layer = refs.celebration;
  layer.innerHTML = '';
  for (let i = 0; i < 28; i += 1) {
    const node = document.createElement('div');
    node.className = `confetti-piece ${i % 2 === 0 ? 'gold' : 'dark'}`;
    node.style.left = `${Math.random() * 100}%`;
    node.style.animationDelay = `${Math.random() * 0.4}s`;
    layer.appendChild(node);
    setTimeout(() => node.remove(), 2000);
  }
};

const celebrateWin = (state) => {
  if (!state.lastSpinId || state.lastSpinId === lastCelebratedSpinId) return;
  if (state.lastWin > 0) {
    playWinSound(state.lastWin);
    launchConfetti();
  }
  lastCelebratedSpinId = state.lastSpinId;
};

document.addEventListener('DOMContentLoaded', () => {
  cacheRefs();
  renderHud(store.getState());
  initReels(store.getState());

  store.subscribe((state) => {
    renderHud(state);
    celebrateWin(state);
  });
  store.onSpin(handleSpin);

  document.body.classList.add('display-mode');

  const light = document.createElement('div');
  light.className = 'light-strip';
  document.querySelector('.machine-shell').appendChild(light);
});
