import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ChartPie,
  CreditCard,
  Home,
  Settings,
  User,
  Users,
} from "lucide-react"
import { NavLink } from "react-router-dom"

import {
  Sidebar,
  SidebarHeader,
  SidebarNav,
  SidebarNavItem,
  useSidebar,
} from "@workspace/ui/components/sidebar"
import { AppLogo } from "@/components/app-logo"
import { appConfig } from "@/config/app-config"
import { useAuth } from "@/contexts/auth-context"

const navItems = [
  { label: "Home", path: "/", icon: Home },
  { label: "Beneficiaries", path: "/beneficiaries", icon: BookOpen },
  { label: "Attendance", path: "/attendance", icon: ChartPie },
  { label: "Students", path: "/students", icon: Users },
  { label: "Payments", path: "/payments", icon: CreditCard, adminOnly: true },
  { label: "Analytics", path: "/analytics", icon: BarChart3 },
  { label: "Profile", path: "/profile", icon: User },
  { label: "Manage Users", path: "/manage-users", icon: Settings, adminOnly: true },
  { label: "Logs", path: "/logs", icon: CalendarDays, adminOnly: true },
]

export function AppSidebar() {
  const { setOpen } = useSidebar()
  const { isAdmin, isViewer } = useAuth()

  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin || isViewer)
  const isFloating = appConfig.sidebar.style === "floating"

  return (
    <Sidebar floating={isFloating}>
      <SidebarHeader>
        <AppLogo />
      </SidebarHeader>
      <SidebarNav>
        {visibleItems.map(({ label, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === "/"}
            onClick={() => setOpen(false)}
          >
            {({ isActive }) => (
              <SidebarNavItem
                render={<span />}
                active={isActive}
                icon={<Icon />}
                className={isActive && isFloating ? "mr-0 pr-4 rounded-2xl" : undefined}
              >
                {label}
              </SidebarNavItem>
            )}
          </NavLink>
        ))}
      </SidebarNav>
    </Sidebar>
  )
}
