# TinyVault

Small MUSD loans against small amounts of BTC on Mezo.

Mezo's smallest loan is **1,800 MUSD** of debt, plus a 200 MUSD gas deposit, so at least 2,000 MUSD at opening ([Mezo docs](https://mezo.org/docs/users/musd/mint-musd/); `minNetDebt` on Mezo's mainnet BorrowerOperations reads `1800000000000000000000`). At a safe 150% ratio that takes about $3,000 of BTC. Someone holding $500 of BTC who needs $150 cannot borrow on Mezo at all and has to sell.

TinyVault opens one Mezo loan for many people and keeps the ledger. Anyone can borrow from **10 MUSD**.

- Live app: https://guzman0.github.io/TinyVault/
- Vault (Mezo testnet, source verified): [`0x7e98760E75a14e0095A2BE38Ff99D5A231678c11`](https://explorer.test.mezo.org/address/0x7e98760E75a14e0095A2BE38Ff99D5A231678c11)
- Track: Track 1, DeFi

## How it works

1. **Add BTC.** It goes into the shared Mezo trove and is recorded under your address.
2. **Borrow MUSD** up to two thirds of your BTC's value (a 150% ratio). Your limit is yours alone.
3. **Repay any time** and withdraw your BTC.

The trove is opened by an **anchor** who borrows Mezo's minimum. The anchor is an ordinary account in the ledger that also carries the trove's 200 MUSD gas deposit.

## How one shared loan stays fair

Mezo sees one loan with one ratio. The hard part is making sure one person's bad position never becomes someone else's loss.

| Risk | What TinyVault does |
| --- | --- |
| Interest and Mezo fees | Debt is tracked in shares of the trove's debt, so interest and fees are split by what each person borrowed. The borrower who triggers a fee pays it. |
| One account becomes unsafe | Each account has its own ratio. Below **125%** anyone can close *that account*: they pay its MUSD debt and receive its BTC worth the debt plus **5%**. The rest of the BTC stays with the owner. Nothing is sold on a market, so the vault takes no slippage, and other accounts are untouched. |
| BTC falls too fast to close in time | If an account's BTC is worth less than debt plus bonus when it is closed, the closer pays only what the BTC covers. A **reserve** funded by a 0.5% fee on each loan pays the gap first. Only what the reserve cannot cover is shared across the remaining debt. |
| Mezo redemptions | A redemption takes BTC from the trove and cancels the same value of debt. TinyVault detects it and removes BTC from each account in proportion to its debt, the same proportion in which the debt was cancelled, so no value moves between accounts. |
| Redistributions from other liquidated troves | Added BTC and debt are split the same way. |
| Mezo's minimum loan | Repayments that would take the trove below 1,800 MUSD are held against the debt and lent out again first, with no Mezo fee. |
| Fixed borrowing capacity | A Mezo trove's borrowing capacity is fixed when it opens. When a new loan needs more room, TinyVault calls Mezo's `refinance` and charges its small fee to that borrower. |
| Trove closed by Mezo | If the trove is fully redeemed, each account keeps the BTC left after its own debt was cancelled and can withdraw it. |

## Mezo integration

| Mezo contract | Use |
| --- | --- |
| BorrowerOperations | `openTrove`, `addColl`, `withdrawColl`, `withdrawMUSD`, `repayMUSD`, `refinance`, `claimCollateral` |
| TroveManager | Debt, collateral, status and borrowing capacity of the shared trove |
| PriceFeed | BTC price for every account's health |
| MUSD | Loans, repayments and close-outs |

## Tests

```
forge test --no-match-contract Fork
```

41 unit tests (including fuzz tests that the ledger always adds up to the trove) against a stand-in for Mezo that follows its rules: 1,800 MUSD minimum, 200 MUSD gas deposit, 0.1% borrowing fee, fixed capacity and refinance, redemptions, redistributions and liquidation.

```
FOUNDRY_PROFILE=fork MEZO_RPC=https://rpc.test.mezo.org forge test --match-contract Fork -vv
```

8 tests against **Mezo's real MUSD contracts** on a fork of testnet: opening the shared trove, winding the vault down and closing its real trove so every BTC comes back, closing an account in Mezo's real Recovery Mode, a $100 loan against $300 of BTC, the per-account limit, closing one account after a 20% price drop while another is untouched, growing past the trove's opening capacity, and a real Mezo redemption run through every riskier trove on testnet into the vault, split by debt within 0.2%. Mezo's price feed reads a chain precompile that a forked EVM cannot run, so the tests read the live price from the network and serve it to the fork.

## Keeper

`keeper/` closes accounts that fall below 125%, so the vault does not depend on someone noticing. Anyone can run it; the closer earns 5% on each close. `keeper/fork-demo.sh` shows it closing one account after a 23% BTC drop on a fork of Mezo testnet, with the other accounts untouched. See [keeper/README.md](keeper/README.md).

It runs every 15 minutes on GitHub Actions ([`.github/workflows/keeper.yml`](.github/workflows/keeper.yml)); each run's output is in the workflow summary. With no `KEEPER_PRIVATE_KEY` secret it reports what it would close; with one it sends the closes.

## Who funds the anchor

On testnet, Guzman funds it: 0.05 BTC against Mezo's 1,800 MUSD minimum, at about 186%. On mainnet a backer does the same at 250% or more: Mezo, a partner or a treasury. Its cost is Mezo's interest on about 2,000 MUSD of anchor debt (at today's 1%, about 20 MUSD a year), and it keeps the MUSD it borrowed. The 0.5% fee on each loan covers that after about 4,000 MUSD of loans a year, 40 people borrowing 100 MUSD. Past that, fees fill the reserve and then pay the backer. The wind-down lets the backer exit with all its BTC, and closers earn 5% of each close, so keepers pay for themselves.

## Security

Slither static analysis was run on the vault; the one real finding (rounding in a view) is fixed and the rest are reviewed in [SECURITY.md](SECURITY.md), with the known limits.

## Run the app

```
cd web
npm install
npm run dev
```

## Limits

Testnet only and not audited. The owner can shut the vault down: no new deposits or loans, everyone repays and withdraws, accounts still owing can be closed after 7 days, then anyone closes the Mezo trove and all BTC comes back (see [SECURITY.md](SECURITY.md)). In Mezo Recovery Mode, withdrawals pause, but weak accounts can still be closed. The vault's parameters are fixed at deployment (150% to borrow, 125% to close, 5% bonus, 10 MUSD minimum); only the reserve fee is adjustable, capped at 2%. A Mezo `refinance` resets the trove's interest rate to Mezo's current rate for everyone in the vault. If Mezo liquidates the whole trove (its ratio below 110%), the loss falls on the accounts with debt; the per-account close line exists to keep the trove far from that.
