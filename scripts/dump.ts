import { mkdir, rm, writeFile } from 'node:fs/promises'
import { Agent } from 'node:https'
import { DatabaseSync } from 'node:sqlite'
import axios from 'axios'
import { JSDOM } from 'jsdom'

function query(node: string | ParentNode, selector: string) {
	if (typeof node === 'string')
		node = new JSDOM(node).window.document
	return [...node.querySelectorAll(selector)]
}

async function main() {
	const http = axios.create({
		baseURL: 'https://sigeps.sis.gob.pe/BuscadorEESS/PortalSIS',
		httpsAgent: new Agent({ keepAlive: true, maxSockets: 10 }),
	})
	http.interceptors.request.use((config) => {
		// eslint-disable-next-line ts/no-unsafe-assignment
		const { data, method, url } = config
		console.time(`~> ${method!.toUpperCase()} ${url}${data ? ` [${data}]` : ''}`)
		return config
	})
	http.interceptors.response.use((response) => {
		// eslint-disable-next-line ts/no-unsafe-assignment
		const { data, method, url } = response.config
		console.timeEnd(`~> ${method!.toUpperCase()} ${url}${data ? ` [${data}]` : ''}`)
		return response
	})

	console.time('=> fetch data')

	const rootStr = (await http.get<string>('BuscarXDEP')).data
	const dptos = query(rootStr, '#DptoAfe option')
		.slice(1)
		.map(el => el.getAttribute('value')!)
		.sort()

	const rows = await Promise.all(dptos.map(async (dpto) => {
		const provArr = (await http.post<{ Value: string }[]>(
			'ProvinciasxDpto',
			new URLSearchParams({ id: dpto }),
		)).data
		const provs = provArr.map(it => it.Value).sort()

		return Promise.all(provs.map(async (prov) => {
			const distArr = (await http.post<{ Value: string }[]>(
				'DistritosxPrv',
				new URLSearchParams({ id: prov }),
			)).data
			const dists = distArr.map(it => it.Value).sort()

			return Promise.all(dists.map(async (dist) => {
				const dataStr = (await http.post<string>(
					'BuscarXDEP',
					new URLSearchParams({
						DptoAfe: dpto,
						PrvAfe: prov,
						DistAfe: dist,
						V_CAT1: 'true',
						V_CAT2: 'true',
						V_CAT3: 'true',
						buscar: 'BUSCAR',
					}),
				)).data
				const trs = query(dataStr, 'table tbody tr')

				return trs.map((tr) => {
					const ths = query(tr, 'th')
					return [
						ths[0]!.textContent!.trim(), // codigo
						ths[1]!.textContent!.trim(), // nombre
						ths[2]!.textContent!.trim(), // departamento
						ths[3]!.textContent!.trim(), // provincia
						ths[4]!.textContent!.trim(), // distrito
						ths[5]!.textContent!.trim(), // direccion
					]
				})
			})).then(arr => arr.flat())
		})).then(arr => arr.flat())
	})).then(arr => arr.flat())

	rows.sort((a, b) => a[0]!.localeCompare(b[0]!))

	console.timeEnd('=> fetch data')

	const rootPath = new URL('../public/data/', import.meta.url)
	await mkdir(rootPath, { recursive: true })

	const jsonPath = new URL('salud.json', rootPath)
	await writeFile(jsonPath, `${JSON.stringify(rows, null, '\t')}\n`, 'utf8')

	console.time('=> store data')

	const dbPath = new URL('salud.db', rootPath)
	await rm(dbPath, { force: true })

	const db = new DatabaseSync(dbPath)
	db.exec('PRAGMA journal_mode = WAL')
	db.exec('DROP TABLE IF EXISTS establecimientos')
	db.exec(`
		CREATE TABLE establecimientos (
			codigo TEXT PRIMARY KEY NOT NULL,
			nombre TEXT NOT NULL,
			departamento TEXT NOT NULL,
			provincia TEXT NOT NULL,
			distrito TEXT NOT NULL,
			direccion TEXT NOT NULL
		)
	`.trim().replace(/\s+/g, ' '))

	const stmt = db.prepare('INSERT INTO establecimientos VALUES (?, ?, ?, ?, ?, ?)')
	db.exec('BEGIN TRANSACTION')
	for (const row of rows)
		stmt.run(...row)
	db.exec('COMMIT TRANSACTION')

	console.timeEnd('=> store data')
}

main().catch(console.error)
