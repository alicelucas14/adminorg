const fs = require('fs');
const path = require('path');

const srcDirectory = path.join(__dirname, 'routes'); // Assumes 'extract-code.js' is in the project root (e.g., 'backend/')
const outputFile = path.join(__dirname, 'extracted_r.txt');
const allowedExtensions = ['.ejs', '.tsx', '.mdx', '.js'];

let outputContent = `Code extracted on: ${new Date().toISOString()}\n\n`;

function getFileContent(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    console.error(`Error reading file ${filePath}:`, err);
    return null;
  }
}

function walkDirectory(directory) {
  const files = fs.readdirSync(directory);

  files.forEach(file => {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Exclude node_modules if it happens to be under src (though it shouldn't)
      if (file === 'node_modules' || file === '.git' || file === '.vscode') {
        console.log(`Skipping directory: ${fullPath}`);
        return;
      }
      walkDirectory(fullPath);
    } else if (allowedExtensions.includes(path.extname(file))) {
      const relativePath = path.relative(__dirname, fullPath);
      console.log(`Processing: ${relativePath}`);
      const content = getFileContent(fullPath);
      if (content !== null) {
        outputContent += `// START FILE: ${relativePath.replace(/\\/g, '/')}\n`; // Normalize path separators
        outputContent += content;
        outputContent += `\n// END FILE: ${relativePath.replace(/\\/g, '/')}\n\n`;
        outputContent += '//------------------------------------------------------------//\n\n';
      }
    }
  });
}

try {
  // Clear the output file if it exists
  if (fs.existsSync(outputFile)) {
    fs.unlinkSync(outputFile);
  }

  console.log(`Starting code extraction from: ${srcDirectory}`);
  walkDirectory(srcDirectory);

  fs.writeFileSync(outputFile, outputContent);
  console.log(`\nCode extraction complete. Output saved to: ${outputFile}`);
  console.log('Please review the output file for accuracy and then share its content.');

} catch (err) {
  console.error('An error occurred during the extraction process:', err);
}