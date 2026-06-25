import { Route, Routes } from "react-router-dom"

import { Layout } from "@/components/layout"
import { AttendancePage } from "@/pages/attendance"
import { NewAttendancePage } from "@/pages/new-attendance"

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={null} />
        <Route path="beneficiaries" element={null} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="attendance/new" element={<NewAttendancePage />} />
        <Route path="students" element={null} />
        <Route path="payments" element={null} />
        <Route path="analytics" element={null} />
        <Route path="profile" element={null} />
        <Route path="manage-users" element={null} />
        <Route path="logs" element={null} />
      </Route>
    </Routes>
  )
}
