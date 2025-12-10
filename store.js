import { CONFIG } from './config.js';

const CHANNEL_NAME = 'purdue-slot-shared-state';
const STORAGE_KEY = 'purdue-slot-state';

const randomId = () => (
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
);

const pickRandomSymbols = (count = CONFIG.visibleSymbols) => {
  const picks = [];
  for (let i = 0; i < count; i += 1) {
    const symbol = CONFIG.symbols[Math.floor(Math.random() * CONFIG.symbols.length)];
    picks.push(symbol.name);
  }
  return picks;
};

const sanitizeNumber = (value, fallback, min = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min) return fallback;
  return Math.round(parsed * 100) / 100;
};

const sanitizeState = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  return {
    balance: sanitizeNumber(raw.balance, CONFIG.startingCredits),
    currentBet: sanitizeNumber(raw.currentBet, CONFIG.defaultBet, CONFIG.costPerSpin),
    betMultiplier: sanitizeNumber(raw.betMultiplier, 1, 1),
    lastMessage: typeof raw.lastMessage === 'string' ? raw.lastMessage : 'Insert credits to play.',
    lastWin: sanitizeNumber(raw.lastWin, 0),
    lastMultiplier: sanitizeNumber(raw.lastMultiplier, 1, 1),
    totalWinnings: sanitizeNumber(raw.totalWinnings, 0),
    spinning: false,
    autoSpin: false,
    autoSpinInterval: sanitizeNumber(raw.autoSpinInterval, CONFIG.autoSpinIntervalDefault, 200),
    lastSymbols: Array.isArray(raw.lastSymbols) && raw.lastSymbols.length === CONFIG.reels
      ? raw.lastSymbols
      : pickRandomSymbols(CONFIG.reels),
    lastSpinId: typeof raw.lastSpinId === 'string' ? raw.lastSpinId : null,
  };
};

const loadStoredState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return sanitizeState(parsed);
  } catch (err) {
    console.warn('Unable to load stored state', err);
    return null;
  }
};

const pickTargets = () => {
  const shouldForceWin = Math.random() < CONFIG.winBiasChance;
  if (shouldForceWin) {
    const winningSymbol = CONFIG.symbols[Math.floor(Math.random() * CONFIG.symbols.length)].name;
    return Array(CONFIG.reels).fill(winningSymbol);
  }
  return Array.from({ length: CONFIG.reels }, () => (
    CONFIG.symbols[Math.floor(Math.random() * CONFIG.symbols.length)].name
  ));
};

const rollBonusMultiplier = () => {
  const roll = Math.random();
  let cumulative = 0;
  for (const entry of CONFIG.multipliers) {
    cumulative += entry.chance;
    if (roll < cumulative) return entry.value;
  }
  return 1;
};

const calculatePayout = (symbols, wager) => {
  if (!symbols || symbols.length !== CONFIG.reels) return 0;
  const [a, b, c] = symbols;
  if (a !== b || b !== c) return 0;
  const multiplier = CONFIG.payoutMultipliers[a] ?? 5;
  return multiplier * wager;
};

export const createStore = () => {
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL_NAME) : null;
  const instanceId = randomId();
  const subscribers = new Set();
  const spinListeners = new Set();

  let state = {
    balance: CONFIG.startingCredits,
    currentBet: CONFIG.defaultBet,
    betMultiplier: 1,
    lastMessage: 'Insert credits to play.',
    lastWin: 0,
    lastMultiplier: 1,
    totalWinnings: 0,
    spinning: false,
    autoSpin: false,
    autoSpinInterval: CONFIG.autoSpinIntervalDefault,
    lastSymbols: pickRandomSymbols(CONFIG.reels),
    lastSpinId: null,
  };

  const persist = (snapshot) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch (err) {
      console.warn('Unable to persist state', err);
    }
  };

  const broadcast = (payload) => {
    if (!channel) return;
    channel.postMessage({ ...payload, source: instanceId });
  };

  const applyState = (next, { silent = false } = {}) => {
    state = { ...state, ...next };
    persist(state);
    if (!silent) subscribers.forEach((fn) => fn(state));
  };

  const syncFromStorage = (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      const parsed = JSON.parse(event.newValue);
      const safe = sanitizeState(parsed);
      if (safe) applyState(safe, { silent: false });
    } catch (err) {
      console.warn('Failed to sync from storage', err);
    }
  };

  if (channel) {
    channel.addEventListener('message', (event) => {
      const payload = event.data || {};
      if (payload.source === instanceId) return;
      if (payload.type === 'state') {
        applyState(payload.state, { silent: false });
      }
      if (payload.type === 'spin') {
        spinListeners.forEach((fn) => fn(payload.data));
      }
    });
  } else {
    window.addEventListener('storage', syncFromStorage);
  }

  const stored = loadStoredState();
  if (stored) applyState(stored, { silent: true });

  const updateAndBroadcast = (next) => {
    applyState(next);
    broadcast({ type: 'state', state });
  };

  const setBet = (bet) => {
    const safe = sanitizeNumber(bet, state.currentBet, CONFIG.costPerSpin);
    updateAndBroadcast({
      currentBet: safe,
      lastMessage: `Bet set to $${safe.toFixed(2)}`,
    });
  };

  const setBetMultiplier = (multiplier) => {
    const safe = sanitizeNumber(multiplier, state.betMultiplier, 1);
    updateAndBroadcast({
      betMultiplier: safe,
      lastMessage: `Multiplier set to x${safe}`,
    });
  };

  const addBalance = (value) => {
    const parsed = sanitizeNumber(value, NaN, 0);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      updateAndBroadcast({ lastMessage: 'Enter a valid amount to add.' });
      return false;
    }
    const nextBalance = state.balance + parsed;
    updateAndBroadcast({
      balance: nextBalance,
      lastMessage: `Added $${parsed.toFixed(2)}. Ready to spin!`,
    });
    return true;
  };

  const reset = () => {
    updateAndBroadcast({
      balance: CONFIG.startingCredits,
      currentBet: CONFIG.defaultBet,
      betMultiplier: 1,
      lastMessage: 'Machine reset. Insert credits to play.',
      lastWin: 0,
      lastMultiplier: 1,
      totalWinnings: 0,
      spinning: false,
      autoSpin: false,
      lastSymbols: pickRandomSymbols(CONFIG.reels),
      lastSpinId: null,
    });
  };

  const settleSpin = (targets, wager, spinId) => {
    const baseWin = calculatePayout(targets, wager);
    const multiplier = baseWin > 0 ? rollBonusMultiplier() : 1;
    const payout = baseWin * multiplier;
    const nextBalance = state.balance + payout;
    updateAndBroadcast({
      balance: nextBalance,
      lastWin: payout,
      lastMultiplier: multiplier,
      lastMessage: payout > 0
        ? `${targets[0]} pays $${baseWin.toFixed(2)}${multiplier > 1 ? ` x${multiplier}` : ''}!`
        : 'No win. Try again!',
      totalWinnings: state.totalWinnings + payout,
      spinning: false,
      lastSymbols: targets,
      lastSpinId: spinId,
    });
  };

  const spin = () => {
    if (state.spinning) return null;
    const wager = sanitizeNumber(state.currentBet * state.betMultiplier, 0, 0.01);
    if (!Number.isFinite(wager) || wager <= 0) {
      updateAndBroadcast({ lastMessage: 'Choose a bet greater than $0 to play.' });
      return null;
    }
    if (state.balance < wager) {
      updateAndBroadcast({ lastMessage: 'Insufficient credits to spin.' });
      return null;
    }

    const targets = pickTargets();
    const spinId = randomId();

    updateAndBroadcast({
      balance: state.balance - wager,
      lastMessage: 'Spinning...',
      lastWin: 0,
      lastMultiplier: 1,
      spinning: true,
    });

    broadcast({ type: 'spin', data: { targets, spinId } });

    const settleDelay = CONFIG.spinDurationMs + CONFIG.spinStaggerMs * (CONFIG.reels - 1) + 400;
    setTimeout(() => settleSpin(targets, wager, spinId), settleDelay);
    return { targets, spinId };
  };

  const setAutoSpin = (active) => {
    updateAndBroadcast({ autoSpin: !!active });
  };

  const setAutoSpinInterval = (interval) => {
    const safe = sanitizeNumber(interval, state.autoSpinInterval, 200);
    updateAndBroadcast({ autoSpinInterval: safe });
  };

  const getState = () => state;

  const subscribe = (fn) => {
    subscribers.add(fn);
    fn(state);
    return () => subscribers.delete(fn);
  };

  const onSpin = (fn) => {
    spinListeners.add(fn);
    return () => spinListeners.delete(fn);
  };

  return {
    getState,
    subscribe,
    onSpin,
    setBet,
    setBetMultiplier,
    addBalance,
    reset,
    spin,
    setAutoSpin,
    setAutoSpinInterval,
  };
};
