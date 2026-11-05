import { useRef, useState, type PointerEvent, type ReactNode } from "react"

import { ColumnPicker } from "@/components/column-picker"
import { downloadFile, type ExportSpec } from "@/lib/blob-download"

const HOLD_MS = 600

/**
 * A download button: a click gives the usual file, holding it down asks which
 * columns to include. Spread ``press`` on the button and render ``dialog`` once.
 * ``beforeAct`` runs on either, e.g. to close the menu the button sits in.
 */
export function useColumnDownload(spec: ExportSpec, beforeAct?: () => void) {
  const [choosing, setChoosing] = useState(false)
  const holdTimer = useRef<number | undefined>(undefined)
  // The click that follows a hold must not download as well.
  const held = useRef(false)

  const download = (columns?: string[]) =>
    void downloadFile(spec.path, spec.filename, {
      params: { ...spec.params, ...(columns ? { columns: columns.join(",") } : {}) },
    }).catch(() => undefined)

  const stopHolding = () => window.clearTimeout(holdTimer.current)

  const press = {
    title: "Click to download. Hold to choose the columns.",
    onPointerDown: (event: PointerEvent) => {
      held.current = false
      if (event.button !== 0) return
      stopHolding()
      holdTimer.current = window.setTimeout(() => {
        held.current = true
        beforeAct?.()
        setChoosing(true)
      }, HOLD_MS)
    },
    onPointerUp: stopHolding,
    onPointerLeave: stopHolding,
    onPointerCancel: stopHolding,
    // A long press on a phone would open the browser's own menu instead.
    onContextMenu: (event: { preventDefault: () => void }) => event.preventDefault(),
    onClick: () => {
      stopHolding()
      if (held.current) {
        held.current = false
        return
      }
      beforeAct?.()
      download()
    },
  }

  const closePicker = () => {
    held.current = false
    setChoosing(false)
  }

  const dialog: ReactNode = choosing ? (
    <ColumnPicker spec={spec} onClose={closePicker} onDownload={download} />
  ) : null

  return { press, dialog }
}
