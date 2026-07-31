# Reference copies

Working reference material copied from other repos — mine it for functionality,
don't run it as live code. The original ForexFactoryScraper stays at
`C:\Users\micha\source\repos\ForexFactoryScraper`; this copy (2026-07-31,
node_modules and .git stripped) is here so the AMA calendar retrofit can be
worked on inside this repo.

Mike's ruling: the scraper's functionality was the hard part — at minimum it is
the reference plate, and probably more once "how it works" is included. Mine
especially: `eventcrawler.js` (event crawling and parsing), `EventTypes.csv`
(event categorization — feeds the impact mapping), the filter/query API design,
and the Netlify function structure. See
`Docs/FUTUREFeature_ForexScrapperConnection.md` for the retrofit options.
