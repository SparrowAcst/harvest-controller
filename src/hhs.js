const mongodb = require("./mongodb")
const {extend, sortBy, uniq, flattenDeep, find} = require("lodash")
const moment = require("moment") 

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



const getAvailableValues = async (req, res) => {
	try {
		
		let options = req.body.options

		options = extend( {}, options, {
			collection: `${options.db.name}.${options.db.labelingCollection}`,
			pipeline: [
			  {
			    '$facet': {
			      'device': [
			        {
			          '$group': {
			            '_id': '$model'
			          }
			        }
			      ], 
			      'todo': [
			        {
			          '$group': {
			            '_id': '$TODO'
			          }
			        }
			      ], 
			      'bodyPosition': [
			        {
			          '$group': {
			            '_id': '$Body Position'
			          }
			        }
			      ], 
			      'bodySpot': [
			        {
			          '$group': {
			            '_id': '$Body Spot'
			          }
			        }
			      ]
			    }
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






const getEvents = async (req, res) => {
	try {
		
		let options = req.body.options

		let count = await mongodb.aggregate({
			db: options.db,
			collection: `${options.db.name}.${options.db.labelingCollection}`,
			pipeline: options.excludeFilter
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

	    options.pipeline = options.excludeFilter
						.concat(options.valueFilter)
						.concat(options.eventData.filter)
						.concat([
				          {
				            '$project': {
				              '_id': 0
				            }
				          }, 
				          { 
				            $sort: (options.latest) 
				            	? 	{
						                "updated at": -1,
						                // "Body Position": 1,
						                // "Body Spot": 1,
						                // "model": 1
					            	}
					            : 	{
						                "Examination ID": 1,
						                "Body Position": 1,
						                "Body Spot": 1,
						                "model": 1
					            	}	 
				          },
				          {
				            '$skip': options.eventData.skip
				          }, 
				          {
				            '$limit': options.eventData.limit
				          }
				        ])
	    
	    const data = await mongodb.aggregate({
	    	db: options.db,
			collection: `${options.db.name}.${options.db.labelingCollection}`,
			pipeline: options.pipeline 
	    })

 
	    res.send({
	    	options,
	    	collection: data
	    })

	} catch (e) {
		res.send({ 
			error: e.toString(),
			requestBody: req.body
		})
	}	

}
	
const getTeam = async (req, res) => {
	try {
		
		let options = req.body.options

		const result = await mongodb.aggregate({
			db: options.db,
			collection: `${options.db.name}.${options.db.labelingCollection}`,
			pipeline: [
	          {
	            '$match': {
	              'Examination ID': options.id
	            }
	          }, {
	            '$group': {
	              '_id': '$Examination ID', 
	              '1st expert': {
	                '$addToSet': '$1st expert'
	              }, 
	              '2nd expert': {
	                '$addToSet': '$2nd expert'
	              }, 
	              'CMO': {
	                '$addToSet': '$CMO'
	              }
	            }
	          }, {
	            '$project': {
	              '_id': 0
	            }
	          }
	        ]
		}) 

		res.send({
			collaborators: result[0]
		})	

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

const getStat = async (req, res) => {
	try {
		
		let options = req.body.options

		const stat = await mongodb.aggregate({
			db: options.db,
			collection: `${options.db.name}.${options.db.labelingCollection}`,
			pipeline: options.excludeFilter
						.concat(options.valueFilter)
						.concat(options.eventData.filter)
						.concat(
					        [
					          // {
					          //   '$match': {
					          //     'Examination ID': options.id
					          //   }
					          // }, 
					          {
					            '$group': {
					              '_id': '$TODO', 
					              'value': {
					                '$count': {}
					              }
					            }
					          }, {
					            '$project': {
					              'name': '$_id', 
					              'value': 1, 
					              '_id': 0
					            }
					          }
					        ]) 
		})



		res.send({
			stat,
			total: stat.map(d => d.value).reduce((d,a) => a+d, 0)
		})	
	
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
	
module.exports = {
	getDatasetList,
	getEvents,
	getTeam,
	getGrants,
	getStat,
	getForms,
	getAvailableValues
}