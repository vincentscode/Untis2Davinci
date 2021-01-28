const restify = require('restify');
const corsMiddleware = require('restify-cors-middleware');
const fs = require('fs');

const cors = corsMiddleware({
  origins: ['*']
});

const restifyServer = restify.createServer();
restifyServer.pre(cors.preflight);
restifyServer.use(cors.actual);

restifyServer.pre((req, res, next) => {
    res.header('Access-Control-Allow-Origin', req.header('origin'));
    res.header('Access-Control-Allow-Headers', req.header('Access-Control-Request-Headers'));
    res.header('Access-Control-Allow-Credentials', 'true');

    if(req.method === 'OPTIONS')
        return res.send(204);

    next();

});

const htmlStart = fs.readFileSync("html/start.html", "utf8")
const htmlEnd = fs.readFileSync("html/end.html", "utf8")

async function getHandler(req, res, next) {
    fs.readFile("data.json", "utf8", function(err, data) {
        if(err) throw err;

        const loadedData = JSON.parse(data.toString());

        var generatedContent = ""
        for (value of loadedData) {
            generatedContent += "\n<tr>"
            for (v of Object.values(value)) {
                generatedContent += "<td>" + v + "</td>"
            }
            generatedContent += "</tr>\n"
        }

        const body = htmlStart + generatedContent + htmlEnd;
        res.writeHead(200, {
            'Content-Length': Buffer.byteLength(body),
            'Content-Type': 'text/html',
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "X-Requested-With",
        });
        res.write(body);
        res.end();
    });
}

restifyServer.get('/', getHandler);
restifyServer.get('/V_DC_001.html', getHandler);

// background task
setInterval(async function () {
    console.log(Date.now(), "background heartbeat");
}, 60 * 1000);

// main loop
restifyServer.listen(8089, function () {
    console.log("Server is ready on %s", restifyServer.url);
});

// Graceful Shutdown
if (process.platform === "win32") {
    const rl = require("readline").createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.on("SIGINT", function () {
        process.emit("SIGINT");
    });
}

process.on("SIGINT", function () {
    console.log("Exiting.");
    restifyServer.close();
    process.exit();
});