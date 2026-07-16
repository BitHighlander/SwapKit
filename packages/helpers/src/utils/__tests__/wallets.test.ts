// @ts-nocheck - Test file with intentional mocking of browser globals and ethers types
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { Chain } from "@swapkit/types";

import { SwapKitError } from "../../modules/swapKitError";
import { WalletOption } from "../../types";
import {
  addAccountsChangedCallback,
  addEVMWalletNetwork,
  filterSupportedChains,
  getEIP6963Wallets,
  getETHDefaultWallet,
  isDetected,
  isWeb3Detected,
  listWeb3EVMWallets,
  okxMobileEnabled,
  prepareNetworkSwitch,
  providerRequest,
  switchEVMWalletNetwork,
  wrapMethodWithNetworkSwitch,
} from "../wallets";

// Store original globals
const originalWindow = globalThis.window;
const originalNavigator = globalThis.navigator;

function createMockWindow(overrides: Record<string, any> = {}) {
  return {
    $onekey: undefined,
    addEventListener: mock(() => {}),
    bitkeep: undefined,
    braveSolana: undefined,
    coinbaseWalletExtension: undefined,
    ctrl: undefined,
    dispatchEvent: mock(() => true),
    ethereum: undefined,
    removeEventListener: mock(() => {}),
    trustwallet: undefined,
    vultisig: undefined,
    ...overrides,
  };
}

function createMockEthereumProvider(overrides: Record<string, any> = {}) {
  return { on: mock(() => {}), removeListener: mock(() => {}), request: mock(() => Promise.resolve()), ...overrides };
}

function createMockBrowserProvider(overrides: Record<string, any> = {}) {
  return {
    getNetwork: mock(() => Promise.resolve({ chainId: BigInt(1) })),
    send: mock(() => Promise.resolve()),
    ...overrides,
  };
}

describe("wallets", () => {
  beforeEach(() => {
    globalThis.window = createMockWindow();
    globalThis.navigator = { userAgent: "Mozilla/5.0" };
  });

  afterEach(() => {
    globalThis.window = originalWindow;
    globalThis.navigator = originalNavigator;
  });

  describe("isWeb3Detected", () => {
    test("returns false when window.ethereum is undefined", () => {
      expect(isWeb3Detected()).toBe(false);
    });

    test("returns true when window.ethereum is defined", () => {
      globalThis.window.ethereum = createMockEthereumProvider();
      expect(isWeb3Detected()).toBe(true);
    });
  });

  describe("listWeb3EVMWallets", () => {
    test("returns empty array when no wallets detected", () => {
      expect(listWeb3EVMWallets()).toEqual([]);
    });

    test("detects MetaMask wallet", () => {
      globalThis.window.ethereum = createMockEthereumProvider({ isBraveWallet: false });
      expect(listWeb3EVMWallets()).toContain(WalletOption.METAMASK);
    });

    test("detects Brave wallet", () => {
      globalThis.window.ethereum = createMockEthereumProvider({ isBraveWallet: true });
      const wallets = listWeb3EVMWallets();
      expect(wallets).toContain(WalletOption.BRAVE);
      expect(wallets).not.toContain(WalletOption.METAMASK);
    });

    test("detects Trust wallet via isTrust", () => {
      globalThis.window.ethereum = createMockEthereumProvider({ isTrust: true });
      expect(listWeb3EVMWallets()).toContain(WalletOption.TRUSTWALLET_WEB);
    });

    test("detects Trust wallet via window.trustwallet", () => {
      globalThis.window.trustwallet = createMockEthereumProvider();
      expect(listWeb3EVMWallets()).toContain(WalletOption.TRUSTWALLET_WEB);
    });

    test("detects Coinbase wallet via selectedProvider", () => {
      globalThis.window.ethereum = createMockEthereumProvider({
        overrideIsMetaMask: true,
        selectedProvider: { isCoinbaseWallet: true },
      });
      expect(listWeb3EVMWallets()).toContain(WalletOption.COINBASE_WEB);
    });

    test("detects Coinbase wallet via coinbaseWalletExtension", () => {
      globalThis.window.coinbaseWalletExtension = createMockEthereumProvider();
      expect(listWeb3EVMWallets()).toContain(WalletOption.COINBASE_WEB);
    });

    test("detects CTRL wallet via window.ctrl", () => {
      globalThis.window.ctrl = { ethereum: createMockEthereumProvider() };
      expect(listWeb3EVMWallets()).toContain(WalletOption.CTRL);
    });

    test("detects CTRL wallet via __XDEFI flag", () => {
      globalThis.window.ethereum = createMockEthereumProvider({ __XDEFI: true });
      expect(listWeb3EVMWallets()).toContain(WalletOption.CTRL);
    });

    test("detects Vultisig wallet", () => {
      globalThis.window.vultisig = { ethereum: createMockEthereumProvider() };
      expect(listWeb3EVMWallets()).toContain(WalletOption.VULTISIG);
    });

    test("detects Bitget wallet", () => {
      globalThis.window.bitkeep = { ethereum: createMockEthereumProvider() };
      expect(listWeb3EVMWallets()).toContain(WalletOption.BITGET);
    });

    test("detects OneKey wallet", () => {
      globalThis.window.$onekey = { ethereum: createMockEthereumProvider() };
      expect(listWeb3EVMWallets()).toContain(WalletOption.ONEKEY);
    });

    test("detects multiple wallets simultaneously", () => {
      globalThis.window.ethereum = createMockEthereumProvider({ isBraveWallet: false });
      globalThis.window.vultisig = { ethereum: createMockEthereumProvider() };
      globalThis.window.bitkeep = { ethereum: createMockEthereumProvider() };

      const wallets = listWeb3EVMWallets();
      expect(wallets).toContain(WalletOption.METAMASK);
      expect(wallets).toContain(WalletOption.VULTISIG);
      expect(wallets).toContain(WalletOption.BITGET);
    });
  });

  describe("isDetected", () => {
    test("returns true for detected wallet", () => {
      globalThis.window.ethereum = createMockEthereumProvider({ isBraveWallet: true });
      expect(isDetected(WalletOption.BRAVE)).toBe(true);
    });

    test("returns false for undetected wallet", () => {
      expect(isDetected(WalletOption.METAMASK)).toBe(false);
    });
  });

  describe("getETHDefaultWallet", () => {
    test("returns METAMASK as default when no specific wallet detected", () => {
      globalThis.window.ethereum = createMockEthereumProvider();
      expect(getETHDefaultWallet()).toBe(WalletOption.METAMASK);
    });

    test("returns TRUSTWALLET_WEB when isTrust is true", () => {
      globalThis.window.ethereum = createMockEthereumProvider({ isTrust: true });
      expect(getETHDefaultWallet()).toBe(WalletOption.TRUSTWALLET_WEB);
    });

    test("returns BRAVE when isBraveWallet is true", () => {
      globalThis.window.ethereum = createMockEthereumProvider({ isBraveWallet: true });
      expect(getETHDefaultWallet()).toBe(WalletOption.BRAVE);
    });

    test("returns COINBASE_WEB when coinbase provider is selected", () => {
      globalThis.window.ethereum = createMockEthereumProvider({
        overrideIsMetaMask: true,
        selectedProvider: { isCoinbaseWallet: true },
      });
      expect(getETHDefaultWallet()).toBe(WalletOption.COINBASE_WEB);
    });

    test("returns CTRL when __XDEFI is true", () => {
      globalThis.window.ethereum = createMockEthereumProvider({ __XDEFI: true });
      expect(getETHDefaultWallet()).toBe(WalletOption.CTRL);
    });

    test("returns ONEKEY when $onekey.ethereum is present", () => {
      globalThis.window.$onekey = { ethereum: createMockEthereumProvider() };
      expect(getETHDefaultWallet()).toBe(WalletOption.ONEKEY);
    });

    test("returns METAMASK when window.ethereum is undefined", () => {
      expect(getETHDefaultWallet()).toBe(WalletOption.METAMASK);
    });

    test("priority: isTrust takes precedence over other flags", () => {
      globalThis.window.ethereum = createMockEthereumProvider({ __XDEFI: true, isBraveWallet: true, isTrust: true });
      expect(getETHDefaultWallet()).toBe(WalletOption.TRUSTWALLET_WEB);
    });

    test("priority: isBraveWallet takes precedence over __XDEFI", () => {
      globalThis.window.ethereum = createMockEthereumProvider({ __XDEFI: true, isBraveWallet: true });
      expect(getETHDefaultWallet()).toBe(WalletOption.BRAVE);
    });
  });

  describe("okxMobileEnabled", () => {
    test("returns false for desktop browser", () => {
      globalThis.navigator = { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" };
      expect(okxMobileEnabled()).toBe(false);
    });

    test("returns false for mobile without OKApp", () => {
      globalThis.navigator = { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0)" };
      expect(okxMobileEnabled()).toBe(false);
    });

    test("returns true for iOS OKApp", () => {
      globalThis.navigator = { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0) OKApp" };
      expect(okxMobileEnabled()).toBe(true);
    });

    test("returns true for iPad OKApp", () => {
      globalThis.navigator = { userAgent: "Mozilla/5.0 (iPad; CPU OS 14_0) OKApp" };
      expect(okxMobileEnabled()).toBe(true);
    });

    test("returns true for iPod OKApp", () => {
      globalThis.navigator = { userAgent: "Mozilla/5.0 (iPod touch; CPU iPhone OS 14_0) OKApp" };
      expect(okxMobileEnabled()).toBe(true);
    });

    test("returns true for Android OKApp", () => {
      globalThis.navigator = { userAgent: "Mozilla/5.0 (Linux; Android 10) OKApp" };
      expect(okxMobileEnabled()).toBe(true);
    });

    test("returns true for XiaoMi OKApp", () => {
      globalThis.navigator = { userAgent: "Mozilla/5.0 (Linux; XiaoMi) OKApp" };
      expect(okxMobileEnabled()).toBe(true);
    });

    test("returns true for MiuiBrowser OKApp", () => {
      globalThis.navigator = { userAgent: "Mozilla/5.0 (Linux; MiuiBrowser) OKApp" };
      expect(okxMobileEnabled()).toBe(true);
    });

    test("returns false for OKApp on desktop (not mobile)", () => {
      globalThis.navigator = { userAgent: "Mozilla/5.0 (Windows NT 10.0) OKApp" };
      expect(okxMobileEnabled()).toBe(false);
    });

    test("case insensitive OKApp detection", () => {
      globalThis.navigator = { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0) okapp" };
      expect(okxMobileEnabled()).toBe(true);
    });
  });

  describe("providerRequest", () => {
    test("throws error when provider is undefined", () => {
      expect(() => providerRequest({ method: "eth_requestAccounts" })).toThrow(SwapKitError);
    });

    test("throws error when provider.send is undefined", () => {
      expect(() => providerRequest({ method: "eth_requestAccounts", provider: {} })).toThrow(SwapKitError);
    });

    test("calls provider.send with method and empty params when no params provided", () => {
      const mockSend = mock(() => Promise.resolve("result"));
      const provider = createMockBrowserProvider({ send: mockSend });

      providerRequest({ method: "eth_requestAccounts", provider });

      expect(mockSend).toHaveBeenCalledWith("eth_requestAccounts", []);
    });

    test("calls provider.send with array params", () => {
      const mockSend = mock(() => Promise.resolve("result"));
      const provider = createMockBrowserProvider({ send: mockSend });

      providerRequest({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x1" }], provider });

      expect(mockSend).toHaveBeenCalledWith("wallet_switchEthereumChain", [{ chainId: "0x1" }]);
    });

    test("wraps non-array params in array", () => {
      const mockSend = mock(() => Promise.resolve("result"));
      const provider = createMockBrowserProvider({ send: mockSend });

      providerRequest({ method: "wallet_addEthereumChain", params: { chainId: "0x1" }, provider });

      expect(mockSend).toHaveBeenCalledWith("wallet_addEthereumChain", [{ chainId: "0x1" }]);
    });
  });

  describe("addEVMWalletNetwork", () => {
    test("calls providerRequest with wallet_addEthereumChain", () => {
      const mockSend = mock(() => Promise.resolve());
      const provider = createMockBrowserProvider({ send: mockSend });
      const networkParams = {
        chainId: "0x89",
        chainName: "Polygon",
        nativeCurrency: { decimals: 18, name: "MATIC", symbol: "MATIC" },
        rpcUrls: ["https://polygon-rpc.com"],
      };

      addEVMWalletNetwork(provider, networkParams);

      expect(mockSend).toHaveBeenCalledWith("wallet_addEthereumChain", [networkParams]);
    });
  });

  describe("switchEVMWalletNetwork", () => {
    test("calls wallet_switchEthereumChain with chain config", async () => {
      const mockSend = mock(() => Promise.resolve());
      const provider = createMockBrowserProvider({ send: mockSend });

      await switchEVMWalletNetwork(provider, Chain.Ethereum);

      expect(mockSend).toHaveBeenCalledWith("wallet_switchEthereumChain", [{ chainId: "0x1" }]);
    });

    const polygonNetworkParams = {
      chainId: "0x89",
      chainName: "Polygon",
      nativeCurrency: { decimals: 18, name: "MATIC", symbol: "MATIC" },
      rpcUrls: ["https://polygon-rpc.com"],
    };

    /** 4902 = wallet doesn't know the chain, so adding it is the right move. */
    test("adds network when switch fails with 4902 and networkParams provided", async () => {
      const mockSend = mock()
        .mockImplementationOnce(() => Promise.reject(Object.assign(new Error("Unrecognized chain ID"), { code: 4902 })))
        .mockImplementationOnce(() => Promise.resolve());

      const provider = createMockBrowserProvider({ send: mockSend });

      await switchEVMWalletNetwork(provider, Chain.Polygon, polygonNetworkParams);

      expect(mockSend).toHaveBeenCalledTimes(2);
      expect(mockSend).toHaveBeenLastCalledWith("wallet_addEthereumChain", [polygonNetworkParams]);
    });

    test("finds the 4902 code inside a real ethers wrapper (top-level code is the string UNKNOWN_ERROR)", async () => {
      // Real ethers v6 shape: BrowserProvider wraps the EIP-1193 rejection as
      // makeError("could not coalesce error", "UNKNOWN_ERROR", { error, payload })
      // — the TOP-LEVEL code is always the truthy string "UNKNOWN_ERROR" and the
      // numeric 4902 only exists nested at .error.code. A first-non-nullish
      // lookup short-circuits on the wrapper string and misses it.
      const mockSend = mock()
        .mockImplementationOnce(() =>
          Promise.reject(
            Object.assign(new Error("could not coalesce error"), {
              code: "UNKNOWN_ERROR",
              error: { code: 4902, message: "Unrecognized chain ID" },
            }),
          ),
        )
        .mockImplementationOnce(() => Promise.resolve());

      const provider = createMockBrowserProvider({ send: mockSend });

      await switchEVMWalletNetwork(provider, Chain.Polygon, polygonNetworkParams);

      expect(mockSend).toHaveBeenLastCalledWith("wallet_addEthereumChain", [polygonNetworkParams]);
    });

    test("finds the 4902 code in MetaMask's -32603/data.originalError wrapper", async () => {
      const mockSend = mock()
        .mockImplementationOnce(() =>
          Promise.reject(
            Object.assign(new Error("Internal JSON-RPC error."), {
              code: -32603,
              data: { originalError: { code: 4902, message: "Unrecognized chain ID" } },
            }),
          ),
        )
        .mockImplementationOnce(() => Promise.resolve());

      const provider = createMockBrowserProvider({ send: mockSend });

      await switchEVMWalletNetwork(provider, Chain.Polygon, polygonNetworkParams);

      expect(mockSend).toHaveBeenLastCalledWith("wallet_addEthereumChain", [polygonNetworkParams]);
    });

    test("integration: a REAL ethers BrowserProvider wrapping a 4902 rejection still triggers add-network", async () => {
      // The mocks above assert the shapes we believe ethers produces; this test
      // asserts against ethers itself so mock drift can't hide a regression.
      const { BrowserProvider } = await import("ethers");
      const requests: string[] = [];
      const eip1193 = {
        request: ({ method }: { method: string }) => {
          requests.push(method);
          if (method === "eth_chainId") return Promise.resolve("0x1");
          if (method === "wallet_switchEthereumChain") {
            return Promise.reject(Object.assign(new Error("Unrecognized chain ID 0x89"), { code: 4902 }));
          }
          return Promise.resolve(null);
        },
      };
      const provider = new BrowserProvider(eip1193, "any");

      await switchEVMWalletNetwork(provider, Chain.Polygon, polygonNetworkParams);

      expect(requests).toContain("wallet_addEthereumChain");
    });

    // Regression: any non-4902 error used to trigger an "Add Network" prompt for
    // a chain the user already had. 4001 = user rejected, -32002 = request pending.
    test.each([
      ["user rejected the switch", 4001],
      ["a request is already pending", -32002],
    ])("does not add the network when %s", async (_label, code) => {
      const mockSend = mock(() => Promise.reject(Object.assign(new Error("switch failed"), { code })));
      const provider = createMockBrowserProvider({ send: mockSend });

      await expect(switchEVMWalletNetwork(provider, Chain.Polygon, polygonNetworkParams)).rejects.toThrow(SwapKitError);

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).not.toHaveBeenCalledWith("wallet_addEthereumChain", expect.anything());
    });

    test("throws error when switch fails with 4902 and no networkParams provided", async () => {
      const mockSend = mock(() => Promise.reject(Object.assign(new Error("Chain not found"), { code: 4902 })));
      const provider = createMockBrowserProvider({ send: mockSend });

      await expect(switchEVMWalletNetwork(provider, Chain.Ethereum)).rejects.toThrow(SwapKitError);
    });
  });

  describe("filterSupportedChains", () => {
    test("returns supported chains only", () => {
      const result = filterSupportedChains({
        chains: [Chain.Ethereum, Chain.Bitcoin, Chain.Avalanche],
        supportedChains: [Chain.Ethereum, Chain.Avalanche],
      });

      expect(result).toEqual([Chain.Ethereum, Chain.Avalanche]);
    });

    test("throws error when no chains are supported", () => {
      expect(() =>
        filterSupportedChains({
          chains: [Chain.Bitcoin],
          supportedChains: [Chain.Ethereum],
          walletType: WalletOption.METAMASK,
        }),
      ).toThrow(SwapKitError);
    });

    test("handles empty chains array", () => {
      expect(() => filterSupportedChains({ chains: [], supportedChains: [Chain.Ethereum] })).toThrow(SwapKitError);
    });

    test("warns about unsupported chains but returns supported ones", () => {
      const result = filterSupportedChains({
        chains: [Chain.Ethereum, Chain.Bitcoin],
        supportedChains: [Chain.Ethereum],
        walletType: WalletOption.METAMASK,
      });

      expect(result).toEqual([Chain.Ethereum]);
    });
  });

  describe("wrapMethodWithNetworkSwitch", () => {
    // The guard reads eth_chainId FRESH via provider.send — never getNetwork(),
    // whose "any"-network cache returns the pre-switch chain after an external
    // change, silently signing on the wrong chain.
    const sendOnChain = (currentChainIdHex: string) =>
      mock((method: string) => (method === "eth_chainId" ? Promise.resolve(currentChainIdHex) : Promise.resolve()));

    test("calls original function directly when network already matches (no switch needed)", async () => {
      const originalFunc = mock(() => Promise.resolve("result"));
      const mockSend = sendOnChain("0x1");
      const provider = createMockBrowserProvider({ send: mockSend });

      const wrapped = wrapMethodWithNetworkSwitch(originalFunc, provider, Chain.Ethereum);
      const result = await wrapped("arg1", "arg2");

      expect(mockSend).toHaveBeenCalledWith("eth_chainId", []);
      expect(mockSend).not.toHaveBeenCalledWith("wallet_switchEthereumChain", expect.anything());
      expect(originalFunc).toHaveBeenCalledWith("arg1", "arg2");
      expect(result).toBe("result");
    });

    test("does not consult the cached getNetwork() — the chain read must be fresh", async () => {
      const originalFunc = mock(() => Promise.resolve("result"));
      const getNetwork = mock(() => Promise.resolve({ chainId: 1n })); // stale cache says Ethereum
      const mockSend = sendOnChain("0x89"); // wallet is actually on Polygon
      const provider = createMockBrowserProvider({ getNetwork, send: mockSend });

      const wrapped = wrapMethodWithNetworkSwitch(originalFunc, provider, Chain.Ethereum);
      await wrapped();

      expect(getNetwork).not.toHaveBeenCalled();
      expect(mockSend).toHaveBeenCalledWith("wallet_switchEthereumChain", [{ chainId: "0x1" }]);
    });

    test("switches network before calling function when network differs", async () => {
      const originalFunc = mock(() => Promise.resolve("result"));
      const mockSend = sendOnChain("0x89"); // on Polygon, asking for Ethereum
      const provider = createMockBrowserProvider({ send: mockSend });

      const wrapped = wrapMethodWithNetworkSwitch(originalFunc, provider, Chain.Ethereum);
      await wrapped();

      expect(mockSend).toHaveBeenCalledWith("wallet_switchEthereumChain", [{ chainId: "0x1" }]);
      expect(originalFunc).toHaveBeenCalled();
    });

    test("throws SwapKitError when network switch fails", async () => {
      const originalFunc = mock(() => Promise.resolve("result"));
      const mockSend = mock((method: string) =>
        method === "eth_chainId"
          ? Promise.resolve("0x89") // on Polygon, different from Ethereum
          : Promise.reject(Object.assign(new Error("User rejected"), { code: 4001 })),
      );
      const provider = createMockBrowserProvider({ send: mockSend });

      const wrapped = wrapMethodWithNetworkSwitch(originalFunc, provider, Chain.Ethereum);

      await expect(wrapped()).rejects.toThrow(SwapKitError);
    });

    test("preserves function return value after network switch", async () => {
      const originalFunc = mock(() => Promise.resolve({ txHash: "0xabc123" }));
      const provider = createMockBrowserProvider({ send: sendOnChain("0x38") }); // on BSC, asking for Ethereum

      const wrapped = wrapMethodWithNetworkSwitch(originalFunc, provider, Chain.Ethereum);
      const result = await wrapped();

      expect(result).toEqual({ txHash: "0xabc123" });
    });

    // Regression: after the connect-time switch was removed, the on-demand wrap
    // is the ONLY remaining path that can add a missing network — it must thread
    // the toolbox's networkParams all the way into wallet_addEthereumChain.
    test("adds a missing network on demand using the toolbox's networkParams", async () => {
      const networkParams = {
        chainId: "0x89",
        chainName: "Polygon",
        nativeCurrency: { decimals: 18, name: "POL", symbol: "POL" },
        rpcUrls: ["https://polygon-rpc.com"],
      };
      const transfer = mock(() => Promise.resolve("0xtxhash"));
      const mockSend = mock((method: string) => {
        if (method === "eth_chainId") return Promise.resolve("0x1"); // wallet on Ethereum
        if (method === "wallet_switchEthereumChain") {
          // real ethers wrapper shape for an unknown chain
          return Promise.reject(
            Object.assign(new Error("could not coalesce error"), {
              code: "UNKNOWN_ERROR",
              error: { code: 4902, message: "Unrecognized chain ID" },
            }),
          );
        }
        return Promise.resolve();
      });
      const provider = createMockBrowserProvider({ send: mockSend });

      const toolbox = { getNetworkParams: () => networkParams, transfer };
      const wrapped = prepareNetworkSwitch({ chain: Chain.Polygon, provider, toolbox });

      const result = await wrapped.transfer();

      expect(mockSend).toHaveBeenCalledWith("wallet_addEthereumChain", [networkParams]);
      expect(transfer).toHaveBeenCalled();
      expect(result).toBe("0xtxhash");
    });
  });

  describe("prepareNetworkSwitch", () => {
    test("wraps standard EVM methods", () => {
      const mockSend = mock(() => Promise.resolve());
      const mockChainId = { toString: () => "0x1" };
      const provider = createMockBrowserProvider({
        getNetwork: mock(() => Promise.resolve({ chainId: mockChainId })),
        send: mockSend,
      });

      const toolbox = {
        approve: mock(() => Promise.resolve()),
        nonWrappedMethod: mock(() => Promise.resolve()),
        sendTransaction: mock(() => Promise.resolve()),
        transfer: mock(() => Promise.resolve()),
      };

      const result = prepareNetworkSwitch({ chain: Chain.Ethereum, provider, toolbox });

      // Wrapped methods should be different from original
      expect(result.transfer).not.toBe(toolbox.transfer);
      expect(result.approve).not.toBe(toolbox.approve);
      expect(result.sendTransaction).not.toBe(toolbox.sendTransaction);
      // Non-standard methods should remain unchanged
      expect(result.nonWrappedMethod).toBe(toolbox.nonWrappedMethod);
    });

    test("wraps custom method names", () => {
      const mockChainId = { toString: () => "0x1" };
      const provider = createMockBrowserProvider({ getNetwork: mock(() => Promise.resolve({ chainId: mockChainId })) });

      const toolbox = { anotherMethod: mock(() => Promise.resolve()), customMethod: mock(() => Promise.resolve()) };

      const result = prepareNetworkSwitch({ chain: Chain.Ethereum, methodNames: ["customMethod"], provider, toolbox });

      expect(result.customMethod).not.toBe(toolbox.customMethod);
      expect(result.anotherMethod).toBe(toolbox.anotherMethod);
    });

    test("skips non-function properties", () => {
      const mockChainId = { toString: () => "0x1" };
      const provider = createMockBrowserProvider({ getNetwork: mock(() => Promise.resolve({ chainId: mockChainId })) });

      const toolbox = { someNumber: 42, someValue: "not a function", transfer: mock(() => Promise.resolve()) };

      const result = prepareNetworkSwitch({ chain: Chain.Ethereum, provider, toolbox });

      expect(result.someValue).toBe("not a function");
      expect(result.someNumber).toBe(42);
    });

    test("skips undefined methods in toolbox", () => {
      const mockChainId = { toString: () => "0x1" };
      const provider = createMockBrowserProvider({ getNetwork: mock(() => Promise.resolve({ chainId: mockChainId })) });

      const toolbox = {
        transfer: mock(() => Promise.resolve()),
        // approve is not defined
      };

      const result = prepareNetworkSwitch({ chain: Chain.Ethereum, provider, toolbox });

      expect(result.transfer).toBeDefined();
      expect(result.approve).toBeUndefined();
    });
  });

  describe("addAccountsChangedCallback", () => {
    test("registers callback on window.ethereum", () => {
      const mockOn = mock(() => {});
      globalThis.window.ethereum = createMockEthereumProvider({ on: mockOn });

      const callback = mock(() => {});
      addAccountsChangedCallback(callback);

      expect(mockOn).toHaveBeenCalledWith("accountsChanged", expect.any(Function));
    });

    test("executes callback when ethereum accounts change", () => {
      let capturedHandler: (() => void) | undefined;
      const mockOn = mock((event: string, handler: () => void) => {
        if (event === "accountsChanged") capturedHandler = handler;
      });
      globalThis.window.ethereum = createMockEthereumProvider({ on: mockOn });

      const callback = mock(() => {});
      addAccountsChangedCallback(callback);

      // Simulate account change event
      capturedHandler?.();

      expect(callback).toHaveBeenCalled();
    });

    test("registers callback on window.ctrl.ethereum", () => {
      const mockOnEthereum = mock(() => {});
      const mockOnCtrl = mock(() => {});
      globalThis.window.ethereum = createMockEthereumProvider({ on: mockOnEthereum });
      globalThis.window.ctrl = { ethereum: createMockEthereumProvider({ on: mockOnCtrl }) };

      const callback = mock(() => {});
      addAccountsChangedCallback(callback);

      expect(mockOnEthereum).toHaveBeenCalledWith("accountsChanged", expect.any(Function));
      expect(mockOnCtrl).toHaveBeenCalledWith("accountsChanged", expect.any(Function));
    });

    test("executes callback when ctrl accounts change", () => {
      let capturedHandler: (() => void) | undefined;
      globalThis.window.ethereum = createMockEthereumProvider({ on: mock(() => {}) });
      globalThis.window.ctrl = {
        ethereum: createMockEthereumProvider({
          on: mock((event: string, handler: () => void) => {
            if (event === "accountsChanged") capturedHandler = handler;
          }),
        }),
      };

      const callback = mock(() => {});
      addAccountsChangedCallback(callback);

      // Simulate account change event from ctrl
      capturedHandler?.();

      expect(callback).toHaveBeenCalled();
    });

    test("handles missing ethereum providers gracefully", () => {
      globalThis.window = { ...createMockWindow(), ctrl: undefined, ethereum: undefined };

      const callback = mock(() => {});
      // Should not throw when providers are undefined
      expect(() => addAccountsChangedCallback(callback)).not.toThrow();
    });
  });

  describe("getEIP6963Wallets", () => {
    test("sets up event listener and dispatches request", () => {
      const mockAddEventListener = mock(() => {});
      const mockDispatchEvent = mock(() => true);
      globalThis.window = {
        ...createMockWindow(),
        addEventListener: mockAddEventListener,
        dispatchEvent: mockDispatchEvent,
      };

      const { providers, removeEIP6963EventListener } = getEIP6963Wallets();

      expect(mockAddEventListener).toHaveBeenCalledWith("eip6963:announceProvider", expect.any(Function));
      expect(mockDispatchEvent).toHaveBeenCalled();
      expect(providers).toEqual([]);
      expect(typeof removeEIP6963EventListener).toBe("function");
    });

    test("removeEIP6963EventListener removes the event listener", () => {
      const mockRemoveEventListener = mock(() => {});
      globalThis.window = { ...createMockWindow(), removeEventListener: mockRemoveEventListener };

      const { removeEIP6963EventListener } = getEIP6963Wallets();
      removeEIP6963EventListener();

      expect(mockRemoveEventListener).toHaveBeenCalledWith("eip6963:announceProvider", expect.any(Function));
    });
  });
});
