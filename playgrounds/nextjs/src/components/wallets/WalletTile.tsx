import { WalletOption } from "@swapkit/helpers";
import { getWalletLogo } from "../wallets/getWalletLogo";
import { cn } from "~/lib/utils";

interface WalletTileProps {
    wallet: WalletOption;
    onClick: () => void;
    disabled: boolean;
}

export const WalletTile = ({ wallet, onClick, disabled }: WalletTileProps) => {
    const logo = getWalletLogo(wallet);

    return (
        <button
            onClick={onClick}
            className={cn(
                "flex flex-col items-center justify-center w-[70px] h-[90px] bg-gray-800 rounded-md p-2",
                disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-700 cursor-pointer"
            )}
            disabled={disabled}
        >
            <img src={logo} alt={wallet} className="w-10 h-10 mb-2" />
            <span className="text-xs text-white text-center">{wallet}</span>
        </button>
    );
};
