import { KeepKeySdk } from "@keepkey/keepkey-sdk";
import {
  Chain,
  type DerivationPathArray,
  filterSupportedChains,
  NetworkDerivationPath,
  SKConfig,
  SwapKitError,
  WalletOption,
} from "@swapkit/helpers";

export type { PairingInfo } from "@keepkey/keepkey-sdk";

import { createWallet, getWalletSupportedChains } from "@swapkit/wallet-core";
import { cosmosWalletMethods } from "./chains/cosmos";
import { KeepKeySigner } from "./chains/evm";
import { mayachainWalletMethods } from "./chains/mayachain";
import { thorchainWalletMethods } from "./chains/thorchain";
import { utxoWalletMethods } from "./chains/utxo";

export const keepkeyWallet = createWallet({
  connect: ({ addChain, supportedChains, walletType }) =>
    async function connectKeepkey(chains: Chain[], derivationPathMap?: Record<Chain, DerivationPathArray>) {
      const filteredChains = filterSupportedChains({ chains, supportedChains, walletType });
      const pairingInfo = SKConfig.get("integrations").keepKey;
      if (!pairingInfo) throw new Error("KeepKey config not found");

      const initialApiKey = SKConfig.get("apiKeys").keepKey || "1234";

      await checkAndLaunch();

      // Conform to the expected { apiKey, pairingInfo } structure
      const keepkeyConfig = { apiKey: initialApiKey, pairingInfo };
      const keepKeySdk = await KeepKeySdk.create(keepkeyConfig);

      // Persist the new API key via SKConfig after pairing
      if (keepkeyConfig.apiKey && keepkeyConfig.apiKey !== initialApiKey) {
        SKConfig.setApiKey("keepKey", keepkeyConfig.apiKey);
      }

      await Promise.all(
        filteredChains.map(async (chain) => {
          const walletMethods = await getWalletMethods({
            chain,
            derivationPath: derivationPathMap?.[chain] || NetworkDerivationPath[chain],
            sdk: keepKeySdk,
          });
          const address = (await walletMethods.getAddress()) || "";

          addChain({ ...walletMethods, address, chain, walletType: WalletOption.KEEPKEY });
        }),
      );
      return true;
    },
  name: "connectKeepkey",
  supportedChains: [
    // EVM Chains (all use secp256k1 + m/44'/60'/0'/0/0)
    Chain.Arbitrum,
    Chain.Aurora,
    Chain.Avalanche,
    Chain.Base,
    Chain.Berachain,
    Chain.BinanceSmartChain,
    Chain.Botanix,
    Chain.Core,
    Chain.Corn,
    Chain.Cronos,
    Chain.Ethereum,
    Chain.Gnosis,
    Chain.Hyperevm,
    Chain.Litecoin,
    Chain.Monad,
    Chain.Ripple,
    Chain.Optimism,
    Chain.Polygon,
    Chain.Sonic,
    Chain.Unichain,
    Chain.XLayer,
    // UTXO Chains
    Chain.Bitcoin,
    Chain.BitcoinCash,
    Chain.Dash,
    Chain.Dogecoin,
    Chain.Litecoin,
    // Cosmos Chains
    Chain.Cosmos,
    Chain.Maya,
    Chain.THORChain,
    // Other Chains
    Chain.Ripple,
  ],
  walletType: WalletOption.KEEPKEY,
});

export const KEEPKEY_SUPPORTED_CHAINS = getWalletSupportedChains(keepkeyWallet);

async function getWalletMethods({
  sdk,
  chain,
  derivationPath,
}: {
  sdk: KeepKeySdk;
  chain: Chain;
  derivationPath?: DerivationPathArray;
}) {
  const { getProvider, getEvmToolbox } = await import("@swapkit/toolboxes/evm");

  switch (chain) {
    // All EVM chains use the same signing flow
    case Chain.Arbitrum:
    case Chain.Aurora:
    case Chain.Avalanche:
    case Chain.Base:
    case Chain.Berachain:
    case Chain.BinanceSmartChain:
    case Chain.Botanix:
    case Chain.Core:
    case Chain.Corn:
    case Chain.Cronos:
    case Chain.Ethereum:
    case Chain.Gnosis:
    case Chain.Hyperevm:
    case Chain.Monad:
    case Chain.Optimism:
    case Chain.Polygon:
    case Chain.Sonic:
    case Chain.Unichain:
    case Chain.XLayer: {
      const provider = await getProvider(chain);
      const signer = new KeepKeySigner({ chain, derivationPath, provider, sdk });
      const toolbox = await getEvmToolbox(chain, { provider, signer });

      return toolbox;
    }
    case Chain.Cosmos: {
      return cosmosWalletMethods({ derivationPath, sdk });
    }
    case Chain.THORChain: {
      return thorchainWalletMethods({ derivationPath, sdk });
    }
    case Chain.Maya: {
      return mayachainWalletMethods({ derivationPath, sdk });
    }
    case Chain.Bitcoin:
    case Chain.BitcoinCash:
    case Chain.Dash:
    case Chain.Dogecoin:
    case Chain.Litecoin: {
      return utxoWalletMethods({ chain, derivationPath, sdk });
    }
    case Chain.Ripple: {
      const { rippleWalletMethods } = await import("./chains/ripple");
      return rippleWalletMethods({ derivationPath, sdk });
    }
    default:
      throw new SwapKitError("wallet_keepkey_chain_not_supported", { chain });
  }
}

// kk-sdk docs: https://keepkey.com/blog/building_on_the_keepkey_sdk
// test spec: if offline, launch keepkey-bridge
async function checkAndLaunch(attempts = 0) {
  if (attempts >= 3) {
    alert("KeepKey desktop is required for keepkey-sdk, please go to https://keepkey.com/get-started");
  }
  const isAvailable = await checkKeepkeyAvailability();

  if (!isAvailable) {
    window.location.assign("keepkey://launch");
    await new Promise((resolve) => setTimeout(resolve, 30000));
    await checkAndLaunch(attempts + 1);
  }
}

async function checkKeepkeyAvailability(spec = "http://localhost:1646/spec/swagger.json") {
  try {
    const response = await fetch(spec);
    return response.status === 200;
  } catch {
    return false;
  }
}
