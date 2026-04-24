function createMetricsRegistry() {
  const counters = {
    api_calls_total: 0,
    explain_calls_total: 0,
    cache_hits_total: 0,
    cache_misses_total: 0,
    errors_total: 0
  };

  return {
    inc(name, value = 1) {
      counters[name] = (counters[name] || 0) + value;
    },
    snapshot() {
      return { ...counters };
    },
    renderPrometheus() {
      return Object.entries(counters)
        .map(([name, value]) => `# TYPE ${name} counter\n${name} ${value}`)
        .join('\n');
    }
  };
}

module.exports = {
  createMetricsRegistry
};
