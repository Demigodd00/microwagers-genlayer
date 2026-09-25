from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[2]


def test_submission_description_fits_portal_limit():
    guide = (ROOT / "docs/MICROWAGERS_SUBMISSION.md").read_text(encoding="utf-8")
    description = guide.split("- Notes / description:\n\n", 1)[1].split("\n\n", 1)[0]
    assert 0 < len(description) <= 1000
    assert "test GEN has no monetary value" in description


def test_submission_uses_public_milestone_route_not_protected_deployment():
    guide = (ROOT / "docs/MICROWAGERS_SUBMISSION.md").read_text(encoding="utf-8")
    assert "https://microwagers.vercel.app/milestone" in guide
    assert not re.search(r"https://microwagers-[\w-]+\.vercel\.app", guide)
    assert (ROOT / "apps/microwagers-web/src/app/milestone/page.tsx").exists()
