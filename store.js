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

const getStoredState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
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

// Force a winning window (all three the same) when the win coin flip succeeds.
const buildWinningTargets = () => {
  const winner = CONFIG.symbols[Math.floor(Math.random() * CONFIG.symbols.length)];
  return [winner.name, winner.name, winner.name];
};

// Ensure at least one reel differs so we never accidentally show a full match on losses.
const buildLosingTargets = () => {
  const picks = [];
  CONFIG.symbols.forEach(() => {
    picks.push(CONFIG.symbols[Math.floor(Math.random() * CONFIG.symbols.length)].name);
  });
  // Force a mismatch if random draw landed on a win pattern
  if (picks[0] === picks[1] && picks[1] === picks[2]) {
    const alt = CONFIG.symbols.find((s) => s.name !== picks[0]);
    picks[2] = alt ? alt.name : picks[2];
  }
  return picks.slice(0, 3);
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
  if (stored) {
    state = { ...state, ...stored };
  }
  notify();

  const broadcastSpin = (payload) => {
    notifySpin(payload);
    if (channel) channel.postMessage({ type: 'spin-start', payload, source: instanceId });
  };

  // Bet selection plumbing: keep positive values only so cost math stays valid.
  const setBet = (bet) => {
    const safeBet = Number.isFinite(bet) && bet > 0 ? bet : state.currentBet;
    applyState({ currentBet: safeBet, lastMessage: `Bet set to $${safeBet.toFixed(2)}` });
  };
  const setBetMultiplier = (multiplier) => {
    const safe = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
    applyState({ betMultiplier: safe, lastMessage: `Multiplier set to x${safe}` });
  };

  // Balance updates are centralized here so both windows stay synced.
  const addBalance = (amount) => {
    const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;
    if (!safeAmount) {
      applyState({ lastMessage: 'Enter a valid amount to add.' });
      return;
    }
    applyState({ balance: state.balance + safeAmount, lastMessage: `Added $${safeAmount.toFixed(2)}. Ready to spin!` });
  };
  const setAutoSpin = (active) => applyState({ autoSpin: active });

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

    // Single RNG gate drives the ~10% win probability.
    const shouldWin = Math.random() < CONFIG.winBiasChance;
    const targets = shouldWin ? buildWinningTargets() : buildLosingTargets();
    const spinId = randomId();
    const nextBalance = state.balance - cost;
    applyState({
      balance: nextBalance,
      spinning: true,
      lastWin: 0,
      lastMultiplier: 1,
      lastMessage: 'Spinning...'
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
  };
};
