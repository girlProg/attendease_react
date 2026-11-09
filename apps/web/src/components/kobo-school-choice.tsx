import { useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { getLGAs, getSchools } from "@/api/attendance"

// Kobo sends an LGA as its form code ("BIRNIN_GWARI"), the MIS as a name.
function sameLga(first: string, second: string): boolean {
  const letters = (text: string) => text.toLowerCase().replace(/[^a-z]/g, "")
  return letters(first) === letters(second)
}

/** A school on a Kobo form that isn't on the MIS: pick the real one, or accept it as new. */
export function KoboSchoolChoice({
  lga,
  disabled,
  onUse,
  onAdd,
}: {
  // The LGA as the form sent it.
  lga: string
  disabled: boolean
  onUse: (school: number) => void
  onAdd: () => void
}) {
  const [school, setSchool] = useState("")
  const lgas = useQuery({ queryKey: ["lgas"], queryFn: getLGAs })
  const match = lgas.data?.find((item) => sameLga(item.name, lga))
  const schools = useQuery({
    queryKey: ["schools", match?.id],
    queryFn: () => getSchools(match?.id),
    enabled: Boolean(match),
  })
  const chosen = schools.data?.find((item) => String(item.id) === school)

  return (
    <div className="flex min-w-56 flex-col gap-2">
      <Select value={school} onValueChange={(value) => setSchool(value ?? "")}>
        <SelectTrigger aria-label="School on the MIS" className="w-full">
          <SelectValue>{chosen?.name ?? "Choose a school on the MIS"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {schools.data?.map((item) => (
            <SelectItem key={item.id} value={String(item.id)}>
              {item.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" disabled={!school || disabled} onClick={() => onUse(Number(school))}>
        Use this school
      </Button>
      <Button size="sm" variant="outline" disabled={disabled} onClick={onAdd}>
        Add as a new school
      </Button>
    </div>
  )
}
