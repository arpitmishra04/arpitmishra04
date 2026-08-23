// Local preview server for the portfolio site.
// Not part of the deployed site — GitHub Pages serves site/ directly.
// Usage: node tools/serve.js [port]
const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "site");
const port = Number(process.argv[2] || 8099);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json"
};

http
  .createServer((req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0]);
    const file = path.join(root, url === "/" ? "index.html" : url);

    if (!file.startsWith(root)) {
      res.writeHead(403, { "content-type": "text/plain" }).end("forbidden");
      return;
    }

    fs.readFile(file, (err, buf) => {
      if (err) {
        res.writeHead(404, { "content-type": "text/plain" }).end("not found: " + url);
        return;
      }
      res.writeHead(200, {
        "content-type": types[path.extname(file)] || "application/octet-stream",
        // always re-read from disk so edits show on refresh
        "cache-control": "no-store"
      });
      res.end(buf);
    });
  })
  .listen(port, "127.0.0.1", () => {
    console.log("serving site/ on http://127.0.0.1:" + port);
  });
