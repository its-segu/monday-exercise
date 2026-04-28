// Stubbed fragrance catalog. This will be replaced by the fragrance API
// (GET /fragrances) once the backend is wired up.
//
// Schema mirrors the spec from the take-home prompt:
//   { id, name, description, category, image_url, created_at, updated_at }
export const FRAGRANCES = [
  {
    id: "fr_amber-noir",
    name: "Amber Noir",
    description: "Smoked amber, leather, and a whisper of vanilla bean.",
    category: "Woody",
    image_url:
      "https://images.unsplash.com/photo-1602928298849-325cec8771c0?w=400",
    created_at: "2026-01-12T10:00:00Z",
    updated_at: "2026-01-12T10:00:00Z",
  },
  {
    id: "fr_meadow-sage",
    name: "Meadow Sage",
    description: "Garden sage, crushed mint, and morning dew.",
    category: "Herbal",
    image_url:
      "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=400",
    created_at: "2026-01-12T10:00:00Z",
    updated_at: "2026-01-12T10:00:00Z",
  },
  {
    id: "fr_blood-orange",
    name: "Blood Orange & Bergamot",
    description: "Bright citrus zest balanced by warm bergamot.",
    category: "Citrus",
    image_url:
      "https://images.unsplash.com/photo-1582979512210-99b6a53386f9?w=400",
    created_at: "2026-01-12T10:00:00Z",
    updated_at: "2026-01-12T10:00:00Z",
  },
  {
    id: "fr_cedar-tonka",
    name: "Cedar & Tonka",
    description: "Mountain cedarwood layered with creamy tonka bean.",
    category: "Woody",
    image_url:
      "https://images.unsplash.com/photo-1587040335321-b3678ea24527?w=400",
    created_at: "2026-01-12T10:00:00Z",
    updated_at: "2026-01-12T10:00:00Z",
  },
  {
    id: "fr_white-tea",
    name: "White Tea & Linen",
    description: "Steamed white tea on a sun-bleached cotton sheet.",
    category: "Fresh",
    image_url:
      "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=400",
    created_at: "2026-01-12T10:00:00Z",
    updated_at: "2026-01-12T10:00:00Z",
  },
  {
    id: "fr_fig-leaf",
    name: "Fig Leaf",
    description: "Green fig, milk, and warm Mediterranean stone.",
    category: "Fruity",
    image_url:
      "https://images.unsplash.com/photo-1567074438851-37a5b1b3c8e9?w=400",
    created_at: "2026-01-12T10:00:00Z",
    updated_at: "2026-01-12T10:00:00Z",
  },
  {
    id: "fr_smoked-vanilla",
    name: "Smoked Vanilla",
    description: "Madagascar vanilla over a low embered hearth.",
    category: "Sweet",
    image_url:
      "https://images.unsplash.com/photo-1558642084-fd07fae5282e?w=400",
    created_at: "2026-01-12T10:00:00Z",
    updated_at: "2026-01-12T10:00:00Z",
  },
  {
    id: "fr_ocean-salt",
    name: "Ocean Salt",
    description: "Sea spray, driftwood, and a finish of dried kelp.",
    category: "Fresh",
    image_url:
      "https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?w=400",
    created_at: "2026-01-12T10:00:00Z",
    updated_at: "2026-01-12T10:00:00Z",
  },
  {
    id: "fr_rose-oud",
    name: "Rose & Oud",
    description: "Damask rose petals with a deep, smoky oud base.",
    category: "Floral",
    image_url:
      "https://images.unsplash.com/photo-1588405748880-12d1d2a59d75?w=400",
    created_at: "2026-01-12T10:00:00Z",
    updated_at: "2026-01-12T10:00:00Z",
  },
  {
    id: "fr_winter-spruce",
    name: "Winter Spruce",
    description: "Frosted spruce tips and a hint of pink peppercorn.",
    category: "Woody",
    image_url:
      "https://images.unsplash.com/photo-1543589077-47d81606c1bf?w=400",
    created_at: "2026-01-12T10:00:00Z",
    updated_at: "2026-01-12T10:00:00Z",
  },
];

export const FRAGRANCES_BY_ID = Object.fromEntries(
  FRAGRANCES.map((f) => [f.id, f]),
);
