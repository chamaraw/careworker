"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "group relative inline-flex h-10 w-[4.25rem] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-[#E8EDEE] px-1 outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-[#005EB8]/40 data-checked:bg-[#007F3B]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none absolute left-1 top-1 block size-7 rounded-full bg-white shadow-md ring-0 transition-transform",
          "group-data-checked:translate-x-[1.55rem]"
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
