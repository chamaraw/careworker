"use client";

import * as React from "react";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";

import { cn } from "@/lib/utils";

const chipBase =
  "min-h-[48px] rounded-xl border-2 border-[#005EB8]/35 bg-white px-4 py-3 text-left text-base font-medium touch-manipulation transition-colors hover:bg-[#E8F4FC]/80 active:scale-[0.99]";

function ToggleGroup({
  className,
  ...props
}: ToggleGroupPrimitive.Props<string> & React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive>) {
  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      className={cn("flex flex-wrap gap-2", className)}
      {...props}
    />
  );
}

type ToggleItemProps = TogglePrimitive.Props<string> & {
  /** Visual hint that AI suggests this option (staff still chooses). */
  aiSuggested?: boolean;
};

const ToggleGroupItem = React.forwardRef<HTMLButtonElement, ToggleItemProps>(function ToggleGroupItem(
  { className, aiSuggested, children, ...props },
  ref
) {
  return (
    <TogglePrimitive
      ref={ref}
      data-slot="toggle-group-item"
      className={(state) =>
        cn(
          chipBase,
          state.pressed && "border-[#005EB8] bg-[#E8F4FC] ring-2 ring-[#005EB8]/25",
          aiSuggested && "ring-2 ring-[#00A499]/45",
          typeof className === "function" ? className(state) : className
        )
      }
      {...props}
    >
      {children}
    </TogglePrimitive>
  );
});

ToggleGroupItem.displayName = "ToggleGroupItem";

export { ToggleGroup, ToggleGroupItem };
