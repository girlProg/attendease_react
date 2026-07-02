import type { AxiosResponse } from "axios"

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
}
