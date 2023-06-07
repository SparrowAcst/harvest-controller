const mongodb = require("./mongodb")
const {extend, sortBy, uniq, flattenDeep, find, difference, isArray, maxBy, keys, first, isUndefined} = require("lodash")
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
			collection: `${options.db.name}.${options.collection.users}`,
			pipeline: [   
	            {
				    $match: {
				        email: options.user.email,
				    }
				},
	            {
	                $project:{ _id: 0 }
	            }
	        ] 
		})
	
		let grants = await mongodb.aggregate(options)
		grants = grants[0]
		
		if(!grants){
			res.send ({
				error: `Access denied for user ${options.user.email}`
			})
			return
		}

		if(!isUndefined(options.examinationID)){
			if( grants.patientPrefix.filter( d => options.examinationID.startsWith(d)).length == 0){
				grants.role = "reader"
				// res.send ({
				// 	error: `Examination ${options.examinationID} not available for user ${options.user.email}`
				// })
				// return
			} else {
				grants.role = "writer"
			}	
		}

		res.send(grants)

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
			collection: `${options.db.name}.${options.collection.forms}`,
			pipeline:  [
	          {
	            '$match': {
	              'examination.patientId': options.examinationID
	            }
	          },
	          {
	            '$project': {
	              '_id': 0
	            }
	          }
	        ] 
		})

		data = data[0]
		if( data){
			if(data.examination.state == "pending") {
				data.readonly = false
				res.send(data)
			} else {
				data.readonly = true
				res.send(data)
			}
		} else {		
			res.send ({
				error: `Examination ${options.examinationID} not available for user ${options.user.email}`
			})
		}	


	} catch (e) {
		res.send({ 
			error: e.toString(),
			requestBody: req.body
		})
	}
}


const lockForms = async (req, res) => {
	try {
		
		let options = req.body.options


		let data = await mongodb.aggregate({
			db: options.db,
			collection: `${options.db.name}.${options.collection.forms}`,
			pipeline:  [
	          {
	            '$match': {
	              'examination.patientId': options.examinationID
	            }
	          },
	          {
	            '$project': {
	              '_id': 0
	            }
	          }
	        ] 
		})

		data = data[0]
		if(data){
			
			data["locked by"] = options.grants.name
			data["locked at"] = new Date()
			
			const result = await mongodb.replaceOne({
				db: options.db,
				collection: `${options.db.name}.${options.collection.forms}`,
				filter:{
					'examination.patientId': data.examination.patientId
	            },
	            data
			})

			res.send(result)
		
		} else {		
			res.send ({
				error: `Examination ${options.examinationID} not available for user ${options.user.email}`
			})
		}	


	} catch (e) {
		res.send({ 
			error: e.toString(),
			requestBody: req.body
		})
	}
}


const unlockForms = async (req, res) => {
	try {
		let options = JSON.parse(req.body).options

		let data = await mongodb.aggregate({
			db: options.db,
			collection: `${options.db.name}.${options.collection.forms}`,
			pipeline:  [
	          {
	            '$match': {
	              'examination.patientId': options.examinationID
	            }
	          },
	          {
	            '$project': {
	              '_id': 0
	            }
	          }
	        ] 
		})

		data = data[0]
		if(data){
			
			delete data["locked by"]
			delete data["locked at"]
			const result = await mongodb.replaceOne({
				db: options.db,
				collection: `${options.db.name}.${options.collection.forms}`,
				filter:{
					'examination.patientId': data.examination.patientId
	            },
	            data
			})

			res.send(result)
		
		} else {		
			res.send ({
				error: `Examination ${options.examinationID} not available for user ${options.user.email}`
			})
		}	


	} catch (e) {
		res.send({ 
			error: e.toString(),
			requestBody: req.body
		})
	}
}

const updateForms = async (req, res) => {
	try {
		
		let options = req.body.options
		
		delete options.form["locked by"]
		delete options.form["locked at"]
		
		
		const result = await mongodb.replaceOne({
			db: options.db,
			collection: `${options.db.name}.${options.collection.forms}`,
			filter:{
				'examination.patientId': options.form.examination.patientId
            },
            data: options.form
		})


		res.send(result)

	} catch (e) {
		res.send({ 
			error: e.toString(),
			requestBody: req.body
		})
	}
}

const syncExaminations = async (req, res) => {

	const controller = await require("../../sync-data/src/controller")({
	    console,
	    firebaseService:{
	      noprefetch: true
	    }  
	  })

	const fb = controller.firebaseService

	const prepareForms = async examination => {
		examination = await controller.expandExaminations(...[examination])

		examination = (isArray(examination)) ? examination[0] : examination
		
		let formRecords = examination.$extention.forms.map( f => {
		    let res = extend({}, f)
		    res.examinationId = examination.id
		    let key = maxBy(keys(f.data))
		    res.data = res.data[key]
		    res.id = f.id
		    return res 
		  })


		  let form = {}
		  let ftypes = ["patient", "ekg", "echo"]
		  ftypes.forEach( type => {
		    let f = find(formRecords, d => d.type == type)
		    form[type] = (f && f.data) ? f.data.en : {}

		  })
		  
		  form.examination = {
		  	 "id": examination.id,
	         "dateTime": examination.dateTime,
	         "patientId": examination.patientId,
	         "comment": examination.comment,
	         "state": examination.state
		  }
		  return form
		  
	}


	try {
		
		let options = req.body.options

		options = extend( {}, options, {
			collection: `${options.db.name}.${options.collection.users}`,
			pipeline: [   
	            {
				    $match: {
				        email: options.user.email,
				    }
				},
	            {
	                $project:{ _id: 0 }
	            }
	        ] 
		})
	
		let grants = await mongodb.aggregate(options)
		grants = grants[0]
		
		if(!grants){
			res.send ({
				error: `Access denied for user ${options.user.email}`
			})
			return
		}

		// if( grants.patientPrefix.filter( d => options.examinationID.startsWith(d)).length == 0){
		// 	res.send ({
		// 		error: `Examination ${options.examinationID} not available for user ${options.user.email}`
		// 	})
		// 	return
		// }

		let examinations_fb = await fb.execute.getCollectionItems(
	       "examinations",
	       [["state", "==", "pending"]]
	    )

	    examinations_fb = examinations_fb.filter( e => grants.patientPrefix.map( p => e.patientId.startsWith(p)).reduce((a,b) => a || b, false))

	    let examinations_mg =  await mongodb.aggregate({
			db: options.db,
			collection: `${options.db.name}.forms`,
			pipeline:  [
	          {
	            '$match': {
	              'examination.state': "pending"
	            }
	          },
	          {
	            '$project': {
	              '_id': 0
	            }
	          }
	        ] 
		})

		examinations_mg = examinations_mg.filter( e => grants.patientPrefix.map( p => e.examination.patientId.startsWith(p)).reduce((a,b) => a || b, false))


	 //    console.log(`fb: ${examinations_fb.map(d => d.patientId).join(', ')}`)
		// console.log(`mg: ${examinations_mg.map(d => d.examination.patientId).join(', ')}`)



		let toBeAdded = difference(examinations_fb.map( d => d.patientId), examinations_mg.map( d => d.examination.patientId))
		let toBeLocked = difference(examinations_mg.map( d => d.examination.patientId), examinations_fb.map( d => d.patientId))

		
		toBeAdded = examinations_fb.filter( e => {
			return toBeAdded.includes(e.patientId)
		})

		let forms = []
		
		for(let i=0; i < toBeAdded.length; i++){
			let exam = toBeAdded[i]
			let form = await prepareForms(exam)
			forms.push(form)
		}

		
		if(forms.length > 0){
			await mongodb.insertAll({
				db: options.db,
				collection: `${options.db.name}.forms`,
				data: forms
			})	
		}
		
		toBeLocked = examinations_mg.filter( e => toBeLocked.includes(e.patientId))
		
		for(let i=0; i < toBeLocked.length; i++){
			let form = examinations_mg[i]
			form.examination.state = "locked"
			await mongodb.replaceOne({
				db: options.db,
				collection: `${options.db.name}.forms`,
				filter:{
					'examination.patientId': form.examination.patientId
	            },
	            data: form
			})
		}

		let availablePatents = examinations_fb.map( f => f.patientId)

		let availableForms =  await mongodb.aggregate({
			db: options.db,
			collection: `${options.db.name}.forms`,
			pipeline:  [
	          {
	            '$match': {
	              'examination.state': "pending",
	              "examination.patientId":{
	              	$in: availablePatents
	              }
	            }
	          }, 
	          {
			    $project:
			      {
			        _id: 0,
			        "Patient ID": "$examination.patientId",
			        "Patient Form": "$completeness.Patient Form",
			        "EKG Form": "$completeness.EKG Form",
			        "Echo Form": "$completeness.Echo Form",
			        "updated at": "$updated at",
			        comment: "$comment",
			        status: "$status",
			        "updated by": "$updated by",
			        "locked by": "$locked by",
			        "locked at": "$locked at",
			      },
			  },
			  {
			    $sort:
			      {
			        "Patient ID": 1,
			      },
			  }
	        ] 
		})		

		res.send(availableForms)

	}

	 catch (e) {
		res.send({ 
			error: e.toString(),
			requestBody: req.body
		})
	}

} 

	
module.exports = {
	getGrants,
	getForms,
	updateForms,
	syncExaminations,
	lockForms,
	unlockForms
}