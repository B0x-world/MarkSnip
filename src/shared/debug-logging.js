(function (root) {
  function createLogger(options) {
    const consoleRef = (options && options.console) || root.console || {};

    function write(method, fallback, args) {
      if (typeof consoleRef[method] === "function") {
        consoleRef[method](...args);
        return;
      }
      if (fallback && typeof consoleRef[fallback] === "function") {
        consoleRef[fallback](...args);
      }
    }

    return {
      debug(...args) {
        write("debug", "log", args);
      },
      info(...args) {
        write("info", "log", args);
      },
      warn(...args) {
        write("warn", "log", args);
      },
      error(...args) {
        write("error", "log", args);
      }
    };
  }

  const logger = createLogger();
  root.markSnipLogger = logger;
  root.markSnipCreateLogger = createLogger;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      createLogger
    };
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
