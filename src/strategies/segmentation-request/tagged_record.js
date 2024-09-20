const { isString, find } = require("lodash")
const uuid = require("uuid").v4
const isValidUUID = require("uuid").validate
const mongodb = require("../../mongodb")
const moment = require("moment")

const settings = require("../settings").segmentator


const isUUID = data => isString(data) && isValidUUID(data)

const resolveSegmentations = async options => {

    let { db, dataId, segmentCollection, data } = options

    let result = {}

    if (!data) return result

    let segmentation = data.segmentation
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

        result = {
            segmentation: (s) ? s.data : undefined,
            // aiSegmentation: (ais) ? ais.data : undefined
        }

    } else {

        result = {
            segmentation
        }

    }

    return result

}

const openRequest = async options => {

    let { configDB, db, version, segmentCollection, user, strategy } = options
    
    // console.log("configDB", configDB, db)

    let existed = await mongodb.aggregate({
        db: configDB,
        collection: `settings.segmentation-requests`,
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
        
        if(
            moment(existed.updatedAt)
                .add(...settings.requestExpiration)
                .isSameOrBefore(moment(new Date()))
        ){
            console.log(`>> tagged_records: force close request ${existed.id} (${existed.user})`)
            existed.closed = true
            existed.closedAt = new Date()
            existed.force = true
            await mongodb.replaceOne({
                db: configDB,
                collection: `settings.segmentation-requests`,
                filter: {
                    id: existed.id
                },
                data: existed
            })
        } else {
            existed.opened = true
            return existed    
        }
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

    let segmentationData = (seg) 
        ? {
                user: user.altname,
                readonly: false,
                segmentation: seg.segmentation
            }
        : undefined    

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
        "data": (segmentationData) ? [segmentationData] : []
    }

    // console.log("collection", segmentCollection || db.labelingCollection)
    let request = {
        id: uuid(),
        user: user.altname,
        dataId: version.dataId,
        strategy: "tagged_record",
        db,
        collection: segmentCollection || db.labelingCollection,
        createdAt: new Date(),
        updatedAt: new Date(),
        requestData,
        responseData: (segmentationData) ? { segmentation: segmentationData.segmentation } : undefined
    }

    await mongodb.replaceOne({
        db: configDB,
        collection: `settings.segmentation-requests`,
        filter: {
            id: request.id
        },
        data: request
    })

    return request

}


const updateRequest = async options => {

    console.log(`>> tagged_record: UPDATE REQUEST:  ${options.requestId}: START`)

    let {request} = options 

    let { db, collection, responseData, requestData, dataId, user } = request

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

    console.log(`>> tagged_record: UPDATE REQUEST:  ${options.requestId}: DONE`)

    
}

module.exports = {
    openRequest,
    updateRequest
}