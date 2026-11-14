# Security notes

TinyVault is unaudited testnet software. This file records the checks run so far and what they found.

## Tests

- 41 unit and fuzz tests against a model of Mezo's borrowing rules (`test/TinyVault.t.sol`), including
  fuzzing that the ledger always adds up to the Mezo loan.
- 8 tests on a fork of Mezo testnet against Mezo's own contracts (`test/TinyVaultFork.t.sol`), including a
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

## Wave 2 fixes (judges' review, Wave 1)

| Finding | Fix | Tests |
|---|---|---|
| H-01: no wind-down path; the last depositors' BTC and the idle and reserve MUSD could be frozen | `shutdown()` (owner) stops new deposits and loans; repaying and withdrawing keep working. After a 7-day grace period anyone can close an account that still owes. Once nobody owes, anyone can call `closeTrove()`: the vault's MUSD repays Mezo (reserve, then the caller, top up the last few wei of interest), the trove closes, all BTC returns and every account withdraws its own. The reserve is released only after that. | `TinyVaultWindDown.t.sol`; `test_fork_windDownClosesTheRealTrove` on Mezo's real contracts |
| Mezo Recovery Mode blocks the BTC withdrawals that closing an account relied on | `closeAccount` still works: the debt is repaid (Mezo allows repayments in Recovery Mode) and the closer's BTC is credited to it inside the vault, withdrawable when Recovery Mode ends. Withdrawals, new borrowing from the trove and `closeTrove` stop with a clear `RecoveryMode()` error; loans from MUSD the vault already holds still work. | `TinyVaultWindDown.t.sol`; `test_fork_closeAccountInRealRecoveryMode`, which lowers the price until Mezo's own TroveManager reports Recovery Mode (testnet: at 55% of today's price) |
| If Mezo closes the trove itself, the idle and reserve MUSD stayed in the vault | It is shared among the accounts that carried the debt, by debt share, and claimed with `claimMusd()` | `test_heldMusdIsSharedWhenMezoLiquidates` |

Slither after these changes: no new findings beyond `timestamp` notes on the 7-day grace period, which is intended.

## How far the reserve reaches

An account is closed at its own 125% line. If BTC falls past that line before anyone closes it, the closer still takes BTC worth the debt plus the 5% bonus, so the account only falls short once its ratio is below 105%. At a ratio `r` below that, the closer pays what the BTC covers, `coll × price / 1.05`, and the gap is `1 − r / 1.05` of the account's debt. The reserve pays that gap first; only what it cannot cover is shared across the remaining debt.

The reserve fills from the fee on each loan, so at most it holds that fee's share of the money lent:

| Ratio when the account is finally closed | Gap, as a share of its debt | Covered at 0.5% (today) | Covered at 2% (the cap) |
| --- | --- | --- | --- |
| 105% or more | none | yes | yes |
| 104.5% | 0.5% | yes, just | yes |
| 103% | 1.9% | no | yes, just |
| 100% | 4.8% | no | no |
| 90% | 14.3% | no | no |

So a 0.5% reserve covers a fall of about 16% past an account's close line before it is closed, and 2% covers about 18%. That is a single fall between two keeper checks; the keeper runs every few hours on GitHub, and anyone else can close earlier for the bonus. A deeper crash in that window is shared across the debt that remains. The app shows the reserve as a share of what borrowers owe. Before mainnet: more than one keeper, a minimum reserve before new loans, and the anchor kept at 250% or more on chain.

## Known limits

- If BTC falls far enough that the whole shared loan drops below Mezo's 110% line, Mezo can liquidate it,
  and the loss falls on the accounts with debt, in proportion to their debt. The vault then stops new
  deposits, loans and repayments; each account withdraws what BTC is left and claims its share of
  the vault's MUSD. The keeper below exists to close weak accounts long before that point.
- The anchor cannot be closed on its own. It carries Mezo's minimum debt, and closing it would take the shared
  loan below Mezo's 110% line, which Mezo refuses (checked on a fork: at $49,000 the close reverts with
  "ICR < MCR"). So the anchor goes only when Mezo closes the whole shared loan, and at that price every account
  that still owes loses its BTC, even one whose own ratio is healthy. Today that price is about $42,270, above
  a small account's own close line. The app shows this price to everyone, uses it as each account's real close
  price where it comes first, and warns within 15% of it; the keeper logs it on every run. The fix is a
  better-collateralised anchor: adding BTC to it moves the line down. Before mainnet the contract should
  refuse new loans while the anchor is below a set ratio, such as 250%.
- Closing an account relies on someone running a keeper. `keeper/` is a ready-made one; the closer earns 5%.
