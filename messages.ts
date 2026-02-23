import {InvalidMessageException, ParseError} from "./exceptions";
import {RTCIceCandidate} from "@roamhq/wrtc";
import {Buffer} from "buffer";

if (typeof window !== "undefined") {
  window.Buffer = Buffer;
}

export enum SignalingMessageType {
  Offer = 0,
  Answer = 1,
  IceCandidate = 2,
  ClientId = 3,
  PeerList = 4,
  CreateRoom = 5,
  JoinRoom = 6,
  LeaveRoom = 7,
  Error = 8,
  JoinOrCreate = 9
}

interface SignalingContent {
  type: SignalingMessageType
  targetId: string;
  senderId: string;
  offer?: RTCSessionDescriptionInit;
  offerTargetId?: string;
  answer?: RTCSessionDescriptionInit;
  iceCandidate?: RTCIceCandidate;
  clientId?: string;
  peerList?: string[];
  roomCode?: string;
  roomId?: string;
  errorMessage?: string;
}

export class SignalingMessage {
  type: SignalingMessageType;
  targetId: string;
  senderId: string;

  constructor(type: SignalingMessageType, targetId: string, senderId: string) {
    this.type = type;
    this.targetId = targetId;
    this.senderId = senderId;
  }

  static fromJson(json: string): SignalingMessage {
    const content = JSON.parse(json) as SignalingContent;

    if (content.type == null) throw new InvalidMessageException('Message type is required');

    switch (content.type) {
      case SignalingMessageType.Offer:
        return SignalingOffer.fromContent(content);
      case SignalingMessageType.Answer:
        return SignalingAnswer.fromContent(content);
      case SignalingMessageType.IceCandidate:
        return SignalingIceCandidate.fromContent(content);
      case SignalingMessageType.ClientId:
        return SignalingClientId.fromContent(content);
      case SignalingMessageType.PeerList:
        return SignalingPeerList.fromContent(content);
      case SignalingMessageType.CreateRoom:
        return SignalingCreateRoom.fromContent(content);
      case SignalingMessageType.JoinRoom:
        return SignalingJoinRoom.fromContent(content);
      case SignalingMessageType.LeaveRoom:
        return SignalingLeaveRoom.fromContent(content);
      case SignalingMessageType.JoinOrCreate:
        return SignalingJoinOrCreateRoom.fromContent(content);
      case SignalingMessageType.Error:
        return SignalingError.fromContent(content);
      default:
        throw new InvalidMessageException(`Invalid message type ${content.type}.`);
    }
  }

  static async fromBuffer(buffer: Buffer | ArrayBuffer | Blob) {
    if (buffer instanceof Blob) {
      buffer = await buffer.arrayBuffer();
    }

    return SignalingMessage.fromJson(new TextDecoder('utf-8').decode(buffer));
  }

  static async parseMessage(data: string | Buffer | ArrayBuffer | Buffer[]) {
    if (typeof data === 'string') {
      return [SignalingMessage.fromJson(data)];
    }

    if (!Array.isArray(data)) {
      return [await SignalingMessage.fromBuffer(data)];
    }

    const result = [];

    for (const buffer of data) {
      const message = await SignalingMessage.fromBuffer(buffer);

      result.push(message);
    }

    return result;
  }

  toJson() {
    return JSON.stringify(this.toContent());
  }

  toBuffer() {
    return Buffer.from(this.toJson(), 'utf-8');
  }

  protected toContent(): SignalingContent {
    return {
      type: this.type,
      targetId: this.targetId,
      senderId: this.senderId,
    };
  }
}

export class SignalingOffer extends SignalingMessage {
  offer: RTCSessionDescriptionInit;

  constructor(targetId: string, senderId: string, offer: RTCSessionDescriptionInit) {
    super(SignalingMessageType.Offer, targetId, senderId);

    this.offer = offer
  }

  static fromContent(content: SignalingContent): SignalingOffer {
    if (content.type != SignalingMessageType.Offer) {
      throw new ParseError(`Expected message type ${SignalingMessageType.Offer} - got ${content.type}.`);
    }

    if (content.offer == null) {
      throw new InvalidMessageException('Offer is required.');
    }

    return new SignalingOffer(content.targetId, content.senderId, content.offer);
  }

  protected override toContent(): SignalingContent {
    return {
      ...super.toContent(),
      offer: this.offer
    };
  }
}

export class SignalingAnswer extends SignalingMessage {
  answer: RTCSessionDescriptionInit;

  constructor(targetId: string, senderId: string, answer: RTCSessionDescriptionInit) {
    super(SignalingMessageType.Answer, targetId, senderId);

    this.answer = answer;
  }

  static fromContent(content: SignalingContent): SignalingAnswer {
    if (content.type != SignalingMessageType.Answer) {
      throw new ParseError(`Expected message type ${SignalingMessageType.Answer} - got ${content.type}.`);
    }

    if (content.answer == null) {
      throw new InvalidMessageException('Answer is required.');
    }

    return new SignalingAnswer(content.targetId, content.senderId, content.answer);
  }

  protected override toContent(): SignalingContent {
    return {
      ...super.toContent(),
      answer: this.answer
    };
  }
}

export class SignalingIceCandidate extends SignalingMessage {
  candidate: RTCIceCandidate;

  constructor(targetId: string, senderId: string, candidate: RTCIceCandidate) {
    super(SignalingMessageType.IceCandidate, targetId, senderId);

    this.candidate = candidate;
  }

  static fromContent(content: SignalingContent): SignalingIceCandidate {
    if (content.type != SignalingMessageType.IceCandidate) {
      throw new ParseError(`Expected message type ${SignalingMessageType.IceCandidate} - got ${content.type}.`);
    }

    if (content.iceCandidate == null) {
      throw new InvalidMessageException('Candidate is required.');
    }

    return new SignalingIceCandidate(content.targetId, content.senderId, content.iceCandidate);
  }

  protected override toContent(): SignalingContent {
    return {
      ...super.toContent(),
      iceCandidate: this.candidate
    };
  }
}


export class SignalingClientId extends SignalingMessage {
  id: string;

  constructor(targetId: string, senderId: string, id: string) {
    super(SignalingMessageType.ClientId, targetId, senderId);

    this.id = id;
  }

  static fromContent(content: SignalingContent): SignalingClientId {
    if (content.type != SignalingMessageType.ClientId) {
      throw new ParseError(`Expected message type ${SignalingMessageType.ClientId} - got ${content.type}.`);
    }

    if (content.clientId == null) {
      throw new InvalidMessageException('Id is required.');
    }

    return new SignalingClientId(content.targetId, content.senderId, content.clientId);
  }

  protected override toContent(): SignalingContent {
    return {
      ...super.toContent(),
      clientId: this.id
    };
  }
}

export class SignalingPeerList extends SignalingMessage {
  peerList: string[];
  roomCode: string;
  roomId: string;

  constructor(targetId: string, senderId: string, peerList: string[], roomCode: string, roomId: string) {
    super(SignalingMessageType.PeerList, targetId, senderId);

    this.peerList = peerList;
    this.roomCode = roomCode;
    this.roomId = roomId;
  }

  static fromContent(content: SignalingContent): SignalingPeerList {
    if (content.type != SignalingMessageType.PeerList) {
      throw new ParseError(`Expected message type ${SignalingMessageType.PeerList} - got ${content.type}.`);
    }

    if (content.peerList == null) {
      throw new InvalidMessageException('peerList is required.');
    }

    if (content.roomCode == null) {
      throw new InvalidMessageException('roomCode is required.');
    }

    if (content.roomId == null) {
      throw new InvalidMessageException('roomId is required.');
    }

    return new SignalingPeerList(content.targetId, content.senderId, content.peerList, content.roomCode, content.roomId);
  }

  protected override toContent(): SignalingContent {
    return {
      ...super.toContent(),
      peerList: this.peerList,
      roomCode: this.roomCode,
      roomId: this.roomId,
    };
  }
}

export class SignalingCreateRoom extends SignalingMessage {
  roomCode: string;

  constructor(senderId: string, roomCode: string) {
    super(SignalingMessageType.CreateRoom, '', senderId);

    this.roomCode = roomCode;
  }

  static fromContent(content: SignalingContent): SignalingCreateRoom {
    if (content.type != SignalingMessageType.CreateRoom) {
      throw new ParseError(`Expected message type ${SignalingMessageType.CreateRoom} - got ${content.type}.`);
    }

    if (content.roomCode == null) {
      throw new InvalidMessageException('roomCode is required.');
    }

    return new SignalingCreateRoom(content.senderId, content.roomCode);
  }

  protected override toContent(): SignalingContent {
    return {
      ...super.toContent(),
      roomCode: this.roomCode
    };
  }
}

export class SignalingJoinRoom extends SignalingMessage {
  roomCode: string;

  constructor(senderId: string, roomCode: string) {
    super(SignalingMessageType.JoinRoom, '', senderId);

    this.roomCode = roomCode;
  }

  static fromContent(content: SignalingContent): SignalingJoinRoom {
    if (content.type != SignalingMessageType.JoinRoom) {
      throw new ParseError(`Expected message type ${SignalingMessageType.JoinRoom} - got ${content.type}.`);
    }

    if (content.roomCode == null) {
      throw new InvalidMessageException('roomCode is required.');
    }

    return new SignalingJoinRoom(content.senderId, content.roomCode);
  }

  protected override toContent(): SignalingContent {
    return {
      ...super.toContent(),
      roomCode: this.roomCode
    };
  }
}

export class SignalingJoinOrCreateRoom extends SignalingMessage {
  roomId: string;

  constructor(senderId: string, roomId: string) {
    super(SignalingMessageType.JoinOrCreate, '', senderId);

    this.roomId = roomId;
  }

  static fromContent(content: SignalingContent): SignalingJoinOrCreateRoom {
    if (content.type != SignalingMessageType.JoinOrCreate) {
      throw new ParseError(`Expected message type ${SignalingMessageType.JoinOrCreate} - got ${content.type}.`);
    }

    if (content.roomId == null) {
      throw new InvalidMessageException('roomId is required.');
    }

    return new SignalingJoinOrCreateRoom(content.senderId, content.roomId);
  }

  protected override toContent(): SignalingContent {
    return {
      ...super.toContent(),
      roomId: this.roomId
    };
  }
}

export class SignalingLeaveRoom extends SignalingMessage {
  constructor(senderId: string) {
    super(SignalingMessageType.LeaveRoom, '', senderId);
  }

  static fromContent(content: SignalingContent): SignalingLeaveRoom {
    if (content.type != SignalingMessageType.LeaveRoom) {
      throw new ParseError(`Expected message type ${SignalingMessageType.LeaveRoom} - got ${content.type}.`);
    }

    return new SignalingLeaveRoom(content.senderId);
  }
}

export class SignalingError extends SignalingMessage {
  message: string;

  static roomNotFound(roomCode: string, targetId: string) {
    return new SignalingError(targetId, `Room ${roomCode} does not exist.`);
  }

  static roomAlreadyExists(roomCode: string, targetId: string) {
    return new SignalingError(targetId, `Room ${roomCode} already exists.`);
  }

  constructor(targetId: string, message: string) {
    super(SignalingMessageType.Error, targetId, '');

    this.message = message;
  }

  static fromContent(content: SignalingContent): SignalingError {
    if (content.type != SignalingMessageType.Error) {
      throw new ParseError(`Expected message type ${SignalingMessageType.Error} - got ${content.type}.`);
    }

    if (content.errorMessage == null) {
      throw new InvalidMessageException('errorMessage is required.');
    }

    return new SignalingError(content.targetId, content.errorMessage);
  }

  protected override toContent(): SignalingContent {
    return {
      ...super.toContent(),
      errorMessage: this.message
    };
  }
}
