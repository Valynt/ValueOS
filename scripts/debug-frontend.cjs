#!/usr/bin/env node

const http = require("http");
const https = require("https");

// Test various endpoints and resources
async function testEndpoint(url) {
  return new Promise((resolve) => {
    const module = url.startsWith("https") ? https : http;

    const req = module.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        resolve({
          url,
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: res.headers,
          data: data.substring(0, 500), // First 500 chars
        });
      });
    });

    req.on("error", (err) => {
      resolve({
        url,
        error: err.message,
        status: "ERROR",
      });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve({
        url,
        error: "Timeout",
        status: "TIMEOUT",
      });
    });
  });
}

async function debugFrontend() {
  console.log("🔍 Frontend Debug Report");
  console.log("====================\n");

  // Test main page
  console.log("1. Testing main page...");
  const mainPage = await testEndpoint("http://localhost:5173/");
  console.log(`   Status: ${mainPage.status} ${mainPage.statusText || ""}`);
  if (mainPage.error) {
    console.log(`   ❌ Error: ${mainPage.error}`);
  } else {
    console.log(`   ✅ Page loaded successfully`);
    console.log(`   Content-Type: ${mainPage.headers["content-type"]}`);

    // Check for React and Vite scripts
    if (mainPage.data.includes("react")) {
      console.log(`   ✅ React detected in page`);
    }
    if (mainPage.data.includes("@vite/client")) {
      console.log(`   ✅ Vite client script detected`);
    }
  }

  // Test lucide-react icon
  console.log("\n2. Testing lucide-react fingerprint icon...");
  const iconTest = await testEndpoint(
    "http://localhost:5173/@fs/home/ino/ValueOS/node_modules/lucide-react/dist/esm/icons/fingerprint.js"
  );
  console.log(`   Status: ${iconTest.status} ${iconTest.statusText || ""}`);
  if (iconTest.error) {
    console.log(`   ❌ Error: ${iconTest.error}`);
    if (iconTest.error.includes("ERR_BLOCKED_BY_CLIENT")) {
      console.log(`   ℹ️  This is likely caused by a browser extension (ad blocker)`);
      console.log(`   💡 Try disabling ad blockers or using incognito mode`);
    }
  } else {
    console.log(`   ✅ Icon loaded successfully`);
    console.log(`   Content-Type: ${iconTest.headers["content-type"]}`);
  }

  // Test other lucide icons
  console.log("\n3. Testing other lucide-react icons...");
  const testIcons = ["chevron-down", "x", "menu", "search"];
  for (const icon of testIcons) {
    const iconUrl = `http://localhost:5173/@fs/home/ino/ValueOS/node_modules/lucide-react/dist/esm/icons/${icon}.js`;
    const result = await testEndpoint(iconUrl);
    console.log(`   ${icon}: ${result.status} ${result.statusText || ""}`);
  }

  // Test Vite client
  console.log("\n4. Testing Vite client...");
  const viteClient = await testEndpoint("http://localhost:5173/@vite/client");
  console.log(`   Status: ${viteClient.status} ${viteClient.statusText || ""}`);
  if (viteClient.error) {
    console.log(`   ❌ Error: ${viteClient.error}`);
  } else {
    console.log(`   ✅ Vite client loaded`);
  }

  // Test React refresh
  console.log("\n5. Testing React refresh...");
  const reactRefresh = await testEndpoint("http://localhost:5173/@react-refresh");
  console.log(`   Status: ${reactRefresh.status} ${reactRefresh.statusText || ""}`);
  if (reactRefresh.error) {
    console.log(`   ❌ Error: ${reactRefresh.error}`);
  } else {
    console.log(`   ✅ React refresh loaded`);
  }

  // Test main.tsx
  console.log("\n6. Testing main.tsx...");
  const mainTsx = await testEndpoint("http://localhost:5173/main.tsx");
  console.log(`   Status: ${mainTsx.status} ${mainTsx.statusText || ""}`);
  if (mainTsx.error) {
    console.log(`   ❌ Error: ${mainTsx.error}`);
  } else {
    console.log(`   ✅ main.tsx loaded`);
  }

  // Check for WebSocket endpoint
  console.log("\n7. WebSocket check...");
  console.log(`   Note: WebSocket connections use ws:// or wss:// protocol`);
  console.log(`   Expected: ws://localhost:5173 or ws://localhost:5173`);
  console.log(`   Browser extensions may block WebSocket connections`);

  console.log("\n📊 Summary");
  console.log("==========");
  console.log("If you see ERR_BLOCKED_BY_CLIENT errors:");
  console.log("1. Disable ad blockers (uBlock Origin, AdBlock Plus, etc.)");
  console.log("2. Try incognito/private browsing mode");
  console.log("3. Check browser security extensions");
  console.log("4. Clear browser cache and refresh");
  console.log("\nIf WebSocket errors persist:");
  console.log("1. Check if HMR is properly configured");
  console.log("2. Try refreshing the page");
  console.log("3. Check browser console for specific error messages");
}

// Run the debug
debugFrontend().catch(console.error);
