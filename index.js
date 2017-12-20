var turf = require('@turf/turf');
var moment = require('moment');
var fs = require('fs');
var path = require('path');

var geo = JSON.parse(fs.readFileSync("aois.geojson"));
var aois = geo.features;
var imgDir = "./images";
var images = fs.readdirSync(imgDir);
var outputFolder = "output"; // must exist
var outputIdentifier = "output"; // prepended to each sub output folder

var deleteOriginals = false;

function placeImage(image, cb) {
    // TODO: filter out non jpg files, system files???
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
          
          var pass = true;
          // http://www.exiv2.org/tags.html
          var latitudeRefs = ['N', 'S']; // Indicates whether the latitude is north or south latitude. The ASCII value 'N' indicates north latitude, and 'S' is south latitude.
          if (latitudeRefs.indexOf(tags.GPSLatitudeRef) === -1) { 
            console.log("ERROR: " + image);
            console.log("GPSLatitudeRef: " + tags.GPSLatitudeRef);
            pass = false; 
          }
          var longitudeRefs = ['E', 'W']; // Indicates whether the longitude is east or west longitude. ASCII 'E' indicates east longitude, and 'W' is west longitude.
          if (longitudeRefs.indexOf(tags.GPSLongitudeRef) === -1) { 
            console.log("ERROR: " + image);
            console.log("GPSLongitudeRef: " + tags.GPSLongitudeRef);
            pass = false;
          }
          if (tags.GPSAltitudeRef === undefined) { 
            console.log("ERROR: " + image);
            console.log("GPSAltitudeRef: " + tags.GPSAltitudeRef);
            pass = false; 
          } // Indicates the altitude used as the reference altitude. If the reference is sea level and the altitude is above sea level, 0 is given. If the altitude is below sea level, a value of 1 is given and the altitude is indicated as an absolute value in the GSPAltitude tag. The reference unit is meters. Note that this tag is BYTE type, unlike other reference tags.
          if (isNaN(parseFloat(tags.GPSAltitude))) {
            console.log("ERROR: " + image);
            console.log("GPSAltitudeRef: " + tags.GPSAltitude);
            pass = false;
          } else {
            // console.log("GPSAltitude: " + tags.GPSAltitude);
            if (parseFloat(tags.GPSAltitude) < 10) { 
              console.log("ERROR: " + image);
              console.log("GPSAltitude: " + tags.GPSAltitude);
              pass = false; 
            } // Indicates the altitude based on the reference in GPSAltitudeRef. Altitude is expressed as one RATIONAL value. The reference unit is meters.
          }
          if (isNaN(parseFloat(tags.GPSLongitude)) === true || isNaN(parseFloat(tags.GPSLatitude)) === true ) { 
            console.log("ERROR: " + image);
            console.log("GPSLongitude: " + tags.GPSLongitude + " / " + "GPSLatitude: " + tags.GPSLatitude); 
            pass = false; 
          }
          if (pass === true) {
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
          } else {
            cb(null)
          }
      });
}

function copyInImages(imgArray, destPath, cb) {
  // TODO: feature might have an empty array
  var copyCount = 0;
  for (var i = 0; i < imgArray.length; i++) {
    var src = path.join(imgDir, imgArray[i]);
    var dest = path.join(destPath, imgArray[i]);
    fs.copyFile(src, dest, function(err) {
      if (err) throw err;
      copyCount++;
      if (copyCount == imgArray.length) {
        cb();
      }
    });
  }
}

function createOutput() {
  var timestamp = moment().format("YYYY-MM-DD_HH-mm-ss");
  // fs.mkdirSync(path.join(outputPath,timestamp));
  var count = 0;
  for (var i = 0; i < aois.length; i++) {
    var indexValue = i;
    var destFolder = outputIdentifier + indexValue.toString();
    var destPath = path.join(outputFolder, destFolder);
    fs.mkdirSync(destPath);
    // TODO: write FeatureCollection for just the one aoi
    copyInImages(aois[i].properties.images, destPath, function() {
      count++;
      if (count == aois.length) {
        if (deleteOriginals) {
          // TODO: delete all original images
          console.log("done.");
        } else {
          console.log("done.");
        }
      }
    })    
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

