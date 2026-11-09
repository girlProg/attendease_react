/**
 * The app's tab strip. Several tabs overflow a phone screen, so on small viewports
 * it scrolls sideways (bleeding to the screen edge to hint at it) instead of
 * pushing the whole page wide.
 */
export function PillTabs<Value extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly { value: Value; label: string; count?: number }[]
  active: Value
  onChange: (value: Value) => void
}) {
  return (
    <div className="-mx-4 flex justify-start overflow-x-auto px-4 pt-2 [scrollbar-width:none] sm:mx-0 sm:justify-center sm:px-0 [&::-webkit-scrollbar]:hidden">
      <div className="inline-flex shrink-0 items-center rounded-full border border-brand/40 bg-white p-1">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            aria-pressed={active === tab.value}
            onClick={() => onChange(tab.value)}
            className={
              active === tab.value
                ? "whitespace-nowrap rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors sm:px-6"
                : "whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:px-6"
            }
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1.5 text-xs font-semibold">{tab.count.toLocaleString()}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
