import { bulkSeedFragrances } from "../services/fragranceStore.js";

// Descriptions follow a `Top: ... Heart: ... Base: ...` recipe convention so
// the frontend can parse them into structured tier sections. The take-home
// schema only mandates `description`, so we lean into it as the recipe.
const STARTER_FRAGRANCES = [
  {
    id: "fr_amber-noir",
    name: "Amber Noir",
    description:
      "Top: black pepper, pink peppercorn. Heart: smoked amber resin, " +
      "labdanum. Base: leather absolute, Madagascar vanilla bean.",
    category: "Woody",
    image_url:
      "https://images.unsplash.com/photo-1602928298849-325cec8771c0?w=400",
  },
  {
    id: "fr_meadow-sage",
    name: "Meadow Sage",
    description:
      "Top: crushed mint, morning dew. Heart: garden sage, lemon verbena. " +
      "Base: green moss, sun-warmed hay.",
    category: "Herbal",
    image_url:
      "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=400",
  },
  {
    id: "fr_blood-orange",
    name: "Blood Orange & Bergamot",
    description:
      "Top: blood orange zest, ruby grapefruit. Heart: Calabrian bergamot, " +
      "neroli. Base: white musk, sweet amber.",
    category: "Citrus",
    image_url:
      "https://images.unsplash.com/photo-1582979512210-99b6a53386f9?w=400",
  },
  {
    id: "fr_cedar-tonka",
    name: "Cedar & Tonka",
    description:
      "Top: cardamom, pink pepper. Heart: Atlas cedarwood, vetiver. " +
      "Base: tonka bean, creamy sandalwood.",
    category: "Woody",
    image_url:
      "https://images.unsplash.com/photo-1602928298849-325cec8771c0?w=400",
  },
  {
    id: "fr_white-tea",
    name: "White Tea & Linen",
    description:
      "Top: white tea leaves, steamed bergamot. Heart: fresh cotton, jasmine " +
      "petals. Base: white musk, soft cedar.",
    category: "Fresh",
    image_url:
      "https://images.unsplash.com/photo-1528740561666-dc2479dc08ab?w=400",
  },
  {
    id: "fr_fig-leaf",
    name: "Fig Leaf",
    description:
      "Top: green fig leaf, coconut water. Heart: ripe fig, almond milk. " +
      "Base: Mediterranean stone, warm cedar.",
    category: "Fruity",
    image_url:
      "https://images.unsplash.com/photo-1502741224143-90386d7f8c82?w=400",
  },
  {
    id: "fr_smoked-vanilla",
    name: "Smoked Vanilla",
    description:
      "Top: smoked tobacco leaf, rum. Heart: Madagascar vanilla, tonka " +
      "bean. Base: low embered hearth, sandalwood.",
    category: "Sweet",
    image_url:
      "https://images.unsplash.com/photo-1558642084-fd07fae5282e?w=400",
  },
  {
    id: "fr_ocean-salt",
    name: "Ocean Salt",
    description:
      "Top: sea spray, lime peel. Heart: salted driftwood, ozonic accord. " +
      "Base: dried kelp, seasalt musk.",
    category: "Fresh",
    image_url:
      "https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?w=400",
  },
  {
    id: "fr_rose-oud",
    name: "Rose & Oud",
    description:
      "Top: saffron, pink pepper. Heart: Damask rose petals, Bulgarian " +
      "rose absolute. Base: aged oud, smoky guaiac wood.",
    category: "Floral",
    image_url:
      "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=400",
  },
  {
    id: "fr_winter-spruce",
    name: "Winter Spruce",
    description:
      "Top: frosted spruce tips, pink peppercorn. Heart: balsam fir, " +
      "juniper berry. Base: birch tar, snowy cedarwood.",
    category: "Woody",
    image_url:
      "https://images.unsplash.com/photo-1543589077-47d81606c1bf?w=400",
  },
  // The live board uses category-style labels ("Citrus", "Floral", etc.)
  // typed by hand. Each needs a matching API entry so the producer recipe
  // resolves regardless of which label the order picker uses.
  {
    id: "fr_citrus",
    name: "Citrus",
    description:
      "Top: mandarin zest, sun-warmed lemon peel. Heart: ruby grapefruit, " +
      "yuzu. Base: white amber, soft musk.",
    category: "Citrus",
    image_url: "https://picsum.photos/seed/citrus-candle/400/400",
  },
  {
    id: "fr_floral",
    name: "Floral",
    description:
      "Top: green stem, dewy lily. Heart: jasmine sambac, garden rose, " +
      "lily of the valley. Base: orris root, white musk.",
    category: "Floral",
    image_url: "https://picsum.photos/seed/floral-candle/400/400",
  },
  {
    id: "fr_smokey",
    name: "Smokey",
    description:
      "Top: charred birch, black pepper. Heart: weathered leather, " +
      "smoked oakwood. Base: ember, vetiver, ash.",
    category: "Woody",
    image_url: "https://picsum.photos/seed/smokey-candle/400/400",
  },
  {
    id: "fr_herbaceous",
    name: "Herbaceous",
    description:
      "Top: crushed basil, lemon thyme. Heart: rosemary, garden mint. " +
      "Base: oakmoss, dried hay.",
    category: "Herbal",
    image_url: "https://picsum.photos/seed/herbaceous-candle/400/400",
  },
  {
    id: "fr_fresh",
    name: "Fresh",
    description:
      "Top: dewy bergamot, mountain air. Heart: cucumber water, sea moss. " +
      "Base: laundered cotton, white cedar.",
    category: "Fresh",
    image_url: "https://picsum.photos/seed/fresh-candle/400/400",
  },
  {
    id: "fr_fruity",
    name: "Fruity",
    description:
      "Top: ripe pear, sunlit peach. Heart: blackberry compote, raspberry " +
      "leaf. Base: warm vanilla, brown sugar.",
    category: "Fruity",
    image_url: "https://picsum.photos/seed/fruity-candle/400/400",
  },
];

export async function runSeed() {
  const { added, refreshed, count } =
    await bulkSeedFragrances(STARTER_FRAGRANCES);
  console.log(
    `[seed] catalog upserted: ${count} total (${added} added, ${refreshed} refreshed)`,
  );
  return { added, refreshed, count };
}
