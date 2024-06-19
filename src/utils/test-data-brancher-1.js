const brancher = require("./data-brancher-1")
const { extend, first } = require("lodash")

let options = {
	db: {
	  url: "mongodb+srv://jace:jace@jace.llb8spm.mongodb.net/?retryWrites=true&w=majority",
  	  name: "dj-storage"
  	},  

  	branchesCollection: "branches",
  	dataCollection: "dummy"
}

const createTestData = async dataId => {
	
	const user1 = "A"
	const user2 = "B"
	const user3 = "C"
	
	
	let firstVer = await brancher.initDataVersion(options, dataId)
	console.log("INIT", firstVer)

	let branch = await brancher.createDataBranch(options, dataId, user1, firstVer.id, {comment: "first branch"}) 
	console.log(branch)
	
	let data = await brancher.resolveData(options, dataId, branch.id)
	console.log(data)

	data.a = "USER DATA A"

	let version = await brancher.createDataSave(options, dataId, user1, branch.id, data)

	version = await brancher.createDataCommit(options, dataId, user1, version.id, data)
	let bb = version.id
	branch = await brancher.createDataBranch(options, dataId, user1, bb, {comment: "first branch"}) 
	console.log(branch)	

	data = await brancher.resolveData(options, dataId, branch.id)
	console.log(data)
	data.b = "USER DATA A"
	
	version = await brancher.createDataSave(options, dataId, user1, branch.id, data)	
	

	branch = await brancher.createDataBranch(options, dataId, user2, bb, {comment: "first branch"}) 
	console.log(branch)	

	data = await brancher.resolveData(options, dataId, branch.id)
	console.log(data)
	data.b = "USER DATA B"
	
	version = await brancher.createDataSave(options, dataId, user2, branch.id, data)	
	
	branch = await brancher.createDataBranch(options, dataId, user3, version.id, {comment: "first branch"}) 
	console.log(branch)	

	data.c = "aaa"
	version = await brancher.createDataSave(options, dataId, user2, branch.id, data)	

	branch = await brancher.createDataCommit(options, dataId, user2, version.id, data)

}

const run = async () => {

	const dataId = 5
	
	await createTestData(dataId)
	console.log(JSON.stringify((await brancher.getGraph(options, dataId)), null, " "))

	// console.log((await brancher.getHead(options, dataId, "A", "user")))

	
// 	// let d = await brancher.getDependencies(options, dataId,"27515249-56f8-49f6-89a0-15281b16ad5a")
// 	// console.log(d)	



// 	const user1 = "A"
// 	const user2 = "B"

// 	// let h = await brancher.getHead(options, dataId, user1, "user")
// 	// let v1 = h[0].id
// 	// h = await brancher.getHead(options, dataId, user2, "user")
// 	// let v2 = h[0].id
	
// 	// let data = await brancher.resolveData(options, dataId, "f76693c4-5bbe-4d94-a5f8-627a078dbcb5")
// 	// console.log(data)
// 	// data = await brancher.resolveData(options, dataId, "27515249-56f8-49f6-89a0-15281b16ad5a")
// 	// console.log(data)
	
	
// 	// let diff = await brancher.getDataDiff(
// 	// 	options, 
// 	// 	dataId, 
// 	// 	"f76693c4-5bbe-4d94-a5f8-627a078dbcb5", 
// 	// 	"27515249-56f8-49f6-89a0-15281b16ad5a"
// 	// )

// 	// console.log(diff.formatted)	



// 	// let firstVer = await brancher.initDataVersion(options, dataId)
// 	// console.log(firstVer)
// 	// h = await brancher.getHead(options, dataId, user, "user")
// 	// h = h[0]
// 	// console.log("main",h)
// 	// let version = h //await brancher.resolveVersion(options, dataId, h.id)
// 	// console.log(version)
// 	// let data = await brancher.resolveData(options, dataId, h.id)
// 	// console.log(data)
	
// 	// data.b = "new value"
	
// 	// version = await brancher.createDataSave(
// 	// 	extend(
// 	// 		{},
// 	// 		options,
// 	// 		{ 
// 	// 			dataId, 
// 	// 			user, 
// 	// 			versionId: version.id, 
// 	// 			data, 
// 	// 			metadata: {comment:"save data"}
// 	// 		}	
// 	// 	)
// 	// )	
	
// 	// console.log(version)
// 	// data.c = Math.round(100*Math.random())
// 	// version = await brancher.createDataSave(options, dataId, user, version.id, data, {comment:"save data"})
// 	// console.log(version)

// 	// data = await brancher.resolveData(options, dataId, version.id)
// 	// console.log(data)
	
// 	// let commit = await brancher.createDataCommit(options, dataId, user, version.id, data, {comment:"test commit"})
// 	// console.log(commit)
	


// 	// let branch = await brancher.createDataBranch(options, 5, "A", h.id, null, {comment: "first branch"}) 
// 	// console.log(branch)


// ///////////////////////////////////////////////////////////////////////////////////////////////////////////
// 	// let h = await brancher.getHead(options, 4, "B", "all")
// 	// console.log("getHead all",h)

// 	// h = await brancher.getHead(options, 4, "B", "main")
// 	// console.log("getHead main",h)

// 	// h = await brancher.getHead(options, 4, "B", "active")
// 	// console.log("getHead active",h)
	
// 	// h = await brancher.getHead(options, 4, "B", "user")
// 	// console.log("getHead user",h)


// 	// let v = await brancher.resolveVersion(extend({}, options, {dataId: 4, versionId: "B5"}), 4, "B5")
// 	// console.log("resolveVersion",v)

// 	// let deps = await brancher.getDependencies(extend({}, options, {dataId: 4, versionId: "B5"}))
// 	// console.log("getDependencies",deps)
	
// 	// let patch = await brancher.getPatch(extend({}, options, {dataId: 4, versionId: "B5"}))
// 	// console.log("getPatch B5",patch)
	
// 	// let patch = await brancher.getPatch(extend({}, options, {dataId: 4, versionId: "B2"}))
// 	// console.log("getPatch B2",patch)

// 	// let data = await brancher.resolveData(extend({}, options, {dataId: 4, versionId: "C2"}))
// 	// console.log("resolveData B2",data)
	
// 	// patch = await brancher.getPatch(extend({}, options, {dataId: 4, versionId: "A1"}))
// 	// console.log("getPatch A1",patch)

// 	// patch = await brancher.getPatch(extend({}, options, {dataId: 20, versionId: "m1"}))
// 	// console.log("getPatch m1",patch)

// 	// let branch = await brancher.createDataBranch(options, 4, "Vasya", "B5", "V1", {comment: "test create branch"}) 
// 	// console.log(branch)

// 	// let v = await brancher.resolveVersion(extend({}, options, {dataId: 4, versionId: "B5"}), 4, "B5")
// 	// console.log("resolveVersion",v)

// 	// branch = await brancher.resolveVersion(options,  4, "B5")
// 	// console.log("B5", branch)

// 	// branch = await brancher.resolveVersion(options, 4, "V1")
// 	// console.log("V1", branch)
	
// 	// let data = await brancher.resolveData(options, 4, "V1")
// 	// console.log("resolveData V1", data)
// 	// data.a = "new value"
// 	// let v = await brancher.createDataSave(options, 4, "Vasya", "V1", data, {comment:"test create data save for Vasya"})
// 	// console.log(v)
// 	// data = await brancher.resolveData(options, 4, v.id)
// 	// console.log(data)	

// 	// let data = await brancher.resolveData(options, 4, '15fcf357-f0e6-41c3-8abc-2f71ea2fdf33')
// 	// console.log("resolveData '15fcf357-f0e6-41c3-8abc-2f71ea2fdf33'", data)
// 	// data.b = ["new value","to array"]
// 	// let v = await brancher.createDataSave(options, 4, "Vasya", "15fcf357-f0e6-41c3-8abc-2f71ea2fdf33", data, {comment:"test create data save for Vasya"})
// 	// console.log(v)
// 	// data = await brancher.resolveData(options, 4, v.id)
// 	// console.log(data)	
// 	// data.c = {field:"new value"}
// 	// v = await brancher.createDataSave(options, 4, "Vasya", v.id, data, {comment:"test create data save for Vasya"})
// 	// console.log(v)
// 	// data = await brancher.resolveData(options, 4, v.id)
// 	// console.log(data)	

// 	// let v = ( await brancher.getHead(options, 4, "Vasya", "user") )[0]
// 	// console.log("getHead user", v)
// 	// let data = await brancher.resolveData(options, 4, v.id)
// 	// console.log(data)	
// 	// data = await brancher.resolveData(options, 4, "h3")
// 	// console.log(data)	
	
	
// 	// let d = await brancher.resolveData(options, 4, "efb2e452-f1dd-44a2-b665-53ac81ed81aa")
// 	// console.log(d)

// 	// d = await brancher.resolveData(options, 4, "h1")
// 	// console.log(d)

// 	// d = await brancher.resolveData(options, 4, "h2")
// 	// console.log(d)

// 	// d = await brancher.resolveData(options, 4, "h3")
// 	// console.log(d)
	


// 	// let v = ( await brancher.getHead(options, 4, "Vasya", "user") )[0]
// 	// console.log(v)
// 	// let d = await brancher.resolveData(options, v.dataId, v.id)
// 	// console.log(d)

// 	// let h = await brancher.createDataCommit(options, v.dataId, v.user, v.id, d, {comment:"test commit"})

// 	// let v = ( await brancher.getHead(options, 4, "Vasya", "user") )[0]
	
// 	// let branch = await brancher.createDataBranch(options, 4, "Vasya", v.id) 
// 	// console.log(branch)
// 	// let users = ["A", "B", "C", "D", "E", "F", "G", "Vasya"]
// 	// for(u of users){
// 	// 	let v = ( await brancher.getHead(options, 4, u, "user") )[0]
// 	// 	console.log(`User ${u}: ${v.id}`)
// 	// }	
	
				
}



run()
