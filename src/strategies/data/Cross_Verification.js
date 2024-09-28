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
    let segmentation

    if (version.data) {
        segmentation = await resolveSegmentation(context, version.data.segmentation)
    }

    console.log(version.metadata.task.Cross_Verification)

    let altVersions = (version.metadata.task.Cross_Verification.versions) ?
        await controller.selectTask({
            matchVersion: {
                id: {
                    $in: version.metadata.task.Cross_Verification.versions
                }
            }
        }) :
        []

    for (let alt of altVersions) {
        alt.data = await controller.resolveData({ version: alt })
        
        alt.diff = (version.data) ?
            dataDiff.getDifference(version.data, alt.data) :
            dataDiff.getDifference(altVersions[0].data, alt.data)
        
        alt.segmentation = await resolveSegmentation(context, alt.data.segmentation)

        if (alt.segmentation) {
            alt.data.segmentationAnalysis = segmentationAnalysis.getSegmentationAnalysis(alt.segmentation.data)
        }
    }

    if (segmentation) {

        version.data.segmentationAnalysis = segmentationAnalysis.getSegmentationAnalysis(segmentation.data)
        let segmentations = [version.data.segmentationAnalysis.segmentation.segments]
            .concat(altVersions.map(v => v.data.segmentationAnalysis.segmentation.segments))

        let diff = segmentationAnalysis.getSegmentsDiff(segmentations)
        let inconsistency = segmentationAnalysis.getNonConsistencyIntervalsForSegments(diff)

        version.data.segmentationAnalysis.charts.segmentation = segmentationAnalysis.getSegmentationChart(version.data.segmentationAnalysis, inconsistency)

        altVersions.forEach(alt => {
            alt.data.segmentationAnalysis.charts.segmentation = segmentationAnalysis.getSegmentationChart(alt.data.segmentationAnalysis, inconsistency)
        })

    } else {
 
        let segmentations = altVersions.map(v => v.data.segmentationAnalysis.segmentation.segments)

        let diff = segmentationAnalysis.getSegmentsDiff(segmentations)
        let inconsistency = segmentationAnalysis.getNonConsistencyIntervalsForSegments(diff)

        altVersions.forEach(alt => {
             alt.data.segmentationAnalysis.charts.segmentation = segmentationAnalysis.getSegmentationChart(alt.data.segmentationAnalysis, inconsistency)
        })

    }

    version.strategy = "Cross_Verification"
    version.dataDiff = uniqBy(flatten(altVersions.map(v => v.diff.formatted.map(d => d.key))))
    version.alternatives = altVersions

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
            "task.Cross_Verification.status": "process",
            "task.Cross_Verification.updatedAt": new Date(),
            "actual_status": "Label changes have been saved.",

        }
    })

}

const submit = async context => {

    let { data, source, user, recordId } = context
    context.dataId = [recordId]
    const controller = createTaskController(context)
    const brancher = await controller.getBrancher(context)

    delete data.$refSegmentation

    await brancher.submit({
        user,
        source,
        data,
        metadata: {
            "task.Cross_Verification.status": "submit",
            "task.Cross_Verification.updatedAt": new Date(),
            "actual_status": "Changes to labels and segmentation have been submitted."
        }
    })

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