const mongodb = require("./mongodb")
const {extend, sortBy, uniq, flattenDeep, find, last, isUndefined, isNull, keys, isArray, isString, isObject} = require("lodash")
const moment = require("moment") 
const YAML = require("js-yaml")
const fs = require("fs")
const path = require("path")
const uuid = require("uuid").v4
const axios = require("axios")
const URL = require("url")

const CONFIG = YAML.load(fs.readFileSync(path.join(__dirname,`../../sync-data/.config/db/mongodb.conf.yml`)).toString().replace(/\t/gm, " "))

let expiration = 10000
let requestPool = {}


const getDatasetList = async (req, res) => {
	try {
		
		let options = req.body.options
		
		options = extend( {}, options, {
			collection: `${options.db.name}.dataset`,
			pipeline: [   
				{
					$match: {
						taged: true
					}
				},
	            {
	                $project:{ _id: 0 }
	            }
	        ] 
		})

	
		const result = await mongodb.aggregate(options)
		res.send(result)
	
	} catch (e) {
		res.send({ 
			error: e.toString(),
			requestBody: req.body
		})
	}	

}


const getTagList = async (req, res) => {
	try {

		let options = req.body.options

		let scope = (!isUndefined(options.tagScope) && !isNull(options.tagScope) && options.tagScope && options.tagScope != "null") ? [{$match:{ "name": { $regex: options.tagScope}}}] : []
		
		options = extend( {}, options, {
			collection: `${options.db.name}.taged-tags`,
			pipeline: scope.concat([   
				{
					$match: {
						enabled: true
					} 
				},
				{
	                $project:{ _id: 0 }
	            }
	        ]) 
		})

	
		const result = await mongodb.aggregate(options)
		res.send(result)
	

	} catch(e) {
		res.send({ 
			error: e.toString(),
			requestBody: req.body
		})
	}
}



const getRecords = async (req, res) => {
	try {

		let options = req.body.options

		let count = await mongodb.aggregate({
			db: options.db,
			collection: `${options.db.name}.${options.db.labelingCollection}`,
			pipeline: 	[]
						.concat(options.valueFilter)
						.concat(options.eventData.filter)
						.concat([
					        { $count: 'count'},
					        { $project: {_id: 0} }
					    ])
		}) 

		count = (count[0]) ? count[0].count || 0 : 0
	    options.eventData = extend(options.eventData, {
	        total: count,
	        pagePosition: `${options.eventData.skip+1} - ${Math.min(options.eventData.skip + options.eventData.limit, count)} from ${count}`
	    })

		let data = await mongodb.aggregate({
			db: options.db,
			collection: `${options.db.name}.${options.db.labelingCollection}`,
			pipeline: 	[]
						.concat(options.valueFilter || [])
						.concat(options.eventData.filter || [])
						.concat([
						 //  {
						 //  	$addFields:{
					  // 		  "updated at": {
							//   	$max: "$tags.createdAt"
							//   }
							// }
						 //  },	
				          {
				            '$project': {
				              '_id': 0
				            }
				          }, 
				          { 
				            $sort: (options.sort == "updated at, Z-A") 
				            	? 	{
						                "updated at": -1
						        	}
					            : 	{
						                "updated at": 1
						            }    				 
				          },
				          {
				            '$skip': options.eventData.skip
				          }, 
				          {
				            '$limit': options.eventData.limit
				          }
				        ])  
		})

		res.send({
	    	options,
	    	collection: data
	    })


	} catch(e){
		res.send({ 
			error: e.toString(),
			requestBody: req.body
		})
	}
}

const removeLastTag = async (req, res) => {
	try {

		let options = req.body.options


		// options.tags = (options.tags || []).map( t => ({
		// 	tag: t,
		// 	createdAt: new Date(),
		// 	createdBy: {
		// 		email: options.user.email,
		// 		namedAs: options.user.namedAs,
		// 		photo: options.user.photo
		// 	}
		// }))
		
		let records = await mongodb.aggregate({
			db: options.db,
			collection: `${options.db.name}.${options.db.labelingCollection}`,
			pipeline: 	[
				{ 
					$match: {
						id: {
							$in: options.records
						}
					}
				},
				{
					$project: {
						_id: 0
					}
				}	
			]
		})
		
		records.forEach( r => {
			
			r.tags = sortBy ( r.tags.map(t => {
					t.createdAt = new Date(t.createdAt)
					return t
				}), d => d.createdAt)

			
			r.tags.reverse()

			if(r.tags && r.tags.length>0 && !r.tags[0].tag.startsWith("TASK:") && !r.tags[0].tag.startsWith("SOURCE:")){
				r.tags.shift()
			}
			r["updated at"] = new Date()
			r["Stage Comment"] = "Last Tag removed."
			r["updated by"] = options.user.namedAs
		})

		const commands = records.map( r => ({
	        replaceOne:{
	            filter:{
	                id: r.id
	            },
	            replacement: extend({}, r)
	        }
	    }))

	    const result = await mongodb.bulkWrite({
	    	db: options.db,
	    	collection: `${options.db.name}.${options.db.labelingCollection}`,
	    	commands
	    })

	    res.send(result)

	} catch(e) {
		res.send({ 
			error: e.toString(),
			requestBody: req.body
		})	
	}
}

const addTags = async (req, res) => {
	try {

		let options = req.body.options


		options.tags = (options.tags || []).map( t => ({
			tag: t,
			createdAt: new Date(),
			createdBy: {
				email: options.user.email,
				namedAs: options.user.namedAs,
				photo: options.user.photo
			}
		}))
		
		let records = await mongodb.aggregate({
			db: options.db,
			collection: `${options.db.name}.${options.db.labelingCollection}`,
			pipeline: 	[
				{ 
					$match: {
						id: {
							$in: options.records
						}
					}
				},
				{
					$project: {
						_id: 0
					}
				}	
			]
		})
		
		records.forEach( r => {
			r.tags = r.tags.map(t => {
				t.createdAt = new Date(t.createdAt)
				return t
			})
			r.tags = r.tags.concat(options.tags)
			r["updated at"] = new Date()
			r["Stage Comment"] = "Tags added."
			r["updated by"] = options.user.namedAs
		})

		const commands = records.map( r => ({
	        replaceOne:{
	            filter:{
	                id: r.id
	            },
	            replacement: extend({}, r)
	        }
	    }))

	    const result = await mongodb.bulkWrite({
	    	db: options.db,
	    	collection: `${options.db.name}.${options.db.labelingCollection}`,
	    	commands
	    })

	    res.send(result)

	} catch(e) {
		res.send({ 
			error: e.toString(),
			requestBody: req.body
		})	
	}
}



const getGrants = async (req, res) => {
	try {
		
		let options = req.body.options

		options = extend( {}, options, {
			collection: `${options.db.name}.${options.db.grantCollection}`,
			pipeline: [   
	            {
	                $project:{ _id: 0 }
	            }
	        ] 
		})

	
		const result = await mongodb.aggregate(options)
		res.send(result)

	}

	 catch (e) {
		res.send({ 
			error: e.toString(),
			requestBody: req.body
		})
	}
}


const addToTask = async (req, res) => {
	try {

		
		let prodSourceEndpoint = {
			"production(US)": "https://s6uorvdusht462ycb5evujwi5y0rpmoh.lambda-url.us-east-1.on.aws/",
			"production(UA)": "https://7y7bhy6ztqgymcvo72i6zmc4ji0hthyd.lambda-url.eu-central-1.on.aws/",
			// "testing": "",
			// "demo": ""
		}

		/////////////////////////////////////////////////////////////////////////////////////////
		// check body
		let options = req.body

		options.db = CONFIG.db
		options.selector = options.selector || {}
		
		if(!options.tags || options.tags.length == 0){
			res.status(400).send(`"tags" array is required in\n${JSON.stringify(req.body, null, " ")}`)
			return
		}

		if(!isObject(options.selector)){
			res.status(400).send(`"selector" object is required in\n${JSON.stringify(req.body, null, " ")}`)
			return
		}

		// if(options.tags.filter(t => t.startsWith("SOURCE:")).length > 1){
		// 	res.status(400).send(`only one tag "SOURCE:<source name>" is required in\n${JSON.stringify(req.body, null, " ")}`)
		// 	return
		// }

		// let source = find(options.tags, t => t.startsWith("SOURCE:"))

		// if(!source) {
		// 	res.status(400).send(`tag "SOURCE:<source name>" is required in\n${JSON.stringify(req.body, null, " ")}`)
		// 	return	
		// }

		// source = last(source.split(":")).trim()

		// if(!keys(prodSourceEndpoint).includes(source)){
		// 	res.status(400).send(` unknown "SOURCE:${source}". Available sources: ${keys(prodSourceEndpoint).map(d => "'"+d+"'").join(", ")}`)
		// 	return	

		// }

		if(options.tags.filter(d => d.startsWith("TASK:")).length == 0){
			res.status(400).send(`tag "TASK:<task name>" is required in\n${JSON.stringify(req.body, null, " ")}`)
			return
		}

		options.records = options.records || []

		if(options.records.length == 0){
			res.status(400).send(`not empty "records" array is required in\n${JSON.stringify(req.body, null, " ")}`)
			return
		}
		
		
		/////////////////////////////////////////////////////////////////////////////////////////
		// update taged-records collection

		let response = {
			tags: options.tags,
			records: []
		}

		/////////////////////////////////////////////////////////////////////////////////////////
		// Process existed records

		let idSelector = eval(options.selector.id || "(d => d)")
		let pathSelector = eval(options.selector.path || "(d => null)")
		let urlSelector = eval(options.selector.url || "(d => null)")
		let patientSelector = eval(options.selector.patient || "(d => null)")
		let deviceSelector = eval(options.selector.device || "(d => null)")
		let noteSelector = eval(options.selector.note || "(d => null)")

		let existedRecords = await mongodb.aggregate({
			db: options.db,
			collection: `${options.db.name}.taged-records`,
			pipeline: 	[
				{ 
					$match: {
						id: {
							$in: options.records.map(d => idSelector(d))
						}
					}
				},
				{
					$project: {
						_id: 0
					}
				}	
			]
		})

		if(existedRecords.length > 0){
			let commands = existedRecords.map( r => {

				let addedTags = options.tags.filter(t => !t.startsWith("SOURCE:")).filter(t => !r.tags.map(t => t.tag).includes(t))
				
				response.records.push({
					id: r.id,
					status: "updated",
					reason: `Add ${addedTags.map(d => "'"+d+"'").join(", ")}`
				})
				

				addedTags = addedTags.map( t => ({
					tag: t,
					createdAt: new Date(),
					createdBy:{
						namedAs: "import utils",
						email: "",
						photo: ""
					}
				}))

				r.tags = r.tags.concat(addedTags)

				return {
			        replaceOne:{
			            filter:{
			                id: r.id
			            },
			            replacement: extend({}, r)
			        }
			    }

		    })

			
		    let result = await mongodb.bulkWrite({
		    	db: options.db,
		    	collection: `${options.db.name}.taged-records`,
		    	commands
		    })
		}    

	    //////////////////////////////////////////////////////////////////////////////////////////////////////
	    // process new record

	    let newRecords = options.records.filter( r => !existedRecords.map(d => d.id).includes(idSelector(r)))

	    if(newRecords.length == 0){
	    	res.send(response)
	    	return
	    }

	    ////////////////////////////////////////////////////////////////////////////////////////
		// get metadata from prod 
		
		let sources = keys(prodSourceEndpoint)
		let file_ids = newRecords.map( r => idSelector(r))
		let metadata = []
		for(let source of sources){
			
			let r = await axios.post(prodSourceEndpoint[source],{ file_ids })
			
			metadata = metadata.concat( r.data.map( d => {
				d.tags = [{
					tag: `SOURCE: ${source}`,
					createdAt: new Date(),
					createdBy:{
						namedAs: "import utils",
						email: "",
						photo: ""
					}
				}]
				return d
			}))
		
		}
		
		// console.log(metadata)
		////////////////////////////////////////////////////////////////////////////////////////

	    let addedTags = options.tags.map( t => ({
			tag: t,
			createdAt: new Date(),
			createdBy:{
				namedAs: "import utils",
				email: "",
				photo: ""
			}
		}))


		////////////////////////////////////////////////////////////////////////////////////////////////////////
		// TODO process AI segmentation


		////////////////////////////////////////////////////////////////////////////////////////////////////////

	    newRecords = newRecords.map( r => {
	    	let m = find(metadata, d => d.file_id == idSelector(r))

	    	if(m) {

	    		let pu = URL.parse(urlSelector(r), true)
	    		let segUrl = `${pu.protocol}//${pu.host}/?record_v3=${pu.query.record_v3}&patientId=${pu.query.patientId}&position=${m.record_body_position}&spot=${m.record_spot}&device=${pu.query.device}`
				
		    	return {
				  "id": idSelector(r),
				  "Segmentation URL": segUrl, //urlSelector(r),
				  "Examination ID": patientSelector(r),
				  	
				  	"examination_created_at": m.examination_created_at,
			        "examination_id": m.examination_id,
			        "examination_modified_at": m.examination_modified_at,
			        "examination_notes": m.examination_notes,
			        "examination_title": m.examination_title,
			        "file_created_at": m.file_created_at,


				  "Clinic": "PRODUCTION DATA",
				  "model": deviceSelector(r),
				  "deviceDescription": "unknown",
				  "Body Position": m.record_body_position,
				  "Body Spot": m.record_spot,
				  "Type of artifacts , Artifact": [],
				  "Systolic murmurs": [],
				  "Diastolic murmurs": [],
				  "Other murmurs": [],
				  "Pathological findings": [],
				  "path": pathSelector(r),
				  "state": "",
				  "CMO": "",
				  "TODO": "",
				  "updated at": new Date(),
				  "updated by": "import utils",
				  "Stage Comment": noteSelector(r) || "Added by import utils",
				  "assigned to": "",
				  "1st expert": "",
				  "2nd expert": "",
				  "Confidence": "Not Confident",
				  "nextTodo": "",
				  "complete": 0,
				  "FINALIZED": false,
				  // "segmentation": "FRON PG DB",
				  "tags": m.tags.concat(addedTags),
				  "importNote": noteSelector(r)
				}
			} else {
				return {
					id: idSelector(r),
					fails: true
				}
			}	
		})

	    newRecords.forEach( r => {
	    	response.records.push({
				id: r.id,
				status: (r.fails) ? "failed" : "created",
				reason: (r.fails) ? `Unknown record ID: ${r.id}` : `Add ${addedTags.map(d => "'"+d.tag+"'").join(", ")}`
			})
			if(r.fails){
				console.log(r.id)
			}
			
	    })

	    commands = newRecords.filter(r => !r.fails)

	    if(commands.length > 0){
	    
	    	commands = commands.map( r => {

				return {
			        replaceOne:{
			            filter:{
			                id: r.id
			            },
			            replacement: extend({}, r),
			            upsert : true
			        }
			    }

		    })

		    result = await mongodb.bulkWrite({
		    	db: options.db,
		    	collection: `${options.db.name}.taged-records`,
		    	commands
		    })
		}    

	    res.send(response)

	} catch(e) {
		res.status(503).send({ 
			error: e.toString(),
			requestBody: req.body
		})
	}
}

const exportSelection = async (req, res) => {
	try {

		let options = extend({}, req.body)
		options.db = CONFIG.db

		options.id = uuid()
		req.body.id = options.id
		options.requestedAt = new Date()
		req.body.requestedAt = options.requestedAt
		
		options.hasTags = options.hasTags || []
		options.withoutTags = options.withoutTags || []
		options.regexp = options.regexp || ""
		options.comment = options.comment || ""
		
		options.select = options.select || []

		options.download = options.download || false

		if(options.download){
			requestPool[options.id] = options
			res.send(req.body)
			return
		}

		if(!isArray(options.hasTags)){
			res.status(400).send(`"hasTags" array expected in\n${JSON.stringify(req.body, null, " ")}`)
			return
		}

		if(!isArray(options.withoutTags)){
			res.status(400).send(`"withoutTags" array expected in\n${JSON.stringify(req.body, null, " ")}`)
			return
		}

		if(!isArray(options.select)){
			res.status(400).send(`"select" array expected in\n${JSON.stringify(req.body, null, " ")}`)
			return
		}

		if(!isString(options.regexp)){
			res.status(400).send(`"regexp" string expected in\n${JSON.stringify(req.body, null, " ")}`)
			return
		}

		if(!isString(options.comment)){
			res.status(400).send(`"comment" string expected in\n${JSON.stringify(req.body, null, " ")}`)
			return
		}



		let pipeline = []

		if(options.tagScope){

			pipeline.push({
				$match:{
					"tags.tag": {
						$regex: options.tagScope
					}	
				}
			})

		}

		
		if(options.hasTags.length > 0){
			pipeline.push({
				$match:{
					"tags.tag": {
						$in: options.hasTags
					}	
				}
			})
		}

		if(options.withoutTags.length > 0){
			pipeline.push({
				$match:{
					"tags.tag": {
						$nin: options.withoutTags
					}	
				}
			})
		}
		
		if(options.regexp){
			pipeline.push({
				$match:{
					$or:[
                        {
                        	"tags.tag":{
                          		$regex: options.regexp
                        	}
                        },
                        {
                          "tags.createdBy.namedAs":{
                          		$regex: options.regexp
                        	}
                        }
                      ]
				}			
			})
		}

		if(options.comment){
			pipeline.push({
                $match:
                    {
                        $or:[
                            {
                            	"Stage Comment":{
                              	    $regex: data.comment
                            	}
                            },
                            {
                              "importNote":{
                              	    $regex: data.comment
                            	}
                            }
                          ]
                    }      
            })
        
		if(options.select.length > 0){
			
			let projection = {
				_id: 0
			}

			options.select.forEach( key => {
				projection[key] = 1
			})

			pipeline.push({
				$project: projection
			})
		}

		const response = await mongodb.aggregate({
			db: options.db,
			collection: `${options.db.name}.taged-records`,
			pipeline
		})

		
		res.send({
			query: req.body,
			data: response
		})


	} catch(e) {
		res.status(503).send({ 
			error: e.toString(),
			requestBody: req.body
		})
	}
}

const exportFile = async (req, res) => {

	try {
		
		let id = req.query.id || req.params.id
		let options = requestPool[id]
		if(!options){
			res.status(404).send()
			return
		}

		if(!isArray(options.hasTags)){
			res.status(400).send(`"hasTags" array expected in\n${JSON.stringify(req.body, null, " ")}`)
			return
		}

		if(!isArray(options.withoutTags)){
			res.status(400).send(`"withoutTags" array expected in\n${JSON.stringify(req.body, null, " ")}`)
			return
		}

		if(!isArray(options.select)){
			res.status(400).send(`"select" array expected in\n${JSON.stringify(req.body, null, " ")}`)
			return
		}

		if(!isString(options.regexp)){
			res.status(400).send(`"regexp" string expected in\n${JSON.stringify(req.body, null, " ")}`)
			return
		}

		if(!isString(options.comment)){
			res.status(400).send(`"comment" string expected in\n${JSON.stringify(req.body, null, " ")}`)
			return
		}


		let pipeline = []

		if(options.tagScope){

			pipeline.push({
				$match:{
					"tags.tag": {
						$regex: options.tagScope
					}	
				}
			})

		}

		
		if(options.hasTags.length > 0){
			pipeline.push({
				$match:{
					"tags.tag": {
						$in: options.hasTags
					}	
				}
			})
		}

		if(options.withoutTags.length > 0){
			pipeline.push({
				$match:{
					"tags.tag": {
						$nin: options.withoutTags
					}	
				}
			})
		}
		
		if(options.regexp){
			pipeline.push({
				$match:{
					$or:[
                        {
                        	"tags.tag":{
                          		$regex: options.regexp
                        	}
                        },
                        {
                          "tags.createdBy.namedAs":{
                          		$regex: options.regexp
                        	}
                        }
                      ]
				}			
			})
		}

		if(options.comment){
			pipeline.push({
                $match:
                    {
                        $or:[
                            {
                            	"Stage Comment":{
                              	    $regex: data.comment
                            	}
                            },
                            {
                              "importNote":{
                              	    $regex: data.comment
                            	}
                            }
                          ]
                    }      
            })
        


		if(options.select.length > 0){
			
			let projection = {
				_id: 0
			}

			options.select.forEach( key => {
				projection[key] = 1
			})

			pipeline.push({
				$project: projection
			})
		}

		const response = await mongodb.aggregate({
			db: options.db,
			collection: `${options.db.name}.taged-records`,
			pipeline
		})

		delete options.db

		res.setHeader('Content-disposition', `attachment; filename=${id}.json`);
  		res.setHeader('Content-type', "application/json");

		res.send({
			query: options,
			data: response
		})

		delete requestPool[id]

	} catch(e) {

		res.status(503).send({ 
			error: e.toString(),
			requestBody: req.body
		})

	}	
}


const getSegmentation = async (req, res) => {
	try {

		let options = req.body.options

		let data = await mongodb.aggregate({
			db: options.db,
			collection: `${options.db.name}.segmentation-history`,
			pipeline: [
				{
					$match:{
						collection: options.db.labelingCollection,
						recordId: options.recordId
					}
				},
				{
					$sort: {
						updatedAt: -1
					}
				},
				{
					$project:{
						_id: 0
					}
				}
			]
		})	
		
		res.send(data)

	} catch(e) {

		res.status(503).send({ 
			error: e.toString(),
			requestBody: req.body
		})

	}
}

	
module.exports = {
	getDatasetList,
	getGrants,
	getRecords,
	getTagList,
	addTags,
	removeLastTag,
	addToTask,
	exportSelection,
	exportFile,
	getSegmentation
}




// ///////////////////////////////////////////////////////////////////////////////////////////////////



// window.addEventListener('focus', e => { this.emit("page-focus") } ) 
// window.addEventListener('blur', e => { this.emit("page-blur") } ) 
// window.addEventListener('pageshow', e => { this.emit("page-show") } ) 
// window.addEventListener('pagehide',  e => { this.emit("page-hide") } ) 



// window.app = {
//     currentDataset: window.localStorage.getItem("jace__currentTagedDataset") || "Taged records",
//     users: [],
//     currentData:[],
//     filterView:null,
//     selection:[],
//     activeTab: null,
//     lock: true,
//     filter: {}
// }


// const errorWidget = selectWidgets("ypxiunkool")
// errorWidget.hide()

// const showError = error => {
//     const data =
//     `
//     <div  class="error--text my-5">
//         <div class="display-1 pb-3">
//             <center>
//                 Examination Medical Docs
//             </center>
//         </div>
//         <div class="title pb-3">
//             <center>
//                 <i class="mdi mdi-alert-outline pr-2"></i>Incorrect usage
//             </center>
//         </div>
//         <div class="subtitle-2 font-weight-light">
//             <center>
//                 ${error}
//             </center>
//         </div>
//     </div>
//     `
//     setTimeout(() => {
//         errorWidget.expand()
//         errorWidget.show()
//         errorWidget.update({data})
//     })
// }

// window.app.showEndMessage = message => {
//     const data =
//     `
//     <div  class="success--text my-5">
//         <div class="display-1 pb-3">
//             <center>
//                 Heart Harvest 1 Labeling Form
//             </center>
//         </div>
//         <div class="subtitle-2 font-weight-light">
//             <center>
//                 ${message}
//             </center>
//         </div>
//     </div>
//     `
    
//     this.emit("collapse-all",{ignore:["d7lapkjp5s9"]})
    
//     setTimeout(() => {
//         errorWidget.expand()
//         errorWidget.show()
//         errorWidget.update({data})
//     })
// }



// window.app.userInfo = d => {
//     if(!d) {
//         return {
//             name: "N/A",
//             photo: "",
//             email: ""
//         }
//     }    
    
//     d = _.isArray(d) ? d : [d]
//     let length = d.length
//     d = (length == 1) ? d[0] : d.join(", ")
    
//     let u = _.find(window.app.users, u => [u.name, u.namedAs].includes(d))

//     u = (u) 
//         ? {
//             name: d,
//             photo: u.photo,
//             email: u.email,
//             icon: (length > 1) ? "mdi-account-group-outline" : "mdi-account-circle-outline"
//         }    
//         : {
//             name: d,
//             photo:"",
//             email:"",
//             icon: (length > 1) ? "mdi-account-group-outline" : "mdi-account-circle-outline"
//         }
//     return u    
// }

// window.app.userShortAvatar = d => {
//     let u = window.app.userInfo(d)
//     return {
//         component:   {
//             "type": "avatar",
//             "decoration": {
//               "src": u.photo,
//               "icon": "mdi-account-circle-outline",
//               "style": "padding:0 10px;",
//               "classes": "flex",
//               "size": 32,
//               "subTitle": u.name
//             }
//         }
//     }
// }


// const colorPalette = [
// 			"#1b9e77",
// 			"#d95f02",
// 			"#7570b3",
// 			"#e7298a",
// 			"#66a61e",
// 			"#e6ab02",
// 			"#a6761d",
// 			"#666666"
// 		]

// colorPalette.reverse()

// const legendData = [
      
//       {
//         name: "Assign 2nd expert",
//         color:"#9e9e9e"
//       },
//       {
//         name: "Assign 1st expert",
//         color:"#a1887f"
//       },
//       {
//         name: "Continue Labeling",
//         color:"#e6ab02"
//       },
//       {
//         name: "Resolve 1st Stage Rejection",
//         color:"#ff5722"
//       },
//       {
//         name: "Complete 2nd Stage",
//         color:"#66a61e"
//       },
//       {
//         name: "Resolve 2nd Stage Rejection",
//         color:"#d32f2f"
//       },
//       {
//         name: "Complete Labeling",
//         color:"#1e88e5"
//       },
//       {
//         name: "Finalized",
//         color:"#7570b3"
//       }
//     ]


// window.app.getStatChart = data => {
    
//     if(!data) return {}
    
//     let visualData = legendData.map( d => {
//         let f = _.find(data.stat, s => s.name == d.name)
//         return {
//             name: d.name,
//             value: (f) ? f.value : 0,
//             itemStyle:{
//                 color: d.color
//             }    
//         }
//     }).filter( d => d.value > 0)
    
//     let l = legendData.filter( l => _.find(visualData, v => v.name == l.name))
    
//     let chart = {
//         title:{
//     text: data.total,
//     left:"center",
//     top:"63%",
//     textStyle:{
//       color: "#7e7e7e",
//       fontSize:24
//     }
//   },
//    legend: {
//     top: '0%',
//     left: '2%',
//     orient:"vertical",
//     itemGap: 2,
//     itemHeight: 10,
//     data: l.map( d => ({name: d.name}))
//   },
//     "series": [
//         {
//             "type": "pie",
//             "radius": [
//                 "30%",
//                 "40%"
//             ],
//             color:"data",
//             center:[
//               "50%",
//               "68%"
//             ],
//             "itemStyle": {
//                 "borderRadius": 5,
//                 "borderColor": "#fff",
//                 "borderWidth": 2
//             },
//             "label": {
//                 "show": true,
//                 edgeDistance: 5,
//                 // "position": "center",
//                 "formatter": "{b|{c}}",
//                 rich:{
//                   a: {
//                     width:20,
//                     fontSize:8,
//                     align: 'center'
//                   },
//                   b:{
//                     fontSize:12,
//                     color: "#7e7e7e",
//                     fontWeight:600,
//                     align: 'center'
//                   }
//                 }
//             },
//             emphasis: {
//               label: {
//                 show: true,
//                 fontSize: 64,
//                 fontWeight: 'bold',
//                 color: "#757575"
//               }
//             },
//             labelLine: {
//               show: true
//             },
//            data: visualData
//         }
//     ]
// }
//     return chart
// }

// window.app.getStatBar = data => {
    
//     if(!data) return {}
    
//     let visualData = legendData.map( d => {
//         let f = _.find(data.stat, s => s.name == d.name)
//         return {
//             name: d.name,
//             value: (f) ? f.value : 0,
//             itemStyle:{
//                 color: d.color
//             }    
//         }
//     }).filter( d => d.value > 0)
    
//     let l = legendData.filter( l => _.find(visualData, v => v.name == l.name))
    
    
    
//     let chart = {
//         grid: {
//             left: 0,
//             right: 0,
//             top:"auto",
//             bottom:"auto",
//             height: 24,
//         },
//         tooltip: {
//             trigger: 'axis',
//             axisPointer: {
//               // Use axis to trigger tooltip
//               type: 'shadow' // 'shadow' as default; can also be 'line' or 'shadow'
//             }
//         },
//         xAxis: {
//             type: 'value',
//             show: false
//           },
//         yAxis: {
//             type: 'category',
//             show: false
//         },
//         series: visualData.map( v => {
//             v.type = "bar"
//             v.stack = "total"
            
//             v.barWidth = 8
//             v.barCategoryGap = 0
//             v.barGap = 0
            
//             v.label = {
//                 show: true,
//                 position:"top",
//                 formatter: d => (d.data == 0) ? "" : d.data,
//                 fontSize: 10,
//                 fontWeight: "bold",
//                 color:"#7d7d7d",
//                 distance: -2
//             }
//             v.itemStyle = _.extend({}, v.itemStyle, {
//                 borderWidth:1,
//                 borderColor:"#ffffff",
//                 borderRadius: 5
//             })
//             v.emphasis= {
//                 focus: 'series'
//             } 
//             v.data = [v.value]
//             return v   
//         })
//     }    
//     // console.log(chart)
//     return chart
// }


// window.getDiagnosisTags = () => {
    
//     if( !window.app.form || !window.app.form.patient || !window.app.form.patient.diagnosisTags || !window.app.form.patient.diagnosisTags.tags) return '<div></div>'
//     let tags = `
//     <ul class="caption" style="line-height:0.9;">
//         ${window.app.form.patient.diagnosisTags.tags.map( t => '<li>'+t+'</li>')}
//     </ul>
//     <br>
//     <span class="caption pl-2" style="line-height:0.9;"> ${(window.app.form.patient.diagnosisTags.comment) ? "Comment: "+ window.app.form.patient.diagnosisTags.comment: ""}</span>
//     `
    
//     return tags
    
// }


//     const scripts = {
//         GET_DATASET_LIST : "./api/controller/pr/get-dataset-list/",
//         GET_GRANTS : "./api/controller/pr/get-grants/",
//         GET_EVENTS : "./api/controller/pr/get-events/",
//         GET_TEAM : "./api/controller/pr/get-team/",
//         GET_STAT : "./api/controller/pr/get-stat/",
//         GET_FORMS : "./api/controller/pr/get-forms/",
//         GET_AVAILABLE_VALUES : "./api/controller/pr/get-available-values/",
//         GET_TAG_LIST : "./api/controller/pr/get-tag-list/",
        
//     }
    
//     const getScript = name => scripts[name]
    
//     const runRemote = async (url, data) => {
//         let res = await axios({
//             method:"POST",
//             url,
//             data
//         })
//         return res
//     }


   
    
// const loadDatasetMetadata = async () => {
//     const options = {
//         db:{
//             url: "mongodb+srv://jace:jace@jace.llb8spm.mongodb.net/?retryWrites=true&w=majority",
//             name: "sparrow"
//         }
//     }
//     let response = await runRemote(getScript("GET_DATASET_LIST"), { options })
//     return response.data
// }





// const bootstrap = async () => {
    
//     console.log("bootstrap")
    

    
//     let datasets = await loadDatasetMetadata()
//     console.log("datasets", datasets)
    
//     window.app.availableDatasets = datasets.map( d => d.name)
    
//     const DB_SETTINGS = _.find(datasets, d => d.name == window.app.currentDataset).settings
    
//     window.app.config = _.extend({}, DB_SETTINGS )
    
//     const showTableLoading = () => {
//         setTimeout(() => {
//             selectWidgets("3qtce5ji2p6").getInstance().options.decoration.loading = true
//         }, 10)
//     }

//     const hideTableLoading = () => {
//         setTimeout(() => {
//             selectWidgets("3qtce5ji2p6").getInstance().options.decoration.loading = false
//         }, 10)
//     }
    
//     const showInTable = data => {
//         setTimeout(() => {
//             data = _.extend(data, { selection: window.app.dataSelection} )
//             selectWidgets("3qtce5ji2p6").update({ data }, { override: "options.data" })
//         }, 10)
//     }
    
//     const updatePagination = data => {
//         // console.log("update pagination", data)
//         setTimeout(() => {
//             selectWidgets("29pvnidmjo6").update({ data }, { override: "options.data" })
//         }, 50)
//     }
    
//     const selectionCriteria = selectWidgets("r42llwt1qnh")

//     const loadTagList = async patientId => {
        
//         let response = await runRemote(getScript("GET_TAG_LIST"), {options: window.app.config})
//         window.app.tags = response.data
        
//         window.app.filter = {
//             tags: window.app.tags,
//             withoutTags: false,
//             hasTags: false,
//             hasText: false,
//             sort: "Updated at, Z-A"
//         }

//         selectionCriteria.update({data: window.app}, {override:"options.data"})
//     }

    
//     const buildValueQuery = data => {
//         if(!data) return []
    
//         let res = []
        
//         if(data.includeTags && data.includeTags.length > 0){
//             res.push({
//                 $match:{
//                     "tags.tag":{
//                         $in: data.includeTags
//                     }
//                 }
//             })
//         }
        
//         if(data.excludeTags && data.excludeTags.length > 0){
//             res.push({
//                 $match:{
//                     "tags.tag":{
//                         $nin: data.excludeTags
//                     }
//                 }
//             })
//         }

//         return res
//     }
    
    
    
//     const loadData = async () => {
//         showTableLoading()
//         let options = window.app.options
        
//         let todoFilter = []
//         if(window.app.currentView == "Latest Updates") {
//             options.latest = true
//             window.app.config.customFilter = []
//         } else {
//             options.latest = false
//         }
        
//         options.valueFilter = buildValueQuery(window.app.filter)
            
//         options.eventData.filter = todoFilter.concat(window.app.config.customFilter || [])
        
//         let response = await runRemote(getScript("GET_EVENTS"), { options })
        
//         window.app.options = response.data.options
        
//         window.app.currentData = response.data.collection 
        
        
//         let collection = window.app.currentData.map((d, index) => {
    
//             _.keys(rowTemplate).forEach(key => {
//                 d[key] = rowTemplate[key](d, index)
//             })
            
//             return d
//         })
        
//         showInTable({
//             header,
//             collection
//         })
        
//         updatePagination(window.app.options.eventData)
//         hideTableLoading()
//     }


//     const loadGrants = async () => {
//         let options = window.app.options 
//         let response = await runRemote(getScript("GET_GRANTS"), {options})
//         return response.data 
//     }
        
//     const detectChanges = (a,b) => {
//         if(!a || !b) return false
//         let res = true
//         res &= a.total == b.total
//         a.stat.forEach( d => {
//             let f = _.find(b.stat,  r => d.name == r.name)
//             res &= (f) ? (d.value == f.value) : false
//         })
//         return !res
//     }    

//     const getUserList = async () => {
//         let grants = await loadGrants()
//         let response = await axios.get("./api/users/list")
//         let users = response.data
//         window.app.users = grants.map( g => _.extend(_.find(users, u => g.email.includes(u.email)), g))
//     }

//     const normalizeRole = () => {
                
//         let worker = _.find( window.app.users, d => d.email.includes(user.email))
//             if( worker ){
//                 user.altname = worker.namedAs
//                 user.role= worker.role
//                 user.namedAs = worker.namedAs
//             } else {
//                 user.altname = user.name
//                 user.role = "Reader"
//             }
//     }

//     let header = [
//         "No",
//         "id",
//         "spot",
//         "tag count",
//         "last tag",
//         "updated by",
//         "updated at",
//     ]
    
//     const strong = (data, color) => ({
//         html: `<div class="caption font-weight-bold" style="line-height:0.9; color: ${color || ""}">${data}</div>`
//     })
    
//     const formatDate = d => {
//         return {html: `<div class="caption" style="line-height:0.9">${moment(new Date(d)).format("MMM DD, YY HH:mm")}</div>`}
//     }    
    
//     const spot = (d, index) => ({
//         html: `<div class="caption font-weight-bold" style="line-height:0.9;">
//                     ${d["Body Spot"]}
//                     </div>`
//     })
    
    
//     const avt = d => {
        
//         if(!d) return ""
        
//         return {
//             component:   {
//                 "type": "avatar",
//                 "decoration": {
//                   "src": d.photo,
//                   "icon": "mdi-account-circle-outline",
//                   "style": "padding:0 10px;",
//                   "classes": "flex",
//                   "size": 32,
//                   "subTitle": d.namedAs
//                 }
//             }
//         }
//     }
    
//     const numbers = (d, index) => window.app.options.eventData.skip+1+index

//     let rowTemplate = { 
//         "No": numbers,
//         "spot": spot,
//         "tag count": d => d.tags.length,
//         "last tag": d => {
//             let t = _.sortBy(d.tags, t => t.createdAt)[0]
//             return (t) ? strong(t.tag) : ""
//         },
//         "updated at": d => {
//             let t = _.sortBy(d.tags, t => t.createdAt)[0]
//             return (t) ? formatDate(t.createdAt) : ""
//         },
//     }
    
    
    

    
// //     ///////////////////////////////////////////////////////////////
    
//     this.on({
//         event: "set-limit",
//         callback: async (sender, data) => {
//             if (window.app.options.eventData.prevLimit != data) {
//                 window.app.options.eventData.prevLimit = data || 50
//                 // window.app.options.eventData.limit = data || 10
//                 if(!window.app.lock){
//                     await loadData()    
//                 }
                
//             }
//         }
//     })
    
//     this.on({
//         event: "prev-page",
//         callback: async (sender, data) => {
//             let options = window.app.options
//             let skip = options.eventData.skip - options.eventData.limit
//             skip = (skip < 0) ? 0 : skip
//             if( skip != options.eventData.skip ){
//                 options.eventData.skip = skip
//                 await loadData()    
//             }
//         }
//     })
    
//     this.on({
//         event: "next-page",
//         callback: async (sender, data) => {
//             let options = window.app.options
//             if(options.eventData.skip + options.eventData.limit > options.eventData.total) return
//             let skip = options.eventData.skip + options.eventData.limit
//                 options.eventData.skip = skip
//                 await loadData()    
//         }
//     })
    
    
//     this.on({
//         event: "first-page",
//         callback: async (sender, data) => {
//             window.app.options.eventData.skip = 0
//                 if(!window.app.lock) {
//                     await loadData()
//                 }    
//         }
//     })
    
//     this.on({
//         event: "last-page",
//         callback: async (sender, data) => {
//             window.app.options.eventData.skip = Math.trunc(window.app.options.eventData.total/window.app.options.eventData.limit)*window.app.options.eventData.limit
//                 if(!window.app.lock) {
//                     await loadData()
//                 }    
//         }
//     })
    

// ////////////////////////////////////////////////////////////////////////////////////////////////////////    

//     this.on({
//         event: "change-has-tags",
//         callback:(sender,data) => {
//             window.app.filter.hasTags = data
//             setTimeout(() => {
//                 selectionCriteria.update({data: window.app}, {override : "options.data"})
//             }, 20)    
//         }
//     })
    
//     this.on({
//         event: "filter-any-tags",
//         callback: () => {
    
//             window.app.filter.includeTags = window.app.tags.map(d=> d.name)
//             setTimeout(() => {
//                 selectionCriteria.update({data: window.app}, {extend:"options.data"})
//             }, 20)
//         }
//     })
    
//     this.on({
//         event: "clear-filter-tags",
//         callback: () => {
    
//             window.app.filter.includeTags = []
//             setTimeout(() => {
//                 selectionCriteria.update({data: window.app}, {extend:"options.data"})
//             }, 20)
//         }
//     })
    
//     this.on({
//         event: "change-filter-tags",
//         callback: (sender, data) => {
//             window.app.filter.includeTags = data
//         }
//     })


// ////////////////////////////////////////////////////////////////////////////////////////////////////////
    
//     this.on({
//         event: "change-has-etags",
//         callback:(sender,data) => {
//             window.app.filter.withoutTags = data
//             setTimeout(() => {
//                 selectionCriteria.update({data: window.app}, {override : "options.data"})
//             }, 20)    
//         }
//     })
    
//     this.on({
//         event: "filter-any-etags",
//         callback: () => {
    
//             window.app.filter.excludeTags = window.app.tags.map(d=> d.name)
//             setTimeout(() => {
//                 selectionCriteria.update({data: window.app}, {extend:"options.data"})
//             }, 20)
//         }
//     })
    
//     this.on({
//         event: "clear-filter-etags",
//         callback: () => {
    
//             window.app.filter.excludeTags = []
//             setTimeout(() => {
//                 selectionCriteria.update({data: window.app}, {extend:"options.data"})
//             }, 20)
//         }
//     })
    
//     this.on({
//         event: "change-filter-etags",
//         callback: (sender, data) => {
//             window.app.filter.excludeTags = data
//         }
//     })


// ////////////////////////////////////////////////////////////////////////////////////////////////////////
    
    
//     this.on({
//         event: "apply-data-filter",
//         callback: async sender => {
//             // console.log(window.app.currentView, sender.title)
//             if(window.app.currentView != sender.title){
//                 window.app.currentView = sender.title
//                 if(sender.title == "My Labelings"){
//                     window.app.config.customFilter = [{$match: {"assigned to": user.namedAs}}]
//                 } else {
//                     window.app.config.customFilter = []
//                 }
                
//                 await loadData()   
//             }
//         }
//     })
    
    
//      this.on({
//         event:"page-focus",
//         callback: async () => {
//                 await loadData()
//                 // await loadForms()
//         }
//     })
   
    
    
//     this.on({
//         event: "apply-tag-filter",
//         callback:async () => {
//             // window.app.config.valueFilter = buildCustomQuery(valueFilterView)
//             // console.log("LOAD APPLY-FILTER")
//             // console.log(selectWidgets("fx4qoikasjg"))
//             window.app.options.eventData.skip = 0
//             await loadData()
//         }
//     })

// //     //////////////////////////////////////////////////////////////
    
//     window.app.loader.set({
//         message: "TAGED RECORDS: Load metadata ..."
//     })
    
    
    
//     window.app.options = {
//         db: window.app.config.db,
//         id: window.app.config.id,
//         eventData: {
//             total: 0,
//             skip: 0,
//             limit: 50
//         },
//     }
    
//     window.app.currentView = "Latest Updates"
    
//     console.log("START with options", window.app.options)
    
//     await getUserList()
    
//     normalizeRole()
    
//     window.app.config.customFilter = [{$match: {"assigned to": user.namedAs}}]
	

// 	window.app.loader.set({
//         message: "TAGED RECORDS: Load dataset ..."
//     })
    
// 	window.app.lock = true
// 	await loadTagList()
// 	await loadData()
//     this.emit("expand-all",{ignore:["25klmtcysbm"]})
//     this.emit("start")
    

//     setTimeout(() => {
//         window.app.lock = false
//     }, 1000)
    
//     window.app.loader.cancel()
    
// }




//         // if( !user.isLoggedIn ){

//         //     this.$djvue.login()

//         // } else {
    
//             bootstrap()
            
//         // }
    






///////////////////////////////////////////////////////////////////////////////////////////////////



// window.addEventListener('focus', e => { this.emit("page-focus") } ) 
// window.addEventListener('blur', e => { this.emit("page-blur") } ) 
// window.addEventListener('pageshow', e => { this.emit("page-show") } ) 
// window.addEventListener('pagehide',  e => { this.emit("page-hide") } ) 



// window.app = {
//     type: "list",
//     currentDataset: window.localStorage.getItem("jace__currentTagedDataset") || "Taged records",
//     users: [],
//     currentData:[],
//     filterView:null,
//     selection:[],
//     activeTab: null,
//     lock: true,
//     filter: {
//         sort: "updated at, Z-A"
//     }
// }


// const errorWidget = selectWidgets("ypxiunkool")
// errorWidget.hide()

// const showError = error => {
//     const data =
//     `
//     <div  class="error--text my-5">
//         <div class="display-1 pb-3">
//             <center>
//                 Examination Medical Docs
//             </center>
//         </div>
//         <div class="title pb-3">
//             <center>
//                 <i class="mdi mdi-alert-outline pr-2"></i>Incorrect usage
//             </center>
//         </div>
//         <div class="subtitle-2 font-weight-light">
//             <center>
//                 ${error}
//             </center>
//         </div>
//     </div>
//     `
//     setTimeout(() => {
//         errorWidget.expand()
//         errorWidget.show()
//         errorWidget.update({data})
//     })
// }

// window.app.showEndMessage = message => {
//     const data =
//     `
//     <div  class="success--text my-5">
//         <div class="display-1 pb-3">
//             <center>
//                 Heart Harvest 1 Labeling Form
//             </center>
//         </div>
//         <div class="subtitle-2 font-weight-light">
//             <center>
//                 ${message}
//             </center>
//         </div>
//     </div>
//     `
    
//     this.emit("collapse-all",{ignore:["d7lapkjp5s9"]})
    
//     setTimeout(() => {
//         errorWidget.expand()
//         errorWidget.show()
//         errorWidget.update({data})
//     })
// }



// window.app.userInfo = d => {
//     if(!d) {
//         return {
//             name: "N/A",
//             photo: "",
//             email: ""
//         }
//     }    
    
//     d = _.isArray(d) ? d : [d]
//     let length = d.length
//     d = (length == 1) ? d[0] : d.join(", ")
    
//     let u = _.find(window.app.users, u => [u.name, u.namedAs].includes(d))

//     u = (u) 
//         ? {
//             name: d,
//             photo: u.photo,
//             email: u.email,
//             icon: (length > 1) ? "mdi-account-group-outline" : "mdi-account-circle-outline"
//         }    
//         : {
//             name: d,
//             photo:"",
//             email:"",
//             icon: (length > 1) ? "mdi-account-group-outline" : "mdi-account-circle-outline"
//         }
//     return u    
// }

// window.app.userShortAvatar = d => {
//     let u = window.app.userInfo(d)
//     return {
//         component:   {
//             "type": "avatar",
//             "decoration": {
//               "src": u.photo,
//               "icon": "mdi-account-circle-outline",
//               "style": "padding:0 10px;",
//               "classes": "flex",
//               "size": 32,
//               "subTitle": u.name
//             }
//         }
//     }
// }


// const colorPalette = [
// 			"#1b9e77",
// 			"#d95f02",
// 			"#7570b3",
// 			"#e7298a",
// 			"#66a61e",
// 			"#e6ab02",
// 			"#a6761d",
// 			"#666666"
// 		]

// colorPalette.reverse()

// const legendData = [
      
//       {
//         name: "Assign 2nd expert",
//         color:"#9e9e9e"
//       },
//       {
//         name: "Assign 1st expert",
//         color:"#a1887f"
//       },
//       {
//         name: "Continue Labeling",
//         color:"#e6ab02"
//       },
//       {
//         name: "Resolve 1st Stage Rejection",
//         color:"#ff5722"
//       },
//       {
//         name: "Complete 2nd Stage",
//         color:"#66a61e"
//       },
//       {
//         name: "Resolve 2nd Stage Rejection",
//         color:"#d32f2f"
//       },
//       {
//         name: "Complete Labeling",
//         color:"#1e88e5"
//       },
//       {
//         name: "Finalized",
//         color:"#7570b3"
//       }
//     ]


// window.app.getStatChart = data => {
    
//     if(!data) return {}
    
//     let visualData = legendData.map( d => {
//         let f = _.find(data.stat, s => s.name == d.name)
//         return {
//             name: d.name,
//             value: (f) ? f.value : 0,
//             itemStyle:{
//                 color: d.color
//             }    
//         }
//     }).filter( d => d.value > 0)
    
//     let l = legendData.filter( l => _.find(visualData, v => v.name == l.name))
    
//     let chart = {
//         title:{
//     text: data.total,
//     left:"center",
//     top:"63%",
//     textStyle:{
//       color: "#7e7e7e",
//       fontSize:24
//     }
//   },
//    legend: {
//     top: '0%',
//     left: '2%',
//     orient:"vertical",
//     itemGap: 2,
//     itemHeight: 10,
//     data: l.map( d => ({name: d.name}))
//   },
//     "series": [
//         {
//             "type": "pie",
//             "radius": [
//                 "30%",
//                 "40%"
//             ],
//             color:"data",
//             center:[
//               "50%",
//               "68%"
//             ],
//             "itemStyle": {
//                 "borderRadius": 5,
//                 "borderColor": "#fff",
//                 "borderWidth": 2
//             },
//             "label": {
//                 "show": true,
//                 edgeDistance: 5,
//                 // "position": "center",
//                 "formatter": "{b|{c}}",
//                 rich:{
//                   a: {
//                     width:20,
//                     fontSize:8,
//                     align: 'center'
//                   },
//                   b:{
//                     fontSize:12,
//                     color: "#7e7e7e",
//                     fontWeight:600,
//                     align: 'center'
//                   }
//                 }
//             },
//             emphasis: {
//               label: {
//                 show: true,
//                 fontSize: 64,
//                 fontWeight: 'bold',
//                 color: "#757575"
//               }
//             },
//             labelLine: {
//               show: true
//             },
//            data: visualData
//         }
//     ]
// }
//     return chart
// }

// window.app.getStatBar = data => {
    
//     if(!data) return {}
    
//     let visualData = legendData.map( d => {
//         let f = _.find(data.stat, s => s.name == d.name)
//         return {
//             name: d.name,
//             value: (f) ? f.value : 0,
//             itemStyle:{
//                 color: d.color
//             }    
//         }
//     }).filter( d => d.value > 0)
    
//     let l = legendData.filter( l => _.find(visualData, v => v.name == l.name))
    
    
    
//     let chart = {
//         grid: {
//             left: 0,
//             right: 0,
//             top:"auto",
//             bottom:"auto",
//             height: 24,
//         },
//         tooltip: {
//             trigger: 'axis',
//             axisPointer: {
//               // Use axis to trigger tooltip
//               type: 'shadow' // 'shadow' as default; can also be 'line' or 'shadow'
//             }
//         },
//         xAxis: {
//             type: 'value',
//             show: false
//           },
//         yAxis: {
//             type: 'category',
//             show: false
//         },
//         series: visualData.map( v => {
//             v.type = "bar"
//             v.stack = "total"
            
//             v.barWidth = 8
//             v.barCategoryGap = 0
//             v.barGap = 0
            
//             v.label = {
//                 show: true,
//                 position:"top",
//                 formatter: d => (d.data == 0) ? "" : d.data,
//                 fontSize: 10,
//                 fontWeight: "bold",
//                 color:"#7d7d7d",
//                 distance: -2
//             }
//             v.itemStyle = _.extend({}, v.itemStyle, {
//                 borderWidth:1,
//                 borderColor:"#ffffff",
//                 borderRadius: 5
//             })
//             v.emphasis= {
//                 focus: 'series'
//             } 
//             v.data = [v.value]
//             return v   
//         })
//     }    
//     // console.log(chart)
//     return chart
// }


// window.getDiagnosisTags = () => {
    
//     if( !window.app.form || !window.app.form.patient || !window.app.form.patient.diagnosisTags || !window.app.form.patient.diagnosisTags.tags) return '<div></div>'
//     let tags = `
//     <ul class="caption" style="line-height:0.9;">
//         ${window.app.form.patient.diagnosisTags.tags.map( t => '<li>'+t+'</li>')}
//     </ul>
//     <br>
//     <span class="caption pl-2" style="line-height:0.9;"> ${(window.app.form.patient.diagnosisTags.comment) ? "Comment: "+ window.app.form.patient.diagnosisTags.comment: ""}</span>
//     `
    
//     return tags
    
// }


//     const scripts = {
//         GET_DATASET_LIST : "./api/controller/pr/get-dataset-list/",
//         GET_GRANTS : "./api/controller/pr/get-grants/",
//         GET_EVENTS : "./api/controller/pr/get-events/",
//         GET_TEAM : "./api/controller/pr/get-team/",
//         GET_STAT : "./api/controller/pr/get-stat/",
//         GET_FORMS : "./api/controller/pr/get-forms/",
//         GET_AVAILABLE_VALUES : "./api/controller/pr/get-available-values/",
//         GET_TAG_LIST : "./api/controller/pr/get-tag-list/",
//         ADD_TAGS : "./api/controller/pr/add-tags/",
        
//     }
    
//     const getScript = name => scripts[name]
    
//     const runRemote = async (url, data) => {
//         let res = await axios({
//             method:"POST",
//             url,
//             data
//         })
//         return res
//     }


   
    
// const loadDatasetMetadata = async () => {
//     const options = {
//         db:{
//             url: "mongodb+srv://jace:jace@jace.llb8spm.mongodb.net/?retryWrites=true&w=majority",
//             name: "sparrow"
//         }
//     }
//     let response = await runRemote(getScript("GET_DATASET_LIST"), { options })
//     return response.data
// }





// const bootstrap = async () => {
    
//     console.log("bootstrap")
    

    
//     let datasets = await loadDatasetMetadata()
//     console.log("datasets", datasets)
    
//     window.app.availableDatasets = datasets.map( d => d.name)
    
//     const DB_SETTINGS = _.find(datasets, d => d.name == window.app.currentDataset).settings
    
//     window.app.config = _.extend({}, DB_SETTINGS )
    
//     const showTableLoading = () => {
//         setTimeout(() => {
//             selectWidgets("3qtce5ji2p6").getInstance().options.decoration.loading = true
//         }, 10)
//     }

//     const hideTableLoading = () => {
//         setTimeout(() => {
//             selectWidgets("3qtce5ji2p6").getInstance().options.decoration.loading = false
//         }, 10)
//     }
    
//     const showInTable = data => {
//         setTimeout(() => {
//             data = _.extend(data, { selection: window.app.dataSelection} )
//             selectWidgets("3qtce5ji2p6").update({ data }, { override: "options.data" })
//         }, 10)
//     }
    
//     const updatePagination = data => {
//         // console.log("update pagination", data)
//         setTimeout(() => {
//             selectWidgets("29pvnidmjo6").update({ data }, { override: "options.data" })
//         }, 50)
//     }
    
//     const selectionCriteria = selectWidgets("mdx3cylnst")
//     const commandPanel = selectWidgets("uqjhoy35dq")
//     const userPanel = selectWidgets("cp4zeine4kj")
//     const scopePanel = selectWidgets("r42llwt1qnh")
    
//     const loadTagList = async tagScope => {
//         let response = await runRemote(getScript("GET_TAG_LIST"), {options: _.extend({}, window.app.config, {tagScope}) })
//         window.app.tags = response.data
//         window.app.tags.forEach(t => {
//             t.rule = eval(t.rule || ( () => true) )
//         })
        
//         window.app.availableTags = window.app.tags.filter( t => t.rule(user, window.app.type))
        
        
//         window.app.filter = {
//             tags: window.app.tags,
//             withoutTags: false,
//             hasTags: false,
//             hasText: false,
//             sort: "updated at, Z-A"
//         }
        
//         await loadData()
//         selectionCriteria.update({data: window.app}, {override:"options.data"})
//         commandPanel.update({data: window.app}, {override:"options.data"})
//         userPanel.update({data: window.app}, {override:"options.data"})
//         scopePanel.update({data: window.app}, {override:"options.data"})
//     }
    
//     const addTags = async options => {
        
//         let response = await runRemote(getScript("ADD_TAGS"), {options: _.extend({}, window.app.config, options, {user})})
//         await loadData()
    
        
//     }

    
//     const buildValueQuery = data => {
//         if(!data) return []
    
//         let res = []
        
//         if(data.hasTags && data.includeTags && data.includeTags.length > 0){
//             res.push({
//                 $match:{
//                     "tags.tag":{
//                         $in: data.includeTags
//                     }
//                 }
//             })
//         }
        
//         if(data.withoutTags && data.excludeTags && data.excludeTags.length > 0){
//             res.push({
//                 $match:{
//                     "tags.tag":{
//                         $nin: data.excludeTags
//                     }
//                 }
//             })
//         }
        
//         if(data.hasText && data.search){
//             res.push({
//                 $match:{
//                     "tags.tag":{
//                         $regex: data.search
//                     }
//                 }
//             })
//         }

//         return res
//     }
    
    
    
//     const loadData = async () => {
//         showTableLoading()
//         let options = window.app.options
        
//         let todoFilter = []
//         if(window.app.currentView == "Latest Updates") {
//             options.latest = true
//             window.app.config.customFilter = []
//         } else {
//             options.latest = false
//         }
        
//         options.valueFilter = buildValueQuery(window.app.filter)
//         options.sort = window.app.filter.sort
            
//         options.eventData.filter = todoFilter.concat(window.app.config.customFilter || [])
        
//         let response = await runRemote(getScript("GET_EVENTS"), { options })
        
//         window.app.options = response.data.options
        
//         window.app.currentData = response.data.collection 
        
        
//         let collection = window.app.currentData.map((d, index) => {
    
//             _.keys(rowTemplate).forEach(key => {
//                 d[key] = rowTemplate[key](d, index)
//             })
            
//             return d
//         })
        
//         showInTable({
//             header,
//             collection
//         })
        
//         updatePagination(window.app.options.eventData)
//         hideTableLoading()
//     }


//     const loadGrants = async () => {
//         let options = window.app.options 
//         let response = await runRemote(getScript("GET_GRANTS"), {options})
//         return response.data 
//     }
        
//     const detectChanges = (a,b) => {
//         if(!a || !b) return false
//         let res = true
//         res &= a.total == b.total
//         a.stat.forEach( d => {
//             let f = _.find(b.stat,  r => d.name == r.name)
//             res &= (f) ? (d.value == f.value) : false
//         })
//         return !res
//     }    

//     const getUserList = async () => {
//         let grants = await loadGrants()
//         let response = await axios.get("./api/users/list")
//         let users = response.data
//         window.app.users = grants.map( g => _.extend(_.find(users, u => g.email.includes(u.email)), g))
//     }

//     const normalizeRole = () => {
                
//         let worker = _.find( window.app.users, d => d.email.includes(user.email))
//             if( worker ){
//                 user.altname = worker.namedAs
//                 user.role= worker.role
//                 user.namedAs = worker.namedAs
//             } else {
//                 user.altname = user.name
//                 user.role = "Reader"
//             }
//     }

//     let header = [
//         "No",
//         "ID",
//         "spot",
//         // "tag count",
//         "tag list",
//         "last update from",
//         // "updated at",
//     ]
    
//     const strong = (data, color) => ({
//         html: `<div class="caption font-weight-bold" style="line-height:0.9; color: ${color || ""}">${data}</div>`
//     })
    
//     const tag = data => {
//         let t = _.find(window.app.tags, t => t.name == data.tag)
//         const color = (t) ? t.color : undefined
//         const background = (t) ? t.background : undefined
        
//         return `
//             <div style="line-height:1.2; margin: 4px 0;"> 
//                 <span class="caption font-weight-bold" style="line-height:0.9; color: ${color || ""}; background: ${background || "#e0e0e0"}; padding: 2px 6px; border-radius: 16px; margin: 0 2px;">${data.tag}&nbsp;</span>
//                 <span class="caption " style="line-height:0.9">${data.createdBy.namedAs}, </span>
//                 <span class="caption " style="line-height:0.9">${moment(new Date(data.createdAt)).format("DD MMM YYYY, HH:mm")}</span>
//             </div>`
//     }
    
//     const formatDate = d => {
//         return {html: `<div class="caption" style="line-height:0.9">${moment(new Date(d)).format("MMM DD, YY HH:mm")}</div>`}
//     }    
    
//     const spot = (d, index) => ({
//         html: `<div class="caption font-weight-bold" style="line-height:0.9;">
//                     ${d["Body Spot"]}
//                     </div>`
//     })
    
    
//     const avt = d => {
        
//         if(!d) return ""
        
//         return {
//             component:   {
//                 "type": "avatar",
//                 "decoration": {
//                   "src": d.photo,
//                   "icon": "mdi-account-circle-outline",
//                   "style": "padding:0 10px;",
//                   "classes": "flex",
//                   "size": 32,
//                   "subTitle": d.namedAs
//                 }
//             }
//         }
//     }
    
//     const numbers = (d, index) => window.app.options.eventData.skip+1+index

//     let rowTemplate = { 
//         "No": numbers,
//         "ID": d => `...${_.last(d.id.split("-"))}`,
//         "spot": spot,
//         // "tag count": d => d.tags.length,
//         "tag list": d => {
//             let t = _.sortBy(d.tags, t => t.createdAt,"desc")
//             t.reverse()
//             let scoped = window.app.tags.map(d => d.name)
//             t = t.filter( t => scoped.includes(t.tag))
//             return {html: `<div>${t.map( t => tag(t)).join("\n")}</div>`} 
//         },
//         // "last updated at": d => {
//         //     let t = _.sortBy(d.tags, t => t.createdAt)[0]
//         //     return (t) ? formatDate(t.createdAt) : ""
//         // },
//         "last update from": d => {
//             let t = _.sortBy(d.tags, t => t.createdAt)[0]
//             return (t) ? avt(t.createdBy) : ""
//         },
//     }
    
    
    

    
// //     ///////////////////////////////////////////////////////////////
    
//     this.on({
//         event: "set-limit",
//         callback: async (sender, data) => {
//             if (window.app.options.eventData.prevLimit != data) {
//                 window.app.options.eventData.prevLimit = data || 50
//                 // window.app.options.eventData.limit = data || 10
//                 if(!window.app.lock){
//                     await loadData()    
//                 }
                
//             }
//         }
//     })
    
//     this.on({
//         event: "prev-page",
//         callback: async (sender, data) => {
//             let options = window.app.options
//             let skip = options.eventData.skip - options.eventData.limit
//             skip = (skip < 0) ? 0 : skip
//             if( skip != options.eventData.skip ){
//                 options.eventData.skip = skip
//                 await loadData()    
//             }
//         }
//     })
    
//     this.on({
//         event: "next-page",
//         callback: async (sender, data) => {
//             let options = window.app.options
//             if(options.eventData.skip + options.eventData.limit > options.eventData.total) return
//             let skip = options.eventData.skip + options.eventData.limit
//                 options.eventData.skip = skip
//                 await loadData()    
//         }
//     })
    
    
//     this.on({
//         event: "first-page",
//         callback: async (sender, data) => {
//             window.app.options.eventData.skip = 0
//                 if(!window.app.lock) {
//                     await loadData()
//                 }    
//         }
//     })
    
//     this.on({
//         event: "last-page",
//         callback: async (sender, data) => {
//             window.app.options.eventData.skip = Math.trunc(window.app.options.eventData.total/window.app.options.eventData.limit)*window.app.options.eventData.limit
//                 if(!window.app.lock) {
//                     await loadData()
//                 }    
//         }
//     })

// ////////////////////////////////////////////////////////////////////////////////////////////////////////

// const getSelection = () => {
//     let selected = selectWidgets("3qtce5ji2p6").getInstance().selected
//     // selected = selected.filter( s => _.find(window.app.currentData, r => r.id == s.id))
//     return selected
// }

// window.app.getSelection = getSelection

// // this.on({
// //     event: "change-added-tags",
// //     callback: (sender, data) => {
// //         console.log(sender, data)
// //         commandPanel.update({data: window.app}, {override:"options.data"})
// //     }
// // })

// this.on({
//     event: "add-tags",
//     callback: async () => {
//         let records = getSelection().map( r => r.id)
//         let tags = window.app.addedTags || []
//         await addTags({records, tags})
//     }
// })

    

// ////////////////////////////////////////////////////////////////////////////////////////////////////////    

//     this.on({
//         event: "change-has-tags",
//         callback:(sender,data) => {
//             window.app.filter.hasTags = data
//             setTimeout(() => {
//                 selectionCriteria.update({data: window.app}, {override : "options.data"})
//             }, 20)    
//         }
//     })
    
//     this.on({
//         event: "filter-any-tags",
//         callback: () => {
    
//             window.app.filter.includeTags = window.app.tags.map(d=> d.name)
//             setTimeout(() => {
//                 selectionCriteria.update({data: window.app}, {extend:"options.data"})
//             }, 20)
//         }
//     })
    
//     this.on({
//         event: "clear-filter-tags",
//         callback: () => {
    
//             window.app.filter.includeTags = []
//             setTimeout(() => {
//                 selectionCriteria.update({data: window.app}, {extend:"options.data"})
//             }, 20)
//         }
//     })
    
//     this.on({
//         event: "change-filter-tags",
//         callback: (sender, data) => {
//             window.app.filter.includeTags = data
//         }
//     })


// ////////////////////////////////////////////////////////////////////////////////////////////////////////
    
//     this.on({
//         event: "change-has-etags",
//         callback:(sender,data) => {
//             window.app.filter.withoutTags = data
//             setTimeout(() => {
//                 selectionCriteria.update({data: window.app}, {override : "options.data"})
//             }, 20)    
//         }
//     })
    
//     this.on({
//         event: "filter-any-etags",
//         callback: () => {
    
//             window.app.filter.excludeTags = window.app.tags.map(d=> d.name)
//             setTimeout(() => {
//                 selectionCriteria.update({data: window.app}, {extend:"options.data"})
//             }, 20)
//         }
//     })
    
//     this.on({
//         event: "clear-filter-etags",
//         callback: () => {
    
//             window.app.filter.excludeTags = []
//             setTimeout(() => {
//                 selectionCriteria.update({data: window.app}, {extend:"options.data"})
//             }, 20)
//         }
//     })
    
//     this.on({
//         event: "change-filter-etags",
//         callback: (sender, data) => {
//             window.app.filter.excludeTags = data
//         }
//     })


// ////////////////////////////////////////////////////////////////////////////////////////////////////////
    
    
//     this.on({
//         event: "apply-data-filter",
//         callback: async sender => {
//             // console.log(window.app.currentView, sender.title)
//             if(window.app.currentView != sender.title){
//                 window.app.currentView = sender.title
//                 if(sender.title == "My Labelings"){
//                     window.app.config.customFilter = [{$match: {"assigned to": user.namedAs}}]
//                 } else {
//                     window.app.config.customFilter = []
//                 }
                
//                 await loadData()   
//             }
//         }
//     })
    
    
//      this.on({
//         event:"page-focus",
//         callback: async () => {
//                 await loadData()
//                 // await loadForms()
//         }
//     })
   
    
    
//     this.on({
//         event: "apply-tag-filter",
//         callback:async () => {
//             // window.app.config.valueFilter = buildCustomQuery(valueFilterView)
//             // console.log("LOAD APPLY-FILTER")
//             // console.log(selectWidgets("fx4qoikasjg"))
//             window.app.options.eventData.skip = 0
//             await loadData()
//         }
//     })
    
//     this.on({
//         event: "apply-tag-scope",
//         callback:async () => {
//             // window.app.config.valueFilter = buildCustomQuery(valueFilterView)
//             // console.log("LOAD APPLY-FILTER")
//             // console.log(selectWidgets("fx4qoikasjg"))
//             window.app.options.eventData.skip = 0
//             await loadTagList(window.app.tagScope)
//         }
//     })

// //     //////////////////////////////////////////////////////////////
    
//     window.app.loader.set({
//         message: "TAGED RECORDS: Load metadata ..."
//     })
    
    
    
//     window.app.options = {
//         db: window.app.config.db,
//         id: window.app.config.id,
//         eventData: {
//             total: 0,
//             skip: 0,
//             limit: 50
//         },
//     }
    
//     window.app.currentView = "Latest Updates"
    
//     console.log("START with options", window.app.options)
    
//     await getUserList()
    
//     normalizeRole()
    
//     window.app.config.customFilter = [{$match: {"assigned to": user.namedAs}}]
	

// 	window.app.loader.set({
//         message: "TAGED RECORDS: Load dataset ..."
//     })
    
// 	window.app.lock = true
// 	await loadTagList()
// // 	await loadData()
//     this.emit("expand-all",{ignore:["25klmtcysbm"]})
//     this.emit("start")
    

//     setTimeout(() => {
//         window.app.lock = false
//     }, 1000)
    
//     window.app.loader.cancel()
    
// }




//         // if( !user.isLoggedIn ){

//         //     this.$djvue.login()

//         // } else {
    
//             bootstrap()
            
//         // }
    



