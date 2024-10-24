"use client"
import { useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScrollArea, ScrollBar } from "../ui/scroll-area";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useSwapKit } from "~/lib/swapKit";
import { cn } from "~/lib/utils";
import { ChainCheckbox } from "../wallets/ChainCheckbox";
import { availableChainsByWallet, AllChains } from "../wallets/walletChains";
import { Chain, WalletOption } from "@swapkit/helpers";
import { Power, PowerOff } from "lucide-react";
import { Button } from "../ui/button";
import AvailableWallets from "../wallets/AvailableWallets";

// Define KEEPKEY_BEX option
const KEEPKEY_BEX: WalletOption = "KEEPKEY_BEX"; // Ensure this matches your implementation

const items = [
    { name: "Swap", href: "/" },
    { name: "Send", href: "/send" },
];

interface NavigationBarProps extends React.HTMLAttributes<HTMLDivElement> {}

const NavigationBar = ({ className, ...props }: NavigationBarProps) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [selectedChains, setSelectedChains] = useState<Chain[]>([]);
    const { walletType, disconnectWallet, isWalletConnected, connectWallet } = useSwapKit();
    const pathname = usePathname();

    const handleChainSelect = (chain: Chain) => (checked: boolean) => {
        setSelectedChains((prev) =>
            checked ? [...prev, chain] : prev.filter((c) => c !== chain)
        );
    };

    const checkWalletDisabled = useCallback(
        (option: WalletOption) => {
            const allowedChains = availableChainsByWallet[option];
            if (!allowedChains?.length || !selectedChains?.length) return false;
            return !selectedChains.every((chain) => allowedChains.includes(chain));
        },
        [selectedChains]
    );

    // Make handleWalletSelect async, add logs
    const handleWalletSelect = useCallback(
        async (option: WalletOption) => {
            console.log(`Wallet selection started for: ${option}`);
            setIsDropdownOpen(false);
            const allowedChains = availableChainsByWallet[option];

            if (!allowedChains.length || checkWalletDisabled(option)) {
                console.log(`Wallet ${option} is disabled or no allowed chains.`);
                return;
            }

            if (selectedChains.length === 0) {
                console.log(`No chains selected. Setting default chains for ${option}`);
                setSelectedChains(allowedChains);
            }

            if (isWalletConnected) {
                console.log("Disconnecting current wallet...");
                await disconnectWallet();
                console.log("Disconnected wallet.");
            } else {
                console.log(`Connecting to wallet ${option} with chains:`, selectedChains);
                await connectWallet(option, selectedChains);
                console.log(`Connected to wallet ${option}.`);
            }
        },
        [
            checkWalletDisabled,
            isWalletConnected,
            disconnectWallet,
            connectWallet,
            selectedChains,
        ]
    );

    return (
        <ScrollArea className="max-w-[600px] lg:max-w-none pt-4 mb-4 border-b">
            <div className="flex justify-between flex-row">
                <div className={cn("mb-4 flex items-center", className)} {...props}>
                    {items.map(({ href, name }) => (
                        <Link
                            href={href}
                            key={href}
                            className={cn(
                                "flex h-10 items-center justify-center rounded-full px-4 text-center transition-colors hover:text-primary",
                                pathname === href
                                    ? "bg-muted font-medium text-primary"
                                    : "text-muted-foreground"
                            )}
                        >
                            {name}
                        </Link>
                    ))}
                </div>

                <DropdownMenu onOpenChange={setIsDropdownOpen} open={isDropdownOpen}>
                    {isWalletConnected ? (
                        <Button onClick={disconnectWallet} variant="ghost" className="space-x-2">
                            <PowerOff size={18} className="text-red-400" />
                            <span>{`Disconnect (${walletType})`}</span>
                        </Button>
                    ) : (
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="space-x-2">
                                <Power size={18} className="text-slate-400" />
                                <span>Connect Wallet</span>
                            </Button>
                        </DropdownMenuTrigger>
                    )}

                    <DropdownMenuContent className="max-w-[400px]">
                        <AvailableWallets
                            onWalletSelect={handleWalletSelect}
                            checkWalletDisabled={checkWalletDisabled}
                        />

                        {/* Chain checkboxes */}
                        <div className="p-4 bg-slate-800">
                            <div className="flex flex-row flex-wrap gap-3">
                                {AllChains.map((chain) => (
                                    <ChainCheckbox
                                        key={chain}
                                        chain={chain}
                                        checked={selectedChains.includes(chain)}
                                        onCheckedChange={handleChainSelect(chain)}
                                    />
                                ))}
                            </div>
                        </div>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>
    );
};

export default NavigationBar;
