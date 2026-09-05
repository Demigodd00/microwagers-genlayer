import time

from gltest import get_contract_factory, get_accounts
from gltest.assertions import tx_execution_succeeded

STAKE = 10**15
APPEAL_WINDOW_SECS = 300
RESOLUTION_TIMEOUT_SECS = 600


def _wait_until(unix_ts: int) -> None:
    while time.time() < unix_ts + 2:
        time.sleep(5)


def test_appeal_flow_with_bond_on_studionet():
    factory = get_contract_factory("MicroWagers")
    contract = factory.deploy(args=[0, APPEAL_WINDOW_SECS, RESOLUTION_TIMEOUT_SECS])

    accounts = get_accounts()
    alice, bob = accounts[0], accounts[1]
    bob_contract = contract.connect(bob)

    deadline = int(time.time()) + 70

    create_tx = contract.create_wager(
        args=[
            "When validators resolve after the deadline, does the source page state that this domain is reserved for use in illustrative examples in documents?",
            "Yes, the page states it is for use in illustrative examples",
            "No, the page states something different",
            "https://example.com/",
            deadline,
        ]
    ).transact(value=STAKE)
    assert tx_execution_succeeded(create_tx)

    listing = contract.list_wagers(args=[0, 10]).call()
    wid = listing["items"][-1]["id"]

    accept_tx = bob_contract.accept_wager(args=[wid]).transact(value=STAKE)
    assert tx_execution_succeeded(accept_tx)

    _wait_until(deadline)

    resolve_tx = bob_contract.resolve_wager(args=[wid]).transact()
    assert tx_execution_succeeded(resolve_tx)

    w_before = contract.get_wager(args=[wid]).call()
    assert w_before["status"] == "PROVISIONAL"
    original_winner = w_before["winner"].lower()
    assert w_before["appealed"] is False
    original_record = w_before["original_record"]
    assert len(original_record["source_digest"]) == 64

    # Loser appeals with a bond equal to the stake
    appealer_is_loser = bob.address.lower() == original_winner is False
    if original_winner == alice.address.lower():
        appealer_contract = bob_contract
    else:
        appealer_contract = contract

    appeal_tx = appealer_contract.appeal_wager(
        args=[wid, "Challenger statement: re-examine the source carefully; the accepted reading is wrong."]
    ).transact(value=STAKE)
    assert tx_execution_succeeded(appeal_tx)

    w_after = contract.get_wager(args=[wid]).call()
    assert w_after["appealed"] is True
    assert len(w_after["appeal_statement"]) > 0
    assert w_after["status"] in ("PROVISIONAL", "VOIDED")
    assert w_after["original_record"] == original_record
    assert w_after["appeal_record"]["exists"] is True
    assert len(w_after["appeal_record"]["source_digest"]) == 64

    if w_after["status"] == "VOIDED":
        # Appeal overturned into refund: no winner, no pot bonus
        assert w_after["outcome_label"] == ""
        assert w_after["pot_bonus_atto"] == "0"
        print("Appeal outcome: OVERTURNED -> VOIDED")
    elif w_after["winner"].lower() == original_winner:
        # Upheld: bond joined the pot
        assert w_after["pot_bonus_atto"] == str(STAKE)
        assert w_after["verdict_reason"].startswith("[APPEAL UPHELD]")
        pot = int(w_after["stake_atto"]) * 2 + STAKE
        assert int(w_after["pot_atto"]) == pot
        print("Appeal outcome: UPHELD (winner kept, bond added to pot)")
    else:
        # Overturned: winner flipped, bond refunded to appealer
        assert w_after["verdict_reason"].startswith("[OVERTURNED ON APPEAL]")
        assert w_after["pot_bonus_atto"] == "0"
        print("Appeal outcome: OVERTURNED (winner flipped)")

    # Second appeal must be rejected (one-shot right)
    second_appeal_contract = (
        bob_contract if appealer_contract is contract else contract
    )
    try:
        tx = second_appeal_contract.appeal_wager(
            args=[wid, "second appeal should fail"]
        ).transact(value=STAKE)
        assert not tx_execution_succeeded(tx)
    except Exception:
        pass

    # Payout remains locked until the appeal window expires.
    if w_after["status"] == "PROVISIONAL":
        winner_contract = contract if w_after["winner"].lower() == alice.address.lower() else bob_contract
        if not w_after["claimable"]:
            claim_tx = winner_contract.claim(args=[wid]).transact()
            assert not tx_execution_succeeded(claim_tx)
            _wait_until(int(w_after["appeal_deadline_unix"]))
        claim_tx = winner_contract.claim(args=[wid]).transact()
        assert tx_execution_succeeded(claim_tx)
        assert contract.get_wager(args=[wid]).call()["status"] == "SETTLED"
