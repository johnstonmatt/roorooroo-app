import { assertEquals } from "jsr:@std/assert@1";
import { resolveEnvironment, resolveVersion } from "./openapi-document.ts";

/** Run `fn` with the given env applied, then put the environment back. */
function withEnv<T>(env: Record<string, string | null>, fn: () => T): T {
  const previous = new Map<string, string | undefined>();
  for (const [name, value] of Object.entries(env)) {
    previous.set(name, Deno.env.get(name));
    if (value === null) Deno.env.delete(name);
    else Deno.env.set(name, value);
  }
  try {
    return fn();
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) Deno.env.delete(name);
      else Deno.env.set(name, value);
    }
  }
}

Deno.test("a preview is not labelled production", () => {
  // DENO_DEPLOYMENT_ID is set on preview branches too, so the heuristic alone
  // reported "production" on every PR preview -- reassuring exactly when it
  // should not.
  assertEquals(
    withEnv(
      { APP_ENVIRONMENT: "preview", DENO_DEPLOYMENT_ID: "abc" },
      resolveEnvironment,
    ),
    "preview",
  );
});

Deno.test("production keeps the deployment-id heuristic", () => {
  assertEquals(
    withEnv(
      { APP_ENVIRONMENT: null, DENO_DEPLOYMENT_ID: "abc" },
      resolveEnvironment,
    ),
    "production",
  );
});

Deno.test("local reports development", () => {
  assertEquals(
    withEnv(
      { APP_ENVIRONMENT: null, DENO_DEPLOYMENT_ID: null },
      resolveEnvironment,
    ),
    "development",
  );
});

Deno.test("an empty APP_ENVIRONMENT falls through rather than blanking", () => {
  assertEquals(
    withEnv(
      { APP_ENVIRONMENT: "", DENO_DEPLOYMENT_ID: "abc" },
      resolveEnvironment,
    ),
    "production",
  );
});

Deno.test("version is the short CURRENT_SHA", () => {
  assertEquals(
    withEnv({ CURRENT_SHA: "7b1fe4c1abcdef0123456789" }, resolveVersion),
    "7b1fe4c",
  );
});

Deno.test("version falls back without a CURRENT_SHA", () => {
  assertEquals(withEnv({ CURRENT_SHA: null }, resolveVersion), "v0.0.0");
});
