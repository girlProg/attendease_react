import * as React from "react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

type PrimaryButtonProps = React.ComponentProps<typeof Button>

export function PrimaryButton({ className, children, ...props }: PrimaryButtonProps) {
  return (
    <Button
      className={cn(
        "h-12 w-full rounded-full bg-sidebar text-base font-semibold text-white hover:bg-sidebar/90",
        className
      )}
      {...props}
    >
      {children}
    </Button>
  )
}
