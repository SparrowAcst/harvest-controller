const {
    groupBy,
    keys,
    first,
    sortBy,
    last,
    sampleSize,
    shuffle,
    take,
    extend,
    uniqBy,
    flatten,
    remove

} = require("lodash")

const SETTINGS = require("../settings")


const selectCandidates = (collaborators, count, exclusion) => {

    exclusion = exclusion || []

    collaborators.pool = shuffle(
        collaborators.candidates
        .concat(collaborators.pool)
        .filter(d => d.priority > 0)
        .filter(c => !exclusion.includes(c.namedAs))
    )
    collaborators.candidates = take(collaborators.pool, count)
    return collaborators

}

const assignTasks = async (user, taskController) => {
    try {
        
        const { PARALLEL_BRANCHES } = SETTINGS().strategy.Cross_Validation_2nd

        let pool = await taskController.getEmployeeStat({
            matchEmployee: u => u.schedule && u.schedule.includes("Cross_Validation_2nd")
        })


        // select user activity
        let activity = remove(pool, u => u.namedAs == user.altname)

        activity = activity[0]
        if (!activity) return []
        if (activity.priority == 0) return { version: [] }

        pool = sortBy(
            pool.filter(c => c.namedAs != user.altname && c.priority > 0),
            c => c.priority
        )

        if (pool.length == 0) return { version: [] }

        let collaborators = {
            pool,
            candidates: []
        }

        let tasks = await taskController.selectTask({
            matchVersion: {
                "metadata.task.Cross_Validation_2nd.status": "open",
                "type": "main",
                "head": true,
                "branch": {
                    $exists: false
                }
            }
        })

        tasks = tasks.slice(0, activity.priority)

        let toAssignTask = []

        while (tasks.length > 0 && activity.priority > 0) {

            let task = tasks.shift()

            collaborators = selectCandidates(collaborators, PARALLEL_BRANCHES - 1)

            if (collaborators.candidates.length == PARALLEL_BRANCHES - 1) {
                toAssignTask.push({
                    user: user.altname,
                    task,
                    metadata: {
                        "task.Cross_Validation_2nd.status": "started",
                        "task.Cross_Validation_2nd.stage": (task.metadata.task.Cross_Validation_2nd.stage || 0) + 1,
                        "task.Cross_Validation_2nd.iteration": 1,
                        "task.Cross_Validation_2nd.collaborators": uniqBy(
                            (task.metadata.task.Cross_Validation_2nd.collaborators || [])
                            .concat(
                                [collaborators.candidates.map(c => c.namedAs).concat([user.altname])]
                            )
                        ),
                        "task.Cross_Validation_2nd.updatedAt": new Date(),
                        "actual_task": "Cross_Validation_2nd",
                        "actual_status": "Waiting for the start."
                    }
                })
                toAssignTask = toAssignTask.concat(
                    collaborators.candidates.map(c => ({
                        user: c.namedAs,
                        task,
                        metadata: {
                            "task.Cross_Validation_2nd.status": "started",
                            "task.Cross_Validation_2nd.stage": (task.metadata.task.Cross_Validation_2nd.stage || 0) + 1,
                            "task.Cross_Validation_2nd.collaborators": uniqBy(
                                (task.metadata.task.Cross_Validation_2nd.collaborators || [])
                                .concat(
                                    [collaborators.candidates.map(c => c.namedAs).concat([user.altname])]
                                )
                            ),
                            "task.Cross_Validation_2nd.updatedAt": new Date(),
                            "actual_task": "Cross_Validation_2nd",
                            "actual_status": "Waiting for the start."
                        }
                    }))
                )

                activity.priority--
                collaborators.candidates.forEach(c => {
                    c.priority--
                })


            } else {
                continue
            }

        }

        toAssignTask = groupBy(toAssignTask, t => t.user)
        toAssignTask = keys(toAssignTask).map(key => ({
            user: key,
            tasks: toAssignTask[key].map(t => ({
                version: t.task,
                metadata: t.metadata
            }))
        }))

        for (let t of toAssignTask) {

            let b = await taskController.getBrancher(extend({}, taskController.context, { dataId: t.tasks.map(t => t.version.dataId) }))

            for (let index in t.tasks) {

                await b.branch({
                    source: t.tasks[index].version,
                    user: t.user,
                    metadata: t.tasks[index].metadata
                })

            }

        }

        return { version: [] }
    
    } catch (e) {
        
        console.log(e.toString(), e.trace)
    }
}


const reassignTasks = async (user, taskController) => {
    try {

        const { PARALLEL_BRANCHES } = SETTINGS().strategy.Cross_Validation_2nd

        let pool = await taskController.getEmployeeStat({
            matchEmployee: u => u.schedule && u.schedule.includes("Cross_Validation_2nd")
        })

        pool = sortBy(
            pool.filter(c => c.namedAs != user.altname && c.priority > 0),
            c => c.priority
        )

        if (pool.length == 0) return { version: [] }

        let collaborators = {
            pool,
            candidates: []
        }

        let tasks = await taskController.selectTask({
            matchVersion: {
                "metadata.task.Cross_Validation_2nd.status": "reassign",
                "type": "submit",
                "lockRollback": true,
                "head": true,
                "branch": {
                    $exists: false
                }
            }
        })

        tasks = groupBy(tasks, t => t.metadata.task.Cross_Validation_2nd.id)

        let toAssignTask = []

        keys(tasks).forEach(key => {

            let taskArray = tasks[key]

            if (taskArray.length != PARALLEL_BRANCHES) {
                console.log("No consistent task count and PARALLEL_BRANCHES")
                return
            }

            let exclusion = flatten(
                (taskArray[0].metadata.task.Cross_Validation_2nd.collaborators) ?
                taskArray[0].metadata.task.Cross_Validation_2nd.collaborators : []
            )

            collaborators = selectCandidates(collaborators, taskArray.length, exclusion)

            if (collaborators.candidates.length == taskArray.length) {

                let index = 0
                for (let task of taskArray) {

                    toAssignTask.push({
                        user: collaborators.candidates[index].namedAs,
                        task,
                        metadata: {
                            "task.Cross_Validation_2nd.status": "started",
                            "task.Cross_Validation_2nd.stage": (task.metadata.task.Cross_Validation_2nd.stage || 0) + 1,
                            "task.Cross_Validation_2nd.iteration": 1,
                            "task.Cross_Validation_2nd.user": user.altname,
                            "task.Cross_Validation_2nd.collaborators": (task.metadata.task.Cross_Validation_2nd.collaborators || [])
                                .concat(
                                    [collaborators.candidates.map(c => c.namedAs)]
                                ),
                            "task.Cross_Validation_2nd.updatedAt": new Date(),
                            "actual_task": "Cross_Validation_2nd",
                            "actual_status": "Waiting for the start."
                        }

                    })
                    index++
                }

            }
        })

        toAssignTask = groupBy(toAssignTask, t => t.user)
        toAssignTask = keys(toAssignTask).map(key => ({
            user: key,
            tasks: toAssignTask[key].map(t => ({
                version: t.task,
                metadata: t.metadata
            }))
        }))

        for (let t of toAssignTask) {

            let b = await taskController.getBrancher(extend({}, taskController.context, { dataId: t.tasks.map(t => t.version.dataId) }))

            for (let index in t.tasks) {

                await b.branch({
                    source: t.tasks[index].version,
                    user: t.user,
                    metadata: t.tasks[index].metadata
                })

            }
        }

    } catch (e) {
        console.log(e.toString(), e.trace)
    }
}



module.exports = async (user, taskController) => {
    await reassignTasks(user, taskController)
    await assignTasks(user, taskController)
}