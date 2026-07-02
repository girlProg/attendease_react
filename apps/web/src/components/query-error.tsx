export function QueryError({
  message = "Failed to load data. Please try again.",
}: {
  message?: string
}) {
  return (
    <p className="rounded-lg bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-600">
      {message}
    </p>
  )
}
