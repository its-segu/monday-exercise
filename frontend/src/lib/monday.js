import mondaySdk from "monday-sdk-js";

const monday = mondaySdk();

// `VITE_DEV_API_TOKEN` covers three "no real session" environments: standalone
// tunnel URLs, the Developer Center preview pane (iframe with no session
// token), and local dev iframes that fail to negotiate. Gating on `DEV` means
// `vite build` tree-shakes the entire branch, so the token can't leak into
// production bundles even if the env var is accidentally set.
const devToken = import.meta.env?.VITE_DEV_API_TOKEN;
if (import.meta.env?.DEV && devToken) {
  monday.setToken(devToken);
}

export default monday;
