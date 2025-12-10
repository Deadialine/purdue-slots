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

const addTempClass = (target, className, duration = 800) => {
  target.classList.add(className);
  setTimeout(() => target.classList.remove(className), duration);
};

const cacheRefs = () => {
  refs.balance = document.getElementById('balance');
  refs.cost = document.getElementById('cost');
  refs.result = document.getElementById('result');
  refs.lastWin = document.getElementById('last-win');
  refs.multiplier = document.getElementById('multiplier');
  refs.total = document.getElementById('total');
  refs.celebration = document.getElementById('celebration-layer');
  refs.body = document.body;
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

const handleSpin = ({ targets, windows }) => {
  if (!reels) return;
  reels.spinToTargets(targets, windows);
};

const triggerBoilerGoldFlash = () => {
  if (!refs.celebration || !refs.body) return;
  const overlay = document.createElement('div');
  overlay.className = 'boiler-flash-overlay';
  refs.celebration.appendChild(overlay);
  addTempClass(refs.body, 'gold-outline-pulse', 1200);
  setTimeout(() => overlay.remove(), 1000);
};

const triggerScreenShake = (duration = 450) => {
  if (!refs.body) return;
  addTempClass(refs.body, 'screen-shake', duration);
};

const launchPRain = () => {
  if (!refs.celebration) return;
  const drops = 32;
  for (let i = 0; i < drops; i += 1) {
    const drop = document.createElement('div');
    drop.className = 'p-rain-drop';
    drop.style.left = `${Math.random() * 100}%`;
    drop.style.animationDuration = `${1.8 + Math.random() * 1.2}s`;
    drop.style.animationDelay = `${Math.random() * 0.5}s`;
    drop.style.setProperty('--drift', `${Math.random() * 120 - 60}px`);
    refs.celebration.appendChild(drop);
    setTimeout(() => drop.remove(), 3200);
  }
};

const launchBoilermakerTrain = () => {
  if (!refs.celebration) return;
  const train = document.createElement('div');
  train.className = 'boilermaker-train';
  refs.celebration.appendChild(train);
  requestAnimationFrame(() => train.classList.add('run'));
  setTimeout(() => train.remove(), 5200);
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
    const costPerSpin = Math.max(1, state.currentBet * state.betMultiplier);
    const normalizedWin = state.lastWin / costPerSpin;

    playWinSound(state.lastWin);
    launchConfetti();
    triggerBoilerGoldFlash();

    if (state.lastWin >= 5 || normalizedWin >= 5) triggerScreenShake();
    if (state.lastWin >= 10 || normalizedWin >= 8) launchPRain();
    if (state.lastWin >= 20 || normalizedWin >= 12) launchBoilermakerTrain();
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
