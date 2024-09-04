const {extend} = require("lodash")
const LongTerm = require("../utils/long-term-queue")
const mongodb = require("../mongodb")
const requestStrategies = require("../strategies/segmentation-request")



const closeSegmentationRequestOperation = async settings => {

    console.log(`LONG-TERM: closeSegmentationRequest: started`)

    let { requestId, configDB } = settings
    
    let request = await mongodb.aggregate({
        db: configDB,
        collection: `settings.segmentation-requests`,
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

    console.log(configDB, request)
    if(request.length == 0) return

    request = request[0]
    request.strategy = request.strategy || "test"
    
    settings.request = request
    
    let handler = (requestStrategies[request.strategy]) 
    	? requestStrategies[request.strategy].closeRequest 
    	: undefined
    
    
    if(handler){
    	handler(settings)	
    }

    console.log(`LONG-TERM: closeSegmentationRequest: done`)

}


const closeSegmentationRequest = (settings = {}) => {
    console.log("CALL closeSegmentationRequest")
    LongTerm.execute( async () => {
        await closeSegmentationRequestOperation(settings)     
    })
}



module.exports = {
    closeSegmentationRequest
}