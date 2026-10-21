import { NavLink, Outlet } from "react-router-dom"

import { useAuth } from "@/contexts/auth-context"

// Settings grouped by what they're for, one page each. Payments is for
// superusers only: it changes how money is sent to the bank.
const PAGES = [
  { label: "Term", path: "/settings/term", superuserOnly: false },
  { label: "Payments", path: "/settings/payments", superuserOnly: true },
] as const

export function SettingsLayout() {
  const { isSuperuser } = useAuth()
  const pages = PAGES.filter((page) => !page.superuserOnly || isSuperuser)

  return (
    <div className="space-y-6">
      {pages.length > 1 && (
        <div className="flex justify-start sm:justify-center">
          <nav className="inline-flex items-center rounded-full border border-brand/40 bg-white p-1">
            {pages.map((page) => (
              <NavLink
                key={page.path}
                to={page.path}
                className={({ isActive }) =>
                  isActive
                    ? "whitespace-nowrap rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors sm:px-6"
                    : "whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:px-6"
                }
              >
                {page.label}
              </NavLink>
            ))}
          </nav>
        </div>
      )}
      <Outlet />
    </div>
  )
}
