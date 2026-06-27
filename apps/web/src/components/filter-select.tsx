import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

export function FilterSelect({
  placeholder,
  items,
  value,
  onValueChange,
  disabled,
}: {
  placeholder: string
  items: string[]
  value?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
}) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled || items.length === 0}>
      <SelectTrigger className="h-11 w-full rounded-full border-border/60 bg-white px-4 font-light shadow-sm">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="min-w-[var(--radix-select-trigger-width)]">
        {items.map((item) => (
          <SelectItem key={item} value={item}>
            {item}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
