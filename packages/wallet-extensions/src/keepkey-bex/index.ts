import { AssetValue, Chain, filterSupportedChains, SwapKitError, WalletOption } from "@swapkit/helpers";
import { createWallet, getWalletSupportedChains } from "@swapkit/wallet-core";
import type { Eip1193Provider } from "ethers";
import {
  getKEEPKEYAddress,
  getKEEPKEYMethods,
  getKEEPKEYProvider,
  getProviderNameFromChain,
  type WalletTxParams,
  walletTransfer,
} from "./walletHelpers";

export const keepkeyBexWallet = createWallet({
  connect: ({ addChain, supportedChains, walletType }) =>
    async function connectKeepkeyBex(chains: Chain[]) {
      const filteredChains = filterSupportedChains({ chains, supportedChains, walletType });

      // Sequential on purpose: parallel connects fire one BEX approval popup
      // per chain. Serially, the first EVM approval authorizes the site and
      // every later chain resolves silently via eth_accounts.
      // Per-chain failures are skipped (e.g. a BEX provider missing a method)
      // so one broken chain doesn't kill the whole multi-chain connect.
      let connected = 0;
      for (const chain of filteredChains) {
        try {
          const address = await getKEEPKEYAddress(chain);
          const walletMethods = await getWalletMethods(chain);

          addChain({ ...walletMethods, address, chain, walletType });
          connected++;
        } catch (error) {
          console.warn(`[keepkey-bex] skipping ${chain}: ${(error as Error)?.message}`);
        }
      }
      if (connected === 0) {
        throw new SwapKitError("wallet_keepkey_no_accounts");
      }

      return true;
    },
  name: "connectKeepkeyBex",
  supportedChains: [
    Chain.Arbitrum,
    Chain.Avalanche,
    Chain.BinanceSmartChain,
    Chain.Bitcoin,
    Chain.BitcoinCash,
    Chain.Base,
    Chain.Cosmos,
    Chain.Dash,
    Chain.Dogecoin,
    Chain.Ethereum,
    Chain.Litecoin,
    Chain.Maya,
    Chain.Optimism,
    Chain.Polygon,
    Chain.THORChain,
    Chain.XLayer,
  ],
  walletType: WalletOption.KEEPKEY_BEX,
});

export const KEEPKEY_BEX_SUPPORTED_CHAINS = getWalletSupportedChains(keepkeyBexWallet);

async function getWalletMethods(chain: (typeof KEEPKEY_BEX_SUPPORTED_CHAINS)[number]) {
  switch (chain) {
    case Chain.Maya:
    case Chain.THORChain: {
      const { getCosmosToolbox, THORCHAIN_GAS_VALUE, MAYA_GAS_VALUE } = await import("@swapkit/toolboxes/cosmos");

      const gasLimit = chain === Chain.Maya ? MAYA_GAS_VALUE : THORCHAIN_GAS_VALUE;
      const toolbox = await getCosmosToolbox(chain);

      return {
        ...toolbox,
        deposit: (tx: WalletTxParams) => walletTransfer({ ...tx, recipient: "" }, "deposit"),
        transfer: (tx: WalletTxParams) => walletTransfer({ ...tx, gasLimit }, "transfer"),
      };
    }

    case Chain.Cosmos: {
      const { getCosmosToolbox } = await import("@swapkit/toolboxes/cosmos");
      const toolbox = await getCosmosToolbox(chain);

      // The extension has no Keplr-style offline signer; signing happens
      // device-side via the provider's transfer method.
      return { ...toolbox, transfer: (tx: WalletTxParams) => walletTransfer(tx, "transfer") };
    }

    case Chain.Dash:
    case Chain.Bitcoin:
    case Chain.BitcoinCash:
    case Chain.Dogecoin:
    case Chain.Litecoin: {
      const { getUtxoToolbox } = await import("@swapkit/toolboxes/utxo");
      const toolbox = await getUtxoToolbox(chain);

      const getBalance = async () => {
        const providerChain = getProviderNameFromChain(chain);
        // @ts-expect-error We assuming there chains via switch
        const balance = await window?.keepkey?.[providerChain]?.request({ method: "request_balance" });
        const assetValue = AssetValue.from({ chain, value: balance[0].balance });
        return [assetValue];
      };

      return { ...toolbox, getBalance, transfer: walletTransfer };
    }

    case Chain.Ethereum:
    case Chain.BinanceSmartChain:
    case Chain.Base:
    case Chain.Arbitrum:
    case Chain.Optimism:
    case Chain.Polygon:
    case Chain.Avalanche:
    case Chain.XLayer: {
      const { prepareNetworkSwitch } = await import("@swapkit/helpers");
      const { getEvmToolbox } = await import("@swapkit/toolboxes/evm");
      const { BrowserProvider } = await import("ethers");
      const ethereumWindowProvider = getKEEPKEYProvider(chain) as Eip1193Provider;

      if (!ethereumWindowProvider) {
        throw new SwapKitError("wallet_keepkey_not_found");
      }

      const provider = new BrowserProvider(ethereumWindowProvider, "any");
      const signer = await provider.getSigner();
      const toolbox = await getEvmToolbox(chain, { provider, signer });
      const keepkeyMethods = getKEEPKEYMethods(provider, chain);

      // No network switch at connect time: reading an address needs no active
      // network, and connecting N EVM chains fired N switch requests at once —
      // the wallet answers -32002 (request pending) to all but the first, which
      // used to cascade into an "Add Network" prompt per chain. The methods
      // returned below are wrapped to switch on demand when we actually sign.
      return prepareNetworkSwitch({ chain, provider, toolbox: { ...toolbox, ...keepkeyMethods } });
    }

    default:
      return null;
  }
}
