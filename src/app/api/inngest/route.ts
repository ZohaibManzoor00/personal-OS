import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { embedNodeNow, execute, syncEmbeddings } from "@/inngest/functions";

export const { GET, POST, PUT } = serve({ client: inngest, functions: [execute, syncEmbeddings, embedNodeNow] });
