const {extend} = require("lodash")
const LongTerm = require("../utils/long-term-queue")
const mongodb = require("../mongodb")
const requestStrategies = require("../strategies/segmentation-request")
const jsondiffpatch = require("jsondiffpatch")

const checker = jsondiffpatch.create({
    objectHash: (d, index)  => {
        return JSON.stringify(d)
    }
})

const updateSegmentationRequestOperation = async settings => {

    console.log(`LONG-TERM: updateSegmentationRequest: started`)

    let { requestId, configDB, data } = settings
    
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


    if(request.length == 0) return

    request = request[0]
    
    if( !checker.diff(request.responseData.segmentation, data.segmentation) ){
        console.log(`LONG-TERM: updateSegmentationRequest: no changes`)
        return
    }    
    
    request.responseData = data
    request.updatedAt = new Date()

    let { db } = request

    await mongodb.replaceOne({
         db: configDB,
         collection: `settings.segmentation-requests`,
         filter:{
             id: requestId
         },
         data: request
     })


    request.strategy = request.strategy || "test"
    
    settings.request = request

    let handler = (requestStrategies[request.strategy]) 
    	? requestStrategies[request.strategy].updateRequest 
    	: undefined
    
    
    if(handler){
    	handler(settings)	
    }

    console.log(`LONG-TERM: updateSegmentationRequest: done`)

}


const updateSegmentationRequest = (settings = {}) => {
    console.log("CALL updateSegmentationRequest")
    LongTerm.execute( async () => {
        await updateSegmentationRequestOperation(settings)     
    })
}



module.exports = {
    updateSegmentationRequest
}