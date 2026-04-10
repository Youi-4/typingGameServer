import { createRoomStore } from "./roomStore.js";
import { createGameNamespace } from "./gameNamespace.js";

export function registerPrivateGameNamespace({
  io,
  authMiddleware,
  roomStore,
  logger = console,
}) {
  function onJoinRoom(socket, { roomId, roomSize } = {}, { roomStore, namespace, leaveCurrentRoom }) {
    if (!roomId) return;

    if (socket.currentRoomId && socket.currentRoomId !== roomId) {
      leaveCurrentRoom(socket, socket.currentRoomId);
    }

    const requestedSize = Number.isInteger(roomSize) && roomSize > 0 ? roomSize : null;
    const { room, characterNumber, isFilled } = roomStore.joinRoom({
      roomId,
      socketId: socket.id,
      requestedSize,
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
    }
  }

  return createGameNamespace({
    io,
    namespacePath: "/private_game",
    authMiddleware,
    roomStore,
    logger,
    onJoinRoom,
  });
}

export function createPrivateGameNamespace(options) {
  return registerPrivateGameNamespace({
    ...options,
    roomStore: options.roomStore ?? createRoomStore({ paragraphs: options.paragraphs }),
  });
}
