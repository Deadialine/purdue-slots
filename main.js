/**
 * Purdue-themed Slot Machine
 * How to run:
 *   - Serve the folder with a static server (e.g., `npx serve .` or `python -m http.server 8000`).
 *   - Open http://localhost:8000 and press Insert then Spin.
 * Asset notes:
 *   - Placeholder image URLs are defined in CONFIG.symbols. Swap them with real Purdue images or host
 *     replacements in ./assets/ and update the URLs.
 */

// ---------------------------
// Configuration (tweak freely)
// ---------------------------
const CONFIG = {
  winBiasChance: 0.35, // 35% chance to force a win (change to 0.60, 0.80, etc.)

  startingCredits: 0,
  costPerSpin: 1,
  betOptions: [0.2, 0.25, 0.5, 1],
  defaultBet: 1,
  visibleSymbols: 3,
  symbolHeight: 120,
  spinDurationMs: 1800, // base spin duration per reel
  spinStaggerMs: 180,    // delay between reel starts
  cyclesPerSpin: 4,      // how many full symbol loops to complete before stopping
  easing: 'cubic-bezier(0.22, 0.68, 0.24, 1.02)',
  symbols: [
    { name: 'Pete the Mascot', image: 'assets/images/pete.png' },
    { name: 'Purdue "P" Logo', image: 'assets/images/plogo.png' },
    { name: 'Purdue Bell Tower', image: 'assets/images/bell.png' },
    { name: 'Engineering Fountain', image:'assets/images/engineering_fountain.png' },
    { name: 'Unfinished Block "P"', image: 'assets/images/unfinished_p.png' },
    { name: 'Purdue Archway', image: 'assets/images/arhway.png' },
    { name: 'Lionhead Fountain', image: 'assets/images/lionhead_fountain.png' },
    { name: 'Purdue Water Tower', image: 'assets/images/water_tower.png' },
  ],
  // Base payout multipliers (3 of a kind)
  payoutMultipliers: {
    'Pete the Mascot': 15,
    'Purdue "P" Logo': 10,
    'Purdue Bell Tower': 5,
    'Engineering Fountain': 5,
    'Unfinished Block "P"': 6,
    'Purdue Archway': 5,
    'Lionhead Fountain': 7,
    'Purdue Water Tower': 6,
  },
  multipliers: [
    { value: 10, chance: 0.02 },
    { value: 5, chance: 0.05 },
    { value: 2, chance: 0.12 },
  ],
};

const SLOGANS = [
  'Hail Purdue!',
  'Boiler Up!',
  'Boiler GOLD Bonus!',
  'Hammer Down!',
  'Boiler Victory!',
  'Unstoppable Boiler Makers!',
];

// Utility: format currency consistently
const dollars = (val) => `$${val.toFixed(2)}`;

// Reel class encapsulates a single spinning column
class Reel {
  constructor(element, symbols, config) {
    this.el = element;
    this.track = element.querySelector('.reel-track');
    this.symbols = symbols;
    this.config = config;
    this.currentStops = this.randomWindow();
    this.renderStatic(this.currentStops);
  }

  randomWindow() {
    const { visibleSymbols } = this.config;
    const window = [];
    const len = this.symbols.length;
    const start = Math.floor(Math.random() * len);
    for (let i = 0; i < visibleSymbols; i++) {
      window.push(this.symbols[(start + i) % len]);
    }
    return window;
  }

  renderStatic(symbolWindow) {
    this.track.innerHTML = '';
    symbolWindow.forEach((symbol) => {
      const node = document.createElement('div');
      node.className = 'symbol';
      node.innerHTML = `<img src="${symbol.image}" alt="${symbol.name}">`;
      this.track.appendChild(node);
    });
    this.track.style.transition = 'none';
    this.track.style.transform = 'translateY(0px)';
  }

  buildSequence(targetIndex, cycles) {
    const { visibleSymbols } = this.config;
    const sequence = [...this.currentStops];
    const len = this.symbols.length;
    const totalItems = cycles * len;
    for (let i = 0; i < totalItems; i++) {
      sequence.push(this.symbols[i % len]);
    }
    // append the final visible window ending at targetIndex
    for (let i = visibleSymbols; i > 0; i--) {
      sequence.push(this.symbols[(targetIndex - (visibleSymbols - i) + len) % len]);
    }
    return sequence;
  }

  spin(duration) {
    return new Promise((resolve) => {
      const len = this.symbols.length;
      const targetIndex = Math.floor(Math.random() * len);
      const sequence = this.buildSequence(targetIndex, this.config.cyclesPerSpin);
      this.track.innerHTML = '';
      sequence.forEach((symbol) => {
        const node = document.createElement('div');
        node.className = 'symbol';
        node.innerHTML = `<img src="${symbol.image}" alt="${symbol.name}">`;
        this.track.appendChild(node);
      });

      const shift = (sequence.length - this.config.visibleSymbols) * this.config.symbolHeight;
      this.track.style.transition = 'none';
      this.track.style.transform = 'translateY(0px)';

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.track.style.transition = `transform ${duration}ms ${this.config.easing}`;
          this.track.style.transform = `translateY(-${shift}px)`;
        });
      });

      const cleanup = () => {
        this.track.removeEventListener('transitionend', cleanup);
        const finalWindow = sequence.slice(sequence.length - this.config.visibleSymbols);
        this.currentStops = finalWindow;
        this.renderStatic(finalWindow);
        resolve(finalWindow);
      };

      this.track.addEventListener('transitionend', cleanup, { once: true });
    });
  }
}

// SlotMachine orchestrates reels, credits, and UI
class SlotMachine {
  constructor(config) {
    this.config = config;
    this.balance = config.startingCredits;
    this.currentBet = config.defaultBet || config.costPerSpin;
    this.reels = Array.from(document.querySelectorAll('.reel')).map(
      (el) => new Reel(el, config.symbols, config)
    );
    this.refs = {
      balance: document.getElementById('balance'),
      result: document.getElementById('result'),
      cost: document.getElementById('cost'),
      spin: document.getElementById('spin'),
      insert: document.getElementById('insert'),
      reset: document.getElementById('reset'),
      betOptions: document.getElementById('bet-options'),
      multiplierBadge: document.getElementById('multiplier-badge'),
      celebrationLayer: document.getElementById('celebration-layer'),
      sloganBanner: document.getElementById('slogan-banner'),
      autoSpin: document.getElementById('auto-spin'),
    };
    this.locked = false;
    this.autoSpinActive = false;
    this.autoSpinTimer = null;
    this.sounds = {
      small: new Audio('assets/sounds/win_small.mp3'),
      medium: new Audio('assets/sounds/win_medium.mp3'),
      big: new Audio('assets/sounds/win_big.mp3'),
      champion: new Audio('assets/sounds/champion_music.mp3'),
	  slot: new Audio('assets/sounds/slot_sound.mp3')
    };
    this.updateUi();
    this.bindUi();
    this.renderBetOptions();
  }

  bindUi() {
    this.refs.spin.addEventListener('click', () => this.handleSpin());
    this.refs.insert.addEventListener('click', () => this.addCredits(1));
    this.refs.reset.addEventListener('click', () => this.reset());
    this.refs.autoSpin.addEventListener('click', () => {
      if (this.autoSpinActive) {
        this.stopAutoSpin('Auto spin stopped.');
      } else {
        this.startAutoSpin();
      }
    });
  }

  updateUi(message) {
    this.refs.balance.textContent = dollars(this.balance);
    this.refs.cost.textContent = dollars(this.currentBet);
    if (message) {
      this.refs.result.textContent = message;
    }
  }

  renderBetOptions() {
    this.refs.betOptions.innerHTML = '';
    this.config.betOptions.forEach((bet) => {
      const option = document.createElement('label');
      option.className = 'bet-option';

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'bet';
      input.value = bet;
      input.checked = bet === this.currentBet;
      input.addEventListener('change', () => this.setBet(bet, option));

      const text = document.createElement('span');
      text.textContent = dollars(bet);

      option.appendChild(input);
      option.appendChild(text);
      if (input.checked) option.classList.add('active');
      this.refs.betOptions.appendChild(option);
    });
  }

  setBet(amount, element) {
    this.currentBet = amount;
    this.updateUi(`Bet set to ${dollars(amount)}`);
    Array.from(this.refs.betOptions.children).forEach((child) => {
      const active = child === element;
      const input = child.querySelector('input');
      if (input) input.checked = active;
      child.classList.toggle('active', active);
    });
  }

  addCredits(amount) {
    this.balance += amount;
    this.updateUi(`Added ${dollars(amount)}. Ready to spin!`);
  }

  lockButtons(state) {
    this.refs.spin.disabled = state;
    this.refs.insert.disabled = state;
    this.refs.reset.disabled = state;
    this.refs.autoSpin.disabled = state && !this.autoSpinActive;
  }

  async handleSpin() {
    if (this.locked) return null;
    if (this.balance < this.currentBet) {
      this.updateUi('Insert more credits to spin.');
      this.stopAutoSpin();
      return null;
    }

	this.balance -= this.currentBet;
	this.updateUi('Spinning...');

	// 🔊 PLAY SLOT SPIN SOUND HERE
	this.sounds.slot.currentTime = 0;
	this.sounds.slot.play().catch(() => {});

	this.locked = true;
	this.lockButtons(true);
	this.hideMultiplierBadge();

    const spinPromises = this.reels.map((reel, index) =>
      new Promise((resolve) => {
        setTimeout(() => {
          reel.spin(this.config.spinDurationMs + index * 120).then(resolve);
        }, index * this.config.spinStaggerMs);
      })
    );

    const results = await Promise.all(spinPromises);
	// --- WIN BIASING: Force a win with probability CONFIG.winBiasChance ---

    const windowSymbols = results.map((window) => window[Math.floor(window.length / 2)]);
    const baseWin = this.calculatePayout(windowSymbols);
    let payout = 0;
    let multiplier = 1;

    if (baseWin > 0) {
      multiplier = this.rollMultiplier();
      payout = baseWin * multiplier;
      this.balance += payout;
      this.updateUi(`WIN: ${windowSymbols[0].name} pays ${dollars(baseWin)}${multiplier > 1 ? ` x${multiplier}` : ''}!`);
      this.handleWinEffects(payout, multiplier);
    } else {
      this.updateUi('No win. Try again!');
    }

    this.locked = false;
    this.lockButtons(false);
    if (this.autoSpinActive) {
      if (this.balance < this.currentBet) {
        this.stopAutoSpin('Auto spin stopped: Not enough credits.');
      } else {
        this.autoSpinTimer = setTimeout(() => this.handleSpin(), 1000);
      }
    }
    return { payout, multiplier };
  }

  calculatePayout(symbols) {
    const [a, b, c] = symbols;
    const same = a.name === b.name && b.name === c.name;
    if (!same) return 0;
    const multiplier = this.config.payoutMultipliers[a.name] ?? 5;
    return multiplier * this.currentBet;
  }

  rollMultiplier() {
    const roll = Math.random();
    let cumulative = 0;
    for (const entry of this.config.multipliers) {
      cumulative += entry.chance;
      if (roll < cumulative) return entry.value;
    }
    return 1;
  }

  showMultiplierBadge(value) {
    this.refs.multiplierBadge.textContent = `x${value} Multiplier!`;
    this.refs.multiplierBadge.classList.remove('hidden');
    requestAnimationFrame(() => {
      this.refs.multiplierBadge.classList.add('show');
    });
  }

  hideMultiplierBadge() {
    this.refs.multiplierBadge.classList.remove('show');
    this.refs.multiplierBadge.classList.add('hidden');
  }

  playWinSound(type) {
    const audio = this.sounds[type];
    if (!audio) return;
    audio.currentTime = 0;
    audio.volume = 0.85;
    audio.play().catch(() => {});
  }

  handleWinEffects(payout, multiplier) {
    const tierSmall = this.currentBet * 8;
    const tierMedium = this.currentBet * 14;
    const tierBig = this.currentBet * 24;

    if (multiplier > 1) {
      this.showMultiplierBadge(multiplier);
      this.triggerMultiplierWinEffects(multiplier);
    }

    if (payout >= tierBig || multiplier >= 5) {
      this.triggerBigWinEffects();
      this.playWinSound('champion');
    } else if (payout >= tierMedium) {
      this.triggerMediumWinEffects();
      this.playWinSound('medium');
    } else if (payout >= tierSmall) {
      this.triggerSmallWinEffects();
      this.playWinSound('small');
    } else {
      this.triggerSmallWinEffects();
      this.playWinSound('small');
    }
  }

  triggerSmallWinEffects() {
    this.clearCelebrationLayer();
    this.spawnConfetti(18, ['gold']);
    this.spawnSparkles(14);
    this.showSlogan();
  }

  triggerMediumWinEffects() {
    this.clearCelebrationLayer();
    this.spawnConfetti(34, ['gold', 'dark']);
    this.spawnSparkles(24);
    this.addVignette();
    this.showSlogan();
  }

  triggerBigWinEffects() {
    this.clearCelebrationLayer();
    this.spawnConfetti(60, ['gold', 'dark']);
    this.spawnSparkles(40);
    this.addVignette();
    this.shakeMachine();
    this.showSlogan('Hail Purdue!');
  }

  triggerMultiplierWinEffects(multiplier) {
    this.spawnConfetti(24, ['gold']);
  }

  spawnConfetti(count, palettes) {
    const layer = this.refs.celebrationLayer;
    for (let i = 0; i < count; i++) {
      const piece = document.createElement('div');
      piece.className = `confetti-piece ${palettes[i % palettes.length] || ''}`;
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.animationDelay = `${Math.random() * 0.4}s`;
      piece.style.transform = `rotate(${Math.random() * 180}deg)`;
      layer.appendChild(piece);
      setTimeout(() => piece.remove(), 1900);
    }
  }

  spawnSparkles(count) {
    const layer = this.refs.celebrationLayer;
    for (let i = 0; i < count; i++) {
      const sparkle = document.createElement('div');
      sparkle.className = 'sparkle';
      sparkle.style.left = `${Math.random() * 100}%`;
      sparkle.style.top = `${Math.random() * 100}%`;
      sparkle.style.animationDelay = `${Math.random() * 0.3}s`;
      layer.appendChild(sparkle);
      setTimeout(() => sparkle.remove(), 1300);
    }
  }

  addVignette() {
    const vignette = document.createElement('div');
    vignette.className = 'vignette';
    this.refs.celebrationLayer.appendChild(vignette);
    setTimeout(() => vignette.remove(), 1500);
  }

  shakeMachine() {
    const shell = document.querySelector('.machine-shell');
    shell.classList.add('shake');
    setTimeout(() => shell.classList.remove('shake'), 1200);
  }

  showSlogan(text) {
    const slogan = this.refs.sloganBanner;
    slogan.textContent = text || SLOGANS[Math.floor(Math.random() * SLOGANS.length)];
    slogan.classList.remove('hidden');
    slogan.style.animation = 'none';
    // force reflow
    void slogan.offsetWidth;
    slogan.style.animation = '';
    setTimeout(() => slogan.classList.add('hidden'), 2000);
  }

  clearCelebrationLayer() {
    this.refs.celebrationLayer.innerHTML = '';
  }

  startAutoSpin() {
    if (this.autoSpinActive) return;
    if (this.balance < this.currentBet) {
      this.updateUi('Insert more credits to auto spin.');
      return;
    }
    this.autoSpinActive = true;
    this.refs.autoSpin.classList.add('toggled');
    this.refs.autoSpin.textContent = 'Stop Auto';
    if (this.locked) {
      this.autoSpinTimer = setTimeout(() => this.handleSpin(), 500);
      return;
    }
    this.handleSpin();
  }

  stopAutoSpin(message) {
    this.autoSpinActive = false;
    this.refs.autoSpin.classList.remove('toggled');
    this.refs.autoSpin.textContent = 'Auto Spin';
    clearTimeout(this.autoSpinTimer);
    if (message) this.updateUi(message);
  }

  reset() {
    this.stopAutoSpin('Machine reset. Insert credits to play.');
    this.balance = 0;
    this.refs.result.textContent = 'Machine reset. Insert credits to play.';
    this.reels.forEach((reel) => {
      reel.currentStops = reel.randomWindow();
      reel.renderStatic(reel.currentStops);
    });
    this.hideMultiplierBadge();
    this.clearCelebrationLayer();
    this.refs.sloganBanner.classList.add('hidden');
    this.updateUi();
  }
}

// Initialize once DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  const machine = new SlotMachine(CONFIG);
  // Add light strip overlay for shimmer effect
  const light = document.createElement('div');
  light.className = 'light-strip';
  document.querySelector('.machine-shell').appendChild(light);

  // Playable via keyboard (space to spin) for future physical button integration
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      machine.handleSpin();
    }
  });
});
