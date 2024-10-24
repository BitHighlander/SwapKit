import { WalletOption } from "@swapkit/helpers";

export const getWalletLogo = (wallet: WalletOption) => {
    const logoMap: { [key in WalletOption]?: string } = {
        [WalletOption.KEEPKEY]: "https://pioneers.dev/coins/keepkey.png",
        [WalletOption.KEEPKEY_BEX]: "https://pioneers.dev/coins/keepkey.png",
        [WalletOption.METAMASK]: "https://cryptologos.cc/logos/metamask-metaverse-logo.png",
        [WalletOption.LEDGER]: "https://cryptologos.cc/logos/ledger-logo.png",
        [WalletOption.COINBASE_MOBILE]: "https://cryptologos.cc/logos/coinbase-coin-logo.png",
        [WalletOption.BRAVE]: "https://cryptologos.cc/logos/basic-attention-token-bat-logo.png",
        // Add more wallet logos as needed
    };

    return logoMap[wallet] || "https://cryptologos.cc/logos/generic/generic-coin-logo.svg";
};
