export interface AppConfig {
  /** Short product name shown next to the logo (sidebar, login) */
  appName: string
  /** Full deployment title — browser tab, login welcome heading */
  appTitle: string
  /** Subtitle shown on the login screen */
  tagline: string
  /** Placeholder for the login email input */
  emailPlaceholder: string
  /** Path under public/ used as favicon */
  favicon: string
  logo:
    | { type: "letter"; letter: string }
    | { type: "image"; src: string }
  sidebar: {
    /** "fixed" = full-height flush sidebar; "floating" = detached with rounded corners */
    style: "fixed" | "floating"
  }
  login:
    | { style: "graphic" } // dark brand panel with decorative arcs
    | { style: "photo"; image: string } // full-bleed photo on the left panel
  /**
   * CSS custom property overrides applied to :root at startup.
   * Keys map 1:1 to the variables in packages/ui/src/styles/globals.css, e.g.
   * "--brand", "--sidebar", "--sidebar-foreground", "--sidebar-accent",
   * "--sidebar-accent-foreground", "--primary", "--ring",
   * "--stat-accent-1", "--stat-accent-2" (dashboard stat cards / bar charts).
   * Any valid CSS color works (hex, oklch, rgb).
   */
  theme: Record<string, string>
}

export const kadunaConfig: AppConfig = {
  appName: "AttendEase",
  appTitle: "Kaduna AGILE MIS",
  tagline: "The attendance record system for Kaduna Schools",
  emailPlaceholder: "kachia@kadagile.online",
  favicon: "/branding/favicon.svg",
  logo: { type: "letter", letter: "A" },
  sidebar: { style: "fixed" },
  login: { style: "graphic" },
  theme: {}, // globals.css defaults are the Kaduna palette
}


export const appConfig: AppConfig = kadunaConfig
