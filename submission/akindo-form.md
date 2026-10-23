# AKINDO submission answers

Copy each answer into the matching field.

**Project name**
TinyVault

**Project category**
Lending, small loans, financial access

**TL;DR**
Borrow from 10 MUSD against small amounts of BTC on Mezo. Mezo's smallest loan is 1,800 MUSD; TinyVault shares one Mezo loan between many people and keeps a fair ledger.

**The problem**
Mezo's minimum loan is 1,800 MUSD of debt, plus a 200 MUSD gas deposit, so every loan opens at 2,000 MUSD or more. Mezo's docs state it and its mainnet borrowing contract enforces it (minNetDebt = 1,800 MUSD). At a safe 150% ratio that takes about $3,000 of BTC. Most Bitcoin holders hold far less, so someone with $500 of BTC who needs $150 cannot borrow on Mezo and has to sell, the thing Mezo exists to avoid.

**How it works**
TinyVault opens one Mezo loan (a trove) for many people and keeps a ledger of who put in which BTC and who owes what. An anchor account opens the trove at Mezo's minimum; everyone else adds any amount of BTC and borrows from 10 MUSD, up to a 150% ratio of their own.

The shared loan stays fair:
- Debt is tracked in shares of the trove's debt, so Mezo's interest and fees are split by what each person borrowed, and the borrower who triggers a fee pays it.
- Each account has its own health. Below 125% anyone can close that one account: they pay its MUSD debt and receive its BTC worth the debt plus 5%. Nothing is sold on a market and other accounts are untouched.
- If BTC falls so fast that an account's BTC is short when it is closed, a reserve funded by a 0.5% fee on each loan pays the gap first.
- Mezo redemptions take BTC and cancel the same value of debt. TinyVault detects them and removes BTC from each account in proportion to its debt, so no value moves between people. Redistributions are split the same way.
- Mezo specifics are handled: a trove's borrowing capacity is fixed at opening (TinyVault refinances when the loan grows), and repayments that would take the trove under 1,800 MUSD are held and lent out again first.

Tested against Mezo's real MUSD contracts on a fork of testnet, including a real redemption run through 266 riskier troves into the vault, split by debt within 0.2%.

**Target group**
Bitcoin holders with a few hundred dollars of BTC who need small, short loans and do not want to sell, including people in markets where small balances are the norm. Desktop or mobile web with an EVM wallet (MetaMask, Rabby).

**Tech stack**
Solidity 0.8.28, Foundry (unit, fuzz and fork tests against Mezo's contracts), OpenZeppelin, React, TypeScript, Vite, viem, GitHub Actions, GitHub Pages.

**Track**
Track 1: DeFi (borrowing with MUSD)

**Chain deployed on**
Mezo testnet (chain 31611)

**Project status**
Entirely new, built during Wave 1.

**Project readiness**
Testnet deployment with a live shared Mezo loan.

**Future milestones**
1. Wave 2, by 15 November 2026: a keeper that closes unhealthy accounts automatically; alerts before an account nears its close line; lower gas with Mezo list hints; interviews with 10 to 15 small holders.
2. December 2026: external security review; reserve target and fee split; mobile-first app.
3. Q1 2027: mainnet with a backed anchor; vaults with different limits; wallet integrations.

**Team info**
Guzman, solo builder (product, research, build). X: @the_first_guz

**Links**
- Live app: https://guzman0.github.io/TinyVault/
- Code: https://github.com/Guzman0/TinyVault
- Vault contract: https://explorer.test.mezo.org/address/0x8724a13AfAF230311AC0f69e5979f42058EF248b
- Deck: [deck link]
- Pitch video: [video link]
