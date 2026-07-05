import { appConfig } from "./app-config"

export function applyAppConfig() {
  for (const [variable, value] of Object.entries(appConfig.theme)) {
    document.documentElement.style.setProperty(variable, value)
  }

  document.title = appConfig.appTitle

  const faviconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (faviconLink) faviconLink.href = appConfig.favicon
}
