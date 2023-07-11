const mongodb = require("./mongodb")
const {extend, sortBy, uniq, flattenDeep, find, isArray} = require("lodash")
const moment = require("moment") 



const getTags = async (req, res) => {
	try {
	
		let options = req.body.options

		options = extend( {}, options, {
			collection: `${options.db.name}.tags`,
			pipeline: [   
	            {
	            	$match:{
	            		classification: options.classification
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
			command: "getTags", 
			error: e.toString(),
			requestBody: req.body
		})
	
	}	

}


const updateTags = async (req, res) => {
	try {
	
		let options = req.body.options

		let classification = (options.tags && isArray(options.tags) && options.tags[0]) ? options.tags[0].classification : ""
				
		await mongodb.deleteMany({
			db: options.db,
			collection: `${options.db.name}.tags`,
			filter: { classification } 
		})

		await mongodb.insertAll({
			db: options.db,
			collection: `${options.db.name}.tags`,
			data: options.tags
		
		})

		const result = await mongodb.aggregate({
			db: options.db,
			collection: `${options.db.name}.tags`,
			pipeline: [   
	            {
	            	$match:{
	            		classification
	            	}
	            },
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


	
module.exports = {
	getTags,
	updateTags
}