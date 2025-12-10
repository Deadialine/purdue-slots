import { dollars } from './config.js';
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
  spin: new Audio('assets/sounds/slot_sound.mp3'),
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

const playSpinSound = () => {
  const audio = sounds.spin;
  audio.currentTime = 0;
  audio.play().catch(() => {});
};

const handleSpin = ({ targets }) => {
  if (!reels) return;
  playSpinSound();
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
  const layer = refs.celebration;
  if (!layer) return;
  layer.innerHTML = '';
  for (let i = 0; i < 28; i += 1) {
    const piece = document.createElement('div');
    piece.className = `confetti-piece ${i % 2 === 0 ? 'gold' : 'dark'}`;
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.animationDelay = `${Math.random() * 0.45}s`;
    layer.appendChild(piece);
    setTimeout(() => piece.remove(), 2000);
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

window.addEventListener('DOMContentLoaded', () => {
  cacheRefs();
  initReels(store.getState());
  document.body.classList.add('display-mode');

  store.subscribe((state) => {
    renderHud(state);
    if (!state.spinning && state.lastSymbols) {
      reels.renderStatic(state.lastSymbols.map((name) => name));
    }
    celebrateWin(state);
  });

  store.onSpin(handleSpin);
});
