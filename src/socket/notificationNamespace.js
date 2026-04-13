/**
 * /notifications namespace
 *
 * Events (client → server):
 *   challenge-user  { targetUsername, roomId }   — send a challenge invite
 *   challenge-response { challengerUsername, accepted, roomId } — accept/decline
 *
 * Events (server → client):
 *   challenge-incoming  { fromUsername, roomId }  — received by target
 *   challenge-accepted  { roomId }                — received by challenger
 *   challenge-declined  { targetUsername }        — received by challenger
 *   challenge-error     { error }                 — sent back to initiator
 */
export function createNotificationNamespace({ io, authMiddleware, logger = console }) {
  const namespace = io.of("/notifications");
  namespace.use(authMiddleware);

  // username → socket.id map (one socket per logged-in user)
  const userSockets = new Map();

  namespace.on("connection", (socket) => {
    if (socket.isGuest || !socket.username) {
      socket.disconnect(true);
      return;
    }

    const username = socket.username;
    userSockets.set(username, socket.id);
    logger.log(`[notifications] ${username} connected (${socket.id})`);

    socket.on("challenge-user", ({ targetUsername, roomId } = {}) => {
      if (!targetUsername || !roomId) return;
      if (targetUsername === username) {
        socket.emit("challenge-error", { error: "You cannot challenge yourself." });
        return;
      }

      const targetSocketId = userSockets.get(targetUsername);
      if (!targetSocketId) {
        socket.emit("challenge-error", { error: `${targetUsername} is not online.` });
        return;
      }

      namespace.to(targetSocketId).emit("challenge-incoming", {
        fromUsername: username,
        roomId,
      });
    });

    socket.on("challenge-response", ({ challengerUsername, accepted, roomId } = {}) => {
      if (!challengerUsername || !roomId) return;

      const challengerSocketId = userSockets.get(challengerUsername);
      if (!challengerSocketId) {
        socket.emit("challenge-error", { error: `${challengerUsername} is no longer online.` });
        return;
      }

      if (accepted) {
        namespace.to(challengerSocketId).emit("challenge-accepted", { roomId });
      } else {
        namespace.to(challengerSocketId).emit("challenge-declined", {
          targetUsername: username,
        });
      }
    });

    socket.on("disconnect", () => {
      if (userSockets.get(username) === socket.id) {
        userSockets.delete(username);
      }
      logger.log(`[notifications] ${username} disconnected`);
    });
  });

  return { namespace, userSockets };
}
