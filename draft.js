const fs = require('fs');
const d3 = require('d3');
const request = require('request');
const cheerio = require('cheerio');

const MIN_YEAR = 1998;
const MAX_YEAR = 2018;
let year = MIN_YEAR;
const result = [];

function download() {
  return new Promise((resolve, reject) => {
    const url = `https://www.basketball-reference.com/play-index/draft_finder.cgi?request=1&year_min=${year}&year_max=${year}&college_id=0&pos_is_g=Y&pos_is_gf=Y&pos_is_f=Y&pos_is_fg=Y&pos_is_fc=Y&pos_is_c=Y&pos_is_cf=Y&order_by=pick_overall&order_by_asc=Y`;
    request(url, (err, response, body) => {
      if (err || response.statusCode !== 200) reject(err);
      else {
        const result = [];
        const $ = cheerio.load(body);
        $('#stats tbody tr')
          .not('.thead')
          .each((i, el) => {
            const c = $(el).children();
            const Rk = $(c[0]).text();
            const Year = $(c[1]).text();
            const Rd = $(c[3]).text();
            const Pk = $(c[4]).text();
            const college = $(c[10])
              .text()
              .trim();
            const name = $(c[6])
              .text()
              .trim();
            const link = $(c[6])
              .find('a')
              .attr('href');

            result.push({ link, name, college, Rk, Year, Rd, Pk });
          });
        resolve(result);
      }
    });
  });
}

function output() {
  const data = d3.csvFormat([].concat(...result));
  fs.writeFileSync('./output/draft.csv', data);
}

function next() {
  console.log({ year });
  download()
    .then(data => {
      result.push(data);
      year += 1;
      if (year <= MAX_YEAR) next();
      else {
        output();
      }
    })
    .catch(console.error);
}

next();
