
//import {WebSocket, Event, MessageEvent} from 'ws';
import {SignalingMessage} from "../messages";

const url = 'ws://localhost:3000';

export class SignalingClient {
    private readonly socket: WebSocket;

    constructor() {
        this.socket = new WebSocket(url);
    }

    onOpen(callback: (event: Event) => {}) {
        this.socket.addEventListener('open', callback);
    }

    onMessage(callback: (event: MessageEvent) => {}) {
        this.socket.addEventListener('message', callback);
    }

    send(message: SignalingMessage) {
        this.socket.send(message.toBuffer());
    }
}
