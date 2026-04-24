const express = require('express');
const { parseDurationMs } = require('../config');

function createApiRouter({ services, state }) {
  const router = express.Router();

  function emptyInspection(region) {
    // Keep the response shape stable so the panel can render immediately and fill in details later.
    return {
      region,
      rawEventCount: 0,
      qualifiedEventCount: 0,
      backgroundEventCount: 0,
      signalShare: 0,
      qualifiedEvents: [],
      backgroundEvents: [],
      sourceLens: {
        qualified: null,
        background: null,
        raw: null
      },
      focusedFeeds: {
        configured: [],
        responding: [],
        failures: []
      }
    };
  }

  function resolveWithin(promise, timeoutMs, fallbackValue) {
    // Small helper for "nice to have" data. The route should finish even if one side panel stalls.
    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        resolve({
          ok: false,
          timedOut: true,
          value: fallbackValue
        });
      }, timeoutMs);

      Promise.resolve(promise)
        .then((value) => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timer);
          resolve({
            ok: true,
            timedOut: false,
            value
          });
        })
        .catch(() => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timer);
          resolve({
            ok: false,
            timedOut: false,
            value: fallbackValue
          });
        });
    });
  }

  router.get('/health', async (req, res) => {
    res.json({
      ok: true,
      ready: Boolean(state.lastGdeltFetchAt && state.lastFinanceFetchAt),
      lastFetches: {
        gdelt: state.lastGdeltFetchAt,
        finance: state.lastFinanceFetchAt
      },
      lastLiveFetches: {
        gdelt: state.lastLiveGdeltFetchAt || state.lastGdeltFetchAt,
        finance: state.lastLiveFinanceFetchAt || state.lastFinanceFetchAt
      },
      sources: {
        gdelt: state.lastGdeltSource,
        finance: state.lastFinanceSource
      },
      coverage: {
        gdelt: {
          countryCount: state.latestGlobalMetadata?.countryCount || 0,
          sourceCount: state.latestGlobalMetadata?.sourceCount || 0,
          configuredOutletCount:
            state.lastGdeltRequestStats?.feedPlan?.configuredOutletCount ||
            state.latestGlobalMetadata?.configuredOutletCount ||
            0,
          configuredConflictOutletCount: state.lastGdeltRequestStats?.feedPlan?.configuredConflictOutletCount || 0,
          configuredGlobalCount: state.lastGdeltRequestStats?.feedPlan?.configuredGlobalCount || 0,
          configuredPulseCount: state.lastGdeltRequestStats?.feedPlan?.configuredPulseCount || 0,
          feedMix: state.latestGlobalMetadata?.feedMix || [],
          conflictScore: state.latestGlobalMetadata?.conflictScore || 0,
          requestCount: state.lastGdeltRequestStats?.requestCount || 0,
          successCount: state.lastGdeltRequestStats?.successCount || 0,
          failureCount: state.lastGdeltRequestStats?.failureCount || 0,
          slices: (state.lastGdeltRequestStats?.countries || []).slice(0, 24),
          selectedOutletCount: state.lastGdeltRequestStats?.feedPlan?.selectedOutletCount || 0,
          selectedConflictOutletCount: state.lastGdeltRequestStats?.feedPlan?.selectedConflictOutletCount || 0,
          selectedPulseCount: state.lastGdeltRequestStats?.feedPlan?.selectedPulseCount || 0,
          selectedShippingCount: state.lastGdeltRequestStats?.feedPlan?.selectedShippingCount || 0,
          selectedSocialCount: state.lastGdeltRequestStats?.feedPlan?.selectedSocialCount || 0,
          respondingOutletCount: state.lastGdeltRequestStats?.feedPlan?.respondingOutletCount || 0,
          respondingConflictOutletCount: state.lastGdeltRequestStats?.feedPlan?.respondingConflictOutletCount || 0,
          configuredShippingCount: state.lastGdeltRequestStats?.feedPlan?.configuredShippingCount || 0,
          respondingShippingCount: state.lastGdeltRequestStats?.feedPlan?.respondingShippingCount || 0,
          configuredSocialCount: state.lastGdeltRequestStats?.feedPlan?.configuredSocialCount || 0,
          respondingSocialCount: state.lastGdeltRequestStats?.feedPlan?.respondingSocialCount || 0,
          configuredFeedChannelCount:
            (state.lastGdeltRequestStats?.feedPlan?.configuredGlobalCount || 0) +
            (state.lastGdeltRequestStats?.feedPlan?.configuredOutletCount || 0) +
            (state.lastGdeltRequestStats?.feedPlan?.configuredConflictOutletCount || 0) +
            (state.lastGdeltRequestStats?.feedPlan?.configuredPulseCount || 0) +
            (state.lastGdeltRequestStats?.feedPlan?.configuredShippingCount || 0) +
            (state.lastGdeltRequestStats?.feedPlan?.configuredSocialCount || 0)
        },
        finance: {
          sourceCount: state.marketSnapshot?.providerStats?.availableInstruments?.length || 0,
          missingCount: state.marketSnapshot?.providerStats?.missingInstruments?.length || 0,
          activeKgpiInputs: state.marketSnapshot?.kgpi?.metadata?.activeInputs || []
        }
      }
    });
  });

  router.get('/metrics', async (req, res, next) => {
    try {
      const region = req.query.region ? String(req.query.region).toUpperCase() : null;
      const sinceMs = req.query.since
        ? Date.now() - parseDurationMs(req.query.since, 24 * 3_600_000)
        : Date.now() - 24 * 3_600_000;
      // This is the dashboard workhorse route, so keep it boring and predictable.
      const sentiment = await services.gdeltService.getMetrics({ region, sinceMs });
      const finance = await services.financeService.getHistory(24);

      res.json({
        ok: true,
        ...sentiment,
        marketMoodSeries: finance.points.map((point) => ({
          timestamp: point.timestamp,
          mood: point.mood
        })),
        kgpiSeries: finance.points.map((point) => ({
          timestamp: point.timestamp,
          score: point.kgpi ?? point.mood
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/regions/:region', async (req, res, next) => {
    try {
      const region = String(req.params.region || '').toUpperCase();
      const sinceMs = req.query.since
        ? Date.now() - parseDurationMs(req.query.since, 7 * 24 * 3_600_000)
        : Date.now() - (7 * 24 * 3_600_000);
      const inspectionWindowMs = req.query.inspectionWindow
        ? parseDurationMs(req.query.inspectionWindow, 72 * 3_600_000)
        : 72 * 3_600_000;
      const metrics = await services.gdeltService.getMetrics({ region, sinceMs });
      const [inspectionResult, contextResult] = await Promise.all([
        resolveWithin(
          services.gdeltService.getRegionInspection(region, { windowMs: inspectionWindowMs }),
          6_500,
          emptyInspection(region)
        ),
        resolveWithin(
          services.countryContextService.getCountryContext(region),
          4_500,
          {
            country: {
              iso3: region,
              alpha2: region.slice(0, 2),
              name: region,
              benchmark: null,
              demonyms: []
            },
            unemployment: null,
            inflation: null,
            benchmark: null,
            macroComposite: {
              score: 0,
              label: 'limited-data',
              components: {}
            },
            narrative: 'Country macro overlay is limited right now, so the view leans more heavily on the signal-quality filters.',
            updatedAt: new Date().toISOString()
          }
        )
      ]);

      const inspection = inspectionResult.value;
      const context = contextResult.value;

      const snapshot = metrics.regionSnapshot || {
        region,
        avgTone: null,
        goldstein: null,
        eventCount: 0,
        topThemes: [],
        topConflictTags: [],
        sourceCount: 0,
        rawSourceCount: 0,
        configuredOutletCount: 0,
        topSources: [],
        sourceBreakdown: [],
        sourceLens: null,
        feedMix: [],
        conflictScore: 0,
        rawEventCount: 0,
        signalShare: 0,
        dataSource: state.lastGdeltSource || 'boot'
      };
      const explanation = services.explainService.buildExplanation({
        events: inspection.qualifiedEvents.length
          ? inspection.qualifiedEvents
          : inspection.backgroundEvents,
        currentAvgTone: snapshot.avgTone,
        previousAvgTone:
          metrics.regionSeries?.at(-2)?.avgTone ??
          metrics.regionSeries?.at(-1)?.avgTone ??
          snapshot.avgTone,
        goldstein: snapshot.goldstein,
        scope: 'region',
        contextLabel: context.country?.name || region
      });

      res.json({
        ok: true,
        region,
        snapshot,
        series: {
          sentiment: metrics.regionSeries || [],
          benchmark: context.benchmark || null
        },
        inspection,
        context,
        explanation,
        narratives: {
          signal: explanation.explanation,
          macro: context.narrative,
          combined: `${explanation.explanation} ${context.narrative}`.trim()
        },
        warnings: {
          inspectionTimedOut: inspectionResult.timedOut,
          contextTimedOut: contextResult.timedOut
        },
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/top-events', async (req, res, next) => {
    try {
      const limit = Number.parseInt(req.query.limit, 10) || 5;
      const windowMs = parseDurationMs(req.query.window, 60 * 60_000);
      const region = req.query.region ? String(req.query.region).toUpperCase() : null;
      const conflictOnly = ['1', 'true', 'yes', 'on'].includes(
        String(req.query.conflictOnly || '').toLowerCase()
      );
      res.json({
        ok: true,
        items: services.gdeltService.getTopEvents({ limit, windowMs, region, conflictOnly })
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/finance', async (req, res, next) => {
    try {
      res.json({
        ok: true,
        ...(await services.financeService.getMarketSnapshot())
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/finance/history', async (req, res, next) => {
    try {
      res.json({
        ok: true,
        ...(await services.financeService.getAssetHistory({
          asset: req.query.asset || 'kgpi',
          rangeMs: parseDurationMs(req.query.range, 24 * 3_600_000),
          intervalMs: req.query.interval
            ? parseDurationMs(req.query.interval, 30 * 60_000)
            : undefined
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/explain', async (req, res, next) => {
    try {
      res.json({
        ok: true,
        ...services.explainService.buildExplanation(req.body || {})
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/correlations', async (req, res, next) => {
    try {
      const window = req.query.window || '6h';
      res.json({
        ok: true,
        ...(await services.correlationService.getCorrelations(window))
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/alerts', async (req, res, next) => {
    try {
      res.json({
        ok: true,
        ...(await services.alertService.listAlerts())
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/conflicts', async (req, res, next) => {
    try {
      res.json({
        ok: true,
        ...(await services.conflictService.listConflicts())
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/conflicts/:slug', async (req, res, next) => {
    try {
      res.json({
        ok: true,
        ...(await services.conflictService.getConflict(req.params.slug))
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = {
  createApiRouter
};
