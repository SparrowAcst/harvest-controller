const {extend} = require("lodash")
const LongTerm = require("../utils/long-term-queue")
const mongodb = require("../mongodb")
const uuid = require("uuid").v4
const STRATEGY = require("../strategies/data")
const segmentationRequestCache = require("../utils/segmentation-request-cache")



const closeSegmentationRequestOperation = async settings => {

    let { requestId, user, configDB } = settings
    
    if(!user) return

    let request = segmentationRequestCache.get(requestId)

    if(!request) return
    
    if(request.user != user) return
    
    segmentationRequestCache.del(requestId)

    let handler = (STRATEGY[request.strategy]) 
    	? STRATEGY[request.strategy].closeRequest 
    	: undefined
    
    
    if(handler){
    	handler(settings)	
    }

}


const closeSegmentationRequest = (settings = {}) => {
    
    const metadata = {
            id: uuid(),
            type: 'closeSegmentationRequest',
            requestId: settings.requestId,
            user: settings.user
        }    

    LongTerm.execute( async () => {
        await closeSegmentationRequestOperation(settings)
        return metadata     
    }, metadata)
}



module.exports = {
    closeSegmentationRequest
}