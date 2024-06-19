const createWorker = require("./data-brancher-3")
const { extend, first } = require("lodash")

let options = {
	db: {
	  url: "mongodb+srv://jace:jace@jace.llb8spm.mongodb.net/?retryWrites=true&w=majority",
  	  name: "dj-storage"
  	},  

  	branchesCollection: "branches",
  	dataCollection: "dummy"
}


const activeUserHead = version => version.user && version.head == true && !version.save && !version.branch 
const userHead = user => version => version.user == user && version.head == true 
const mainHead = version => !version.user && version.head == true 
const getHead = (worker, user) => {
	let v1 = worker.select(userHead(user))[0]  
	let v2 = worker.select(mainHead)[0]
	return (v1) ? v1 : v2
}	


const createTestData = async dataId => {
	
	const user1 = "A"
	const user2 = "B"
	const user3 = "C"
	
	let w = await createWorker( extend({}, options, {dataId}) )
	let firstVer = (await w.select(getHead(w, user1)))[0]
	console.log("INIT", firstVer)

	let branch = await w.branch({user: user1, source: firstVer}) 
	console.log(branch)
	
	let data = await w.resolveData({ version: branch })
	console.log(data)


	data.version = 1

	let version = await w.save({user: user1, source: branch, data, metadata: 1})
	console.log(version)

	data.version = 2

	version = await w.commit({user: user1, source: version, data,  metadata: 2})
	console.log(version)
	data.version = 3
	
	let bb = version
	branch = await w.branch({user: user1, source: bb}) 
	console.log(branch)	

	data.version = 4

	version = await w.save({user: user1, source: branch, data,  metadata: 4})	
	console.log(version)	
	
	data.version = 5

	version = await w.save({user: user1, source: version, data, metadata: 5})	
	console.log(version)	

	data.version = 6

	
	version = await w.save({user: user1, source: version, data, metadata: 6})				
	console.log(version)	

	data.version = 7
	
	branch = await w.branch({user: user2, source: bb })
	console.log(branch)

	data.version = 8

	
	version = await w.save({user: user2, source: branch, data,  metadata: 8})	
	console.log(version)	
	
	data.version = 9

	version = await w.save({user: user2, source: version, data,  metadata: 9})				
	console.log(version)	

	data.version = 10
	
	version = await w.save({user: user2, source: version, data,  metadata: 10})				
	console.log(version)	
	
	data.version = 11

	branch = await w.branch({user: user3, source: version })
	console.log(branch)	

	data.version = 12

	
	version = await w.save({user: user3, source: branch, data,  metadata: 12})	
	console.log(version)	
	
	data.version = 13

	branch = await w.branch({user: user2, source: version })
	console.log(branch)	
	
	data.version = 14
	
	data.c = "aaa"
	
	version = await w.save({user: user2, source: branch, data})				
	console.log(version)	
	
	// let sources = w.select(activeUserHead)
	// data.version = 14
	// version = await w.merge({user: "merge", sources, data})				
	// console.log(version)	
	// data.version = 15
	// version = await w.commit({user: "merge", source: version, data})
	// console.log(version)	
}




const run = async () => {

	const dataId = 5
	
	// await createTestData(dataId)
	
	let w = await createWorker(extend({}, options, {dataId}))
	
	// console.log( w.select(activeUserHead) )

	// console.log("A", getHead(w, "A"))
	// console.log("B", getHead(w, "B"))
	// console.log("C", getHead(w, "C"))
	// console.log("D", getHead(w, "A"))
	// cogetHistorynsole.log("undefined", getHead(w, "A"))


	// console.log("A", ( await w.resolveData({ version: getHead(w, "A")})))
	// console.log("B", ( await w.resolveData({ version: getHead(w, "B")})))
	// console.log("C", ( await w.resolveData({ version: getHead(w, "C")})))
	// console.log("D", ( await w.resolveData({ version: getHead(w, "D")})))
	// console.log("undefined", (await w.resolveData({ version: getHead(w)})))

	// console.log(JSON.stringify(w.getGraph(), null, " "))
	
	// console.log(JSON.stringify(w.getChart(), null, " "))

	console.log(JSON.stringify(w.getHistory({
		maxDepth: 7,
		// stopAtMain: true,
		version: "fbb7845f-5365-404c-a7d2-11dc0fdb995a"
	}).map( d => ({type: d.type, id: d.id})), null, " "))
	
	
	
	
				
}



run()
