const { createApp } = require('./app');

async function main() {
  const { app, config, logger, startBackgroundJobs, stopBackgroundJobs } = await createApp();
  const server = app.listen(config.port, () => {
    logger.info('server', 'Kompass backend listening', {
      port: config.port,
      env: config.nodeEnv
    });
    startBackgroundJobs().catch((error) => {
      logger.error('startup', 'Background jobs failed to start', {
        error: error.message
      });
    });
  });

  const shutdown = async (signal) => {
    logger.info('server', 'Received shutdown signal', { signal });
    await stopBackgroundJobs();
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
