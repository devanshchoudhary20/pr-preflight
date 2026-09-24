interface ContentAppProps {
  range: string | null
}

// Placeholder for the Badge/Panel pair built in chunk 1-2. Scaffold only:
// renders the collapsed Badge state with the range parsed from the URL.
export function ContentApp({ range }: ContentAppProps) {
  const label = range ?? "PR Preflight"
  return (
    <div className="prp-badge" role="status">
      {label}
    </div>
  )
}
