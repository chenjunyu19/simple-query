'use strict';

const events = require('events');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const Koa = require('koa');
const nunjucks = require('koa-nunjucks-async');
const config = require('./config.json');

function log(message) {
    console.log(`[${new Date().toLocaleString()}] ${message}`);
}

function shouldload(filepath) {
    return path.extname(filepath).toLowerCase() === '.csv' && fs.statSync(filepath).isFile();
}

async function parseCSV(csvFilepath) {
    const rl = readline.createInterface({ input: fs.createReadStream(csvFilepath), crlfDelay: Infinity });
    const result = {};
    const keys = [];
    rl.on('line', (line) => {
        const values = line.split(',');
        if (keys.length) {
            result[values[0]] = {};
            for (let i = 0; i < keys.length; i++) {
                result[values[0]][keys[i]] = values[i];
            }
        } else {
            keys.push(...values);
        }
    });
    await events.once(rl, 'close');
    return result;
}

function findData(searchValue) {
    const result = {};
    for (const filename in data) {
        if (data.hasOwnProperty(filename)) {
            result[filename] = data[filename][searchValue];
        }
    }
    return result;
}

const app = new Koa();
const data = {};

app.use(nunjucks('view', { opts: { watch: process.env.environment === 'development' } }));

app.use(async (ctx, next) => {
    await next();
    log(`[${ctx.status}] ${ctx.url}`);
});

app.use(async (ctx, next) => {
    switch (ctx.URL.pathname) {
        case config.location:
        case config.location + 'index':
            await ctx.render('index', { page: config.page.index });
            break;

        case config.location + 'query':
            await ctx.render('query', { page: config.page.query, data: findData(ctx.request.query.id) });
            break;
    }
    await next();
});

fs.readdir(config.dataDir, async (err, files) => {
    if (err) {
        throw err;
    }
    for (const filename of files) {
        const filepath = path.join(config.dataDir, filename);
        if (shouldload(filepath)) {
            data[filename] = await parseCSV(filepath);
            log(`已加载 ${filename}`);
        }
    }
    app.listen(config.port);
    log(`已在端口 ${config.port} 上监听`);
});

fs.watch(config.dataDir, (eventType, filename) => {
    const filepath = path.join(config.dataDir, filename);
    fs.exists(filepath, async (exists) => {
        if (exists) {
            if (shouldload(filepath)) {
                data[filename] = await parseCSV(filepath);
                log(`已加载 ${filename}`);
            }
        } else {
            delete data[filename];
            log(`已删除 ${filename}`);
        }
    });
});
