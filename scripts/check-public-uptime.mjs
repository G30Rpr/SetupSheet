// Read-only public availability smoke check. No user data writes or secrets.
// A pass confirms HTTP reachability only; it is not a substitute for signed-in
// API/RLS tests, synthetic browser journeys, or real-user Web Vitals.
const baseUrl = process.env.SETUPSHEET_HEALTH_BASE_URL || "https://setupsheet.app";
const paths = ["/", "/help", "/setups", "/requests"];
const retries = 3;

if (!baseUrl.startsWith("https://")) {
  throw new Error("Production health check requires an HTTPS base URL");
}

const results = [];
for (const path of paths) {
  let lastError = "unknown";
  let passed = false;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const began = Date.now();
    try {
      const response = await fetch(new URL(path, baseUrl), {
        method: "GET",
        redirect: "follow",
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
        headers: { "User-Agent": "SetupSheet-ReadOnly-HealthCheck/1.0" },
      });
      // HTTP 200 alone cannot certify backend health, but failures signal
      // when public browsing has become unavailable.
      if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
      await response.body?.cancel();
      results.push({ path, status: "PASS", durationMs: Date.now() - began });
      passed = true;
      break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 1_000 * attempt));
      }
    }
  }
  if (!passed) results.push({ path, status: "FAIL", detail: lastError });
}

for (const r of results) {
  console.log(`${r.status}: ${r.path} ${r.durationMs === undefined ? r.detail : `${r.durationMs}ms`}`);
}
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import("node:fs");
  appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    "## SetupSheet public availability\n\n" +
    "| Route | Result | Detail |\n|---|---|---|\n" +
    results.map((r) => `| ${r.path} | ${r.status} | ${r.durationMs === undefined ? r.detail : `${r.durationMs} ms`} |`).join("\n") +
    "\n\nOnly HTTP reachability was checked. Backend authentication and recovery are not validated here.\n"
  );
}
if (results.some((r) => r.status !== "PASS")) process.exitCode = 1;
