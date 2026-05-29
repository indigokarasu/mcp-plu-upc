# mcp-plu-upc

> MCP server for looking up product information by UPC, EAN, GTIN barcodes and PLU produce codes.

## Problem

Quick product lookups from barcodes — name, brand, nutrition, ingredients, packaging, origin, eco-score — without opening a browser or app. Use it from any MCP-compatible client (Claude Desktop, Cursor, etc.) via a `lookup_upc` tool call.

## What It Does

Three MCP tools backed by the [Open Food Facts](https://openfoodfacts.org) database (4M+ products, free, no API key):

| Tool | Description |
|------|-------------|
| `lookup_upc` | Look up a product by UPC/EAN/GTIN barcode (8-14 digits) |
| `lookup_plu` | Look up produce by PLU code (4-5 digits, e.g. 4011=banana) |
| `search_product` | Search products by name/brand (1-10 results) |

## Quick Start

```bash
git clone https://github.com/indigokarasu/mcp-plu-upc.git
cd mcp-plu-upc
node server.js
# Server starts on http://localhost:8789
```

Set `PORT` env var to change the port.

## Deploy on Your Own Server

### Systemd (recommended for always-on)

```bash
sudo cp upc-mcp.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable upc-mcp
sudo systemctl start upc-mcp
```

Edit the `WorkingDirectory` and `ExecStart` paths in `upc-mcp.service` to match your install location.

### On Cloudflare Workers

The `src/` directory contains the Cloudflare Workers version with KV caching. Deploy with:

```bash
npx wrangler deploy
```

**Note:** Cloudflare Workers currently cannot reach the OpenFood Facts API due to CF-to-CF SSL handshake failures (HTTP 525). Use the Node.js version for reliable data access.

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check — returns `{status: "ok"}` |
| `/mcp` | POST | JSON-RPC MCP protocol |
| `/` | GET | Info page (tool list) |

## MCP Protocol

### Initialize
```json
{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}},"id":1}
```

### List Tools
```json
{"jsonrpc":"2.0","method":"tools/list","id":2}
```

### Call Tool
```bash
curl -X POST http://localhost:8789/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"lookup_upc","arguments":{"barcode":"3017620422003"}},"id":3}'
```

### Example Response
```json
{
  "content": [{
    "type": "text",
    "text": "## Nutella\nBarcode: 3017620422003\nBrand: Nutella\nCategory: Petit-déjeuners > Produits à tartiner\nEco-Score: UNKNOWN\nProcessing: NOVA 4 — ultra-processed food\nPer 100g: 539 kcal, 6.3g protein, 57.5g carbs, 30.9g fat"
  }]
}
```

## Claude Desktop Integration

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "upc-plu-lookup": {
      "command": "npx",
      "args": ["mcp-remote", "http://YOUR_SERVER:8789/mcp"]
    }
  }
}
```

Or for local use:

```json
{
  "mcpServers": {
    "upc-plu-lookup": {
      "command": "node",
      "args": ["/path/to/mcp-plu-upc/server.js"]
    }
  }
}
```

## Platform Notes

| Platform | Status | Notes |
|----------|--------|-------|
| Node.js (local/VPS) | Works | Recommended deployment |
| Cloudflare Workers | Partial | MCP protocol works; OFF API returns 525 (CF-to-CF SSL) |
| Fly.io | Works | ~$2/mo minimum (no free tier) |
| Render | Works | Free tier available (sleeps after 15min) |

## Project Structure

```
.
├── server.js           # Standalone Node.js MCP server
├── package.json
├── upc-mcp.service     # Systemd service file
├── src/index.ts        # Cloudflare Workers version (with KV caching)
├── wrangler.toml        # Workers config
└── README.md
```

## License

MIT
