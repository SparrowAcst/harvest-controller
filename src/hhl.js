const mongodb = require("./mongodb")
const {extend, sortBy, uniq, flattenDeep, find, last} = require("lodash")
const moment = require("moment")
const uuid = require("uuid").v4
const YAML = require("js-yaml")
const fs = require("fs")
const path = require("path")
const { Diff, SegmentationDiff } = require("./utils/diff")
const url = require('url')
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

		if(result.length == 0){

			seglog({
				status: 404,
				request:"record",
				reason: `record "${options.recordId}" not found`,
				body: req.body
			})

			res.status(404).send(`record "${options.recordId}" not found`)
				
		}

		seglog({

			status: 200,
			request:"record",
			body: req.body,
		})



		res.status(200).send(result[0])

	} catch (e) {

		let options = req.body.options
		
		seglog({

			status: 503,
			request:"record",
			reason: e.toString(),
			body: req.body
		
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
			session: options.session.id,
			startedAt: options.session.startedAt,
			stoppedAt: options.session.stoppedAt
		}

		await mongodb.replaceOne({
			db: options.db,
			collection: `${options.db.name}.changelog-recordings`,
			filter:{
                // id: event.id
                session: event.session
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


const updateTagedRecord = async (req, res) => {
	try {

		let options = req.body.options

		options.record.tags = options.record.tags.map( t => {
			t.createdAt = new Date(t.createdAt)
			return t
		})

		options.tags = (options.tags || []).map( t => ({
			tag: t,
			createdAt: new Date(),
			createdBy: {
				email: options.user.email,
				namedAs: options.user.altname,
				photo: options.user.photo
			}
		}))

		options.record.tags = options.record.tags.concat(options.tags)


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
		options.record["updated at"] = new Date()

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
			session: options.session.id,
			startedAt: options.session.startedAt,
			stoppedAt: options.session.stoppedAt
		}

		await mongodb.replaceOne({
			db: options.db,
			collection: `${options.db.name}.changelog-recordings`,
			filter:{
                // id: event.id
                session: event.session
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


const getProfile = async (req, res) => {
	try {
	
		let options = req.body.options

		console.log(options.user.profile)

		const profile = await mongodb.aggregate({
				db: options.db,
				collection: `${options.db.name}.profiles`,
				pipeline: [
				  {
				    $match:
				      {
				        name: options.user.profile,
				      },
				  },
				  {
				    $project:
				      {
				        _id: 0,
				      },
				  }				
				]
			})

		res.status(200).send(profile[0])
	
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
		console.log(collections[i])
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
	console.log(">>", res)
	return res

}

const seglog = data => {

	setTimeout( async () => {
		
		data.id = uuid()
		data.createdAt = new Date()

		const result = await mongodb.updateOne({
			db: CONFIG.db,
			collection: "sparrow.seglog",
			filter:{
	            id: data.id
	        },
	        data
		})

	}, 10)
	

}


const updateSegmentation = async (req, res) => {
	try {

		let dataPath = req.body.path
		let segmentation = req.body.segmentation
		let query = (req.body.url) ? url.parse(req.body.url, true).query : {}
		let collection = query.c || ""
		let user = query.u || ""
		let id = query.r || ""
		let ai = req.body.ai || false



		if(!dataPath) {
			
			seglog({

				status: 400,
				request:"segmentation",
				reason: `"segmentation" required in\n${JSON.stringify(req.body, null, " ")}`,
				body: req.body
			
			})
			
			res.status(400).send(`"path" required in\n${JSON.stringify(req.body, null, " ")}`)
			return
		}

		if(!segmentation) {
			
			seglog({

				status: 400,
				request:"segmentation",
				reason: `"segmentation" required in\n${JSON.stringify(req.body, null, " ")}`,
				body: req.body
			
			})

			res.status(400).send(`"segmentation" required in\n${JSON.stringify(req.body, null, " ")}`)
			return
		}

		
		if(!collection){
			collection = await findCollection(dataPath)	
		} else {
			let md5map = await mongodb.aggregate({
				db: CONFIG.db,
				collection: `sparrow.md5keys`,
				pipeline: [   
					{ 
						$match:{
							md5: {
								$in: [collection, user]
							}
						}
					}
		        ]
			})

			let f = find(md5map, m => m.md5 == collection)
			collection = (f) ? f.value : undefined

			f = find(md5map, m => m.md5 == user)
			user = (f) ? f.value : undefined

			if(ai) {
				user = "AI"
			}

		}
		

		if(!collection){
			
			seglog({

				status: 404,
				request:"segmentation",
				reason: `path "${dataPath}" not found`,
				body: req.body
				
			})

			res.status(404).send(`path "${dataPath}" not found`)
		}

		
		

		let updatedRecord = await mongodb.aggregate({
			db: CONFIG.db,
			collection: `sparrow.${collection}`,
			pipeline: [   
				{ 
					$match:{
						path: dataPath
					}
				}
	        ]
		})

		updatedRecord = updatedRecord[0]

		console.log("Record:", updatedRecord.id)
		
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

		const seg_hist = {
			id: uuid(),
			collection,
			recordId: updatedRecord.id,
			updatedAt: new Date(),
			updatedBy: user,
			segmentation
		}

		await mongodb.replaceOne({
			db: CONFIG.db,
			collection: `sparrow.segmentation-history`,
			filter:{
                id: seg_hist.id
            },
            
			data: seg_hist
			
		})

		const event = {
			id: uuid(),
			type:"update segmentation",
			collection, 
			recordingId: updatedRecord.id,
			examinationId: updatedRecord["Examination ID"],
			path: updatedRecord.path,
			segmentation,
			startedAt: new Date(),
			stoppedAt: new Date()
		}

		await mongodb.replaceOne({
			db: CONFIG.db,
			collection: `sparrow.changelog-recordings`,
			filter:{
                id: event.id
            },
            
            data: event
		})


		


		// seglog({

		// 	status: 200,
		// 	dataPath,
		// 	request:"segmentation"
		
		// })

		res.send(result)

	} catch (e) {
		
		 seglog({

			status: 503,
			request:"segmentation",
			reason: e.toString(),
			body: req.body	
		
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
	getChangelog,
	getProfile,
	updateTagedRecord
}