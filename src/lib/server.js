#!/usr/bin/env node

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createClient } from 'nightwatch';


const server = new McpServer({
    name: "MCP NightwatchJS",
    version: process.env.npm_package_version,
});

// Session management for storing active browser sessions and authenticated users
// Server state
const state = {
    activeSessions: new Map(),
    currentSession: null
};


// Helper function to create or get an active session
async function getSession(browserType) {
    if (!browserType) {
        browserType = "chrome";
    }
    if (state.currentSession) {
        return state.activeSessions.get(state.currentSession);
    }
    console.log("no session found, creating a new one");
    const client = createClient({
        browserName: browserType,
        globals: {},
        parallel: false,
        test_workers: false,
        env: null,
        test_settings: {
            default: {
                desiredCapabilities: {
                    browserName: "chrome",
                    "goog:chromeOptions": {
                        args: ["--headless", "--disable-gpu", "--no-sandbox"],
                    },
                },
            },
        },
    })
    const browser = await client.launchBrowser();
    console.log("client created");
    const sessionId = `${browser}_${Date.now()}`;
    state.activeSessions.set(sessionId, browser);
    state.currentSession = sessionId;
    console.log("state updated")
    return browser;
}


// Browser Management Tools
server.tool(
    "start_browser",
    "launches browser in chrome",
    {
        browserType: z.enum(["chrome", "firefox"]).optional().default("chrome").describe("Browser type to launch")
    },
    async ({ browser }) => {
        try {
            const browser = await getSession();
            return {
                content: [{ type: 'text', text: `Browser started with session_id: ${sessionId}` }]
            };
        } catch (error) {
            return {
                content: [{ type: 'text', text: `Error starting browser: ${error.message}` }]
            };
        }

    }
);

server.tool(
    "navigate",
    "navigates to a URL",
    {
        url: z.string().describe("URL to navigate to")

    },
    async ({ url }) => {
        try {
            const browser = await getSession();
            await browser.navigateTo(url);
            return {
                content: [{ type: 'text', text: `Navigated to ${url}` }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error navigating: ${e.message}` }]
            };
        }
    }
);

server.tool(
    "take_screenshot",
    "captures a screenshot of the current page",
    {
        outputPath: z.string().optional().nullable().describe("Optional path where to save the screenshot. If not provided, returns base64 data.")
    },
    async ({ outputPath }) => {
        try {
            const browser = await getSession();
            const screenshot = await browser.screenshot();

            if (outputPath && outputPath !== "") {
                const fs = await import('fs');
                await fs.promises.writeFile(outputPath, screenshot, 'base64');
                return {
                    content: [{ type: 'text', text: `Screenshot saved to ${outputPath}` }]
                };
            } else {
                return {
                    content: [
                        { type: 'text', text: 'Screenshot captured as base64:' },
                        { type: 'text', text: screenshot }
                    ]
                };
            }
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error taking screenshot: ${e.message}` }]
            };
        }
    }
);

server.tool(
    "click_element",
    "clicks an element",
    {
        locator: z.string().describe("Locator for the element to click"),
        timeout: z.number().optional().describe("Timeout in milliseconds (default: 10000)")
    },
    async ({ locator, timeout = 10000 }) => {
        try {
            const browser = await getSession();
            await browser.click(locator, timeout);
            return {
                content: [{ type: 'text', text: 'Element clicked' }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error clicking element: ${e.message}` }]
            };
        }
    }
);

server.tool(
    "send_keys",
    "sends keys to an element, aka typing",
    {
        locator: z.string().describe("Locator for the element to send keys to"),
        text: z.string().describe("Text to enter into the element")
    },
    async ({ locator, text }) => {
        try {
            const browser = await getSession();
            await browser.setValue(locator, text);
            return {
                content: [{ type: 'text', text: `Text "${text}" entered into element` }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error entering text: ${e.message}` }]
            };
        }
    }
);

server.tool(
    "close_session",
    "closes the current browser session",
    {},
    async () => {
        const sessionId = state.currentSession;
        await closeSession(sessionId);
        return {
            content: [{ type: 'text', text: `Browser session ${sessionId} closed` }]
        };
    }
);

// Function to close a session
async function closeSession(sessionId) {
    const client = state.activeSessions.get(sessionId);
    if (client) {
        await client.end();
        state.activeSessions.delete(sessionId);
    }
    state.currentSession = null;

}


async function cleanup() {
    await closeSession(state.currentSession);
    process.exit(0);
}

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

// Start the server
console.log("Starting MCP NightwatchJS server...");
const transport = new StdioServerTransport();
await server.connect(transport);
console.log("MCP NightwatchJS server started and listening for commands...");
