/* Tangled with Love — editable configuration, catalog, reviews, and image paths. */
/* =====================================================================
   CONFIGURATION — edit these after setting up Stripe + Formspree + Worker
   See DEPLOYMENT.md for a step-by-step guide.
   ===================================================================== */
const CONFIG = {
  // URL of your Cloudflare Worker that creates a Stripe Checkout Session.
  // Example: "https://tangled-stripe.yourname.workers.dev"
  // Leave blank ("") to disable Stripe — the site will email the order via Formspree instead.
  STRIPE_CHECKOUT_ENDPOINT: "https://tangled-stripe.jaspreet-sambee.workers.dev",

  // URL of your Cloudflare Worker that emails messages/reference-photos WITH
  // attachments via Resend (see mail-worker/). Formspree's free plan doesn't
  // support file uploads, so this replaces it for the attachment path only.
  // Leave blank ("") to fall back to Formspree (attachments will fail unless
  // your Formspree plan supports file uploads).
  MAIL_WORKER_ENDPOINT: "https://tangled-mail.tangled-mail-worker.workers.dev",

  // Formspree form id — fallback for messages/orders with attachments when
  // MAIL_WORKER_ENDPOINT is blank. (EmailJS below handles everything else
  // with nicer branded templates.)
  FORMSPREE_ID: "mojbpvdp",

  // EmailJS (https://emailjs.com) — sends the branded owner-notification and
  // customer-confirmation emails for contact messages (no attachments) and orders.
  EMAILJS_PUBLIC_KEY: "l4pYtw2PcpbFiID-z",
  EMAILJS_SERVICE_ID: "service_zisyegk",
  EMAILJS_TEMPLATE_OWNER: "template_3ngi1t7",    // "Contact Us" template
  EMAILJS_TEMPLATE_CUSTOMER: "template_d4zmn9t", // "Auto-Reply" template

  // Currency shown in the UI and used for Stripe line items.
  CURRENCY: "CAD",
  CURRENCY_SYMBOL: "CA$",
};

/* =====================================================================
   PRODUCT CATALOG — edit names, prices, descriptions, hero index here
   Prices are in WHOLE DOLLARS (CAD). Stripe receives prices in cents.
   ===================================================================== */
const CATEGORIES = [
  {
    id: "round-patches",
    name: "Round Patches",
    tagline: "Statement crochet bags shaped with colourful patchwork.",
    blurb: "Bold patchwork bags built from floral rounds, hexagons and granny-square motifs. Each design has its own colour story and handmade character.",
    heroVariant: "cherry-blossom",
    variants: [
      { id: "cherry-blossom", name: "Cherry Blossom Granny", price: 50, heroIdx: 0,
        desc: "Ivory and cherry-red granny squares with a moss-green centre for a bright, garden-inspired finish." },
      { id: "golden-daisy-granny", name: "Golden Daisy Granny", price: 50, heroIdx: 0,
        desc: "Sunny golden and cream crochet patches finished with a neat button closure and soft shoulder straps." },
      { id: "lavender-fields", name: "Lavender Fields Hex", price: 50, heroIdx: 0,
        desc: "A soft lavender hexagon bag with sage-green floral centres. Light, pretty and surprisingly roomy." },
      { id: "ruby-garden-granny", name: "Ruby Garden Granny", price: 50, heroIdx: 0,
        desc: "Ruby red, moss green, charcoal and cream patches finished with braided monochrome handles." },
      { id: "sage-meadow", name: "Sage Meadow Granny", price: 50, heroIdx: 0,
        desc: "A generous forest-green and ivory patchwork bag with comfortable handles and an earthy palette." },
    ],
  },
  {
    id: "small-potli",
    name: "Small Potli",
    tagline: "Soft drawstring potlis for everyday essentials and gifting.",
    blurb: "Compact drawstring bags with floral details, braided cords and soft handmade structure. Perfect for a phone, keys and small keepsakes.",
    heroVariant: "autumn-garden-potli",
    variants: [
      { id: "autumn-garden-potli", name: "Autumn Garden Potli", price: 25, heroIdx: 0,
        desc: "A warm oat-coloured potli shaped with floral granny-square panels in rust, cream and moss green." },
      { id: "morning-sky", name: "Morning Sky Potli", price: 20, heroIdx: 0,
        desc: "A sky-blue potli with a hand-stitched sunflower motif and soft drawstring handle." },
      { id: "mocha-drawstring", name: "Mocha Drawstring Potli", price: 25, heroIdx: 0,
        desc: "Rich mocha and cream stripes with a gathered drawstring top, pearl-tipped cords and a long strap." },
      { id: "rosy-drawstring", name: "Rosy Drawstring Potli", price: 30, heroIdx: 0,
        desc: "Soft blush crochet with a ring of ruby roses, deep green cords and matching flower ties." },
      { id: "ruby-bloom-drawstring", name: "Ruby Bloom Potli", price: 28, heroIdx: 0,
        desc: "An ivory drawstring mini with a bold ruby flower centre, rosebud edging and wooden bead details." },
      { id: "sky-mandala-bucket", name: "Sky Mandala Potli", price: 30, heroIdx: 0,
        desc: "A cream gathered bag centred with a sky-blue, moss and warm-brown crochet mandala." },
      { id: "terracotta-daisy-mini", name: "Terracotta Daisy Potli", price: 25, heroIdx: 0,
        desc: "A compact terracotta bag centred with an oversized cream-and-taupe daisy patch." },
    ],
  },
  {
    id: "large-sized-bag",
    name: "Large Sized Bags",
    tagline: "Roomy handmade bags for books, work and market days.",
    blurb: "Our roomiest crochet bags, designed with comfortable handles and enough space for daily essentials, books and small outings.",
    heroVariant: "blush-flower-patchwork",
    variants: [
      { id: "blush-flower-patchwork", name: "Blush Flower Patchwork", price: 50, heroIdx: 0,
        desc: "A structured blush tote covered in dimensional crochet flowers with golden seams and sturdy top handles." },
      { id: "midnight-daisy", name: "Midnight Daisy", price: 45, heroIdx: 1,
        desc: "Deep charcoal crochet with cream-and-gold daisy motifs for a moodier floral statement." },
      { id: "strawberry-stripe", name: "Strawberry Stripe", price: 40, heroIdx: 5,
        desc: "A cream tote with dense strawberry-red bobbles and sage accents, made for colourful everyday carrying." },
      { id: "strawberry-tassel", name: "Strawberry Tassel", price: 50, heroIdx: 0,
        desc: "Blush, berry-red and sage granny squares finished with playful tassels and a long cream strap." },
      { id: "terracotta-daisy", name: "Terracotta Daisy", price: 45, heroIdx: 0,
        desc: "A warm terracotta tote built from cream-centred daisy squares with a structured, earthy finish." },
    ],
  },
  {
    id: "medium-bags/round",
    name: "Medium Bags — Round",
    tagline: "Rounded statement bags with dimensional sunflower details.",
    blurb: "Medium round bags with sculpted crochet petals, comfortable handles and enough room for your everyday essentials.",
    heroVariant: "forest-sunflower-round",
    variants: [
      { id: "forest-sunflower-round", name: "Forest Sunflower Round", price: 35, heroIdx: 0,
        desc: "A deep forest-green round crossbody crowned with a large golden sunflower and braided strap." },
      { id: "silver-sunflower-round", name: "Silver Sunflower Round", price: 30, heroIdx: 0,
        desc: "A softly structured silver-grey round handbag with ruffled edging and a sunny floral accent." },
    ],
  },
  {
    id: "medium-bags/rectangle",
    name: "Medium Bags — Rectangle",
    tagline: "Structured rectangular bags with floral crochet character.",
    blurb: "Practical medium bags in structured rectangle and hobo shapes, finished with flowers, granny squares and handcrafted straps.",
    heroVariant: "mocha-daisy-handbag",
    variants: [
      { id: "mocha-daisy-handbag", name: "Mocha Daisy Handbag", price: 30, heroIdx: 0,
        desc: "A cream-and-mocha top-handle bag decorated with three raised daisies and a simple button closure." },
      { id: "rosewood-garden-tote", name: "Rosewood Garden Tote", price: 35, heroIdx: 0,
        desc: "A structured rosewood tote with a row of blush and golden flower panels and wrapped handles." },
      { id: "meadow-stripe-hobo", name: "Meadow Stripe Hobo", price: 35, heroIdx: 0,
        desc: "A relaxed cream-and-mocha hobo bag with lavender, green and golden floral corners." },
      { id: "blue-garden-envelope", name: "Blue Garden Envelope", price: 30, heroIdx: 0,
        desc: "A grey envelope crossbody built from blue, sage, cream and rust granny-square panels." },
      { id: "sunflower-leaf-shoulder", name: "Sunflower Leaf Shoulder", price: 35, heroIdx: 0,
        desc: "A warm oat shoulder bag with a sunflower flap, dimensional green leaves and a long crochet strap." },
    ],
  },
  {
    id: "small-bags",
    name: "Small Bags",
    tagline: "Compact handbags and crossbodies with bold handmade details.",
    blurb: "Small crochet bags sized for a phone, keys and a few essentials. Choose from structured minis, floral crossbodies and colourful handheld styles.",
    heroVariant: "ruby-rose-crossbody",
    variants: [
      { id: "midnight-ruffle-mini", name: "Midnight Ruffle Mini", price: 25, heroIdx: 0,
        desc: "A navy-and-cream mini handbag with scalloped ruffles, a flower closure and braided top handle." },
      { id: "ruby-rose-crossbody", name: "Ruby Rose Crossbody", price: 30, heroIdx: 0,
        desc: "A midnight-blue crossbody framed in ruby and cream with a dimensional red rose and leafy detail." },
      { id: "sky-mandala-mini", name: "Sky Mandala Mini", price: 25, heroIdx: 0,
        desc: "A sky-blue mini handbag centred with a plum, sage and ivory crochet mandala." },
      { id: "ruby-garden-handbag", name: "Ruby Garden Handbag", price: 30, heroIdx: 0,
        desc: "A vivid ruby handbag with soft pink, ivory and green floral patches and two-tone handles." },
      { id: "berry-blossom", name: "Berry Blossom", price: 25, heroIdx: 2,
        desc: "An ivory handheld with pink bobble trim and a braided white strap." },
      { id: "espresso-stripe", name: "Espresso Stripe", price: 25, heroIdx: 0,
        desc: "Warm espresso and cream stripes in a compact everyday shape." },
      { id: "garden-mandala", name: "Garden Mandala", price: 30, heroIdx: 0,
        desc: "A cream body with one colourful mandala centre and bright moss-green straps." },
      { id: "rose-garden", name: "Rose Garden Crossbody", price: 30, heroIdx: 0,
        desc: "A forest-green crossbody with a hand-crocheted pink rose on the front flap." },
      { id: "seafoam", name: "Seafoam Weave", price: 20, heroIdx: 0,
        desc: "Cream and soft seafoam-blue stripes with a chunky, coastal-inspired weave." },
    ],
  },
  {
    id: "xs-bags",
    name: "XS Bags",
    tagline: "Tiny crochet bags, wallets and gift-sized keepsakes.",
    blurb: "Our smallest handmade pieces are ideal as wallets, cosmetic pouches and thoughtful gift bags.",
    heroVariant: "golden-sky",
    variants: [
      { id: "autumn-spice", name: "Autumn Spice", price: 15, heroIdx: 0,
        desc: "A terracotta bi-fold mini with a simple snap closure." },
      { id: "golden-sky", name: "Golden Sky", price: 20, heroIdx: 0,
        desc: "A cream mini framed in golden mustard with a bright sky-blue flower and soft ties." },
      { id: "lavender-bloom", name: "Lavender Bloom", price: 20, heroIdx: 0,
        desc: "An ivory mini edged in lavender with a sage-and-navy flower centre." },
      { id: "rosewood-stripe", name: "Rosewood Stripe", price: 18, heroIdx: 0,
        desc: "Rose, charcoal and cream stripes finished with a granny-square flap." },
      { id: "sunshine", name: "Sunshine Pouch", price: 15, heroIdx: 0,
        desc: "A mustard envelope pouch with lavender trim and a button closure." },
    ],
  },
  {
    id: "leather-bags",
    name: "Leather Bags",
    tagline: "Statement bags finished with structured, lasting details.",
    blurb: "A focused collection of statement bags with sturdy construction and elevated finishing touches.",
    heroVariant: "mocha-blossom-stripe",
    variants: [
      { id: "mocha-blossom-stripe", name: "Mocha Blossom Stripe", price: 60, heroIdx: 0,
        desc: "A spacious mocha-and-cream striped bag with a crochet flower, long straps and reinforced base." },
    ],
  },
  {
    id: "rakhri-seasonal",
    name: "Raakhi (Seasonal)",
    tagline: "Limited seasonal pieces made for heartfelt gifting.",
    blurb: "Our Raakhi collection is being prepared. New handmade seasonal designs will appear here soon.",
    variants: [],
  },
];

/* =====================================================================
   REVIEWS — genuine customer reviews only. Add entries here as they come
   in through the contact form's "Leave a review" option (with any photos
   the customer attached copied into assets/reviews/).
   Each entry: { name, text, images: [] (optional paths) }
   ===================================================================== */
const REVIEWS = [
  {
    name: "Manpreet Kaur",
    text: "I’m so happy with my crochet item! It’s adorable, beautifully crafted, and even better than I expected. The love and effort put into it really shows.",
    images: [],
  },
  {
    name: "Babli",
    text: "She's so passionate about her work that as soon as you talk to her about anything — a bag, a sweater, anything that can be made with crochet — she will immediately say, \"I can make this,\" and the next thing you know, she delivers the exact same product within days. She actively works on it to show that yes, she can make anything. She's a peaceful force you hardly understand fully, but when she delivers, she delivers soft and cozy crochet products, and you absolutely fall in love with their colours and designs, and ultimately with her.\n\nI heard a line that suits what she does: \"Tradition is not the worship of ashes. It is the preservation of fire.\" And she has preserved this fire well.",
    images: [],
  },
  {
    name: "Mohini",
    text: "It’s truly special about receiving something handmade with love. Every stitch reflects the warmth, patience, and care of a mom’s hands. It feels less like buying a product and more like receiving a thoughtful gift made with love. I’m absolutely delighted with my purchase and would highly recommend this website to anyone who appreciates handmade creations made from the heart.",
    images: [],
  },
  {
    name: "Jaskaran",
    text: "I absolutely love my aunt's crochet creations! Every piece is beautifully handmade with so much care and attention to detail. The quality is amazing, and each item is even cuter in person. I'm always surprised by how quickly she finishes her work without ever compromising on quality. You can really see the love, patience, and talent that go into every stitch. If you're looking for adorable handmade crochet, I highly recommend supporting her — you won't be disappointed!",
    images: [],
  },
  {
    name: "Aman",
    text: "I bought a crochet bag for myself, and when I showed it to my friends back in India, they each asked for one too — now I'm taking back 5 bags in total! The best part is that they're fully customizable, and aunty makes them so quickly.",
    images: [],
  },
  {
    name: "Gurjinder Tiwana",
    text: "My sister made a beautiful set of crochet sweaters for my twin grandchildren and we all loved it very much. Cute and cozy gift for the newborns.",
    images: [],
  },
];

/* =====================================================================
   PRODUCT IMAGE CATALOG — generated to match assets/products on disk
   ===================================================================== */
// IMAGE_MAP is generated to match the actual files on disk.
const pngSeries = (count, start=1) => Array.from({length: count}, (_, i) => `${i + start}.png`);
const IMAGE_MAP = {
  "round-patches/cherry-blossom": ["1.png","2.png","3.png","4.png","5.jpg","6.png","7.png","8.png","9.jpg","10.jpg","11.png"],
  "round-patches/golden-daisy-granny": pngSeries(7),
  "round-patches/lavender-fields": pngSeries(6),
  "round-patches/ruby-garden-granny": pngSeries(10),
  "round-patches/sage-meadow": ["1.png","2.jpg","3.jpg","4.jpg","5.jpg","6.png"],
  "small-potli/autumn-garden-potli": pngSeries(7),
  "small-potli/morning-sky": ["1.png","2.png","3.jpg","4.jpg","5.jpg","6.jpg"],
  "small-potli/mocha-drawstring": ["1.png","2.png","3.jpg","4.jpg","5.jpg","6.png"],
  "small-potli/rosy-drawstring": pngSeries(15),
  "small-potli/ruby-bloom-drawstring": pngSeries(10),
  "small-potli/sky-mandala-bucket": pngSeries(10),
  "small-potli/terracotta-daisy-mini": pngSeries(10),
  "large-sized-bag/blush-flower-patchwork": pngSeries(5),
  "large-sized-bag/midnight-daisy": pngSeries(3),
  "large-sized-bag/strawberry-stripe": ["1.jpeg","2.png","3.png","4.jpg","5.jpg","6.jpg","7.jpg","8.jpg","9.jpg"],
  "large-sized-bag/strawberry-tassel": pngSeries(12),
  "large-sized-bag/terracotta-daisy": pngSeries(11),
  "medium-bags/round/forest-sunflower-round": pngSeries(10),
  "medium-bags/round/silver-sunflower-round": pngSeries(10),
  "medium-bags/rectangle/mocha-daisy-handbag": pngSeries(10),
  "medium-bags/rectangle/rosewood-garden-tote": pngSeries(10),
  "medium-bags/rectangle/meadow-stripe-hobo": pngSeries(10),
  "medium-bags/rectangle/blue-garden-envelope": pngSeries(10),
  "medium-bags/rectangle/sunflower-leaf-shoulder": pngSeries(3),
  "small-bags/midnight-ruffle-mini": pngSeries(7),
  "small-bags/ruby-rose-crossbody": pngSeries(6),
  "small-bags/sky-mandala-mini": pngSeries(6),
  "small-bags/ruby-garden-handbag": pngSeries(5),
  "small-bags/berry-blossom": ["1.png","2.jpg","3.jpg"],
  "small-bags/espresso-stripe": ["1.png"],
  "small-bags/garden-mandala": pngSeries(12),
  "small-bags/rose-garden": pngSeries(6),
  "small-bags/seafoam": ["1.png"],
  "xs-bags/autumn-spice": pngSeries(3),
  "xs-bags/golden-sky": pngSeries(11),
  "xs-bags/lavender-bloom": pngSeries(10),
  "xs-bags/rosewood-stripe": pngSeries(2),
  "xs-bags/sunshine": pngSeries(3),
  "leather-bags/mocha-blossom-stripe": pngSeries(11),
};
