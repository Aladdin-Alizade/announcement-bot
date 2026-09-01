import http from "node:http";

export function startHealthServer(port, db) {
  const server = http.createServer((req, res) => {
    const url = req.url?.split("?")[0];
    if (url === "/health" || url === "/") {
      try {
        db.prepare("SELECT 1 AS ok").get();
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
      } catch {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ status: "error" }));
      }
      return;
    }
    res.writeHead(404);
    res.end();
  });
  server.listen(port, "0.0.0.0", () => {
    console.log(`Health server 0.0.0.0:${port}`);
  });
  return server;
}
