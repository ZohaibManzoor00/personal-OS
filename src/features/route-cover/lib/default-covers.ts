/** A curated preset the user can pick instead of uploading their own image. */
export type DefaultCover = {
  id: string;
  label: string;
  /** Path to the bundled asset under /public. */
  src: string;
};

export const DEFAULT_COVERS: DefaultCover[] = [
  { id: "mountains", label: "Mountains", src: "/covers/cover-mountains.png" },
  { id: "forest", label: "Forest", src: "/covers/cover-forest.png" },
  { id: "lake", label: "Lake", src: "/covers/cover-lake.png" },
  { id: "valley", label: "Valley", src: "/covers/cover-valley.png" },
  { id: "blossom", label: "Blossom", src: "/covers/cover-blossom.png" },
  { id: "coast", label: "Coast", src: "/covers/cover-coast.png" },
  { id: "lavender", label: "Lavender", src: "/covers/cover-lavender.png" },
  { id: "autumn", label: "Autumn", src: "/covers/cover-autumn.png" },
  { id: "dunes", label: "Dunes", src: "/covers/cover-dunes.png" },
];
