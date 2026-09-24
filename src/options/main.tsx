import { createRoot } from "react-dom/client"
import { OptionsApp } from "./OptionsApp"
import { detectTheme } from "../lib/theme"
import "../styles/tokens.css"

document.documentElement.dataset.theme = detectTheme()
createRoot(document.getElementById("root")!).render(<OptionsApp />)
