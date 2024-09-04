const { isString } = require("lodash")

const uuid = require("uuid").v4
const isValidUUID = require("uuid").validate
const isUUID = data => isString(data) && isValidUUID(data)

const { segmentationAnalysis } = require("../utils")
const createTaskController = require("../../utils/task-controller")
const mongodb = require("../../mongodb")

const resolveSegmentation = async (options, segmentation) => {

    let { db } = options

    if (!segmentation) return

    if (isUUID(segmentation)) {
        let d = await mongodb.aggregate({
            db,
            collection: `${db.name}.segmentations`,
            pipeline: [{
                $match: {
                    id: segmentation
                }
            }]
        })

        return d[0]

    }
}

const openRequest = async options => {

    let { db, version, user, strategy } = options

    let existed = await mongodb.aggregate({
        db,
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
        existed.opened = true
        return existed
    }

    options.dataId = [version.dataId]
    const controller = createTaskController(options)
    let data = await controller.resolveData({ version })
    let segmentation = await resolveSegmentation(options, data.segmentation)
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
        "data": (segmentation) ? [{
            user: user.altname,
            readonly: false,
            segmentation: segmentation.data
        }] : []

    }

    let request = {
        id: uuid(),
        user: user.altname,
        versionId: version.id,
        dataId: version.dataId,
        strategy: "Base_Labeling_2nd",
        db,
        createdAt: new Date(),
        updatedAt: new Date(),
        requestData,
        responseData: null
    }

    await mongodb.replaceOne({
        db,
        collection: `settings.segmentation-requests`,
        filter: {
            id: request.id
        },
        data: request
    })

    return request

}


const closeRequest = async options => {

    console.log(`>> Base_Labeling_2nd: CLOSE REQUEST ${options.requestId}`)

    let { configDB, requestId } = options

    let request = await mongodb.aggregate({
        db: configDB,
        collection: `settings.segmentation-requests`,
        pipeline: [{
            $match: {
                id: requestId
            }
        }]
    })

    request = request[0]

    if (!request) return

    let { db, collection, responseData, requestData, dataId, versionId, user } = request

    // await mongodb.deleteOne({
    //     db: configDB,
    //     collection: `${configDB.name}.segmentation-requests`,
    //     filter: {
    //         id: requestId
    //     }
    // })

    await mongodb.updateOne({
        db: configDB,
        collection: `settings.segmentation-requests`,
        filter: {
            id: requestId
        },
        data: {
            closed: true,
            closedAt: new Date()
        }
    })

    if (!responseData) return
    if (!responseData.segmentation) return

    options.dataId = [dataId]
    options.db = db
    options.user = user

    const controller = createTaskController(options)
    let data = await controller.resolveData({ version: versionId })

    let segmentation = {
        id: uuid(),
        patientId: data["Examination ID"],
        record: {
            id: dataId
        },
        user,
        data: responseData.segmentation
    }

    
    data.segmentation = segmentation.id

    const brancher = await controller.getBrancher(options)
    let v = await brancher.save({
        source: versionId,
        user,
        data,
        metadata: {
            "task.Base_Labeling_2nd.status": "process",
            "task.Base_Labeling_2nd.reason": "Update Segmentation",
            "task.Base_Labeling_2nd.updatedAt": new Date(),
        }
    })

    segmentation.record.versionId = v.id

    await mongodb.replaceOne({
        db,
        collection: `${db.name}.segmentations`,
        filter: {
            id: segmentation.id
        },
        data: segmentation
    })


}

module.exports = {
    openRequest,
    closeRequest
}