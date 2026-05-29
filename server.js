/**
 * UPC/PLU Lookup MCP Server — Node.js HTTP
 *
 * Run: node server.js
 * Or:  systemctl start upc-mcp
 *
 * Endpoints:
 *   GET  /health          — health check
 *   POST /mcp             — JSON-RPC MCP protocol
 *   GET  /                — info page
 */

const http = require("http");

// ── Open Food Facts API ─────────────────────────────────────────────

const OFF_BASE = "https://world.openfoodfacts.org/api/v0";

async function fetchOFF(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path);
    const mod = url.protocol === "https:" ? require("https") : require("http");
    mod.get(path, { headers: { "User-Agent": "UPC-PLU-MCP/1.0" } }, (res) => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch (e) { reject(e); }
      });
    }).on("error", reject);
  });
}

async function lookupBarcode(barcode) {
  const data = await fetchOFF(`${OFF_BASE}/product/${barcode}.json`);
  return data.status === 1 && data.product ? data.product : null;
}

async function searchOFF(query, page = 1, pageSize = 5) {
  const params = new URLSearchParams({
    search_terms: query,
    page: String(page),
    page_size: String(pageSize),
    fields: "code,product_name,generic_name,brands,categories,image_url,quantity,ecoscore_grade,nova_group,product_quantity",
    json: "1",
  });
  return await fetchOFF(`${OFF_BASE.replace("/v0", "/v2")}/search?${params}`);
}

// ── Formatting ─────────────────────────────────────────────────────

function formatProduct(p) {
  const L = [];
  L.push(`## ${p.product_name || p.generic_name || "Unknown Product"}`);
  L.push(`Barcode: ${p.code || "N/A"}`);
  if (p.brands) L.push(`Brand: ${p.brands}`);
  if (p.quantity || p.product_quantity) L.push(`Size: ${p.quantity || p.product_quantity}`);
  if (p.serving_size) L.push(`Serving: ${p.serving_size}`);
  if (p.categories) L.push(`Category: ${p.categories.split(",").slice(0, 3).map(c => c.trim()).join(" > ")}`);
  if (p.origins) L.push(`Origin: ${p.origins}`);
  if (p.stores) L.push(`Stores: ${p.stores}`);
  if (p.countries) L.push(`Countries: ${p.countries.split(",").slice(0, 5).map(c => c.trim()).join(", ")}`);
  if (p.labels) L.push(`Labels: ${p.labels.split(",").slice(0, 8).map(l => l.trim()).join(", ")}`);
  if (p.ecoscore_grade) L.push(`Eco-Score: ${p.ecoscore_grade.toUpperCase()}`);
  if (p.nova_group) L.push(`Processing: NOVA ${p.nova_group} — ${novaLabel(p.nova_group)}`);
  if (p.packaging) L.push(`Packaging: ${p.packaging}`);
  if (p.nutriments) {
    const n = p.nutriments;
    const kcal = n["energy-kcal_100g"] ?? n["energy-kcal"] ?? null;
    const kj = n["energy-kj_100g"] ?? n["energy-kj"] ?? null;
    const energy = kcal ? `${kcal} kcal` : kj ? `${kJ} kJ` : null;
    const ns = [];
    if (energy) ns.push(energy);
    if (n["proteins_100g"] !== undefined) ns.push(`${n["proteins_100g"]}g protein`);
    if (n["carbohydrates_100g"] !== undefined) ns.push(`${n["carbohydrates_100g"]}g carbs`);
    if (n["fat_100g"] !== undefined) ns.push(`${n["fat_100g"]}g fat`);
    if (n["fiber_100g"] !== undefined) ns.push(`${n["fiber_100g"]}g fiber`);
    if (n["sodium_100g"] !== undefined) ns.push(`${n["sodium_100g"]}g sodium`);
    if (ns.length) L.push(`Per 100g: ${ns.join(", ")}`);
  }
  if (p.ingredients_text) {
    const ing = p.ingredients_text.length > 300 ? p.ingredients_text.slice(0, 300) + "..." : p.ingredients_text;
    L.push(`Ingredients: ${ing}`);
  }
  if (p.image_url) L.push(`Image: ${p.image_url}`);
  return L.join("\n");
}

function novaLabel(g) {
  return ["unprocessed/minimally processed", "processed culinary ingredient", "processed food", "ultra-processed food"][g - 1] || "unknown";
}

// ── Tools ───────────────────────────────────────────────────────────

const tools = [
  {
    name: "lookup_upc",
    description: "Look up a product by UPC, EAN, or GTIN barcode. Returns product name, brand, nutrition facts, ingredients, packaging, origin, eco-score, and image. Uses the Open Food Facts database (4M+ products).",
    inputSchema: {
      type: "object",
      properties: {
        barcode: { type: "string", description: "UPC/EAN/GTIN barcode digits only or with dashes (e.g. '049000050106', '3017620422003')" },
      },
      required: ["barcode"],
    },
  },
  {
    name: "lookup_plu",
    description: "Look up a fruit or vegetable by PLU (Price Look-Up) code. PLU codes are 4-5 digit numbers used at grocery store produce sections. E.g., 4011=yellow banana, 4062=lemon.",
    inputSchema: {
      type: "object",
      properties: {
        plu: { type: "string", description: "PLU code, 4-5 digits (e.g. '4011')" },
      },
      required: ["plu"],
    },
  },
  {
    name: "search_product",
    description: "Search the Open Food Facts database by product name, brand, or category. Returns matching products with barcodes you can pass to lookup_upc for full details.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search term — product name, brand, or category (e.g. 'nutella', 'coca cola', 'oat milk')" },
        limit: { type: "number", description: "Results to return (1-10, default 5)" },
      },
      required: ["query"],
    },
  },
];

async function callTool(name, args) {
  try {
    if (name === "lookup_upc") {
      const barcode = (args.barcode || "").replace(/[^0-9]/g, "");
      if (barcode.length < 8 || barcode.length > 14) {
        return { content: [{ type: "text", text: `Invalid barcode "${args.barcode}". Expected 8-14 digits. Got ${barcode.length} digits.` }] };
      }
      const product = await lookupBarcode(barcode);
      if (!product) return { content: [{ type: "text", text: `No product found for barcode ${barcode}.` }] };
      return { content: [{ type: "text", text: formatProduct(product) }] };
    }

    if (name === "lookup_plu") {
      const plu = (args.plu || "").replace(/[^0-9]/g, "");
      if (plu.length < 4 || plu.length > 5) {
        return { content: [{ type: "text", text: `Invalid PLU "${args.plu}". PLU codes are 4-5 digit numbers.` }] };
      }
      let results = await searchOFF(`PLU ${plu}`, 1, 5);
      if (!results.products?.length) {
        const broad = await searchOFF(plu, 1, 5);
        if (broad.products?.length) results = broad;
      }
      if (!results?.products?.length) {
        return { content: [{ type: "text", text: `No produce found for PLU ${plu}. Try lookup_upc for barcoded produce.` }] };
      }
      const total = results.count ?? results.products.length;
      const items = results.products.map(formatProduct).join("\n\n---\n\n");
      return { content: [{ type: "text", text: `PLU ${plu} — ${total} result(s):\n\n${items}` }] };
    }

    if (name === "search_product") {
      const q = (args.query || "").trim();
      if (!q) return { content: [{ type: "text", text: "Provide a search query." }] };
      const lim = Math.min(args.limit || 5, 10);
      const results = await searchOFF(q, 1, lim);
      if (!results.products?.length) {
        return { content: [{ type: "text", text: `No products found for "${q}".` }] };
      }
      const total = results.count ?? results.products.length;
      const items = results.products.map(formatProduct).join("\n\n---\n\n");
      return { content: [{ type: "text", text: `Search: "${q}" — ${total} result(s):\n\n${items}` }] };
    }

    return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }] };
  }
}

// ── HTTP Server ────────────────────────────────────────────────────

const PORT = process.env.PORT || 8789;

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  // Health
  if (req.method === "GET" && req.url === "/health") {
    return respond(res, 200, { status: "ok", server: "upc-plu-lookup", version: "1.1.0" });
  }

  // Info page
  if (req.method === "GET" && req.url === "/") {
    return respond(res, 200, {
      server: "UPC/PLU Lookup MCP Server",
      version: "1.1.0",
      endpoints: { health: "/health", mcp: "/mcp" },
      tools: tools.map(t => t.name),
    });
  }

  // MCP JSON-RPC
  if (req.method === "POST" && req.url === "/mcp") {
    let body = "";
    for await (const chunk of req) body += chunk;
    let rpc;
    try { rpc = JSON.parse(body); } catch {
      return respond(res, 400, { jsonrpc: "2.0", error: { code: -32700, message: "Parse error" } });
    }

    const id = rpc.id;
    const method = rpc.method;

    if (method === "initialize") {
      return respond(res, 200, {
        jsonrpc: "2.0", id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "upc-plu-lookup", version: "1.1.0" },
        },
      });
    }

    if (method === "tools/list") {
      return respond(res, 200, { jsonrpc: "2.0", id, result: { tools } });
    }

    if (method === "tools/call") {
      const result = await callTool(rpc.params?.name, rpc.params?.arguments || {});
      return respond(res, 200, { jsonrpc: "2.0", id, result });
    }

    return respond(res, 200, { jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown method: ${method}` } });
  }

  res.writeHead(404);
  res.end("Not found");
});

function respond(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) });
  res.end(body);
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`UPC/PLU MCP server listening on port ${PORT}`);
  console.log(`Health:  http://localhost:${PORT}/health`);
  console.log(`MCP:     http://localhost:${PORT}/mcp`);
});

// Graceful shutdown
process.on("SIGTERM", () => { server.close(); process.exit(0); });
process.on("SIGINT", () => { server.close(); process.exit(0); });
