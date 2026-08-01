import z from "zod";

/**
 * The wire contract between the draw agent (server) and the canvas (client).
 *
 * The agent never touches Excalidraw directly. Instead it calls scene-edit
 * tools whose *inputs* the router relays to the client as `SceneMutation`s; the
 * client is the only side that owns the Excalidraw scene, so it converts these
 * declarative specs into real elements and applies them precisely — adding,
 * patching, or removing by id without ever rebuilding the whole drawing.
 *
 * Shapes carry stable, human-readable ids the model assigns (e.g. `api`,
 * `db`), so a later turn can update or delete exactly what an earlier turn
 * created, and arrows can bind to nodes by referencing their ids.
 */

export const shapeTypeSchema = z.enum([
  "rectangle",
  "ellipse",
  "diamond",
  "text",
  "arrow",
  "line",
]);

export type ShapeType = z.infer<typeof shapeTypeSchema>;

/** A new shape the agent wants to add to the canvas. */
export const shapeSpecSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(64)
    .describe(
      "A stable, unique, human-readable id for this shape (e.g. 'client', 'api', 'db'). Reuse it later to update or delete this exact shape, or to connect arrows to it.",
    ),
  type: shapeTypeSchema,
  x: z.number().describe("Left edge in canvas pixels (origin top-left)."),
  y: z.number().describe("Top edge in canvas pixels (y increases downward)."),
  width: z.number().positive().optional().describe("Width in pixels."),
  height: z.number().positive().optional().describe("Height in pixels."),
  text: z
    .string()
    .max(200)
    .optional()
    .describe(
      "The label drawn inside a rectangle/ellipse/diamond/arrow/line, or the content of a text element.",
    ),
  strokeColor: z
    .string()
    .optional()
    .describe("Outline / text color as a hex string, e.g. '#1e1e1e'."),
  backgroundColor: z
    .string()
    .optional()
    .describe("Fill color as a hex string, e.g. '#a5d8ff' (or 'transparent')."),
  start: z
    .string()
    .optional()
    .describe(
      "For arrows/lines only: the id of the shape this connector starts from. Both start and end shapes must exist in this same addShapes call for the binding to attach.",
    ),
  end: z
    .string()
    .optional()
    .describe(
      "For arrows/lines only: the id of the shape this connector points to.",
    ),
});

export type ShapeSpec = z.infer<typeof shapeSpecSchema>;

/** A precise patch to an existing shape, targeted by its id. */
export const shapeUpdateSchema = z.object({
  id: z.string().min(1).describe("The id of the existing shape to modify."),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  text: z
    .string()
    .max(200)
    .optional()
    .describe("Replace the shape's label / text content."),
  strokeColor: z.string().optional(),
  backgroundColor: z.string().optional(),
});

export type ShapeUpdate = z.infer<typeof shapeUpdateSchema>;

export const addShapesInput = z.object({
  shapes: z.array(shapeSpecSchema).min(1).max(40),
});

export const updateShapesInput = z.object({
  updates: z.array(shapeUpdateSchema).min(1).max(40),
});

export const deleteShapesInput = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
});

export const clearCanvasInput = z.object({
  confirm: z
    .literal(true)
    .describe("Must be true — only clear when the user explicitly asks."),
});

/**
 * A single scene edit streamed from the agent to the canvas. One tool call maps
 * to exactly one mutation.
 */
export type SceneMutation =
  | { op: "add"; shapes: ShapeSpec[] }
  | { op: "update"; updates: ShapeUpdate[] }
  | { op: "delete"; ids: string[] }
  | { op: "clear" };

/**
 * The compact, read-only view of the canvas the client sends up with each turn
 * so the agent knows what's already there (and can reference it by id).
 */
export const sceneElementSummarySchema = z.object({
  id: z.string(),
  type: z.string(),
  text: z.string().optional(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

export type SceneElementSummary = z.infer<typeof sceneElementSummarySchema>;

/** Turns a scene-edit tool call into the mutation the client will apply. */
export const toMutation = (
  toolName: string,
  input: unknown,
): SceneMutation | null => {
  switch (toolName) {
    case "addShapes":
      return { op: "add", shapes: addShapesInput.parse(input).shapes };
    case "updateShapes":
      return { op: "update", updates: updateShapesInput.parse(input).updates };
    case "deleteShapes":
      return { op: "delete", ids: deleteShapesInput.parse(input).ids };
    case "clearCanvas":
      return { op: "clear" };
    default:
      return null;
  }
};
