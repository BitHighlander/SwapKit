"use client";

import { useState } from "react";
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
import {
    availableChainsByWallet,
    AllChains,
} from "../wallets/walletChains";
import { Chain, WalletOption } from "@swapkit/helpers";
import { Power, PowerOff, Loader } from "lucide-react";
import { Button } from "../ui/button";
import AvailableWallets from "../wallets/AvailableWallets";
import * as Dialog from "@radix-ui/react-dialog";

const items = [
    { name: "Swap", href: "/" },
    { name: "Send", href: "/send" },
];

interface NavigationBarProps extends React.HTMLAttributes<HTMLDivElement> {}

const NavigationBar = ({ className, ...props }: NavigationBarProps) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [selectedChains, setSelectedChains] = useState<Chain[]>([]);
    const {
        walletType,
        disconnectWallet,
        isWalletConnected,
        connectWallet,
    } = useSwapKit();
    const pathname = usePathname();
    const [isConnecting, setIsConnecting] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [walletBalance, setWalletBalance] = useState<number | null>(null);

    const handleChainSelect = (chain: Chain) => (checked: boolean) => {
        setSelectedChains((prev) =>
            checked ? [...prev, chain] : prev.filter((c) => c !== chain)
        );
    };

    const checkWalletDisabled = (option: WalletOption) => {
        const allowedChains = availableChainsByWallet[option];
        if (!allowedChains?.length || !selectedChains?.length) return false;
        return !selectedChains.every((chain) => allowedChains.includes(chain));
    };

    const handleWalletSelect = async (option: WalletOption) => {
        console.log(`Wallet selection started for: ${option}`);
        setIsDropdownOpen(false);
        setIsConnecting(true); // Start spinner

        const allowedChains = availableChainsByWallet[option];
        if (!allowedChains.length || checkWalletDisabled(option)) {
            console.log(`Wallet ${option} is disabled or no allowed chains.`);
            setIsConnecting(false);
            return;
        }

        // Update selected chains if no chains are selected
        if (selectedChains.length === 0) {
            console.log(`No chains selected. Setting default chains for ${option}`);
            setSelectedChains(allowedChains);
            await new Promise((resolve) => setTimeout(resolve, 0)); // Ensure state is updated
        }

        // Log selected chains to debug
        console.log(`Connecting to wallet ${option} with chains:`, selectedChains);

        if (isWalletConnected) {
            console.log("Disconnecting current wallet...");
            await disconnectWallet();
            console.log("Disconnected wallet.");
        } else {
            try {
                console.log(
                    `Connecting to wallet ${option} with chains:`,
                    selectedChains
                );
                await connectWallet(option, selectedChains);
                console.log(`Connected to wallet ${option}.`);

                // Fetch wallet balance here after connecting
                const balance = await fetchWalletBalance(option); // Implement fetchWalletBalance
                setWalletBalance(balance); // Update state with balance
                setIsModalOpen(true); // Show modal
            } catch (error) {
                console.error("Error connecting to wallet:", error);
            }
        }

        setIsConnecting(false); // Stop spinner
    };

    const fetchWalletBalance = async (option: WalletOption): Promise<number> => {
        // Implement actual logic to fetch wallet balance
        return 100.0; // Example balance
    };

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

                <DropdownMenu
                    onOpenChange={setIsDropdownOpen}
                    open={isDropdownOpen}
                >
                    {isWalletConnected ? (
                        <Button
                            onClick={disconnectWallet}
                            variant="ghost"
                            className="space-x-2"
                        >
                            <PowerOff size={18} className="text-red-400" />
                            <span>{`Disconnect (${walletType})`}</span>
                        </Button>
                    ) : (
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="space-x-2">
                                {isConnecting ? (
                                    <Loader
                                        size={18}
                                        className="animate-spin text-slate-400"
                                    />
                                ) : (
                                    <Power size={18} className="text-slate-400" />
                                )}
                                <span>Connect Wallet</span>
                            </Button>
                        </DropdownMenuTrigger>
                    )}

                    <DropdownMenuContent className="max-w-[400px]">
                        <AvailableWallets
                            onWalletSelect={handleWalletSelect}
                            checkWalletDisabled={checkWalletDisabled}
                        />
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <ScrollBar orientation="horizontal" className="invisible" />

            {/* Radix Modal */}
            <Dialog.Root open={isModalOpen} onOpenChange={setIsModalOpen}>
                <Dialog.Overlay className="fixed inset-0 bg-black/50" />

                <Dialog.Content
                    className="fixed top-1/2 left-1/2 max-w-md w-full bg-gray-900 p-6 rounded-2xl transform -translate-x-1/2 -translate-y-1/2 shadow-xl"
                >
                    <Dialog.Title className="text-xl font-semibold text-white">
                        Wallet Connected
                    </Dialog.Title>
                    <Dialog.Description className="mt-2 text-gray-300">
                        Your wallet has been successfully connected.
                    </Dialog.Description>
                    <div className="mt-4">
                        <p className="text-lg text-white">
                            Your balance is{" "}
                            <span className="font-bold">{walletBalance} ETH</span>.
                        </p>
                    </div>
                    <div className="mt-6 flex justify-end">
                        <Button
                            onClick={() => setIsModalOpen(false)}
                            className="rounded-full px-6 py-2"
                        >
                            Close
                        </Button>
                    </div>
                </Dialog.Content>
            </Dialog.Root>
        </ScrollArea>
    );
};

export default NavigationBar;
