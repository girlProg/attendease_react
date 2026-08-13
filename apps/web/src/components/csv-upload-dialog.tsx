import { useState, useRef } from "react"
import { Upload, CheckCircle, AlertCircle } from "lucide-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import {
  Dialog,
  DialogTrigger,
  DialogPopup,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@workspace/ui/components/dialog"
import { PrimaryButton } from "@/components/primary-button"
import { uploadAttendanceCsv } from "@/api/attendance"

export function CsvUploadDialog() {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [verify, setVerify] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const uploadMutation = useMutation({
    mutationFn: ({ file, verify }: { file: File; verify: boolean }) =>
      uploadAttendanceCsv(file, verify),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-map"] })
      queryClient.invalidateQueries({ queryKey: ["students"] })
      queryClient.invalidateQueries({ queryKey: ["attendance"] })
      queryClient.invalidateQueries({ queryKey: ["attendance-summary"] })
      queryClient.invalidateQueries({ queryKey: ["attendance-popup"] })
      queryClient.invalidateQueries({ queryKey: ["students-summary"] })
      setTimeout(() => {
        setOpen(false)
        setFile(null)
        uploadMutation.reset()
      }, 2000)
    },
  })

  function handleUpload() {
    if (file) {
      uploadMutation.mutate({ file, verify })
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      setFile(null)
      setVerify(false)
      uploadMutation.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-6 text-white hover:bg-brand/90"
      >
        <Upload className="size-4" />
        Upload CSV Data
      </DialogTrigger>
      <DialogPopup>
        <DialogTitle>Upload CSV File</DialogTitle>
        <DialogDescription>
          Select a CSV file to upload attendance data.
        </DialogDescription>
        <div className="mt-6 space-y-4">
          <div
            className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-sidebar/30 p-8 transition-colors hover:border-sidebar/60"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-8 text-sidebar/50" />
            <p className="text-sm font-medium text-foreground">
              {file ? file.name : "Click to select a CSV file"}
            </p>
            {file && (
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(event) => {
                const selected = event.target.files?.[0]
                if (selected) {
                  setFile(selected)
                  uploadMutation.reset()
                }
              }}
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 p-3">
            <input
              type="checkbox"
              checked={verify}
              onChange={(event) => setVerify(event.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-brand"
            />
            <span className="text-sm">
              <span className="font-medium text-foreground">
                Mark these students as verified
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Optional. Recording attendance confirms the student is at this
                school, so each student in the file is also marked verified.
                Verified students are the ones shown and counted for the 2nd
                cohort. Leave unticked to only record attendance.
              </span>
            </span>
          </label>

          {uploadMutation.isSuccess && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
              <CheckCircle className="size-4 shrink-0" />
              CSV uploaded successfully
              {verify ? " (students marked verified)." : "."}
            </div>
          )}

          {uploadMutation.isError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="size-4 shrink-0" />
              {(uploadMutation.error as Error)?.message ?? "Upload failed. Please try again."}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <DialogClose
              className="inline-flex h-10 items-center rounded-full border border-border px-6 text-sm font-medium text-muted-foreground hover:bg-muted/50"
            >
              Cancel
            </DialogClose>
            <PrimaryButton
              className="h-10 w-auto px-6"
              disabled={!file || uploadMutation.isPending || uploadMutation.isSuccess}
              onClick={handleUpload}
            >
              {uploadMutation.isPending ? "Uploading..." : "Upload"}
            </PrimaryButton>
          </div>
        </div>
      </DialogPopup>
    </Dialog>
  )
}
