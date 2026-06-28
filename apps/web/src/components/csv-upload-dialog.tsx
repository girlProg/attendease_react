import { useState, useRef } from "react"
import { Upload } from "lucide-react"

import {
  Dialog,
  DialogTrigger,
  DialogPopup,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@workspace/ui/components/dialog"
import { PrimaryButton } from "@/components/primary-button"

export function CsvUploadDialog({ onUpload }: { onUpload?: (file: File) => void }) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleUpload() {
    if (file) {
      onUpload?.(file)
      setOpen(false)
      setFile(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
                if (selected) setFile(selected)
              }}
            />
          </div>
          <div className="flex justify-end gap-3">
            <DialogClose
              className="inline-flex h-10 items-center rounded-full border border-border px-6 text-sm font-medium text-muted-foreground hover:bg-muted/50"
            >
              Cancel
            </DialogClose>
            <PrimaryButton
              className="h-10 w-auto px-6"
              disabled={!file}
              onClick={handleUpload}
            >
              Upload
            </PrimaryButton>
          </div>
        </div>
      </DialogPopup>
    </Dialog>
  )
}
