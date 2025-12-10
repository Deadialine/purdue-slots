import { CONFIG } from './config.js';

const CHANNEL_NAME = 'purdue-slot-shared-state';
const STORAGE_KEY = 'purdue-slot-state';

const randomId = () => Math.random().toString(36).slice(2);
const findSymbol = (name) => CONFIG.symbols.find((s) => s.name === name) || CONFIG.symbols[0];

const defaultSymbols = () => {
  const names = [];
  for (let i = 0; i < 3; i += 1) {
    const symbol = CONFIG.symbols[Math.floor(Math.random() * CONFIG.symbols.length)];
    names.push(symbol.name);
  }
  return names;
};

const sanitizeState = (rawState) => {
  if (!rawState || typeof rawState !== 'object') return null;
  const safeNumber = (val, fallback, min = 0) => {
    const parsed = Number(val);
    return Number.isFinite(parsed) && parsed >= min ? parsed : fallback;
  };

  return {
    balance: safeNumber(rawState.balance, CONFIG.startingCredits),
    currentBet: safeNumber(rawState.currentBet, CONFIG.defaultBet || CONFIG.costPerSpin, CONFIG.costPerSpin || 0),
    betMultiplier: safeNumber(rawState.betMultiplier, 1, 1),
    lastMessage: typeof rawState.lastMessage === 'string' ? rawState.lastMessage : 'Insert credits to play.',
    lastWin: safeNumber(rawState.lastWin, 0),
    lastMultiplier: safeNumber(rawState.lastMultiplier, 1, 1),
    autoSpinInterval: safeNumber(rawState.autoSpinInterval, CONFIG.autoSpinIntervalDefault, 100),
    totalWinnings: safeNumber(rawState.totalWinnings, 0),
    lastSymbols: Array.isArray(rawState.lastSymbols) && rawState.lastSymbols.length === 3
      ? rawState.lastSymbols
      : defaultSymbols(),
    lastSpinId: typeof rawState.lastSpinId === 'string' ? rawState.lastSpinId : null,
    // Always start fresh on page load so controls aren't stuck disabled
    spinning: false,
    autoSpin: false,
  };
};

const getStoredState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return sanitizeState(parsed);
  } catch (err) {
    console.warn('Could not parse stored state', err);
    return null;
  }
};

const rollMultiplier = () => {
  const roll = Math.random();
  let cumulative = 0;
  for (const entry of CONFIG.multipliers) {
    cumulative += entry.chance;
    if (roll < cumulative) return entry.value;
  }
  return 1;
};

const calculatePayout = (symbols, effectiveBet) => {
  const [a, b, c] = symbols.map(findSymbol);
  const same = a.name === b.name && b.name === c.name;
  if (!same) return 0;
  const multiplier = CONFIG.payoutMultipliers[a.name] ?? 5;
  return multiplier * effectiveBet;
};

const pickTargets = (winBias) => {
  const biased = Math.random() < winBias;
  if (biased) {
    const winner = CONFIG.symbols[Math.floor(Math.random() * CONFIG.symbols.length)];
    return [winner.name, winner.name, winner.name];
  }
  return [0, 1, 2].map(
    () => CONFIG.symbols[Math.floor(Math.random() * CONFIG.symbols.length)].name,
  );
};

export const createStore = () => {
  const instanceId = randomId();
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL_NAME) : null;
  const subscribers = new Set();
  const spinListeners = new Set();

  let state = {
    balance: CONFIG.startingCredits,
    currentBet: CONFIG.defaultBet || CONFIG.costPerSpin,
    betMultiplier: 1,
    lastMessage: 'Insert credits to play.',
    lastWin: 0,
    lastMultiplier: 1,
    spinning: false,
    autoSpin: false,
    autoSpinInterval: CONFIG.autoSpinIntervalDefault,
    totalWinnings: 0,
    lastSymbols: defaultSymbols(),
    lastSpinId: null,
  };

  const persist = (nextState) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    } catch (err) {
      console.warn('Unable to persist state', err);
    }
  };

  const notify = () => subscribers.forEach((fn) => fn(state));
  const notifySpin = (payload) => spinListeners.forEach((fn) => fn(payload));

  const applyState = (nextState, shouldBroadcast = true) => {
    state = { ...state, ...nextState };
    persist(state);
    notify();
    if (shouldBroadcast && channel) {
      channel.postMessage({ type: 'state', state, source: instanceId });
    }
  };

  const handleIncomingState = (payload) => {
    if (payload.source === instanceId) return;
    if (payload.type === 'state') {
      state = { ...state, ...payload.state };
      persist(state);
      notify();
    }
    if (payload.type === 'spin-start') {
      notifySpin(payload.payload);
    }
  };

  if (channel) {
    channel.addEventListener('message', (event) => {
      const payload = event.data || {};
      handleIncomingState(payload);
    });
  } else {
    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          const newState = JSON.parse(event.newValue);
          state = { ...state, ...newState };
          notify();
        } catch (err) {
          console.warn('Unable to sync via storage', err);
        }
      }
    });
  }

  const stored = getStoredState();
  if (stored) state = { ...state, ...stored };
  notify();

  const broadcastSpin = (payload) => {
    notifySpin(payload);
    if (channel) channel.postMessage({ type: 'spin-start', payload, source: instanceId });
  };

  const setBet = (bet) => {
    const safeBet = Number.isFinite(bet) && bet > 0 ? bet : state.currentBet;
    applyState({ currentBet: safeBet, lastMessage: `Bet set to $${safeBet.toFixed(2)}` });
  };

  const setBetMultiplier = (multiplier) => {
    const safe = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
    applyState({ betMultiplier: safe, lastMessage: `Multiplier set to x${safe}` });
  };

  const addBalance = (amount) => {
    const normalized = (() => {
      if (typeof amount === 'string') {
        const cleaned = amount.trim().replace(/[^0-9.+-]/g, '');
        const parsed = Number.parseFloat(cleaned);
        return Number.isFinite(parsed) ? parsed : NaN;
      }
      const parsed = Number(amount);
      return Number.isFinite(parsed) ? parsed : NaN;
    })();

    const safeAmount = normalized > 0 ? Math.round(normalized * 100) / 100 : 0;
    if (!safeAmount) {
      applyState({ lastMessage: 'Enter a valid amount to add.' });
      return false;
    }
    const nextBalance = Math.round((state.balance + safeAmount) * 100) / 100;
    applyState({ balance: nextBalance, lastMessage: `Added $${safeAmount.toFixed(2)}. Ready to spin!` });
    return true;
  };

  const setAutoSpin = (active) => applyState({ autoSpin: !!active });

  const setAutoSpinInterval = (interval) => {
    const safeInterval = Number.isFinite(interval) && interval > 0 ? interval : state.autoSpinInterval;
    applyState({ autoSpinInterval: safeInterval });
  };

  const reset = () => {
    applyState({
      balance: 0,
      currentBet: CONFIG.defaultBet || CONFIG.costPerSpin,
      betMultiplier: 1,
      lastMessage: 'Machine reset. Insert credits to play.',
      lastWin: 0,
      lastMultiplier: 1,
      spinning: false,
      autoSpin: false,
      totalWinnings: 0,
      lastSymbols: defaultSymbols(),
      lastSpinId: null,
    });
  };

  const spin = () => {
    if (state.spinning) return null;
    const cost = state.currentBet * state.betMultiplier;
    if (!Number.isFinite(cost) || cost <= 0) {
      applyState({ lastMessage: 'Choose a bet greater than $0 to play.' });
      return null;
    }
    if (state.balance < cost) {
      applyState({ lastMessage: 'Insufficient credits to spin.' });
      return null;
    }

    const targets = pickTargets(CONFIG.winBiasChance);
    const spinId = randomId();
    const nextBalance = state.balance - cost;

    applyState({
      balance: nextBalance,
      spinning: true,
      lastWin: 0,
      lastMultiplier: 1,
      lastMessage: 'Spinning...',
    });

    broadcastSpin({ targets, spinId });

    const settle = () => {
      const baseWin = calculatePayout(targets, cost);
      const multiplier = baseWin > 0 ? rollMultiplier() : 1;
      const payout = baseWin * multiplier;
      const finalBalance = getState().balance + payout;
      applyState({
        balance: finalBalance,
        lastWin: payout,
        lastMultiplier: multiplier,
        lastMessage: payout > 0
          ? `${targets[0]} pays $${baseWin.toFixed(2)}${multiplier > 1 ? ` x${multiplier}` : ''}!`
          : 'No win. Try again!',
        spinning: false,
        totalWinnings: state.totalWinnings + payout,
        lastSymbols: targets,
        lastSpinId: spinId,
      });
    };

    const totalDuration = CONFIG.spinDurationMs + CONFIG.spinStaggerMs * 2 + 400;
    setTimeout(settle, totalDuration);
    return { targets, spinId };
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
    spin,
    reset,
    setAutoSpin,
    setAutoSpinInterval,
  };
};
