import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ChartPie,
  ClipboardList,
  CreditCard,
  Home,
  Settings,
  Sparkles,
  User,
  Users,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { NavLink } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"

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
import { getConfig } from "@/api/config"
import type { DeploymentConfig } from "@/types"

/** A page some deployments have and others do not, keyed by the switch the
 *  backend reports through /api/config. */
type FeatureKey = keyof NonNullable<DeploymentConfig["features"]>

interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  adminOnly?: boolean
  strictAdmin?: boolean
  caseManager?: boolean
  feature?: FeatureKey
}

const navItems: NavItem[] = [
  { label: "Home", path: "/", icon: Home },
  { label: "Beneficiaries", path: "/beneficiaries", icon: BookOpen },
  { label: "Attendance", path: "/attendance", icon: ChartPie },
  { label: "Students", path: "/students", icon: Users },
  { label: "Payments", path: "/payments", icon: CreditCard, adminOnly: true },
  { label: "Case Management", path: "/cases", icon: ClipboardList, caseManager: true },
  {
    label: "Reports",
    path: "/analytics",
    icon: BarChart3,
    feature: "monthly_reports",
    adminOnly: true,
  },
  { label: "Ask", path: "/ask", icon: Sparkles, strictAdmin: true },
  { label: "Profile", path: "/profile", icon: User },
  { label: "Manage Users", path: "/manage-users", icon: Settings, adminOnly: true },
  { label: "Logs", path: "/logs", icon: CalendarDays, adminOnly: true },
]

export function AppSidebar() {
  const { setOpen } = useSidebar()
  const { isAdmin, isViewer, isSpiu } = useAuth()
  // Feature switches are per deployment (one build serves every state), so a
  // page the state has not enabled must not appear in its sidebar.
  const { data: config } = useQuery({
    queryKey: ["config"],
    queryFn: getConfig,
    staleTime: Infinity,
  })

  const visibleItems = navItems.filter((item) => {
    if (item.feature && !config?.features?.[item.feature]) return false
    // SPIU is a case-management operator: only Case Management + Profile.
    if (isSpiu) return item.caseManager || item.path === "/profile"
    if (item.strictAdmin) return isAdmin
    if (item.caseManager) return isAdmin
    return !item.adminOnly || isAdmin || isViewer
  })
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
