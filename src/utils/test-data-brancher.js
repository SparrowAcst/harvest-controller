const brancher = require("./data-brancher")
const { extend } = require("lodash")

let options = {
	db: {
	  url: "mongodb+srv://jace:jace@jace.llb8spm.mongodb.net/?retryWrites=true&w=majority",
  	  name: "dj-storage"
  	},  

  	branchesCollection: "branches",
  	dataCollection: "dummy"
}

const run = async () => {
		
	// let h = await brancher.getHead(options, 4, "B", "all")
	// console.log("getHead all",h)

	// h = await brancher.getHead(options, 4, "B", "main")
	// console.log("getHead main",h)

	// h = await brancher.getHead(options, 4, "B", "active")
	// console.log("getHead active",h)
	
	// h = await brancher.getHead(options, 4, "B", "user")
	// console.log("getHead user",h)


	// let v = await brancher.resolveVersion(extend({}, options, {dataId: 4, versionId: "B5"}), 4, "B5")
	// console.log("resolveVersion",v)

	// let deps = await brancher.getDependencies(extend({}, options, {dataId: 4, versionId: "B5"}))
	// console.log("getDependencies",deps)
	
	// let patch = await brancher.getPatch(extend({}, options, {dataId: 4, versionId: "B5"}))
	// console.log("getPatch B5",patch)
	
	// let patch = await brancher.getPatch(extend({}, options, {dataId: 4, versionId: "B2"}))
	// console.log("getPatch B2",patch)

	// let data = await brancher.resolveData(extend({}, options, {dataId: 4, versionId: "C2"}))
	// console.log("resolveData B2",data)
	
	// patch = await brancher.getPatch(extend({}, options, {dataId: 4, versionId: "A1"}))
	// console.log("getPatch A1",patch)

	// patch = await brancher.getPatch(extend({}, options, {dataId: 20, versionId: "m1"}))
	// console.log("getPatch m1",patch)

	// let branch = await brancher.createDataBranch(options, 4, "Vasya", "B5", "V1", {comment: "test create branch"}) 
	// console.log(branch)

	// let v = await brancher.resolveVersion(extend({}, options, {dataId: 4, versionId: "B5"}), 4, "B5")
	// console.log("resolveVersion",v)

	// branch = await brancher.resolveVersion(options,  4, "B5")
	// console.log("B5", branch)

	// branch = await brancher.resolveVersion(options, 4, "V1")
	// console.log("V1", branch)
	
	// let data = await brancher.resolveData(options, 4, "V1")
	// console.log("resolveData V1", data)
	// data.a = "new value"
	// let v = await brancher.createDataSave(options, 4, "Vasya", "V1", data, {comment:"test create data save for Vasya"})
	// console.log(v)
	// data = await brancher.resolveData(options, 4, v.id)
	// console.log(data)	

	// let data = await brancher.resolveData(options, 4, '15fcf357-f0e6-41c3-8abc-2f71ea2fdf33')
	// console.log("resolveData '15fcf357-f0e6-41c3-8abc-2f71ea2fdf33'", data)
	// data.b = ["new value","to array"]
	// let v = await brancher.createDataSave(options, 4, "Vasya", "15fcf357-f0e6-41c3-8abc-2f71ea2fdf33", data, {comment:"test create data save for Vasya"})
	// console.log(v)
	// data = await brancher.resolveData(options, 4, v.id)
	// console.log(data)	
	// data.c = {field:"new value"}
	// v = await brancher.createDataSave(options, 4, "Vasya", v.id, data, {comment:"test create data save for Vasya"})
	// console.log(v)
	// data = await brancher.resolveData(options, 4, v.id)
	// console.log(data)	

	// let v = ( await brancher.getHead(options, 4, "Vasya", "user") )[0]
	// console.log("getHead user", v)
	// let data = await brancher.resolveData(options, 4, v.id)
	// console.log(data)	
	// data = await brancher.resolveData(options, 4, "h3")
	// console.log(data)	
	
	
	let d = await brancher.resolveData(options, 4, "efb2e452-f1dd-44a2-b665-53ac81ed81aa")
	console.log(d)

	d = await brancher.resolveData(options, 4, "h1")
	console.log(d)

	d = await brancher.resolveData(options, 4, "h2")
	console.log(d)

	d = await brancher.resolveData(options, 4, "h3")
	console.log(d)
	


	// let v = ( await brancher.getHead(options, 4, "Vasya", "user") )[0]
	// console.log(v)
	// let d = await brancher.resolveData(options, v.dataId, v.id)
	// console.log(d)

	// let h = await brancher.createDataCommit(options, v.dataId, v.user, v.id, d, {comment:"test commit"})

	// let v = ( await brancher.getHead(options, 4, "Vasya", "user") )[0]
	
	// let branch = await brancher.createDataBranch(options, 4, "Vasya", v.id) 
	// console.log(branch)
	// let users = ["A", "B", "C", "D", "E", "F", "G", "Vasya"]
	// for(u of users){
	// 	let v = ( await brancher.getHead(options, 4, u, "user") )[0]
	// 	console.log(`User ${u}: ${v.id}`)
	// }	
	
				
}



run()
