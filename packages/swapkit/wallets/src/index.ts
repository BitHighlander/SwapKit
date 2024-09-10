import { coinbaseWallet } from "@swapkit/wallet-coinbase";
import { evmWallet } from "@swapkit/wallet-evm-extensions";
import { keepkeyWallet } from "@swapkit/wallet-keepkey";
import { keepkeyBexWallet } from "@swapkit/wallet-keepkey-bex";
import { keplrWallet } from "@swapkit/wallet-keplr";
import { keystoreWallet } from "@swapkit/wallet-keystore";
import { ledgerWallet } from "@swapkit/wallet-ledger";
import { okxWallet } from "@swapkit/wallet-okx";
import { phantomWallet } from "@swapkit/wallet-phantom";
import { polkadotWallet } from "@swapkit/wallet-polkadotjs";
import { talismanWallet } from "@swapkit/wallet-talisman";
import { trezorWallet } from "@swapkit/wallet-trezor";
import { walletconnectWallet } from "@swapkit/wallet-wc";
import { xdefiWallet } from "@swapkit/wallet-xdefi";

export const wallets = {
  ...coinbaseWallet,
  ...evmWallet,
  ...keepkeyWallet,
  ...keepkeyBexWallet,
  ...keplrWallet,
  ...keystoreWallet,
  ...ledgerWallet,
  ...okxWallet,
  ...phantomWallet,
  ...polkadotWallet,
  ...talismanWallet,
  ...trezorWallet,
  ...walletconnectWallet,
  ...xdefiWallet,
};
