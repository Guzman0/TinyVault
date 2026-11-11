# Post for the Mezo team (Discord or forum)

Suggested place: the Mezo Discord's builders or MUSD channel, or a reply on the RFC-1 Microloans thread if there is one.

---

**TinyVault: a working version of RFC-1 Microloans on testnet**

Hi Mezo team. I'm Guzman, building TinyVault in the Mezo Buildathon. It does what RFC-1 describes: MUSD loans below the 1,800 MUSD minimum, from 10 MUSD, by pooling many small borrowers into one shared trove with a per-account ledger.

What is live on testnet:
- Vault (source verified): https://explorer.test.mezo.org/address/0x7e98760E75a14e0095A2BE38Ff99D5A231678c11
- App: https://guzman0.github.io/TinyVault/
- Code and security notes: https://github.com/Guzman0/TinyVault

How it handles Mezo's mechanics:
- Each account has its own ratio. Below 125% anyone can close that one account for a 5% bonus; nothing is sold on a market and other accounts are untouched. A keeper does this every 15 minutes.
- Redemptions and redistributions are split across accounts by debt share. Tested on a fork with a real redemption through 266 riskier troves into the vault.
- Fixed trove capacity is handled with refinance. Repayments that would take the trove below the minimum are held and lent out again.
- Recovery Mode: closing weak accounts still works, with the BTC credited inside the vault until it ends.
- Wind-down: the vault can close its trove and return every BTC.
- Sorted-list hints from SortedTroves cut a deposit from 1.81M to 0.43M gas on testnet.

Two questions for the team:
1. Would you review TinyVault as a candidate implementation of RFC-1, or tell me what Mezo's own version would need that this lacks?
2. RFC-1 plans fee-exempt status for its microloan contract. Would that be open to a vault like this one, and what would you need to see first?

Thanks for reading. Happy to walk anyone through it.
