import type { AxiosRequestConfig, AxiosResponse } from "axios"

import { api } from "@/lib/api"
import { startDownload } from "@/lib/download-status"

/** Save a fetched file; returns the name it was saved under. */
export function downloadBlobFromResponse(response: AxiosResponse, defaultFilename: string) {
  const contentDisposition = response.headers["content-disposition"] ?? ""
  const filenameMatch = contentDisposition.match(/filename[^;=\n]*=["']?([^"';\n]+)/)
  const filename = filenameMatch?.[1] ?? defaultFilename

  const contentType = response.headers["content-type"] as string | undefined
  const blob = new Blob([response.data], { ...(contentType && { type: contentType }) })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.setAttribute("download", filename)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
  return filename
}

/**
 * Fetch a file and save it, with a notice in the corner from the click until
 * the file is saved (or the download fails). Every download button goes
 * through here.
 */
export async function downloadFile(
  path: string,
  defaultFilename: string,
  config: AxiosRequestConfig = {}
) {
  const notice = startDownload(defaultFilename)
  try {
    const response = await api.get(path, {
      ...config,
      responseType: "blob",
      onDownloadProgress: (event) => notice.progress(event.loaded),
    })
    notice.done(downloadBlobFromResponse(response, defaultFilename))
  } catch (error) {
    notice.failed()
    throw error
  }
}
