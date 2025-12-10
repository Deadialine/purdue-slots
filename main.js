// Legacy entry point kept for compatibility. The slot machine now lives in control.js and display.js.
// This file simply redirects to the control screen when loaded directly.
if (typeof window !== 'undefined') {
  window.location.replace('./control.html');
}
