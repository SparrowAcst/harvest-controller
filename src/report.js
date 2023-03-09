const mongodb = require("./mongodb")
const {extend, isArray, isString, keys, uniq, flatten, last, first, find} = require("lodash")
const buildQuery = require("./utils/parse-query")
const uuid = require("uuid").v4


const test = (req, res) => {
	res.send({response:"test"})
}

const runScript = async (req, res) => {
	try {
		
		let options = req.body.options

		let type = req.params.type || "table" // or "json"

		let pagination = options.pagination || {
            skip:0,
            limit:10
        }

        let script = req.body.script || []
        if (!script) throw new Error(`No script available`)
            
        let collections = await mongodb.listCollections(options)
        collections = collections.map( c => c.name)
        
        let context = {
            id: uuid(),
            collections,
            temp: []
        }

///////////////////////
        let $res
//////////////////////        
        let resultTempCollectionName

        for(let index = 0; index < script.length; index++){
            let query = buildQuery(context, script[index])
            context = query.context

            if(index == script.length-1){
                resultTempCollectionName = find( query.pipeline, s => s.$out)
                if(!resultTempCollectionName){
                    resultTempCollectionName = context.id
                    query.pipeline.push({
                        $out: resultTempCollectionName
                    })
                }                        
            }

            console.log(JSON.stringify(query, null, " "))
            console.log("resultTempCollectionName", resultTempCollectionName)
            
            // save into temp collection
            await mongodb.aggregate_raw({	
            	db: options.db,
            	collection: `${options.db.name}.${query.collection}`,
            	pipeline: query.pipeline
            })

            // $res.push({
            // 	script: script[index],
            // 	query
            // })

         }

            // TODO drop all temp collections

            // for(let index = 0; index< context.temp.length; index++){
            //     console.log("DROP TEMP", context.temp[index])
            //     await db.collection(context.temp[index]).drop()
            // }


            //  POST PROCESS RESULT TEMP COLLECTION
        
        
        let count = await mongodb.aggregate_raw({	
        	db: options.db,
        	collection: `${options.db.name}.${resultTempCollectionName}`,
        	pipeline: [
                { $count: 'count'},
                { $project: {_id: 0} }
            ]
        })

        count = (count[0]) ? count[0].count || 0 : 0
        
        $res = await mongodb.aggregate_raw({	
        	db: options.db, 
        	collection: `${options.db.name}.${resultTempCollectionName}`,
        	pipeline: (type == "table")
        		? [
	                { $skip: pagination.skip},
	                { $limit: pagination.limit},
	                { $project: {_id: 0} }
	            ]
	            : [{ $project: {_id: 0} }]
        })            
            
        for(let index = 0; index< context.temp.length; index++){
            console.log("DROP TEMP", context.temp[index])
            await mongodb.drop(extend({}, options, {
            	collection: `${options.db.name}.${context.temp[index]}`
            }))
             

        }

        await mongodb.drop(extend({}, options, {
            	collection: `${options.db.name}.${resultTempCollectionName}`
        }))
   
        // RETURN RESULT
        if(type == "table") {
			res.send({
	        
	            pagination:{
	                total: count,
	                skip: pagination.skip,
	                limit: pagination.limit,
	                pagePosition: `${pagination.skip+1} - ${Math.min(pagination.skip + pagination.limit, count)} from ${count}`
	            },
	            header: uniq(flatten($res.map(r => keys(r)))),
	            collection: $res
	        
	        })
	    } else {
	    	res.send($res)
	    }    
	
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


const getCollections = async (req, res) => {
	try {

		let options = req.body.options

		let collections = await mongodb.listCollections(options)
        collections = collections.map( c => c.name)
    
		res.send(collections)

	} catch (e) {
		res.send({ 
			error: e.toString(),
			requestBody: req.body
		})
	}
}	

	
module.exports = {
	runScript,
	getMetadata,
	getCollections,
	test
}

