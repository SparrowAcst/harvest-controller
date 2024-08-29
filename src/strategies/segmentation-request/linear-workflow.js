const { isString, find } = require("lodash")
const uuid = require("uuid").v4
const isValidUUID = require("uuid").validate
const mongodb = require("../../mongodb")

const isUUID = data => isString(data) && isValidUUID(data)

// const resolveSegmentations = async options => {

//     let { db, dataId, segmentCollection, data } = options

//     let result = {}

//     if (!data) return result

//     let segmentation = data.segmentation
//     let aiSegmentation = data.aiSegmentation

//     if (isUUID(segmentation)) {
//         let d = await mongodb.aggregate({
//             db,
//             collection: `${db.name}.${segmentCollection}`,
//             pipeline: [{
//                 $match: {
//                     id: {
//                         $in: [segmentation, aiSegmentation]
//                     }
//                 }
//             }]
//         })

//         let s = find(d, v => !v.user || (v.user && v.user.name != "AI"))
//         let ais = find(d, v => v.user && v.user.name == "AI")

//         result = {
//             segmentation: (s) ? s.data : undefined,
//             aiSegmentation: (ais) ? ais.data : undefined
//         }

//     } else {

//         let d = await mongodb.aggregate({
//             db,
//             collection: `${db.name}.${segmentCollection}`,
//             pipeline: [{
//                 $match: {
//                     id: aiSegmentation
//                 }
//             }]
//         })

//         result = {
//             segmentation,
//             aiSegmentation: d[0] ? d[0].data : undefined
//         }

//     }

//     return result

// }


const resolveSegmentations = async options => {

    let { db, dataId, segmentCollection, data } = options

    let result = {}

    if (!data) return result

    let segmentation = data.segmentation
    // let aiSegmentation = data.aiSegmentation

    if(!segmentation) return

    if (isUUID(segmentation)) {
        let d = await mongodb.aggregate({
            db,
            collection: `${db.name}.${segmentCollection}`,
            pipeline: [{
                $match: {
                    id: {
                        $in: [segmentation]
                    }
                }
            }]
        })

        let s = find(d, v => !v.user || (v.user && v.user.name != "AI"))
        // let ais = find(d, v => v.user && v.user.name == "AI")

        result = {
            segmentation: (s) ? s.data : undefined,
            // aiSegmentation: (ais) ? ais.data : undefined
        }

    } else {

        // let d = await mongodb.aggregate({
        //     db,
        //     collection: `${db.name}.${segmentCollection}`,
        //     pipeline: [{
        //         $match: {
        //             id: aiSegmentation
        //         }
        //     }]
        // })

        result = {
            segmentation,
            // aiSegmentation: d[0] ? d[0].data : undefined
        }

    }

    return result

}

const openRequest = async options => {

    let { configDB, db, version, segmentCollection, user, strategy } = options

    let existed = await mongodb.aggregate({
        db: configDB,
        collection: `${configDB.name}.segmentation-requests`,
        pipeline: [{
                $match: {
                    dataId: version.dataId,
                    closed: {
                        $exists: false
                    }
                }
            },
            {
                $project: { _id: 0 }
            }
        ]
    })

    if (existed.length > 0) {
        existed = existed[0]
        existed.opened = true
        return existed
    }

    let data = await mongodb.aggregate({
        db,
        collection: `${db.name}.${db.labelingCollection}`,
        pipeline: [{
            $match: {
                id: version.dataId
            }
        }]
    })

    data = data[0]

    if (!data) return {}

    options.data = data

    let seg = await resolveSegmentations(options)

    let requestData = {
        "patientId": data["Examination ID"],
        "recordId": version.dataId,
        "spot": data["Body Spot"],
        "position": data["Body Position"],
        "device": data.model,
        "path": data.path,
        "Systolic murmurs": data["Systolic murmurs"],
        "Diastolic murmurs": data["Diastolic murmurs"],
        "Other murmurs": data["Other murmurs"],
        "inconsistency": [],
        "data": (seg) ?[{
                user: user.altname,
                readonly: false,
                segmentation: seg.segmentation
            }
            // ,
            // {
            //     user: "AI",
            //     readonly: true,
            //     segmentation: seg.aiSegmentation
            // }
        ] : []

    }

    let request = {
        id: uuid(),
        user: user.altname,
        dataId: version.dataId,
        strategy: "linear_workflow",
        db,
        collection: segmentCollection,
        createdAt: new Date(),
        updatedAt: new Date(),
        requestData,
        responseData: null
    }

    await mongodb.replaceOne({
        db: configDB,
        collection: `${configDB.name}.segmentation-requests`,
        filter: {
            id: request.id
        },
        data: request
    })

    return request

}


const closeRequest = async options => {

    console.log(`linear_workflow strategy CLOSE REQUEST:  ${options.requestId}`)

    let { configDB, requestId } = options

    let request = await mongodb.aggregate({
        db: configDB,
        collection: `${configDB.name}.segmentation-requests`,
        pipeline: [{
            $match: {
                id: requestId
            }
        }]
    })

    request = request[0]

    if (!request) return

    let { db, collection, responseData, requestData, dataId, user } = request

    // await mongodb.deleteOne({
    //     db: configDB,
    //     collection: `${configDB.name}.segmentation-requests`,
    //     filter: {
    //         id: requestId
    //     }
    // })

    await mongodb.updateOne({
            db: configDB,
            collection: `${configDB.name}.segmentation-requests`,
            filter:{
                id: requestId
            },
            data:{
                closed: true,
                closedAt: new Date()
            }
        })

    if (!responseData) return
    if (!responseData.segmentation) return    
        
    const result = await mongodb.updateOne({
        db,
        collection: `${db.name}.${db.labelingCollection}`,
        filter: {
            id: dataId
        },

        data: {
            segmentation: responseData.segmentation
        }
    })

    const seg_hist = {
        id: uuid(),
        collection,
        recordId: dataId,
        updatedAt: new Date(),
        updatedBy: user,
        segmentation: responseData
    }

    await mongodb.replaceOne({
        db,
        collection: `${db.name}.segmentation-history`,
        filter: {
            id: seg_hist.id
        },

        data: seg_hist

    })

    const event = {
        id: uuid(),
        type: "update segmentation",
        collection: `${db.name}.${db.labelingCollection}`,
        recordingId: dataId,
        examinationId: requestData.patientId,
        path: requestData.path,
        segmentation: responseData.segmentation,
        startedAt: new Date(),
        stoppedAt: new Date()
    }

    await mongodb.replaceOne({
        db,
        collection: `${db.name}.changelog-recordings`,
        filter: {
            id: event.id
        },

        data: event
    })



}

module.exports = {
    openRequest,
    closeRequest
}