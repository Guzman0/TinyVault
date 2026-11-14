# Post for the Mezo team (Discord or forum)

Suggested place: the Mezo Discord's builders or MUSD channel, or a reply on the RFC-1 Microloans thread if there is one.

---

**TinyVault: RFC-1 microloans, live on Mezo testnet**

Hi Mezo team, I'm Guzman, building TinyVault in the Mezo Buildathon. It does what RFC-1 describes: MUSD loans from 10 MUSD, far below the 1,800 minimum, by pooling small borrowers into one shared trove with a per-account ledger.

Live on testnet:
- App: https://guzman0.github.io/TinyVault/
- Vault (verified): https://explorer.test.mezo.org/address/0x7e98760E75a14e0095A2BE38Ff99D5A231678c11
- Code: https://github.com/Guzman0/TinyVault

How it works with Mezo:
- Each account has its own ratio. Below 125% anyone can close that one account for a 5% bonus, and a keeper scans every account on a schedule.
- Redemptions and redistributions are split by debt share. A testnet redemption bot fully redeemed one of our stress-test vaults today, and the vault recorded it and returned the leftover BTC.
- Fixed trove capacity is handled with refinance (one happened on chain today).
- Recovery Mode and a full wind-down are covered.

6 testers have used it so far: they'd borrow 10 to 250 MUSD, all below Mezo's minimum.

Two questions:
1. Would you look at TinyVault as a candidate implementation of RFC-1, or tell me what Mezo's own version would need that this lacks?
2. RFC-1 plans fee-exempt status for its microloan contract. Could a vault like this qualify, and what would you need to see first?

Happy to walk anyone through it.
