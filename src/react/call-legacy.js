/** Invoke a function registered on window by core.js / firebase-app.js. */
export function callLegacy(name, ...args) {
  const fn = window[name];
  if (typeof fn === 'function') fn(...args);
}
