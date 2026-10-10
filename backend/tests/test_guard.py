from app.ai.schemas import CharacterReply, Claim
from app.canon.guard import check_reply, safe_reply

P = "gatsby-ch03-p{:03d}".format


def reply(text: str, *claims: Claim, mode: str = "canon") -> CharacterReply:
    return CharacterReply(reply=text, claims=list(claims), mode=mode)


def test_grounded_canon_reply_passes(work, view):
    r = reply(
        "노란 드레스의 아가씨가 그가 사람을 죽였다고 하더군요.",
        Claim(
            text="손님 하나가 개츠비가 사람을 죽였다고 말했다.", type="CANON", passage_ids=[P(30)]
        ),
        Claim(
            text="소문은 손님들의 상상을 보여 주는 것일 수 있습니다.",
            type="INTERPRETATION",
            passage_ids=[P(36)],
            perspective="nick",
        ),
    )
    report = check_reply(work, view("nick"), r, "canon")
    assert report.is_consistent, report


def test_canon_claim_without_evidence(work, view):
    r = reply("그는 부자다.", Claim(text="그는 부자다.", type="CANON"))
    report = check_reply(work, view("nick"), r, "canon")
    assert report.unsupported_claims
    assert not report.is_consistent


def test_gatsby_cites_rumor_he_never_heard(work, view):
    r = reply("다들 내가 사람을 죽였다더군.", Claim(text="소문", type="CANON", passage_ids=[P(30)]))
    report = check_reply(work, view("gatsby"), r, "canon")
    assert [i.code for i in report.knowledge_violations] == ["unseen_passage"]


def test_nick_leaks_chapter4_secret(work, view):
    r = reply("개츠비는 루이빌에서 데이지를 만났대요.")
    report = check_reply(work, view("nick"), r, "canon")
    assert any(i.code == "unknown_fact" for i in report.knowledge_violations)


def test_jordan_keeps_her_promise(work, view):
    leaked = reply("사실 그는 데이지가 만 건너편에 있으라고 그 저택을 샀어.")
    report = check_reply(work, view("jordan"), leaked, "canon")
    assert report.hidden_disclosures
    assert not report.knowledge_violations

    kept = reply(
        "놀라운 이야기를 들었지만, 말하지 않기로 약속했어.",
        Claim(text="조던은 비밀을 지키기로 맹세했다.", type="CANON", passage_ids=[P(115)]),
    )
    assert check_reply(work, view("jordan"), kept, "canon").is_consistent


def test_gatsby_cites_hidden_passage(work, view):
    r = reply("...", Claim(text="1917년", type="CANON", passage_ids=["gatsby-ch04-p138"]))
    report = check_reply(work, view("gatsby"), r, "canon")
    assert [i.code for i in report.hidden_disclosures][0] == "hidden_passage"


def test_future_spoiler(work, view):
    r = reply("안타깝게도 나중에 개츠비가 죽어요.")
    report = check_reply(work, view("nick"), r, "canon")
    assert any(i.code == "future_spoiler" for i in report.knowledge_violations)


def test_rumor_about_killing_is_not_a_death_spoiler(work, view):
    r = reply("개츠비가 죽였다는 소문이 돌더군요.")
    report = check_reply(work, view("nick"), r, "canon")
    assert not report.knowledge_violations


def test_what_if_claim_in_canon_mode(work, view):
    r = reply("만약 그랬다면...", Claim(text="닉이 소문을 물었다.", type="WHAT_IF"))
    report = check_reply(work, view("nick"), r, "canon")
    assert report.mode_violation
    ok = reply(
        "만약 그랬다면...", Claim(text="닉이 소문을 물었다.", type="WHAT_IF"), mode="what_if"
    )
    assert check_reply(work, view("nick"), ok, "what_if").is_consistent


def test_interpretation_stated_as_fact(work, view):
    r = reply(
        "...",
        Claim(text="개츠비의 미소는 연기다.", type="INTERPRETATION", passage_ids=[P(76)]),
    )
    report = check_reply(work, view("nick"), r, "canon")
    assert report.interpretation_as_fact


def test_passage_from_other_work(work, view):
    r = reply("...", Claim(text="x", type="CANON", passage_ids=["hamlet-ch01-p001"]))
    report = check_reply(work, view("nick"), r, "canon")
    assert [i.code for i in report.canon_conflicts] == ["other_work"]


def test_safe_reply_is_clean(work, view):
    for c in ("nick", "gatsby", "jordan"):
        assert check_reply(work, view(c), safe_reply(c, "canon"), "canon").is_consistent
