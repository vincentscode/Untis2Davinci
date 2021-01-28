const WebUntisLib = require('webuntis');
const Config = require('./config')
const fetch = require('node-fetch');
const fs = require('fs');

const untis = new WebUntisLib.WebUntisSecretAuth(
	Config.school,
	Config.username,
	Config.secret,
	Config.url
);

const date = "2021-01-18";

const elementType = "1";
const elementId = "160";
const formatId = "1";

(async () => {
	await untis.login();

	const headers = {
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

			// Klasse	Tag	Pos	Fach	Raum	VFach	VRaum	Art	Info	Bemerkung	Mitteilung
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
			
			await fs.writeFile('data.json', JSON.stringify(resultData), err => console.log(err))
		}
	});

})();