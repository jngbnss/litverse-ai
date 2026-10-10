import type { Claim, Mode } from "../../types/api";

/** branch_events.payload.reply 의 형태 (백엔드 CharacterReply) */
export interface CharacterReplyPayload {
  reply: string;
  claims: Claim[];
  mode: Mode;
  emotion: string;
}
