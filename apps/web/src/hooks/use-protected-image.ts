import { useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"

// Object URLs for fetched images, kept for the life of the page: a list of 300
// students revisits the same ids page after page, and each blob is a few
// kilobytes, so never revoking is the cheaper choice.
const objectUrls = new Map<string, string>()

async function fetchImage(path: string, params?: Record<string, string>): Promise<string> {
  const key = params ? `${path}?${new URLSearchParams(params).toString()}` : path
  const cached = objectUrls.get(key)
  if (cached) return cached
  // These endpoints are LGA-scoped private media behind the JWT, so an <img src>
  // cannot load them directly — fetch the bytes with the auth header.
  const response = await api.get<Blob>(path, { params, responseType: "blob" })
  const url = URL.createObjectURL(response.data)
  objectUrls.set(key, url)
  return url
}

/**
 * Load an image the server only serves to permitted users.
 *
 * `path` is the API path (e.g. `/caregiver/12/photo/`); `enabled` should be
 * false until the row says a local copy exists, so a missing image is not
 * requested at all.
 */
export function useProtectedImage(
  path: string | undefined,
  enabled: boolean,
  params?: Record<string, string>,
) {
  return useQuery({
    queryKey: ["protected-image", path, params],
    queryFn: () => fetchImage(path as string, params),
    enabled: enabled && path !== undefined,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    retry: false,
  })
}

/** The student list's square thumbnail. */
export function useStudentThumbnail(studentId: number | undefined, enabled: boolean) {
  return useProtectedImage(
    studentId === undefined ? undefined : `/student/${studentId}/photo/`,
    enabled,
    { size: "thumb" },
  )
}
