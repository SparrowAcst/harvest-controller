const mongodb = require("./mongodb")
const {extend, sortBy, uniq, flattenDeep, find, last} = require("lodash")
const moment = require("moment")
const uuid = require("uuid").v4
const YAML = require("js-yaml")
const fs = require("fs")
const path = require("path")
const Diff = require("./utils/diff")

const CONFIG = YAML.load(fs.readFileSync(path.join(__dirname,`../../sync-data/.config/db/mongodb.conf.yml`)).toString().replace(/\t/gm, " "))



const getDatasetList = async (req, res) => {
	try {
		
		let options = req.body.options
		
		options = extend( {}, options, {
			collection: `${options.db.name}.dataset`,
			pipeline: [   
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

const getForms = async (req, res) => {
	try {
		
		let options = req.body.options

		let data = await mongodb.aggregate({
			db: options.db,
			collection: `${options.db.name}.${options.db.examinationCollection}`,
			pipeline:  [
	          {
	            '$match': {
	              'patientId': options.patientId
	            }
	          }, {
	            '$lookup': {
	              'from': options.db.formCollection, 
	              'localField': 'id', 
	              'foreignField': 'examinationId', 
	              'as': 'forms'
	            }
	          }, {
	            '$lookup': {
	              'from': options.db.userCollection, 
	              'localField': 'actorId', 
	              'foreignField': 'id', 
	              'as': 'physician'
	            }
	          }, {
	            '$lookup': {
	              'from': options.db.labelingCollection, 
	              'localField': 'id', 
	              'foreignField': 'Examination ID', 
	              'as': 'records'
	            }
	          }, {
	            '$project': {
	              '_id': 0, 
	              'type': 1, 
	              'comment': 1, 
	              'state': 1, 
	              'dateTime': 1, 
	              'patientId': 1, 
	              'forms': 1, 
	              'physician': 1, 
	              'recordCount': {
	                '$size': '$records'
	              }
	            }
	          }, {
	            '$project': {
	              'records': 0
	            }
	          }
	        ] 
		})

		data = data[0]

	    if(data) {
	        
	        let formType = ["patient","echo","ekg"]
	        let forms = formType.map( type => {
	            let f = find(data.forms, d => d.type == type)
	            if(f && f.data){
	                let form  = f.data.en || f.data.uk
	                if(form) return extend(form, { formType: type} )
	            }
	        }).filter( f => f)
	        
	        let patientForm = find(forms, f => f.formType == "patient")

	        if(patientForm){
	        	if(patientForm.diagnosisTags){
	        		if(patientForm.diagnosisTags.tags){
	        			let tags = await mongodb.aggregate({
							db: options.db,
							collection: `${options.db.name}.tags`,
							pipeline:[
								{
									$match: {
										id: {
											$in: patientForm.diagnosisTags.tags
										}
									}
								},
								{
									$project: {
										_id: 0,
										name: 1
									}
								}	
							]
						})

	        			patientForm.diagnosisTags.tags = tags.map( t => last(t.name.split("/"))) 

	        		} else {
						patientForm.diagnosisTags.tags = []	        			
	        		}
	        	}
	        }


	        let physician
	        if( data.physician ){
	            physician = data.physician[0]
	            physician = (physician) 
	                ? {
	                    name: `${physician.firstName} ${physician.lastName}`,
	                    email: physician.email
	                }
	                : { name:"", email:"" }
	        } else {
	            physician = { name:"", email:"" }
	        }
	        
	            
	        result = {
	            examination:{
	                patientId: data.patientId,
	                recordCount:data.recordCount,
	                state: data.state,
	                comment: data.comment,
	                date: moment(new Date(data.dateTime)).format("YYYY-MM-DD HH:mm:ss"),
	                physician
	            },
	            patient: find(forms, f => f.formType == "patient"),
	            ekg: find(forms, f => f.formType == "ekg"),
	            echo: find(forms, f => f.formType == "echo"),
	        }
	    } else {
	        result = {}
	    }    

	    res.send(result)

	} catch (e) {
		res.send({ 
			error: e.toString(),
			requestBody: req.body
		})
	}
}

const getRecord = async (req, res) => {
	try {

		let options = req.body.options

		const result = await mongodb.aggregate({
			db: options.db,
			collection: `${options.db.name}.${options.db.labelingCollection}`,
			pipeline: [   
	            {
	                $match: { id: options.recordId }
	            },
	            {
	                $project:{ _id: 0 }
	            }
	                    
	        ]
		})


		await seglog({

			status: 200,
			user: options.user.name,
			collection: options.db.labelingCollection,
			recordID: options.recordId,
			path: (result[0]) ? result[0].path : "N/A", 
			request:"record",
			action: options.action,
			
		
		})



		res.send(result[0])

	} catch (e) {

		let options = req.body.options
		
		await seglog({

			status: 503,
			user: options.user.name,
			collection: options.db.labelingCollection,
			recordID: options.recordId,
			request:"record",
			action: options.action,
			reason: e.toString()
		
		})

		res.send({ 
			error: e.toString(),
			requestBody: req.body
		})
	}
}

const getMetadata = async (req, res) => {
	try {

		let options = req.body.options

		const result = await mongodb.aggregate({
			db: options.db,
			collection: `${options.db.name}.${options.db.metadataCollection}`,
			pipeline: [   
	            {
	                $project:{ _id: 0 }
	            }
	                    
	        ]
		})

		res.send(result)

	} catch (e) {
		res.send({ 
			error: e.toString(),
			requestBody: req.body
		})
	}
}	

const updateRecord = async (req, res) => {
	try {

		let options = req.body.options

		const prev = await mongodb.aggregate({
			db: options.db,
			collection: `${options.db.name}.${options.db.labelingCollection}`,
			pipeline: [   
	            {
	                $match: { id: options.record.id }
	            },
	            {
	                $project:{ _id: 0 }
	            }
	                    
	        ]
		})

		options.record.segmentation = prev[0].segmentation

		const result = await mongodb.replaceOne({
			db: options.db,
			collection: `${options.db.name}.${options.db.labelingCollection}`,
			filter:{
                id: options.record.id
            },
            data: options.record
		})

		const event = {
			id: uuid(),
			dataset: options.dataset,
			collection: options.db.labelingCollection, 
			recordingId: options.record.id,
			examinationId: options.record["Examination ID"],
			path: options.record.path,
			diff: Diff.diff(prev, options.record),
			formattedDiff: Diff.format(Diff.diff(prev[0], options.record)),
			user: options.user,
			startedAt: options.session.startedAt,
			stoppedAt: options.session.stoppedAt
		}

		await mongodb.replaceOne({
			db: options.db,
			collection: `${options.db.name}.changelog-recordings`,
			filter:{
                id: event.id
            },
            data: event
		})



		res.send(result)

	} catch (e) {
		res.send({ 
			error: e.toString(),
			requestBody: req.body
		})
	}
}



const getChangelog = async (req, res) => {
	try {
	
		let options = req.body.options

		const changelog = await mongodb.aggregate({
				db: options.db,
				collection: `${options.db.name}.changelog-recordings`,
				pipeline: [
				  {
				    $match:
				      {
				        recordingId: options.recordingId,
				      },
				  },
				  {
				    $project:
				      {
				        _id: 0,
				      },
				  },
				  {
				    $sort:
				      {
				        startedAt: -1,
				      },
				  },
				]
			})

		res.status(200).send(changelog)
	
	} catch (e) {
	
		res.status(500).send(e.toString())
	
	}	
}


const findCollection = async dataPath => {
	let datasets = await mongodb.aggregate({
			db: CONFIG.db,
			collection: `sparrow.dataset`,
			pipeline: []
	})
	
	let collections = datasets.map( d => d.settings.db.labelingCollection)
	let res

	for( let i=0; (i < collections.length) && !res; i++){
		let f = await mongodb.aggregate({
				db: CONFIG.db,
				collection: `sparrow.${collections[i]}`,
				pipeline: [{
					$match:{
						path: dataPath
					}
				}]
		})
		if(f.length > 0) res = collections[i]
	}
	
	return res

}

const seglog = async data => {
	// data.id = uuid()
	// data.createdAt = new Date()
	// const result = await mongodb.updateOne({
	// 	db: CONFIG.db,
	// 	collection: "sparrow.seglog",
	// 	filter:{
 //            id: data.id
 //        },

 //        data
	// })

}


const updateSegmentation = async (req, res) => {
	try {

		let dataPath = req.body.path
		let segmentation = req.body.segmentation

		if(!dataPath) {
			
			await seglog({

				status: 400,
				dataPath,
				request:"segmentation",
				reason: `"segmentation" required in\n${JSON.stringify(req.body, null, " ")}`
			
			})
			
			res.status(400).send(`"path" required in\n${JSON.stringify(req.body, null, " ")}`)
			return
		}

		if(!segmentation) {
			
			await seglog({

				status: 400,
				dataPath,
				request:"segmentation",
				reason: `"segmentation" required in\n${JSON.stringify(req.body, null, " ")}`
			
			})

			res.status(400).send(`"segmentation" required in\n${JSON.stringify(req.body, null, " ")}`)
			return
		}

		let collection = await findCollection(dataPath)

		if(!collection){
			
			await seglog({

				status: 404,
				dataPath,
				request:"segmentation",
				reason: `path "${dataPath}" not found`
			
			})

			res.status(404).send(`path "${dataPath}" not found`)
		}

		
		const result = await mongodb.updateOne({
			db: CONFIG.db,
			collection: `sparrow.${collection}`,
			filter:{
                path: dataPath
            },

            data: {
            	segmentation
            }
		})

		await seglog({

			status: 200,
			dataPath,
			request:"segmentation"
		
		})

		res.send(result)

	} catch (e) {
		
		await seglog({

			status: 503,
			dataPath,
			request:"segmentation",
			reason: e.toString()
		
		})

		res.status(503).send({ 
			error: e.toString(),
			requestBody: req.body
		})
	}
}	
	
	
	
module.exports = {
	getDatasetList,
	getGrants,
	getForms,
	getRecord,
	getMetadata,
	updateRecord,
	updateSegmentation,
	getChangelog
}