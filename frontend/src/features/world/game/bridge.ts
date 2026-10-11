/**
 * 게임(Three.js)과 React 화면 사이의 이벤트 통로.
 * 게임은 "무엇 앞에 서 있는지"와 "무엇과 상호작용했는지"만 알리고,
 * 서버 호출과 대화 표시는 React 쪽이 맡는다 (진실의 원천은 서버).
 */

export interface Target {
  /** vehicle은 게임 안에서만 처리한다 (타기·내리기) */
  kind: "character" | "object" | "vehicle";
  id: string;
  label: string;
}

type GameEvents = {
  /** 플레이어가 가까이 선 대상. 멀어지면 null */
  focus: Target | null;
  /** E로 상호작용 (인물·오브젝트만) */
  interact: Target;
  /** 들어선 지역 이름 */
  area: string;
};

type UiEvents = {
  /** 대화창이 열려 있으면 이동을 멈춘다 */
  paused: boolean;
  /** 조사한 오브젝트 표시 */
  found: string[];
};

type Handler<T> = (payload: T) => void;

class Channel<E extends Record<string, unknown>> {
  private handlers: { [K in keyof E]?: Set<Handler<E[K]>> } = {};

  on<K extends keyof E>(event: K, handler: Handler<E[K]>): () => void {
    const set = (this.handlers[event] ??= new Set());
    set.add(handler);
    return () => set.delete(handler);
  }

  emit<K extends keyof E>(event: K, payload: E[K]): void {
    this.handlers[event]?.forEach((h) => h(payload));
  }
}

export class GameBridge {
  readonly game = new Channel<GameEvents>();
  readonly ui = new Channel<UiEvents>();
}
