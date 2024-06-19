const mongodb = require("../mongodb")
const { isArray, find, remove, unionBy, keys, first, last, uniqBy, sortBy, findIndex } = require("lodash")
const Diff = require('jsondiffpatch')
const uuid = require("uuid").v4
const moment = require("moment")


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
		console.log("getHead")
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

			
			if(["all", "main", "active"].includes(mode)) {
				
				let data = await mongodb.aggregate({
					db: options.db,
					collection: `${options.db.name}.${options.branchesCollection}`,
					pipeline
				})
			
				return data

			}		


			if(mode == "user") pipeline = [
				  {
				    $match:
				      {
				        dataId: dataId,
				      }
				  }
			]	      

			data = await mongodb.aggregate({
				db: options.db,
				collection: `${options.db.name}.${options.branchesCollection}`,
				pipeline
			})

			let d1 = find(data, d => d.user == user && d.head == true)
			let d2 = find(data, d => !d.user && d.head == true)
			
			return d1 || d2
		
		} catch(e) {
			throw e
		}		

	}

	const getPatch = async (options, dataId, versionId) => {
		
		try {
			dataId = dataId || options.dataId
			versionId = versionId || options.versionId

			let currentVersion = ( await resolveVersion(options, dataId, versionId) ) //[0]

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

			let d = await resolveVersion(options, options.versionId)
			data = ((isArray(d)) ? d : [d]).concat(data)

			return data	

		} catch(e) {
			throw e
		}	
	
	}

	const resolveVersion = async (options, dataId, versions) => {
		console.log("resolveVersion")
		
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

			return (data.length < 2) ? data[0] : data

		} catch(e) {
			throw e
		}

	}

	const resolveData = async (options, dataId, versionId) => {
		console.log("resolveData")
		
		try {
			dataId = dataId || options.dataId
			versionId = versionId || options.versionId
			// console.log(dataId, versionId)
			let version = await resolveVersion(options, dataId, versionId)
			// version = version[0]
			// let patch = await getPatch(options, dataId, versionId)

			let data = await mongodb.aggregate({
				db: options.db,
				collection: `${options.db.name}.${options.dataCollection}`,
				pipeline: [{$match:{id: dataId}}]
			})

			data = data[0]

			version.patches.forEach( p => {
				Diff.patch( data, p)
			})

			return data

		} catch(e) {
			throw e
		}	
		
	}

	const initDataVersion = async (options, dataId, metadata) => {
		console.log("initDataVersion")
		
		try {
			dataId = dataId || options.dataId
			metadata = metadata || options.metadata

			let data = await mongodb.aggregate({
				db: options.db,
				collection: `${options.db.name}.${options.dataCollection}`,
				pipeline: [{$match:{id: dataId}}]
			})
			
			if(data.length == 0) throw new Error(`DataBrancher error: Cannot create first branch for ${dataId}. Data not found in ${options.db.name}.${options.dataCollection}`)			

			const branch = {
					id: uuid(),
					dataId,
					patches: [],
					head: true,
					createdAt: new Date(),
					metadata,
					type: "main"
				}

			await mongodb.replaceOne({
				db: options.db,
				collection: `${options.db.name}.${options.branchesCollection}`,
				filter:{
					'id': branch.id
	            },
	            data: branch
			})

			return branch

		} catch (e) {
			throw e
		}		

	}

	const createDataBranch = async (options, dataId, user, versionId, metadata) => {
		console.log("createDataBranch")
		
		try {
			dataId = dataId || options.dataId
			user = user || options.user
			versionId = versionId || options.versionId
			branchId = uuid()

			// console.log(dataId, user, versionId, branchId)

			let parent = await resolveVersion(options, dataId, versionId)
			// parent = parent[0]
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
				patches: parent.patches,
				createdAt: new Date(),
				metadata,
				type: "branch"
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
		console.log("createDataSave >")
		
		try {
			dataId = dataId || options.dataId
			user = user || options.user
			versionId = versionId || options.versionId
			
			// console.log(dataId, user, versionId)

			let prevVersion = ( await resolveVersion(options, dataId, versionId) ) //[0]
			prevVersion.head = false

			let prevData = await resolveData(options, dataId, versionId)
			
			let newVersion = {
				id: uuid(),
				dataId,
				user,
				prev:[{
					id: versionId
				}],
				metadata,
				head: true,
				createdAt: new Date(),
				patches: prevVersion.patches.concat([Diff.diff(prevData, data)]).filter(d => d),
				type: "save"
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

			console.log("< createDataSave")
		

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
		console.log("createDataCommit")
		
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
		    	v.patches = [Diff.diff(data, d)].filter(d => d)
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
				patches: [],
				head: true,
				createdAt: new Date(),
				type: "main"
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


	const formatDiff = (delta, parentKey) => {
		let res = []
		delta = Diff.clone(delta)
		
		keys(delta).forEach( key => {
			
			if(key == "_t") return
			
			let publicParentKey = parentKey || ""
			let publicSelfKey = (keys(delta).includes("_t")) ? "" : key

			let publicKey = [publicParentKey,publicSelfKey].filter(d => d).join(".")	

			if(isArray(delta[key])){
				let op
				if(delta[key].length == 1) op = "insert"
				if(delta[key].length == 2) op = "update"
				if(delta[key].length == 3 && last(delta[key]) == 0 ) op = "remove"
				
				let oldValue
				if(delta[key].length == 1) oldValue = undefined
				if(delta[key].length == 2) oldValue = first(delta[key])
				if(delta[key].length == 3 && last(delta[key]) == 0 ) oldValue = first(delta[key])

				let newValue
				if(delta[key].length == 1) newValue = last(delta[key])
				if(delta[key].length == 2) newValue = last(delta[key])
				if(delta[key].length == 3 && last(delta[key]) == 0 ) newValue = undefined

				res.push({
					key: publicKey,
					op,
					oldValue,
					newValue
				})

			} else {

				res = res.concat(formatDiff(delta[key], publicKey))

			}	

		})

		return res
	}

	const getDataDiff = async (options, dataId, v1, v2) => {
		try {
			dataId = dataId || options.dataId
			v1 = v1 || options.v1
			v2 = v2 || options.v2

			let d1 = await resolveData(options, dataId, v1)
			let d2 = await resolveData(options, dataId, v2)

			if(!d1) throw new Error(`DataBrancher: data ${dataId}.v ${v1} not found`)
			if(!d2) throw new Error(`DataBrancher: data ${dataId}.v ${v2} not found`)
			
			let diff =Diff.diff(d1, d2)

			return {
				patch: diff,
				formatted: formatDiff ( diff )
			}

		} catch (e) {
			throw e
		}

	}


	const getGraph = async (options, dataId) => {

		dataId = dataId || options.dataId

		let data = await mongodb.aggregate({
			db: options.db,
			collection: `${options.db.name}.${options.branchesCollection}`,
			pipeline: [{$match:{dataId}}]
		})

		let versions = data.map( d => {
			d.name = d.id
			d.x = moment(d.createdAt).format("YYYY-MM-DD HH:mm:ss")
			d.y = d.user || "main",
			d.value = 1
			return d
		})

		let dependencies = []
		versions.forEach( t => {
			if(t.prev && t.prev.length > 0){
				t.prev.forEach( s => {
					dependencies.push({
						source: findIndex( versions, v => v.id == s.id),
						target: findIndex( versions, v => v.id == t.id)
					})
				})
			}

		})

		let users = uniqBy(versions.map( d => d.user || "main"))
		let timeline = sortBy(versions.map( d => d.x))

		return {
			dataId,
			users,
			versions, 
			dependencies,
			timeline
		}	
			
	}


	module.exports = {
		getHead,
		getPatch, 
		getDependencies,
		resolveVersion,
		resolveData,
		initDataVersion,
		createDataBranch, 
		createDataSave,
		createDataCommit,
		updateVersion,
		getDataDiff,
		getGraph
	}		




// option = {
//   toolbox: {
//     feature: {
//       saveAsImage: {}
//     }
//   },
//   tooltip: {
//     formatter: params => {
//       if(params.dataType == "edge") return
//       return `Type: ${params.data.category}<br/>User: ${(params.data.value == "main") ? "" : params.data.value}<br/>Created at: ${params.data.x}<br/>${(params.data.readonly) ? "Read only" : ""}`
//     },
//     textStyle:{
//       fontSize: 10
//     }
    
//   },
//   xAxis: {
//     type: 'category',
//     data: mdata.timeline
//   },
//   yAxis: {
//     type: 'category',
//     data: mdata.users,
//     splitArea: {
//       show: true
//     },
//     splitLine:{
//       show: true
//     }
//   },
//   series: [
//     {
//       type: 'graph',
//       layout: 'none',
//       coordinateSystem: 'cartesian2d',
//       symbolSize: 15,
//       symbol: "rest",
//       label: {
//         show: true,
//         position:"top",
//         fontSize: 8
//       },
//       edgeSymbol: ['circle', 'arrow'],
//       edgeSymbolSize: [4, 10],
//       categories:[
//         {
//           name: "main",
//           symbol: "diamond"
//         },
//         {
//           name: "branch",
//           symbol: "rect"
//         },
//         {
//           name: "save",
//           symbol: "circle"
//         },
        
//       ],
//       data: mdata.versions.map( d => ({
//         name: `${d.name.split("-")[4]}`,
//         x: d.x,
//         value: d.y,
//         readonly: d.branch || d.save || d.commit,
//         category: d.type,
//         itemStyle:{
//           symbol: (d.head) ? "circle" : "rect",
//           borderColor: (d.head) ? (!d.branch && !d.save && !d.commit) ? "#33691e": "#bf360c" :"#424242",
//           borderWidth:2,
//           color: (d.head) ? (!d.branch && !d.save && !d.commit) ? "#aed581": "#ffb300" : "#e0e0e0"
//         }
//       })),
//       links: mdata.dependencies,
//       lineStyle: {
//         color: '#37474f',
//         opacity: 0.5,
//         width:2,
//         curveness: 0
//       }
//     }
//   ]
// }