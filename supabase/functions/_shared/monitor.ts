// Monitor checking logic
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../db/database.types.ts";
import { logger } from "./config.ts";
import type {
  NotificationSpec,
  NotificationType,
  Status,
} from "./notifications.ts";

/** Wall clock for the whole fetch, including reading the body. */
export const FETCH_TIMEOUT_MS = 30_000;

/** Hard cap on the response we will buffer. Beyond this the check errors. */
export const MAX_BODY_BYTES = 5 * 1024 * 1024;

/**
 * Regex runs against at most this much of the page. Backtracking cost grows
 * superlinearly with input, so regex gets a tighter budget than a substring
 * scan does.
 */
export const MAX_REGEX_INPUT_BYTES = 512 * 1024;

/** Log a warning when a single match takes longer than this. */
const SLOW_MATCH_MS = 250;

/**
 * Exactly what a check needs. Narrower than the monitors row on purpose: a
 * row from the generated types satisfies this structurally, so callers pass
 * it straight through without a cast.
 */
export interface MonitorCheckTarget {
  url: string;
  pattern: string;
  pattern_type: string;
}

export interface CheckResult {
  status: "found" | "not_found" | "error";
  responseTime: number;
  contentSnippet?: string;
  errorMessage?: string;
}

/**
 * Read a response body with a hard byte ceiling.
 *
 * `response.text()` is unbounded, so a large or endless body is a memory and
 * liveness problem on a shared worker. Reading through the reader also keeps
 * the abort signal meaningful for the duration of the read.
 */
async function readCapped(
  response: Response,
  maxBytes: number,
): Promise<{ text: string; truncated: boolean }> {
  if (!response.body) return { text: "", truncated: false };

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      if (total + value.byteLength > maxBytes) {
        chunks.push(value.subarray(0, maxBytes - total));
        total = maxBytes;
        truncated = true;
        break;
      }
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { text: new TextDecoder().decode(buffer), truncated };
}

/**
 * Perform the actual monitor check by fetching the URL and checking the pattern
 */
export async function performMonitorCheck(
  monitor: MonitorCheckTarget,
): Promise<CheckResult> {
  const startTime = Date.now();
  const controller = new AbortController();
  // Not cleared until the body has been read. Clearing it as soon as the
  // headers arrived -- which is what this used to do -- left the body read
  // unbounded, so a server that stalls mid-body hung the check indefinitely.
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(monitor.url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "RooRooRoo-Monitor/1.0 (Website Monitor)",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      return {
        status: "error",
        responseTime: Date.now() - startTime,
        errorMessage: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const { text: content, truncated } = await readCapped(
      response,
      MAX_BODY_BYTES,
    );
    const responseTime = Date.now() - startTime;

    if (truncated) {
      logger.warn(
        `Response from ${monitor.url} exceeded ${MAX_BODY_BYTES} bytes; matching against the truncated prefix`,
      );
    }

    const patternResult = checkPattern(
      content,
      monitor.pattern,
      monitor.pattern_type,
    );

    if (patternResult.error) {
      return {
        status: "error",
        responseTime,
        errorMessage: patternResult.error,
      };
    }

    return {
      status: patternResult.found ? "found" : "not_found",
      responseTime,
      contentSnippet: patternResult.snippet,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    let errorMessage = "Unknown error";
    if (error instanceof Error) {
      errorMessage = error.name === "AbortError"
        ? `Request timeout (${FETCH_TIMEOUT_MS / 1000} seconds)`
        : error.message;
    }

    return { status: "error", responseTime, errorMessage };
  } finally {
    clearTimeout(timeoutId);
  }
}

interface RegexGroup {
  start: number;
  bodyStart: number;
  /** Body contains an open-ended quantifier, e.g. `a+`. */
  unbounded: boolean;
  /** Top-level `|` inside this group. */
  alternation: boolean;
  /** Offsets of the top-level `|` separators, for branch extraction. */
  bars: number[];
}

function quantifierAt(pattern: string, i: number): string | null {
  const match = /^(?:[*+]|\{\d+,\}|\{\d+,\d+\})/.exec(pattern.slice(i));
  return match ? match[0] : null;
}

/**
 * Reject regex patterns that can backtrack catastrophically.
 *
 * A pattern is user-supplied and runs on a shared edge worker, where a match
 * is synchronous and uninterruptible: neither the AbortController nor a timer
 * can stop it, because nothing else on the isolate runs until it finishes.
 * `(a+)+$` against 47 bytes is enough to wedge the worker, so a dangerous
 * pattern has to be refused before it is ever compiled.
 *
 * This is a screen, not a proof -- deciding this in general is undecidable.
 * It covers the mechanism behind essentially every practical case: a
 * quantifier applied to a group that can match the same input more than one
 * way. The complete fix is a linear-time engine (RE2), which needs a WASM
 * dependency in the cold-start path and is deliberately left for later.
 *
 * @returns the offending fragment, or null if nothing suspicious was found.
 */
export function findUnsafeRegexConstruct(pattern: string): string | null {
  const stack: RegexGroup[] = [];
  let inClass = false;

  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];

    if (c === "\\") {
      i++;
      continue;
    }
    if (inClass) {
      if (c === "]") inClass = false;
      continue;
    }
    if (c === "[") {
      inClass = true;
      continue;
    }

    if (c === "(") {
      // Skip the group-kind prefix so `(?:` / `(?<name>` bodies start correctly.
      const prefix = /^\((?:\?:|\?<[^>]*>|\?[=!]|\?<[=!])?/.exec(
        pattern.slice(i),
      );
      stack.push({
        start: i,
        bodyStart: i + (prefix?.[0].length ?? 1),
        unbounded: false,
        alternation: false,
        bars: [],
      });
      continue;
    }

    if (c === ")") {
      const group = stack.pop();
      if (!group) continue; // Unbalanced; RegExp will reject it for us.
      const quant = quantifierAt(pattern, i + 1);
      if (!quant) continue;

      const body = pattern.slice(group.bodyStart, i);
      if (group.unbounded) {
        return pattern.slice(group.start, i + 1 + quant.length);
      }
      if (
        group.alternation && branchesOverlap(body, group.bars, group.bodyStart)
      ) {
        return pattern.slice(group.start, i + 1 + quant.length);
      }
      // A quantified group is itself an unbounded repetition to its parent.
      if (stack.length) stack[stack.length - 1].unbounded = true;
      continue;
    }

    if (c === "|") {
      if (stack.length) {
        stack[stack.length - 1].alternation = true;
        stack[stack.length - 1].bars.push(i);
      }
      continue;
    }

    if (quantifierAt(pattern, i) && stack.length) {
      stack[stack.length - 1].unbounded = true;
    }
  }

  return null;
}

/**
 * Cheap overlap test for the branches of a quantified alternation.
 *
 * `(cat|dog)+` is safe because no input matches two branches; `(a|a)*` and
 * `(\d|\w)+` are not. Comparing what each branch can match first catches the
 * dangerous shapes without rejecting the common safe ones -- `(\d|,)+` stays
 * allowed, because a comma is not a digit.
 */
function branchesOverlap(
  body: string,
  barOffsets: number[],
  bodyStart: number,
): boolean {
  const branches: string[] = [];
  let prev = 0;
  for (const bar of barOffsets) {
    branches.push(body.slice(prev, bar - bodyStart));
    prev = bar - bodyStart + 1;
  }
  branches.push(body.slice(prev));

  const tokens = branches.map(firstToken);
  for (let i = 0; i < tokens.length; i++) {
    for (let j = i + 1; j < tokens.length; j++) {
      if (tokensOverlap(tokens[i], tokens[j])) return true;
    }
  }
  return false;
}

/**
 * What the first position of an alternation branch can match.
 *
 * Only enough resolution to answer "can two branches both match the same next
 * character": the shorthand classes, a single literal, or `wide` for anything
 * that would need real analysis.
 */
type FirstToken =
  | { kind: "wide" }
  | { kind: "class"; name: "d" | "w" | "s" }
  | { kind: "literal"; char: string };

function firstToken(branch: string): FirstToken {
  const b = branch.trimStart();
  if (!b) return { kind: "wide" }; // An empty branch matches anywhere.

  if (b[0] === "\\") {
    const next = b[1];
    if (next === "d" || next === "w" || next === "s") {
      return { kind: "class", name: next };
    }
    // A negated class or an assertion covers too much to reason about.
    if (next && "DWSbB".includes(next)) return { kind: "wide" };
    return { kind: "literal", char: next ?? "" };
  }

  if (b[0] === "[" || b[0] === "." || b[0] === "(") return { kind: "wide" };
  return { kind: "literal", char: b[0] };
}

const CLASS_TESTS: Record<"d" | "w" | "s", RegExp> = {
  d: /\d/,
  w: /\w/,
  s: /\s/,
};

function tokensOverlap(a: FirstToken, b: FirstToken): boolean {
  if (a.kind === "wide" || b.kind === "wide") return true;

  if (a.kind === "literal" && b.kind === "literal") return a.char === b.char;

  if (a.kind === "class" && b.kind === "class") {
    // \d is a subset of \w; \s is disjoint from both.
    if (a.name === b.name) return true;
    return [a.name, b.name].sort().join("") === "dw";
  }

  const literal = (a.kind === "literal" ? a : b) as { char: string };
  const cls = (a.kind === "class" ? a : b) as { name: "d" | "w" | "s" };
  return CLASS_TESTS[cls.name].test(literal.char);
}

/**
 * Check if pattern matches content based on pattern type
 */
export function checkPattern(
  content: string,
  pattern: string,
  patternType: string,
): { found: boolean; snippet?: string; error?: string } {
  try {
    switch (patternType) {
      case "contains": {
        const index = content.toLowerCase().indexOf(pattern.toLowerCase());
        if (index === -1) return { found: false };
        return {
          found: true,
          snippet: snippetAround(content, index, pattern.length),
        };
      }

      case "not_contains": {
        return {
          found: !content.toLowerCase().includes(pattern.toLowerCase()),
        };
      }

      case "regex": {
        const unsafe = findUnsafeRegexConstruct(pattern);
        if (unsafe) {
          return {
            found: false,
            error:
              `Pattern rejected: "${unsafe}" can backtrack catastrophically ` +
              `and would hang the checker. Rewrite it without a quantifier ` +
              `applied to a repeatable group.`,
          };
        }

        const subject = content.length > MAX_REGEX_INPUT_BYTES
          ? content.slice(0, MAX_REGEX_INPUT_BYTES)
          : content;

        const startedAt = Date.now();
        const match = new RegExp(pattern, "i").exec(subject);
        const elapsed = Date.now() - startedAt;
        if (elapsed > SLOW_MATCH_MS) {
          logger.warn(
            `Slow regex match: ${elapsed}ms for pattern ${
              JSON.stringify(pattern)
            }`,
          );
        }

        if (!match) return { found: false };
        return {
          found: true,
          snippet: snippetAround(subject, match.index, match[0].length),
        };
      }

      default:
        return {
          found: false,
          error: `Unsupported pattern type: ${patternType}`,
        };
    }
  } catch (error) {
    // An invalid regex is the user's mistake, so it is reported rather than
    // quietly downgraded to "not found" -- which used to make a broken
    // pattern indistinguishable from a page that simply changed.
    return {
      found: false,
      error: error instanceof Error
        ? `Pattern matching failed: ${error.message}`
        : "Pattern matching failed",
    };
  }
}

function snippetAround(content: string, index: number, length: number): string {
  const start = Math.max(0, index - 50);
  const end = Math.min(content.length, index + length + 50);
  return content.substring(start, end).trim();
}

/**
 * Log the monitor check result to the database.
 *
 * supabase-js resolves with `{ error }` rather than rejecting -- for transport
 * failures too -- so the error has to be inspected. The try/catch that used to
 * wrap this call could never fire, and silently discarded every failed insert.
 */
export async function logMonitorCheck(
  supabase: SupabaseClient<Database>,
  monitorId: string,
  result: CheckResult,
): Promise<void> {
  const { error } = await supabase
    .from("monitor_logs")
    .insert({
      monitor_id: monitorId,
      status: result.status,
      response_time: result.responseTime,
      content_snippet: result.contentSnippet ?? null,
      error_message: result.errorMessage ?? null,
      checked_at: new Date().toISOString(),
    });

  // Deliberately not rethrown: a logging failure should not fail the check.
  if (error) {
    logger.error(
      `Failed to log check for monitor ${monitorId}: ${error.message}`,
    );
  }
}

export function getNotificationSpec(
  lastStatus: Status,
  newStatus: NotificationType,
  force = false,
): NotificationSpec | null {
  // A forced run reports honestly as "forced" rather than borrowing the
  // "initial" wording, which would claim to be a setup confirmation.
  if (force) {
    return { reason: "forced", type: newStatus };
  }

  if (lastStatus === "pending") {
    return { reason: "initial", type: newStatus };
  }

  if (newStatus === lastStatus) {
    return null;
  }

  return { reason: "changed", type: newStatus };
}
