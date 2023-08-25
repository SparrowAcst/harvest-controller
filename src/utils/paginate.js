
const { sortBy, chunk, first, shuffle } = require("lodash")

const CHUNK_LENGTH = 100

const getPage = (data, skip, limit, sort, map, desc) => {

	skip = skip || 0
	limit = limit || 10

	let s = skip
	let l = skip + limit
	
	// if(desc){
	// 	l = -skip 
	// 	s = - skip - limit
	// }


	let buf = chunk(data, CHUNK_LENGTH)
	
	sort = (sort) ? sort : (d => d)

	buf = buf.map( c => sortBy(c, sort))
	
	let res = []
	
	for(; buf.length>0 ;){
		
		let idx = 0 
		let min = sort(first(buf[0]))
		
		for( let i = 0; i < buf.length; i++ ){
			
			let p = sort(first(buf[i]))
			if(  p <= min ){
				idx = i
				min = p
			}
		}	

		res.push(buf[idx].shift())

		if(buf[idx].length == 0){
			buf.splice(idx, 1)
		}
	}

	if(desc) res.reverse()
	
	map = (map) ? map : (d => d)
		
	res = res.slice(s, l).map(map)
	

	return res

}


module.exports = {
	getPage
}	


// let d = require("./TEST-SORT-TIMES.json")

// // // for(let i = 0; i < 1024; i++){
// // // 	d.push(i)
// // // }

// // // d = shuffle(d)
// // // console.log(d.length)

// let res = getPage( d, 0, 10, d => (d._id.$date) ? d._id.$date : d._id, d => (d._id.$date) ? d._id.$date : d._id, "desc")
// // // let res = getPage( d, 2, 5, d => d, d => d)

// console.log(res)