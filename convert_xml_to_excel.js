const fs = require("fs");
const path = require("path");
const xml2js = require("xml2js");

// 🔁 Flatten function (recursive)
function flattenObject(obj, parent = "", res = {}) {
  for (let key in obj) {
    const newKey = parent ? `${parent}_${key}` : key;

    if (Array.isArray(obj[key])) {
      // If array, process each item
      obj[key].forEach((item, index) => {
        if (typeof item === "object") {
          flattenObject(item, `${newKey}_${index}`, res);
        } else {
          res[`${newKey}_${index}`] = item;
        }
      });
    } else if (typeof obj[key] === "object" && obj[key] !== null) {
      flattenObject(obj[key], newKey, res);
    } else {
      res[newKey] = obj[key];
    }
  }
  return res;
}

// Convert object to CSV row
function objectToCSVRow(obj, headers) {
  return headers.map(header => {
    let value = obj[header] || '';
    // Convert to string and escape
    value = String(value);
    // If contains comma, quote, or newline, wrap in quotes
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      value = '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
  }).join(',');
}

// 📄 Convert XML → CSV files
function xmlToCSV(inputFile, outputFile) {
  console.log("📖 Reading XML file...");
  const xmlData = fs.readFileSync(inputFile, "utf-8");
  const fileSize = (xmlData.length / 1024 / 1024).toFixed(2);
  console.log(`✅ XML file loaded (${fileSize} MB)`);
  console.log("🔄 Parsing XML... this may take a moment for large files");

  xml2js.parseString(
    xmlData,
    { explicitArray: true, mergeAttrs: true },
    (err, result) => {
      if (err) {
        console.error("❌ Error parsing XML:", err);
        return;
      }

      console.log("✅ XML parsed successfully");
      console.log("🔍 Processing data rows...");

      const rootKey = Object.keys(result)[0];
      const root = result[rootKey];

      let rows = [];
      let totalProcessed = 0;

      // Navigate to CHMasterBody if it exists
      let dataContainer = root;
      if (root.CHMasterBody && root.CHMasterBody[0]) {
        console.log("   📁 Navigating to CHMasterBody...");
        dataContainer = root.CHMasterBody[0];
      }

      // 🔍 Try to auto-detect repeating nodes
      for (let key in dataContainer) {
        if (Array.isArray(dataContainer[key])) {
          console.log(`   📊 Found array: ${key} with ${dataContainer[key].length} items`);
          dataContainer[key].forEach((item, idx) => {
            const flat = flattenObject(item);
            // Add a column to identify which array this came from
            flat._sourceTable = key;
            rows.push(flat);
            totalProcessed++;
            
            // Show progress every 1000 items
            if (totalProcessed % 1000 === 0) {
              process.stdout.write(`   ⏳ Processing: ${totalProcessed.toLocaleString()} rows...\r`);
            }
          });
          console.log(); // new line after progress
        }
      }

      // ⚠️ fallback: if no rows detected
      if (rows.length === 0) {
        console.log("   ⚠️  No repeating rows detected, flattening entire structure");
        rows.push(flattenObject(root));
      }

      console.log(`✅ Total rows extracted: ${rows.length}`);
      console.log("📊 Creating separate CSV files for each table...");

      // Group rows by source table
      const tables = {};
      rows.forEach(row => {
        const tableName = row._sourceTable || 'Unknown';
        if (!tables[tableName]) tables[tableName] = [];
        tables[tableName].push(row);
      });

      // Create separate CSV file for each table
      const outputDir = path.dirname(outputFile);
      const baseName = path.basename(outputFile, '.xlsx'); // Keep base name but create .csv
      let totalFiles = 0;

      for (const [tableName, tableRows] of Object.entries(tables)) {
        console.log(`\n📄 Creating ${baseName}_${tableName}.csv (${tableRows.length.toLocaleString()} rows)...`);
        
        // Get all unique headers
        const headers = [];
        const headerSet = new Set();
        tableRows.forEach(row => {
          Object.keys(row).forEach(key => {
            if (key !== '_sourceTable' && !headerSet.has(key)) {
              headerSet.add(key);
              headers.push(key);
            }
          });
        });

        // Write CSV file
        const csvFile = path.join(outputDir, `${baseName}_${tableName}.csv`);
        const writeStream = fs.createWriteStream(csvFile, { encoding: 'utf8' });
        
        // Write header
        writeStream.write(objectToCSVRow({}, headers) + '\n');
        // Fix: write actual header names
        writeStream.write(headers.join(',') + '\n');
        
        // Write data rows
        tableRows.forEach((row, idx) => {
          writeStream.write(objectToCSVRow(row, headers) + '\n');
          
          // Show progress every 10000 rows
          if ((idx + 1) % 10000 === 0) {
            process.stdout.write(`   ✍️  Writing: ${(idx + 1).toLocaleString()}/${tableRows.length.toLocaleString()} rows...\r`);
          }
        });
        
        writeStream.end();
        console.log(`   ✅ Created: ${baseName}_${tableName}.csv`);
        totalFiles++;
      }

      console.log(`\n✅ CSV files created successfully!`);
      console.log(`📈 Summary:`);
      console.log(`   - Total rows processed: ${rows.length.toLocaleString()}`);
      console.log(`   - Files created: ${totalFiles}`);
      console.log(`   - Location: ${outputDir}`);
      console.log(`\n📋 Files created:`);
      for (const [tableName, tableRows] of Object.entries(tables)) {
        console.log(`   • ${baseName}_${tableName}.csv (${tableRows.length.toLocaleString()} rows)`);
      }
      console.log(`\n💡 Tip: You can open CSV files in Excel by double-clicking them.`);
    }
  );
}

// ▶️ Usage
xmlToCSV("C:\\Users\\laksh\\Downloads\\PART1\\Master\\CHM_31122025_223711_000001.xml", "output.xlsx");