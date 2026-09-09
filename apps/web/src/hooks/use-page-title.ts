import { useLocation } from "react-router-dom"

const titles: Record<string, string> = {
  "/": "Home",
  "/beneficiaries": "Beneficiaries",
  "/attendance": "Attendance",
  "/attendance/new": "New Attendance",
  "/students": "Students",
  "/payments": "Payments",
  "/payments/audit": "Payment Audit Trail",
  "/cases": "Case Management",
  "/analytics": "Monthly Report",
  "/profile": "Profile",
  "/manage-users": "Manage Users",
  "/logs": "Logs",
}

export function usePageTitle() {
  const { pathname } = useLocation()
  if (pathname.startsWith("/cases")) return "Case Management"
  if (pathname.startsWith("/beneficiaries/")) return "Beneficiaries"
  return titles[pathname] ?? "Home"
}
