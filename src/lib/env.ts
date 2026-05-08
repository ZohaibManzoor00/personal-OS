import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    APP_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(1),
    GITHUB_CLIENT_ID: z.string().min(1),
    GITHUB_CLIENT_SECRET: z.string().min(1),
    POLAR_ACCESS_TOKEN: z.string().min(1),
    POLAR_SUCCESS_URL: z.string().min(1),
  },
  client: {},
  shared: {},
  experimental__runtimeEnv: {},
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
