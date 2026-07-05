import { cn } from "@workspace/ui/lib/utils"
import { appConfig } from "@/config/app-config"

const sizes = {
  sm: { badge: "size-9 rounded-xl text-xl", text: "text-lg" },
  md: { badge: "size-10 rounded-xl text-xl", text: "text-2xl" },
  lg: { badge: "size-12 rounded-xl text-2xl", text: "text-3xl" },
} as const

export function AppLogo({
  size = "sm",
  variant = "light",
  className,
}: {
  size?: keyof typeof sizes
  variant?: "light" | "dark"
  className?: string
}) {
  const s = sizes[size]
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      {appConfig.logo.type === "image" ? (
        <img src={appConfig.logo.src} alt={appConfig.appName} className={cn("shrink-0 object-contain", s.badge, "rounded-none")} />
      ) : (
        <span className={cn("flex items-center justify-center bg-brand font-bold text-white", s.badge)}>
          {appConfig.logo.letter}
        </span>
      )}
      <span className={cn("font-bold", s.text, variant === "light" ? "text-white" : "text-sidebar")}>
        {appConfig.appName}
      </span>
    </div>
  )
}
