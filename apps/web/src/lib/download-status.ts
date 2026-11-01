import { useSyncExternalStore } from "react"

// What the download notice in the corner shows. A download is fetched whole
// before the browser saves it, so without this nothing shows that a click
// did anything until the file appears.
export interface DownloadNotice {
  id: number
  filename: string
  state: "preparing" | "done" | "failed"
  // Bytes received so far, while preparing.
  received: number
}

let notices: DownloadNotice[] = []
let nextId = 1
const listeners = new Set<() => void>()

function publish(next: DownloadNotice[]) {
  notices = next
  listeners.forEach((listener) => listener())
}

function update(id: number, changes: Partial<DownloadNotice>) {
  publish(
    notices.map((notice) =>
      notice.id === id ? { ...notice, ...changes } : notice
    )
  )
}

export function dismissDownload(id: number) {
  publish(notices.filter((notice) => notice.id !== id))
}

/** Show a notice for a download; returns how to move it along. */
export function startDownload(filename: string) {
  const id = nextId++
  publish([...notices, { id, filename, state: "preparing", received: 0 }])
  return {
    progress: (received: number) => update(id, { received }),
    done: (savedAs: string) => {
      update(id, { state: "done", filename: savedAs })
      setTimeout(() => dismissDownload(id), 4000)
    },
    failed: () => {
      update(id, { state: "failed" })
      setTimeout(() => dismissDownload(id), 8000)
    },
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useDownloadNotices() {
  return useSyncExternalStore(subscribe, () => notices)
}
