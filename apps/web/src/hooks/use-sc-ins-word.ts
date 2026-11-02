import { useQuery } from "@tanstack/react-query"

import { getConfig } from "@/api/config"

/**
 * What to call SC-INS students in counts and tier names. A superuser can show
 * their terms as a percentage instead (Settings > Display); then the word
 * SC-INS stops appearing and they are "closed all term" students.
 */
export function useScInsWord() {
  const { data } = useQuery({
    queryKey: ["config"],
    queryFn: getConfig,
    staleTime: Infinity,
    gcTime: Infinity,
  })
  const showsLabel = (data?.sc_ins_display ?? "label") === "label"
  return { showsLabel, word: showsLabel ? "SC-INS" : "closed all term" }
}
