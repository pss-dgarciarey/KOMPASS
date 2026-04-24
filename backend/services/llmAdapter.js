async function generateNarrativeWithLlm() {
  // Leaving this off on purpose.
  // If I wire an LLM in later, keep it behind a flag and keep the key server-side.
  // Also worth keeping the prompt dead simple:
  // tone delta + goldstein + top themes + keywords, two sentences max.
  throw new Error('LLM adapter is disabled by default in Kompass.');
}

module.exports = {
  generateNarrativeWithLlm
};
