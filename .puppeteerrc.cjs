const {join} = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Changes the cache location for Puppeteer to be within the project directory
  // This is required for Render.com to properly cache and find Chrome
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
