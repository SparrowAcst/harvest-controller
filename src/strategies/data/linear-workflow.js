const { isString, find, extend } = require("lodash")
const uuid = require("uuid").v4
const isValidUUID = require("uuid").validate
const isUUID = data => isString(data) && isValidUUID(data)

const { segmentationAnalysis } = require("../utils")
const { Diff, SegmentationDiff } = require("../../utils/diff")

const mongodb = require("../../mongodb")

const segmentationRequestCache = require("../../utils/segmentation-request-cache")

const buildSegmentationRequest = data => {

    if (!data) return {}

    let segmentationData = (data.segmentation) ?
        {
            user: data.user.altname,
            readonly: false,
            segmentation: data.segmentation
        } :
        undefined

    let requestData = {
        "patientId": data["Examination ID"],
        "recordId": data.id,
        "spot": data["Body Spot"],
        "position": data["Body Position"],
        "device": data.model,
        "path": data.path,
        "Systolic murmurs": data["Systolic murmurs"],
        "Diastolic murmurs": data["Diastolic murmurs"],
        "Other murmurs": data["Other murmurs"],
        "inconsistency": [],
        "data": (segmentationData) ? [segmentationData] : []
    }

    return {
        id: uuid(),
        user: data.user.altname,
        dataId: data.id,
        strategy: "tagged_record",
        db: data.db,
        collection: data.segmentCollection,
        createdAt: new Date(),
        updatedAt: new Date(),
        requestData,
        responseData: (segmentationData) ? { segmentation: segmentationData.segmentation } : undefined
    }

}


const resolveSegmentation = async options => {

    let { db, segmentCollection, data } = options

    let result = {}

    if (!data) return result

    let segmentation = data.segmentation

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

        result = (s) ? s.data : undefined

    } else {
        result = segmentation
    }

    return result

}

const get = async context => {

    let { recordId, db, user, segmentCollection } = context

    let result = await mongodb.aggregate({
        db,
        collection: `${db.name}.${db.labelingCollection}`,
        pipeline: [{
                $match: {
                    id: recordId
                }
            },
            {
                $project: { _id: 0 }
            }
        ]
    })

    result = result[0]

    if (result) {

        let options = {
            data: result,
            db,
            segmentCollection
        }

        result.segmentation = await resolveSegmentation(options)

        // console.log("SEGMENTATION", result.segmentation)

        if (result.segmentation) {

            result.segmentationAnalysis = segmentationAnalysis.getSegmentationAnalysis(result.segmentation)

        }

        let request = segmentationRequestCache.getRequest({ dataId: result.id })
            
        if (!request) {
            request = buildSegmentationRequest(extend(result, {
                db,
                user,
                segmentCollection: segmentCollection || db.labelingCollection
            }))
            request = segmentationRequestCache.set({ dataId: result.dataId }, request)
        }

        result.segmentationRequest = request.hash


        return {
            dataId: recordId,
            data: result
        }

    } else {
        return { data: { dataId: recordId } }
    }

}

const openRequest = async context => {
    let result = await get(context)
    let request = segmentationRequestCache.get(result.data.segmentationRequest)
    return {
        id: request.id,
        hash: request.hash,
        user: request.user,
        updatedAt: request.updatedAt
    }

}


const updateRequest = async options => {

    let { request } = options

    let { db, collection, responseData, requestData, dataId, user } = request

    if (!responseData) return
    if (!responseData.segmentation) return


    // console.log("///////////////////////////////////////////////////////////////////////////")
    // console.log("TEST SAVE TO DB", db, `${db.name}.${db.labelingCollection}`, responseData.segmentation)
    // console.log("///////////////////////////////////////////////////////////////////////////")


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
    
}

const getSegmentation = async context => {

    let { recordId, db, user, segmentCollection } = context
    let request = segmentationRequestCache.getRequest({ dataId: recordId })
    if(!request) return {}

    let segmentation = 
            (request.responseData) ? request.responseData.segmentation : undefined  
            || 
            (request.requestData.data[0]) ? request.requestData.data[0].segmentation : undefined  
    
    let analysis
    
    if (segmentation) {
        analysis = segmentationAnalysis.getSegmentationAnalysis(segmentation)
    }

    return {
        segmentation,
        segmentationAnalysis: analysis
    }
}


// const save = async context => {

//     try {

//         let { db, record, user, session, dataset, tags } = context

//         record.tags = record.tags.map(t => {
//             t.createdAt = new Date(t.createdAt)
//             return t
//         })

//         tags = (tags || []).map(t => ({
//             tag: t,
//             createdAt: new Date(),
//             createdBy: {
//                 email: user.email,
//                 namedAs: user.altname,
//                 photo: user.photo
//             }
//         }))

//         record.tags = record.tags.concat(tags)


//         const prev = await mongodb.aggregate({
//             db,
//             collection: `${db.name}.${db.labelingCollection}`,
//             pipeline: [{
//                     $match: { id: record.id }
//                 },
//                 {
//                     $project: { _id: 0 }
//                 }

//             ]
//         })

//         record.segmentation = prev[0].segmentation
//         record["updated at"] = new Date()

//         const result = await mongodb.replaceOne({
//             db,
//             collection: `${db.name}.${db.labelingCollection}`,
//             filter: {
//                 id: record.id
//             },
//             data: record
//         })

//         const event = {
//             id: uuid(),
//             dataset: dataset,
//             collection: db.labelingCollection,
//             recordingId: record.id,
//             examinationId: record["Examination ID"],
//             path: record.path,
//             diff: Diff.diff(prev, record),
//             formattedDiff: Diff.format(Diff.diff(prev[0], record)),
//             user: user,
//             session: session.id,
//             startedAt: session.startedAt,
//             stoppedAt: session.stoppedAt
//         }

//         await mongodb.replaceOne({
//             db,
//             collection: `${db.name}.changelog-recordings`,
//             filter: {
//                 // id: event.id
//                 session: event.session
//             },

//             data: event
//         })

//         return result

//     } catch (e) {
//         return `${e.toString()} ${e.stack}`
//     }

// }

const save = async context => {
    try {

        let { db, record, user, session, dataset } = context
        
        const prev = await mongodb.aggregate({
            db,
            collection: `${db.name}.${db.labelingCollection}`,
            pipeline: [   
                {
                    $match: { id: record.id }
                },
                {
                    $project:{ _id: 0 }
                }
                        
            ]
        })

        record.segmentation = prev[0].segmentation

        const result = await mongodb.replaceOne({
            db,
            collection: `${db.name}.${db.labelingCollection}`,
            filter:{
                id: record.id
            },
            data: record
        })

        const event = {
            id: uuid(),
            dataset: dataset,
            collection: db.labelingCollection, 
            recordingId: record.id,
            examinationId: record["Examination ID"],
            path: record.path,
            diff: Diff.diff(prev, record),
            formattedDiff: Diff.format(Diff.diff(prev[0], record)),
            user: user,
            session: session.id,
            startedAt: session.startedAt,
            stoppedAt: session.stoppedAt
        }

        await mongodb.replaceOne({
            db,
            collection: `${db.name}.changelog-recordings`,
            filter:{
                session: event.session
            },
            
            data: event
        })

        return result

    } catch (e) {
        return { 
            error: `linear_workflow data strategy error: ${e.toString()} ${e.stack}`
        }
    }
}

const submit = async context => {

}

const rollback = async context => {

}


module.exports = {
    get,
    save,
    submit,
    rollback,
    getSegmentation,
    openRequest,
    updateRequest
}