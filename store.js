import { CONFIG } from './config.js';

const CHANNEL_NAME = 'purdue-slot-sync-v2';
const STORAGE_KEY = 'purdue-slot-state-v2';

const randomId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2));

const pickSymbolName = () => CONFIG.symbols[Math.floor(Math.random() * CONFIG.symbols.length)].name;

const randomSymbols = (count) => Array.from({ length: count }, () => pickSymbolName());

const evaluateWin = (symbols, wager) => {
  if (!Array.isArray(symbols) || symbols.length !== CONFIG.reels) return { payout: 0, multiplier: 1 };
  const [a, b, c] = symbols;
  if (a !== b || b !== c) return { payout: 0, multiplier: 1 };
  const symbol = CONFIG.symbols.find((s) => s.name === a);
  const payout = (symbol?.payout ?? 5) * wager;
  return { payout, multiplier: 1 };
};

const createFallbackMessenger = (onMessage) => {
  const key = `${CHANNEL_NAME}-message`;

  const handler = (event) => {
    if (event.key !== key || !event.newValue) return;
    try {
      const payload = JSON.parse(event.newValue);
      onMessage(payload);
    } catch (err) {
      // ignore malformed payloads
    }
  };

  window.addEventListener('storage', handler);

  return {
    post: (payload) => {
      const message = JSON.stringify({ ...payload, ts: Date.now() });
      try {
        localStorage.setItem(key, message);
      } catch (err) {
        // ignore persistence failures
      }
    },
    close: () => window.removeEventListener('storage', handler),
  };
};

export const createSharedGame = () => {
  const instanceId = randomId();
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL_NAME) : null;
  const messenger = channel
    ? null
    : createFallbackMessenger((payload) => inbound(payload));

  const subscribers = new Set();
  const spinListeners = new Set();

  const load = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (err) {
      return null;
    }
  };

  const save = (snapshot) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch (err) {
      // persistence best-effort
    }
  };

  let state = {
    credits: CONFIG.startingCredits,
    bet: CONFIG.defaultBet,
    multiplier: 1,
    spinning: false,
    autoSpin: false,
    autoSpinInterval: 1200,
    lastSymbols: randomSymbols(CONFIG.reels),
    lastResult: 'Insert credits to play.',
    lastWin: 0,
    totalWon: 0,
    lastSpinId: null,
  };

  const stored = load();
  if (stored) state = { ...state, ...stored, spinning: false };

  const emitState = () => subscribers.forEach((fn) => fn({ ...state }));
  const emitSpin = (payload) => spinListeners.forEach((fn) => fn(payload));

  const broadcast = (type, payload) => {
    const envelope = { type, payload, from: instanceId };
    if (channel) {
      channel.postMessage(envelope);
    } else {
      messenger.post(envelope);
    }
  };

  const syncState = (next, { silent = false } = {}) => {
    state = { ...state, ...next };
    save(state);
    if (!silent) emitState();
  };

  const inbound = (message) => {
    if (!message || message.from === instanceId) return;
    switch (message.type) {
      case 'hello':
        broadcast('state', { snapshot: state });
        break;
      case 'state':
        if (message.payload?.snapshot) {
          syncState(message.payload.snapshot, { silent: false });
        }
        break;
      case 'spin-start':
        handleRemoteSpin(message.payload);
        break;
      case 'spin-settle':
        handleRemoteSettle(message.payload);
        break;
      default:
        break;
    }
  };

  if (channel) {
    channel.addEventListener('message', (event) => inbound(event.data));
  }

  const handleRemoteSpin = (payload) => {
    if (!payload) return;
    const { spinId, targets, wager } = payload;
    syncState({
      spinning: true,
      lastResult: 'Spinning...',
      lastWin: 0,
      lastSpinId: spinId,
      credits: Math.max(0, state.credits - (wager ?? 0)),
    });
    emitSpin({ type: 'start', targets, spinId });
  };

  const handleRemoteSettle = (payload) => {
    if (!payload) return;
    const { targets, spinId, payout } = payload;
    const [result, multiplier] = payload.resultText ? payload.resultText.split(' | ') : ['Spin complete', ''];
    syncState({
      spinning: false,
      lastSymbols: targets,
      lastResult: result,
      lastWin: payout,
      totalWon: state.totalWon + payout,
      lastSpinId: spinId,
      multiplier: state.multiplier,
    });
    emitSpin({ type: 'settle', targets, spinId, payout, multiplierText: multiplier });
  };

  const requestState = () => broadcast('hello', {});
  requestState();

  const setBet = (value) => {
    const bet = Number(value);
    if (!Number.isFinite(bet) || bet <= 0) return;
    syncState({ bet, lastResult: `Bet set to $${bet.toFixed(2)}` });
    broadcast('state', { snapshot: state });
  };

  const setMultiplier = (value) => {
    const multiplier = Math.max(1, Number(value));
    if (!Number.isFinite(multiplier)) return;
    syncState({ multiplier, lastResult: `Multiplier set to x${multiplier}` });
    broadcast('state', { snapshot: state });
  };

  const addCredits = (value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
      syncState({ lastResult: 'Enter a valid amount to add.' });
      return;
    }
    syncState({ credits: state.credits + amount, lastResult: `Added $${amount.toFixed(2)}.` });
    broadcast('state', { snapshot: state });
  };

  const reset = () => {
    syncState({
      credits: CONFIG.startingCredits,
      bet: CONFIG.defaultBet,
      multiplier: 1,
      spinning: false,
      autoSpin: false,
      lastSymbols: randomSymbols(CONFIG.reels),
      lastResult: 'Machine reset. Insert credits to play.',
      lastWin: 0,
      totalWon: 0,
    });
    broadcast('state', { snapshot: state });
  };

  const startSpin = () => {
    if (state.spinning) return { ok: false, reason: 'Already spinning.' };
    const wager = state.bet * state.multiplier;
    if (wager <= 0) return { ok: false, reason: 'Set a bet before spinning.' };
    if (state.credits < wager) {
      syncState({ lastResult: 'Insufficient credits.' });
      return { ok: false, reason: 'Insufficient credits.' };
    }

    const spinId = randomId();
    const targets = randomSymbols(CONFIG.reels);

    syncState({
      credits: state.credits - wager,
      spinning: true,
      lastWin: 0,
      lastResult: 'Spinning...',
      lastSpinId: spinId,
    });
    emitSpin({ type: 'start', targets, spinId });
    broadcast('spin-start', { targets, spinId, wager });

    const settleAfter = CONFIG.spinDurationMs + CONFIG.spinStaggerMs * (CONFIG.reels - 1) + 150;
    setTimeout(() => {
      const { payout, multiplier } = evaluateWin(targets, wager);
      const resultText = payout > 0
        ? `${targets[0]} wins $${payout.toFixed(2)} | x${multiplier}`
        : 'No win this time';
      syncState({
        credits: state.credits + payout,
        lastResult: resultText.split(' | ')[0],
        lastSymbols: targets,
        lastWin: payout,
        totalWon: state.totalWon + payout,
        spinning: false,
      });
      emitSpin({ type: 'settle', targets, spinId, payout, multiplierText: multiplier > 1 ? `x${multiplier}` : '' });
      broadcast('spin-settle', { targets, spinId, payout, resultText });
    }, settleAfter);

    return { ok: true, spinId, targets };
  };

  const setAutoSpin = (active) => {
    syncState({ autoSpin: !!active });
    broadcast('state', { snapshot: state });
  };

  const setAutoSpinInterval = (value) => {
    const interval = Math.max(CONFIG.minAutoSpinInterval, Number(value));
    if (!Number.isFinite(interval)) return;
    syncState({ autoSpinInterval: interval });
    broadcast('state', { snapshot: state });
  };

  const subscribe = (fn) => {
    subscribers.add(fn);
    fn({ ...state });
    return () => subscribers.delete(fn);
  };

  const onSpin = (fn) => {
    spinListeners.add(fn);
    return () => spinListeners.delete(fn);
  };

  return {
    subscribe,
    onSpin,
    setBet,
    setMultiplier,
    addCredits,
    reset,
    startSpin,
    setAutoSpin,
    setAutoSpinInterval,
  };
};
