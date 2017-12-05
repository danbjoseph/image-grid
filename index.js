var turf = require('@turf/turf');
var moment = require('moment');
var fs = require('fs');
var path = require('path');

var geo = JSON.parse(fs.readFileSync("aois.geojson"));
var aois = geo.features;
var imgDir = "./images"
var images = fs.readdirSync(imgDir);

var deleteOriginals = true;

function placeImage(image, cb){
    var readStream = fs.createReadStream(path.join(imgDir, image), { start: 0, end: 65635 });
    // The exif section of a jpeg file has a maximum size of 65535 
    // bytes and the section seems to always occur within the first 
    // 100 bytes of the file. So it is safe to only fetch the first 
    // 65635 bytes of a jpeg file and pass those to the parser.
    // https://www.npmjs.com/package/exif-parser
    var bufs = [];
    readStream.on('data', function(chunk) {  
          bufs.push(chunk);
      }).on('end', function() {
          var buf = Buffer.concat(bufs)
          var parser = require('exif-parser').create(buf);
          var tags = parser.parse().tags;
          var pt = turf.point([tags.GPSLongitude,tags.GPSLatitude]);
          var count = 0;
          for (var i = 0; i < aois.length; i++) {
            var inside = turf.booleanPointInPolygon(pt, aois[i]);
            if (inside) {
              if (!aois[i].properties.images) {
                // need to create the array to hold the image names if it doesn't exist yet
                aois[i].properties.images = [];
              }
              // add the image to the array in the properties of the aoi polygon feature
              aois[i].properties.images.push(image)
            }
            count++;
            if (count == aois.length) {
              cb(null);
            }
          }
      });
}

function createOutput() {
  var timestamp = moment().format("YYYY-MM-DD_HH-mm-ss");
  fs.mkdirSync(path.join('output',timestamp))
  // TODO: write full FeatureCollection
  var count = 0;
  for (var i = 0; i < aois.length; i++) {
    var indexValue = i;
    fs.mkdirSync(path.join('output',timestamp,indexValue.toString()))
    // TODO: write FeatureCollection for just the one aoi
    // TODO: copy in all images
    count++;
    if (count == aois.length) {
      if (deleteOriginals) {
        // TODO: delete all original images
        console.log("done.");
      } else {
        console.log("done.")
      }
    }
  }  
}

var count = 0;
for (var i = 0; i < images.length; i++) {
    placeImage(images[i], function() {
      count++;
      if (count == images.length) {
        createOutput();
      }
    })
}

