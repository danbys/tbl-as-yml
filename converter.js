import fs from 'fs-extra';
import yaml from 'js-yaml';
import { watch, statSync } from 'fs';
import { extname, basename, join } from 'path';
import path from 'path';
import { info, error } from '@danbys/log-config';

const __dirname = path.join(process.cwd(), 'meta-tables')
// Create the directory if it doesn't exist
if (!fs.existsSync(__dirname)) {
    fs.mkdirSync(__dirname);
}
// Function to read a .tbl file and convert it to .yml
function toYaml(filePath) {
    const inputText = fs.readFileSync(filePath, 'utf8');
    const yamlFile = targetFile(filePath);
    // Extract lines and filter out the unnecessary ones
    const lines = inputText.split('\n').filter(line => line.trim() && !line.startsWith('//'));

    // Extract keys and values
    const keysLines = lines.filter(line => line.includes('.Key'));
    const valuesLines = lines.filter(line => line.includes('.Value'));

    const yamlData = {};

    for (let i = 0; i < keysLines.length; i++) {
        const keysLine = keysLines[i];
        const valuesLine = valuesLines[i];

        // Read each line like Strs, it's similar to csv but instead of comma separator
        // tab or space chars acts as separator. Values may contain space and wrapping
        // the value with quotes, this way a value can contain a space without breaking the line
        const keys = keysLine.match(/(?:[^\s\t"]+|"[^"]*")+/g).slice(1);
        const values = valuesLine.match(/(?:[^\s\t"]+|"[^"]*")+/g).slice(1);

        // Combine keys and values into an object
        const mainKey = keysLine.split('.')[0];
        const dataObject = {};
        keys.forEach((key, index) => {
            dataObject[key] = values[index].replace(/^"|"$/g, '');
        });

        yamlData[mainKey] = dataObject;
    }


    fs.writeFileSync(yamlFile, yaml.dump(yamlData, { lineWidth: -1 }), 'utf8');
}

// Function to read a .yml file and convert it to .tbl
function toTbl(filePath) {
    const yamlContent = fs.readFileSync(filePath, 'utf8');
    const data = yaml.load(yamlContent);
    const tblFile = targetFile(filePath);
    let body = '';
    Object.keys(data).forEach(mainKey => {
        const keyValues = data[mainKey];

        body += `${body==='' ? '' : "\n"}${mainKey}.Key\t` + Object.keys(keyValues).join('\t');
        body += `\n${mainKey}.Value\t` + Object.values(keyValues).map(value => {
            if (/\s/.test(value)) {
                return `"${value}"`;
            }
            return value.toString() === '' ? '""' : value;
        }).join('\t');
    });

    const originalFormat = `//!CodePage UTF8!
//!multicolumn!

//<Runtime>.<Platform connector>.<Key|Value> 
${body}`;

    fs.writeFileSync(tblFile, originalFormat, 'utf8');
}

function targetFile(filePath) {
    const ext = extname(filePath);
    const baseName = basename(filePath, ext);
    return path.join(__dirname, `${baseName}${ext==='.yml' ?  '.tbl' : '.yml'}`);
}

// Function to set up the file watcher
export function fileWatcher() {
    info('File watcher started');
    let lastModified;
    const watchers = [];
    const watcher = watch(__dirname, (eventType, filename) => {

        const filePath = join(__dirname, filename);
        if (fs.existsSync(filePath)) {
            try {
                const fileStats = statSync(filePath);
                if (!lastModified || lastModified < fileStats.mtimeMs-100) {
                    if(statSync(filePath).size> 0){
                        info(`Converting to ${basename(filePath)}`);
                        extname(filename) === '.tbl' ? toYaml(filePath) : toTbl(filePath);
                    }
                    lastModified= fileStats.mtimeMs;
                }
            } catch (err) {
                error(`Error processing ${filename}:`, err);
            }
        }
    });

    watchers.push(watcher);

    // Gracefully close the watchers on termination signals
    const cleanup = () => {
        info('Stopping watchers...');
        for (const watcher of watchers) {
            watcher.close();
        }
        process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    info('Watching for file changes...');
}
