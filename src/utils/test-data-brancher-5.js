const createWorker = require("./data-brancher-5")
const { extend, first } = require("lodash")

let options = {
	db: {
	  url: "mongodb+srv://jace:jace@jace.llb8spm.mongodb.net/?retryWrites=true&w=majority",
  	  name: "dj-storage"
  	},  

  	branchesCollection: "branches",
  	dataCollection: "dummy",
  	freezePeriod: [1, "seconds"]
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
	
	let w = await createWorker( extend({}, options, {
		dataId: [4,5],
		metadata:{
			task: "Labeling",
			state: "initiated",
			patientId: "A1"
		}
	}))
	let firstVer = w.select({type:"main", head: true})
	console.log("INIT", firstVer)

	let branches = await w.branch({
		user: user1, 
		source: firstVer, 
		metadata:{
			task: "Labeling",
			state: "1st stage started",
			patientId: "A1"
		}
	}) 

	console.log(branches)
	
	// let data = await w.resolveData({ version: branches[0] })
	// console.log(data)

	let data = { a: 1, v: 4}

	let merged = []
	// // data.version = 1

	let version = await w.save({source: branches[0], data})
	console.log(version)

	version = await w.freeze({source: version, data, metadata: 1})
	console.log("freeze", version)
	
	version = await w.rollback({source: version})
	console.log("rollback",version)
	console.log((await w.resolveData({version})))

	// merged.push(JSON.parse(JSON.stringify(version)))
	
	// // data.version = 2

	// version = await w.commit({ source: version, data,  metadata: 2})
	// console.log(version)
	// // data.version = 3
	
	
	// version = await w.save({source: branches[1], data})
	// console.log(version)
	// merged.push(JSON.parse(JSON.stringify(version)))

	// version = await w.freeze({source: version, data, metadata: 1})
	// console.log(version)


	// let bb = version
	// branch = await w.branch({user: user1, source: bb, task: { id: "A-T2"}}) 
	// console.log(branch)	

	// data.version = 4

	// version = await w.save({user: user1, source: branch, data,  metadata: 4})	
	// console.log(version)	
	
	// data.version = 5

	// version = await w.save({user: user1, source: version, data, metadata: 5})	
	// console.log(version)	

	// data.version = 6

	
	// version = await w.save({user: user1, source: version, data, metadata: 6})				
	// console.log(version)	

	// data.version = 7
	
	// branch = await w.branch({user: user2, source: bb, task: { id: "B-T1"} })
	// console.log(branch)

	// data.version = 8

	
	// version = await w.save({user: user2, source: branch, data,  metadata: 8})	
	// console.log(version)	
	
	// data.version = 9

	// version = await w.save({user: user2, source: version, data,  metadata: 9})				
	// console.log(version)	

	// data.version = 10
	
	// version = await w.save({user: user2, source: version, data,  metadata: 10})				
	// console.log(version)	
	
	// data.version = 11

	// branch = await w.branch({user: user3, source: version, task: { id: "C-T1"} })
	// console.log(branch)	

	// data.version = 12

	
	// version = await w.save({user: user3, source: branch, data,  metadata: 12})	
	// console.log(version)	
	
	// data.version = 13

	// branch = await w.branch({user: user2, source: version, task: { id: "B-T2"} })
	// console.log(branch)	
	
	// data.version = 14
	
	// data.c = "aaa"
	
	// version = await w.save({user: user2, source: branch, data})				
	// console.log(version)	
	
	// let sources = w.select(activeUserHead)
	// data.version = 14
	// version = await w.merge({user: "merge", sources: merged, data: {a:1} })				
	// console.log(version)	
	// data.version = 15
	// version = await w.commit({user: "merge", source: version, data})
	// console.log(version)	
}




const run = async () => {

	const dataId = [4, 5]
	
	await createTestData(dataId)
	
	let w = await createWorker(extend({}, options, {dataId}))
	
	// console.log( w )

	// let heads = w.select({type:"main"}).map(v => w.resolveVersion({version:v}))
	// console.log("A", heads)
	
	// for(const version of heads){
	// 	console.log("A", (await w.resolveData({version})))
	// }

	
	// console.log(JSON.stringify(w.getGraph({dataId: 4}), null, " "))
	
	// console.log(JSON.stringify(w.getChart({dataId: 4}), null, " "))

	// console.log(JSON.stringify(w.getHistory({
	// 	maxDepth: 7,
	// 	// stopAtMain: true,
	// 	version: "fbb7845f-5365-404c-a7d2-11dc0fdb995a"
	// }).map( d => ({type: d.type, id: d.id})), null, " "))
	
	
	
	
				
}



run()
