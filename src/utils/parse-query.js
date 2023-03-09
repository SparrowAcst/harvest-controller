const uuid = require("uuid").v4
const { find, mapKeys, extend, isObject, isArray, isString, keys, last, first } = require("lodash")



// let query = [
// [
// 	// {
// 	//   "$out":"A"
// 	// },
// 	{
// 	  	$from: "harvest1"
// 	},
// 	// {
// 	//   	$union: "A"
// 	// },
	
// 	// {
// 	//   	$intersect: "A"
// 	// },

// 	// {
// 	//   	$minus: "A"
// 	// },

// 	// {
// 	// 	$unique: "Examination ID"
// 	// },

// 	{
// 	  "$match":{
// 	  	label: "Age (Years)",
// 	  	type:"number",
// 	  	operation: "==",
// 	  	value: "4"
// 	   }
// 	},
// 	{
// 	  "$match":{
// 	  	label: "Age (Years)",
// 	  	type:"text",
// 	  	operation: "$starts-with",
// 	  	value: 4
// 	   }
// 	},
// 	{
// 		$limit: 5
// 	},
// 	{
// 		$sample: 5
// 	},
// 	{
// 	  "$match":{
// 	  	label: "Age (Years)",
// 	  	operation: "$ends-with",
// 	  	value: "4"
// 	   }
// 	},
// 	{
// 	  "$match":{
// 	  	label: "Age (Years)",
// 	  	operation: "$contains-str",
// 	  	value: "4"
// 	   }
// 	},
// 	{
// 	  "$match":{
// 	  	label: "Age (Years)",
// 	  	operation: "$in",
// 	  	value: [40]
// 	   }
// 	},
// 	{
// 	  "$match":{
// 	  	label: "Age (Years)",
// 	  	operation: "$not-in",
// 	  	value: [40]
// 	   }
// 	},
// 	{
// 	  "$match":{
// 	  	label: "Age (Years)",
// 	  	operation: "$contains-all",
// 	  	value: [40]
// 	   }
// 	},
// 	{
// 	  "$match":{
// 	  	label: "Age (Years)",
// 	  	operation: "$not-contains-all",
// 	  	value: [40]
// 	   }
// 	},
// 	{
// 	  "$match":{
// 	  	label: "Age (Years)",
// 	  	operation: "$contains-any",
// 	  	value: [40]
// 	   }
// 	},
// 	{
// 	  "$match":{
// 	  	label: "Age (Years)",
// 	  	operation: "$not-contains-any",
// 	  	value: [40]
// 	   }
// 	},
// 	{
// 	  "$match": {
// 	    label:"Sound Segmentation",
// 	    operation: "$is",
// 	    value: ["Segmented Heart Sound"]
// 	    }
// 	}
// ]
// ]  


const matchMapper = {
	
	"default": op => {
		let res = {
			$match:{}
		}
		res.$match[op.$match.label] = {}
		res.$match[op.$match.label][op.$match.operation] = (op.$match.type == "text") ? op.$match.value.toString() : Number.parseFloat(op.$match.value) 
		
		return [res]
	},

	"$eq": op => matchMapper.default(op),
	"$ne": op => matchMapper.default(op),
	"$lt": op => matchMapper.default(op),
	"$lte": op => matchMapper.default(op),
	"$gt": op => matchMapper.default(op),
	"$gte": op => matchMapper.default(op),
	
	"$starts-with": op => {
		let res = {
			$match:{}
		}
		res.$match[op.$match.label] = {
			$regex: `^${op.$match.value}`
		}

		return [res]
	},

	"$ends-with": op => {
		let res = {
			$match:{}
		}
		res.$match[op.$match.label] = {
			$regex: `${op.$match.value}"$"`
		} 
		return [res]
	},

	"$contains-str": op => {
		let res = {
			$match:{}
		}
		res.$match[op.$match.label] = {
			$regex: `${op.$match.value}`
		} 
		return [res]
	},

	"$in": op => {

		let res = {
			$match:{}
		}
		
		res.$match[op.$match.label] = {
			$in: op.$match.value	
		}
		return 	[res]
	},

	"$not-in": op => {

		let res = {
			$match:{}
		}
		
		res.$match[op.$match.label] = {
			$not:{
				$in: op.$match.value	
			}
		}
		return 	[res]
	},

	"$contains-all": op => {
		let res = {
			$match:{}
		}
		res.$match[op.$match.label] = {
			$all: op.$match.value
		}
		return [res]
	},

	"$not-contains-all": op => {

		let res = {
			$match:{}
		}
		res.$match[op.$match.label] = {
			$not:{
				$all: op.$match.value
			}	
		}

		return [res]
		
	},
	
	"$contains-any": op => {

		let res = {
					$match:{
						$expr:{
							$gt:[
								{
									$size:{
										$setIntersection:[
											`\$${op.$match.label}`,
											op.$match.value
										]
									}		
								},
								0
							]
						}
					}
				}

		return [res]
	
	},

	"$not-contains-any": op => {
		let res = {
			$match:{
				$expr:{
					$eq:[
						{
							$size:{
								$setIntersection:[
									`\$${op.$match.label}`,
									op.$match.value
								]
							}		
						},
						0
					]
				}
			}
		}

		return [res]

	},

	"$is": op => {

		let res = {
			$match:{}
		}
		
		res.$match[op.$match.label] = {
			$all: op.$match.value,
			$size: op.$match.value.length
		}

		return [res]

	}

}

const getOperation = o => {
	
	let res = o.$match.operation
	res = (lookups[res]) ? lookups[res] : res
	return res

}



const normalizeMatch = op => {
	op.$match.operation = getOperation(op)
	let mapper = matchMapper[op.$match.operation]
	if(!mapper) throw new Error(`Query Builder on:\n ${JSON.stringify(op, null," ")}\n Operation type "${getOperation(op)}" not supported.`)
	return mapper(op)
}	 


const resolveSource = (context, collection) => {
	return 	find(context.collections, c => c == collection)
			||
			find(context.temp, c => c == `${context.id}-${collection}`)
}


const lookups = {
	"==": "$eq",
	"!=": "$ne",
	">": "$gt",
	"<": "$lt",
	">=": "$gte",
	"<=": "$lte"
}



const lookupKeys = o => {
	let res 
	
	if(isArray(o)){
		res = o.map( obj => lookupKeys(obj))
	} else {
		if(isObject(o)){
			res = extend({}, o)
			keys(res).forEach(key => {
				res[key] = lookupKeys(res[key])
			})
			res = mapKeys(res, (v,k) => (lookups[k]) ? lookups[k] : k)
		} else {
			res = o
		}	
	}
	return res
}


const operationMapper = {
	
	$match: (context, op) =>  normalizeMatch(lookupKeys(op)),
	
	$limit: (context, op) =>  {
		let res = lookupKeys(op)
		return [{
			$limit: Number.parseFloat(op.$limit)
		}]
	},	
	
	$sample: (context, op) => {
		let res = lookupKeys(op)
		return [{
			$sample:{
				size: Number.parseFloat(res.$sample)
			}
		}]
	},

	$project: (context, op) => {
		let res = {
			$project: {
				_id: 0		
			} 
		}
		op.$project.forEach( f => {
			res.$project[f] = 1
		})

		return [res]
	},

	

	$hist: (context, op) => {
		let res = {
			$facet: {
			} 
		}
		op.$hist.forEach( f => {
			res.$facet[f] = [
				{
					$unwind:{
			            path: `$${f}`,
			            preserveNullAndEmptyArrays: true
			        }
			    }, 
				{
			      "$group": {
			       "_id": `$${f}`,
			       "count": {
			        "$count": {}
			       }
			      }
			     },
			    {
			      "$project": {
			       "_id": 0,
			       "value": "$_id",
			       "count": "$count"
			      }
			    }
			]    
    		
		})

		return [res]
	},
	
	$count: (context, op) => {
		let res = {$count: "count"}
		return [res]
	},
	
	$sort: (context, op)  => [lookupKeys(op)],
	
	$union: (context, op) => [
	  {
	    '$unionWith': {
	      'coll': resolveSource(context, op.$union)
	    }
	  }, {
	    '$group': {
	      '_id': '$_id', 
	      'records': {
	        '$push': '$$ROOT'
	      }
	    }
	  }, {
	    '$replaceRoot': {
	      'newRoot': {
	        '$arrayElemAt': [
	          '$records', 0
	        ]
	      }
	    }
	  }
	],

	
	$intersect: (context, op) => [
	  {
	    '$unionWith': {
	      'coll': resolveSource(context, op.$intersect)
	    }
	  }, {
	    '$group': {
	      '_id': '$_id', 
	      'records': {
	        '$push': '$$ROOT'
	      }
	    }
	  }, {
	    '$match': {
	      'records': {
	        '$size': 2
	      }
	    }
	  }, {
	    '$replaceRoot': {
	      'newRoot': {
	        '$arrayElemAt': [
	          '$records', 0
	        ]
	      }
	    }
	  }
	],

	$minus: (context, op) => [
	  {
	    '$unionWith': {
	      'coll': resolveSource(context, op.$minus)
	    }
	  }, {
	    '$group': {
	      '_id': '$_id', 
	      'records': {
	        '$push': '$$ROOT'
	      }
	    }
	  }, {
	    '$match': {
	      'records': {
	        '$size': 1
	      }, 
	      'records.0.__collection': resolveSource(context, context.collection)
	    }
	  }, {
	    '$replaceRoot': {
	      'newRoot': {
	        '$arrayElemAt': [
	          '$records', 0
	        ]
	      }
	    }
	  }
	],
	
	$unique: (context, op) => [
	    {
	        '$group': {
	            '_id': `\$${op.$unique}`, 
	            'records': {
	                '$push': '$$ROOT'
	            }
	        }
	    }, {
	        '$replaceRoot': {
	            'newRoot': {
	                '$arrayElemAt': [
	                    '$records', 0
	                ]
	            }
	        }
	    }
	],


}



const normalizeOperation = (context, operation) => {
	console.log(keys(operation)[0], operationMapper[keys(operation)[0]])
	let mapper = operationMapper[keys(operation)[0]]
	if(!mapper) throw new Error(`Query Builder on:\n ${JSON.stringify(op, null," ")}\n Statement type "${getOperation(operation)}" not supported.`)
	return mapper(context,operation)
}	

const buildPipeline = (context, query) => {
	
	let tempTable
	let collection
	let pipeline = []
	let source
	context.temp = context.temp || [] 


	query.forEach( operation  => {
		
		if( operation.$out ){
			tempTable = `${context.id}-${operation.$out}`
			context.temp.push(`${context.id}-${operation.$out}`)
			return
		}

		if( operation.$from ){
			
			source = {
				context,
				collection: resolveSource(context, operation.$from),
				pipeline: []
			}
			
			context.collection = source.collection
			return
		}
		
		if( operation.$union ){
			pipeline = pipeline.concat(normalizeOperation(context,operation))
			return
		}

		if( operation.$intersect ){
			pipeline = pipeline.concat(normalizeOperation(context,operation))
			return
		}

		if( operation.$minus ){
			pipeline = pipeline.concat(normalizeOperation(context,operation))
			return
		}

		if( operation.$unique ){
			pipeline = pipeline.concat(normalizeOperation(context,operation))
			return
		}		

		if( operation.$match ){
			pipeline = pipeline.concat(normalizeOperation(context,operation))
			return
		}

		if( operation.$project ){
			pipeline = pipeline.concat(normalizeOperation(context,operation))
			return
		}

		if( operation.$hist ){
			pipeline = pipeline.concat(normalizeOperation(context,operation))
			return
		}

		if( operation.$sort ){
			pipeline = pipeline.concat(normalizeOperation(context,operation))
			return
		}

		if( operation.$limit ){
			pipeline = pipeline.concat(normalizeOperation(context,operation))
			return
		}

		if( operation.$sample ){
			pipeline = pipeline.concat(normalizeOperation(context,operation))
			return
		}

		if( operation.$count ){
			pipeline = pipeline.concat(normalizeOperation(context,operation))
			return
		}
		

		throw new Error(`Query Builder on:\n ${JSON.stringify(operation, null," ")}\n Statement not supported.`)

	})


	collection = source.collection
	pipeline = source.pipeline.concat(pipeline)
	if(tempTable){
		pipeline = pipeline.concat([{
			$out: tempTable
		}])	
	}

	return {
		context,
		collection,
		pipeline
	}

}



module.exports = buildPipeline




// let context = {
// 	id: uuid(),
// 	collections:["harvest1",],
// 	// temp:["b800a3e5-2268-4e25-90fb-351c0d222309-B"]
// }
// context.temp = [`${context.id}-B`]

// // console.log(JSON.stringify(lookupKeys(query[0]), null, " "))
// console.log(JSON.stringify(buildPipeline(context, query[0]), null, " "))





// // const availableOperations = {
// // 	"number": ["==","!=","<","<=",">",">="],
// // 	"text": ["==","!=","$starts-with","$ends-with","$contains-str"],
// // 	"oneOf": ["$in","$not-in"],
// // 	"manyOf":["$contains-all", "$not-contains-all","$contains-any","$not-contains-any","$is"]
// // }	

// // const uuid = require("uuid").v4
// // const { find, mapKeys, extend, isObject, isArray, isString, keys, last, first } = require("lodash")



// // let query = [
// // [
// // 	// {
// // 	//   "$out":"A"
// // 	// },
// // 	{
// // 	  	$from: "harvest1"
// // 	},
// // 	// {
// // 	//   	$union: "A"
// // 	// },
	
// // 	// {
// // 	//   	$intersect: "A"
// // 	// },

// // 	// {
// // 	//   	$minus: "A"
// // 	// },

// // 	// {
// // 	// 	$unique: "Examination ID"
// // 	// },

// // 	{
// // 	  "$match":{
// // 	  	label: "Age (Years)",
// // 	  	operation: "==",
// // 	  	value: 4
// // 	   }
// // 	},
// // 	{
// // 	  "$match":{
// // 	  	label: "Age (Years)",
// // 	  	operation: "$starts-with",
// // 	  	value: "4"
// // 	   }
// // 	},
// // 	{
// // 	  "$match":{
// // 	  	label: "Age (Years)",
// // 	  	operation: "$ends-with",
// // 	  	value: "4"
// // 	   }
// // 	},
// // 	{
// // 	  "$match":{
// // 	  	label: "Age (Years)",
// // 	  	operation: "$contains-str",
// // 	  	value: "4"
// // 	   }
// // 	},
// // 	{
// // 	  "$match":{
// // 	  	label: "Age (Years)",
// // 	  	operation: "$in",
// // 	  	value: [40]
// // 	   }
// // 	},
// // 	{
// // 	  "$match":{
// // 	  	label: "Age (Years)",
// // 	  	operation: "$not-in",
// // 	  	value: [40]
// // 	   }
// // 	},
// // 	{
// // 	  "$match":{
// // 	  	label: "Age (Years)",
// // 	  	operation: "$contains-all",
// // 	  	value: [40]
// // 	   }
// // 	},
// // 	{
// // 	  "$match":{
// // 	  	label: "Age (Years)",
// // 	  	operation: "$not-contains-all",
// // 	  	value: [40]
// // 	   }
// // 	},
// // 	{
// // 	  "$match":{
// // 	  	label: "Age (Years)",
// // 	  	operation: "$contains-any",
// // 	  	value: [40]
// // 	   }
// // 	},
// // 	{
// // 	  "$match":{
// // 	  	label: "Age (Years)",
// // 	  	operation: "$not-contains-any",
// // 	  	value: [40]
// // 	   }
// // 	},
// // 	{
// // 	  "$match": {
// // 	    label:"Sound Segmentation",
// // 	    operation: "$is",
// // 	    value: ["Segmented Heart Sound"]
// // 	    }
// // 	}
// // ]
// // ]  


// const matchMapper = {
	
// 	"default": op => {
// 		let res = {
// 			$match:{}
// 		}
// 		res.$match[op.$match.label] = {}
// 		res.$match[op.$match.label][op.$match.operation] = op.$match.value
		
// 		return [res]
// 	},

// 	"$eq": op => matchMapper.default(op),
// 	"$ne": op => matchMapper.default(op),
// 	"$lt": op => matchMapper.default(op),
// 	"$lte": op => matchMapper.default(op),
// 	"$gt": op => matchMapper.default(op),
// 	"$gte": op => matchMapper.default(op),
	
// 	"$starts-with": op => {
// 		let res = {
// 			$match:{}
// 		}
// 		res.$match[op.$match.label] = {
// 			$regex: "^" + op.$match.value
// 		}

// 		return [res]
// 	},

// 	"$ends-with": op => {
// 		let res = {
// 			$match:{}
// 		}
// 		res.$match[op.$match.label] = {
// 			$regex: op.$match.value + "$"
// 		} 
// 		return [res]
// 	},

// 	"$contains-str": op => {
// 		let res = {
// 			$match:{}
// 		}
// 		res.$match[op.$match.label] = {
// 			$regex: op.$match.value
// 		} 
// 		return [res]
// 	},

// 	"$in": op => matchMapper.default(op),

// 	"$not-in": op => {

// 		let res = {
// 			$match:{}
// 		}
		
// 		res.$match[op.$match.label] = {
// 			$not:{
// 				$in: op.$match.value	
// 			}
// 		}
// 		return 	[res]
// 	},

// 	"$contains-all": op => {
// 		let res = {
// 			$match:{}
// 		}
// 		res.$match[op.$match.label] = {
// 			$all: op.$match.value
// 		}
// 		return [res]
// 	},

// 	"$not-contains-all": op => {

// 		let res = {
// 			$match:{}
// 		}
// 		res.$match[op.$match.label] = {
// 			$not:{
// 				$all: op.$match.value
// 			}	
// 		}

// 		return [res]
		
// 	},
	
// 	"$contains-any": op => {

// 		let res = {
// 					$match:{
// 						$expr:{
// 							$gt:[
// 								{
// 									$size:{
// 										$setIntersection:[
// 											`\$${op.$match.label}`,
// 											op.$match.value
// 										]
// 									}		
// 								},
// 								0
// 							]
// 						}
// 					}
// 				}

// 		return [res]
	
// 	},

// 	"$not-contains-any": op => {
// 		let res = {
// 			$match:{
// 				$expr:{
// 					$eq:[
// 						{
// 							$size:{
// 								$setIntersection:[
// 									`\$${op.$match.label}`,
// 									op.$match.value
// 								]
// 							}		
// 						},
// 						0
// 					]
// 				}
// 			}
// 		}

// 		return [res]

// 	},

// 	"$is": op => {

// 		let res = {
// 			$match:{}
// 		}
		
// 		res.$match[op.$match.label] = {
// 			$all: op.$match.value,
// 			$size: op.$match.value.length
// 		}

// 		return [res]

// 	}

// }

// const getOperation = o => {
	
// 	let res = o.$match.operation
// 	res = (lookups[res]) ? lookups[res] : res
// 	return res

// }



// const normalizeMatch = op => {
// 	op.$match.operation = getOperation(op)
// 	let mapper = matchMapper[op.$match.operation]
// 	if(!mapper) throw new Error(`Query Builder on:\n ${JSON.stringify(op, null," ")}\n Operation type "${getOperation(op)}" not supported.`)
// 	return mapper(op)
// }	 


// const resolveSource = (context, collection) => {
// 	return 	find(context.collections, c => c == collection)
// 			||
// 			find(context.temp, c => c == `${context.id}-${collection}`)
// }


// const lookups = {
// 	"==": "$eq",
// 	"!=": "$ne",
// 	">": "$gt",
// 	"<": "$lt",
// 	">=": "$gte",
// 	"<=": "$lte"
// }



// const lookupKeys = o => {
// 	let res 
	
// 	if(isArray(o)){
// 		res = o.map( obj => lookupKeys(obj))
// 	} else {
// 		if(isObject(o)){
// 			res = extend({}, o)
// 			keys(res).forEach(key => {
// 				res[key] = lookupKeys(res[key])
// 			})
// 			res = mapKeys(res, (v,k) => (lookups[k]) ? lookups[k] : k)
// 		} else {
// 			res = o
// 		}	
// 	}
// 	return res
// }


// const operationMapper = {
	
// 	$match: (context, op) =>  normalizeMatch(lookupKeys(op)),
	
// 	$limit: (context, op) =>  [lookupKeys(op)],
	
// 	$sample: (context, op) => {
// 		let res = lookupKeys(op)
// 		return [{
// 			$sample:{
// 				size: res.$sample
// 			}
// 		}]
// 	},

// 	$project: (context, op) => {
// 		let res = {
// 			$project: {
// 				_id: 0		
// 			} 
// 		}
// 		op.$project.forEach( f => {
// 			res.$project[f] = 1
// 		})

// 		return [res]
// 	},
	
// 	$sort: (context, op)  => [lookupKeys(op)],
	
// 	$union: (context, op) => [
// 	  {
// 	    '$unionWith': {
// 	      'coll': resolveSource(context, op.$union)
// 	    }
// 	  }, {
// 	    '$group': {
// 	      '_id': '$_id', 
// 	      'records': {
// 	        '$push': '$$ROOT'
// 	      }
// 	    }
// 	  }, {
// 	    '$replaceRoot': {
// 	      'newRoot': {
// 	        '$arrayElemAt': [
// 	          '$records', 0
// 	        ]
// 	      }
// 	    }
// 	  }
// 	],

	
// 	$intersect: (context, op) => [
// 	  {
// 	    '$unionWith': {
// 	      'coll': resolveSource(context, op.$intersect)
// 	    }
// 	  }, {
// 	    '$group': {
// 	      '_id': '$_id', 
// 	      'records': {
// 	        '$push': '$$ROOT'
// 	      }
// 	    }
// 	  }, {
// 	    '$match': {
// 	      'records': {
// 	        '$size': 2
// 	      }
// 	    }
// 	  }, {
// 	    '$replaceRoot': {
// 	      'newRoot': {
// 	        '$arrayElemAt': [
// 	          '$records', 0
// 	        ]
// 	      }
// 	    }
// 	  }
// 	],

// 	$minus: (context, op) => [
// 	  {
// 	    '$unionWith': {
// 	      'coll': resolveSource(context, op.$minus)
// 	    }
// 	  }, {
// 	    '$group': {
// 	      '_id': '$_id', 
// 	      'records': {
// 	        '$push': '$$ROOT'
// 	      }
// 	    }
// 	  }, {
// 	    '$match': {
// 	      'records': {
// 	        '$size': 1
// 	      }, 
// 	      'records.0.__collection': resolveSource(context, context.collection)
// 	    }
// 	  }, {
// 	    '$replaceRoot': {
// 	      'newRoot': {
// 	        '$arrayElemAt': [
// 	          '$records', 0
// 	        ]
// 	      }
// 	    }
// 	  }
// 	],
	
// 	$unique: (context, op) => [
// 	    {
// 	        '$group': {
// 	            '_id': `\$${op.$unique}`, 
// 	            'records': {
// 	                '$push': '$$ROOT'
// 	            }
// 	        }
// 	    }, {
// 	        '$replaceRoot': {
// 	            'newRoot': {
// 	                '$arrayElemAt': [
// 	                    '$records', 0
// 	                ]
// 	            }
// 	        }
// 	    }
// 	],


// }



// const normalizeOperation = (context, operation) => {
// 	let mapper = operationMapper[keys(operation)[0]]
// 	if(!mapper) throw new Error(`Query Builder on:\n ${JSON.stringify(op, null," ")}\n Statement type "${getOperation(operation)}" not supported.`)
// 	return mapper(context,operation)
// }	

// const buildPipeline = (context, query) => {
	
// 	let tempTable
// 	let collection
// 	let pipeline = []
// 	let source
// 	context.temp = context.temp || [] 


// 	query.forEach( operation  => {
		
// 		if( operation.$out ){
// 			tempTable = `${context.id}-${operation.$out}`
// 			context.temp.push(`${context.id}-${operation.$out}`)
// 			return
// 		}

// 		if( operation.$from ){
			
// 			source = {
// 				context,
// 				collection: resolveSource(context, operation.$from),
// 				pipeline: []
// 			}
			
// 			context.collection = source.collection
// 			return
// 		}
		
// 		if( operation.$union ){
// 			pipeline = pipeline.concat(normalizeOperation(context,operation))
// 			return
// 		}

// 		if( operation.$intersect ){
// 			pipeline = pipeline.concat(normalizeOperation(context,operation))
// 			return
// 		}

// 		if( operation.$minus ){
// 			pipeline = pipeline.concat(normalizeOperation(context,operation))
// 			return
// 		}

// 		if( operation.$unique ){
// 			pipeline = pipeline.concat(normalizeOperation(context,operation))
// 			return
// 		}		

// 		if( operation.$match ){
// 			pipeline = pipeline.concat(normalizeOperation(context,operation))
// 			return
// 		}

// 		if( operation.$project ){
// 			pipeline = pipeline.concat(normalizeOperation(context,operation))
// 			return
// 		}

// 		if( operation.$sort ){
// 			pipeline = pipeline.concat(normalizeOperation(context,operation))
// 			return
// 		}

// 		if( operation.$limit ){
// 			pipeline = pipeline.concat(normalizeOperation(context,operation))
// 			return
// 		}

// 		if( operation.$sample ){
// 			pipeline = pipeline.concat(normalizeOperation(context,operation))
// 			return
// 		}

// 		throw new Error(`Query Builder on:\n ${JSON.stringify(operation, null," ")}\n Statement not supported.`)

// 	})


// 	collection = source.collection
// 	pipeline = source.pipeline.concat(pipeline)
// 	if(tempTable){
// 		pipeline = pipeline.concat([{
// 			$out: tempTable
// 		}])	
// 	}

// 	return {
// 		context,
// 		collection,
// 		pipeline
// 	}

// }



// module.exports = buildPipeline




// // let context = {
// // 	id: uuid(),
// // 	collections:["harvest1",],
// // 	// temp:["b800a3e5-2268-4e25-90fb-351c0d222309-B"]
// // }
// // context.temp = [`${context.id}-B`]

// // // console.log(JSON.stringify(lookupKeys(query[0]), null, " "))
// // console.log(JSON.stringify(buildPipeline(context, query[0]), null, " "))





// // const availableOperations = {
// // 	"number": ["==","!=","<","<=",">",">="],
// // 	"text": ["==","!=","$starts-with","$ends-with","$contains-str"],
// // 	"oneOf": ["$in","$not-in"],
// // 	"manyOf":["$contains-all", "$not-contains-all","$contains-any","$not-contains-any","$is"]
// // }	




// // const uuid = require("uuid").v4
// // const { find, mapKeys, extend, isObject, isArray, isString, keys, last, first } = require("lodash")


// // const matchMapper = {
	
// // 	"$eq": op => [op],
// // 	"$ne": op => [op],
// // 	"$lt": op => [op],
// // 	"$lte": op => [op],
// // 	"$gt": op => [op],
// // 	"$gte": op => [op],
	
// // 	"$starts-with": op => {
// // 		let res = {
// // 			$match:{}
// // 		}
// // 		res.$match[`${keys(op.$match)[0]}`] = {
// // 			$regex: "^" + op.$match[`${keys(op.$match)[0]}`]["$starts-with"]
// // 		} 

// // 		return [res]
// // 	},

// // 	"$ends-with": op => {
// // 		let res = {
// // 			$match:{}
// // 		}
// // 		res.$match[`${keys(op.$match)[0]}`] = {
// // 			$regex: op.$match[`${keys(op.$match)[0]}`]["$ends-with"] + "$"
// // 		} 

// // 		return [res]
// // 	},

// // 	"$contains-str": op => {
// // 		let res = {
// // 			$match:{}
// // 		}
// // 		res.$match[`${keys(op.$match)[0]}`] = {
// // 			$regex: op.$match[`${keys(op.$match)[0]}`]["$contains-str"]
// // 		} 

// // 		return [res]
// // 	},

// // 	"$in": op => [op],

// // 	"$not-in": op => {

// // 		let res = extend({}, op)
		
// // 		res.$match[first(keys(op.$match))] = {
// // 			$not:{
// // 				$in: op.$match[first(keys(op.$match))]["$not-in"]	
// // 			}
// // 		}

// // 		return 	[res]
// // 	},

// // 	"$contains-all": op => {
// // 		let res = {
// // 			$match:{}
// // 		}
// // 		res.$match[first(keys(op.$match))] = {
// // 			$all: op.$match[first(keys(op.$match))]["$contains-all"]
// // 		}

// // 		return [res]
// // 	},

// // 	"$not-contains-all": op => {

// // 		let res = {
// // 			$match:{}
// // 		}
// // 		res.$match[first(keys(op.$match))] = {
// // 			$not:{
// // 				$all: op.$match[first(keys(op.$match))]["$not-contains-all"]
// // 			}	
// // 		}

// // 		return [res]
		
// // 	},
	
// // 	"$contains-any": op => {

// // 		let res = {
// // 					$match:{
// // 						$expr:{
// // 							$gt:[
// // 								{
// // 									$size:{
// // 										$setIntersection:[
// // 											`\$${first(keys(op.$match))}`,
// // 											op.$match[first(keys(op.$match))]["$contains-any"]
// // 										]
// // 									}		
// // 								},
// // 								0
// // 							]
// // 						}
// // 					}
// // 				}

// // 		return [res]
	
// // 	},

// // 	"$not-contains-any": op => {
// // 		let res = {
// // 			$match:{
// // 				$expr:{
// // 					$eq:[
// // 						{
// // 							$size:{
// // 								$setIntersection:[
// // 									`\$${first(keys(op.$match))}`,
// // 									op.$match[first(keys(op.$match))]["$not-contains-any"]
// // 								]
// // 							}		
// // 						},
// // 						0
// // 					]
// // 				}
// // 			}
// // 		}

// // 		return [res]

// // 	},

// // 	"$is": op => {

// // 		let res = {
// // 			$match:{}
// // 		}
		
// // 		res.$match[first(keys(op.$match))] = {
// // 			$all: op.$match[first(keys(op.$match))]["$is"],
// // 			$size: op.$match[first(keys(op.$match))]["$is"].length
// // 		}

// // 		return [res]

// // 	}

// // }

// // const getOperation = o => {
	
// // 	const getPath = o => {
// // 		let k = keys(o)[0]
// // 		let res = [k].concat((isObject(o[k]) && !isArray(o[k])) ? getPath(o[k]) : [])
// // 		return res
// // 	}

// // 	return last(getPath(o))
// // }



// // const normalizeMatch = op => {
// // 	let mapper = matchMapper[getOperation(op)]
// // 	if(!mapper) throw new Error(`Query Builder on:\n ${JSON.stringify(op, null," ")}\n Operation type "${getOperation(op)}" not supported.`)
// // 	return mapper(op)
// // }	 


// // const resolveSource = (context, collection) => {
// // 	return 	find(context.collections, c => c == collection)
// // 			||
// // 			find(context.temp, c => c == `${context.id}-${collection}`)
// // }


// // const lookups = {
// // 	"==": "$eq",
// // 	"!=": "$ne",
// // 	">": "$gt",
// // 	"<": "$lt",
// // 	">=": "$gte",
// // 	"<=": "$lte"
// // }



// // const lookupKeys = o => {
// // 	let res 
	
// // 	if(isArray(o)){
// // 		res = o.map( obj => lookupKeys(obj))
// // 	} else {
// // 		if(isObject(o)){
// // 			res = extend({}, o)
// // 			keys(res).forEach(key => {
// // 				res[key] = lookupKeys(res[key])
// // 			})
// // 			res = mapKeys(res, (v,k) => (lookups[k]) ? lookups[k] : k)
// // 		} else {
// // 			res = o
// // 		}	
// // 	}
// // 	return res
// // }


// // const operationMapper = {
	
// // 	$match: (context, op) =>  normalizeMatch(lookupKeys(op)),
	
// // 	$limit: (context, op) =>  [lookupKeys(op)],
	
// // 	$sample: (context, op) => {
// // 		let res = lookupKeys(op)
// // 		return [{
// // 			$sample:{
// // 				size: res.$sample
// // 			}
// // 		}]
// // 	},

// // 	$project: (context, op) => {
// // 		let res = {
// // 			$project: {
// // 				_id: 0		
// // 			} 
// // 		}
// // 		op.$project.forEach( f => {
// // 			res.$project[f] = 1
// // 		})

// // 		return [res]
// // 	},
	
// // 	$sort: (context, op)  => [lookupKeys(op)],
	
// // 	$union: (context, op) => [
// // 	  {
// // 	    '$unionWith': {
// // 	      'coll': resolveSource(context, op.$union)
// // 	    }
// // 	  }, {
// // 	    '$group': {
// // 	      '_id': '$_id', 
// // 	      'records': {
// // 	        '$push': '$$ROOT'
// // 	      }
// // 	    }
// // 	  }, {
// // 	    '$replaceRoot': {
// // 	      'newRoot': {
// // 	        '$arrayElemAt': [
// // 	          '$records', 0
// // 	        ]
// // 	      }
// // 	    }
// // 	  }
// // 	],

	
// // 	$intersect: (context, op) => [
// // 	  {
// // 	    '$unionWith': {
// // 	      'coll': resolveSource(context, op.$intersect)
// // 	    }
// // 	  }, {
// // 	    '$group': {
// // 	      '_id': '$_id', 
// // 	      'records': {
// // 	        '$push': '$$ROOT'
// // 	      }
// // 	    }
// // 	  }, {
// // 	    '$match': {
// // 	      'records': {
// // 	        '$size': 2
// // 	      }
// // 	    }
// // 	  }, {
// // 	    '$replaceRoot': {
// // 	      'newRoot': {
// // 	        '$arrayElemAt': [
// // 	          '$records', 0
// // 	        ]
// // 	      }
// // 	    }
// // 	  }
// // 	],

// // 	$minus: (context, op) => [
// // 	  {
// // 	    '$unionWith': {
// // 	      'coll': resolveSource(context, op.$minus)
// // 	    }
// // 	  }, {
// // 	    '$group': {
// // 	      '_id': '$_id', 
// // 	      'records': {
// // 	        '$push': '$$ROOT'
// // 	      }
// // 	    }
// // 	  }, {
// // 	    '$match': {
// // 	      'records': {
// // 	        '$size': 1
// // 	      }, 
// // 	      'records.0.__collection': resolveSource(context, context.collection)
// // 	    }
// // 	  }, {
// // 	    '$replaceRoot': {
// // 	      'newRoot': {
// // 	        '$arrayElemAt': [
// // 	          '$records', 0
// // 	        ]
// // 	      }
// // 	    }
// // 	  }
// // 	],
	
// // 	$unique: (context, op) => [
// // 	    {
// // 	        '$group': {
// // 	            '_id': `\$${op.$unique}`, 
// // 	            'records': {
// // 	                '$push': '$$ROOT'
// // 	            }
// // 	        }
// // 	    }, {
// // 	        '$replaceRoot': {
// // 	            'newRoot': {
// // 	                '$arrayElemAt': [
// // 	                    '$records', 0
// // 	                ]
// // 	            }
// // 	        }
// // 	    }
// // 	],


// // }



// // const normalizeOperation = (context, operation) => {
// // 	let mapper = operationMapper[keys(operation)[0]]
// // 	if(!mapper) throw new Error(`Query Builder on:\n ${JSON.stringify(op, null," ")}\n Statement type "${getOperation(operation)}" not supported.`)
// // 	return mapper(context,operation)
// // }	

// // const buildPipeline = (context, query) => {
	
// // 	let tempTable
// // 	let collection
// // 	let pipeline = []
// // 	let source
// // 	context.temp = context.temp || [] 


// // 	query.forEach( operation  => {
		
// // 		if( operation.$out ){
// // 			tempTable = `${context.id}-${operation.$out}`
// // 			context.temp.push(`${context.id}-${operation.$out}`)
// // 			return
// // 		}

// // 		if( operation.$from ){
			
// // 			source = {
// // 				context,
// // 				collection: resolveSource(context, operation.$from),
// // 				pipeline: []
// // 			}
			
// // 			context.collection = source.collection
// // 			return
// // 		}
		
// // 		if( operation.$union ){
// // 			pipeline = pipeline.concat(normalizeOperation(context,operation))
// // 			return
// // 		}

// // 		if( operation.$intersect ){
// // 			pipeline = pipeline.concat(normalizeOperation(context,operation))
// // 			return
// // 		}

// // 		if( operation.$minus ){
// // 			pipeline = pipeline.concat(normalizeOperation(context,operation))
// // 			return
// // 		}

// // 		if( operation.$unique ){
// // 			pipeline = pipeline.concat(normalizeOperation(context,operation))
// // 			return
// // 		}		

// // 		if( operation.$match ){
// // 			pipeline = pipeline.concat(normalizeOperation(context,operation))
// // 			return
// // 		}

// // 		if( operation.$project ){
// // 			pipeline = pipeline.concat(normalizeOperation(context,operation))
// // 			return
// // 		}

// // 		if( operation.$sort ){
// // 			pipeline = pipeline.concat(normalizeOperation(context,operation))
// // 			return
// // 		}

// // 		if( operation.$limit ){
// // 			pipeline = pipeline.concat(normalizeOperation(context,operation))
// // 			return
// // 		}

// // 		if( operation.$sample ){
// // 			pipeline = pipeline.concat(normalizeOperation(context,operation))
// // 			return
// // 		}

// // 		throw new Error(`Query Builder on:\n ${JSON.stringify(operation, null," ")}\n Statement not supported.`)

// // 	})


// // 	collection = source.collection
// // 	pipeline = source.pipeline.concat(pipeline)
// // 	if(tempTable){
// // 		pipeline = pipeline.concat([{
// // 			$out: tempTable
// // 		}])	
// // 	}

// // 	return {
// // 		context,
// // 		collection,
// // 		pipeline
// // 	}

// // }



// // module.exports = buildPipeline




// // // let context = {
// // // 	id: uuid(),
// // // 	collections:["harvest1",],
// // // 	// temp:["b800a3e5-2268-4e25-90fb-351c0d222309-B"]
// // // }
// // // context.temp = [`${context.id}-B`]

// // // // console.log(JSON.stringify(lookupKeys(query[0]), null, " "))
// // // console.log(JSON.stringify(buildPipeline(context, query[0]), null, " "))


