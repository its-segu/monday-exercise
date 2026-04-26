import mondaySdk from "monday-sdk-js";

const monday = mondaySdk();

// VITE_DEV_API_TOKEN is a personal token used for local + preview testing.
//
// We apply it whenever it's set, regardless of whether we're inside an iframe.
// That covers all three "no real session" environments:
//   - Standalone (tunnel URL opened directly in a browser)
//   - monday Developer Center → View Setup → Preview pane (iframe but no
//     session token, so unauthenticated `monday.api()` calls fail with
//     "GraphQL validation errors")
//   - Local dev iframe attached to a board where the SDK fails to negotiate
//     a session in time
//
// Defense-in-depth: only apply the dev token in a Vite dev build. In a
// production bundle (`vite build`) the entire branch is tree-shaken so the
// token can't accidentally leak into a deployed customer-facing build.
// You should still keep `VITE_DEV_API_TOKEN` out of `.env` before
// `npm run deploy` — Vite inlines env vars at build time.
const devToken = import.meta.env?.VITE_DEV_API_TOKEN;
if (import.meta.env?.DEV && devToken) {
  monday.setToken(devToken);
}

export default monday;
