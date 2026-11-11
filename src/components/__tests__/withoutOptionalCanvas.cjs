// Preload only for DOM render tests, never imported by the app.
// jsdom supports an absent optional canvas; the sandbox has its JS package but no native binary.
// No tested auth/DOM behavior uses canvas. All other modules load normally.
const Module = require("module");
const originalLoad = Module._load;
Module._load = function (id, ...args) {
  if (id === "canvas") return {};
  return originalLoad.call(this, id, ...args);
};