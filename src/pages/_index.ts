import initSqlJs from 'sql.js'
import sqlWasm from 'sql.js/dist/sql-wasm.wasm?url'

function sql(arr: TemplateStringsArray) {
	return arr[0]!.trim().replace(/\s+/g, ' ')
}

async function main() {
	const input = document.querySelector('input')!
	input.value = 'Cargando...'

	const sqlPromise = initSqlJs({ locateFile: () => sqlWasm })
	const dataPromise = fetch('/data/salud.db').then(async res => res.arrayBuffer())
	const [SQL, buf] = await Promise.all([sqlPromise, dataPromise])
	const db = new SQL.Database(new Uint8Array(buf))

	input.value = ''
	input.disabled = false

	input.addEventListener('input', () => {
		const tbody = document.querySelector('tbody')!
		const query = input.value.trim()
		if (query.length < 3) {
			tbody.innerHTML = '<tr><td colspan="4">Escriba para buscar</td></tr>'
			return
		}
		const result = db.exec(sql`
			SELECT
				nombre,
				departamento || ' - ' || provincia || ' - ' || distrito AS ubicacion,
				direccion
			FROM establecimientos
			WHERE
				LOWER(nombre) LIKE LOWER(?) OR
				LOWER(ubicacion) LIKE LOWER(?)
			ORDER BY nombre
		`, [`%${query}%`, `%${query}%`])
		if (!result.length) {
			tbody.innerHTML = '<tr><td colspan="4">No hay resultados</td></tr>'
			return
		}
		tbody.innerHTML = result[0]!
			.values
			.map(row => `<tr>${row.map(val => `<td>${val!.toString()}</td>`).join('')}</tr>`)
			.join('')
	})
}

main().catch(console.error)
