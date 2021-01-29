const restify = require('restify');

const WebUntisLib = require('webuntis');
const Config = require('./config')
const fetch = require('node-fetch');

const fs = require('fs');

const restifyServer = restify.createServer();

// cors
restifyServer.pre((req, res, next) => {
    res.header('Access-Control-Allow-Origin', req.header('origin'));
    res.header('Access-Control-Allow-Headers', req.header('Access-Control-Request-Headers'));
    res.header('Access-Control-Allow-Credentials', 'true');

    if(req.method === 'OPTIONS')
        return res.send(204);

    next();

});

// html template
const htmlStart = fs.readFileSync("html/start.html", "utf8");
const htmlEnd = fs.readFileSync("html/end.html", "utf8");

let loadedData = [];

async function getHandler(req, res, next) {
	console.log("Server - Serving getHandler")
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
}

// endpoints
restifyServer.get('/', getHandler);
restifyServer.get('/V_DC_001.html', getHandler);

// untis
const untis = new WebUntisLib.WebUntisSecretAuth(
    Config.school,
    Config.username,
    Config.secret,
    Config.url
);

function getMonday(d) {
  d = new Date(d);
  var day = d.getDay(),
      diff = d.getDate() - day + (day == 0 ? -6:1);
  return new Date(d.setDate(diff));
}

const elementType = "1";
const elementId = "160";
const formatId = "1";

// background task
async function backgroundTask() {
    console.log(new Date(), "Background Sync - Start");
    await untis.login();

    var currentMonday = getMonday(new Date());
    let date = currentMonday.getFullYear() + "-" + currentMonday.getMonth()+1 + "-" + currentMonday.getDate();
    console.log(new Date(), "Background Sync -", date);

    let headers = {
        "accept": "application/json",
        "accept-language": "en-DE,en;q=0.9,de-DE;q=0.8,de;q=0.7,en-US;q=0.6",
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "cookie": "schoolname=\"" + untis.schoolbase64 + "\"; JSESSIONID=" + untis.sessionInformation.sessionId + ";"
    };


    async function getDetails(date, starttime, endtime, selectedPeriodId) {
        var params = "?date="+date+"&starttime="+starttime+"&endtime="+endtime+"&elemid="+elementId+"&elemtype="+elementType+"&ttFmtId=1&selectedPeriodId="+selectedPeriodId;
        var result = await fetch("https://hektor.webuntis.com/WebUntis/api/public/period/info" + params, {
            "headers": headers,
            "referrer": "https://hektor.webuntis.com/WebUntis/",
            "referrerPolicy": "strict-origin-when-cross-origin",
            "body": null,
            "method": "GET",
            "mode": "cors"
        });

        return result.json();
    }

    fetch("https://hektor.webuntis.com/WebUntis/api/public/timetable/weekly/data?elementType=" + elementType + "&elementId=" + elementId + "&date=" + date + "&formatId=" + formatId, {
        "headers": headers,
        "referrer": "https://hektor.webuntis.com/WebUntis/",
        "referrerPolicy": "strict-origin-when-cross-origin",
        "body": null,
        "method": "GET",
        "mode": "cors"
    }).then(res => res.json()).then(async json => {
        if (json.data.error) {
            console.log("Error:", json.data.error.data);
        } else {
            var resultData = [];

            // Klasse   Tag Pos Fach    Raum    VFach   VRaum   Art Info    Bemerkung   Mitteilung
            for (let element of json.data.result.data.elementPeriods[elementId]) {
                let state = element["cellState"];
                if (state != "STANDARD") {
                    let course = element["studentGroup"];

                    let date = element["date"];
                    let startTime = element["startTime"];
                    let endTime = element["endTime"];

                    let lessonId = element["lessonId"];

                    let details = await getDetails(date, startTime, endTime, lessonId);
                    let relevantBlock = undefined;
                    for (let block of details.data.blocks) {
                        if (block[0].lesson.id != lessonId) {
                            continue;
                        }
                        relevantBlock = block;
                        break;
                    }

                    // console.log(element);
                    var studentGroupSplit = element.studentGroup.split("_");
                    var studentGroupSplitSubject = studentGroupSplit[0];
                    var studentGroupSplitSubjectType = studentGroupSplit[1];
                    var studentGroupSplitSubjectNumber = studentGroupSplit[2];
                    var studentGroupSplitSubjectClass = studentGroupSplit[3];
                    var subject = "";
                    if (studentGroupSplitSubjectType == "LK") {
                        subject = studentGroupSplitSubject.toUpperCase() + studentGroupSplitSubjectNumber
                    } else {
                        subject = studentGroupSplitSubject.toLowerCase() + studentGroupSplitSubjectNumber
                    }

                    var year = element.date.toString().substring(0, 4);
                    var month = element.date.toString().substring(4, 6);
                    var day = element.date.toString().substring(6);
                    var days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
                    var dt = new Date(year + "-" + month + "-" + day + "T12:00:00");
                    var day = days[dt.getDay()];
                    // console.log("===")
                    // console.log(details.data)
                    // console.log("===")
                    // console.log(relevantBlock)
                    // console.log(relevantBlock[0].periods)
                    // console.log("cancelled", relevantBlock[0].periods[0].isCancelled)
                    var positions = [
                        745,
                        830,
                        930,
                        1015,
                        1115,
                        1200,
                        1245,
                        1330,
                        1415,
                        1505,
                        1550,
                    ]

                    var types = {
                        "CANCEL": "Klasse frei",
                        "SUBSTITUTION": "Vertretung"
                    }

                    // console.log(relevantBlock[0].roomSubstitutions)
                    let obj = {
                        "Klasse": studentGroupSplitSubjectClass,
                        "Tag": day,
                        "Pos": positions.indexOf(startTime)+1,
                        "Fach": subject,
                        "Raum": relevantBlock[0].periods[0].rooms[0].name,
                        "VFach": "",
                        "VRaum": "",
                        "Art": types[state],
                        "Info": element.periodText,
                        "Bemerkung": "",
                        "Mitteilung": "",
                    };
                    resultData.push(obj)
                }
            }
            
            loadedData = resultData;
            console.log(new Date(), "Background Sync - Updated", loadedData.length);
        }
    });

}
backgroundTask();
setInterval(backgroundTask, 60 * 1000);

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