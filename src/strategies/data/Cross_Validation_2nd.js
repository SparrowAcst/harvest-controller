const { isString, flatten, uniqBy } = require("lodash")

const uuid = require("uuid").v4
const isValidUUID = require("uuid").validate
const isUUID = data => isString(data) && isValidUUID(data)

const { segmentationAnalysis, dataDiff } = require("../utils")
const createTaskController = require("../../utils/task-controller")
const mongodb = require("../../mongodb")

const { mergeCrossValidation } = require("../../long-term/merge-cross-validation")

const resolveSegmentation = async (options, segmentation) => {

    let { db } = options

    if (!segmentation) return

    if (isUUID(segmentation)) {
        let d = await mongodb.aggregate({
            comment: "resolve segmentation",
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

const get = async context => {

    let { recordId, user } = context
    context.dataId = [recordId]
    const controller = createTaskController(context)
    
    let version = await controller.getActualVersion({ user, dataId: recordId })
    let segmentation = await resolveSegmentation(context, version.data.segmentation)

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
        alt.diff = dataDiff.getDifference(version.data, alt.data)
        alt.segmentation = await resolveSegmentation(context, alt.data.segmentation)
        if (alt.segmentation) {
            alt.data.segmentationAnalysis = segmentationAnalysis.parse(alt.segmentation.data)
        }
    }


    altVersions = altVersions.filter(v => v.data.segmentationAnalysis)

    if (segmentation) {

        version.data.segmentationAnalysis = segmentationAnalysis.getSegmentationAnalysis(segmentation.data)
        let segmentations = [version.data.segmentationAnalysis.segmentation.segments]
            .concat(altVersions.map(v => v.data.segmentationAnalysis.segments))

        let diff = segmentationAnalysis.getSegmentsDiff(segmentations)
        let inconsistency = segmentationAnalysis.getNonConsistencyIntervalsForSegments(diff)

        version.data.segmentationAnalysis.charts.segmentation = segmentationAnalysis.getSegmentationChart(version.data.segmentationAnalysis, inconsistency)
    }

    version.strategy = "Cross_Validation_2nd"
    version.dataDiff = uniqBy(flatten(altVersions.map(v => v.diff.formatted.map(d => d.key))))

    return version
}


const getSegmentation = async context => {

    let result = await get(context)

    return {
        segmentation: result.data.segmentation,
        segmentationAnalysis: result.data.segmentationAnalysis
    }
}


const save = async context => {

    let { data, source, user, recordId } = context
    context.dataId = [recordId]
    const controller = createTaskController(context)
    const brancher = await controller.getBrancher(context)
    await brancher.save({
        user,
        source,
        data,
        metadata: {
            "task.Cross_Validation_2nd.status": "process",
            "task.Cross_Validation_2nd.updatedAt": new Date(),
            "actual_status": "Label changes have been saved.",

        }
    })

}

const submit = async context => {

    let { data, source, user, recordId } = context
    context.dataId = [recordId]
    const controller = createTaskController(context)
    const brancher = await controller.getBrancher(context)

    await brancher.submit({
        user,
        source,
        data,
        metadata: {
            "task.Cross_Validation_2nd.status": "submit",
            "task.Cross_Validation_2nd.updatedAt": new Date(),
            "actual_status": "Changes to labels and segmentation have been submitted."
        }
    })

    //send message for merge

    if (context.eventHub.listenerCount("merge-tasks") == 0) {
        context.eventHub.on("merge-tasks", mergeCrossValidation)
    }

    // console.log("MERGE LONG-TERM HANDLER",context.eventHub.listenerCount("merge-tasks"))
    context.eventHub.emit("merge-tasks", context)

}

const rollback = async context => {

    let { source, user, recordId } = context
    context.dataId = [recordId]
    const controller = createTaskController(context)
    const brancher = await controller.getBrancher(context)
    await brancher.rollback({
        source
    })

}


module.exports = {
    get,
    save,
    submit,
    rollback,
    getSegmentation
}