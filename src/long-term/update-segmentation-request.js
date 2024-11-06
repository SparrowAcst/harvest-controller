const { extend } = require("lodash")
const LongTerm = require("../utils/long-term-queue")
const mongodb = require("../mongodb")
const uuid = require("uuid").v4
const STRATEGY = require("../strategies/data")
const jsondiffpatch = require("jsondiffpatch")
const segmentationRequestCache = require("../utils/segmentation-request-cache")

const checker = jsondiffpatch.create({
    objectHash: (d, index) => {
        return JSON.stringify(d)
    }
})

const updateSegmentationRequestOperation = async settings => {
    try {
        
        let { requestId, configDB, data } = settings

        let request = segmentationRequestCache.get(requestId)

        if(!request) return
            
        request.responseData = request.responseData || { segmentation: null }

        if (!checker.diff(request.responseData.segmentation, data.segmentation)) {
            return
        }

        // LongTerm.pool.startTask("update-segmentation-request", requestId, {
        //     user: request.user,
        //     dataId: request.dataId
        // })

        request.responseData = data
        request.updatedAt = new Date()
        
        segmentationRequestCache.set(requestId, request)

        request.strategy = request.strategy || "test"
        settings.request = request

        let handler = (STRATEGY[request.strategy]) ?
            STRATEGY[request.strategy].updateRequest :
            undefined


        if (handler) {
            await handler(settings)
        }

    } catch (e) {
        console.log(e.toString(), e.stack)

    }
}


const updateSegmentationRequest = (settings = {}) => {
    const id = uuid()
    const metadata = {
            id,
            type: 'updateSegmentationRequest',
            requestId: settings.requestId
        }    
    LongTerm.execute(async () => {
        try {
        await updateSegmentationRequestOperation(settings)
        return metadata
        } catch (e) {
           throw e 
        }
    }, metadata)
}



module.exports = {
    updateSegmentationRequest
}