# Fetch MCP Server

A simple and elegant MCP server that fetches URLs and converts their content to markdown format.

## Installation

1. Clone this repository to your desired folder:
   ```bash
   git clone <repository-url> fetch
   ```

2. Add the following configuration to your `mcp_settings.json` file:
   ```json
   "fetch": {
     "name": "fetch",
     "command": "node",
     "args": [
       "build/index.js"
     ],
     "cwd": "C:/path/to/your/fetch",
     "enabled": true,
     "disabled": false,
     "alwaysAllow": []
   }
   ```
   
   Make sure to update the `cwd` path to match where you cloned the repository.

3. That's it! The server is ready to use. No need to run `npm install` or `npm build` as the compiled files are already included.

## Features

- **URL Fetching**: Retrieve content from any URL with proper error handling
- **HTML to Markdown Conversion**: Automatically converts HTML content to clean, readable markdown
- **Content Extraction**: Uses Mozilla's Readability to extract the main content, removing navigation, ads, and other clutter
- **Metadata Support**: Optionally include page metadata like title, author, description, and Open Graph tags
- **Batch Processing**: Fetch multiple URLs in a single operation
- **Timeout Control**: Configurable timeout for requests

## Available Tools

### fetch_url
Fetches a single URL and converts it to markdown.

**Parameters:**
- `url` (required): The URL to fetch and convert to markdown
- `includeMetadata` (optional, default: false): Include page metadata (title, author, etc.)
- `simplify` (optional, default: true): Use readability to extract main content only
- `timeout` (optional, default: 30000): Request timeout in milliseconds

**Example:**
```
fetch_url("https://example.com/article", includeMetadata: true, simplify: true)
```

### fetch_urls
Fetches multiple URLs in batch and converts them to markdown.

**Parameters:**
- `urls` (required): Array of URLs to fetch
- `includeMetadata` (optional, default: false): Include page metadata
- `simplify` (optional, default: true): Use readability to extract main content
- `timeout` (optional, default: 30000): Request timeout per URL in milliseconds

**Example:**
```
fetch_urls(["https://example.com/article1", "https://example.com/article2"], includeMetadata: true)
```

## How It Works

1. **Content Fetching**: Uses axios to fetch web pages with appropriate headers to avoid blocks
2. **Content Extraction**: When `simplify` is enabled, uses Mozilla's Readability to extract the main article content
3. **HTML to Markdown**: Converts HTML to markdown using Turndown with custom rules for better formatting
4. **Metadata Extraction**: Optionally extracts metadata from meta tags, Open Graph tags, and page title

## Error Handling

The server handles various error scenarios:
- Network errors (connection failures, timeouts)
- HTTP errors (404, 500, etc.)
- Content parsing errors
- Invalid URLs

All errors are returned in a user-friendly format with clear error messages.

## Technical Details

- Built with TypeScript for type safety
- Uses ES modules
- Includes comprehensive error handling
- Supports custom user agent to avoid blocking
- Handles redirects automatically (up to 5 redirects)

## Dependencies

- `@modelcontextprotocol/sdk`: MCP SDK for server implementation
- `axios`: HTTP client for fetching URLs
- `turndown`: HTML to Markdown converter
- `@mozilla/readability`: Content extraction library
- `jsdom`: DOM implementation for Readability
- `zod`: Schema validation for tool parameters
