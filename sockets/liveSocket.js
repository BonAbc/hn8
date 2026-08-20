export default function liveSocket(io) {
  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("join-room", (roomId) => {
      socket.join(roomId);

      console.log(socket.id, "joined", roomId);

      socket.to(roomId).emit("user-joined", socket.id);
    });

    socket.on("leave-room", (roomId) => {
      socket.leave(roomId);

      console.log(socket.id, "left", roomId);
    });
  });
}
