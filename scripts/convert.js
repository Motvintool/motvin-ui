const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Target directory containing the images to convert
const assetDir = path.join(__dirname, '../ASSET/Images');

async function convertImages() {
  const files = fs.readdirSync(assetDir);
  for (const file of files) {
    if (file.toLowerCase().endsWith('.png')) {
      const inputPath = path.join(assetDir, file);
      const outputName = file.substring(0, file.lastIndexOf('.')) + '.webp';
      const outputPath = path.join(assetDir, outputName);
      
      console.log(`Converting ${file} to ${outputName}...`);
      try {
        await sharp(inputPath)
          .webp({ quality: 80 })
          .toFile(outputPath);
        console.log(`Successfully converted ${file}.`);
      } catch (err) {
        console.log(`Failed to convert ${file}: ${err.message}`);
      }
    }
  }
}

convertImages().catch(err => {
  console.error(err);
  process.exit(1);
});
