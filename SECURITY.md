# Security notes

TinyVault is unaudited testnet software. This file records the checks run so far and what they found.

## Tests

- 29 unit and fuzz tests against a model of Mezo's borrowing rules (`test/TinyVault.t.sol`), including
  fuzzing that the ledger always adds up to the Mezo loan.
- 6 tests on a fork of Mezo testnet against Mezo's own contracts (`test/TinyVaultFork.t.sol`), including a
  real redemption that walks through 266 riskier loans before reaching the vault.
- Both run in CI on every push.

## Static analysis (Slither)

Run: `slither . --filter-paths "lib/|test/|script/" --exclude-informational --exclude-optimization`
(Slither 0.11, 76 detectors), 25 October 2026.

Fixed:

| Finding | What changed |
|---|---|
| divide-before-multiply in `accountOf` | The ratio and borrowing room are now computed in one `mulDiv`, with no intermediate rounding. View only, so no funds were at risk. |

Reviewed and not a problem:

| Finding | Severity | Why it does not apply |
|---|---|---|
| reentrancy-eth, reentrancy-no-eth, reentrancy-benign (17) | High / Medium / Low | Every state-changing function is `nonReentrant`. The external calls flagged are to Mezo's own BorrowerOperations, which does not call back into the vault. BTC is only ever sent to `msg.sender`, as the last step. |
| arbitrary-send-eth in `_sendBtc` | High | Both callers send to `msg.sender`: their own withdrawal, or the closer's BTC from `closeAccount`. |
| incorrect-equality (`debt == 0`) | Medium | A zero check on debt, not a balance comparison an attacker can steer. |
| unused-return on `getEntireDebtAndColl` | Medium | Only the BTC and debt fields are needed; the pending-reward fields are already included in them. |

## Known limits

- If BTC falls far enough that the whole shared loan drops below Mezo's 110% line, Mezo can liquidate it,
  and the loss falls on the accounts with debt, in proportion to their debt. The vault then stops new
  deposits, loans and repayments. The keeper below exists to close weak accounts long before that point.
- The anchor's loan must stay well collateralised: it carries Mezo's minimum debt, which cannot be repaid
  below 1,800 MUSD while the vault is open.
- Closing an account relies on someone running a keeper. `keeper/` is a ready-made one; the closer earns 5%.
