import { WalletOption } from "@swapkit/helpers";

export const getWalletLogo = (wallet: WalletOption) => {
    const logoMap: { [key in WalletOption]?: string } = {
        [WalletOption.KEEPKEY]: "https://pioneers.dev/coins/keepkey.png",
        [WalletOption.KEEPKEY_BEX]: "https://pioneers.dev/coins/keepkey.png",
        [WalletOption.METAMASK]: "https://pioneers.dev/coins/metamask.png",
        [WalletOption.EIP6963]: "https://pioneers.dev/coins/metamask.png",
        [WalletOption.LEDGER]: "https://pioneers.dev/coins/ledger.png",
        [WalletOption.COINBASE_MOBILE]: "",
        [WalletOption.BRAVE]: "",
        // Add more wallet logos as needed
    };

    return logoMap[wallet] || "https://cryptologos.cc/logos/generic/generic-coin-logo.svg";
};
