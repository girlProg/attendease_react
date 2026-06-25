import * as React from "react"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@workspace/ui/lib/utils"

type SidebarContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

const SidebarContext = React.createContext<SidebarContextValue>({
  open: false,
  setOpen: () => {},
  toggle: () => {},
})

function useSidebar() {
  return React.useContext(SidebarContext)
}

function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const toggle = React.useCallback(() => setOpen((o) => !o), [])

  return (
    <SidebarContext value={{ open, setOpen, toggle }}>
      {children}
    </SidebarContext>
  )
}

function Sidebar({ className, children, ...props }: React.ComponentProps<"aside">) {
  const { open, setOpen } = useSidebar()

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      {/* Desktop sidebar */}
      <aside
        data-slot="sidebar"
        className={cn(
          "bg-sidebar text-sidebar-foreground sticky top-0 hidden h-svh w-56 shrink-0 flex-col gap-6 overflow-visible rounded-r-none px-4 py-6 md:flex",
          className
        )}
        {...props}
      >
        {children}
      </aside>
      {/* Mobile sidebar */}
      <aside
        data-slot="sidebar-mobile"
        className={cn(
          "bg-sidebar text-sidebar-foreground fixed inset-y-0 left-0 z-50 flex w-52 flex-col gap-6 rounded-r-none px-4 py-6 transition-transform duration-300 ease-in-out md:hidden",
          open ? "translate-x-0" : "-translate-x-full",
          className
        )}
        {...props}
      >
        {children}
      </aside>
    </>
  )
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      className={cn("flex items-center gap-2.5 px-2", className)}
      {...props}
    />
  )
}

function SidebarLogo({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="sidebar-logo" className={cn("flex items-center gap-2.5", className)} {...props}>
      <span className="bg-brand text-brand-foreground flex size-9 items-center justify-center rounded-xl text-xl font-bold">
        A
      </span>
      <span className="text-lg font-bold text-white">AttendEase</span>
    </div>
  )
}

function SidebarNav({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      data-slot="sidebar-nav"
      className={cn("flex flex-1 flex-col gap-2.5", className)}
      {...props}
    />
  )
}

const sidebarNavItemVariants = cva(
  "group/nav-item flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors outline-none select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5 focus-visible:ring-2 focus-visible:ring-sidebar-ring",
  {
    variants: {
      active: {
        true: "bg-sidebar-accent text-sidebar-accent-foreground  -mr-10 pr-8 rounded-r-3xl",
        false: "text-sidebar-foreground hover:bg-white/10 hover:text-white",
      },
    },
    defaultVariants: {
      active: false,
    },
    
  }
)

type SidebarNavItemProps = {
  render?: useRender.RenderProp
  className?: string
  icon?: React.ReactNode
  children?: React.ReactNode
} & VariantProps<typeof sidebarNavItemVariants>

function SidebarNavItem({
  render = <button type="button" />,
  className,
  active,
  icon,
  children,
}: SidebarNavItemProps) {
  return useRender({
    render,
    props: {
      "data-slot": "sidebar-nav-item",
      className: cn(sidebarNavItemVariants({ active }), className),
      children: (
        <>
          {icon}
          <span>{children}</span>
        </>
      ),
    },
  })
}

export {
  Sidebar,
  SidebarProvider,
  useSidebar,
  SidebarHeader,
  SidebarLogo,
  SidebarNav,
  SidebarNavItem,
  sidebarNavItemVariants,
}
