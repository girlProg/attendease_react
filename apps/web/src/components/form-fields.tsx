import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

export function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  disabled?: boolean
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="h-11 rounded-lg border-border/60 !bg-white"
      />
    </div>
  )
}

export function LabeledSelect({
  label,
  value,
  onValueChange,
  items,
  placeholder,
  formatItem,
}: {
  label: string
  value: string
  onValueChange: (value: string | null) => void
  items: string[]
  placeholder: string
  // How an item reads in the list, when the stored value is a code.
  formatItem?: (item: string) => string
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      {/* Always controlled: null is "nothing chosen", so the Select never
          switches from uncontrolled to controlled when a value arrives. */}
      <Select value={value || null} onValueChange={onValueChange}>
        <SelectTrigger className="h-11 w-full rounded-lg border-border/60 !bg-white px-3">
          {/* Show the chosen item as the list does — its label, not its code. */}
          <SelectValue placeholder={placeholder}>
            {value && formatItem ? formatItem(value) : undefined}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item} value={item}>
              {formatItem ? formatItem(item) : item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
