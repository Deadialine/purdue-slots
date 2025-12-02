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
  startingCredits: 0,
  costPerSpin: 1,
  visibleSymbols: 3,
  symbolHeight: 120,
  spinDurationMs: 1800, // base spin duration per reel
  spinStaggerMs: 180,    // delay between reel starts
  cyclesPerSpin: 4,      // how many full symbol loops to complete before stopping
  easing: 'cubic-bezier(0.22, 0.68, 0.24, 1.02)',
  symbols: [
    { name: 'Pete the Mascot', image: 'https://via.placeholder.com/240x240/2d2926/ffd700?text=Pete+Mascot' },
    { name: 'Purdue "P" Logo', image: 'https://via.placeholder.com/240x240/000000/CFB991?text=Purdue+P' },
    { name: 'Purdue Bell Tower', image: 'https://via.placeholder.com/240x240/2d2926/ffffff?text=Bell+Tower' },
    { name: 'Engineering Fountain', image: 'https://via.placeholder.com/240x240/1c1b17/ffd700?text=Engineering+Fountain' },
    { name: 'Unfinished Block "P"', image: 'https://via.placeholder.com/240x240/1b1a15/CFB991?text=Block+P' },
    { name: 'Purdue Archway', image: 'https://via.placeholder.com/240x240/2b2926/ffefc5?text=Archway' },
    { name: 'Lionhead Fountain', image: 'https://via.placeholder.com/240x240/1c1b19/f8e1a0?text=Lionhead+Fountain' },
    { name: 'Purdue Water Tower', image: 'https://via.placeholder.com/240x240/2a2824/ffe9aa?text=Water+Tower' },
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
};

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
    };
    this.locked = false;
    this.updateUi();
    this.bindUi();
  }

  bindUi() {
    this.refs.spin.addEventListener('click', () => this.handleSpin());
    this.refs.insert.addEventListener('click', () => this.addCredits(1));
    this.refs.reset.addEventListener('click', () => this.reset());
  }

  updateUi(message) {
    this.refs.balance.textContent = dollars(this.balance);
    this.refs.cost.textContent = dollars(this.config.costPerSpin);
    if (message) {
      this.refs.result.textContent = message;
    }
  }

  addCredits(amount) {
    this.balance += amount;
    this.updateUi(`Added ${dollars(amount)}. Ready to spin!`);
  }

  lockButtons(state) {
    this.refs.spin.disabled = state;
    this.refs.insert.disabled = state;
    this.refs.reset.disabled = state;
  }

  async handleSpin() {
    if (this.locked) return;
    if (this.balance < this.config.costPerSpin) {
      this.updateUi('Insert more credits to spin.');
      return;
    }

    this.balance -= this.config.costPerSpin;
    this.updateUi('Spinning...');
    this.locked = true;
    this.lockButtons(true);

    const spinPromises = this.reels.map((reel, index) =>
      new Promise((resolve) => {
        setTimeout(() => {
          reel.spin(this.config.spinDurationMs + index * 120).then(resolve);
        }, index * this.config.spinStaggerMs);
      })
    );

    const results = await Promise.all(spinPromises);
    const windowSymbols = results.map((window) => window[Math.floor(window.length / 2)]);
    const payout = this.calculatePayout(windowSymbols);
    if (payout > 0) {
      this.balance += payout;
      this.updateUi(`WIN: ${windowSymbols[0].name} pays ${dollars(payout)}!`);
    } else {
      this.updateUi('No win. Try again!');
    }

    this.locked = false;
    this.lockButtons(false);
  }

  calculatePayout(symbols) {
    const [a, b, c] = symbols;
    const same = a.name === b.name && b.name === c.name;
    if (!same) return 0;
    const multiplier = this.config.payoutMultipliers[a.name] ?? 5;
    return multiplier * this.config.costPerSpin;
  }

  reset() {
    this.balance = 0;
    this.refs.result.textContent = 'Machine reset. Insert credits to play.';
    this.reels.forEach((reel) => {
      reel.currentStops = reel.randomWindow();
      reel.renderStatic(reel.currentStops);
    });
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
