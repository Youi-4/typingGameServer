import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import { Server } from "socket.io";
import { io as createClient } from "socket.io-client";

import { createPrivateGameNamespace } from "../src/socket/privateGame.js";
import { createRoomStore } from "../src/socket/roomStore.js";

function waitForEvent(socket, eventName, timeoutMs = 1000) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${eventName}`));
    }, timeoutMs);

    socket.once(eventName, (payload) => {
      clearTimeout(timeoutId);
      resolve(payload);
    });
  });
}

async function createRealtimeTestServer() {
  const httpServer = createServer();
  const io = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
  });

  createPrivateGameNamespace({
    io,
    authMiddleware: (socket, next) => {
      socket.username = socket.handshake.auth.username ?? "Unknown";
      next();
    },
    paragraphs: ["The quick brown fox jumps over the lazy dog."],
    logger: { log() {} },
  });

  await new Promise((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const address = httpServer.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to determine test server address");
  }

  return {
    httpServer,
    io,
    port: address.port,
  };
}

async function connectPrivateClient(port, username) {
  const socket = createClient(`http://127.0.0.1:${port}/private_game`, {
    auth: { username },
    forceNew: true,
    reconnection: false,
    transports: ["websocket"],
  });

  await waitForEvent(socket, "connect");
  return socket;
}

test("private namespace marks a room as filled and broadcasts when a player leaves", async (t) => {
  const { httpServer, io, port } = await createRealtimeTestServer();
  const sockets = [];

  t.after(async () => {
    for (const socket of sockets) {
      socket.close();
    }
    io.close();
    await new Promise((resolve) => httpServer.close(resolve));
  });

  const alice = await connectPrivateClient(port, "Alice");
  const bob = await connectPrivateClient(port, "Bob");
  sockets.push(alice, bob);

  alice.emit("join-room", { roomId: "alpha42", roomSize: 2 });
  const aliceRoomState = await waitForEvent(alice, "room-state");
  assert.equal(aliceRoomState.roomId, "alpha42");

  const aliceFilled = waitForEvent(alice, "room-status");
  const bobFilled = waitForEvent(bob, "room-status");

  bob.emit("join-room", { roomId: "alpha42" });
  const bobRoomState = await waitForEvent(bob, "room-state");
  assert.equal(bobRoomState.roomId, "alpha42");

  assert.deepEqual(await aliceFilled, { status: "filled" });
  assert.deepEqual(await bobFilled, { status: "filled" });

  const userLeft = waitForEvent(bob, "user-left");
  alice.emit("leave-room", { roomId: "alpha42" });
  assert.deepEqual(await userLeft, { senderId: alice.id });
});

// ── Player-join broadcast ────────────────────────────────────────────────────
// When a second player joins a room the first player should immediately receive
// a "receive-message" with the new player's initial idle state. This makes the
// new player visible in the race track before the countdown even starts.

test("second player joining broadcasts their initial state to the first player", async (t) => {
  const { httpServer, io, port } = await createRealtimeTestServer();
  const sockets = [];

  t.after(async () => {
    for (const s of sockets) s.close();
    io.close();
    await new Promise((r) => httpServer.close(r));
  });

  const alice = await connectPrivateClient(port, "Alice");
  const bob   = await connectPrivateClient(port, "Bob");
  sockets.push(alice, bob);

  // Alice joins first and waits for room-state
  alice.emit("join-room", { roomId: "joinbroadcast1", roomSize: 2 });
  await waitForEvent(alice, "room-state");

  // Set up a listener for the initial presence message BEFORE Bob joins
  const presenceP = waitForEvent(alice, "receive-message");

  // Bob joins
  bob.emit("join-room", { roomId: "joinbroadcast1" });
  await waitForEvent(bob, "room-state");

  const presence = await presenceP;

  // Must be Bob's socket (senderId exists and is a non-empty string)
  assert.ok(typeof presence.senderId === "string" && presence.senderId.length > 0,
    "presence senderId should be Bob's socket id");
  assert.equal(presence.senderName, "Bob");
  assert.equal(presence.typeObject.isCompleted, false);
  assert.equal(presence.typeObject.isActivelyTyping, false);
  assert.equal(presence.typeObject.charIndex, 0);
  assert.equal(presence.typeObject.WPM, 0);

  alice.disconnect();
  bob.disconnect();
});

test("first player joining does not receive a spurious presence message for themselves", async (t) => {
  const { httpServer, io, port } = await createRealtimeTestServer();
  const sockets = [];

  t.after(async () => {
    for (const s of sockets) s.close();
    io.close();
    await new Promise((r) => httpServer.close(r));
  });

  const alice = await connectPrivateClient(port, "Alice");
  sockets.push(alice);

  let unexpectedMessage = false;
  alice.on("receive-message", () => { unexpectedMessage = true; });

  alice.emit("join-room", { roomId: "joinbroadcast2", roomSize: 2 });
  await waitForEvent(alice, "room-state");

  // Wait a bit — no receive-message should arrive for the solo joiner
  await new Promise((r) => setTimeout(r, 150));

  assert.ok(!unexpectedMessage, "solo joiner must not receive a spurious presence message");

  alice.disconnect();
});

test("roomStore removes a departed player's last state while keeping the room alive", () => {
  const roomStore = createRoomStore({
    paragraphs: ["The quick brown fox jumps over the lazy dog."],
    defaultRoomSize: 2,
  });
  const roomId = "alpha42";
  const aliceState = {
    senderId: "alice",
    senderName: "Alice",
    characterNumber: 1,
    message: "",
    typeObject: {
      totalMistakes: 0,
      WPM: 75,
      charIndex: 10,
      charIndexBeforeMistake: 0,
      mistakes: 0,
      isActivelyTyping: true,
      isCompleted: false,
    },
  };
  const bobState = {
    senderId: "bob",
    senderName: "Bob",
    characterNumber: 2,
    message: "",
    typeObject: {
      totalMistakes: 1,
      WPM: 62,
      charIndex: 8,
      charIndexBeforeMistake: 7,
      mistakes: 1,
      isActivelyTyping: false,
      isCompleted: false,
    },
  };

  roomStore.joinRoom({ roomId, socketId: "alice", requestedSize: 2 });
  roomStore.joinRoom({ roomId, socketId: "bob", requestedSize: null });
  roomStore.storeLastState(roomId, "alice", aliceState);
  roomStore.storeLastState(roomId, "bob", bobState);

  roomStore.leaveRoom({ roomId, socketId: "alice" });

  assert.deepEqual(roomStore.getLastStates(roomId), [bobState]);
  assert.equal(roomStore.getRoom(roomId)?.queue.has("bob"), true);
});
