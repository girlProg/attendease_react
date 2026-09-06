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

function Badge({ tone, children }: { tone: "red" | "amber" | "green" | "gray"; children: React.ReactNode }) {
  const tones = {
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-700",
    green: "bg-emerald-100 text-emerald-700",
    gray: "bg-muted text-muted-foreground",
  }
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tones[tone]}`}>{children}</span>
}

export function CaseDetailPage() {
  const { id } = useParams()
  const studentId = Number(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [note, setNote] = useState("")
  // Structured follow-up form (logged against the open case).
  const [method, setMethod] = useState<FollowUpMethod>("call")
  const [reached, setReached] = useState(false)
  const [reason, setReason] = useState<FollowUpReason | "">("")
  const [nextActionDate, setNextActionDate] = useState("")
  const [followUpNote, setFollowUpNote] = useState("")

  const { data, isError, isLoading } = useQuery({
    queryKey: ["case-detail", studentId],
    queryFn: () => getCaseDetail(studentId),
  })
  const { data: assignees = [] } = useQuery({ queryKey: ["case-assignees"], queryFn: getAssignees })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["case-detail", studentId] })
    queryClient.invalidateQueries({ queryKey: ["cases"] })
  }

  const addNote = useMutation({
    mutationFn: () => addCaseNote(studentId, note.trim()),
    onSuccess: () => {
      setNote("")
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
  const logFollowUp = useMutation({
    mutationFn: () =>
      addFollowUp(studentId, {
        method,
        reached,
        reason,
        next_action_date: nextActionDate || undefined,
        note: followUpNote.trim() || undefined,
      }),
    onSuccess: () => {
      setReached(false)
      setReason("")
      setNextActionDate("")
      setFollowUpNote("")
      refresh()
    },
  })
  const assign = useMutation({
    mutationFn: (userId: number | null) => assignCase(studentId, userId),
    onSuccess: refresh,
  })
  const busy =
    addNote.isPending ||
    open.isPending ||
    treat.isPending ||
    close.isPending ||
    drop.isPending ||
    logFollowUp.isPending ||
    assign.isPending

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
              {student.dropped_out && <Badge tone="red">Dropped out</Badge>}
              {hasOpenCase && <Badge tone="amber">Open case</Badge>}
              {student.graduated && <Badge tone="gray">Graduated</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              {student.current_class || "—"} · {student.school} · {student.lga}
              {student.cohort ? ` · Cohort ${student.cohort}` : ""}
            </p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="size-3.5" />({student.caregiver_phone}) {student.caregiver_name}
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
          <h2 className="text-sm font-semibold text-sidebar">Case timeline</h2>

          {hasOpenCase && (
            <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
              <p className="text-xs font-semibold text-foreground">Log a follow-up</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Select value={method} onValueChange={(value) => value && setMethod(value as FollowUpMethod)}>
                  <SelectTrigger className="h-9 rounded-lg border-border/60 bg-white px-3 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FOLLOW_UP_METHODS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={reason || NO_REASON}
                  onValueChange={(value) => setReason(!value || value === NO_REASON ? "" : (value as FollowUpReason))}
                >
                  <SelectTrigger className="h-9 rounded-lg border-border/60 bg-white px-3 text-xs">
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
                <label className="flex h-9 items-center gap-2 rounded-lg border border-border/60 bg-white px-3 text-xs text-foreground">
                  <input
                    type="checkbox"
                    className="size-4 accent-sidebar"
                    checked={reached}
                    onChange={(event) => setReached(event.target.checked)}
                  />
                  Caregiver reached
                </label>
                <label className="flex h-9 items-center gap-2 rounded-lg border border-border/60 bg-white px-3 text-xs text-muted-foreground">
                  Next action
                  <input
                    type="date"
                    value={nextActionDate}
                    onChange={(event) => setNextActionDate(event.target.value)}
                    className="flex-1 bg-transparent text-xs text-foreground focus:outline-none"
                  />
                </label>
              </div>
              <textarea
                value={followUpNote}
                onChange={(event) => setFollowUpNote(event.target.value)}
                placeholder="What was said or agreed (optional)"
                rows={2}
                className="w-full rounded-lg border border-border/60 bg-white p-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand/40"
              />
              <div className="flex justify-end">
                <Button className="h-8 rounded-full px-4 text-xs" disabled={busy} onClick={() => logFollowUp.mutate()}>
                  {logFollowUp.isPending ? "Saving…" : "Log follow-up"}
                </Button>
              </div>
            </div>
          )}

          {hasOpenCase ? (
            <div className="space-y-2">
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Add a note (home visit, phone call, action taken…)"
                rows={3}
                className="w-full rounded-xl border border-border/60 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
              />
              <div className="flex justify-end">
                <Button
                  className="h-9 rounded-full px-5 text-xs"
                  disabled={busy || !note.trim()}
                  onClick={() => addNote.mutate()}
                >
                  Add note
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Open a case to add notes.</p>
          )}

          <ul className="space-y-3">
            {timeline.length === 0 ? (
              <li className="text-xs text-muted-foreground">No activity yet.</li>
            ) : (
              timeline.map((entry, index) => (
                <li key={index} className="flex gap-3">
                  <span
                    className={`mt-1 size-2 shrink-0 rounded-full ${
                      entry.type === "event"
                        ? "bg-brand"
                        : entry.type === "follow_up"
                          ? "bg-sky-500"
                          : "bg-muted-foreground/40"
                    }`}
                  />
                  <div className="space-y-0.5">
                    <p className="text-sm text-foreground">{entry.text}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(entry.at).toLocaleString()}
                      {entry.author ? ` · ${entry.author}` : ""}
                      {entry.type === "event" ? " · system" : entry.type === "follow_up" ? " · follow-up" : ""}
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
                    opened {new Date(c.opened_at).toLocaleDateString()}
                    {c.opened_by ? ` by ${c.opened_by}` : ""}
                    {c.resolved_at ? `, resolved ${new Date(c.resolved_at).toLocaleDateString()}` : ""}
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
