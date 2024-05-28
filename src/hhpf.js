const mongodb = require("./mongodb")
const {extend, sortBy, uniq, flattenDeep, find} = require("lodash")
const moment = require("moment") 

// const { google } = require("googleapis")
// const path = require("path")

// const key = require(path.join(__dirname,"../../../sync-data/.config/key/gd/gd.key.json"))

// const jwtClient = new google.auth.JWT(
//   key.client_email,
//   null,
//   key.private_key,
//   ["https://www.googleapis.com/auth/drive"],
//   null
// );

// const drive = google.drive({version: 'v3', auth: jwtClient});


// const getFile = async (req, response) => {
	
// 	let id = req.query.id || req.params.id
	
// 	let metadata = await drive.files.get(
// 	    { 
// 	    	fileId: id,
// 	    	fields: 'id, name, mimeType, md5Checksum, createdTime, modifiedTime, parents, size',
// 	    }
// 	)
	
// 	let res = await drive.files.get(
// 		{ fileId: id, alt: 'media' },
// 		{ responseType: 'stream' }
// 	)    	
	
// 	response.setHeader('Content-Length', metadata.data.size);
// 	response.setHeader('Content-Type', metadata.data.mimeType);
// 	response.setHeader('Content-Disposition', 'inline')

// 	res.data.pipe(response)
// }



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


const updateDiagnosisTags = async (req, res) => {
	
	try {
	
		let options = req.body.options
		let result = await mongodb.updateOne({
		 	db: options.db,
		 	collection: `${options.db.name}.${options.db.formCollection}`,
		 	filter: { id: options.form.id },
		 	data: { 
		 		"data.en.diagnosisTags": options.form.diagnosisTags,
		 		"data.en.diagnosis": options.form.diagnosis,
		 		"data.en.diagnosisReliability": options.form.diagnosisReliability
		 	}
		})
		res.send(result)
	
	} catch (e) {
	
		res.send({ 
			error: e.toString(),
			requestBody: req.body
		})
	
	}	 

}

const getExamination = async (req, res) => {
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
	          },
	          {
	            '$project': {
	              '_id': 0, 
	          	}
	          }
	        ] 
		})

		data = data[0]
	    res.send(data)

	} catch (e) {
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
	              'protocol': 1,
	              'workflowTags': 1, 
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
	        let formType = ["patient","echo","ekg", "attachements"]
	        let forms = formType.map( type => {
	            let f = find(data.forms, d => d.type == type)
	            if(f && f.data){
	                let form  = f.data.en || f.data.uk || f.data
	                if(form) return extend(form, { formType: type, id:f.id} )
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
	                protocol: data.protocol || "Complete Protocol",
	                workflowTags: data.workflowTags,
	                comment: data.comment,
	                date: moment(new Date(data.dateTime)).format("YYYY-MM-DD HH:mm:ss"),
	                physician
	            },
	            patient: find(forms, f => f.formType == "patient"),
	            ekg: find(forms, f => f.formType == "ekg"),
	            echo: find(forms, f => f.formType == "echo"),
	            attachements: find(forms, f => f.formType == "attachements")
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


const updateForm = async (req, res) => {
	let pipeline = []
	try {
		
		let options = req.body.options
		
		pipeline = [
			{
				$match:{
					patientId: options.patientId,
					type: options.type
				}
			}
		]

		let storedForm = await mongodb.aggregate({
			db: options.db,
			collection: `${options.db.name}.${options.db.formCollection}`,
			pipeline
		})	

		storedForm = storedForm[0]

		if(!storedForm) {
			res.send({
				error: `${options.form.type} for ${options.patientId} not found`,
				requestBody: req.body
			})
		}
		
		storedForm.data.en = options.form

		let result = await mongodb.replaceOne({
		 	db: options.db,
		 	collection: `${options.db.name}.${options.db.formCollection}`,
		 	filter: { id: storedForm.id },
		 	data: storedForm
		})

		res.send(result)

	} catch (e) {
		res.send({ 
			error: e.toString(),
			requestBody: req.body,
			pipeline
		})
	}
}


const commitWorkflowTags = async (req, res) => {
	try {

		let options = req.body.options


		let workflowTags = (options.examination.workflowTags || []).map( t => ({
			tag: t.tag,
			createdAt: new Date(t.createdAt),
			createdBy: t.createdBy
		}))

		
		
		let result = await mongodb.updateOne({
		 	db: options.db,
		 	collection: `${options.db.name}.${options.db.examinationCollection}`,
		 	filter: { patientId: options.id },
		 	data: { 
		 		workflowTags,
		 		'updated at': new Date(),
		 		'updated by': options.user.altname,
		 		'Stage Comment': options.examination['Stage Comment'] 
		 	}
		})

	    res.send(result)

	} catch(e) {
		res.send({ 
			error: e.toString(),
			requestBody: req.body
		})	
	}
}


	
module.exports = {
	getDatasetList,
	getGrants,
	getForms,
	updateForm,
	updateDiagnosisTags,
	getExamination,
	commitWorkflowTags
	// getFile
}