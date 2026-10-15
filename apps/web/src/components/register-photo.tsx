import { useRef, useState } from "react"
import { AlertTriangle, Camera } from "lucide-react"

import { Dialog, DialogPopup, DialogTitle, DialogDescription } from "@workspace/ui/components/dialog"
import { PrimaryButton } from "@/components/primary-button"
import registerSample from "@/assets/register-sample.jpg"
import { REGISTER_ACCEPT, useSmallPhotos } from "@/hooks/use-small-photos"

export function SmallPhotoWarning({ files }: { files: File[] }) {
  if (files.length === 0) return null
  return (
    <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>
        {files.length === 1 ? `${files[0].name} looks` : `${files.length} photos look`} too small to
        read every name and tick. Please retake {files.length === 1 ? "it" : "them"} closer, or
        upload anyway if this is the best you have.
      </span>
    </p>
  )
}

export function RegisterPhotoTips() {
  return (
    <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
      <li>Use a high-quality photo: in focus, well lit, no shadow or glare.</li>
      <li>Lay the register flat and take the photo from directly above.</li>
      <li>Every name, number and week column must be visible and readable.</li>
      <li>If the register runs over several pages, add a photo of each page.</li>
    </ul>
  )
}

/**
 * Shown after attendance is saved without a register photo: asks for the
 * register that week's attendance was recorded in, with a sample of what a
 * good photo looks like. Optional — "Skip for now" just closes it. Give it a
 * fresh `key` per request so a new week starts with no photos chosen.
 */
export function RegisterRequestDialog({
  open,
  week,
  isUploading,
  error,
  onUpload,
  onSkip,
}: {
  open: boolean
  week: string
  isUploading: boolean
  error: string | null
  onUpload: (files: File[]) => void
  onSkip: () => void
}) {
  const [files, setFiles] = useState<File[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const small = useSmallPhotos(files)

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !isUploading && onSkip()}>
      <DialogPopup className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogTitle>Upload the register for {week}</DialogTitle>
        <DialogDescription>
          Attendance is saved. Please also upload a photo of the school register you recorded it
          in, with this week filled in. It replaces the register photos already saved for this
          term.
        </DialogDescription>

        <div className="mt-4 space-y-4">
          <figure className="space-y-1">
            <img
              src={registerSample}
              alt="Sample photo of a school attendance register, taken flat and from above"
              className="max-h-80 w-full rounded-lg border border-border/40 object-contain"
            />
            <figcaption className="text-center text-[11px] text-muted-foreground">
              A good register photo: the whole page, flat, sharp and readable.
            </figcaption>
          </figure>

          <RegisterPhotoTips />

          <input
            ref={inputRef}
            type="file"
            multiple
            accept={REGISTER_ACCEPT}
            className="hidden"
            onChange={(event) => {
              setFiles(Array.from(event.target.files ?? []))
              event.target.value = ""
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed border-sidebar/30 p-5 text-sm transition-colors hover:border-sidebar/60"
          >
            <Camera className="size-6 text-sidebar/60" />
            {files.length === 0 ? (
              <span className="font-medium text-foreground">Choose register photo(s)</span>
            ) : (
              <span className="break-all font-medium text-foreground">
                {files.length === 1 ? files[0].name : `${files.length} photos chosen`}
              </span>
            )}
          </button>

          <SmallPhotoWarning files={small} />
          {error && <p className="rounded-lg bg-red-50 p-3 text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-3">
            <PrimaryButton
              className="w-auto bg-muted px-6 text-foreground hover:bg-muted/80"
              disabled={isUploading}
              onClick={onSkip}
            >
              Skip for now
            </PrimaryButton>
            <PrimaryButton
              className="w-auto px-6"
              disabled={files.length === 0 || isUploading}
              onClick={() => onUpload(files)}
            >
              {isUploading ? "Uploading…" : small.length ? "Upload anyway" : "Upload register"}
            </PrimaryButton>
          </div>
        </div>
      </DialogPopup>
    </Dialog>
  )
}
