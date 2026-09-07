export function formatNaira(amount: number) {
  return `₦${amount.toLocaleString()}`
}

// Percentages are shown as whole numbers, rounded up (the backend judges
// eligibility on this same ceiled value).
export function roundUpPercent(value: number) {
  return Math.ceil(value || 0)
}

export function ordinal(value: string | number) {
  const num = typeof value === "number" ? value : parseInt(value, 10)
  if (num === 1) return "1st"
  if (num === 2) return "2nd"
  if (num === 3) return "3rd"
  return `${num}th`
}

export function getTermLabel(term: string | number) {
  return `${ordinal(term)} Term`
}

export function formatAcademicYear(value: string) {
  const year = parseInt(value, 10)
  return `${year}/${year + 1}`
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}


// -- dates --------------------------------------------------------------
//
// One place for every date the UI prints, so a timestamp reads the same on the
// audit trail as it does on a case. All of them tolerate an empty or
// unparseable value and return the em dash the tables use for "nothing here".

const NO_VALUE = "—"

function parse(value?: string | null): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** A calendar day: "5 Jun 2012". */
export function formatDate(value?: string | null) {
  const date = parse(value)
  if (!date) return NO_VALUE
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

/** A day and a time: "5 Jun 2012, 10:22". Use for anything the system recorded. */
export function formatDateTime(value?: string | null) {
  const date = parse(value)
  if (!date) return NO_VALUE
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** Down to the second — for the audit trail and the logs, where order matters. */
export function formatTimestamp(value?: string | null) {
  const date = parse(value)
  if (!date) return NO_VALUE
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

/** The long form the logs group by: "Monday, 7 September 2026". */
export function formatLongDate(value?: string | null) {
  const date = parse(value)
  if (!date) return NO_VALUE
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

/** Clock time only. */
export function formatTime(value?: string | null) {
  const date = parse(value)
  if (!date) return NO_VALUE
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

/** Whole years since a date of birth, or "" when it is missing or implausible. */
export function ageInYears(dateOfBirth?: string | null) {
  const born = parse(dateOfBirth)
  if (!born) return ""
  const now = new Date()
  let years = now.getFullYear() - born.getFullYear()
  const monthsApart = now.getMonth() - born.getMonth()
  if (monthsApart < 0 || (monthsApart === 0 && now.getDate() < born.getDate())) {
    years -= 1
  }
  return years >= 0 && years < 120 ? String(years) : ""
}
