import { useEffect, useState } from "react"
import { ChevronDown, GraduationCap, Search } from "lucide-react"

import type { SchoolPayout, SchoolPayoutStatus } from "@/api/payments"

const CHIP: Record<SchoolPayoutStatus, { pill: string; dot: string }> = {
  running: { pill: "bg-sidebar/10 text-sidebar", dot: "bg-sidebar/60" },
  failed: { pill: "bg-red-50 text-red-700", dot: "bg-orange-500" },
  paid: { pill: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  partial: { pill: "bg-sky-50 text-sky-700", dot: "bg-sky-400" },
  not_started: { pill: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/40" },
  nobody: { pill: "bg-white text-muted-foreground/70 ring-1 ring-border", dot: "bg-muted-foreground/30" },
}

function chipLabel(payout: SchoolPayout) {
  switch (payout.status) {
    case "running":
      return "Payout running"
    case "failed":
      return `${payout.failed} failed`
    case "paid":
      return "Paid"
    case "partial":
      return `${payout.paid} of ${payout.students} paid`
    case "not_started":
      return "Not started"
    default:
      return "No one to pay"
  }
}

/**
 * The scope bar's school cell: opens every school of the LGA with where its
 * payout for the term is, still-to-pay first, and a search box.
 */
export function SchoolPicker({
  schools,
  value,
  onPick,
  disabled,
  payouts,
  lga,
  noObjection,
  studentCount,
}: {
  // The school names the filter bar offers for the LGA (and cohort).
  schools: string[]
  value?: string
  onPick: (value: string) => void
  disabled?: boolean
  // Each school's payout, once cohort, LGA, session and term are chosen.
  payouts?: SchoolPayout[]
  lga?: string
  // The students counted are those on a No Objection list.
  noObjection: boolean
  studentCount?: number
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  useEffect(() => {
    if (!open) return
    const close = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", close)
    return () => window.removeEventListener("keydown", close)
  }, [open])

  // The server's order (still to pay first), then any school it didn't list.
  const byName = new Map((payouts ?? []).map((payout) => [payout.name, payout]))
  const ordered = [
    ...(payouts ?? []).map((payout) => payout.name).filter((name) => schools.includes(name)),
    ...schools.filter((name) => !byName.has(name)).sort(),
  ].filter((name, index, names) => names.indexOf(name) === index)
  const term = search.trim().toLowerCase()
  const shown = term ? ordered.filter((name) => name.toLowerCase().includes(term)) : ordered
  const withPupils = (payouts ?? []).filter((payout) => payout.status !== "nobody")
  const paidCount = withPupils.filter((payout) => payout.status === "paid").length

  const pick = (name: string) => {
    onPick(name)
    setOpen(false)
    setSearch("")
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled || schools.length === 0}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="School"
        onClick={() => setOpen((current) => !current)}
        className="flex h-[30px] w-full min-w-0 items-center gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60"
      >
        <GraduationCap className="size-[18px] shrink-0 text-sidebar" />
        <span
          className={`min-w-0 flex-1 truncate text-[13.5px] ${
            value ? "font-semibold text-sidebar-accent-foreground" : "font-medium text-muted-foreground"
          }`}
        >
          {value ?? (disabled ? "Choose an LGA first" : "Choose school")}
        </span>
        {value && studentCount !== undefined && (
          <span className="shrink-0 text-[11.5px] font-medium text-muted-foreground">
            {studentCount.toLocaleString()} student{studentCount === 1 ? "" : "s"}
          </span>
        )}
        <ChevronDown className={`size-4 shrink-0 text-muted-foreground/70 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close the school list"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-[calc(100%+10px)] right-0 z-40 w-[480px] max-w-[calc(100vw-2rem)] rounded-2xl bg-white p-2.5 shadow-[0_22px_50px_rgb(33_29_82/0.20),0_2px_6px_rgb(33_29_82/0.08)]">
            <label className="flex h-10 items-center gap-2 rounded-[11px] border-[1.5px] border-sidebar/25 px-3">
              <Search className="size-[18px] shrink-0 text-sidebar" />
              {/* Not focused on open: on a phone that raised the keyboard and
                  zoomed in. 16px on phones so tapping in doesn't zoom either. */}
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={`Search ${ordered.length} school${ordered.length === 1 ? "" : "s"}${lga ? ` in ${lga}` : ""}`}
                className="min-w-0 flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground/70 focus:outline-none sm:text-[13px]"
              />
            </label>
            <div className="flex items-center px-2 pt-2.5 pb-1.5 text-[11px] text-muted-foreground">
              <span>{payouts ? "Still to pay first" : "Choose a cohort, session and term to see each school's payout"}</span>
              {payouts && (
                <span className="ml-auto">
                  {paidCount} of {withPupils.length} paid
                </span>
              )}
            </div>
            <div role="listbox" className="max-h-[360px] overflow-y-auto">
              {value && !term && (
                <button
                  type="button"
                  onClick={() => pick("__clear__")}
                  className="flex w-full items-center rounded-[11px] px-2.5 py-2 text-left text-[13px] text-muted-foreground hover:bg-sidebar/5"
                >
                  Any school in {lga ?? "the LGA"}
                </button>
              )}
              {shown.map((name) => {
                const payout = byName.get(name)
                const chosen = name === value
                return (
                  <button
                    key={name}
                    type="button"
                    role="option"
                    aria-selected={chosen}
                    onClick={() => pick(name)}
                    className={`flex w-full items-center gap-3 rounded-[11px] px-2.5 py-2 text-left hover:bg-sidebar/5 ${
                      chosen ? "bg-sidebar/5 shadow-[inset_3px_0_0_var(--sidebar)]" : ""
                    }`}
                  >
                    <span className="flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-sidebar/5 text-sidebar">
                      <GraduationCap className="size-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-sidebar-accent-foreground">{name}</span>
                      {payout && (
                        <span className="block text-[11.5px] text-muted-foreground">
                          {payout.students.toLocaleString()} student{payout.students === 1 ? "" : "s"}{" "}
                          {noObjection ? "on No Objection list" : "qualifying"}
                        </span>
                      )}
                    </span>
                    {payout && (
                      <span
                        className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${CHIP[payout.status].pill}`}
                      >
                        <span className={`size-1.5 rounded-full ${CHIP[payout.status].dot}`} />
                        {chipLabel(payout)}
                      </span>
                    )}
                  </button>
                )
              })}
              {shown.length === 0 && (
                <p className="px-2.5 py-6 text-center text-[13px] text-muted-foreground">No school matches.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
