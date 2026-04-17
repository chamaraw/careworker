"use client";

import { Slider as SliderPrimitive } from "@base-ui/react/slider";

import { cn } from "@/lib/utils";

function Slider({ className, ...props }: SliderPrimitive.Root.Props<number>) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn("flex w-full max-w-md flex-col gap-2 py-2", className)}
      {...props}
    >
      <SliderPrimitive.Control
        data-slot="slider-control"
        className="relative flex h-10 w-full touch-none items-center px-1"
      >
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="h-2.5 w-full rounded-full bg-[#E8EDEE] shadow-inner"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-indicator"
            className="h-full rounded-l-full bg-[#005EB8]/35"
          />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          className="size-6 rounded-full border-2 border-[#005EB8] bg-white shadow-md outline-none focus-visible:ring-2 focus-visible:ring-[#005EB8]/40"
        />
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider };
