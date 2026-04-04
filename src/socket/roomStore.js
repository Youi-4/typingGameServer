function createCharacterPool() {
  return [0, 1, 2, 3, 4];
}

export function generateRoomId() {
  return Math.random().toString(36).slice(2, 8).toLowerCase();
}

function pickRandomParagraph(paragraphs) {
  const index = Math.floor(Math.random() * paragraphs.length);
  return paragraphs[index];
}

function createRoomRecord(paragraphs, size) {
  return {
    paragraph: pickRandomParagraph(paragraphs),
    lastState: new Map(),
    pendingBatch: new Map(),
    queue: new Set(),
    assignedCharacters: new Map(),
    characterPool: createCharacterPool(),
    size,
  };
}

function assignCharacter(room) {
  const index = Math.floor(Math.random() * room.characterPool.length);
  const [characterNumber] = room.characterPool.splice(index, 1);
  return characterNumber ?? 0;
}

export function createRoomStore({ paragraphs, defaultRoomSize = 1 }) {
  const rooms = new Map();

  function ensureRoom(roomId, requestedSize) {
    if (!rooms.has(roomId)) {
      rooms.set(roomId, createRoomRecord(paragraphs, requestedSize ?? defaultRoomSize));
    }

    const room = rooms.get(roomId);
    if (!room.size && requestedSize) {
      room.size = requestedSize;
    }

    return room;
  }

  function joinRoom({ roomId, socketId, requestedSize }) {
    const room = ensureRoom(roomId, requestedSize);
    room.queue.add(socketId);

    if (!room.assignedCharacters.has(socketId)) {
      room.assignedCharacters.set(socketId, assignCharacter(room));
    }

    return {
      roomId,
      room,
      characterNumber: room.assignedCharacters.get(socketId),
      isFilled: room.queue.size >= room.size,
    };
  }

  function leaveRoom({ roomId, socketId }) {
    const room = rooms.get(roomId);
    if (!room) {
      return { roomDeleted: false, room: null };
    }

    room.queue.delete(socketId);
    room.lastState.delete(socketId);
    room.pendingBatch.delete(socketId);

    const characterNumber = room.assignedCharacters.get(socketId);
    if (
      typeof characterNumber === "number" &&
      !room.characterPool.includes(characterNumber)
    ) {
      room.characterPool.push(characterNumber);
      room.characterPool.sort((a, b) => a - b);
    }
    room.assignedCharacters.delete(socketId);

    if (room.queue.size === 0) {
      rooms.delete(roomId);
      return { roomDeleted: true, room: null };
    }

    return { roomDeleted: false, room };
  }

  function getRoom(roomId) {
    return rooms.get(roomId) ?? null;
  }

  function getLastStates(roomId) {
    const room = rooms.get(roomId);
    return room ? Array.from(room.lastState.values()) : [];
  }

  function storeLastState(roomId, socketId, message) {
    const room = rooms.get(roomId);
    if (!room) return;
    room.lastState.set(socketId, message);
    room.pendingBatch.set(socketId, message);
  }

  function flushPendingBatches(onFlush) {
    for (const [roomId, room] of rooms) {
      if (room.pendingBatch.size === 0) continue;
      onFlush(roomId, Array.from(room.pendingBatch.values()));
      room.pendingBatch.clear();
    }
  }

  return {
    rooms,
    ensureRoom,
    joinRoom,
    leaveRoom,
    getRoom,
    getLastStates,
    storeLastState,
    flushPendingBatches,
  };
}
