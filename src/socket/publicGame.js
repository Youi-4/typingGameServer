import { createRoomStore, generateRoomId } from "./roomStore.js";

export function registerPublicGameNamespace({
  io,
  authMiddleware,
  roomStore,
  logger = console,
}) {
  const namespace = io.of("/public_game");
  let openRoomId = generateRoomId();

  namespace.use(authMiddleware);

  function leaveCurrentRoom(socket, roomId) {
    socket.leave(roomId);
    const { roomDeleted } = roomStore.leaveRoom({ roomId, socketId: socket.id });

    if (roomDeleted) {
      logger.log(`Deleted data for room ${roomId}`);
      return;
    }

    namespace.to(roomId).emit("user-left", { senderId: socket.id });
  }

  namespace.on("connection", (socket) => {
    socket.on("join-room", () => {
      if (socket.currentRoomId && socket.currentRoomId !== openRoomId) {
        leaveCurrentRoom(socket, socket.currentRoomId);
      }

      const { roomId, room, characterNumber, isFilled } = roomStore.joinRoom({
        roomId: openRoomId,
        socketId: socket.id,
        requestedSize: 2,
      });

      socket.join(roomId);
      socket.currentRoomId = roomId;
      socket.characterNumber = characterNumber;

      socket.emit("room-state", {
        roomId,
        paragraph: room.paragraph,
        characterNumber,
      });

      for (const state of roomStore.getLastStates(roomId)) {
        socket.emit("receive-message", state);
      }

      if (isFilled) {
        namespace.to(roomId).emit("room-status", { status: "filled" });
        openRoomId = generateRoomId();
      }
    });

    socket.on("leave-room", ({ roomId } = {}) => {
      const activeRoomId = roomId || socket.currentRoomId;
      if (!activeRoomId) return;

      leaveCurrentRoom(socket, activeRoomId);

      if (socket.currentRoomId === activeRoomId) {
        socket.currentRoomId = null;
      }
    });

    socket.on("disconnecting", () => {
      for (const roomId of socket.rooms) {
        if (roomId === socket.id) continue;
        leaveCurrentRoom(socket, roomId);
      }
    });

    socket.on("send-message", ({ message, typeObject }) => {
      const roomId = socket.currentRoomId;
      if (!roomId) return;

      roomStore.storeLastState(roomId, socket.id, {
        senderId: socket.id,
        senderName: socket.username || "Unknown",
        characterNumber: socket.characterNumber,
        message,
        typeObject,
      });
    });
  });

  return {
    namespace,
    roomStore,
    getOpenRoomId: () => openRoomId,
    flushPendingBatches() {
      roomStore.flushPendingBatches((roomId, batch) => {
        namespace.to(roomId).emit("batch-update", batch);
      });
    },
  };
}

export function createPublicGameNamespace(options) {
  return registerPublicGameNamespace({
    ...options,
    roomStore: options.roomStore ?? createRoomStore({ paragraphs: options.paragraphs, defaultRoomSize: 2 }),
  });
}
