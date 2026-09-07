import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Phone } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { QueryError } from "@/components/query-error"
import { StudentPhoto } from "@/components/student-photo"
import { Chip } from "@/components/chip"
import { formatDate, formatDateTime } from "@/lib/formatters"
import { OutlookBadge } from "@/components/outlook-badge"
import {
  getCaseDetail,
  getAssignees,
  openCase,
  addCaseNote,
  addFollowUp,
  assignCase,
  treatCase,
  closeCase,
  setDroppedOut,
  FOLLOW_UP_METHODS,
  FOLLOW_UP_REASONS,
  type FollowUpMethod,
  type FollowUpReason,
} from "@/api/cases"

const UNASSIGNED = "__none__"
const NO_REASON = "__none__"

export function CaseDetailPage() {
  const { id } = useParams()
  const studentId = Number(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  // One composer for everything that happens on a case: free text, and —
  // when a contact method is picked — the structured contact fields too.
  const [text, setText] = useState("")
  const [method, setMethod] = useState<FollowUpMethod | "">("")
  const [reached, setReached] = useState(false)
  const [reason, setReason] = useState<FollowUpReason | "">("")
  const [nextActionDate, setNextActionDate] = useState("")

  const { data, isError, isLoading } = useQuery({
    queryKey: ["case-detail", studentId],
    queryFn: () => getCaseDetail(studentId),
  })
  const { data: assignees = [] } = useQuery({ queryKey: ["case-assignees"], queryFn: getAssignees })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["case-detail", studentId] })
    queryClient.invalidateQueries({ queryKey: ["cases"] })
  }

  const resetComposer = () => {
    setText("")
    setMethod("")
    setReached(false)
    setReason("")
    setNextActionDate("")
  }
  // A plain note when no contact method is chosen; a structured follow-up
  // (with the text as its note) when one is.
  const addActivity = useMutation({
    mutationFn: () =>
      method
        ? addFollowUp(studentId, {
            method,
            reached,
            reason,
            next_action_date: nextActionDate || undefined,
            note: text.trim() || undefined,
          })
        : addCaseNote(studentId, text.trim()),
    onSuccess: () => {
      resetComposer()
      refresh()
    },
  })
  const open = useMutation({ mutationFn: () => openCase(studentId), onSuccess: refresh })
  const treat = useMutation({ mutationFn: () => treatCase(studentId), onSuccess: refresh })
  const close = useMutation({ mutationFn: () => closeCase(studentId), onSuccess: refresh })
  const drop = useMutation({
    mutationFn: (dropped: boolean) => setDroppedOut(studentId, dropped),
    onSuccess: refresh,
  })
  const assign = useMutation({
    mutationFn: (userId: number | null) => assignCase(studentId, userId),
    onSuccess: refresh,
  })
  const busy =
    addActivity.isPending ||
    open.isPending ||
    treat.isPending ||
    close.isPending ||
    drop.isPending ||
    assign.isPending
  const canSubmit = Boolean(method) || text.trim().length > 0

  if (isError) return <QueryError />
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading…</p>

  const { student, open_case_id, cases, attendance, timeline, outlook, assigned_to_id } = data
  const hasOpenCase = open_case_id !== null

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate("/cases")}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to cases
      </button>

      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border/40 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <StudentPhoto url={student.photo_url} name={student.name} studentId={student.id} hasPhoto={student.has_photo} />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-sidebar">{student.name}</span>
              {student.dropped_out && <Chip tone="red">Dropped out</Chip>}
              {hasOpenCase && <Chip tone="amber">Open case</Chip>}
              {student.graduated && <Chip tone="gray">Graduated</Chip>}
            </div>
            <p className="text-xs text-muted-foreground">
              {student.current_class || "—"} · {student.school} · {student.lga}
              {student.cohort ? ` · Cohort ${student.cohort}` : ""}
            </p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="size-3.5" />({student.caregiver_phone}) {student.caregiver_name}
              {student.caregiver_relationship && (
                <span className="text-muted-foreground">
                  · {student.caregiver_relationship}
                </span>
              )}
            </p>
            {student.beneficiary_id && (
              <p className="text-[10px] text-muted-foreground">ID: {student.beneficiary_id}</p>
            )}
            {outlook && (
              <div className="pt-1">
                <OutlookBadge row={outlook} detail />
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {!hasOpenCase && (
            <Button className="h-9 rounded-full px-4 text-xs" disabled={busy} onClick={() => open.mutate()}>
              Open case
            </Button>
          )}
          {hasOpenCase && (
            <>
              <Select
                value={assigned_to_id ? String(assigned_to_id) : UNASSIGNED}
                onValueChange={(value) => {
                  if (!value) return
                  assign.mutate(value === UNASSIGNED ? null : Number(value))
                }}
              >
                <SelectTrigger className="h-9 w-44 rounded-full border-border/60 bg-white px-3 text-xs" title="Officer working this case">
                  <SelectValue placeholder="Assign to…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED} className="text-muted-foreground">
                    Unassigned
                  </SelectItem>
                  {assignees.map((person) => (
                    <SelectItem key={person.id} value={String(person.id)}>
                      {person.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                className="h-9 rounded-full bg-emerald-600 px-4 text-xs text-white hover:bg-emerald-700"
                disabled={busy}
                onClick={() => treat.mutate()}
              >
                Mark treated
              </Button>
              <Button
                variant="outline"
                className="h-9 rounded-full border-sidebar/40 !bg-white px-4 text-xs text-sidebar"
                disabled={busy}
                onClick={() => close.mutate()}
              >
                Close case
              </Button>
            </>
          )}
          <Button
            variant="outline"
            className={`h-9 rounded-full !bg-white px-4 text-xs ${
              student.dropped_out ? "border-sidebar/40 text-sidebar" : "border-red-300 text-red-600 hover:bg-red-50"
            }`}
            disabled={busy}
            onClick={() => drop.mutate(!student.dropped_out)}
          >
            {student.dropped_out ? "Restore student" : "Mark dropped out"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Timeline + notes */}
        <div className="space-y-4 rounded-2xl border border-border/40 bg-white p-5">
          <h2 className="text-sm font-semibold text-sidebar">Activity</h2>

          {hasOpenCase ? (
            <div className="space-y-3 rounded-xl border border-border/60 p-3">
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={
                  method
                    ? "What was said or agreed (optional)"
                    : "Write a note, or pick how you contacted the caregiver below…"
                }
                rows={3}
                className="w-full rounded-lg border border-border/60 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
              />

              {/* Contact chips: none selected = a plain note */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[11px] font-medium text-muted-foreground">Contact made:</span>
                <button
                  type="button"
                  onClick={() => setMethod("")}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    method === ""
                      ? "border-sidebar bg-sidebar text-white"
                      : "border-border/60 bg-white text-muted-foreground hover:border-sidebar/60"
                  }`}
                >
                  None (just a note)
                </button>
                {FOLLOW_UP_METHODS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setMethod(option.value)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      method === option.value
                        ? "border-sky-600 bg-sky-600 text-white"
                        : "border-border/60 bg-white text-muted-foreground hover:border-sky-400"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {method && (
                <div className="grid grid-cols-1 gap-2 rounded-lg bg-sky-50 p-3 sm:grid-cols-3">
                  <label className="flex h-9 items-center gap-2 rounded-lg border border-sky-200 bg-white px-3 text-xs text-foreground">
                    <input
                      type="checkbox"
                      className="size-4 accent-sky-600"
                      checked={reached}
                      onChange={(event) => setReached(event.target.checked)}
                    />
                    Caregiver reached
                  </label>
                  <Select
                    value={reason || NO_REASON}
                    onValueChange={(value) => setReason(!value || value === NO_REASON ? "" : (value as FollowUpReason))}
                  >
                    <SelectTrigger className="h-9 rounded-lg border-sky-200 bg-white px-3 text-xs">
                      <SelectValue placeholder="Reason for absence" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_REASON} className="text-muted-foreground">
                        Reason not yet known
                      </SelectItem>
                      {FOLLOW_UP_REASONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <label className="flex h-9 items-center gap-2 rounded-lg border border-sky-200 bg-white px-3 text-xs text-muted-foreground">
                    Next action
                    <input
                      type="date"
                      value={nextActionDate}
                      onChange={(event) => setNextActionDate(event.target.value)}
                      className="flex-1 bg-transparent text-xs text-foreground focus:outline-none"
                    />
                  </label>
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] text-muted-foreground">
                  {method
                    ? "Saved as a contact: it counts in the reasons-for-absence reporting."
                    : "Saved as a note on the case."}
                </p>
                <Button
                  className="h-9 rounded-full px-5 text-xs"
                  disabled={busy || !canSubmit}
                  onClick={() => addActivity.mutate()}
                >
                  {addActivity.isPending ? "Saving…" : method ? "Save contact" : "Add note"}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Open a case to record activity.</p>
          )}

          <ul className="space-y-3">
            {timeline.length === 0 ? (
              <li className="text-xs text-muted-foreground">No activity yet.</li>
            ) : (
              timeline.map((entry, index) => (
                <li key={index} className="flex gap-3">
                  <span
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${
                      entry.type === "event"
                        ? "bg-brand"
                        : entry.type === "follow_up"
                          ? "bg-sky-500"
                          : "bg-muted-foreground/40"
                    }`}
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    {entry.type === "follow_up" && entry.follow_up ? (
                      <>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Chip tone="sky">{entry.follow_up.method_label}</Chip>
                          <Chip tone={entry.follow_up.reached ? "green" : "gray"}>
                            {entry.follow_up.reached ? "Caregiver reached" : "Not reached"}
                          </Chip>
                          {entry.follow_up.reason_label && <Chip tone="amber">{entry.follow_up.reason_label}</Chip>}
                          {entry.follow_up.next_action_date && (
                            <span className="text-[10px] text-muted-foreground">
                              next action {formatDate(entry.follow_up.next_action_date)}
                            </span>
                          )}
                        </div>
                        {entry.follow_up.note && <p className="text-sm text-foreground">{entry.follow_up.note}</p>}
                      </>
                    ) : (
                      <p className={`text-sm ${entry.type === "event" ? "text-muted-foreground" : "text-foreground"}`}>
                        {entry.text}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      {formatDateTime(entry.at)}
                      {entry.author ? ` · ${entry.author}` : ""}
                      {entry.type === "event" ? " · system" : ""}
                    </p>
                  </div>
                </li>
              ))
            )}
          </ul>

          {cases.length > 0 && (
            <div className="border-t border-border/40 pt-3">
              <p className="mb-2 text-[10px] font-semibold uppercase text-muted-foreground">
                Case history
              </p>
              <ul className="space-y-1">
                {cases.map((c) => (
                  <li key={c.id} className="text-xs text-muted-foreground">
                    <span className="font-medium capitalize text-foreground">{c.status}</span> —
                    opened {formatDate(c.opened_at)}
                    {c.opened_by ? ` by ${c.opened_by}` : ""}
                    {c.resolved_at ? `, resolved ${formatDate(c.resolved_at)}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Attendance history */}
        <div className="space-y-3 rounded-2xl border border-border/40 bg-white p-5">
          <h2 className="text-sm font-semibold text-sidebar">Attendance history</h2>
          <div className="max-h-[28rem] overflow-y-auto rounded-xl border border-border/40">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-xs font-semibold text-sidebar">Year</TableHead>
                  <TableHead className="text-xs font-semibold text-sidebar">Week</TableHead>
                  <TableHead className="text-center text-xs font-semibold text-sidebar">%</TableHead>
                  <TableHead className="text-xs font-semibold text-sidebar">Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendance.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-xs text-muted-foreground">
                      No attendance recorded.
                    </TableCell>
                  </TableRow>
                ) : (
                  attendance.map((a, index) => (
                    <TableRow key={index} className="border-border/40">
                      <TableCell className="text-xs text-muted-foreground">{a.year ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{a.label}</TableCell>
                      <TableCell
                        className={`text-center text-xs font-semibold ${
                          a.percent < 30 ? "text-red-600" : a.percent < 70 ? "text-amber-600" : "text-emerald-600"
                        }`}
                      >
                        {a.percent}%
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{a.reason || "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  )
}
