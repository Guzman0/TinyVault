# Testnet trial feedback

Wave 2 trial on Mezo testnet, November 2026. Each tester used the live app with their own wallet; every action is on chain in the vault [`0x7e98760E75a14e0095A2BE38Ff99D5A231678c11`](https://explorer.test.mezo.org/address/0x7e98760E75a14e0095A2BE38Ff99D5A231678c11) and in the app's activity feed.

Questions asked:

1. Had you borrowed against crypto before? If not, what stopped you?
2. What was confusing or slow?
3. If this were real, how much would you borrow, and what for?
4. Did the close-line warning make sense, and would you trust it with real BTC?

## Testers

| Wallet | Vault | What they did | Borrowed |
| --- | --- | --- | --- |
| [`0x0B43…d967`](https://explorer.test.mezo.org/address/0x0B43A638d049Bb08eafB302B264487AAb731d967) | Main | Added 0.0084 BTC, borrowed, repaid 50 MUSD, withdrew 0.0034 BTC | 250 MUSD |
| [`0x87F4…6ee5`](https://explorer.test.mezo.org/address/0x87F451225907da77E23D8d5fE80982F272186ee5) | Main | Added 0.0039 BTC, borrowed, withdrew 0.0016 BTC; the loan that made the vault refinance with Mezo | 98 MUSD |
| [`0x12E5…78DC`](https://explorer.test.mezo.org/address/0x12E5745b163D38F52073CF2113B094edAd3578DC) | Main | Added 0.005 BTC, borrowed, repaid 100 MUSD | 150 MUSD |
| [`0x8bE1…f41A`](https://explorer.test.mezo.org/address/0x8bE1A8C923084E0C7351d295be07DAFce818f41A) | Main | Added 0.0229 BTC, borrowed in three loans | 1,020 MUSD |
| [`0xaC88…1481`](https://explorer.test.mezo.org/address/0xaC88dbf072029bA3af94c8687f7EAfC5C91e1481) | Stress | Added 0.002 BTC, borrowed at the 116.5% limit, waiting for the keeper close | 111 MUSD |

Not counted: the anchor (Guzman's wallet) and the app's public demo wallet. The stress vault is [`0x41b230d37bB10cc005803CD780357d24Ae162731`](https://explorer.test.mezo.org/address/0x41b230d37bB10cc005803CD780357d24Ae162731).

## What they said

Answers as the testers sent them.

### Tester 1

- **Borrowed against crypto before?** No. I usually sell some of my crypto whenever I need liquidity. I never considered borrowing because most platforms seemed designed for people with larger holdings.
- **What was confusing or slow?** Understanding how the shared loan works took a little time, but the How It Works section made it easier to understand.
- **How much would you borrow, and what for?** Around 100 MUSD for unexpected expenses without selling my BTC.
- **Did the close-line warning make sense; would you trust it?** Yes, I understood the warning and the 125% closing threshold. I would want to see how reliable the liquidation process is before committing real BTC.

### Tester 2

- **Borrowed against crypto before?** Yes. I've used DeFi lending platforms before, mostly for accessing liquidity without selling my assets.
- **What was confusing or slow?** The separate transaction confirmations for adding collateral and borrowing. I expected the process to happen in one transaction.
- **How much would you borrow, and what for?** Around 250 MUSD to cover short-term expenses while maintaining my Bitcoin exposure.
- **Did the close-line warning make sense; would you trust it?** Yes. Having both the account's individual closing price and the shared loan's closing price is useful. I would still want an independent security audit before using real BTC.

### Tester 3

- **Borrowed against crypto before?** No. I had seen crypto-backed loans before but never tried one because I wasn't comfortable with the collateral requirements.
- **What was confusing or slow?** I initially wasn't sure how the borrowing limit was calculated. The collateral ratio and borrowing capacity helped clarify it.
- **How much would you borrow, and what for?** Approximately 50 MUSD for small personal expenses or emergencies.
- **Did the close-line warning make sense; would you trust it?** Yes. The percentage indicator was easy to understand. I would like to receive alerts even when I'm not actively using the website.

### Tester 4

- **Borrowed against crypto before?** Yes, but only through centralized platforms. This was my first experience with a shared on-chain borrowing arrangement.
- **What was confusing or slow?** Understanding how individual accounts are connected to the shared Mezo loan. The account breakdown helped, but I had to spend some time examining it.
- **How much would you borrow, and what for?** Around 300 MUSD for temporary business liquidity.
- **Did the close-line warning make sense; would you trust it?** Yes. However, the shared loan's liquidation risk is something I would pay close attention to before depositing significant BTC.

### Tester 5

- **Borrowed against crypto before?** No. I've always preferred holding Bitcoin rather than selling it, but I hadn't found a borrowing platform suitable for smaller amounts.
- **What was confusing or slow?** The repayment process. I wanted to understand how much interest and fees had accumulated before repaying.
- **How much would you borrow, and what for?** Around 30 MUSD for an unexpected expense.
- **Did the close-line warning make sense; would you trust it?** Yes. The closing price made the risk easier to understand. I would want confidence that the keeper can respond quickly during sudden price movements.

### In short

- 3 of 5 had never borrowed against crypto; two said loans looked built for bigger holders, or sold crypto instead.
- They would borrow 30 to 300 MUSD, median 100, for expenses or short-term liquidity. Every amount is below Mezo's 1,800 MUSD minimum.
- All five understood the close-line warning. Before real BTC, they want proof the close process is reliable, an independent audit, and a closer look at the shared loan's risk.

## What changed because of it

| They said | What we did |
| --- | --- |
| Shared loan took time to understand (testers 1, 4) | A "How it works" diagram, and a line under the first-loan button giving the price where Mezo can close the whole shared loan, before any BTC goes in |
| Expected one transaction, got two (tester 2) | The first-loan button now says up front that the wallet asks twice. A single transaction needs a contract change, planned for the next version |
| Wants alerts when not on the site (tester 3) | The alert toggle now says plainly it works while the page is open. Alerts by Telegram or email are on the roadmap; the keeper's public log already marks accounts near their line |
| Wants to see interest and fees before repaying (tester 5) | The repay tab shows what has built up since the loan |
| Wants proof closes are reliable (testers 1, 5) | The keeper now runs with a funded wallet and sends closes; the app shows when it last ran with a link to its log. A stress-test vault with tight settings shows a keeper close on chain |
| Wants an independent audit (tester 2) | Listed as a mainnet requirement in SECURITY.md, with the anchor kept at 250% on chain |
