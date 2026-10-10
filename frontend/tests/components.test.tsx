import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Badge } from "../src/components/Badge";
import { CitationList } from "../src/components/CitationList";
import { TurnView } from "../src/features/dialogue/DialogueScreen";
import { curveOffsets, layout } from "../src/features/relationships/GraphScreen";
import { reply } from "./fixtures";

describe("Badge", () => {
  it("labels claim types in Korean", () => {
    render(
      <>
        <Badge type="CANON" />
        <Badge type="INTERPRETATION" />
        <Badge type="WHAT_IF" />
      </>,
    );
    expect(screen.getByTestId("badge-CANON")).toHaveTextContent("원작");
    expect(screen.getByTestId("badge-INTERPRETATION")).toHaveTextContent("해석");
    expect(screen.getByTestId("badge-WHAT_IF")).toHaveTextContent("AI WHAT-IF");
  });
});

describe("CitationList", () => {
  it("shows chapter, id and excerpt and removes duplicates", () => {
    const c = reply.citations[0];
    render(<CitationList items={[c, c]} />);
    expect(screen.getAllByText(/gatsby-ch03-p030/)).toHaveLength(1);
    expect(screen.getByText(/killed a man once/)).toBeInTheDocument();
  });
});

describe("TurnView", () => {
  it("shows claims with badges and toggles citations", async () => {
    render(<TurnView turn={{ id: 1, characterId: "nick", question: "소문?", mode: "canon", reply }} name="닉" />);
    expect(screen.getByText(reply.reply)).toBeInTheDocument();
    expect(screen.getAllByTestId("badge-CANON").length).toBeGreaterThan(0);
    expect(screen.queryByText(/killed a man once/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /원문 근거 보기 \(2\)/ }));
    expect(screen.getByText(/killed a man once/)).toBeInTheDocument();
  });

  it("shows thinking state before verified reply arrives", () => {
    render(<TurnView turn={{ id: 2, characterId: "nick", question: "?", mode: "canon" }} name="닉" />);
    expect(screen.getByText(/근거 확인 중/)).toBeInTheDocument();
  });

  it("explains fallback replies", () => {
    const fb = { ...reply, claims: [], citations: [], fallback: true, attempts: 2 };
    render(<TurnView turn={{ id: 3, characterId: "nick", question: "?", mode: "canon", reply: fb }} name="닉" />);
    expect(screen.getByText(/안전한 답변으로 바꿨습니다/)).toBeInTheDocument();
  });
});

describe("graph layout", () => {
  it("places nodes deterministically on a circle", () => {
    const a = layout(["nick", "gatsby", "jordan"]);
    expect(layout(["nick", "gatsby", "jordan"])).toEqual(a);
    expect(new Set(Object.values(a).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)).size).toBe(3);
  });

  it("spreads parallel edges", () => {
    const base = { label_ko: "", kind: "canon" as const, evidence: [] };
    const off = curveOffsets([
      { ...base, id: "a", source: "nick", target: "gatsby" },
      { ...base, id: "b", source: "gatsby", target: "nick" },
      { ...base, id: "c", source: "nick", target: "jordan" },
    ]);
    expect(off.a).not.toEqual(off.b);
    expect(off.c).toBe(0);
  });
});
