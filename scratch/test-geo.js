const apiKey = process.VITE_GOOGLE_MAPS_API_KEY;
const lat = 17.3850;
const lng = 78.4867;
fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`)
  .then(r => r.json())
  .then(d => console.log(JSON.stringify(d, null, 2)));
