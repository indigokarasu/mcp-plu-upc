# mcp-plu-upc

<p align="center">
<img src="./assets/readme/hero.jpg" width="100%" alt="MCP server for UPC/barcode and PLU produce code lookups via Open Food Facts">
</p>

mcp-plu-upc — MCP server for UPC/barcode and PLU produce code lookups via Open Food Facts


> One clear job, done well.

## Quick start

bash
git clone https://github.com/indigokarasu/mcp-plu-upc.git
cd mcp-plu-upc
node server.js

## What it does

Three MCP tools backed by the [Open Food Facts](https://openfoodfacts.org) database (4M+ products, free, no API key):

| Tool | Description |
|------|-------------|
| lookup_upc | Look up a product by UPC/EAN/GTIN barcode (8-14 digits) |
| lookup_plu | Look up produce by PLU code (4-5 digits, e.g. 4011=banana) |
| search_product | Search products by name/brand (1-10 results) |

---

*mcp-plu-upc is part of the [OCAS Agent Suite](https://github.com/indigokarasu).*