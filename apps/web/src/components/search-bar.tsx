import { useState } from "react"
import { Search } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

interface SearchBarProps {
  placeholder?: string
  onSearch: (value: string) => void
}

export function SearchBar({ placeholder = "Find Student by Name", onSearch }: SearchBarProps) {
  const [value, setValue] = useState("")

  return (
    <div className="relative flex flex-1 items-center">
      <Search className="absolute left-3 size-4 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => event.key === "Enter" && onSearch(value)}
        className="h-11 rounded-full border-sidebar/30 !bg-white pl-9 pr-24 shadow-sm focus-visible:border-sidebar/30 focus-visible:ring-0"
      />
      <Button
        className="absolute right-1.5 h-8 rounded-full bg-sidebar px-5 text-white hover:bg-sidebar/90"
        onClick={() => onSearch(value)}
      >
        Search
      </Button>
    </div>
  )
}
