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
