
//import {WebSocket, Event, MessageEvent} from 'ws';
import {SignalingMessage} from "../messages";

export class SignalingClient {
    private readonly socket: WebSocket;

    constructor(url: string) {
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
