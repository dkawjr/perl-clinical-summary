import { request } from "node:http";

const timeoutMs = 2_000;
const probe = request({
  host: "127.0.0.1",
  port: Number(process.env.PORT || 4173),
  path: "/api/live",
  method: "GET",
  timeout: timeoutMs,
  headers: { Accept: "application/json" }
}, response => {
  let body = "";
  response.setEncoding("utf8");
  response.on("data", chunk => {
    body += chunk;
    if (body.length > 16 * 1024) response.destroy(new Error("Liveness response exceeded 16 KB."));
  });
  response.on("end", () => {
    try {
      const result = JSON.parse(body);
      process.exitCode = response.statusCode === 200 && result.ok === true && result.processAlive === true ? 0 : 1;
    } catch {
      process.exitCode = 1;
    }
  });
});

probe.on("timeout", () => probe.destroy(new Error(`Liveness probe exceeded ${timeoutMs} ms timeout.`)));
probe.on("error", () => { process.exitCode = 1; });
probe.end();
