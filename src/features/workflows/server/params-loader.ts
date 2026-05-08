import { createLoader } from "nuqs/server";
import { workflowsParams } from "../hooks/use-workflows";

export const workflowsParamsLoader = createLoader(workflowsParams);
