
//import {WebSocket, Event, MessageEvent} from 'ws';
import {SignalingMessage, SignalingPing} from "../messages";

export class SignalingClient {
    private readonly socket: WebSocket;

    constructor(url: string) {
        this.socket = new WebSocket(url);

        this.socket.addEventListener('close', event => {
          console.log('closing', event.code, event.reason);
        });
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
