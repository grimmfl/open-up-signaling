import {RawData, WebSocket, WebSocketServer} from 'ws';
import {
  SignalingClientId,
  SignalingCreateRoom,
  SignalingError,
  SignalingJoinOrCreateRoom,
  SignalingJoinRoom,
  SignalingLeaveRoom,
  SignalingMessage,
  SignalingMessageType,
  SignalingPeerList
} from "../messages";
import {Buffer} from "buffer";

interface ClientInfo {
  socket: WebSocket;
  roomId: string | null;
}

enum CustomCloseCodes {
  UNKNOWN_ORIGIN = 4000,
  INVALID_MESSAGE = 4002,
  TOO_MANY_CONNECTIONS = 4029,
  RATE_LIMIT_EXCEEDED = 4030
}

const MaxMessageSize = 10000; // bytes
const MaxConnectionsPerIp = 10;
const MaxMessagesPerSeconds = 20;


const RoomCodeCharacters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const RoomCodeLength = 4;


const server = new WebSocketServer({port: 3000});

const connectionCounts = new Map<string, number>(); // ip to count

const clients = new Map<string, ClientInfo>(); // client id to info
const rooms = new Map<string, string[]>(); // room id to client ids
const roomCodeToId = new Map<string, string>();
const roomIdToCode = new Map<string, string>();

// TODO remove a client from all rooms on n times not found

function broadcast(message: SignalingMessage, roomId: string) {
  const peers = rooms.get(roomId);

  if (peers == null) {
    console.error(`Room ${roomId} not found.`);
    return;
  }

  for (const peer of peers) {
    const client = clients.get(peer);

    if (client == null) {
      console.warn(`Client ${peer} not found.`);
      continue;
    }

    client.socket.send(message.toBuffer());
  }
}

function broadcastPeerList(roomId: string) {
  const peers = rooms.get(roomId);
  const code = roomIdToCode.get(roomId);

  if (peers == null || code == null) {
    console.error(`Room ${roomId} not found.`);
    return;
  }

  const message = new SignalingPeerList('', '', peers, code, roomId);

  broadcast(message, roomId);
}

function forwardMessage(message: SignalingMessage) {
  const client = clients.get(message.targetId);

  if (client == null) {
    console.error(`Target ${message.targetId} not found.`);
    return;
  }

  client.socket.send(message.toBuffer());
}

function createRoom(message: SignalingCreateRoom, socket: WebSocket, client: ClientInfo) {
  if (roomCodeToId.has(message.roomCode)) {
    socket.send(
      SignalingError.roomAlreadyExists(message.roomCode, message.senderId).toBuffer()
    );

    return;
  }

  console.log(`Room ${message.roomCode} created.`);

  const id = crypto.randomUUID().toString();

  addRoom(id, message.roomCode, [message.senderId]);

  client.roomId = id;

  broadcastPeerList(id);
}

function addRoom(id: string, code: string, peers: string[]) {
  rooms.set(id, peers);
  roomCodeToId.set(code, id);
  roomIdToCode.set(id, code);
}

function joinRoomById(roomId: string, clientId: string, client: ClientInfo) {
  const peers = rooms.get(roomId)!;
  peers.push(clientId);
  client.roomId = roomId;

  broadcastPeerList(roomId);
}

function joinRoom(message: SignalingJoinRoom, socket: WebSocket, client: ClientInfo) {
  const id = roomCodeToId.get(message.roomCode);

  if (id == null) {
    socket.send(
      SignalingError.roomNotFound(message.roomCode, message.senderId).toBuffer()
    );

    return;
  }

  joinRoomById(id, message.senderId, client);
}

function generateRoomCode() {
  let code = '';

  for (let i = 0; i < RoomCodeLength; i++) {
    code += RoomCodeCharacters.charAt(Math.floor(Math.random() * RoomCodeCharacters.length));
  }

  return code
}

function joinOrCreateRoom(message: SignalingJoinOrCreateRoom, client: ClientInfo) {
  if (!rooms.has(message.roomId)) {
    const code = generateRoomCode();

    addRoom(message.roomId, code, []);
  }

  joinRoomById(message.roomId, message.senderId, client);
}

function leaveRoom(message: SignalingLeaveRoom, client: ClientInfo) {
  const roomCode = client.roomId;

  if (roomCode == null) return;

  const room = rooms.get(roomCode);

  if (room == null) return;

  room.splice(room.indexOf(message.senderId), 1);

  if (room.length === 0) {
    rooms.delete(roomCode);
  } else {
    broadcastPeerList(roomCode);
  }
}

function handleMessage(message: SignalingMessage, socket: WebSocket) {
  const sender  = clients.get(message.senderId);

  if (sender == null) return;

  switch (message.type) {
    case SignalingMessageType.CreateRoom:
      createRoom(message as SignalingCreateRoom, socket, sender);
      break;

    case SignalingMessageType.JoinRoom:
      joinRoom(message as SignalingJoinRoom, socket, sender);
      break;

    case SignalingMessageType.JoinOrCreate:
      joinOrCreateRoom(message as SignalingJoinOrCreateRoom, sender);
      break;

    case SignalingMessageType.LeaveRoom:
      leaveRoom(message as SignalingLeaveRoom, sender);
      break;

    case SignalingMessageType.Offer:
    case SignalingMessageType.Answer:
    case SignalingMessageType.IceCandidate:
      forwardMessage(message);
      break;

    default:
      socket.close(CustomCloseCodes.INVALID_MESSAGE, 'Invalid message type')
      return;
  }
}

function removeClient(clientId: string, ip: string | undefined) {
  if (ip == null) return;

  const count = (connectionCounts.get(ip) ?? 0) - 1;
  if (count <= 0) connectionCounts.delete(ip);
  else connectionCounts.set(ip, count);

  clients.delete(clientId);

  // TODO maybe make a map client -> room for more efficient access
  const toDelete: string[] = [];

  rooms.forEach((room, id) => {
    const index = room.indexOf(clientId);

    if (index !== -1) room.splice(index, 1);

    if (room.length === 0) toDelete.push(id);
  })

  for (const room of toDelete) {
    console.log(`Room ${room} closed.`);

    rooms.delete(room);
  }

  console.log(`Client ${clientId} disconnected.`);
}

function checkMessageSize(buffer: RawData, socket: WebSocket) {
  const size = Array.isArray(buffer)
      ? buffer.reduce((sum, b) => sum + Buffer.byteLength(b), 0)
      : Buffer.byteLength(buffer);

  if (size > MaxMessageSize) {
    socket.close(1009, 'Message too large');
    return false;
  }

  return true;
}

function checkConnectionCount(socket: WebSocket, ip: string | undefined) {
  if (ip == null) {
    socket.close(CustomCloseCodes.UNKNOWN_ORIGIN, 'Unable to determine client address.');
    return false;
  }

  const count = connectionCounts.get(ip) ?? 0;

  if (count > MaxConnectionsPerIp) {
    socket.close(CustomCloseCodes.TOO_MANY_CONNECTIONS, 'Too many connections.');
    return false;
  }

  connectionCounts.set(ip, count + 1);

  return true;
}

server.on('connection', (socket, request) => {
  if (!checkConnectionCount(socket, request.socket.remoteAddress)) return;

  const clientId = crypto.randomUUID().toString();

  clients.set(clientId, {
    socket,
    roomId: null
  });

  console.log(`Client ${clientId} connected.`);

  socket.send(new SignalingClientId(clientId, '', clientId).toBuffer());

  let messageCount = 0;
  let resetAt = Date.now() + 1000;

  socket.on('message', async buffer => {
    const now = Date.now();

    if (now > resetAt) {
      messageCount = 0;
      resetAt = now;
    }

    if (messageCount > MaxMessagesPerSeconds) {
      socket.close(CustomCloseCodes.RATE_LIMIT_EXCEEDED, 'Rate limit exceeded.');
      return;
    }

    messageCount++;

    if (!checkMessageSize(buffer, socket)) return;

    let messages: SignalingMessage[];

    try {
      messages = await SignalingMessage.parseMessage(buffer);
    } catch (error) {
      console.error(error);
      socket.close(CustomCloseCodes.INVALID_MESSAGE, 'Invalid message');
      return;
    }

    for (const message of messages) {
      handleMessage(message, socket);
    }
  });

  socket.on('close', () => {
    removeClient(clientId, request.socket.remoteAddress);
  })
});
