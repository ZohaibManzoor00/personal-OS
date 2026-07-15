/** A curated preset the user can pick instead of uploading their own image. */
export type DefaultCover = {
  id: string;
  label: string;
  /** Path to the bundled asset under /public. */
  src: string;
};

export const DEFAULT_COVERS: DefaultCover[] = [
  { id: "aurora", label: "Aurora", src: "/covers/cover-aurora.png" },
  { id: "mountains", label: "Mountains", src: "/covers/cover-mountains.png" },
  { id: "dunes", label: "Dunes", src: "/covers/cover-dunes.png" },
  { id: "nebula", label: "Nebula", src: "/covers/cover-nebula.png" },
  { id: "forest", label: "Forest", src: "/covers/cover-forest.png" },
  { id: "tide", label: "Tide", src: "/covers/cover-tide.png" },
  { id: "ember", label: "Ember", src: "/covers/cover-ember.png" },
  { id: "meadow", label: "Meadow", src: "/covers/cover-meadow.png" },
  { id: "slate", label: "Slate", src: "/covers/cover-slate.png" },
];
