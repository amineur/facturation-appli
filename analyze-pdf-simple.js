const fs = require('fs');
const pdf = require('pdf-extraction');

const dataBuffer = fs.readFileSync('public/reference.pdf');

pdf(dataBuffer).then(function (data) {
    console.log('Number of pages:', data.numpages);
    console.log('Text Content:\n', data.text);
}).catch(err => {
    console.error(err);
});
