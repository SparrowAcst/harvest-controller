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
            comment: "open request: resolve segmentation",
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
                    versionId: version.id,
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

    let segmentationSource = segmentation

    let altVersions = await controller.selectTask({
        matchVersion: {

            id: {
                $ne: version.id
            },

            "metadata.task.Cross_Validation_2nd.id": version.metadata.task.Cross_Validation_2nd.id,
            head: true,

            save: {
                $exists: false
            },

            submit: {
                $exists: false
            },

            branch: {
                $exists: false
            },

            commit: {
                $exists: false
            }
        }
    })

    for (let alt of altVersions) {
        alt.data = await controller.resolveData({ version: alt })
        alt.segmentation = await resolveSegmentation(options, alt.data.segmentation)
        if (alt.segmentation) {
            alt.segmentation = segmentationAnalysis.parse(alt.segmentation.data)
        }
    }

    altVersions = altVersions.filter(v => v.segmentation)

    let inconsistency = []

    if (segmentation) {

        version.data.segmentationAnalysis = segmentationAnalysis.getSegmentationAnalysis(segmentation.data)
        let segmentations = [segmentationAnalysis.parse(segmentation.data).segments]
            .concat(altVersions.map(v => v.segmentation.segments))

        let diff = segmentationAnalysis.getSegmentsDiff(segmentations)
        inconsistency = segmentationAnalysis.getNonConsistencyIntervalsForSegments(diff)
        inconsistency = inconsistency.map(d => [d.start.toFixed(3), d.end.toFixed(3)])

    }

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
        inconsistency,
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
        strategy: "Cross_Validation_2nd",
        db,
        createdAt: new Date(),
        updatedAt: new Date(),
        requestData,
        responseData: (segmentationSource) ? { segmentation: segmentationSource.data } : undefined
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


const updateRequest = async options => {

    console.log(`>> Cross_Validation_2nd: UPDATE REQUEST ${options.requestId}: START`)

    let { requestId, request } = options

    let { db, collection, responseData, requestData, dataId, versionId, user } = request


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
            "task.Cross_Validation_2nd.status": "in progress",
            "task.Cross_Validation_2nd.updatedAt": new Date(),
            "actual_status": "segmentation changes have been saved",
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

    console.log(`>> Cross_Validation_2nd: UPDATE REQUEST ${options.requestId}: DONE`)

}

module.exports = {
    openRequest,
    updateRequest
}