#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios from 'axios';
import TurndownService from 'turndown';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
// Create the MCP server
const server = new McpServer({
    name: "fetch",
    version: "1.0.0"
});
// Initialize Turndown service for HTML to Markdown conversion
const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
    strongDelimiter: '**',
});
// Configure turndown to handle more HTML elements
turndownService.keep(['iframe', 'video', 'audio']);
// Add custom rules for better markdown conversion
turndownService.addRule('strikethrough', {
    filter: ['del', 's', 'strike'],
    replacement: function (content) {
        return '~~' + content + '~~';
    }
});
// Helper function to extract readable content
function extractReadableContent(html, url) {
    try {
        const dom = new JSDOM(html, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        if (article && article.title && article.content) {
            return {
                title: article.title,
                content: article.content,
                byline: article.byline || undefined
            };
        }
        return null;
    }
    catch (error) {
        console.error('Readability extraction failed:', error);
        return null;
    }
}
// Main tool for fetching URLs
server.tool("fetch_url", {
    url: z.string().url().describe("The URL to fetch and convert to markdown"),
    includeMetadata: z.boolean().optional().default(false).describe("Include page metadata (title, author, etc.)"),
    simplify: z.boolean().optional().default(true).describe("Use readability to extract main content only"),
    timeout: z.number().optional().default(30000).describe("Request timeout in milliseconds"),
}, async ({ url, includeMetadata, simplify, timeout }) => {
    const result = await fetchSingleUrl(url, includeMetadata, simplify, timeout);
    if (result.success && result.content) {
        return {
            content: [
                {
                    type: "text",
                    text: result.content
                }
            ]
        };
    }
    else {
        return {
            content: [
                {
                    type: "text",
                    text: `Error fetching ${url}: ${result.error || 'Unknown error'}`
                }
            ],
            isError: true
        };
    }
});
// Helper function to fetch a single URL (shared between tools)
async function fetchSingleUrl(url, includeMetadata, simplify, timeout) {
    try {
        // Fetch the URL with a user agent to avoid blocks
        const response = await axios.get(url, {
            timeout,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 (MCP Fetch Bot)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
            },
            maxRedirects: 5,
            validateStatus: (status) => status < 400,
        });
        const html = response.data;
        let markdownContent = '';
        let metadata = {};
        if (simplify) {
            // Try to extract readable content
            const article = extractReadableContent(html, url);
            if (article) {
                // Convert the simplified HTML to markdown
                markdownContent = turndownService.turndown(article.content);
                if (includeMetadata) {
                    metadata.title = article.title;
                    if (article.byline) {
                        metadata.author = article.byline;
                    }
                }
            }
            else {
                // Fallback to full HTML conversion if readability fails
                markdownContent = turndownService.turndown(html);
            }
        }
        else {
            // Convert full HTML to markdown
            markdownContent = turndownService.turndown(html);
        }
        // Extract additional metadata if requested
        if (includeMetadata) {
            const dom = new JSDOM(html);
            const document = dom.window.document;
            // Extract title if not already set
            if (!metadata.title) {
                const titleElement = document.querySelector('title');
                if (titleElement) {
                    metadata.title = titleElement.textContent?.trim();
                }
            }
            // Extract meta tags
            const metaTags = document.querySelectorAll('meta');
            metaTags.forEach((tag) => {
                const name = tag.getAttribute('name') || tag.getAttribute('property');
                const content = tag.getAttribute('content');
                if (name && content) {
                    if (name.includes('description')) {
                        metadata.description = content;
                    }
                    else if (name.includes('author')) {
                        metadata.author = content;
                    }
                    else if (name.includes('keywords')) {
                        metadata.keywords = content;
                    }
                    else if (name.includes('og:')) {
                        // Open Graph tags
                        metadata[name] = content;
                    }
                }
            });
            // Add URL and fetch timestamp
            metadata.url = url;
            metadata.fetchedAt = new Date().toISOString();
        }
        // Format the response
        let finalContent = '';
        if (includeMetadata && Object.keys(metadata).length > 0) {
            finalContent += '---\n';
            for (const [key, value] of Object.entries(metadata)) {
                finalContent += `${key}: ${value}\n`;
            }
            finalContent += '---\n\n';
        }
        finalContent += markdownContent;
        return { success: true, content: finalContent };
    }
    catch (error) {
        let errorMessage = 'Failed to fetch URL';
        if (axios.isAxiosError(error)) {
            if (error.response) {
                errorMessage = `HTTP ${error.response.status}: ${error.response.statusText}`;
            }
            else if (error.request) {
                errorMessage = 'No response received from server';
            }
            else {
                errorMessage = error.message;
            }
        }
        else if (error instanceof Error) {
            errorMessage = error.message;
        }
        return { success: false, error: errorMessage };
    }
}
// Tool for batch fetching multiple URLs
server.tool("fetch_urls", {
    urls: z.array(z.string().url()).describe("Array of URLs to fetch"),
    includeMetadata: z.boolean().optional().default(false).describe("Include page metadata"),
    simplify: z.boolean().optional().default(true).describe("Use readability to extract main content"),
    timeout: z.number().optional().default(30000).describe("Request timeout per URL in milliseconds"),
}, async ({ urls, includeMetadata, simplify, timeout }) => {
    const results = [];
    for (const url of urls) {
        const result = await fetchSingleUrl(url, includeMetadata, simplify, timeout);
        if (result.success) {
            results.push({
                url,
                success: true,
                content: result.content,
            });
        }
        else {
            results.push({
                url,
                success: false,
                error: result.error,
            });
        }
    }
    // Format results as markdown
    let output = '# Batch Fetch Results\n\n';
    for (const result of results) {
        output += `## ${result.url}\n\n`;
        if (result.success) {
            output += result.content + '\n\n';
        }
        else {
            output += `**Error:** ${result.error}\n\n`;
        }
        output += '---\n\n';
    }
    return {
        content: [
            {
                type: "text",
                text: output
            }
        ]
    };
});
// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);
console.error('Fetch MCP server running on stdio');
//# sourceMappingURL=index.js.map