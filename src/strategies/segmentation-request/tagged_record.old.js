const { isString, find } = require("lodash")
const uuid = require("uuid").v4
const isValidUUID = require("uuid").validate
const mongodb = require("../../mongodb")
const moment = require("moment")

const updateRequest = async options => {

    console.log(`>> tagged_record: UPDATE REQUEST:  ${options.requestId}: START`)

    let { request } = options 

    let { db, collection, responseData, requestData, dataId, user } = request

    if (!responseData) return
    if (!responseData.segmentation) return    


    console.log("///////////////////////////////////////////////////////////////////////////")
    console.log("TEST SAVE TO DB", db, `${db.name}.${db.labelingCollection}`, responseData.segmentation)
    console.log("///////////////////////////////////////////////////////////////////////////")
        

    // const result = await mongodb.updateOne({
    //     db,
    //     collection: `${db.name}.${db.labelingCollection}`,
    //     filter: {
    //         id: dataId
    //     },

    //     data: {
    //         segmentation: responseData.segmentation
    //     }
    // })

    console.log(`>> tagged_record: UPDATE REQUEST:  ${options.requestId}: DONE`)
    
}

module.exports = {
    updateRequest
}