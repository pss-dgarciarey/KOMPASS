async function retry(work, options = {}) {
  const {
    attempts = 3,
    baseDelayMs = 250,
    maxDelayMs = 2_500,
    jitter = 0.1,
    onRetry = () => {}
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await work(attempt);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) {
        break;
      }

      onRetry(error, attempt);
      const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      const variance = exponential * jitter * Math.random();
      const delayMs = Math.round(exponential + variance);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

module.exports = {
  retry
};
