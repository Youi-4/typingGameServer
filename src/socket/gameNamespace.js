/**
 * Shared factory for game namespaces (public & private).
 *
 * Both namespaces have identical leave-room, disconnecting, and send-message
 * logic. Only the join-room flow differs, so it is injected via `onJoinRoom`.
 *
 * @param {object} options
 * @param {import("socket.io").Server} options.io
 * @param {string}   options.namespacePath   - e.g. "/public_game"
 * @param {Function} options.authMiddleware
 * @param {object}   options.roomStore
 * @param {Function} options.onJoinRoom      - (socket, payload, ctx) => void
 * @param {object}   [options.logger]
 * @param {object}   [options.extraReturn]   - extra fields merged into the return value
 */
export function createGameNamespace({
  io,
  namespacePath,
  authMiddleware,
  roomStore,
  onJoinRoom,
  logger = console,
  extraReturn = {},
}) {
  const namespace = io.of(namespacePath);
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
    socket.on("join-room", (payload) => {
      onJoinRoom(socket, payload, { roomStore, namespace, leaveCurrentRoom });
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
    flushPendingBatches() {
      roomStore.flushPendingBatches((roomId, batch) => {
        namespace.to(roomId).emit("batch-update", batch);
      });
    },
    ...extraReturn,
  };
}
