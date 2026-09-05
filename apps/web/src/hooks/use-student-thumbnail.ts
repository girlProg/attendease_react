import { useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"

// Object URLs for fetched thumbnails, kept for the life of the page: a list
// of 300 students revisits the same ids page after page, and each blob is a
// few kilobytes, so never revoking is the cheaper choice.
const objectUrls = new Map<string, string>()

async function fetchThumbnail(studentId: number): Promise<string> {
  const key = `thumb:${studentId}`
  const cached = objectUrls.get(key)
  if (cached) return cached
  // The photo endpoint is LGA-scoped private media behind the JWT, so an
  // <img src> cannot load it directly — fetch the bytes with the auth header.
  const response = await api.get<Blob>(`/student/${studentId}/photo/`, {
    params: { size: "thumb" },
    responseType: "blob",
  })
  const url = URL.createObjectURL(response.data)
  objectUrls.set(key, url)
  return url
}

export function useStudentThumbnail(studentId: number | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["student-thumbnail", studentId],
    queryFn: () => fetchThumbnail(studentId as number),
    enabled: enabled && studentId !== undefined,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    retry: false,
  })
}
