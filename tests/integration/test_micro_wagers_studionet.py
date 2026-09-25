import time

from gltest import get_contract_factory, get_accounts
from gltest.assertions import tx_execution_succeeded

STAKE = 10**15
APPEAL_WINDOW_SECS = 300
RESOLUTION_TIMEOUT_SECS = 600


def _wait_until(unix_ts: int) -> None:
    while time.time() < unix_ts + 2:
        time.sleep(5)


def _create(alice_contract, question, side_a, side_b, url, url_2, deadline):
    tx = alice_contract.create_wager(
        args=[question, side_a, side_b, url, url_2, deadline]
    ).transact(value=STAKE)
    assert tx_execution_succeeded(tx)
    listing = alice_contract.list_wagers(args=[0, 100]).call()
    items = [i for i in listing["items"] if i["question"][:120] == question[:120]]
    return items[-1]["id"]


def _accept(bob_contract, wid):
    tx = bob_contract.accept_wager(args=[wid]).transact(value=STAKE)
    assert tx_execution_succeeded(tx)


def _resolve(anyone_contract, wid):
    tx = anyone_contract.resolve_wager(args=[wid]).transact()
    assert tx_execution_succeeded(tx)


def test_resolvable_wager_creator_wins_on_studionet():
    factory = get_contract_factory("MicroWagers")
    contract = factory.deploy(args=[0, APPEAL_WINDOW_SECS, RESOLUTION_TIMEOUT_SECS])

    accounts = get_accounts()
    alice, bob = accounts[0], accounts[1]
    bob_contract = contract.connect(bob)

    deadline = int(time.time()) + 70
    wid = _create(
        contract,
        "Do both source pages say the domain is for documentation examples without needing permission?",
        "Yes — the page is for documentation examples",
        "No — the page does not say that",
        "https://example.com/",
        "https://example.net/",
        deadline,
    )

    w = contract.get_wager(args=[wid]).call()
    assert w["status"] == "OPEN"
    assert w["stake_atto"] == str(STAKE)

    _accept(bob_contract, wid)
    w = contract.get_wager(args=[wid]).call()
    assert w["status"] == "LIVE"
    assert w["taker"].lower() == bob.address.lower()

    _wait_until(deadline)
    _resolve(bob_contract, wid)

    w = contract.get_wager(args=[wid]).call()
    assert w["status"] == "PROVISIONAL"
    assert w["outcome_label"] == "Yes — the page is for documentation examples"
    assert w["winner"].lower() == alice.address.lower()
    assert len(w["verdict_reason"]) > 0
    assert len(w["original_record"]["source_digest"]) == 64
    assert w["original_record"]["provenance"] == "GENLAYER_VALIDATOR_DUAL_SOURCE_FETCH_AND_SNAPSHOT"
    assert len(w["original_record"]["sources"]) == 2
    assert all(source["citation"] in source["snapshot"] for source in w["original_record"]["sources"])

    # Payout remains locked for the configured StudioNet appeal window.
    claim_tx = contract.claim(args=[wid]).transact()
    assert not tx_execution_succeeded(claim_tx)

    _wait_until(int(w["appeal_deadline_unix"]))
    claim_tx = contract.claim(args=[wid]).transact()
    assert tx_execution_succeeded(claim_tx)
    assert contract.get_wager(args=[wid]).call()["status"] == "SETTLED"
    assert int(contract.get_claimable_balance(args=[alice.address]).call()) == STAKE * 2
    assert tx_execution_succeeded(contract.claim_funds().transact())


def test_undeterminable_wager_voids_on_studionet():
    factory = get_contract_factory("MicroWagers")
    contract = factory.deploy(args=[0, APPEAL_WINDOW_SECS, RESOLUTION_TIMEOUT_SECS])

    accounts = get_accounts()
    bob = accounts[1]
    bob_contract = contract.connect(bob)

    deadline = int(time.time()) + 70
    wid = _create(
        contract,
        "Will it rain in Tokyo between 12:00 and 12:10 UTC on January 1st, 2199?",
        "Yes, it will rain then",
        "No, it will not rain then",
        "https://example.com/",
        "https://example.net/",
        deadline,
    )
    _accept(bob_contract, wid)

    _wait_until(deadline)
    _resolve(bob_contract, wid)

    w = contract.get_wager(args=[wid]).call()
    assert w["status"] == "VOIDED"
    assert w["outcome_label"] == ""
    assert int(contract.get_claimable_balance(args=[accounts[0].address]).call()) == STAKE
    assert int(contract.get_claimable_balance(args=[bob.address]).call()) == STAKE
    assert tx_execution_succeeded(contract.claim_funds().transact())
    assert tx_execution_succeeded(bob_contract.claim_funds().transact())

    stats = contract.get_stats().call()
    assert int(stats["total_created"]) == 1
    assert int(stats["total_settled"]) == 0
