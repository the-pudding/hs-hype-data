const fs = require('fs');
const d3 = require('d3');
const uniq = require('lodash.uniqby');
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

const rsciRaw = d3.csvParse(fs.readFileSync('./input/rsci--bbr.csv', 'utf-8'));

// filter out duplicates (use second occurence)
const unique = uniq(rsciRaw, d => `${d.name}${d.link}`);

const rsci = unique.map(d => {
  const id = `${d.name}${d.link}`;
  return { ...rsciRaw.find(v => `${v.name}${v.link}` === id) };
});

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

function findDraftMatch(player) {
  const hard = draft.find(d => d.link && d.link === player.link);
  if (hard) return hard;

  const soft = draft.find(
    d =>
      d.name === player.name && player.college && d.college === player.college
  );
  if (soft) {
    return soft;
  }

  const softer = draft.find(
    d => d.name === player.name && d.Year === player.recruit_year
  );
  if (softer) {
    return softer;
  }
  return false;
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
          college: p.values[0].college,
          draft_year: p.values[0].Season.substring(0, 4),
          link: p.values[0].link
        });
      }
    }
  }
});

const withDraft = rsciClean.map(d => {
  const match = findDraftMatch(d);

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

function totalSeasons(id) {
  if (!id) return null;
  const match = seasons.filter(d => d.bbrID === id);
  return match.length;
}

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

function getMean(id, stat, slice) {
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

  match.sort((a, b) => d3.descending(+a[stat], +b[stat]));
  const sliced = match.slice(0, slice ? 5 : 100);

  return d3.mean(sliced, v => +v[stat]);
}

function getMedian(id, stat) {
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

  return d3.median(match, v => v[stat]);
}

function getRankMean(id, stat, slice) {
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

  match.sort((a, b) =>
    d3.ascending(+a[`${stat}_rank`] + 1, +b[`${stat}_rank`] + 1)
  );
  const sliced = match.slice(0, slice ? 5 : 100);
  return d3.mean(sliced, v => +v[`${stat}_rank`] + 1);
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
  return d3.median(match, v => +v[`${stat}_rank`] + 1);
}

const withRank = withDraft.map(d => ({
  ...d,
  // nba_median_ws48: getMedian(d.bbrID, 'WS/48'),
  nba_mean_ws48: getMean(d.bbrID, 'WS/48'),
  // nba_median_vorp: getMedian(d.bbrID, 'VORP'),
  nba_mean_vorp: getMean(d.bbrID, 'VORP'),
  // nba_median_pipm: getMedian(d.bbrID, 'PIPM'),
  nba_mean_pipm: getMean(d.bbrID, 'PIPM'),
  // nba_median_wa: getMedian(d.bbrID, 'Wins Added'),
  nba_mean_wa: getMean(d.bbrID, 'Wins Added'),

  // nba_median_ws48: getMedian(d.bbrID, 'WS/48'),
  top_mean_ws48: getMean(d.bbrID, 'WS/48', true),
  // top_median_vorp: getMedian(d.bbrID, 'VORP'),
  top_mean_vorp: getMean(d.bbrID, 'VORP', true),
  // top_median_pipm: getMedian(d.bbrID, 'PIPM'),
  top_mean_pipm: getMean(d.bbrID, 'PIPM', true),
  // top_median_wa: getMedian(d.bbrID, 'Wins Added'),
  top_mean_wa: getMean(d.bbrID, 'Wins Added', true),

  // nba_median_ws48_rank: getRankMedian(d.bbrID, 'WS/48'),
  nba_mean_ws48_rank: getRankMean(d.bbrID, 'WS/48'),
  // nba_median_vorp_rank: getRankMedian(d.bbrID, 'VORP'),
  nba_mean_vorp_rank: getRankMean(d.bbrID, 'VORP'),
  // nba_median_pipm_rank: getRankMedian(d.bbrID, 'PIPM'),
  nba_mean_pipm_rank: getRankMean(d.bbrID, 'PIPM'),
  // nba_median_wa_rank: getRankMedian(d.bbrID, 'Wins Added'),
  nba_mean_wa_rank: getRankMean(d.bbrID, 'Wins Added'),

  // top_median_ws48_rank: getRankMedian(d.bbrID, 'WS/48', true),
  top_mean_ws48_rank: getRankMean(d.bbrID, 'WS/48', true),
  // top_median_vorp_rank: getRankMedian(d.bbrID, 'VORP', true),
  top_mean_vorp_rank: getRankMean(d.bbrID, 'VORP', true),
  // top_median_pipm_rank: getRankMedian(d.bbrID, 'PIPM', true),
  top_mean_pipm_rank: getRankMean(d.bbrID, 'PIPM', true),
  // top_median_wa_rank: getRankMedian(d.bbrID, 'Wins Added', true),
  top_mean_wa_rank: getRankMean(d.bbrID, 'Wins Added', true),

  total_seasons: totalSeasons(d.bbrID),
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
  avg_rank_ws48: Math.round(
    d3.mean(
      test.filter(d => +d.rank === v + 1 && d.bbrID),
      v => v.nba_median_ws48_rank
    )
  ),
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

function lastCollege(college) {
  if (!college) return college;
  const lower = college.toLowerCase();
  const split = lower.replace(/,/g, ' ').split(' ');
  const matches = split.filter(d => ['college', 'university'].includes(d));
  if (matches.length > 1) {
    const last = lower.lastIndexOf(matches.pop());
    const sub = lower.substring(0, last);
    const index = sub.lastIndexOf(',');
    if (index < 0) console.log({ college, last, sub });
    return college.substring(index + 1, lower.length);
  }
  return college;
}

const withCollege = withRank.map(d => ({
  ...d,
  college: lastCollege(d.college)
}));

const output = d3.csvFormat(withCollege);
fs.writeFileSync('./output/players.csv', output);

const justIDs = withCollege.map(d => d.bbrID).filter(d => d);
const seasonsFiltered = seasons.filter(d => justIDs.includes(d.bbrID));
const seasonsOutput = d3.csvFormat(seasonsFiltered);
fs.writeFileSync('./output/seasons.csv', seasonsOutput);
