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
  SidebarLogo,
  SidebarNav,
  SidebarNavItem,
  useSidebar,
} from "@workspace/ui/components/sidebar"

const navItems = [
  { label: "Home", path: "/", icon: Home },
  { label: "Beneficiaries", path: "/beneficiaries", icon: BookOpen },
  { label: "Attendance", path: "/attendance", icon: ChartPie },
  { label: "Students", path: "/students", icon: Users },
  { label: "Payments", path: "/payments", icon: CreditCard },
  { label: "Analytics", path: "/analytics", icon: BarChart3 },
  { label: "Profile", path: "/profile", icon: User },
  { label: "Manage Users", path: "/manage-users", icon: Settings },
  { label: "Logs", path: "/logs", icon: CalendarDays },
] as const

export function AppSidebar() {
  const { setOpen } = useSidebar()

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarLogo />
      </SidebarHeader>
      <SidebarNav>
        {navItems.map(({ label, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === "/"}
            onClick={() => setOpen(false)}
          >
            {({ isActive }) => (
              <SidebarNavItem render={<span />} active={isActive} icon={<Icon />}>
                {label}
              </SidebarNavItem>
            )}
          </NavLink>
        ))}
      </SidebarNav>
    </Sidebar>
  )
}
