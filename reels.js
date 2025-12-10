import { CONFIG } from './config.js';

const SYMBOL_HEIGHT = 120;

class Reel {
  constructor(root) {
    this.root = root;
    this.track = root.querySelector('.reel-track');
    this.currentSymbols = randomFill();
    this.render(this.currentSymbols);
  }

  render(symbols) {
    this.track.innerHTML = '';
    symbols.forEach((symbol) => {
      const cell = document.createElement('div');
      cell.className = 'reel-cell';
      cell.textContent = symbol.icon;
      cell.dataset.name = symbol.name;
      this.track.appendChild(cell);
    });
  }

  spinTo(targetSymbol, index = 0) {
    const filler = Array.from({ length: 8 }, () => pickSymbol());
    const sequence = [...filler, targetSymbol];
    this.render(sequence);
    this.track.style.transform = 'translateY(0)';

    const distance = (sequence.length - CONFIG.visibleRows) * SYMBOL_HEIGHT;
    const duration = CONFIG.spinDurationMs + index * CONFIG.spinStaggerMs;

    const animation = this.track.animate(
      [
        { transform: 'translateY(0)' },
        { transform: `translateY(-${distance}px)` },
      ],
      {
        duration,
        easing: 'cubic-bezier(0.1, 0.9, 0.2, 1)',
        fill: 'forwards',
      },
    );

    animation.addEventListener('finish', () => {
      this.track.style.transform = `translateY(-${distance}px)`;
    });
  }
}

const pickSymbol = () => CONFIG.symbols[Math.floor(Math.random() * CONFIG.symbols.length)];
const randomFill = () => Array.from({ length: CONFIG.visibleRows }, pickSymbol);

export const createReels = () => {
  const reels = Array.from(document.querySelectorAll('.reel')).map(
    (el) => new Reel(el),
  );

  const spin = (targets) => {
    reels.forEach((reel, idx) => {
      const targetName = targets[idx];
      const symbol = CONFIG.symbols.find((s) => s.name === targetName) || pickSymbol();
      reel.spinTo(symbol, idx);
    });
  };

  return { spin };
};
