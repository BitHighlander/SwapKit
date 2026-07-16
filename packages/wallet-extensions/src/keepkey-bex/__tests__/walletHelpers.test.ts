// @ts-nocheck - Test file with intentional mocking of browser globals
import { afterEach, describe, expect, mock, test } from "bun:test";
import { Chain } from "@swapkit/helpers";

import { getKEEPKEYAddress } from "../walletHelpers";

// Regression suite for the pubkey-array bug: getKEEPKEYAddress MUST always
// return a single non-empty string, or throw so connect skips the chain.
//
// The BEX background handlers are inconsistent (shapes verified in
// keepkey-client chrome-extension/src/background/chains/*Handler.ts):
//   - thorchain/maya/cosmos/bitcoin/litecoin/doge/dash `request_accounts`
//     return [accounts] — an array NESTED in an array. One-level destructuring
//     yields an array, which leaked into wallet.address and reached Pioneer as
//     `pubkeys.$9.pubkey: ["thor1g9el..."]` (HTTP 400, whole portfolio dead).
//   - bitcoin returns 7 entries (one per derivation path) that are ALL empty
//     strings when the vault rows carry { pubkey: "<xpub>", address: "" }.
//   - bitcoincash returns a FLAT [string] (the one non-EVM exception), and
//     [undefined→null] when no pubkeys exist.
//   - ethereum returns a flat [ADDRESS] where ADDRESS is "" before init.

const originalWindow = globalThis.window;

function mockKeepkey(providers: Record<string, { request: ReturnType<typeof mock> }>) {
  globalThis.window = { keepkey: providers };
}

const provider = (responses: Record<string, unknown>) => ({
  request: mock(({ method }: { method: string }) => Promise.resolve(responses[method])),
});

afterEach(() => {
  globalThis.window = originalWindow;
});

describe("getKEEPKEYAddress", () => {
  test("THORChain: unwraps the nested [['thor1...']] shape to a plain string", async () => {
    mockKeepkey({ thorchain: provider({ request_accounts: [["thor1g9el7lzjwh9yun2c4jjzhy09j98vkhfxfhgnzx"]] }) });

    const address = await getKEEPKEYAddress(Chain.THORChain);

    expect(address).toBe("thor1g9el7lzjwh9yun2c4jjzhy09j98vkhfxfhgnzx");
    expect(typeof address).toBe("string");
  });

  test("Bitcoin: throws when every derivation path resolves to an empty string", async () => {
    mockKeepkey({ bitcoin: provider({ request_accounts: [["", "", "", "", "", "", ""]] }) });

    await expect(getKEEPKEYAddress(Chain.Bitcoin)).rejects.toThrow();
  });

  test("Bitcoin: picks the first real address when some paths are empty", async () => {
    mockKeepkey({ bitcoin: provider({ request_accounts: [["", "", "bc1qreal", ""]] }) });

    expect(await getKEEPKEYAddress(Chain.Bitcoin)).toBe("bc1qreal");
  });

  test("BitcoinCash: accepts the flat [string] shape", async () => {
    mockKeepkey({ bitcoincash: provider({ request_accounts: ["bitcoincash:qq1234"] }) });

    expect(await getKEEPKEYAddress(Chain.BitcoinCash)).toBe("bitcoincash:qq1234");
  });

  test("BitcoinCash: throws on [null] (zero pubkeys serialized through the extension)", async () => {
    mockKeepkey({ bitcoincash: provider({ request_accounts: [null] }) });

    await expect(getKEEPKEYAddress(Chain.BitcoinCash)).rejects.toThrow();
  });

  test("EVM: returns the silent eth_accounts address without prompting", async () => {
    const eth = provider({ eth_accounts: ["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"] });
    mockKeepkey({ ethereum: eth });

    expect(await getKEEPKEYAddress(Chain.Ethereum)).toBe("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
    expect(eth.request).toHaveBeenCalledTimes(1);
  });

  test("EVM: falls through to eth_requestAccounts when eth_accounts has only ''", async () => {
    const eth = provider({ eth_accounts: [""], eth_requestAccounts: ["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"] });
    mockKeepkey({ ethereum: eth });

    expect(await getKEEPKEYAddress(Chain.Ethereum)).toBe("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
    expect(eth.request).toHaveBeenCalledTimes(2);
  });

  test("EVM: falls through to eth_requestAccounts when eth_accounts REJECTS", async () => {
    const eth = {
      request: mock(({ method }: { method: string }) =>
        method === "eth_accounts"
          ? Promise.reject(new Error("method not supported"))
          : Promise.resolve(["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"]),
      ),
    };
    mockKeepkey({ ethereum: eth });

    expect(await getKEEPKEYAddress(Chain.Ethereum)).toBe("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
  });

  test("EVM: throws when both account methods return only '' (BEX not initialized)", async () => {
    mockKeepkey({ ethereum: provider({ eth_accounts: [""], eth_requestAccounts: [""] }) });

    await expect(getKEEPKEYAddress(Chain.Ethereum)).rejects.toThrow();
  });

  test("throws wallet_provider_not_found when the chain provider is absent", async () => {
    mockKeepkey({});

    await expect(getKEEPKEYAddress(Chain.Dogecoin)).rejects.toThrow();
  });
});
