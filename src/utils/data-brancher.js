const mongodb = require("../mongodb")
const { isArray, find, remove, unionBy } = require("lodash")
const Diff = require('jsondiffpatch')
const uuid = require("uuid").v4


	const buildPatchPipeline = ( root, versions) => {
		root = (isArray(root)) ? root[0] : root
		let res = []
		let current = root
		let f = find(versions, v => v.id == ((current.prev) ? current.prev[0].id : null ))
		while (f){
			res.push(f)
			current = f
			f = find(versions, v => v.id == ((current.prev) ? current.prev[0].id : null ))			
		}

		res.reverse()
		res.push(root)

		return res

	}



	// mode - all, active, main, user
	const getHead = async (options, dataId, user, mode) => {
		try {
			dataId = dataId || options.dataId
			user = user || options.user
			mode = mode || options.mode || "all"

			let pipeline = []

			if(mode == "all") pipeline = [
				  {
				    $match:
				      {
				        dataId: dataId,
				        head: true
				      },
				  },
				]

			if(mode == "main") pipeline = [
				  {
				    $match:
				      {
				        dataId: dataId,
				        user: {
				          $exists: false,
				        },
				      },
				  },
				]

			if(mode == "active") pipeline = [
				  {
				    $match: {
				        dataId: dataId,
				      user: {
				        $exists: true,
				      },
				      head: true,
				      branch: {
				        $exists: false,
				      },
				      commit: {
				        $exists: false,
				      },
				    },
				  },
				]

			if(mode == "user") pipeline = [
				  {
				    $match:
				      {
				        dataId: dataId,
				      },
				  },
				  {
				    $match: {
				      $or: [
				        {
				          user: user,
				          head: true,
				        },
				        {
				          user:{
				            $exists: false
				          },
				          head: true,
				        },
				      ],
				    },
				  },
				  {
				    $group: {
				      _id: "$data",
				      a: {
				        $push: "$$ROOT",
				      },
				    },
				  },
				  {
				    $set: {
				      a: {
				        $sortArray: {
				          input: "$a",
				          sortBy: {
				            user: -1,
				          },
				        },
				      },
				    },
				  },
				  {
				    $set: {
				      a: {
				        $first: "$a",
				      },
				    },
				  },
				  {
				    $replaceRoot: {
				      newRoot: "$a",
				    },
				  },
				]

			let data = await mongodb.aggregate({
				db: options.db,
				collection: `${options.db.name}.${options.branchesCollection}`,
				pipeline
			})
			
			return data
		
		} catch(e) {
			throw e
		}		

	}

	const getPatch = async (options, dataId, versionId) => {
		
		try {
			dataId = dataId || options.dataId
			versionId = versionId || options.versionId

			let currentVersion = ( await resolveVersion(options, dataId, versionId) )[0]

			if(!currentVersion.user) return [currentVersion]

			const pipeline = [
			  {
			    $match:
			      {
			        dataId: dataId,
			        id: versionId,
			      },
			  },
			  {
			    $unwind:
			      {
			        path: "$prev",
			      },
			  },
			  {
			    $graphLookup:
			      {
			        from: "branches",
			        startWith: "$prev.id",
			        connectFromField: "prev.id",
			        connectToField: "id",
			        as: "path",
			        restrictSearchWithMatch: {
			        	dataId: dataId,
				        user:{
				          $exists: true
				        }
				      }
			      },
			  },
			  {
			    $unwind:
			      {
			        path: "$path",
			      },
			  },
			  {
			    $match:
			      {
			        dataId: dataId,
			      },
			  },
			  {
			    $group:
			      {
			        _id: "$path.id",
			        res: {
			          $first: "$path",
			        },
			      },
			  },
			  {
			    $replaceRoot:
			      {
			        newRoot: "$res",
			      },
			  }
			] 

			let data = await mongodb.aggregate({
				db: options.db,
				collection: `${options.db.name}.${options.branchesCollection}`,
				pipeline
			})

			data = buildPatchPipeline((await resolveVersion(options, dataId, versionId)), data)
			data.unshift((await resolveVersion(options, dataId, data[0].prev[0].id)))

			return data	

		} catch(e) {
			throw e
		}	
	}


	const getDependencies = async (options, dataId, versionId) => {
		
		try {
			dataId = dataId || options.dataId
			versionId = versionId || options.versionId

			const pipeline = [
			  {
			    $match: {
			      dataId: dataId,
			      id: versionId,
			    },
			  },
			  {
			    $unwind: {
			      path: "$prev",
			    },
			  },
			  {
			    $graphLookup: {
			      from: "branches",
			      startWith: "$prev.id",
			      connectFromField: "prev.id",
			      connectToField: "id",
			      as: "path",
			      restrictSearchWithMatch: {
			        dataId: dataId,
			      },
			    },
			  },
			  {
			    $unwind: {
			      path: "$path",
			    },
			  },
			  {
			    $group: {
			      _id: "$path.id",
			      res: {
			        $first: "$path",
			      },
			    },
			  },
			  {
			    $replaceRoot: {
			      newRoot: "$res",
			    },
			  },
			]

			let data = await mongodb.aggregate({
				db: options.db,
				collection: `${options.db.name}.${options.branchesCollection}`,
				pipeline
			})

			data = (await resolveVersion(options, options.versionId)).concat(data)

			return data	

		} catch(e) {
			throw e
		}	
	
	}

	const resolveVersion = async (options, dataId, versions) => {
		
		try {	
			dataId = dataId || options.dataId
			versions = versions || options.versions 
			versions = (isArray(versions)) ? versions : [versions]
			
			const pipeline = [
			  {
			    $match:
			      {
			        dataId: dataId,
			        id:{
			          $in: versions
			        }
			      },
			  },
			]
			
			let data = await mongodb.aggregate({
				db: options.db,
				collection: `${options.db.name}.${options.branchesCollection}`,
				pipeline
			})

			return data

		} catch(e) {
			throw e
		}

	}

	const resolveData = async (options, dataId, versionId) => {

		try {
			dataId = dataId || options.dataId
			versionId = versionId || options.versionId
			
			let patch = await getPatch(options, dataId, versionId)

			let data = await mongodb.aggregate({
				db: options.db,
				collection: `${options.db.name}.${options.dataCollection}`,
				pipeline: [{$match:{id: dataId}}]
			})

			data = data[0]
			patch.forEach( p => {
				let delta = (p.user) ? p.prev[0].diff : p.dataDiff
				Diff.patch( data, delta)
			})

			return data

		} catch(e) {
			throw e
		}	
		
	}

	const initDataVersions = async (options) => {

	}

	const createDataBranch = async (options, dataId, user, versionId, branchId, metadata) => {
		
		try {
			dataId = dataId || options.dataId
			user = user || options.user
			versionId = versionId || options.versionId
			branchId = branchId || options.branchId || uuid()

			let parent = await resolveVersion(options, dataId, versionId)
			parent = parent[0]
			if (!parent) return 

			parent.branch = parent.branch || []
			parent.branch.push(branchId)

			let branch = {
				id: branchId,
				dataId,
				user,
				prev: [{
					id: parent.id
				}],
				head: true,
				createdAt: new Date(),
				metadata
			}

			await mongodb.replaceOne({
				db: options.db,
				collection: `${options.db.name}.${options.branchesCollection}`,
				filter:{
					'id': parent.id
	            },
	            data: parent
			})

			await mongodb.replaceOne({
				db: options.db,
				collection: `${options.db.name}.${options.branchesCollection}`,
				filter:{
					'id': branch.id
	            },
	            data: branch
			})

			return branch

		} catch(e) {
			throw e
		}

	}

	const createDataSave = async (options, dataId, user, versionId, data, metadata) => {
		
		try {
			dataId = dataId || options.dataId
			user = user || options.user
			versionId = versionId || options.versionId
			
			let prevVersion = ( await resolveVersion(options, dataId, versionId) )[0]
			prevVersion.head = false

			let prevData = await resolveData(options, dataId, versionId)
			
			let newVersion = {
				id: uuid(),
				dataId,
				user,
				prev:[{
					id: versionId,
					diff: Diff.diff(prevData, data)
				}],
				metadata,
				head: true
			}

			prevVersion.save = newVersion.id
			await mongodb.replaceOne({
				db: options.db,
				collection: `${options.db.name}.${options.branchesCollection}`,
				filter:{
					'id': prevVersion.id
	            },
	            data: prevVersion
			})

			await mongodb.replaceOne({
				db: options.db,
				collection: `${options.db.name}.${options.branchesCollection}`,
				filter:{
					'id': newVersion.id
	            },
	            data: newVersion
			})

			return newVersion

		} catch(e) {
			throw e
		}

	}


	const updateVersion = async (options, newVersion) => {
		
		try {
			newVersion = newVersion || options.newVersion
			await mongodb.replaceOne({
				db: options.db,
				collection: `${options.db.name}.${options.branchesCollection}`,
				filter:{
					'id': newVersion.id
	            },
	            data: newVersion
			})

		} catch(e) {
			throw e
		}
			
	}


	const createDataCommit = async (options, dataId, user, versionId, data, metadata) => {

		try {
			dataId = dataId || options.dataId
			user = user || options.user
			versionId = versionId || options.versionId
			
			let activeVersions = await getHead(options, dataId, user, "active")
			
			let updatedVersions = activeVersions.filter( d => d)
			for (v of activeVersions){
				let p = await getPatch(options, dataId, v.id)
				updatedVersions = unionBy(updatedVersions, p, d => d.id)
			}

			let activeVersionCommands = updatedVersions.map( v => {
				

				return {
					updateOne:{
			            filter:{
			                id: v.id,
			                dataId: v.dataId
			            },
			            update: {$set: {head: false}}
			        }
				}

			})

		    await mongodb.bulkWrite({
		    	db: options.db,
		    	collection: `${options.db.name}.${options.branchesCollection}`,
		    	commands: activeVersionCommands
		    })

		    let mainVersions = await getHead(options, dataId, user, "main")

		    for( v of mainVersions ){
		    	let d = await resolveData(options, dataId, v.id)
		    	v.dataDiff = Diff.diff(data, d)
		    	v.head = false
		    }

		    let mainVersionCommands = mainVersions.map( v => ({
				replaceOne:{
		            filter:{
		                id: v.id,
		                dataId: v.dataId
		            },
		            replacement: v
		        }	    	
		    }))

			
		    await mongodb.bulkWrite({
		    	db: options.db,
		    	collection: `${options.db.name}.${options.branchesCollection}`,
		    	commands: mainVersionCommands
		    })


		    let newVersion = {
				id: uuid(),
				dataId,
				prev:[{
					id: versionId
				}],
				metadata,
				head: true
			}

			await mongodb.replaceOne({
				db: options.db,
				collection: `${options.db.name}.${options.branchesCollection}`,
				filter:{
					'id': newVersion.id
	            },
	            data: newVersion
			})

			await mongodb.replaceOne({
				db: options.db,
				collection: `${options.db.name}.${options.dataCollection}`,
				filter:{
					'id': dataId
	            },
	            data: data
			})


			return newVersion

		} catch(e) {
			throw e
		}
			
	}


	module.exports = {
		getHead,
		getPatch, 
		getDependencies,
		resolveVersion,
		resolveData,
		initDataVersions,
		createDataBranch, 
		createDataSave,
		createDataCommit,
		updateVersion
	}