// Thin wrapper around socket.io so services can emit without importing the server.
let io = null;

export const setIO = (instance) => {
  io = instance;
};

export function emit(event, payload) {
  if (io) io.emit(event, payload);
}
