import { type AssetValue, type Chain, WalletOption } from "@swapkit/helpers";
import { atom, useAtom } from "jotai";
import { useEffect } from "react";

const TAG = " | swapKit | "
const swapKitAtom = atom<any | null>(null);
const balanceAtom = atom<AssetValue[]>([]);
const walletState = atom<{ connected: boolean; type: WalletOption | null }>({
  connected: false,
  type: null,
});

export const useSwapKit = () => {
  const [swapKit, setSwapKit] = useAtom(swapKitAtom);
  const [balances, setBalances] = useAtom(balanceAtom);
  const [{ type: walletType, connected: isWalletConnected }, setWalletState] = useAtom(walletState);

  useEffect(() => {
    const loadSwapKit = async () => {
      const { SwapKit } = await import("@swapkit/core");
      const { ChainflipPlugin } = await import("@swapkit/plugin-chainflip");
      const { ThorchainPlugin, MayachainPlugin } = await import("@swapkit/plugin-thorchain");
      const { wallets } = await import("@swapkit/wallets");
      console.log('wallets', wallets);

      const swapKitClient = SwapKit({
        config: {
          blockchairApiKey:
              process.env.NEXT_PUBLIC_BLOCKCHAIR_API_KEY || "A___Tcn5B16iC3mMj7QrzZCb2Ho1QBUf",
          covalentApiKey:
              process.env.NEXT_PUBLIC_COVALENT_API_KEY || "cqt_rQ6333MVWCVJFVX3DbCCGMVqRH4q",
          ethplorerApiKey: process.env.NEXT_PUBLIC_ETHPLORER_API_KEY || "freekey",
          walletConnectProjectId: "",
          keepkeyConfig: {
            apiKey: localStorage.getItem("keepkeyApiKey") || "",
            pairingInfo: {
              name: "THORSwap",
              imageUrl: "https://www.thorswap.finance/logo.png",
              basePath: "swap",
              url: "https://app.thorswap.finance",
            },
          },
        },
        wallets,
        plugins: { ...ThorchainPlugin, ...ChainflipPlugin, ...MayachainPlugin },
      });

      setSwapKit(swapKitClient);
    };

    loadSwapKit();
  }, [setSwapKit]);

  const getBalances = async (refresh?: boolean) => {
    let tag = TAG + " | getBalances | ";
    if (!refresh && balances.length) return;
    console.log(tag, 'balances: ', balances);

    console.log(tag, 'swapKit: ', swapKit);
    const connectedChains =
        (Object.keys(swapKit?.connectedChains || {}).filter(Boolean) as Chain[]) || [];
    console.log(tag, 'connectedChains: ', connectedChains);

    let nextBalances: AssetValue[] = [];

    for (const chain of connectedChains) {
      const balance = await swapKit?.getBalance(chain);
      console.log(chain+' balance: ', balance);
      if (balance) {
        nextBalances = nextBalances.concat(balance);
      }
    }

    setBalances(nextBalances.sort((a, b) => a.getValue("number") - b.getValue("number")));
  };

  const connectWallet = (option: WalletOption, chains: Chain[]) => {
    switch (option) {
      case WalletOption.XDEFI: {
        swapKit?.connectXDEFI(chains);
        break;
      }
      case WalletOption.KEEPKEY_BEX: {
        console.log('chains', chains);
        swapKit?.connectKeepkeyBex(chains);
        break;
      }
      default:
        throw Error('Unhandled wallet option' + option + '!');
    }

    setWalletState({ connected: !!swapKit?.getAddress(chains[0]), type: option });

    getBalances();
  };

  const disconnectWallet = () => {
    for (const chain of Object.keys(swapKit?.connectedChains || {})) {
      swapKit?.disconnectChain(chain as Chain);
    }

    setWalletState({ connected: false, type: null });
  };

  const checkIfChainConnected = (chain: Chain) => {
    return !!swapKit?.getAddress(chain);
  };

  return {
    balances,
    checkIfChainConnected,
    connectWallet,
    disconnectWallet,
    getBalances,
    isWalletConnected,
    setSwapKit,
    swapKit,
    walletType,
  };
};
