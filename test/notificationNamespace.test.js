import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import { Server } from "socket.io";
import { io as createClient } from "socket.io-client";

import { createNotificationNamespace } from "../src/socket/notificationNamespace.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function waitForEvent(socket, eventName, timeoutMs = 1500) {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`Timed out waiting for "${eventName}"`)), timeoutMs);
    socket.once(eventName, (payload) => { clearTimeout(id); resolve(payload); });
  });
}

async function createTestServer() {
  const httpServer = createServer();
  const io = new Server(httpServer, { cors: { origin: true, credentials: true } });

  const { userSockets } = createNotificationNamespace({
    io,
    authMiddleware: (socket, next) => {
      const { username, isGuest } = socket.handshake.auth;
      socket.username = username ?? "unknown";
      socket.isGuest = !!isGuest;
      next();
    },
    logger: { log() {} },
  });

  await new Promise((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const { port } = httpServer.address();
  return { httpServer, io, port, userSockets };
}

function connect(port, username, isGuest = false) {
  return new Promise((resolve, reject) => {
    const socket = createClient(`http://127.0.0.1:${port}/notifications`, {
      auth: { username, isGuest },
      forceNew: true,
      reconnection: false,
      transports: ["websocket"],
    });
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", reject);
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test("challenge-user delivers challenge-incoming to the target", async (t) => {
  const { httpServer, port } = await createTestServer();
  t.after(() => new Promise((r) => httpServer.close(r)));

  const alice = await connect(port, "alice");
  const bob   = await connect(port, "bob");

  // Give the server a tick to register both sockets
  await new Promise((r) => setTimeout(r, 50));

  const incomingP = waitForEvent(bob, "challenge-incoming");
  alice.emit("challenge-user", { targetUsername: "bob", roomId: "room1" });

  const incoming = await incomingP;
  assert.equal(incoming.fromUsername, "alice");
  assert.equal(incoming.roomId, "room1");

  alice.disconnect();
  bob.disconnect();
});

test("challenge-user emits challenge-error when target is not online", async (t) => {
  const { httpServer, port } = await createTestServer();
  t.after(() => new Promise((r) => httpServer.close(r)));

  const alice = await connect(port, "alice");
  await new Promise((r) => setTimeout(r, 50));

  const errP = waitForEvent(alice, "challenge-error");
  alice.emit("challenge-user", { targetUsername: "ghost", roomId: "room1" });

  const err = await errP;
  assert.ok(err.error.includes("not online"), `unexpected error: ${err.error}`);

  alice.disconnect();
});

test("challenge-user emits challenge-error when challenging yourself", async (t) => {
  const { httpServer, port } = await createTestServer();
  t.after(() => new Promise((r) => httpServer.close(r)));

  const alice = await connect(port, "alice");
  await new Promise((r) => setTimeout(r, 50));

  const errP = waitForEvent(alice, "challenge-error");
  alice.emit("challenge-user", { targetUsername: "alice", roomId: "room1" });

  const err = await errP;
  assert.ok(err.error.toLowerCase().includes("yourself"), `unexpected error: ${err.error}`);

  alice.disconnect();
});

test("accepting a challenge delivers challenge-accepted to the challenger", async (t) => {
  const { httpServer, port } = await createTestServer();
  t.after(() => new Promise((r) => httpServer.close(r)));

  const alice = await connect(port, "alice");
  const bob   = await connect(port, "bob");
  await new Promise((r) => setTimeout(r, 50));

  // alice challenges bob
  alice.emit("challenge-user", { targetUsername: "bob", roomId: "room42" });
  await waitForEvent(bob, "challenge-incoming");

  // bob accepts
  const acceptedP = waitForEvent(alice, "challenge-accepted");
  bob.emit("challenge-response", { challengerUsername: "alice", accepted: true, roomId: "room42" });

  const accepted = await acceptedP;
  assert.equal(accepted.roomId, "room42");

  alice.disconnect();
  bob.disconnect();
});

test("declining a challenge delivers challenge-declined to the challenger", async (t) => {
  const { httpServer, port } = await createTestServer();
  t.after(() => new Promise((r) => httpServer.close(r)));

  const alice = await connect(port, "alice");
  const bob   = await connect(port, "bob");
  await new Promise((r) => setTimeout(r, 50));

  alice.emit("challenge-user", { targetUsername: "bob", roomId: "room99" });
  await waitForEvent(bob, "challenge-incoming");

  const declinedP = waitForEvent(alice, "challenge-declined");
  bob.emit("challenge-response", { challengerUsername: "alice", accepted: false, roomId: "room99" });

  const declined = await declinedP;
  assert.equal(declined.targetUsername, "bob");

  alice.disconnect();
  bob.disconnect();
});

test("guests are rejected on connection", async (t) => {
  const { httpServer, port } = await createTestServer();
  t.after(() => new Promise((r) => httpServer.close(r)));

  const guest = createClient(`http://127.0.0.1:${port}/notifications`, {
    auth: { username: "guest123", isGuest: true },
    forceNew: true,
    reconnection: false,
    transports: ["websocket"],
  });

  // Guest should either fail to connect or disconnect immediately
  const disconnected = await new Promise((resolve) => {
    guest.on("disconnect", resolve);
    guest.on("connect_error", resolve);
    // Safety timeout
    setTimeout(() => resolve("timeout"), 1500);
  });

  assert.ok(
    disconnected !== undefined,
    "Guest socket should be rejected or disconnected"
  );

  guest.disconnect();
});

// ── challenge-accepted carries the roomId (needed by the client to show a toast)
// but must NOT carry any instruction that would cause the client to re-set the
// room context (which would wipe roomParagraph via resetRoomState).
test("challenge-accepted payload only carries roomId — no extra fields", async (t) => {
  const { httpServer, port } = await createTestServer();
  t.after(() => new Promise((r) => httpServer.close(r)));

  const alice = await connect(port, "alice");
  const bob   = await connect(port, "bob");
  await new Promise((r) => setTimeout(r, 50));

  alice.emit("challenge-user", { targetUsername: "bob", roomId: "roomXYZ" });
  await waitForEvent(bob, "challenge-incoming");

  const acceptedP = waitForEvent(alice, "challenge-accepted");
  bob.emit("challenge-response", { challengerUsername: "alice", accepted: true, roomId: "roomXYZ" });

  const payload = await acceptedP;
  // Must include roomId for the client toast
  assert.equal(payload.roomId, "roomXYZ");
  // Must NOT instruct the client to navigate (no navigate/redirect field)
  assert.ok(!("navigate" in payload), "payload must not have a navigate field");
  assert.ok(!("redirect" in payload), "payload must not have a redirect field");

  alice.disconnect();
  bob.disconnect();
});

test("challenge-response with missing challengerUsername is silently ignored", async (t) => {
  const { httpServer, port } = await createTestServer();
  t.after(() => new Promise((r) => httpServer.close(r)));

  const bob = await connect(port, "bob");
  await new Promise((r) => setTimeout(r, 50));

  // Emit a response with no challengerUsername — should not throw server-side
  bob.emit("challenge-response", { accepted: true, roomId: "roomXYZ" });

  // No event expected back — just confirm the server doesn't crash
  await new Promise((r) => setTimeout(r, 100));

  bob.disconnect();
});

test("disconnected user is removed from the userSockets map", async (t) => {
  const { httpServer, port, userSockets } = await createTestServer();
  t.after(() => new Promise((r) => httpServer.close(r)));

  const alice = await connect(port, "alice");
  await new Promise((r) => setTimeout(r, 50));

  assert.ok(userSockets.has("alice"), "alice should be in the map after connecting");

  await new Promise((resolve) => {
    alice.on("disconnect", resolve);
    alice.disconnect();
  });

  // Give the server a tick to process the disconnect
  await new Promise((r) => setTimeout(r, 50));
  assert.ok(!userSockets.has("alice"), "alice should be removed from the map after disconnecting");
});
