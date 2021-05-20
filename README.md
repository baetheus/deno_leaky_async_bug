# Deno leaky async in testing bug

When testing async operations in Deno (Promise resolution) there are times when
it is necessary to allow a test to leave a promise running after the completion
of the test. The deno testing framework allows this to happen by using the
`sanitizeResources` and `sanitizeOps` flags to be set to false for a specific
test.

Unfortunately, this seems to push the operation sanitizing into adjacent tests.

This repository contains a minimal reproduction of the issue:

## Sample Code

```ts
import { assertEquals } from "https://deno.land/std/testing/asserts.ts";

type Task<A> = () => Promise<A>;

const task = <A>(a: A): Task<A> => () => Promise.resolve(a);

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

const delay = (ms: number) =>
  <A>(ma: Task<A>): Task<A> => () => wait(ms).then(ma);

const timeout = <A>(ms: number, onTimeout: () => A) =>
  (ta: Task<A>): Task<A> =>
    () => Promise.race([ta(), wait(ms).then(onTimeout)]);

// This test has a leaky op that is allowed to exist after the test ends
Deno.test({
  name: "Leaky",
  async fn() {
    const _timeout = timeout(1 * 1000, () => "Bollucks!");
    const _delay = delay(2 * 1000);
    const delayedTask = _delay(task("Good Value"));
    const result = await _timeout(delayedTask)();

    assertEquals(result, "Bollucks!");
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

// This test has no leaky ops but the test command will associate the above
// "Leaky" test's leaked op with this test
Deno.test("Not Leaky", async () => {
  const _delay = delay(3 * 1000);
  const delayedTask = _delay(task("Good Value"));
  const result = await delayedTask();

  assertEquals(result, "Good Value");
});
```

## Sample Test Run

```
curie deno_leaky_async_bug % deno --version
deno 1.10.2 (release, x86_64-apple-darwin)
v8 9.1.269.27
typescript 4.2.2
curie deno_leaky_async_bug % deno test leaky.test.ts
running 2 tests from file:///Users/brandon/Documents/github/baetheus/deno_leaky_async_bug/leaky.test.ts
test Leaky ... ok (1004ms)
test Not Leaky ... FAILED (3010ms)

failures:

Not Leaky
AssertionError: Test case is leaking async ops.
Before:
  - dispatched: 3
  - completed: 2
After:
  - dispatched: 5
  - completed: 5

Make sure to await all promises returned from Deno APIs before
finishing test case.
    at assert (deno:runtime/js/06_util.js:33:13)
    at asyncOpSanitizer (deno:runtime/js/40_testing.js:34:7)
    at async resourceSanitizer (deno:runtime/js/40_testing.js:58:7)
    at async exitSanitizer (deno:runtime/js/40_testing.js:85:9)
    at async runTest (deno:runtime/js/40_testing.js:199:7)
    at async Object.runTests (deno:runtime/js/40_testing.js:244:7)
    at async file:///Users/brandon/Documents/github/baetheus/deno_leaky_async_bug/$deno$test.js:1:1

failures:

	Not Leaky

test result: FAILED. 1 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out (4044ms)
```
