# mcp-plu-upc

<p align="center">
  <img src="./assets/readme/hero.jpg" width="100%" alt="mcp-plu-upc: MCP server for UPC/barcode and PLU produce code lookups via Open Food Facts">
</p>

MCP server for UPC/barcode and PLU produce code lookups via Open Food Facts. Three tools, no API key required. Backed by a 4M+ product database.

**Tools:**
- `lookup_upc` — look up a product by UPC/EAN/GTIN barcode (8–14 digits)
- `lookup_plu` — look up produce by PLU code (4–5 digits)
- `search_product` — search products by name or brand (1–10 results)

**Quick start:**
```
git clone https://github.com/indigokarasu/mcp-plu-upc.git
cd mcp-plu-upc && node server.js
```
