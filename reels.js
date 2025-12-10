import { CONFIG } from './config.js';

export class Reel {
  constructor(element) {
    this.el = element;
    this.track = element.querySelector('.reel-track');
    this.currentStops = [];
  }

  renderStatic(symbolNames) {
    this.track.innerHTML = '';
    symbolNames.forEach((name) => {
      const symbol = CONFIG.symbols.find((s) => s.name === name) || CONFIG.symbols[0];
      const node = document.createElement('div');
      node.className = 'symbol';
      node.innerHTML = `<img src="${symbol.image}" alt="${symbol.name}">`;
      this.track.appendChild(node);
    });
    this.track.style.transition = 'none';
    this.track.style.transform = 'translateY(0px)';
    this.currentStops = symbolNames;
  }

  buildSequence(targetIndex, cycles) {
    const { visibleSymbols } = CONFIG;
    const sequence = [...this.currentStops];
    const len = CONFIG.symbols.length;
    const totalItems = cycles * len;
    for (let i = 0; i < totalItems; i += 1) {
      sequence.push(CONFIG.symbols[i % len]);
    }
    for (let i = visibleSymbols; i > 0; i -= 1) {
      sequence.push(CONFIG.symbols[(targetIndex - (visibleSymbols - i) + len) % len]);
    }
    return sequence;
  }

  spinTo(symbolName, duration) {
    return new Promise((resolve) => {
      const len = CONFIG.symbols.length;
      const targetIndex = CONFIG.symbols.findIndex((s) => s.name === symbolName);
      const safeIndex = targetIndex >= 0 ? targetIndex : Math.floor(Math.random() * len);
      const sequence = this.buildSequence(safeIndex, CONFIG.cyclesPerSpin);
      this.track.innerHTML = '';
      sequence.forEach((symbol) => {
        const node = document.createElement('div');
        node.className = 'symbol';
        node.innerHTML = `<img src="${symbol.image}" alt="${symbol.name}">`;
        this.track.appendChild(node);
      });

      const shift = (sequence.length - CONFIG.visibleSymbols) * CONFIG.symbolHeight;
      this.track.style.transition = 'none';
      this.track.style.transform = 'translateY(0px)';

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.track.style.transition = `transform ${duration}ms ${CONFIG.easing}`;
          this.track.style.transform = `translateY(-${shift}px)`;
        });
      });

      const cleanup = () => {
        this.track.removeEventListener('transitionend', cleanup);
        const finalWindow = sequence.slice(sequence.length - CONFIG.visibleSymbols);
        this.currentStops = finalWindow.map((s) => s.name);
        this.renderStatic(this.currentStops);
        resolve(this.currentStops);
      };

      this.track.addEventListener('transitionend', cleanup, { once: true });
    });
  }
}

export class ReelSet {
  constructor(root) {
    this.reels = Array.from(root.querySelectorAll('.reel')).map((el) => new Reel(el));
  }

  renderStatic(symbolNames) {
    this.reels.forEach((reel, idx) => {
      const symbolsForReel = symbolNames[idx] ? [symbolNames[idx], symbolNames[idx], symbolNames[idx]] : symbolNames;
      reel.renderStatic(symbolsForReel);
    });
  }

  spinToTargets(targets) {
    const promises = this.reels.map((reel, index) => (
      new Promise((resolve) => {
        setTimeout(() => {
          reel.spinTo(targets[index], CONFIG.spinDurationMs + index * 120).then(resolve);
        }, index * CONFIG.spinStaggerMs);
      })
    ));
    return Promise.all(promises);
  }
}
