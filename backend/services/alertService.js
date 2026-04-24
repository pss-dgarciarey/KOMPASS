const { parseDurationMs } = require('../config');

class AlertService {
  constructor({ config, db, logger, metrics, state, services, fetchImpl }) {
    this.config = config;
    this.db = db;
    this.logger = logger;
    this.metrics = metrics;
    this.state = state;
    this.services = services;
    this.fetchImpl = fetchImpl;
    this.intervalHandle = null;
    this.defaultRules = [
      {
        id: 'goldstein-negative-30m',
        name: 'Goldstein < -5 for 30m',
        region: 'GLOBAL',
        metric: 'goldstein',
        operator: '<',
        threshold: -5,
        window: '30m',
        notifyWebhookUrl: '',
        active: true
      },
      {
        id: 'avg-tone-drop-60m',
        name: 'AvgTone drop > 10 in 60m',
        region: 'GLOBAL',
        metric: 'avgToneDrop',
        operator: '>',
        threshold: 10,
        window: '60m',
        notifyWebhookUrl: '',
        active: true
      }
    ];
  }

  compare(actual, operator, threshold) {
    switch (operator) {
      case '<':
        return actual < threshold;
      case '>':
        return actual > threshold;
      case '<=':
        return actual <= threshold;
      case '>=':
        return actual >= threshold;
      case '==':
        return actual === threshold;
      default:
        return false;
    }
  }

  async loadRules() {
    return this.db.all(
      `
        SELECT id, name, region, metric, operator, threshold, window, notify_webhook_url AS notifyWebhookUrl, active
        FROM alerts
        WHERE active = 1
      `
    );
  }

  async computeMetric(rule) {
    const since = Date.now() - parseDurationMs(rule.window, 30 * 60_000);
    const rows =
      rule.region && rule.region !== 'GLOBAL'
        ? await this.db.all(
            `
              SELECT ts, avg_tone, goldstein
              FROM country_snapshots
              WHERE region = ? AND ts >= ?
              ORDER BY ts ASC
            `,
            [rule.region, since]
          )
        : await this.db.all(
            `
              SELECT ts, avg_tone, goldstein
              FROM global_snapshots
              WHERE ts >= ?
              ORDER BY ts ASC
            `,
            [since]
          );

    if (!rows.length) {
      return null;
    }

    const first = rows[0];
    const last = rows.at(-1);

    switch (rule.metric) {
      case 'goldstein':
        return last.goldstein;
      case 'avgTone':
        return last.avg_tone;
      case 'avgToneDrop':
        return Math.max(0, first.avg_tone - last.avg_tone);
      default:
        return null;
    }
  }

  async wasTriggeredRecently(ruleId, windowMs) {
    const row = await this.db.get(
      `
        SELECT triggered_at
        FROM alert_triggers
        WHERE rule_id = ?
        ORDER BY triggered_at DESC
        LIMIT 1
      `,
      [ruleId]
    );

    return row ? Date.now() - row.triggered_at < windowMs : false;
  }

  async triggerRule(rule, actual) {
    const message = `Tension Alert: ${rule.region} \u2014 ${rule.metric} ${rule.operator} ${rule.threshold}`;
    const payload = {
      rule,
      actual,
      at: new Date().toISOString()
    };

    await this.db.run(
      `
        INSERT INTO alert_triggers
          (rule_id, triggered_at, message, payload)
        VALUES (?, ?, ?, ?)
      `,
      [rule.id, Date.now(), message, JSON.stringify(payload)]
    );

    if (rule.notifyWebhookUrl) {
      try {
        await this.fetchImpl(rule.notifyWebhookUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-kompass-secret': this.config.alertWebhookSecret || 'TODO-set-secret'
          },
          body: JSON.stringify(payload)
        });
      } catch (error) {
        this.logger.warn('alerts', 'Webhook delivery failed', {
          ruleId: rule.id,
          error: error.message
        });
      }
    }

    this.logger.info('alerts', 'Triggered alert rule', {
      ruleId: rule.id,
      actual
    });
  }

  async evaluateRules() {
    const rules = await this.loadRules();
    for (const rule of rules) {
      const actual = await this.computeMetric(rule);
      if (actual === null) {
        continue;
      }

      if (!this.compare(actual, rule.operator, rule.threshold)) {
        continue;
      }

      const dedupeWindow = Math.max(
        15 * 60_000,
        Math.floor(parseDurationMs(rule.window, 60_000) / 2)
      );
      if (await this.wasTriggeredRecently(rule.id, dedupeWindow)) {
        continue;
      }

      await this.triggerRule(rule, actual);
    }
  }

  async listAlerts() {
    const [activeRules, recentTriggers] = await Promise.all([
      this.loadRules(),
      this.db.all(
        `
          SELECT id, rule_id AS ruleId, triggered_at AS triggeredAt, message, payload
          FROM alert_triggers
          ORDER BY triggered_at DESC
          LIMIT 20
        `
      )
    ]);

    return {
      activeRules,
      recentTriggers: recentTriggers.map((row) => ({
        ...row,
        triggeredAt: new Date(row.triggeredAt).toISOString(),
        payload: JSON.parse(row.payload)
      }))
    };
  }

  start() {
    this.stop();
    this.intervalHandle = setInterval(() => {
      this.evaluateRules().catch((error) => {
        this.metrics.inc('errors_total');
        this.logger.error('alerts', 'Scheduled alert evaluation failed', {
          error: error.message
        });
      });
    }, this.config.alertEvaluationIntervalMs);
  }

  stop() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }
}

module.exports = {
  AlertService
};
