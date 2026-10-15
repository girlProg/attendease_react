import { Link } from "react-router-dom"

/**
 * A student's name that opens their student page — used on every row that
 * lists a student, so the full record is always one click away.
 *
 * Clicks don't reach the row (rows that open something else keep working).
 * `newTab` keeps the current page intact, for pages with unsaved edits.
 */
export function StudentLink({
  studentId,
  children,
  className = "",
  newTab = false,
}: {
  studentId?: number | null
  children: React.ReactNode
  className?: string
  newTab?: boolean
}) {
  if (!studentId) return <span className={className}>{children}</span>
  return (
    <Link
      to={`/beneficiaries/${studentId}`}
      onClick={(event) => event.stopPropagation()}
      title="Open the student's page"
      className={`${className} hover:text-sidebar hover:underline`}
      {...(newTab ? { target: "_blank", rel: "noopener" } : {})}
    >
      {children}
    </Link>
  )
}
