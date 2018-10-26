const fs = require('fs');
const d3 = require('d3');
const usaData = require('./us-state-data.js');

const MIN_NBA_YEAR = 2002;

const seasons = d3.csvParse(
  fs.readFileSync('./input/player-seasons--rank.csv', 'utf-8')
);
const rsci = d3.csvParse(fs.readFileSync('./input/rsci--bbr.csv', 'utf-8'));

const players = d3
  .nest()
  .key(d => d.bbrID)
  .entries(seasons);

function getID(link) {
  if (link.startsWith('/players')) {
    const tempID = link.replace('/players/', '').replace('.html', '');
    const bbrID = tempID.split('/')[1];
    return bbrID;
  }
  return null;
}

function getNBA(id) {
  if (!id) return null;
  const match = players.find(d => d.key === id);
  if (match) return match.values;
}

// add season data if nba players
const rsciClean = rsci
  .map(d => ({
    ...d,
    bbrID: getID(d.link)
  }))
  .map(d => ({
    ...d,
    nba: getNBA(d.bbrID)
  }));

// now add nba players who WERENT in top 100
// - first season was >=1998
// - USA high school

players.forEach(p => {
  const first = +p.values[0].Season.substring(0, 4);
  const hs = p.values[0].HS;
  if (hs) {
    const last = hs.lastIndexOf(',');
    const state = hs.substring(last + 1, hs.length).trim();
    const yearTest = first >= MIN_NBA_YEAR;
    const usaTest = usaData.find(d => d.state === state);
    if (yearTest && usaTest) {
      // check if not in rsciClean
      const match = rsciClean.find(d => d.bbrID === p.key);
      if (!match) {
        rsciClean.push({
          bbrID: p.key,
          name: p.values[0].name,
          draft_year: p.values[0].Season.substring(0, 4)
        });
      }
    }
  }
});

const output = JSON.stringify(rsciClean, null, 2);
fs.writeFileSync('./output/merged.json', output);
