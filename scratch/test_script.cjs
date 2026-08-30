const https = require('https');
const banks = {
  'Axis_Bank': 'Axis_Bank',
  'LIC': 'Life_Insurance_Corporation',
  'Bajaj_Finserv': 'Bajaj_Finserv',
  'Kotak': 'Kotak_Mahindra_Bank',
  'Yes_Bank': 'Yes_Bank'
};
Object.keys(banks).forEach(name => {
  https.get('https://en.wikipedia.org/wiki/' + banks[name], (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
      const match = data.match(/<td class=\"infobox-image\">.*?<img.*?src=\"(\/\/[^\"]+)\"/);
      if (match) {
        console.log(name + ' : https:' + match[1]);
      } else {
        console.log(name + ' : Not found');
      }
    });
  });
});

