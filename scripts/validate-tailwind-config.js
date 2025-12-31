(async () => {
  try {
    // dynamic import to support ESM/CJS interop
    await import("../tailwind.config.js");
    console.log("tailwind config OK");
    process.exit(0);
  } catch (err) {
    console.error("tailwind config failed to load:", err);
    process.exit(1);
  }
})();
