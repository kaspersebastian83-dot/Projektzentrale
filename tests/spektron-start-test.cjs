// Für Browsertests mit erfundenen Projektnummern unter 26.0560: Spektron-Start abschalten ('00.0000'), damit die Projekte wie
// bisher in der Liste stehen. Den Start selbst prüft tests/heute-browser.cjs.
// Außerdem: Die Testserver liefern nur die Projektzentrale. TeamKit (../teamkit/, ab 1.51 unsichtbar im Rahmen) bekommt eine
// leere Testseite, sonst meldet die Konsole 404. Die Anbindung selbst prüft tests/team-browser.cjs.
module.exports = function ohneSpektronStart(browser, start = '00.0000'){
  const neu = browser.newContext.bind(browser);
  browser.newContext = async (...a) => {
    const c = await neu(...a); await c.addInitScript(s => { window.SPEKTRON_START_TEST = s; }, start);
    await c.route(/\/teamkit\//, r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><title>TeamKit Testziel</title>' }));
    return c;
  };
  return browser;
};
