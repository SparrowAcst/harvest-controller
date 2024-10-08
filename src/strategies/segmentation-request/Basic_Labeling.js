const { isString } = require("lodash")
const moment = require("moment")

const uuid = require("uuid").v4
const isValidUUID = require("uuid").validate
const isUUID = data => isString(data) && isValidUUID(data)

const { segmentationAnalysis } = require("../utils")
const createTaskController = require("../../utils/task-controller")
const mongodb = require("../../mongodb")


const settings = require("../settings").segmentator


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

        if (
            moment(existed.updatedAt)
            .add(...settings.requestExpiration)
            .isSameOrBefore(moment(new Date()))
        ) {
            console.log(`>> Basic_Labeling: force close request ${existed.id} (${existed.user})`)
            existed.closed = true
            existed.closedAt = new Date()
            existed.force = true
            await mongodb.replaceOne({
                db,
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


    options.dataId = [version.dataId]
    const controller = createTaskController(options)
    let data = await controller.resolveData({ version })

    let seg = await resolveSegmentation(options, data.segmentation || data.aiSegmentation)

    let segmentationData = (seg) ? {
            user: user.altname,
            readonly: false,
            segmentation: seg.data
        } :
        undefined

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

    let request = {
        id: uuid(),
        user: user.altname,
        versionId: version.id,
        dataId: version.dataId,
        strategy: "Basic_Labeling_1st",
        db,
        createdAt: new Date(),
        updatedAt: new Date(),
        requestData,
        responseData: (segmentationData) ? { segmentation: segmentationData.segmentation } : undefined
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
    try {
        console.log(`>> Basic_Labeling_1st: UPDATE REQUEST ${options.requestId}: START`)

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
            createdAt: new Date(),
            data: responseData.segmentation
        }


        data.segmentation = segmentation.id

        const brancher = await controller.getBrancher(options)
        let v = await brancher.save({
            source: versionId,
            user,
            data,
            metadata: {
                "task.Basic_Labeling_1st.status": "process",
                "task.Basic_Labeling_1st.reason": "",
                "task.Basic_Labeling_1st.updatedAt": new Date(),
                "actual_status": "Segmentation changes have been saved."
            }
        })

        // console.log(versionId, "create Seg Save: ", v.id)

        segmentation.record.versionId = v.id

        await mongodb.replaceOne({
            db,
            collection: `${db.name}.segmentations`,
            filter: {
                id: segmentation.id
            },
            data: segmentation
        })

        request.versionId = v.id

        await mongodb.replaceOne({
            db,
            collection: `settings.segmentation-requests`,
            filter: {
                id: requestId
            },
            data: request
        })


        console.log(`>> Basic_Labeling_1st: UPDATE REQUEST ${options.requestId}: DONE`)

    } catch (e) {
        console.log(">> Basic_Labeling_1st: UPDATE REQUEST ${options.requestId}: ", e.toString(), e.stack)
    }

}

module.exports = {
    openRequest,
    updateRequest
}