import { describe, expect, it } from "vitest"
import { parseCompareUrl } from "../url"

describe("parseCompareUrl", () => {
  it("parses owner, repo, and range from a compare path", () => {
    expect(parseCompareUrl("/vitejs/vite/compare/v5.4.10...v5.4.11")).toEqual({
      owner: "vitejs",
      repo: "vite",
      range: "v5.4.10...v5.4.11"
    })
  })

  it("strips a trailing slash", () => {
    expect(parseCompareUrl("/octocat/hello-world/compare/main...feature/")).toEqual({
      owner: "octocat",
      repo: "hello-world",
      range: "main...feature"
    })
  })

  it("strips the query string", () => {
    expect(parseCompareUrl("/octocat/hello-world/compare/main...feature?expand=1")).toEqual({
      owner: "octocat",
      repo: "hello-world",
      range: "main...feature"
    })
  })

  it("returns null for a non-compare path", () => {
    expect(parseCompareUrl("/octocat/hello-world/pull/12")).toBeNull()
  })
})
