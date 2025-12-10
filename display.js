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

const handleSpin = ({ targets, windows }) => {
  if (!reels) return;
  reels.spinToTargets(targets, windows);
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

const triggerPurdueRain = () => {
  if (!refs.celebration) return;
  const rainLayer = document.createElement('div');
  rainLayer.className = 'p-rain';
  const dropCount = 28;

  for (let i = 0; i < dropCount; i += 1) {
    const drop = document.createElement('div');
    drop.className = 'p-drop';
    drop.style.left = `${Math.random() * 100}%`;
    drop.style.animationDelay = `${Math.random() * 0.8}s`;
    drop.style.setProperty('--fall-duration', `${2 + Math.random()}s`);
    drop.style.setProperty('--drift', `${Math.random() * 60 - 30}px`);
    rainLayer.appendChild(drop);
  }

  refs.celebration.appendChild(rainLayer);
  setTimeout(() => rainLayer.remove(), 3500);
};

const triggerBoilermakerTrain = () => {
  if (!refs.celebration) return;
  const train = document.createElement('img');
  train.src = 'assets/train.png';
  train.alt = 'Boilermaker train';
  train.className = 'train-effect';
  refs.celebration.appendChild(train);
  train.addEventListener('animationend', () => train.remove(), { once: true });
};

const chooseCelebrationEffect = (amount) => {
  const primaryEffects = [
    { id: 'flash', minAmount: 0, run: triggerGoldFlash },
    { id: 'shake', minAmount: 10, run: triggerScreenShake },
    { id: 'p-rain', minAmount: 0, run: triggerPurdueRain },
  ];

  const eligible = primaryEffects.filter((effect) => amount >= effect.minAmount);
  if (!eligible.length) return { primary: null, includeTrain: amount >= 50 };

  return {
    primary: eligible[Math.floor(Math.random() * eligible.length)],
    includeTrain: amount >= 50,
  };
};

const celebrateWin = (state) => {
  if (!state.lastSpinId || state.lastSpinId === lastCelebratedSpinId) return;
  if (state.lastWin > 0) {
    playWinSound(state.lastWin);
    launchConfetti();
    const chosenEffect = chooseCelebrationEffect(state.lastWin);
    chosenEffect?.primary?.run(state.lastWin);
    if (chosenEffect?.includeTrain) {
      triggerBoilermakerTrain();
    }
  }
  lastCelebratedSpinId = state.lastSpinId;
};

const triggerGoldFlash = (amount) => {
  if (!refs.celebration) return;
  const overlay = document.createElement('div');
  overlay.className = 'boiler-gold-flash';
  refs.celebration.appendChild(overlay);

  const reelsArea = document.querySelector('.slot-window');
  const winText = refs.result;
  reelsArea?.classList.add('flash-outline');
  winText?.classList.add('flash-outline');

  const cleanup = () => {
    overlay.remove();
    reelsArea?.classList.remove('flash-outline');
    winText?.classList.remove('flash-outline');
  };

  overlay.addEventListener('animationend', cleanup, { once: true });
};

const triggerScreenShake = (amount) => {
  if (amount < 10) return; // Medium/large wins only
  document.body.classList.add('screen-shake');
  setTimeout(() => document.body.classList.remove('screen-shake'), 500);
};

const triggerGoldFlash = (amount) => {
  if (!refs.celebration) return;
  const overlay = document.createElement('div');
  overlay.className = 'boiler-gold-flash';
  refs.celebration.appendChild(overlay);

  const reelsArea = document.querySelector('.slot-window');
  const winText = refs.result;
  reelsArea?.classList.add('flash-outline');
  winText?.classList.add('flash-outline');

  const cleanup = () => {
    overlay.remove();
    reelsArea?.classList.remove('flash-outline');
    winText?.classList.remove('flash-outline');
  };

  overlay.addEventListener('animationend', cleanup, { once: true });
};

const triggerScreenShake = (amount) => {
  if (amount < 10) return; // Medium/large wins only
  document.body.classList.add('screen-shake');
  setTimeout(() => document.body.classList.remove('screen-shake'), 500);
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
