import { LangfuseSpanProcessor } from "@langfuse/otel";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";

/**
 * Langfuse OpenTelemetry span processor.
 *
 * Exported so that serverless entry points (tRPC route handlers, Inngest steps)
 * can flush pending spans with `langfuseSpanProcessor.forceFlush()` before the
 * function freezes or terminates — otherwise traces can be lost.
 *
 * Credentials and host are read from the LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY
 * / LANGFUSE_BASE_URL env vars (see src/lib/env.ts).
 *
 * - `environment` tags every trace so local/dev runs don't pollute the
 *   production dashboards and evaluations.
 * - `exportMode: "immediate"` exports each span as it ends instead of batching,
 *   which is the recommended mode for short-lived / serverless runtimes.
 */
export const langfuseSpanProcessor = new LangfuseSpanProcessor({
  environment: process.env.NODE_ENV,
  exportMode: "immediate",
});

const tracerProvider = new NodeTracerProvider({
  spanProcessors: [langfuseSpanProcessor],
});

tracerProvider.register();
