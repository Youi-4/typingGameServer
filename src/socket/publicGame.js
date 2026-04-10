import { createRoomStore, generateRoomId } from "./roomStore.js";
import { createGameNamespace } from "./gameNamespace.js";

export function registerPublicGameNamespace({
  io,
  authMiddleware,
  roomStore,
  logger = console,
}) {
  let openRoomId = generateRoomId();

  function onJoinRoom(socket, _payload, { roomStore, namespace, leaveCurrentRoom }) {
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
  }

  return createGameNamespace({
    io,
    namespacePath: "/public_game",
    authMiddleware,
    roomStore,
    logger,
    onJoinRoom,
    extraReturn: { getOpenRoomId: () => openRoomId },
  });
}

export function createPublicGameNamespace(options) {
  return registerPublicGameNamespace({
    ...options,
    roomStore: options.roomStore ?? createRoomStore({ paragraphs: options.paragraphs, defaultRoomSize: 2 }),
  });
}
