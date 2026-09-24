import { createRoot } from "react-dom/client"
import { PopupApp } from "./PopupApp"
import { detectTheme } from "../lib/theme"
import "../styles/tokens.css"

document.documentElement.dataset.theme = detectTheme()
createRoot(document.getElementById("root")!).render(<PopupApp />)
