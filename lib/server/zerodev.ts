/*
  SERVER ONLY — enforced here rather than with the `server-only` package.

  `server-only` throws unless it is resolved through the `react-server` export
  condition. `node --test` does not set that condition, and setting it globally
  changes how `@tanstack/react-query` resolves and breaks four existing suites.
  A module that holds provider credentials is worth testing, so the guarantee
  is kept and the mechanism is changed: this throws in a browser, which is the
  thing `server-only` was there to prevent.
*/
if (typeof window !== "undefined") {
  throw new Error("lib/server/zerodev is server-only and must never be bundled into the browser");
}

export function zeroDevRpcUrl(chainId: number): string | null {
  const projectId = process.env.ZERODEV_PROJECT_ID?.trim();
  if (!projectId || !/^[A-Za-z0-9_-]{16,128}$/.test(projectId)) return null;
  return `https://rpc.zerodev.app/api/v3/${projectId}/chain/${chainId}`;
}
