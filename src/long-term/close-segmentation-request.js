const {extend} = require("lodash")
const mongodb = require("../mongodb")
const requestStrategies = require("../strategies/segmentation-request")



const closeSegmentationRequest = async settings => {

    console.log(`LONG-TERM: closeSegmentationRequest: started`)

    let { requestId, configDB } = settings
    
    let request = await mongodb.aggregate({
        db: configDB,
        collection: `${configDB.name}.segmentation-requests`,
        pipeline: [{
                $match: {
                    id: requestId
                }
            },
            {
                $project: { _id: 0 }
            }
        ]
    })

    if(request.length == 0) return

    request = request[0]
    request.strategy = request.strategy || "test"
    
    let handler = (requestStrategies[request.strategy]) 
    	? requestStrategies[request.strategy].closeRequest 
    	: undefined
    
    
    if(handler){
    	handler(settings)	
    }

    console.log(`LONG-TERM: closeSegmentationRequest: done`)

}

module.exports = {
    closeSegmentationRequest
}