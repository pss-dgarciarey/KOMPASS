# Methodology

## What Kompass measures

Kompass treats public event coverage as a signal, not as objective truth. The current scaffold combines:

- GDELT AvgTone
- GDELT Goldstein-style conflict/cooperation intensity where available
- free market proxies such as VIX, S&P 500, BTC, Gold, Oil
- crypto Fear & Greed from Alternative.me

That mix is not philosophically pure. It is just practical: public news flow
and market stress often reinforce each other, and seeing both together is more
useful than pretending either side lives in a vacuum.

## AvgTone

AvgTone is a coarse sentiment-like indicator derived from media coverage. Lower values generally imply more negative or conflict-heavy coverage. Higher values generally imply calmer or more optimistic coverage.

Use it as a directional signal, not as a literal measure of how people feel.

It is especially bad at nuance. It handles broad drift better than subtle local
context.

## Goldstein

Goldstein-style scores try to represent whether events skew toward cooperation or conflict. Negative values generally point toward tension or confrontation. Positive values lean toward cooperation or de-escalation.

In the scaffold, Goldstein may be approximated when the chosen public GDELT endpoint does not expose a native value directly. That is useful for an MVP, but it is still an approximation.

If a country suddenly looks odd, check the event mix before trusting the number.
The metric can be dragged around by a burst of very similar stories.

## Interpretation guidance

- These signals are best read as *likely* or *correlated* conditions.
- They are not causal proof.
- They can be distorted by media volume, language coverage, and regional reporting asymmetries.
- A calm signal does not mean a place is safe.
- A negative signal does not mean the public mood is universally hostile.

## Bias and limitations

- GDELT reflects what is published and indexed, not everything that happens.
- English-language and large-media ecosystems may be overrepresented.
- Event tone can overreact to headline bursts.
- Financial proxies can move for reasons unrelated to public sentiment.

Kompass is strongest as a monitoring layer, not as an oracle.

## Privacy

The default scaffold does not collect personal data or user accounts. If you add user accounts later, perform a GDPR and privacy review before deployment.
