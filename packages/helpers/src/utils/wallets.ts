import { type Chain, getChainConfig } from "@swapkit/types";
import type { BrowserProvider, JsonRpcProvider } from "ethers";
import { SwapKitError } from "../modules/swapKitError";
import {
  type EIP6963AnnounceProviderEvent,
  type EIP6963Provider,
  type EthereumWindowProvider,
  type NetworkParams,
  WalletOption,
} from "../types";
import { warnOnce } from "./others";

declare const window: {
  ethereum: EthereumWindowProvider;
  trustwallet: EthereumWindowProvider;
  coinbaseWalletExtension: EthereumWindowProvider;
  braveSolana: any;
  bitkeep?: { ethereum: EthereumWindowProvider };
  ctrl?: { ethereum: EthereumWindowProvider };
  $onekey?: { ethereum: EthereumWindowProvider };
  vultisig?: { ethereum: EthereumWindowProvider };
} & Window;

export function isWeb3Detected() {
  return typeof window.ethereum !== "undefined";
}

export function isDetected(walletOption: WalletOption) {
  return listWeb3EVMWallets().includes(walletOption);
}

export function listWeb3EVMWallets() {
  const metamaskEnabled = window?.ethereum && !window.ethereum?.isBraveWallet;
  const ctrlEnabled = window?.ctrl || window?.ethereum?.__XDEFI;
  const vultisigEnabled = window?.vultisig;
  const braveEnabled = window?.ethereum?.isBraveWallet;
  const trustEnabled = window?.ethereum?.isTrust || window?.trustwallet;
  const coinbaseEnabled =
    (window?.ethereum?.overrideIsMetaMask && window?.ethereum?.selectedProvider?.isCoinbaseWallet) ||
    window?.coinbaseWalletExtension;
  const bitgetEnabled = window?.bitkeep?.ethereum;
  const onekeyEnabled = window?.$onekey?.ethereum;

  const wallets = [];
  if (metamaskEnabled) wallets.push(WalletOption.METAMASK);
  if (ctrlEnabled) wallets.push(WalletOption.CTRL);
  if (vultisigEnabled) wallets.push(WalletOption.VULTISIG);
  if (braveEnabled) wallets.push(WalletOption.BRAVE);
  if (trustEnabled) wallets.push(WalletOption.TRUSTWALLET_WEB);
  if (coinbaseEnabled) wallets.push(WalletOption.COINBASE_WEB);
  if (okxMobileEnabled()) wallets.push(WalletOption.OKX_MOBILE);
  if (bitgetEnabled) wallets.push(WalletOption.BITGET);
  if (onekeyEnabled) wallets.push(WalletOption.ONEKEY);

  return wallets;
}

/** EIP-3326: the wallet does not recognize the chain, so it must be added first.
 *  Every other error means the chain IS known and the switch failed for another
 *  reason — 4001 (user rejected) or -32002 (a request is already pending). */
const CHAIN_NOT_ADDED = 4902;

/** True when the error — at any wrapping layer — is EIP-3326 code 4902.
 *  Provider errors arrive wrapped differently per transport, and the wrapper
 *  usually has its OWN truthy code that shadows the real one: ethers
 *  BrowserProvider throws code "UNKNOWN_ERROR" (string) with the numeric 4902
 *  nested at .error.code; MetaMask throws -32603 with it nested at
 *  .data.originalError.code. So a first-non-nullish lookup can never work —
 *  check every slot for 4902 instead. */
function isChainNotAddedError(error: unknown): boolean {
  const e = error as any;
  return [e?.code, e?.error?.code, e?.info?.error?.code, e?.data?.originalError?.code].includes(CHAIN_NOT_ADDED);
}

export async function switchEVMWalletNetwork(provider: BrowserProvider, chain: Chain, networkParams?: NetworkParams) {
  const chainConfig = getChainConfig(chain);

  try {
    await providerRequest({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainConfig.chainIdHex }],
      provider,
    });
  } catch (error) {
    // Only offer to add the network when the wallet says it doesn't have it.
    // Falling back on *any* error prompts "Add Network" for chains the user
    // already has — and turns a single rejection into a second prompt.
    if (!isChainNotAddedError(error)) {
      throw new SwapKitError("helpers_failed_to_switch_network", { error });
    }
    if (!networkParams) {
      throw new SwapKitError("helpers_failed_to_switch_network", {
        error: error,
        reason: "networkParams not provided",
      });
    }
    await addEVMWalletNetwork(provider, networkParams);
  }
}

export function filterSupportedChains<T extends string[]>({
  chains,
  supportedChains,
  walletType,
}: {
  chains: Chain[];
  supportedChains: T;
  walletType?: WalletOption;
}) {
  const supported = chains.filter((chain) => !chain || supportedChains.includes(chain));

  if (supported.length === 0) {
    throw new SwapKitError("wallet_chain_not_supported", { chain: chains.join(", "), wallet: walletType });
  }

  const unsupported = chains.filter((chain) => !supportedChains.includes(chain));

  warnOnce({
    condition: unsupported.length > 0,
    id: `wallet_chain_not_supported_${walletType}`,
    warning: `${walletType} wallet does not support the following chains: ${unsupported.join(
      ", ",
    )}. These chains will be ignored.`,
  });

  return supported as T;
}

export function wrapMethodWithNetworkSwitch<T extends (...args: any[]) => any>(
  func: T,
  provider: BrowserProvider,
  chain: Chain,
  networkParams?: NetworkParams,
) {
  return (async (...args: any[]) => {
    const { chainIdHex } = getChainConfig(chain);
    // Skipping the switch is only safe against a FRESH chain read.
    // provider.getNetwork() must not be used here: with "any"-network ethers it
    // returns the cached chainId after an external switch (another provider
    // over the same wallet, or the wallet UI), and eth_sendTransaction carries
    // no chainId — a stale skip signs on whatever chain the wallet is actually
    // on. eth_chainId goes straight to the wallet on every call.
    // Compare numerically: eth_chainId is hex, chainIdHex is hex, but wallets
    // vary in padding/case — Number() normalizes both.
    try {
      const current = Number(await provider.send("eth_chainId", []));
      if (current === Number(chainIdHex)) {
        return func(...args);
      }
    } catch (_error) {
      // Can't read the current chain — fall through and attempt the switch.
    }
    try {
      // networkParams lets the wallet add the chain if it genuinely lacks it —
      // this used to happen eagerly at connect time.
      await switchEVMWalletNetwork(provider, chain, networkParams);
    } catch (error) {
      throw new SwapKitError({ errorKey: "helpers_failed_to_switch_network", info: { error } });
    }
    return func(...args);
  }) as unknown as T;
}

export function prepareNetworkSwitch<T extends Record<string, unknown>, M extends keyof T>({
  toolbox,
  chain,
  provider = window.ethereum,
  methodNames = [],
}: {
  toolbox: T;
  chain: Chain;
  provider?: BrowserProvider | JsonRpcProvider;
  methodNames?: M[];
}) {
  const methodsToWrap = [
    ...methodNames,
    "approve",
    "approvedAmount",
    "call",
    "sendTransaction",
    "transfer",
    "isApproved",
    "approvedAmount",
    "EIP1193SendTransaction",
    "getFeeData",
    "broadcastTransaction",
    "estimateCall",
    "estimateGasLimit",
    "estimateGasPrices",
    "createContractTxObject",
  ] as M[];
  // The toolbox knows its own network params; pass them down so an on-demand
  // switch can add the chain if the wallet doesn't have it yet.
  const getNetworkParams = toolbox.getNetworkParams;
  const networkParams = typeof getNetworkParams === "function" ? (getNetworkParams() as NetworkParams) : undefined;

  const wrappedMethods = methodsToWrap.reduce((object, methodName) => {
    if (!toolbox[methodName]) return object;

    const method = toolbox[methodName];

    if (typeof method !== "function") return object;

    // @ts-expect-error
    const wrappedMethod = wrapMethodWithNetworkSwitch(method, provider, chain, networkParams);

    // biome-ignore lint/performance/noAccumulatingSpread: valid use case
    return { ...object, [methodName]: wrappedMethod };
  }, {});

  return { ...toolbox, ...wrappedMethods };
}

export function addEVMWalletNetwork(provider: BrowserProvider, networkParams: NetworkParams) {
  return providerRequest({ method: "wallet_addEthereumChain", params: [networkParams], provider });
}

export function addAccountsChangedCallback(callback: () => void) {
  window.ethereum?.on("accountsChanged", () => callback());
  window.ctrl?.ethereum.on("accountsChanged", () => callback());
}

export function getETHDefaultWallet() {
  const { isTrust, isBraveWallet, __XDEFI, overrideIsMetaMask, selectedProvider } = window?.ethereum || {};
  if (isTrust) return WalletOption.TRUSTWALLET_WEB;
  if (isBraveWallet) return WalletOption.BRAVE;
  if (overrideIsMetaMask && selectedProvider?.isCoinbaseWallet) return WalletOption.COINBASE_WEB;
  if (__XDEFI) return WalletOption.CTRL;
  if (window?.$onekey?.ethereum) return WalletOption.ONEKEY;
  return WalletOption.METAMASK;
}

export function getEIP6963Wallets() {
  const providers: EIP6963Provider[] = [];

  function onAnnouncement(event: EIP6963AnnounceProviderEvent) {
    if (providers.map((p) => p.info.uuid).includes(event.detail.info.uuid)) return;
    providers.push(event.detail);
  }

  window.addEventListener("eip6963:announceProvider", onAnnouncement);
  window.dispatchEvent(new Event("eip6963:requestProvider"));

  function removeEIP6963EventListener() {
    window.removeEventListener("eip6963:announceProvider", onAnnouncement);
  }

  return { providers, removeEIP6963EventListener };
}

export function okxMobileEnabled() {
  const ua = navigator.userAgent;
  const isIOS = /iphone|ipad|ipod|ios/i.test(ua);
  const isAndroid = /android|XiaoMi|MiuiBrowser/i.test(ua);
  const isMobile = isIOS || isAndroid;
  const isOKApp = /OKApp/i.test(ua);

  return isMobile && isOKApp;
}

export function providerRequest({
  provider,
  params,
  method,
}: {
  provider?: BrowserProvider;
  params?: any;
  method:
    | "wallet_addEthereumChain"
    | "wallet_switchEthereumChain"
    | "eth_requestAccounts"
    | "eth_sendTransaction"
    | "eth_signTransaction";
}) {
  if (!provider?.send) {
    throw new SwapKitError("helpers_not_found_provider");
  }

  const providerParams = params ? (Array.isArray(params) ? params : [params]) : [];
  return provider.send(method, providerParams);
}
