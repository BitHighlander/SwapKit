import { Chain } from "@swapkit/helpers";
import { Checkbox } from "../ui/checkbox";
import { cn } from "~/lib/utils";

interface ChainCheckboxProps {
    chain: Chain;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
}

export const ChainCheckbox = ({ chain, checked, onCheckedChange }: ChainCheckboxProps) => {
    return (
        <div className="flex w-[70px] flex-col items-center">
      <span className={cn("text-xs", checked ? "text-primary" : "text-muted-foreground")}>
        {chain}
      </span>
            <Checkbox
                checked={checked}
                onCheckedChange={onCheckedChange}
                className="mt-1"
            />
        </div>
    );
};
