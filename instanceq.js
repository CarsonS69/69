import fetch from "node-fetch"
import loadyaml from "./loadyaml.js"

const mylist = loadyaml("./data/instances.yml")
const ignorehosts = loadyaml("./data/ignorehosts.yml")

const duplicated = mylist.filter((e, i, arr) => arr.findIndex(x => x.url === e.url) !== i)
	.map(e => e.url)

if (duplicated.length > 0) console.log(`Duplicated:\n  ${duplicated.join(",\n  ")}\n`);
else console.log("Duplicated:\n  There is no duplicated server!\n");

const invalid = mylist.reduce((acc, cur, i) => {
	if (!cur.url) acc.push(`No url: #${i + 1} (langs: ${cur.langs})`);
	return acc;
}, [])

if (invalid.length > 0) console.log(`Invalid:\n  ${invalid.join("\n  ")}\n`);

export default async () => {
	console.log(`Get servers from misskey.io`);

	const notIncluded = new Set();
	const apinum = 29
	let next = true
	let offset = 0

	while (next) {
		const url = new URL("https://misskey.io/api/federation/instances")
		url.searchParams.set("sort", "+firstRetrievedAt")
		url.searchParams.set("limit", apinum + 1)
		url.searchParams.set("offset", offset)

		const hrstart = process.hrtime()

		const l = await fetch(url, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				'User-agent': "JoinMisskey/0.1.0; +https://join.misskey.page/instances",
			}
		}).then(async res => {
			if (!res.ok) {
				throw Error(`${res.status} ${res.statusText}\n${await res.text()}`)
			}

			const hrend = process.hrtime(hrstart)
			const text = await res.text()
			if (!text.startsWith("{") && !text.startsWith("[")) {
				throw Error(text)
			}

			// 429 Too Many Requestsを避ける
			const ms = hrend[1] / 1000000
			console.log(offset, hrend[0], ms)
			if (hrend[0] === 0 && ms < 100) {
				await new Promise(resolve => setTimeout(resolve, 100 - ms))
			}

			return JSON.parse(text)
		})

		next = l.length === apinum + 1

		if (next) l.pop();
		for (const e of l) {
			if (
				!ignorehosts.some(x => x === e.host) &&
				e.softwareName === 'misskey' &&
				(e.latestStatus === null || e.isNotResponding === false) &&
				!mylist.some(x => x.url === e.host)
			) {
				notIncluded.add(e.host);
			}
		}

		offset += apinum
	}

	return Array.from(notIncluded)
}
