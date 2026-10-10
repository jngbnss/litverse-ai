from app.canon.knowledge import future_spoilers, hidden_facts, unknown_facts, visible_facts
from app.canon.store import Work

P = "gatsby-ch03-p{:03d}".format
P4 = "gatsby-ch04-p{:03d}".format


def ids(facts) -> set[str]:
    return {f.fact_id for f in facts}


def test_nick_does_not_know_chapter4_secrets(view):
    nick = view("nick")
    for pid in (P4(138), P4(157), P4(159)):
        assert not nick.can_see(pid)


def test_nick_retrospective_narration_is_excluded(view):
    # 한여름 회고(조던의 부정직)는 파티 밤의 닉이 아직 모른다.
    assert not view("nick").can_see(P(160))
    # 한여름이 되어도 회고 서술은 장면 속 인물에게 열리지 않는다.
    assert not view("nick", "t03-midsummer").can_see(P(160))


def test_nick_knows_gatsby_only_after_reveal(view):
    assert not view("nick", "t03-party-supper").can_see(P(73))
    assert view("nick", "t03-party-midnight").can_see(P(73))


def test_gatsby_did_not_hear_the_rumors(view):
    gatsby = view("gatsby")
    for pid in (P(30), P(32), P(35)):
        assert not gatsby.can_see(pid)


def test_gatsby_knows_his_past_but_hides_it(work: Work, view):
    gatsby = view("gatsby")
    assert gatsby.can_see(P4(138))
    assert gatsby.is_hidden(P4(138))
    assert "f-gatsby-daisy-1917" in ids(hidden_facts(work, gatsby))


def test_jordan_learns_secret_in_library(view):
    assert not view("jordan", "t03-party-midnight").can_see(P4(157))
    late = view("jordan", "t03-party-late")
    assert late.can_see(P4(157))
    assert late.is_hidden(P4(157))


def test_jordan_wedding_memory_is_open(view):
    jordan = view("jordan")
    assert jordan.can_see(P4(140))
    assert not jordan.is_hidden(P4(140))


def test_visible_and_unknown_facts_partition(work: Work, view):
    nick = view("nick")
    assert ids(visible_facts(work, nick)) | ids(unknown_facts(work, nick)) == set(work.facts)
    assert ids(visible_facts(work, nick)) & ids(unknown_facts(work, nick)) == set()
    assert "f-gatsby-reveal" in ids(visible_facts(work, nick))
    assert "f-house-across-bay" in ids(unknown_facts(work, nick))


def test_future_spoilers_depend_on_time(work: Work):
    assert {s.spoiler_id for s in future_spoilers(work, "t03-party-end")} >= {
        "s-reunion",
        "s-gatsby-death",
    }
    assert future_spoilers(work, "t09-funeral") == []
