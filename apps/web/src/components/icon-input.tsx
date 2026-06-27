import * as React from "react"

import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"

type IconInputProps = React.ComponentProps<"input"> & {
  icon: React.ReactNode
  endAction?: React.ReactNode
}

export function IconInput({ icon, endAction, className, ...props }: IconInputProps) {
  return (
    <div className="relative">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground [&_svg]:size-5">
        {icon}
      </span>
      <Input
        className={cn(
          "h-12 rounded-full border-border/60 bg-white pl-12 text-sm shadow-sm",
          endAction && "pr-12",
          className
        )}
        {...props}
      />
      {endAction && (
        <span className="absolute right-4 top-1/2 -translate-y-1/2">
          {endAction}
        </span>
      )}
    </div>
  )
}
