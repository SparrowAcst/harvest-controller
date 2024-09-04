const { isString, flatten, uniqBy } = require("lodash")

const uuid = require("uuid").v4
const isValidUUID = require("uuid").validate
const isUUID = data => isString(data) && isValidUUID(data)

const { segmentationAnalysis, dataDiff } = require("../utils")
const createTaskController = require("../../utils/task-controller")
const mongodb = require("../../mongodb")

const LongTerm = require("../../utils/long-term-queue")


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


const checkConsistency = async context => {

}

const merge = async context => {

}

const reassignTasks = async context => {

}


const executeMergeStrategyOperation = async context => {
	console.log(">> Cross_Validation_2nd: Execute merge strategy")
}

const executeMergeStrategy = async context => {
    LongTerm.execute(async () => {
        await executeMergeStrategyOperation(context)
    })
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
            alt.segmentation = segmentationAnalysis.parse(alt.segmentation.data)
        }
    }


    altVersions = altVersions.filter(v => v.segmentation)

    if (segmentation) {

        version.data.segmentationAnalysis = segmentationAnalysis.getSegmentationAnalysis(segmentation.data)
        let segmentations = [version.data.segmentationAnalysis.segmentation.segments]
            .concat(altVersions.map(v => v.segmentation.segments))

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
            "task.Cross_Validation_2nd.updatedAt": new Date()
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
            "task.Cross_Validation_2nd.updatedAt": new Date()
        }
    })

    //send message for merge

    if (context.eventHub.listenerCount("merge-tasks") == 0) {
        context.eventHub.on("merge-tasks", executeMergeStrategy)
    }

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