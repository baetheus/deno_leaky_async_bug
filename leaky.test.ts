import { assertEquals } from "https://deno.land/std/testing/asserts.ts";

type Task<A> = () => Promise<A>;

const task = <A>(a: A): Task<A> => () => Promise.resolve(a);

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

const delay = (ms: number) =>
  <A>(ma: Task<A>): Task<A> => () => wait(ms).then(ma);

const timeout = <A>(ms: number, onTimeout: () => A) =>
  (ta: Task<A>): Task<A> =>
    () => Promise.race([ta(), wait(ms).then(onTimeout)]);

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

Deno.test("Not Leaky", async () => {
  const _delay = delay(3 * 1000);
  const delayedTask = _delay(task("Good Value"));
  const result = await delayedTask();

  assertEquals(result, "Good Value");
});
