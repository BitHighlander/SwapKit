// src/components/AvailableWallets.tsx

"use client";

import { useState, useEffect } from "react";
import { WalletTile } from "../wallets/WalletTile";
import { WalletOption } from "@swapkit/helpers";

// Hardcoded available wallet options for now
export const getAvailableWalletOptions = (): WalletOption[] => {
    const availableWallets: WalletOption[] = [WalletOption.KEEPKEY_BEX, WalletOption.METAMASK, WalletOption.EIP6963];
    return availableWallets;
};

interface AvailableWalletsProps {
    onWalletSelect: (option: WalletOption) => void;
    checkWalletDisabled: (option: WalletOption) => boolean;
}

const AvailableWallets = ({ onWalletSelect, checkWalletDisabled }: AvailableWalletsProps) => {
    const [availableWalletOptions, setAvailableWalletOptions] = useState<WalletOption[]>([]);

    useEffect(() => {
        const wallets = getAvailableWalletOptions(); // Get hardcoded available wallets
        setAvailableWalletOptions(wallets);
    }, []);

    return (
        <div className="grid grid-cols-3 gap-4 p-4">
            {availableWalletOptions.map((option) => (
                <WalletTile
                    key={option}
                    wallet={option}
                    onClick={() => onWalletSelect(option)}
                    disabled={checkWalletDisabled(option)}
                />
            ))}
        </div>
    );
};

export default AvailableWallets;
