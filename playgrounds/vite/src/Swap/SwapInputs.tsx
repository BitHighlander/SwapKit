"use client";
import type { AssetValue, QuoteResponseRoute, SwapKit } from "@swapkit/sdk";
import { FeeOption, ProviderName, SwapKitApi, SwapKitNumber } from "@swapkit/sdk";
import { useCallback, useState } from "react";

type Props = {
  inputAsset?: AssetValue;
  outputAsset?: AssetValue;
  handleSwap: (route: QuoteResponseRoute, isChainFlipBoost: boolean) => Promise<void>;
  skClient?: ReturnType<typeof SwapKit<{}, {}>>;
};

export const SwapInputs = ({ skClient, inputAsset, outputAsset, handleSwap }: Props) => {
  const [loading, setLoading] = useState(false);
  const [inputAssetValue, setInput] = useState<AssetValue | undefined>();
  const [routes, setRoutes] = useState<QuoteResponseRoute[]>([]);
  const [feeBestRoute, setFeeBestRoute] = useState<AssetValue | undefined>();
  const [useChainflipBoost, setUseChainflipBoost] = useState(true);

  const setAmount = useCallback(
    (amountValue: string) => {
      if (!inputAsset) return;

      const amount = inputAsset.mul(0).add(amountValue);
      setInput(amount.gt(inputAsset) ? inputAsset : amount);
    },
    [inputAsset],
  );

  const fetchQuote = useCallback(async () => {
    if (!(inputAsset && outputAsset && inputAssetValue && skClient)) return;

    setLoading(true);
    setRoutes([]);

    const sourceAddress = skClient.getAddress(inputAsset.chain);
    const destinationAddress = skClient.getAddress(outputAsset.chain);

    try {
      const { routes } = await SwapKitApi.getSwapQuoteV2(
        {
          sellAsset: inputAsset.toString(),
          sellAmount: inputAssetValue.getValue("string"),
          buyAsset: outputAsset.toString(),
          sourceAddress,
          destinationAddress,
          slippage: 3,
          affiliate: "t",
          affiliateFee: 10,
          includeTx: true,
        },
        true,
      );

      const fee = await skClient.estimateTransactionFee({
        type: "swap",
        params: {
          assetValue: inputAssetValue,
          route: routes[0] as QuoteResponseRoute,
        },
        feeOptionKey: FeeOption.Fast,
      });

      setFeeBestRoute(fee);
      setRoutes(routes || []);
    } finally {
      setLoading(false);
    }
  }, [inputAssetValue, inputAsset, outputAsset, skClient]);

  const swap = async (route: QuoteResponseRoute, inputAssetValue?: AssetValue) => {
    console.log("swap pressed");
    if (!(inputAsset && outputAsset && inputAssetValue && skClient)) {
      console.error("Failed to swap: missing inputAsset, outputAsset, inputAssetValue or skClient");
      return;
    }
    const isChainFlip = route?.providers?.includes(ProviderName.CHAINFLIP);
    if (isChainFlip) {
      await handleSwap(route, useChainflipBoost);
      return;
    }
    console.log("route:", route);
    console.log("route.tx:", route.tx);
    if (route?.tx?.from || true) {
      // const fromAddress = route.tx.from;
      // console.log("From Address:", fromAddress);
      //
      // const isApproved = await skClient.isAssetValueApproved(inputAssetValue, fromAddress);
      // console.log("Is Asset Approved:", isApproved);
      const isApproved = true;
      const fromAddress = "0x";

      if (isApproved || true) {
        console.log("Asset is already approved, proceeding to handle swap.");
        await handleSwap(route, false);
      } else {
        console.log("Asset is not approved, attempting to approve asset.");
        try {
          await skClient.approveAssetValue(inputAssetValue, fromAddress);
          console.log("Asset approval successful.");
        } catch (error) {
          console.error("Asset approval failed:", error);
        }
      }
    } else {
      console.error("Approval Spender not found");
      throw new Error("Approval Spender not found");
    }
  };

  return (
    <div style={{ display: "flex", flex: 1, flexDirection: "column" }}>
      <div>
        <div>
          <span>Input Asset:</span>
          {inputAsset?.toSignificant(6)} {inputAsset?.ticker}
        </div>

        <div>
          <span>Output Asset:</span>
          {outputAsset?.toSignificant(6)} {outputAsset?.ticker}
        </div>
      </div>

      <div>
        <div>
          <span>Input Amount:</span>
          <input
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            value={inputAssetValue?.toSignificant(inputAssetValue.decimal)}
          />
        </div>

        <button disabled={!(inputAsset && outputAsset)} onClick={fetchQuote} type="button">
          {loading ? "Loading..." : "Get Quote"}
        </button>
      </div>

      {routes.length > 0 && (
        <div>
          <div>
            <span>Routes:</span>
            {routes.map((route, index) => (
              <div key={`${route.targetAddress}-${index}`}>
                {route?.providers?.includes(ProviderName.CHAINFLIP) && (
                  <div key={`${route.targetAddress}-${index}-chainflip`}>
                    <label>
                      <input
                        type="checkbox"
                        checked={useChainflipBoost}
                        onChange={(e) => setUseChainflipBoost(e.target.checked)}
                      />
                      Use Chainflip
                    </label>
                  </div>
                )}
                <button onClick={() => swap(route, inputAssetValue)} type="button">
                  {"SWAP =>"} Estimated Output: {route.expectedBuyAmount} {outputAsset?.ticker} ($
                  {new SwapKitNumber(route.expectedBuyAmount)
                    .mul(
                      route.meta.assets?.find(
                        (asset) =>
                          asset.asset.toLowerCase() === outputAsset?.toString().toLowerCase(),
                      )?.price || 0,
                    )
                    .toFixed(4)}
                  )
                </button>
                {feeBestRoute && <div>{feeBestRoute.toString()}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
