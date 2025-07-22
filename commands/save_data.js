const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const paths = {
    points: path.join(dataDir, 'points.json'),
    responsibilities: path.join(dataDir, 'responsibilities.json'),
    logs: path.join(dataDir, 'logs.json')
};

function saveData(points, responsibilities, logConfig) {
    fs.writeFileSync(paths.points, JSON.stringify(points, null, 2));
    fs.writeFileSync(paths.responsibilities, JSON.stringify(responsibilities, null, 2));
    if (logConfig) {
        fs.writeFileSync(paths.logs, JSON.stringify(logConfig, null, 2));
    }
}

function loadData() {
    const points = fs.existsSync(paths.points) ? JSON.parse(fs.readFileSync(paths.points, 'utf8')) : {};
    const responsibilities = fs.existsSync(paths.responsibilities) ? JSON.parse(fs.readFileSync(paths.responsibilities, 'utf8')) : {};
    const logConfig = fs.existsSync(paths.logs) ? JSON.parse(fs.readFileSync(paths.logs, 'utf8')) : null;
    return { points, responsibilities, logConfig };
}

module.exports = { saveData, loadData };
