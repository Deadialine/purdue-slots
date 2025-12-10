import { CONFIG } from './config.js';

const createSymbolNode = (symbol) => {
  const node = document.createElement('div');
  node.className = 'symbol';
  const img = document.createElement('img');
  img.src = symbol.image;
  img.alt = symbol.name;
  node.appendChild(img);
  return node;
};

class Reel {
  constructor(element) {
    this.el = element;
    this.track = element.querySelector('.reel-track');
    this.currentStops = Array(CONFIG.visibleSymbols).fill(CONFIG.symbols[0].name);
    this.renderStatic(this.currentStops);
  }

  renderStatic(symbolNames) {
    this.track.innerHTML = '';
    symbolNames.forEach((name) => {
      const symbol = CONFIG.symbols.find((s) => s.name === name) || CONFIG.symbols[0];
      this.track.appendChild(createSymbolNode(symbol));
    });
    this.track.style.transition = 'none';
    this.track.style.transform = 'translateY(0px)';
    this.currentStops = symbolNames;
  }

  buildSequence(targetName) {
    const targetIndex = CONFIG.symbols.findIndex((s) => s.name === targetName);
    const safeIndex = targetIndex >= 0 ? targetIndex : Math.floor(Math.random() * CONFIG.symbols.length);
    const sequence = [...this.currentStops.map((name) => CONFIG.symbols.find((s) => s.name === name) || CONFIG.symbols[0])];

    const fullSymbols = CONFIG.symbols;
    const totalLoopItems = CONFIG.cyclesPerSpin * fullSymbols.length;
    for (let i = 0; i < totalLoopItems; i += 1) {
      sequence.push(fullSymbols[i % fullSymbols.length]);
    }

    for (let offset = CONFIG.visibleSymbols - 1; offset >= 0; offset -= 1) {
      sequence.push(fullSymbols[(safeIndex - offset + fullSymbols.length) % fullSymbols.length]);
    }

    return sequence;
  }

  spinTo(targetName, duration) {
    return new Promise((resolve) => {
      const sequence = this.buildSequence(targetName);
      this.track.innerHTML = '';
      sequence.forEach((symbol) => this.track.appendChild(createSymbolNode(symbol)));

      const travel = (sequence.length - CONFIG.visibleSymbols) * CONFIG.symbolHeight;
      this.track.style.transition = 'none';
      this.track.style.transform = 'translateY(0px)';

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.track.style.transition = `transform ${duration}ms ${CONFIG.easing}`;
          this.track.style.transform = `translateY(-${travel}px)`;
        });
      });

      const onComplete = () => {
        const finalWindow = sequence.slice(sequence.length - CONFIG.visibleSymbols).map((s) => s.name);
        this.renderStatic(finalWindow);
        this.track.removeEventListener('transitionend', onComplete);
        resolve(finalWindow);
      };

      this.track.addEventListener('transitionend', onComplete, { once: true });
    });
  }
}

export class ReelSet {
  constructor(root) {
    this.reels = Array.from(root.querySelectorAll('.reel')).map((el) => new Reel(el));
  }

  renderStatic(symbols) {
    this.reels.forEach((reel, index) => {
      const name = symbols[index] || CONFIG.symbols[0].name;
      reel.renderStatic(Array(CONFIG.visibleSymbols).fill(name));
    });
  }

  spinToTargets(targets) {
    return Promise.all(
      this.reels.map((reel, idx) => new Promise((resolve) => {
        const delay = idx * CONFIG.spinStaggerMs;
        setTimeout(() => {
          reel.spinTo(targets[idx], CONFIG.spinDurationMs + idx * 120).then(resolve);
        }, delay);
      })),
    );
  }
}
