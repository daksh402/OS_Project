const http = require("http");
const fs = require("fs");
const path = require("path");
const { simulateSuite, defaultPayload } = require("./lib/scheduler");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

function serveFile(reqPath, res) {
  const safePath = path.normalize(reqPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath === "/" ? "index.html" : safePath);
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(PUBLIC_DIR))) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(resolved, (error, data) => {
    if (error) {
      if (path.extname(resolved) === "") {
        fs.readFile(path.join(PUBLIC_DIR, "index.html"), (fallbackError, fallbackData) => {
          if (fallbackError) {
            sendJson(res, 404, { error: "Not found" });
            return;
          }
          res.writeHead(200, { "Content-Type": MIME_TYPES[".html"] });
          res.end(fallbackData);
        });
        return;
      }
      sendJson(res, 404, { error: "Not found" });
      return;
    }

    res.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(resolved)] || "application/octet-stream"
    });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 2 * 1024 * 1024) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error("Invalid JSON payload"));
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/api/health") {
      sendJson(res, 200, { ok: true, service: "scheduler-pro-dashboard" });
      return;
    }

    if (req.method === "GET" && req.url === "/api/defaults") {
      sendJson(res, 200, defaultPayload());
      return;
    }

    if (req.method === "POST" && req.url === "/api/simulate") {
      const payload = await readBody(req);
      const result = simulateSuite(payload);
      sendJson(res, 200, result);
      return;
    }

    serveFile(req.url || "/", res);
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Unexpected server error" });
  }
});

server.listen(PORT, () => {
  console.log(`Scheduler Pro Dashboard running at http://localhost:${PORT}`);
});
