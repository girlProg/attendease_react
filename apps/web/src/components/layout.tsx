import { Outlet, useNavigate } from "react-router-dom"
import { User, LogOut, Menu } from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import { useAuth } from "@/contexts/auth-context"
import { usePageTitle } from "@/hooks/use-page-title"
import { SidebarProvider, useSidebar } from "@workspace/ui/components/sidebar"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"


export function Layout() {
  return (
    <SidebarProvider>
      <LayoutInner />
    </SidebarProvider>
  )
}

function LayoutInner() {
  const title = usePageTitle()
  const { toggle } = useSidebar()

  return (
    <div className="flex min-h-svh">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border/40 bg-background px-4 py-8 md:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggle}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
            >
              <Menu className="size-5" />
            </button>
            <h1 className="text-2xl font-bold text-sidebar">{title}</h1>
          </div>
          <AccountMenu />
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function AccountMenu() {
  const navigate = useNavigate()
  const { profile } = useAuth()

  const displayName = profile
    ? `${profile.first_name} ${profile.last_name.charAt(0)}.`
    : ""
  const initials = profile
    ? `${profile.first_name.charAt(0)}${profile.last_name.charAt(0)}`
    : ""

  function handleLogout() {
    localStorage.removeItem("access")
    localStorage.removeItem("refresh")
    window.location.href = "/login"
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex cursor-pointer items-center gap-2 rounded-lg p-1 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
        <div className="text-right">
          <p className="text-sm font-semibold text-foreground">{displayName}</p>
          <p className="text-xs text-muted-foreground">Admin</p>
        </div>
        <Avatar size="lg">
          <AvatarImage src={profile?.photo ?? ""} alt={displayName} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-48">
        <DropdownMenuItem onClick={() => navigate("/profile")}>
          <User />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={handleLogout}>
          <LogOut />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
