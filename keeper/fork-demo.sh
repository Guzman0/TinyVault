#!/usr/bin/env bash
# Shows the keeper closing an unhealthy account on a local copy of Mezo testnet.
#
# 1. Fork Mezo testnet with anvil (the live vault, its real Mezo loan, real accounts).
# 2. Replace Mezo's price feed with one we can move (the real one reads a Mezo chain precompile
#    that a local fork cannot run).
# 3. A new account borrows close to its 150% limit.
# 4. BTC falls 23%. That account drops below 125%; the anchor and the other account stay healthy.
# 5. The keeper finds it and closes it: it pays the debt and receives the BTC plus 5%.
set -euo pipefail
cd "$(dirname "$0")"
RPC=http://127.0.0.1:8545
VAULT=0x8724a13AfAF230311AC0f69e5979f42058EF248b
SELLER=0x87F451225907da77E23D8d5fE80982F272186ee5 # an existing account that holds MUSD
BORROWER_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d # local test keys, fork only
KEEPER_KEY=0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9e804cdff365a
KEEPER=$(cast wallet address $KEEPER_KEY)
BORROWER=$(cast wallet address $BORROWER_KEY)
ZERO=0x0000000000000000000000000000000000000000

anvil --fork-url "${MEZO_RPC:-https://rpc.test.mezo.org}" --silent &
ANVIL=$!
trap 'kill $ANVIL 2>/dev/null' EXIT
until cast block-number --rpc-url $RPC >/dev/null 2>&1; do sleep 0.5; done

FEED=$(cast call $VAULT 'priceFeed()(address)' --rpc-url $RPC)
MUSD=$(cast call $VAULT 'musd()(address)' --rpc-url $RPC)
# today's price, read from the live network (a fork cannot run the price feed's precompile)
PRICE=$(cast call $FEED 'fetchPrice()(uint256)' --rpc-url "${MEZO_RPC:-https://rpc.test.mezo.org}" | awk '{print $1}')

# a price feed we can move, at the address Mezo's contracts already read from
[ -f ../out/MockMezo.sol/MockPriceFeed.json ] || (cd .. && forge build >/dev/null)
CODE=$(python3 -c "import json;print(json.load(open('../out/MockMezo.sol/MockPriceFeed.json'))['deployedBytecode']['object'])")
cast rpc anvil_setCode $FEED "$CODE" --rpc-url $RPC >/dev/null
setprice() { cast rpc anvil_setStorageAt $FEED 0x0 "$(cast to-uint256 $1)" --rpc-url $RPC >/dev/null; }
setprice $PRICE
for a in $BORROWER $KEEPER; do cast rpc anvil_setBalance $a 0x8AC7230489E80000 --rpc-url $RPC >/dev/null; done # 10 BTC for gas
echo "BTC at \$$(cast from-wei $PRICE | cut -c1-9)"

echo "A new account adds 0.002 BTC and borrows 100 MUSD, close to its 150% limit"
cast send $VAULT 'deposit(address,address)' $ZERO $ZERO --value 0.002ether --gas-limit 3000000 --private-key $BORROWER_KEY --rpc-url $RPC >/dev/null
cast send $VAULT 'borrow(uint256,address,address)' 100ether $ZERO $ZERO --gas-limit 6000000 --private-key $BORROWER_KEY --rpc-url $RPC >/dev/null

echo "The keeper wallet gets 150 MUSD to pay debts with"
cast rpc anvil_impersonateAccount $SELLER --rpc-url $RPC >/dev/null
cast send $MUSD 'transfer(address,uint256)' $KEEPER 150ether --gas-limit 200000 --from $SELLER --unlocked --rpc-url $RPC >/dev/null

echo
echo "--- before the drop ---"
RPC=$RPC node keeper.mjs 2>/dev/null

DROP=$(python3 -c "print(int($PRICE * 0.77))")
setprice $DROP
echo
echo "--- BTC falls 23% to \$$(cast from-wei $DROP | cut -c1-9) ---"
RPC=$RPC PRIVATE_KEY=$KEEPER_KEY node keeper.mjs 2>/dev/null

echo
echo "--- after ---"
RPC=$RPC node keeper.mjs 2>/dev/null
