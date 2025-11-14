import { performance, PerformanceObserver } from "node:perf_hooks";

const obs = new PerformanceObserver((list) => {
  const entries = list.getEntries();
  entries.forEach((entry) => {
    console.log(`${entry.name}: ${entry.duration}ms`);
  });
});
obs.observe({ entryTypes: ["measure"] });

async function runBenchmark() {
  const iterations = 1000;
  process.env["AWS_LAMBDA_BENCHMARK_MODE"] = "1";

  performance.mark("direct-single-start");
  for (let i = 0; i < iterations; i++) {
    const invokeStore = (await import("./invoke-store.js")).InvokeStore;
    await invokeStore.getInstanceAsync();
    const testing = invokeStore._testing;
    if (testing) {
      testing.reset();
    } else {
      throw "testing needs to be defined";
    }
  }
  performance.mark("direct-single-end");
  performance.measure(
    "Direct SingleStore Creation (1000 iterations)",
    "direct-single-start",
    "direct-single-end",
  );

  performance.mark("direct-multi-start");
  process.env["AWS_LAMBDA_MAX_CONCURRENCY"] = "2";
  for (let i = 0; i < iterations; i++) {
    const invokeStore = (await import("./invoke-store.js")).InvokeStore;
    await invokeStore.getInstanceAsync();
    const testing = invokeStore._testing;
    if (testing) {
      testing.reset();
    } else {
      throw "testing needs to be defined";
    }
  }
  performance.mark("direct-multi-end");
  performance.measure(
    "Direct MultiStore Creation (1000 iterations)",
    "direct-multi-start",
    "direct-multi-end",
  );
}

runBenchmark().catch(console.error);
