import { useLocation } from "react-router-dom"

const titles: Record<string, string> = {
  "/": "Home",
  "/beneficiaries": "Beneficiaries",
  "/attendance": "Attendance",
  "/attendance/new": "New Attendance",
  "/students": "Students",
  "/payments": "Payments",
  "/cases": "Case Management",
  "/analytics": "Analytics",
  "/profile": "Profile",
  "/manage-users": "Manage Users",
  "/logs": "Logs",
}

export function usePageTitle() {
  const { pathname } = useLocation()
  return titles[pathname] ?? "Home"
}
