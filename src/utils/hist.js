
const { uniqBy } = require("lodash")


const hist = (data, getter, valueFieldName, countFieldName) => {
	
	getter = (getter) ? getter : (d => d)
	valueFieldName = valueFieldName || "value"
	countFieldName = countFieldName || "count"
	
	let values = data.map(getter)
	let res = uniqBy(values)
	
	res = res.map( v => {
		let d = {}
		d[valueFieldName] = v
		d[countFieldName] = values.filter( t => t == v).length
		return d
	})

	return res

}


module.exports = {
	hist
}	


// let data = [
// 	null,
// 	"Acceptable",
// 	"Good",
// 	"Good",
// 	"Acceptable",
// 	null,
// 	null,
// 	"Acceptable",
// 	"Acceptable",
// 	null,
// 	null,
// 	null,
// 	"Good",
// 	null
// ]

// console.log(JSON.stringify(hist(data, d => d, "TODO", "count"), null,' '))
