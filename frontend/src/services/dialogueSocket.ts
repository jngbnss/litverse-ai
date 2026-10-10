import type { SocketEvent } from "../types/api";

/** 대화 WebSocket. 서버는 검증을 마친 답만 보낸다 (thinking → reply → done). */
export class DialogueSocket {
  private ws: WebSocket | null = null;
  private queue: string[] = [];

  constructor(
    private sessionId: string,
    private onEvent: (event: SocketEvent) => void,
  ) {}

  private url(): string {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${location.host}/api/sessions/${this.sessionId}/ws`;
  }

  private ensure(): WebSocket {
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) return this.ws;
    const ws = new WebSocket(this.url());
    ws.onopen = () => {
      for (const msg of this.queue.splice(0)) ws.send(msg);
    };
    ws.onmessage = (e) => this.onEvent(JSON.parse(e.data) as SocketEvent);
    ws.onerror = () => this.onEvent({ type: "error", detail: "연결 오류" });
    this.ws = ws;
    return ws;
  }

  ask(characterId: string, question: string): void {
    const msg = JSON.stringify({ character_id: characterId, question });
    const ws = this.ensure();
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
    else this.queue.push(msg);
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }
}
