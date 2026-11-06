import { Navigate, Route, Routes } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"

import { getConfig } from "@/api/config"

import { Layout } from "@/components/layout"
import {
  ProtectedRoute,
  CapabilityRoute,
  SuperuserRoute,
} from "@/components/protected-route"
import { AttendancePage } from "@/pages/attendance"
import { CaseManagementPage } from "@/pages/cases"
import { CaseDetailPage } from "@/pages/case-detail"
import { NewAttendancePage } from "@/pages/new-attendance"
import { LoginPage } from "@/pages/login"
import { BeneficiariesPage } from "@/pages/beneficiaries"
import { ReportsPage } from "@/pages/reports"
import { StudentDetailPage } from "@/pages/student-detail"
import { PaymentsPage } from "@/pages/payments"
import { NewPaymentsPage } from "@/pages/payments-redesign"
import { PaymentAuditPage } from "@/pages/payment-audit"
import { ReconciliationPage } from "@/pages/reconciliation"
import { MeStatsPage } from "@/pages/me-stats"
import { StudentsPage } from "@/pages/students"
import { ProfilePage } from "@/pages/profile"
import { ManageUsersPage } from "@/pages/manage-users"
import { NewUserPage } from "@/pages/new-user"
import { EditUserPage } from "@/pages/edit-user"
import { LogsPage } from "@/pages/logs"
import { DashboardPage } from "@/pages/dashboard"
import { AskPage } from "@/pages/ask"
import { SettingsLayout } from "@/pages/settings"
import { CohortSettingsPage } from "@/pages/settings/cohorts"
import { DisplaySettingsPage } from "@/pages/settings/display"
import { MeStatsSettingsPage } from "@/pages/settings/me-stats"
import { PaymentSettingsPage } from "@/pages/settings/payments"
import { TermSettingsPage } from "@/pages/settings/term"

// The Payments page in the design a superuser switched on for everyone
// (Settings > Display). Nothing renders until the config says which.
function PaymentsRoute() {
  const { data: config } = useQuery({ queryKey: ["config"], queryFn: getConfig })
  if (!config) return null
  return config.features?.new_payments_page ? <NewPaymentsPage /> : <PaymentsPage />
}

export function App() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="beneficiaries" element={<BeneficiariesPage />} />
        <Route path="beneficiaries/:id" element={<StudentDetailPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="attendance/new" element={<NewAttendancePage />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route element={<CapabilityRoute capability="reports" />}>
          <Route path="analytics" element={<ReportsPage />} />
        </Route>
        <Route element={<CapabilityRoute capability="term_settings" />}>
          <Route path="settings" element={<SettingsLayout />}>
            <Route index element={<Navigate to="term" replace />} />
            <Route path="term" element={<TermSettingsPage />} />
            <Route element={<SuperuserRoute />}>
              <Route path="payments" element={<PaymentSettingsPage />} />
              <Route path="cohorts" element={<CohortSettingsPage />} />
              <Route path="me-stats" element={<MeStatsSettingsPage />} />
              <Route path="display" element={<DisplaySettingsPage />} />
            </Route>
          </Route>
        </Route>
        <Route element={<CapabilityRoute capability="me_stats" />}>
          <Route path="me-stats" element={<MeStatsPage />} />
        </Route>
        <Route element={<CapabilityRoute capability="case_management" />}>
          <Route path="cases" element={<CaseManagementPage />} />
          <Route path="cases/:id" element={<CaseDetailPage />} />
        </Route>
        <Route element={<CapabilityRoute capability="ask" />}>
          <Route path="ask" element={<AskPage />} />
        </Route>
        <Route element={<CapabilityRoute capability="view_payments" />}>
          <Route path="payments" element={<PaymentsRoute />} />
        </Route>
        <Route element={<CapabilityRoute capability="payment_audit" />}>
          <Route path="payments/audit" element={<PaymentAuditPage />} />
        </Route>
        <Route element={<CapabilityRoute capability="reconciliation" />}>
          <Route path="payments/reconciliation" element={<ReconciliationPage />} />
        </Route>
        <Route element={<CapabilityRoute capability="manage_users" />}>
          <Route path="manage-users" element={<ManageUsersPage />} />
          <Route path="manage-users/new" element={<NewUserPage />} />
          <Route path="manage-users/:id" element={<EditUserPage />} />
        </Route>
        <Route element={<CapabilityRoute capability="logs" />}>
          <Route path="logs" element={<LogsPage />} />
        </Route>
      </Route>
      </Route>
    </Routes>
  )
}
