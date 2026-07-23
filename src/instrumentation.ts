/**
 * Next.js instrumentation hook. `register()` runs once when a server instance
 * boots, before any request is handled — the right place to initialize the
 * OpenTelemetry tracer provider that Langfuse builds on.
 *
 * The OTel Node SDK isn't Edge-compatible, so we only load it on the Node.js
 * runtime. Everything lives in ./instrumentation.node so that importing the
 * span processor elsewhere (to flush) never drags the Node SDK into an Edge
 * bundle.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation.node");
  }
}
