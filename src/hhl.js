const mongodb = require("./mongodb")
const {extend, sortBy, uniq, flattenDeep, find} = require("lodash")
const moment = require("moment")
const uuid = require("uuid").v4
const YAML = require("js-yaml")
const fs = require("fs")
const path = require("path")

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
	              'patientId': options.id
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

		res.send(result[0])

	} catch (e) {
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
			labelingId: options.record.id,
			todo: options.record.TODO,
			assignedBy: options.record["updated by"],
			assignedTo: options.record["assigned to"],
			date: options.record["updated at"] 
		}

		await mongodb.replaceOne({
			db: options.db,
			collection: `${options.db.name}.workflow-events`,
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

const updateSegmentation = async (req, res) => {
	try {

		let options = req.body
		let dataPath = req.path
		let segmentation = req.segmentation

		if(!dataPath) {
			res.status(503).send("path required")
			return
		}

		if(!segmentation) {
			res.status(503).send("segmentation required")
			return
		}

		let collection = await findCollection(dataPath)

		if(!collection){
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


		res.send(result)

	} catch (e) {
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
	updateSegmentation
}