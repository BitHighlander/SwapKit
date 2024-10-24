"use client";

import { useState, useEffect } from "react";
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
import { Chain, WalletOption } from "@swapkit/helpers";
import { Power, PowerOff, Loader } from "lucide-react";
import { Button } from "../ui/button";
import AvailableWallets from "../wallets/AvailableWallets";
import * as Dialog from "@radix-ui/react-dialog";
import { AssetValue } from "@swapkit/helpers";

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
        balances,
        getBalances,
    } = useSwapKit();
    const pathname = usePathname();
    const [isConnecting, setIsConnecting] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [walletBalances, setWalletBalances] = useState<AssetValue[]>([]);

    // Handle wallet selection and connection
    const handleWalletSelect = async (option: WalletOption) => {
        console.log(`Wallet selection started for: ${option}`);
        setIsDropdownOpen(false);
        setIsConnecting(true); // Start spinner

        // Define the chains to connect (you can adjust this as needed)
        const chainsToConnect = [Chain.Ethereum]; // Example chain

        // Log selected chains
        console.log(`Connecting to wallet ${option} with chains:`, chainsToConnect);

        try {
            await connectWallet(option, chainsToConnect);
            console.log(`Connected to wallet ${option}.`);

            // Fetch wallet balances after connecting
            await getBalances(true);

            // Log balances to confirm fetching
            console.log("Balances fetched:", balances);
            if (balances.length > 0) {
                setWalletBalances(balances);
                setIsModalOpen(true); // Open modal to display balances
            }
        } catch (error) {
            console.error("Error connecting to wallet:", error);
        }

        setIsConnecting(false); // Stop spinner
    };

    // Close the modal
    const handleCloseModal = () => {
        setIsModalOpen(false);
    };

    // Utility function for formatting balances
    const formatBalance = (amount: number, decimals: number) => {
        return (amount / Math.pow(10, decimals)).toFixed(4);
    };

    useEffect(() => {
        // Sync walletBalances with balances from useSwapKit whenever balances are updated
        if (isWalletConnected && balances.length > 0) {
            console.log("Syncing balances from useSwapKit:", balances);
            setWalletBalances(balances);
        }
    }, [balances, isWalletConnected]);

    return (
        <ScrollArea className="max-w-[600px] lg:max-w-none pt-4 mb-4 border-b">
            <div className="flex justify-between items-center flex-row">
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

                {isWalletConnected ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="space-x-2">
                                <Power size={18} className="text-green-400" />
                                <span>Connected</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="max-w-[400px] p-4 rounded-xl bg-gray-800">
                            <div className="flex flex-col space-y-3">
                                {walletBalances.map((balance) => (
                                    <div
                                        key={balance.asset.symbol}
                                        className="flex items-center space-x-3 text-white"
                                    >
                                        <img
                                            src={`https://cryptoicons.org/api/icon/${balance.asset.symbol.toLowerCase()}/32`}
                                            alt={balance.asset.symbol}
                                            className="w-6 h-6"
                                        />
                                        <span>
                      {balance.asset.symbol}: {formatBalance(balance.amount, balance.asset.decimals)}
                    </span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 flex justify-end">
                                <Button
                                    onClick={disconnectWallet}
                                    variant="destructive"
                                    className="space-x-2"
                                >
                                    <PowerOff size={18} />
                                    <span>Disconnect</span>
                                </Button>
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : (
                    <DropdownMenu
                        onOpenChange={setIsDropdownOpen}
                        open={isDropdownOpen}
                    >
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="space-x-2">
                                {isConnecting ? (
                                    <Loader size={18} className="animate-spin text-slate-400" />
                                ) : (
                                    <Power size={18} className="text-slate-400" />
                                )}
                                <span>Connect Wallet</span>
                            </Button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent className="max-w-[400px]">
                            <AvailableWallets
                                onWalletSelect={handleWalletSelect}
                                // You can adjust this function based on your needs
                                checkWalletDisabled={() => false}
                            />
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
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
                        <div className="flex flex-col space-y-3">
                            {walletBalances.map((balance) => (
                                <div
                                    key={balance.asset.symbol}
                                    className="flex items-center space-x-3 text-white"
                                >
                                    <img
                                        src={`https://cryptoicons.org/api/icon/${balance.asset.symbol.toLowerCase()}/32`}
                                        alt={balance.asset.symbol}
                                        className="w-6 h-6"
                                    />
                                    <span>
                    {balance.asset.symbol}: {formatBalance(balance.amount, balance.asset.decimals)}
                  </span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end">
                        <Button
                            onClick={handleCloseModal}
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
