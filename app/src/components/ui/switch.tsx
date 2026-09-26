// An on/off switch: Radix Switch styled by styles/base.css (.switch).
import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root ref={ref} className={`switch ${className ?? ""}`.trim()} {...props}>
    <SwitchPrimitive.Thumb className="switch-thumb" />
  </SwitchPrimitive.Root>
));
Switch.displayName = "Switch";
