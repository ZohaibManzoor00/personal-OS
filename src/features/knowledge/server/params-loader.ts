import { createLoader } from "nuqs/server";
import { knowledgeParams } from "../hooks/use-knowledge";

export const knowledgeParamsLoader = createLoader(knowledgeParams);
