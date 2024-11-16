const mongodb = require("./mongodb")
const {extend, sortBy, uniq, flattenDeep, find} = require("lodash")
const moment = require("moment") 


const updateDiagnosisTags = async (req, res) => {
	
	
	try {
		
	
		let {options} = req.body
        const { db } = req.body.cache.currentDataset


		let result = await mongodb.updateOne({
		 	db,
		 	collection: `${db.name}.${db.formCollection}`,
		 	filter: { 
		 		id: options.form.id 
		 	},
		 	data: { 
		 		"data.en.diagnosisTags": options.form.diagnosisTags,
		 		"data.en.diagnosis": options.form.diagnosis,
		 		"data.en.diagnosisReliability": options.form.diagnosisReliability
		 	}
		})
		res.send(result)
	
	} catch (e) {
		console.log(e.toString())
		res.send({ 
			error: e.toString(),
			requestBody: req.body
		})
	
	}	 

}

const getExamination = async (req, res) => {
	try {
		
		let {options} = req.body
        const { db } = req.body.cache.currentDataset

		let data = await mongodb.aggregate({
			db,
			collection: `${db.name}.${db.examinationCollection}`,
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
		
		let {options} = req.body
        const { db } = req.body.cache.currentDataset

		let pipeline = [
	          {
	            '$match': {
	              'patientId': options.id
	            }
	          }, {
	            '$lookup': {
	              'from': db.formCollection, 
	              'localField': 'id', 
	              'foreignField': 'examinationId', 
	              'as': 'forms'
	            }
	          }, {
	            '$lookup': {
	              'from': db.userCollection, 
	              'localField': 'actorId', 
	              'foreignField': 'id', 
	              'as': 'physician'
	            }
	          }, {
	            '$lookup': {
	              'from': db.labelingCollection, 
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

	        // console.log(pipeline)

		let data = await mongodb.aggregate({
			db,
			collection: `${db.name}.${db.examinationCollection}`,
			pipeline 
		})

		data = data[0]

		// console.log(data)

	    if(data) {
	        let formType = ["patient","echo","ekg", "attachements"]
	        let forms = formType.map( type => {
	            let f = find(data.forms, d => d.type == type)
	            if(f && f.data){
	                let form  = f.data.en || f.data.uk || f.data
	                if(form) return extend(form, { formType: type, id:f.id} )
	            }
	        }).filter( f => f)
	        
	        // console.log()
	        // console.log("FORMS  >>", forms)
	        // console.log()


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
		
		let {options} = req.body
        const { db } = req.body.cache.currentDataset

		pipeline = [
			{
				$match:{
					patientId: options.patientId,
					type: options.type
				}
			}
		]

		let storedForm = await mongodb.aggregate({
			db: db,
			collection: `${db.name}.${db.formCollection}`,
			pipeline
		})	

		storedForm = storedForm[0]

		// console.log("storedForm", storedForm)

		if(!storedForm) {
			res.send({
				error: `${options.type} for ${options.patientId} not found`,
				requestBody: req.body
			})
		}
		
		storedForm.data.en = options.form

		let result = await mongodb.replaceOne({
		 	db,
		 	collection: `${db.name}.${db.formCollection}`,
		 	filter: { 
		 		// id: storedForm.id
		 		patientId: options.patientId,
				type: options.type 
		 	},
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

		let {options} = req.body
        const { db } = req.body.cache.currentDataset


		let workflowTags = (options.examination.workflowTags || []).map( t => ({
			tag: t.tag,
			createdAt: new Date(t.createdAt),
			createdBy: t.createdBy
		}))

		
		
		let result = await mongodb.updateOne({
		 	db,
		 	collection: `${db.name}.${db.examinationCollection}`,
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
	getForms,
	updateForm,
	updateDiagnosisTags,
	getExamination,
	commitWorkflowTags
}