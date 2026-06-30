import { Route, Routes } from "react-router-dom"

import { Layout } from "@/components/layout"
import { ProtectedRoute, AdminRoute } from "@/components/protected-route"
import { AttendancePage } from "@/pages/attendance"
import { NewAttendancePage } from "@/pages/new-attendance"
import { LoginPage } from "@/pages/login"
import { BeneficiariesPage } from "@/pages/beneficiaries"
import { PaymentsPage } from "@/pages/payments"
import { StudentsPage } from "@/pages/students"
import { ProfilePage } from "@/pages/profile"
import { ManageUsersPage } from "@/pages/manage-users"
import { NewUserPage } from "@/pages/new-user"
import { LogsPage } from "@/pages/logs"
import { DashboardPage } from "@/pages/dashboard"

export function App() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="beneficiaries" element={<BeneficiariesPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="attendance/new" element={<NewAttendancePage />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="analytics" element={null} />
        <Route path="profile" element={<ProfilePage />} />
        <Route element={<AdminRoute />}>
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="manage-users" element={<ManageUsersPage />} />
          <Route path="manage-users/new" element={<NewUserPage />} />
          <Route path="logs" element={<LogsPage />} />
        </Route>
      </Route>
      </Route>
    </Routes>
  )
}
