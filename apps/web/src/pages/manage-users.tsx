import { useNavigate } from "react-router-dom"
import { Plus } from "lucide-react"
import { useQuery, keepPreviousData } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { PaginationBar } from "@/components/pagination-bar"
import { QueryError } from "@/components/query-error"
import { TableEmptyState } from "@/components/table-empty-state"
import { useAuth } from "@/contexts/auth-context"
import { useLogVisit } from "@/hooks/use-log-visit"
import { usePagination } from "@/hooks/use-pagination"
import { api } from "@/lib/api"
import type { PaginatedResponse, AppUser } from "@/types"

const getUsers = (page: number, pageSize: number) =>
  api.get<PaginatedResponse<AppUser>>("/user/", {
    params: { page, page_size: pageSize },
  }).then((response) => response.data)

function formatLastActive(dateString: string | null) {
  if (!dateString) return "—"
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }) + " - " + date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

export function ManageUsersPage() {
  useLogVisit("Manage Users", "Visited Manage Users")
  const { canWrite } = useAuth()
  const navigate = useNavigate()
  const { page, setPage, pageSize, handleRowsChange } = usePagination([], 10)

  const { data, isError } = useQuery({
    queryKey: ["users", page, pageSize],
    queryFn: () => getUsers(page, pageSize),
    placeholderData: keepPreviousData,
  })

  const records = data?.results ?? []
  const totalPages = data ? Math.ceil(data.count / pageSize) : 0

  return (
    <div className="space-y-6">
      {/* Add New User */}
      {canWrite && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            className="h-11 gap-2 rounded-full border-sidebar !bg-white px-5 text-sidebar hover:bg-sidebar/5"
            onClick={() => navigate("/manage-users/new")}
          >
            <Plus className="size-4" />
            Add New User
          </Button>
        </div>
      )}

      {/* Pagination */}
      <PaginationBar
        totalPages={totalPages}
        currentPage={page}
        onPageChange={setPage}
        rowOptions={["10", "25", "50"]}
        defaultRows={String(pageSize)}
        onRowsChange={handleRowsChange}
      />

      {isError && <QueryError />}

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-border/40 bg-white">
        <Table>
          <TableHeader>
            <TableRow className="border-border/40 bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-16 text-center text-xs font-semibold text-sidebar">S/N</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Photo</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">First Name</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Last Name</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Email</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Phone</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">LGAs</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Last Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableEmptyState colSpan={8} />
            ) : records.map((record, index) => (
              <TableRow key={record.id} className="cursor-pointer border-border/40 hover:bg-muted/20" onClick={() => navigate(`/manage-users/${record.id}`)}>
                <TableCell className="text-center text-xs text-muted-foreground">
                  {(page - 1) * pageSize + index + 1}
                </TableCell>
                <TableCell>
                  <div className="size-10 shrink-0 overflow-hidden rounded-full bg-muted">
                    {record.photo ? (
                      <img src={record.photo} alt="" className="size-full object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center text-muted-foreground">
                        <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                        </svg>
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-xs font-semibold text-foreground">{record.first_name}</TableCell>
                <TableCell className="text-xs font-semibold text-foreground">{record.last_name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{record.email}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{record.phone_number}</TableCell>
                <TableCell className="text-xs font-semibold text-brand">
                  {record.lgas.length === 0 ? "ALL LGAs" : record.lgas.join(", ")}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatLastActive(record.last_active)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
