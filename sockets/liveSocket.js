export default function liveSocket(io) {
  io.on("connection", (socket) => {
    console.log("Live socket connected:", socket.id);

    // ==========================================================
    // JOIN LIVE ROOM
    // ==========================================================

    socket.on("live:join", (roomId) => {
      const cleanRoomId = String(roomId || "").trim();

      if (!cleanRoomId) {
        console.warn("LIVE: Empty room ID from:", socket.id);
        return;
      }

      // Leave any previous live room first.
      const previousRoom = socket.data.liveRoomId;

      if (previousRoom && previousRoom !== cleanRoomId) {
        socket.to(previousRoom).emit("live:user-left", {
          socketId: socket.id,
        });

        socket.leave(previousRoom);

        emitViewerCount(previousRoom);
      }

      socket.join(cleanRoomId);

      socket.data.liveRoomId = cleanRoomId;

      console.log("LIVE:", socket.id, "joined room:", cleanRoomId);

      // Tell everyone already in the room that this socket joined.
      socket.to(cleanRoomId).emit("live:user-joined", {
        socketId: socket.id,
      });

      emitViewerCount(cleanRoomId);
    });

    // ==========================================================
    // LEAVE LIVE ROOM
    // ==========================================================

    socket.on("live:leave", (roomId) => {
      const cleanRoomId = String(roomId || "").trim();

      if (!cleanRoomId) {
        return;
      }

      if (socket.data.liveRoomId !== cleanRoomId) {
        return;
      }

      console.log("LIVE:", socket.id, "leaving room:", cleanRoomId);

      socket.to(cleanRoomId).emit("live:user-left", {
        socketId: socket.id,
      });

      socket.leave(cleanRoomId);

      socket.data.liveRoomId = null;

      emitViewerCount(cleanRoomId);
    });

    // ==========================================================
    // WEBRTC OFFER
    // ==========================================================

    socket.on("live:offer", ({ roomId, offer, targetSocketId } = {}) => {
      const cleanRoomId = String(roomId || "").trim();

      if (!cleanRoomId || !offer || !targetSocketId) {
        console.warn("LIVE: Invalid offer from:", socket.id);
        return;
      }

      // Sender must belong to the room.
      if (socket.data.liveRoomId !== cleanRoomId) {
        console.warn(
          "LIVE: Offer rejected. Sender not in room:",
          socket.id,
          cleanRoomId,
        );

        return;
      }

      const targetSocket = io.sockets.sockets.get(targetSocketId);

      if (!targetSocket) {
        console.warn("LIVE: Offer target not found:", targetSocketId);
        return;
      }

      // Target must belong to same room.
      if (targetSocket.data.liveRoomId !== cleanRoomId) {
        console.warn(
          "LIVE: Offer rejected. Target not in room:",
          targetSocketId,
          cleanRoomId,
        );

        return;
      }

      console.log("LIVE: OFFER", socket.id, "->", targetSocketId);

      targetSocket.emit("live:offer", {
        roomId: cleanRoomId,
        offer,
        senderSocketId: socket.id,
      });
    });

    // ==========================================================
    // WEBRTC ANSWER
    // ==========================================================

    socket.on("live:answer", ({ roomId, answer, targetSocketId } = {}) => {
      const cleanRoomId = String(roomId || "").trim();

      if (!cleanRoomId || !answer || !targetSocketId) {
        console.warn("LIVE: Invalid answer from:", socket.id);
        return;
      }

      // Sender must belong to room.
      if (socket.data.liveRoomId !== cleanRoomId) {
        console.warn(
          "LIVE: Answer rejected. Sender not in room:",
          socket.id,
          cleanRoomId,
        );

        return;
      }

      const targetSocket = io.sockets.sockets.get(targetSocketId);

      if (!targetSocket) {
        console.warn("LIVE: Answer target not found:", targetSocketId);
        return;
      }

      // Target must belong to same room.
      if (targetSocket.data.liveRoomId !== cleanRoomId) {
        console.warn(
          "LIVE: Answer rejected. Target not in room:",
          targetSocketId,
          cleanRoomId,
        );

        return;
      }

      console.log("LIVE: ANSWER", socket.id, "->", targetSocketId);

      targetSocket.emit("live:answer", {
        roomId: cleanRoomId,
        answer,
        senderSocketId: socket.id,
      });
    });

    // ==========================================================
    // WEBRTC ICE CANDIDATE
    // ==========================================================

    socket.on(
      "live:ice-candidate",
      ({ roomId, candidate, targetSocketId } = {}) => {
        const cleanRoomId = String(roomId || "").trim();

        if (!cleanRoomId || !candidate || !targetSocketId) {
          console.warn("LIVE: Invalid ICE candidate from:", socket.id);
          return;
        }

        // Sender must belong to room.
        if (socket.data.liveRoomId !== cleanRoomId) {
          console.warn(
            "LIVE: ICE rejected. Sender not in room:",
            socket.id,
            cleanRoomId,
          );

          return;
        }

        const targetSocket = io.sockets.sockets.get(targetSocketId);

        if (!targetSocket) {
          console.warn("LIVE: ICE target not found:", targetSocketId);
          return;
        }

        // Target must belong to same room.
        if (targetSocket.data.liveRoomId !== cleanRoomId) {
          console.warn(
            "LIVE: ICE rejected. Target not in room:",
            targetSocketId,
            cleanRoomId,
          );

          return;
        }

        targetSocket.emit("live:ice-candidate", {
          roomId: cleanRoomId,
          candidate,
          senderSocketId: socket.id,
        });
      },
    );

    // ==========================================================
    // REQUEST NEW OFFER
    // ==========================================================

    socket.on("live:request-offer", ({ roomId } = {}) => {
      const cleanRoomId = String(roomId || "").trim();

      if (!cleanRoomId) {
        return;
      }

      if (socket.data.liveRoomId !== cleanRoomId) {
        return;
      }

      console.log("LIVE: Offer requested by:", socket.id, "room:", cleanRoomId);

      // Ask the other sockets in the room to create an offer.
      socket.to(cleanRoomId).emit("live:request-offer", {
        socketId: socket.id,
        roomId: cleanRoomId,
      });
    });

    // ==========================================================
    // BROADCASTER RESUMED
    // ==========================================================

    socket.on("live:broadcaster-resumed", ({ roomId } = {}) => {
      const cleanRoomId = String(roomId || "").trim();

      if (!cleanRoomId) {
        return;
      }

      if (socket.data.liveRoomId !== cleanRoomId) {
        return;
      }

      console.log(
        "LIVE: Broadcaster resumed:",
        socket.id,
        "room:",
        cleanRoomId,
      );

      socket.to(cleanRoomId).emit("live:broadcaster-resumed", {
        roomId: cleanRoomId,
        socketId: socket.id,
      });
    });

    // ==========================================================
    // CHAT
    // ==========================================================

    socket.on("live:chat-message", ({ roomId, message } = {}, acknowledge) => {
      const cleanRoomId = String(roomId || "").trim();
      const cleanMessage = String(message || "").trim();

      // ------------------------------------------------------
      // VALIDATION
      // ------------------------------------------------------

      if (!cleanRoomId || !cleanMessage) {
        if (typeof acknowledge === "function") {
          acknowledge({
            success: false,
            message: "Message cannot be empty.",
          });
        }

        return;
      }

      if (cleanMessage.length > 500) {
        if (typeof acknowledge === "function") {
          acknowledge({
            success: false,
            message: "Chat message is too long.",
          });
        }

        return;
      }

      // ------------------------------------------------------
      // VERIFY SOCKET IS IN ROOM
      // ------------------------------------------------------

      if (socket.data.liveRoomId !== cleanRoomId) {
        console.warn(
          "LIVE: Chat rejected. Socket not in room:",
          socket.id,
          cleanRoomId,
        );

        if (typeof acknowledge === "function") {
          acknowledge({
            success: false,
            message: "You are not connected to this live broadcast.",
          });
        }

        return;
      }

      // ------------------------------------------------------
      // USERNAME
      // ------------------------------------------------------

      const username =
        socket.data.username ||
        socket.data.user?.username ||
        socket.data.user?.name ||
        "User";

      // ------------------------------------------------------
      // MESSAGE
      // ------------------------------------------------------

      const chatMessage = {
        roomId: cleanRoomId,
        message: cleanMessage,
        username,
        socketId: socket.id,
        createdAt: new Date().toISOString(),
      };

      console.log("LIVE: CHAT", chatMessage);

      // ------------------------------------------------------
      // SEND TO EVERYONE
      //
      // IMPORTANT:
      // io.to() includes the sender.
      // This allows the sender's chat panel to receive the
      // same event as every other viewer.
      // ------------------------------------------------------

      io.to(cleanRoomId).emit("live:chat-message", chatMessage);

      // ------------------------------------------------------
      // ACKNOWLEDGE SENDER
      // ------------------------------------------------------

      if (typeof acknowledge === "function") {
        acknowledge({
          success: true,
        });
      }
    });

    // ==========================================================
    // DISCONNECTING
    // ==========================================================

    socket.on("disconnecting", () => {
      console.log("Live socket disconnecting:", socket.id);

      const liveRoomId = socket.data.liveRoomId;

      if (liveRoomId) {
        socket.to(liveRoomId).emit("live:user-left", {
          socketId: socket.id,
        });

        // socket is still technically in the room
        // during disconnecting, so subtract this socket.
        const room = io.sockets.adapter.rooms.get(liveRoomId);

        const count = room ? Math.max(0, room.size - 1) : 0;

        io.to(liveRoomId).emit("live:viewer-count", {
          count,
        });
      }
    });

    // ==========================================================
    // DISCONNECT
    // ==========================================================

    socket.on("disconnect", (reason) => {
      console.log("Live socket disconnected:", socket.id, reason);
    });
  });

  // ==========================================================
  // VIEWER COUNT
  // ==========================================================

  function emitViewerCount(roomId) {
    const cleanRoomId = String(roomId || "").trim();

    if (!cleanRoomId) {
      return;
    }

    const room = io.sockets.adapter.rooms.get(cleanRoomId);

    const count = room ? room.size : 0;

    io.to(cleanRoomId).emit("live:viewer-count", {
      count,
    });
  }
}
