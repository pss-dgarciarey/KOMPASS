function shouldLog(level, currentLevel) {
  const order = ['debug', 'info', 'warn', 'error'];
  return order.indexOf(level) >= order.indexOf(currentLevel);
}

function createLogger(level = 'info') {
  function write(logLevel, component, message, extra = {}) {
    if (!shouldLog(logLevel, level)) {
      return;
    }

    const payload = {
      timestamp: new Date().toISOString(),
      level: logLevel,
      component,
      message,
      ...extra
    };

    console.log(JSON.stringify(payload));
  }

  return {
    debug: (component, message, extra) => write('debug', component, message, extra),
    info: (component, message, extra) => write('info', component, message, extra),
    warn: (component, message, extra) => write('warn', component, message, extra),
    error: (component, message, extra) => write('error', component, message, extra)
  };
}

module.exports = {
  createLogger
};
