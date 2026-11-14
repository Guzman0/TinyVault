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

### Tester 1: [`0x87F4…6ee5`](https://explorer.test.mezo.org/address/0x87F451225907da77E23D8d5fE80982F272186ee5)

- **Borrowed against crypto before?** No. Most platforms I've seen seem to cater to people with much larger portfolios. I never thought my small BTC balance would be useful as collateral.
- **What was confusing or slow?** Honestly, not much. I understood the basic process after going through the steps. I just wanted to know how much BTC I needed to deposit to borrow a small amount.
- **How much would you borrow, and what for?** 10–20 MUSD. That's the interesting part for me. I don't necessarily need thousands of dollars.
- **Did the close-line warning make sense; would you trust it?** Yes. I would just make sure I had enough room between my current ratio and the closing threshold.

### Tester 2: [`0x0B43…d967`](https://explorer.test.mezo.org/address/0x0B43A638d049Bb08eafB302B264487AAb731d967)

- **Borrowed against crypto before?** No. I've seen similar products, but I've never had a strong reason to use one.
- **What was confusing or slow?** The concept itself is interesting, but I wanted to understand why I should use TinyVault instead of simply selling a small amount of BTC when I need money.
- **How much would you borrow, and what for?** Maybe 100 MUSD. I'd consider it if I expected Bitcoin to appreciate and needed short-term liquidity.
- **Did the close-line warning make sense; would you trust it?** Yes. My hesitation isn't really the warning. It's whether borrowing is worth the additional risk and cost compared with selling some BTC.

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

### Tester 5: [`0x8bE1…f41A`](https://explorer.test.mezo.org/address/0x8bE1A8C923084E0C7351d295be07DAFce818f41A)

- **Borrowed against crypto before?** Yes, mainly with stablecoins and collateralized DeFi positions. I'm more familiar with borrowing than with the particular shared-loan structure TinyVault uses.
- **What was confusing or slow?** I wanted more information about MUSD repayment and how accrued borrowing costs affect the amount I need to return.
- **How much would you borrow, and what for?** Around 250 MUSD. I'd use it for temporary liquidity rather than keeping a large amount of MUSD sitting idle in my wallet.
- **Did the close-line warning make sense; would you trust it?** Yes. The BTC price at which the account closes is more useful to me than just seeing a percentage. I'd also pay attention to the amount of BTC left after partial withdrawals.

### In short

- 3 of 5 had never borrowed against crypto; two said loans looked built for bigger portfolios, and one wanted only 10 to 20 MUSD.
- They would borrow 10 to 300 MUSD, median 100, for expenses or short-term liquidity. Every amount is below Mezo's 1,800 MUSD minimum.
- One asked the real question: why borrow instead of selling a little BTC? All five understood the close-line warning. Before real BTC, they want proof the close process is reliable and a closer look at the shared loan's risk.

## What changed because of it

| They said | What we did |
| --- | --- |
| Shared loan took time to understand (tester 4) | A "How it works" diagram, and a line under the first-loan button giving the price where Mezo can close the whole shared loan, before any BTC goes in |
| Wants alerts when not on the site (tester 3) | The alert toggle now says plainly it works while the page is open. Alerts by Telegram or email are on the roadmap; the keeper's public log already marks accounts near their line |
| Wants to know how much BTC a small loan needs (tester 1) | The calculator shows it before connecting a wallet, and the first-loan box works out the BTC for a 200% start from the MUSD wanted |
| Wants to see how borrowing costs change what has to be repaid (tester 5) | The repay tab now says how much of the debt is fees and interest built up since the loan |
| Watches the BTC left after partial withdrawals (tester 5) | Already in the withdraw preview: the BTC left, the ratio after, and the new close price |
| Watches the shared loan's risk before depositing much (tester 4) | The keeper now runs with a funded wallet and sends closes; the app shows when it last ran with a link to its log. A stress-test vault with tight settings shows a keeper close on chain |
