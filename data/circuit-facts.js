// Curated static circuit facts, keyed by Jolpica circuitId. Length in km.
// Values are well-known public data; lapRecord may lag a season — update as needed.
// New/returning venues without an established record use null.
export const CIRCUIT_FACTS = {
  albert_park:   { lengthKm: 5.278, laps: 58, firstGp: 1996, lapRecord: { time: '1:19.813', driver: 'C. Leclerc', year: 2024 } },
  shanghai:      { lengthKm: 5.451, laps: 56, firstGp: 2004, lapRecord: { time: '1:32.238', driver: 'M. Schumacher', year: 2004 } },
  suzuka:        { lengthKm: 5.807, laps: 53, firstGp: 1987, lapRecord: { time: '1:30.983', driver: 'L. Hamilton', year: 2019 } },
  miami:         { lengthKm: 5.412, laps: 57, firstGp: 2022, lapRecord: { time: '1:29.708', driver: 'M. Verstappen', year: 2023 } },
  villeneuve:    { lengthKm: 4.361, laps: 70, firstGp: 1978, lapRecord: { time: '1:13.078', driver: 'V. Bottas', year: 2019 } },
  monaco:        { lengthKm: 3.337, laps: 78, firstGp: 1950, lapRecord: { time: '1:12.909', driver: 'L. Hamilton', year: 2021 } },
  catalunya:     { lengthKm: 4.657, laps: 66, firstGp: 1991, lapRecord: { time: '1:16.330', driver: 'M. Verstappen', year: 2023 } },
  red_bull_ring: { lengthKm: 4.318, laps: 71, firstGp: 1970, lapRecord: { time: '1:05.619', driver: 'C. Sainz', year: 2020 } },
  silverstone:   { lengthKm: 5.891, laps: 52, firstGp: 1950, lapRecord: { time: '1:27.097', driver: 'L. Hamilton', year: 2020 } },
  spa:           { lengthKm: 7.004, laps: 44, firstGp: 1950, lapRecord: { time: '1:46.286', driver: 'V. Bottas', year: 2018 } },
  hungaroring:   { lengthKm: 4.381, laps: 70, firstGp: 1986, lapRecord: { time: '1:16.627', driver: 'L. Hamilton', year: 2020 } },
  zandvoort:     { lengthKm: 4.259, laps: 72, firstGp: 1952, lapRecord: { time: '1:11.097', driver: 'L. Hamilton', year: 2021 } },
  monza:         { lengthKm: 5.793, laps: 53, firstGp: 1950, lapRecord: { time: '1:21.046', driver: 'R. Barrichello', year: 2004 } },
  madring:       { lengthKm: 5.474, laps: null, firstGp: 2026, lapRecord: null },
  baku:          { lengthKm: 6.003, laps: 51, firstGp: 2016, lapRecord: { time: '1:43.009', driver: 'C. Leclerc', year: 2019 } },
  marina_bay:    { lengthKm: 4.940, laps: 62, firstGp: 2008, lapRecord: { time: '1:34.486', driver: 'L. Hamilton', year: 2023 } },
  americas:      { lengthKm: 5.513, laps: 56, firstGp: 2012, lapRecord: { time: '1:36.169', driver: 'C. Leclerc', year: 2019 } },
  rodriguez:     { lengthKm: 4.304, laps: 71, firstGp: 1963, lapRecord: { time: '1:17.774', driver: 'V. Bottas', year: 2021 } },
  interlagos:    { lengthKm: 4.309, laps: 71, firstGp: 1973, lapRecord: { time: '1:10.540', driver: 'V. Bottas', year: 2018 } },
  vegas:         { lengthKm: 6.201, laps: 50, firstGp: 2023, lapRecord: { time: '1:34.876', driver: 'O. Piastri', year: 2024 } },
  losail:        { lengthKm: 5.419, laps: 57, firstGp: 2021, lapRecord: { time: '1:22.384', driver: 'M. Verstappen', year: 2024 } },
  yas_marina:    { lengthKm: 5.281, laps: 58, firstGp: 2009, lapRecord: { time: '1:25.637', driver: 'M. Verstappen', year: 2021 } },
};
