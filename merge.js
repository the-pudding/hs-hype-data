const fs = require('fs');
const d3 = require('d3');
const usaData = require('./us-state-data.js');

const MIN_NBA_YEAR = 2002;
const MIN_MP_DEFAULT = 1500;
const MIN_MP_SPECIAL = {
  '1998-99': 915,
  '2011-12': 1207
};

const seasons = d3
  .csvParse(fs.readFileSync('./input/player-seasons--rank.csv', 'utf-8'))
  .filter(d => d.Season !== '2018-19');

const rsci = d3.csvParse(fs.readFileSync('./input/rsci--bbr.csv', 'utf-8'));

const draft = d3.csvParse(fs.readFileSync('./output/draft.csv', 'utf-8'));

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
const rsciClean = rsci.map(d => ({
  ...d,
  bbrID: getID(d.link)
}));

// .map(d => ({
//   ...d,
//   nba: getNBA(d.bbrID)
// }));

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
          draft_year: p.values[0].Season.substring(0, 4),
          link: p.values[0].link
        });
      }
    }
  }
});

const withDraft = rsciClean.map(d => {
  const match = draft.find(p => p.link && p.link === d.link);

  const draftInfo = match
    ? {
        pick_overall: match.Rk,
        pick_number: match.Pk,
        pick_round: match.Rd,
        draft_year: match.Year
      }
    : {};

  return {
    ...d,
    ...draftInfo
  };
});

function validSeasons(id) {
  if (!id) return null;
  const match = seasons
    .filter(d => d.bbrID === id)
    .map(d => ({
      ...d,
      total_mp: +d.G * +d.MP
    }))
    .filter(d => {
      const mp = MIN_MP_SPECIAL[d.Season] || MIN_MP_DEFAULT;
      return d.total_mp >= mp;
    });
  return match.length;
}

function getRankMean(id, stat) {
  if (!id) return null;
  const match = seasons
    .filter(d => d.bbrID === id)
    .map(d => ({
      ...d,
      total_mp: +d.G * +d.MP
    }))
    .filter(d => {
      const mp = MIN_MP_SPECIAL[d.Season] || MIN_MP_DEFAULT;
      return d.total_mp >= mp;
    });
  if (!match.length) return null;
  return d3.mean(match, v => v[`${stat}_rank`]);
}

function getRankMedian(id, stat) {
  if (!id) return null;
  const match = seasons
    .filter(d => d.bbrID === id)
    .map(d => ({
      ...d,
      total_mp: +d.G * +d.MP
    }))
    .filter(d => {
      const mp = MIN_MP_SPECIAL[d.Season] || MIN_MP_DEFAULT;
      return d.total_mp >= mp;
    });
  if (!match.length) return null;
  return d3.median(match, v => v[`${stat}_rank`]);
}

withRank = withDraft.map(d => ({
  ...d,
  nba_median_vorp_rank: getRankMedian(d.bbrID, 'VORP'),
  nba_mean_vorp_rank: getRankMean(d.bbrID, 'VORP'),
  nba_median_pipm_rank: getRankMedian(d.bbrID, 'PIPM'),
  nba_mean_pipm_rank: getRankMean(d.bbrID, 'PIPM'),
  valid_seasons: validSeasons(d.bbrID)
}));

const test = withRank.filter(d => +d.recruit_year < 2015);

const overview = d3.range(100).map(v => ({
  rank: v + 1,
  percent_nba: d3.format('.0%')(
    test.filter(d => d.bbrID && +d.rank < v + 2).length /
      test.filter(d => +d.rank < v + 2).length
  ),
  count_rank_nba: test.filter(d => +d.rank === v + 1 && d.bbrID).length,
  avg_rank_vorp: Math.round(
    d3.mean(
      test.filter(d => +d.rank === v + 1 && d.bbrID),
      v => v.nba_median_vorp_rank
    )
  ),
  avg_rank_pipm: Math.round(
    d3.mean(
      test.filter(d => +d.rank === v + 1 && d.bbrID),
      v => v.nba_median_pipm_rank
    )
  )
}));

fs.writeFileSync('./output/overview.csv', d3.csvFormat(overview));

withRank.sort((a, b) => {
  if (!a.recruit_year) return 1;
  return (
    d3.ascending(+a.recruit_year, +b.recruit_year) ||
    d3.ascending(+a.rank, +b.rank)
  );
});
const output = d3.csvFormat(withRank);
fs.writeFileSync('./output/players.csv', output);

const justIDs = withRank.map(d => d.bbrID).filter(d => d);
const seasonsFiltered = seasons.filter(d => justIDs.includes(d.bbrID));
const seasonsOutput = d3.csvFormat(seasonsFiltered);
fs.writeFileSync('./output/seasons.csv', seasonsOutput);
