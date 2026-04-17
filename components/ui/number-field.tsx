"use client";

import { NumberField as NumberFieldPrimitive } from "@base-ui/react/number-field";
import { MinusIcon, PlusIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button-variants";

function NumberFieldRoot({ className, ...props }: NumberFieldPrimitive.Root.Props) {
  return (
    <NumberFieldPrimitive.Root
      data-slot="number-field"
      className={cn("flex max-w-md flex-col gap-2", className)}
      {...props}
    />
  );
}

function NumberFieldGroup({ className, ...props }: NumberFieldPrimitive.Group.Props) {
  return (
    <NumberFieldPrimitive.Group
      data-slot="number-field-group"
      className={cn("flex items-stretch gap-2", className)}
      {...props}
    />
  );
}

function NumberFieldInput({ className, ...props }: NumberFieldPrimitive.Input.Props) {
  return (
    <NumberFieldPrimitive.Input
      data-slot="number-field-input"
      className={cn(
        "min-h-[48px] flex-1 rounded-lg border border-input bg-background px-3 text-base shadow-sm outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-[#005EB8]/30",
        className
      )}
      {...props}
    />
  );
}

function NumberFieldIncrement({ className, ...props }: NumberFieldPrimitive.Increment.Props) {
  return (
    <NumberFieldPrimitive.Increment
      className={cn(
        buttonVariants({ variant: "outline", size: "icon-lg" }),
        "min-h-12 min-w-12 shrink-0 touch-manipulation",
        className
      )}
      {...props}
    >
      <PlusIcon className="size-5" />
      <span className="sr-only">Increase</span>
    </NumberFieldPrimitive.Increment>
  );
}

function NumberFieldDecrement({ className, ...props }: NumberFieldPrimitive.Decrement.Props) {
  return (
    <NumberFieldPrimitive.Decrement
      className={cn(
        buttonVariants({ variant: "outline", size: "icon-lg" }),
        "min-h-12 min-w-12 shrink-0 touch-manipulation",
        className
      )}
      {...props}
    >
      <MinusIcon className="size-5" />
      <span className="sr-only">Decrease</span>
    </NumberFieldPrimitive.Decrement>
  );
}

function NumberFieldScrubArea({ className, ...props }: NumberFieldPrimitive.ScrubArea.Props) {
  return (
    <NumberFieldPrimitive.ScrubArea
      data-slot="number-field-scrub"
      className={cn(
        "cursor-ew-resize rounded-md border border-dashed border-[#005EB8]/25 bg-[#E8F4FC]/40 px-3 py-2 text-center text-xs text-muted-foreground",
        className
      )}
      {...props}
    >
      <NumberFieldPrimitive.ScrubAreaCursor />
      <span>Drag to adjust</span>
    </NumberFieldPrimitive.ScrubArea>
  );
}

export const NumberField = {
  Root: NumberFieldRoot,
  Group: NumberFieldGroup,
  Input: NumberFieldInput,
  Increment: NumberFieldIncrement,
  Decrement: NumberFieldDecrement,
  ScrubArea: NumberFieldScrubArea,
};
