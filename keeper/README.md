# TinyVault keeper

Finds accounts below the 125% close line and closes them. Closing is open to anyone: the closer pays the
account's debt in MUSD and receives that account's BTC worth the debt plus 5%. Other accounts are untouched.

```bash
cd keeper && npm install
node keeper.mjs                                  # scan once and report, no key needed
PRIVATE_KEY=0x... node keeper.mjs                # scan once and close what can be closed
PRIVATE_KEY=0x... INTERVAL=60 node keeper.mjs    # keep watching, every minute
```

The wallet needs MUSD to pay debts and a little BTC for gas. Optional settings: `RPC` (default Mezo testnet),
`VAULT`, `FROM_BLOCK`, `MAX_PAY` (largest debt to pay in one close, in MUSD).

## See it work

`./fork-demo.sh` runs it on a local copy of Mezo testnet (needs Foundry): a new account borrows close to its
limit, BTC falls 23%, and the keeper closes that account alone. Output from 25 October 2026:

```
--- before the drop ---
BTC $80,512.1 · 3 accounts · close below 125% · Mezo loan at 185%
  ok     0x89d7…734E 181%  closes at $55,608.32
  ok     0x87F4…6ee5 296.1%  closes at $33,987.32
  ok     0x7099…79C8 160.1%  closes at $62,875.31
  nothing to close

--- BTC falls 23% to $61,975.75 ---
BTC $61,975.75 · 3 accounts · close below 125% · Mezo loan at 143%
  ok     0x89d7…734E 139.3%  closes at $55,608.33
  ok     0x87F4…6ee5 227.9%  closes at $33,987.32
  CLOSE  0x7099…79C8 123.2%  owes 100.6 MUSD
  closed 0x7099…79C8: paid 100.6 MUSD, received 0.001704 BTC (worth 5.03 MUSD more)

--- after ---
BTC $61,975.75 · 3 accounts · close below 125% · Mezo loan at 144%
  ok     0x89d7…734E 139.3%  closes at $55,608.33
  ok     0x87F4…6ee5 227.9%  closes at $33,987.32
  nothing to close
```

The fork replaces Mezo's price feed with one the script can move, since the real one reads a Mezo chain
precompile that a local fork cannot run. Everything else is Mezo's real contracts and the live vault.
