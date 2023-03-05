const mongodb = require("./mongodb")
const {extend, sortBy, uniq, flattenDeep, minBy} = require("lodash")


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

const getTasks = async (req, res) => {
	try {

		let options = req.body.options
		
				options.pipeline = [
					  {
					    '$sort': {
					      'Examination ID': 1
					    }
					  }, {
					    '$group': {
					      '_id': {
					        'Examination ID': '$Examination ID', 
					        'TODO': '$TODO'
					      }, 
					      'count': {
					        '$count': {}
					      }, 
					      '1st expert': {
					        '$addToSet': '$1st expert'
					      }, 
					      '2nd expert': {
					        '$addToSet': '$2nd expert'
					      }, 
					      'CMO': {
					        '$addToSet': '$CMO'
					      }, 
					      'updates': {
					        '$push': {
					          'updated at': '$updated at', 
					          'updated by': '$updated by'
					        }
					      }
					    }
					  }, {
					    '$project': {
					      'Examination ID': '$_id.Examination ID', 
					      'TODO': '$_id.TODO', 
					      'count': 1, 
					      '1st expert': 1, 
					      '2nd expert': 1, 
					      'CMO': 1, 
					      'updates': 1
					    }
					  }, {
					    '$group': {
					      '_id': {
					        'Examination ID': '$Examination ID'
					      }, 
					      'stat': {
					        '$addToSet': {
					          'TODO': '$TODO', 
					          'count': '$count'
					        }
					      }, 
					      '1st expert': {
					        '$addToSet': '$1st expert'
					      }, 
					      '2nd expert': {
					        '$addToSet': '$2nd expert'
					      }, 
					      'CMO': {
					        '$addToSet': '$CMO'
					      }, 
					      'updates': {
					        '$addToSet': '$updates'
					      }
					    }
					  }, {
					    '$project': {
					      'Examination ID': '$_id.Examination ID', 
					      'stat': 1, 
					      '1st expert': {
					        '$reduce': {
					          'input': '$1st expert', 
					          'initialValue': [], 
					          'in': {
					            '$setUnion': [
					              '$$value', '$$this'
					            ]
					          }
					        }
					      }, 
					      '2nd expert': {
					        '$reduce': {
					          'input': '$2nd expert', 
					          'initialValue': [], 
					          'in': {
					            '$setUnion': [
					              '$$value', '$$this'
					            ]
					          }
					        }
					      }, 
					      'CMO': {
					        '$reduce': {
					          'input': '$CMO', 
					          'initialValue': [], 
					          'in': {
					            '$setUnion': [
					              '$$value', '$$this'
					            ]
					          }
					        }
					      }, 
					      '_id': 0, 
					      'updates': {
					        '$arrayElemAt': [
					          '$updates', 0
					        ]
					      }
					    }
					  }, {
					    '$lookup': {
					      'from': options.db.examinationCollection, 
					      'localField': 'Examination ID', 
					      'foreignField': 'patientId', 
					      'as': 'examinationState'
					    }
					  }, {
					    '$project': {
					      'Examination ID': 1, 
					      'state': {
					        '$first': '$examinationState.state'
					      }, 
					      'stat': 1, 
					      '1st expert': 1, 
					      '2nd expert': 1, 
					      'CMO': 1, 
					      '_id': 0, 
					      'updates': 1
					    }
					  }, {
					    '$sort': {
					      'Examination ID': 1
					    }
					  }
					]



		options.userFilter = (options.me)
        ? [
            {
                '$match': {
                  '$or': [
                    {
                      'updated by': options.me
                    }, {
                      '1st expert': options.me
                    }, {
                      '2nd expert': options.me
                    }, {
                      'CMO': options.me
                    }
                  ]
                }
            }    
        ]
        : []

        options.pageFilter = [
	        {
	            '$skip': options.eventData.skip
	        }, {
	            '$limit': options.eventData.limit
	        }
	    ]    
        
	    options.countPipeline = [
	        { $count: 'count'},
	        { $project: {_id: 0} }
	    ]

	    let count  = await mongodb.aggregate(extend({}, options, {
	    	collection: `${options.db.name}.${options.db.labelingCollection}`,
	    	pipeline: 	options.excludeFilter
	    				.concat(options.eventData.filter)
		                .concat(options.userFilter)
		                .concat(options.pipeline)
		                .concat(options.countPipeline)
	    }))
   
	    count = (count[0]) ? count[0].count : 0
    	
    	options.eventData = extend(options.eventData, {
        	total: count,
        	pagePosition: `${options.eventData.skip+1} - ${Math.min(options.eventData.skip + options.eventData.limit, count)} from ${count}`
    	})

    	const data = await mongodb.aggregate(extend({}, options, {
    		collection: `${options.db.name}.${options.db.labelingCollection}`,
	    	pipeline: options.excludeFilter
	    				.concat(options.eventData.filter)
		                .concat(options.userFilter)
		                .concat(options.pipeline)
		                .concat(options.pageFilter) 
    	}))	

    	const result = {
        	options,
        	collection: data.map( d => {
	            d["1st expert"] = sortBy(uniq(flattenDeep(d["1st expert"]))).filter( d => d)
	            d["2nd expert"] = sortBy(uniq(flattenDeep(d["2nd expert"]))).filter( d => d)
	            d["CMO"] = sortBy(uniq(flattenDeep(d["CMO"]))).filter( d => d)
	            d.Recordings = d.stat.map(d => d.count).reduce((a,s) => a+s, 0)
	            d.stat = {
	                stat: d.stat,
	                total: d.Recordings
	            }

	            d = extend(d, minBy(d.updates, d => d["updated at"]))
	            delete d.updates
	            return d
	        })
    	}

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



const getOrganizations = async (req, res) => {
	try {
		
		let options = req.body.options

		options = extend( {}, options, {
			collection: `${options.db.name}.${options.db.organizationCollection}`,
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



		options.pipeline = [
	        {
	            '$facet': {
	              'total': [
	                {
	                  '$count': 'count'
	                }
	              ], 
	              'examinations': [
	                {
	                  '$group': {
	                    '_id': {
	                      'Examination ID': '$Examination ID'
	                    }, 
	                    'ids': {
	                      '$addToSet': {}
	                    }
	                  }
	                }, {
	                  '$project': {
	                    'count': {
	                      '$size': '$ids'
	                    }, 
	                    '_id': 0
	                  }
	                }
	              ], 
	              'stat': [
	                {
	                  '$group': {
	                    '_id': {
	                      'TODO': '$TODO'
	                    }, 
	                    'count': {
	                      '$count': {}
	                    }
	                  }
	                }, {
	                  '$project': {
	                    'TODO': '$_id.TODO', 
	                    'count': 1, 
	                    '_id': 0
	                  }
	                }
	              ]
	            }
	          }, {
	            '$project': {
	              'total': {
	                '$first': '$total'
	              }, 
	              'stat': 1, 
	              'examinations': {
	                '$size': '$examinations'
	              }
	            }
	          }, {
	            '$project': {
	              'total': '$total.count', 
	              'stat': 1, 
	              'examinations': 1
	            }
	          }
	    ]
    
    	options.userFilter = (options.me)
	        ? [
	            {
	                '$match': {
	                  '$or': [
	                    {
	                      'updated by': options.me
	                    }, {
	                      '1st expert': options.me
	                    }, {
	                      '2nd expert': options.me
	                    }, {
	                      'CMO': options.me
	                    }
	                  ]
	                }
	            }    
	        ]
	        : []

		options = extend( {}, options, {
			collection: `${options.db.name}.${options.db.labelingCollection}`,
			pipeline: options.excludeFilter
	    				.concat(options.eventData.filter)
		                .concat(options.userFilter)
			            .concat(options.pipeline)
		})

		const result  = await mongodb.aggregate(options)

		res.send(result[0])	
	
	} catch (e) {
		res.send({ 
			error: e.toString(),
			requestBody: req.body
		})
	}
}


const getSyncStat = async (req, res) => {
	try {
		
		let options = req.body.options

		options.preparePipeline =
	        [
	          {
	            '$lookup': {
	              'from': options.db.userCollection, 
	              'localField': 'actorId', 
	              'foreignField': 'id', 
	              'as': 'physician'
	            }
	          }, {
	            '$lookup': {
	              'from': options.db.organizationCollection, 
	              'localField': 'organization', 
	              'foreignField': 'id', 
	              'as': 'organization'
	            }
	          }, {
	            '$project': {
	              '_id': 0, 
	              'Examination ID': '$patientId', 
	              'organization': {
	                '$arrayElemAt': [
	                  '$organization', 0
	                ]
	              }, 
	              'physician': {
	                '$arrayElemAt': [
	                  '$physician', 0
	                ]
	              }, 
	              "updatedAt":"$updatedAt",
	              "synchronizedAt":"$synchronizedAt",
	              'state': '$state', 
	              'validation': '$_validation'
	            }
	          }, {
	              $sort:{
	                  updatedAt: -1,
	                  organization: 1,
	                  state: 1
	              }
	          }
	        ]
    	
    	options.pipeline = 
	        [
	          {
	            '$group': {
	              '_id': '$state', 
	              'count': {
	                '$count': {}
	              }
	            }
	          }, {
	            '$project': {
	              '_id': 0, 
	              'state': '$_id', 
	              'count': '$count'
	            }
	          }
	        ]

		options = extend( {}, options, {
			collection: `${options.db.name}.${options.db.examinationCollection}`,
			pipeline: options.preparePipeline
			            .concat(options.syncFilter)
			            .concat(options.pipeline)
		})
		
		let result  = await mongodb.aggregate(options)
		
		result = {
	        total: result.map( d => d.count).reduce((s,d) => s+d,0),
	        stat: result,
	        options: options
	    }

	    res.send(result)

	} catch (e) {
		res.send({ 
			error: e.toString(),
			requestBody: req.body
		})
	}
}


const getSyncExaminations = async (req, res) => {
	try {
		
		let options = req.body.options
		
		options.pipeline = 
        	[
			  {
			    '$lookup': {
			      'from': options.db.userCollection, 
			      'localField': 'actorId', 
			      'foreignField': 'id', 
			      'as': 'physician'
			    }
			  }, {
			    '$lookup': {
			      'from': options.db.organizationCollection, 
			      'localField': 'organization', 
			      'foreignField': 'id', 
			      'as': 'organization'
			    }
			  }, {
			    '$project': {
			      '_id': 0, 
			      'Examination ID': '$patientId', 
			      'organization': {
			        '$arrayElemAt': [
			          '$organization', 0
			        ]
			      }, 
			      'physician': {
			        '$arrayElemAt': [
			          '$physician', 0
			        ]
			      }, 
			      "updatedAt":"$updatedAt",
			      "synchronizedAt":"$synchronizedAt",
			      'state': '$state', 
			      'validation': '$_validation',
			    }
			  }, {
			      $sort:{
			          updatedAt: -1,
			          organization: 1,
			          state: 1
			      }
			  }
			]
 
    
    	options.filter = []
        
    	options.pageFilter = [
	        {
	            '$skip': options.eventData.skip
	        }, {
	            '$limit': options.eventData.limit
	        }
	    ]    
    
    
	    options.countPipeline = [
	        { $count: 'count'},
	        { $project: {_id: 0} }
	    ]

	    let count = await mongodb.aggregate({
	    	db: options.db,
	    	collection: `${options.db.name}.${options.db.examinationCollection}`,
	    	pipeline: options.pipeline
                		.concat(options.syncFilter)
                		.concat(options.countPipeline)
	    })

	    count = (count[0]) ? count[0].count : 0
    	options.eventData = extend(options.eventData, {
	        total: count,
	        pagePosition: `${options.eventData.skip+1} - ${Math.min(options.eventData.skip + options.eventData.limit, count)} from ${count}`
	    })

    	const data = await mongodb.aggregate({
	    	db: options.db,
	    	collection: `${options.db.name}.${options.db.examinationCollection}`,
	    	pipeline: options.pipeline
		                .concat(options.syncFilter)
		                .concat(options.pageFilter)
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

const resolveTodo = r => {
    if(["Assign 2nd expert", "Assign 1st expert"].includes(r.TODO)){
        if(!r["1st expert"] && !r["2nd expert"]) return "Assign 2nd expert"
        if(!r["1st expert"] && r["2nd expert"]) return "Assign 1st expert"
        if( r["1st expert"] ) return "Continue Labeling"
    } else {
        return r.TODO
    }
}
    
const resolveAssigment = r => {
    switch (r.TODO) {
        case "Assign 2nd expert"    : 
            return r["CMO"]
            break
        case "Assign 1st expert"    : 
            return r["2nd expert"]
            break
        case "Continue Labeling"    : 
            return r["1st expert"]
            break
        case "Complete 2nd Stage"   : 
            return r["2nd expert"]
            break
        case "Complete Labeling"    : 
            return r["CMO"]
            break
        case "Finalized"            : 
            return ""
            break
    }
}


const updateTasks = async (req, res) => {
	try {
		
		let options = req.body.options
		let selection = req.body.selection
		let assignator = req.body.assignator

		let records = await mongodb.aggregate({
			db: options.db,
			collection: `${options.db.name}.${options.db.labelingCollection}`,
			pipeline: [
	          {
	            '$match': {
	              'Examination ID': {
	                '$in': selection
	              }
	            }
	          }, {
	            '$project': {
	              '_id': 0
	            }
	          }
	        ]
		})
    	
    	records = records.map( r => {
        
	        if( ["Assign 2nd expert", "Assign 1st expert"].includes(r.TODO) ){
	            r = extend({}, r, assignator)
	            r.TODO = resolveTodo(r)
	            r["assigned to"] = resolveAssigment(r)
	        } else {
	            r["1st expert"] =  (r["1st expert"]) ? r["1st expert"] : assignator["1st expert"]
	            r["2nd expert"] =  (r["2nd expert"]) ? r["2nd expert"] : assignator["2nd expert"]
	            r["updated at"] = assignator["updated at"]
	            r["updated by"] = assignator["updated by"]
	            r.TODO = resolveTodo(r)
	            r["assigned to"] = resolveAssigment(r)
	        }   
	    	console.log(r["updated at"], r["updated by"], assignator)    
	        return r    
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

	} catch (e) {
		res.send({ 
			error: e.toString(),
			requestBody: req.body
		})
	}
}		


	
module.exports = {
	getDatasetList,
	getTasks,
	getGrants,
	getStat,
	getSyncStat,
	getSyncExaminations,
	updateTasks,
	getOrganizations
}