/**
 * Unit tests for open-sse/translator/request/openai-to-claude.js
 *
 * Tests cover:
 *  - openaiToClaudeRequest() - OpenAI to Claude request translation
 *  - Response format handling (json_schema, json_object)
 */

import { describe, it, expect } from "vitest";
import { openaiToClaudeRequest } from "../../open-sse/translator/request/openai-to-claude.js";
import { openaiToClaudeResponse } from "../../open-sse/translator/response/openai-to-claude.js";

describe("openaiToClaudeRequest", () => {
  describe("response_format handling", () => {
    it("should inject JSON schema instructions for json_schema type", () => {
      const body = {
        messages: [{ role: "user", content: "What is 2+2?" }],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "math_response",
            schema: {
              type: "object",
              properties: {
                answer: { type: "number" },
                explanation: { type: "string" }
              },
              required: ["answer", "explanation"]
            }
          }
        }
      };

      const result = openaiToClaudeRequest("claude-sonnet-4.5", body, false);

      // Should have system array with instructions
      expect(result.system).toBeDefined();
      expect(Array.isArray(result.system)).toBe(true);
      
      // Check that system prompt includes schema
      const systemText = result.system
        .filter(s => s.type === "text")
        .map(s => s.text)
        .join("\n");
      
      expect(systemText).toContain("You must respond with valid JSON");
      expect(systemText).toContain("\"answer\"");
      expect(systemText).toContain("\"explanation\"");
      expect(systemText).toContain("Respond ONLY with the JSON object");
    });

    it("should inject basic JSON instructions for json_object type", () => {
      const body = {
        messages: [{ role: "user", content: "Give me a JSON object" }],
        response_format: {
          type: "json_object"
        }
      };

      const result = openaiToClaudeRequest("claude-sonnet-4.5", body, false);

      // Should have system array with instructions
      expect(result.system).toBeDefined();
      expect(Array.isArray(result.system)).toBe(true);
      
      const systemText = result.system
        .filter(s => s.type === "text")
        .map(s => s.text)
        .join("\n");
      
      expect(systemText).toContain("You must respond with valid JSON");
      expect(systemText).toContain("Respond ONLY with a JSON object");
    });

    it("should not modify system prompt when response_format is missing", () => {
      const body = {
        messages: [{ role: "user", content: "Hello" }]
      };

      const result = openaiToClaudeRequest("claude-sonnet-4.5", body, false);

      // Should have system but without JSON instructions
      expect(result.system).toBeDefined();
      
      const systemText = result.system
        .filter(s => s.type === "text")
        .map(s => s.text)
        .join("\n");
      
      // Should NOT contain JSON-specific instructions
      expect(systemText).not.toContain("You must respond with valid JSON");
    });

    it("should preserve existing system messages when adding response_format", () => {
      const body = {
        messages: [
          { role: "system", content: "You are a helpful math tutor." },
          { role: "user", content: "What is 2+2?" }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            schema: {
              type: "object",
              properties: {
                result: { type: "number" }
              }
            }
          }
        }
      };

      const result = openaiToClaudeRequest("claude-sonnet-4.5", body, false);

      // Should preserve original system message
      const systemText = result.system
        .filter(s => s.type === "text")
        .map(s => s.text)
        .join("\n");
      
      expect(systemText).toContain("You are a helpful math tutor");
      expect(systemText).toContain("You must respond with valid JSON");
    });
  });

  describe("tool_choice handling", () => {
    const baseBody = {
      messages: [{ role: "user", content: "add a todo" }],
      tools: [{
        type: "function",
        function: { name: "todo_write", description: "write todos", parameters: { type: "object", properties: {} } }
      }]
    };

    const choiceOf = (tc) =>
      openaiToClaudeRequest("claude-sonnet-4.5", { ...baseBody, tool_choice: tc }, false).tool_choice;

    it("converts OpenAI forced tool ({type:'function'}) to Claude {type:'tool'}", () => {
      // Must NOT leak the OpenAI "function" type — Claude only accepts auto|any|tool|none.
      expect(choiceOf({ type: "function", function: { name: "todo_write" } }))
        .toEqual({ type: "tool", name: "todo_write" });
    });

    it("maps string tool_choice values", () => {
      expect(choiceOf("auto")).toEqual({ type: "auto" });
      expect(choiceOf("none")).toEqual({ type: "auto" });
      expect(choiceOf("required")).toEqual({ type: "any" });
    });

    it("passes through Claude-native tool_choice objects unchanged", () => {
      expect(choiceOf({ type: "tool", name: "todo_write" })).toEqual({ type: "tool", name: "todo_write" });
      expect(choiceOf({ type: "any" })).toEqual({ type: "any" });
      expect(choiceOf({ type: "none" })).toEqual({ type: "none" });
    });

    it("never leaks an invalid type (falls back to auto)", () => {
      // Malformed forced choice with no tool name, and unknown types, must not
      // pass an invalid `type` through to Claude.
      expect(choiceOf({ type: "function", function: {} })).toEqual({ type: "auto" });
      expect(choiceOf({ type: "function" })).toEqual({ type: "auto" });
      expect(choiceOf({ type: "bogus" })).toEqual({ type: "auto" });
    });

    it("omits tool_choice entirely when the request has none", () => {
      const result = openaiToClaudeRequest("claude-sonnet-4.5", baseBody, false);
      expect(result.tool_choice).toBeUndefined();
    });
  });
});

describe("openaiToClaudeResponse", () => {
  it("omits empty Read pages tool argument before emitting Claude input deltas", () => {
    const state = { toolCalls: new Map() };
    const chunk = {
      id: "chatcmpl-test",
      model: "gpt-test",
      choices: [{
        delta: {
          tool_calls: [{
            index: 0,
            id: "call_read",
            function: {
              name: "Read",
              arguments: JSON.stringify({
                file_path: "/tmp/example.txt",
                offset: 0,
                limit: 120,
                pages: ""
              })
            }
          }]
        }
      }]
    };

    const result = openaiToClaudeResponse(chunk, state);
    const inputDelta = result.find(event => event.delta?.type === "input_json_delta");

    expect(inputDelta).toBeDefined();
    expect(JSON.parse(inputDelta.delta.partial_json)).toEqual({
      file_path: "/tmp/example.txt",
      offset: 0,
      limit: 120
    });
  });

  describe("tool_result image content", () => {
    const PNG_DATA = "data:image/png;base64,iVBORw0KGgo=";

    // Anthropic rejects image_url inside tool_result.content; it must become an image block.
    it("converts base64 image_url in role:tool result to a Claude image block", () => {
      const result = openaiToClaudeRequest("claude-x", {
        messages: [
          { role: "assistant", content: null, tool_calls: [{ id: "t1", type: "function", function: { name: "shot", arguments: "{}" } }] },
          { role: "tool", tool_call_id: "t1", content: [{ type: "image_url", image_url: { url: PNG_DATA } }] },
        ],
      }, false);

      const toolResult = result.messages.flatMap(m => m.content).find(b => b.type === "tool_result");
      expect(toolResult).toBeTruthy();
      expect(toolResult.content[0]).toEqual({
        type: "image",
        source: { type: "base64", media_type: "image/png", data: "iVBORw0KGgo=" },
      });
      expect(JSON.stringify(toolResult)).not.toContain("image_url");
    });

    it("converts remote http image_url in tool_result to source.type url", () => {
      const result = openaiToClaudeRequest("claude-x", {
        messages: [
          { role: "assistant", content: null, tool_calls: [{ id: "t1", type: "function", function: { name: "shot", arguments: "{}" } }] },
          { role: "tool", tool_call_id: "t1", content: [{ type: "image_url", image_url: { url: "https://example.com/a.png" } }] },
        ],
      }, false);

      const toolResult = result.messages.flatMap(m => m.content).find(b => b.type === "tool_result");
      expect(toolResult.content[0]).toEqual({
        type: "image",
        source: { type: "url", url: "https://example.com/a.png" },
      });
    });

    it("leaves text-only tool_result content untouched", () => {
      const result = openaiToClaudeRequest("claude-x", {
        messages: [
          { role: "assistant", content: null, tool_calls: [{ id: "t1", type: "function", function: { name: "shot", arguments: "{}" } }] },
          { role: "tool", tool_call_id: "t1", content: "plain text result" },
        ],
      }, false);

      const toolResult = result.messages.flatMap(m => m.content).find(b => b.type === "tool_result");
      expect(toolResult.content).toBe("plain text result");
    });
  });
});
