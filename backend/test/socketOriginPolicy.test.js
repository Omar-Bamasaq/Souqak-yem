import test, { after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { Server as SocketIOServer } from "socket.io";
import { corsOptions, socketAllowRequest } from "../src/config/cors.js";

const originalNodeEnv = process.env.NODE_ENV;
process.env.NODE_ENV = "test";

after(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
});

function isAccepted(origin, headers = {}) {
  let accepted;
  socketAllowRequest({ headers: { ...headers, ...(origin ? { origin } : {}) } }, (_error, allow) => {
    accepted = allow;
  });
  return accepted;
}

test("Socket.IO allows only the configured production origins and development localhost", () => {
  for (const origin of [
    "https://souqak-yem.com",
    "https://www.souqak-yem.com",
    "http://localhost:5173"
  ]) {
    assert.equal(isAccepted(origin), true, origin);
  }
});

test("Socket.IO rejects untrusted, deceptive, and missing origins even with auth cookies", () => {
  for (const origin of [
    "https://attacker.example",
    "https://souqak-beta.vercel.app",
    "https://souqak-yem.com.attacker.example",
    undefined
  ]) {
    assert.equal(isAccepted(origin, { cookie: "accessToken=signed-token" }), false, String(origin));
  }
});

test("Socket.IO rejects localhost origins in production", () => {
  process.env.NODE_ENV = "production";
  try {
    assert.equal(isAccepted("http://localhost:5173"), false);
    assert.equal(isAccepted("https://souqak-yem.com"), true);
  } finally {
    process.env.NODE_ENV = "test";
  }
});

test("Socket.IO WebSocket handshakes enforce the Origin allowlist", async () => {
  const httpServer = http.createServer();
  const io = new SocketIOServer(httpServer, {
    cors: corsOptions,
    allowRequest: socketAllowRequest
  });
  httpServer.listen(0, "127.0.0.1");
  await once(httpServer, "listening");
  const { port } = httpServer.address();

  const handshake = (origin, cookie) => new Promise((resolve, reject) => {
    const request = http.request({
      host: "127.0.0.1",
      port,
      path: "/socket.io/?EIO=4&transport=websocket",
      headers: {
        ...(origin ? { Origin: origin } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        Connection: "Upgrade",
        Upgrade: "websocket",
        "Sec-WebSocket-Version": "13",
        "Sec-WebSocket-Key": randomBytes(16).toString("base64")
      }
    });
    request.on("upgrade", (_response, socket) => {
      socket.destroy();
      resolve(101);
    });
    request.on("response", (response) => {
      response.resume();
      resolve(response.statusCode);
    });
    request.on("error", reject);
    request.end();
  });

  try {
    assert.equal(
      await handshake("https://souqak-yem.com", "accessToken=signed-token"),
      101
    );
    assert.ok(
      (await handshake("https://attacker.example", "accessToken=signed-token")) >= 400,
      "An untrusted Origin must not be upgraded."
    );
    assert.ok(
      (await handshake(undefined, "accessToken=signed-token")) >= 400,
      "A handshake without Origin must not be upgraded."
    );
  } finally {
    await new Promise((resolve) => io.close(resolve));
  }
});
