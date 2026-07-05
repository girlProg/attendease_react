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

export const nigerConfig: AppConfig = {
  appName: "CCT MIS",
  appTitle: "Niger State CCT MIS",
  tagline: "The conditional cash transfer system for Niger State",
  emailPlaceholder: "admin@nigeragile.org",
  favicon: "/branding/niger-logo.png",
  logo: { type: "image", src: "/branding/niger-logo.png" },
  sidebar: { style: "floating" },
  login: { style: "photo", image: "/branding/niger-login.jpg" },
  theme: {
    "--sidebar": "oklch(0.13 0 0)", // near-black
    "--sidebar-foreground": "oklch(0.9 0 0)",
    "--sidebar-accent": "oklch(1 0 0)", // white active pill
    "--sidebar-accent-foreground": "oklch(0.13 0 0)",
    "--sidebar-ring": "oklch(0.5 0 0)",
    "--brand": "oklch(0.13 0 0)", // black primary actions
    "--brand-foreground": "oklch(1 0 0)",
    "--primary": "oklch(0.13 0 0)",
    "--background": "oklch(0.98 0 0)",
    "--stat-accent-1": "oklch(0.65 0.2 10)", // pink/red accent
    "--stat-accent-2": "oklch(0.55 0.15 155)",
  },
}

/*
To swap in real Niger assets
Replace the placeholders in apps/web/public/branding/: niger-logo.png (coat of arms) and niger-login.jpg (the city photo). 
No code changes needed.

*/

export const appConfig: AppConfig = nigerConfig
