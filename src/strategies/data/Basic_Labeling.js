const { isString, last, first, template, extend } = require("lodash")

const uuid = require("uuid").v4
const isValidUUID = require("uuid").validate
const isUUID = data => isString(data) && isValidUUID(data)

const { segmentationAnalysis } = require("../utils")
const createTaskController = require("../../utils/task-controller")
const mongodb = require("../../mongodb")

const LongTerm = require("../../utils/long-term-queue")

const REASON = {
    accept: {
        Basic_Labeling_1st: template(`The data labeling from a 1st expert is required.`),
        Basic_Labeling_2nd: template(`Data verification from a 2nd expert is required.`),
        Basic_Finalization: template(`Data finalization from a CMO is required.`)
    },
    reject: {
        Basic_Relabeling_1st: template(`The data was rejected by <%=user%>. The data verification from <%=expert%> is required.`),
        Basic_Relabeling_2nd: template(`The data was rejected by <%=user%>. The data verification from <%=expert%> is required.`),
    }
}

const getReason = (mode, task, data) => {
    if (REASON[mode] && REASON[mode][task]) {
        try {
            return REASON[mode][task](data)
        } catch (e) {
            return ""
        }
    }
    return ""
}

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


module.exports = params => ({

    get: async context => {

        let { recordId, user } = context

        context.dataId = [recordId]
        const controller = createTaskController(context)
        let version = await controller.getActualVersion({ user, dataId: recordId })
        let segmentation = await resolveSegmentation(context, version.data.segmentation || version.data.aiSegmentation)

        if (segmentation) {
            version.data.segmentationAnalysis = segmentationAnalysis.getSegmentationAnalysis(segmentation.data)
            version.data.segmentationAnalysis.user = (segmentation.user.name) ? segmentation.user.name : segmentation.user
            version.data.segmentationAnalysis.createdAt = segmentation.createdAt
        }

        version.strategy = params.actual

        return version
    },

    save: async context => {

        let { data, source, user, recordId } = context
        context.dataId = [recordId]

        const controller = createTaskController(context)
        const brancher = await controller.getBrancher(context)
        await brancher.save({
            user,
            source,
            data,
            metadata: {
                [`task.${params.actual}.status`]: "process",
                [`task.${params.actual}.updatedAt`]: new Date(),
                permission: params.permission,
                "actual_status": "Label changes have been saved.",
                "TODO_comment": data.TODO_comment
            }
        })

    },

    reject: async context => {

        let { data, source, user, recordId } = context
        context.dataId = [recordId]

        const controller = createTaskController(context)
        const brancher = await controller.getBrancher(context)

        // find 2nd expert

        let expertVersion = brancher.getHistory({
            version: source,
            stopAt: v => v.type == "submit" && params.previus.includes(v.metadata.actual_task) //!= params.actual
            // stopAt: v => v.type == "submit" && v.metadata.actual_task == params.reject
        })

        expertVersion = expertVersion.filter(v => v.type == "submit" && params.previus.includes(v.metadata.actual_task))
        expertVersion = first(expertVersion)

        let expert = (expertVersion) ? expertVersion.user : null

        console.log("REJECT", params, expert)

        let priorities = await controller.getEmploeePriorities({ user })
        priorities[user]++

        await brancher.submit({
            user,
            source,
            data,
            metadata: extend({
                    [`task.${params.actual}.status`]: "submit",
                    [`task.${params.actual}.updatedAt`]: new Date(),
                    "actual_status": "Data labeling rejected.",
                    "TODO_comment": data.TODO_comment
                },
                (params.reject) ? {
                    [`task.${params.reject}.status`]: "open",
                    [`task.${params.reject}.expert`]: expert,
                    [`task.${params.reject}.initiator`]: user,
                    [`task.${params.reject}.reason`]: getReason("reject", params.reject, { user, expert }),
                    [`task.${params.reject}.updatedAt`]: new Date()
                } : {})
        })

    },

    submit: async context => {


        let { data, source, user, recordId } = context
        context.dataId = [recordId]

        const controller = createTaskController(context)
        const brancher = await controller.getBrancher(context)

        let priorities = await controller.getEmploeePriorities({ user })
        priorities[user]++

        console.log("ACCEPT", params)

        await brancher.submit({
            user,
            source,
            data,
            metadata: extend({
                [`task.${params.actual}.status`]: "submit",
                [`task.${params.actual}.updatedAt`]: new Date(),
                "actual_status": "Changes to labels and segmentation have been submitted.",
                "TODO_comment": data.TODO_comment
            }, (params.accept) ? {
                [`task.${params.accept}.id`]: uuid(),
                [`task.${params.accept}.status`]: "open",
                [`task.${params.accept}.updatedAt`]: new Date(),
                [`task.${params.accept}.reason`]: getReason("accept", params.accept, { user }),
            } : {})
        })

    },

    rollback: async context => {


        let { source, user, recordId } = context
        context.dataId = [recordId]

        const controller = createTaskController(context)
        const brancher = await controller.getBrancher(context)

        let priorities = await controller.getEmploeePriorities({ user })
        priorities[user]--

        await brancher.rollback({
            source
        })

    },

    getSegmentation: async context => {

        let result = await get(context)

        return {
            segmentation: result.data.segmentation,
            segmentationAnalysis: result.data.segmentationAnalysis
        }
    }

})