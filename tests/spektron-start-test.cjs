// Für Browsertests mit erfundenen Projektnummern unter 26.0560: Spektron-Start abschalten ('00.0000'), damit die Projekte wie
// bisher in der Liste stehen. Den Start selbst prüft tests/heute-browser.cjs.
module.exports = function ohneSpektronStart(browser, start = '00.0000'){
  const neu = browser.newContext.bind(browser);
  browser.newContext = async (...a) => { const c = await neu(...a); await c.addInitScript(s => { window.SPEKTRON_START_TEST = s; }, start); return c; };
  return browser;
};
