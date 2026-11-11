# Wave 2: Updates in this Wave

Copy into the "Updates in this Wave" field. Track: Track 1, DeFi.

**What changed since Wave 1**

Every point from the Wave 1 review is addressed, in a new vault deployed on Mezo testnet with its source verified on the explorer: 0x7e98760E75a14e0095A2BE38Ff99D5A231678c11.

1. Wind-down (finding H-01). The vault could not close its Mezo trove, so the last depositors' BTC and the vault's idle and reserve MUSD could be frozen. Now the owner can shut the vault down: no new deposits or loans, while repaying and withdrawing keep working. After a 7-day grace period anyone can close an account that still owes. Once nobody owes, anyone can call closeTrove(): the vault's own MUSD repays Mezo, the trove closes, every account withdraws all its BTC, and only then is the reserve released. Tested against Mezo's real trove on a fork of testnet.

2. Mezo Recovery Mode. In Recovery Mode Mezo blocks the BTC withdrawals that closing an account relied on. Closing a weak account still works: the debt is repaid, which Mezo allows, and the closer's BTC is credited to them inside the vault, withdrawable when Recovery Mode ends. Withdrawals and new borrowing from Mezo stop with a clear RecoveryMode() error, and loans from MUSD the vault already holds keep working. Tested on a fork by lowering the price until Mezo's own TroveManager reports Recovery Mode (at 55% of the current testnet price).

3. If Mezo closes the trove itself, the MUSD the vault holds is shared among the accounts that carried the debt, by debt share, and claimed with claimMusd().

4. The keeper runs every 15 minutes on GitHub Actions. It reads the live price, checks every account, closes any below 125% and logs each run. During a wind-down it also closes accounts that still owe after the grace period.

5. Close-line alerts. Below 140% the account shows a warning with the BTC price where it closes and two one-tap fixes: the MUSD to repay or the BTC to add to get back to 150%. Browser notifications can be switched on, and the keeper's public log marks these accounts as NEAR.

6. Lower gas with Mezo's sorted-list hints. The app and keeper read the trove's position from Mezo's SortedTroves before each transaction. On testnet's 359 troves a deposit drops from 1.81M to 0.43M gas and a withdrawal from 2.14M to 0.47M, about 76% less.

7. First loan in one step, and a phone layout. A new user picks an amount of MUSD; the app works out the BTC for a 200% start and sends both steps. The whole app now fits a phone screen.

8. The app shows the vault's state (open, winding down, Recovery Mode, closed), the wind-down buttons, a claim box, and an activity feed of every deposit, loan, repayment, withdrawal and close, each linked to the explorer.

9. Independent users on testnet. [N] people other than me have used the vault: [addresses]. Their answers to four short questions are published in FEEDBACK.md in the repo.

10. Tests: 49 in CI on every push. 41 unit and fuzz tests, 8 on a fork of Mezo testnet against Mezo's real contracts, including the wind-down, Recovery Mode, a real redemption through 266 riskier troves, and a keeper close after a 23% BTC drop. A keeper close and a Mezo redemption cannot be forced on testnet without a real price drop or another trove redeeming, so those two are shown on the fork.

**Who funds the anchor, and how it sustains itself**

On testnet I fund the anchor: 0.05 BTC against Mezo's 1,800 MUSD minimum, at about 186%. On mainnet a backer does the same at 250% or more: Mezo, a partner or a treasury. The backer's cost is Mezo's interest on about 2,000 MUSD of anchor debt, at today's 1% about 20 MUSD a year, and it keeps the MUSD it borrowed. The 0.5% fee on each loan covers that after about 4,000 MUSD of loans a year, which is 40 people borrowing 100 MUSD. Beyond that the fees fill the reserve and then pay the backer. Since Wave 2 the backer can also exit: the wind-down returns all BTC. Closers earn 5% of each closed account, so keepers pay for themselves, and Mezo earns its fee and interest on every loan.

**Links**
- Live app: https://guzman0.github.io/TinyVault/
- Code: https://github.com/Guzman0/TinyVault
- Vault (verified): https://explorer.test.mezo.org/address/0x7e98760E75a14e0095A2BE38Ff99D5A231678c11
- Deck: https://claude.ai/artifact/C5i5tL5QgAt4t3AZ9eRHhD
- Trial feedback: https://github.com/Guzman0/TinyVault/blob/main/FEEDBACK.md
- Security notes: https://github.com/Guzman0/TinyVault/blob/main/SECURITY.md
