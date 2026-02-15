// Minimal proxy that mimics Supabase API gateway for local dev.
// Routes /auth/v1/* -> GoTrue on port 9999
import http from "node:http";

const GOTRUE = "http://127.0.0.1:9999";
const PORT = 54321;

const server = http.createServer((req, res) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Authorization,Content-Type,apikey,x-client-info",
    });
    return res.end();
  }

  let target;
  let path = req.url;

  if (path.startsWith("/auth/v1")) {
    target = GOTRUE;
    path = path.replace("/auth/v1", "");
    if (!path) path = "/";
  } else {
    res.writeHead(404);
    return res.end("Not found");
  }

  const url = new URL(path, target);

  const proxyReq = http.request(
    url,
    {
      method: req.method,
      headers: { ...req.headers, host: url.host },
    },
    (proxyRes) => {
      const headers = { ...proxyRes.headers, "Access-Control-Allow-Origin": "*" };
      res.writeHead(proxyRes.statusCode, headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on("error", (err) => {
    console.error("Proxy error:", err.message);
    res.writeHead(502);
    res.end("Bad Gateway");
  });

  req.pipe(proxyReq);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Supabase proxy listening on :${PORT} -> GoTrue at ${GOTRUE}`);
});
