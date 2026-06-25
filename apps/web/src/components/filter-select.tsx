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
}: {
  placeholder: string
  items: string[]
}) {
  return (
    <Select defaultValue={items[0]}>
      <SelectTrigger className="h-11 w-full rounded-full border-border/60 bg-white px-4 font-light shadow-sm">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item} value={item}>
            {item}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
