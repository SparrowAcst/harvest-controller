const { 
    groupBy, 
    keys, 
    first, 
    sortBy, 
    last, 
    sampleSize, 
    shuffle, 
    take, 
    extend 
} = require("lodash")


const PARALLEL_BRANCHES = 2


const selectCandidates = (collaborators, count) => {

    collaborators.pool = shuffle(
        collaborators.candidates
        .concat(collaborators.pool)
        .filter(d => d.priority > 0)
    )
    collaborators.candidates = take(collaborators.pool, count)
    return collaborators

}


module.exports = async (user, taskController) => {

    console.log(`>> Cross_Validation_2nd for ${user.altname}`)


    // select user activity
    let activity = await taskController.getEmployeeStat({ matchEmployee: { namedAs: user.altname } })
    
    console.log("activity", activity)

    activity = activity[0]
    if (!activity) return []
    if (activity.priority == 0) return { version: [] }


    let pool = await taskController.getEmployeeStat({
        matchEmployee: { schedule: "Cross_Validation_2nd" },
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

    // select not assigned tasks
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

    console.log("tasks", tasks)


    tasks = tasks.slice(0, activity.priority)

    let toAssignTask = []

    while (tasks.length > 0 && activity.priority > 0) {
        let task = tasks.pop()
        collaborators = selectCandidates(collaborators, PARALLEL_BRANCHES - 1)
        if (collaborators.candidates.length == PARALLEL_BRANCHES - 1) {
            toAssignTask.push({
                user: user.altname,
                task,
                metadata: {
                    "task.Cross_Validation_2nd.status": "started",
                    "task.Cross_Validation_2nd.collaborators": [collaborators.candidates.map(c => c.namedAs).concat([user.altname])],
                    "task.Cross_Validation_2nd.updatedAt": new Date(),
                    "actual_task": "Cross_Validation_2nd",
                }
            })
            toAssignTask = toAssignTask.concat(
                collaborators.candidates.map(c => ({
                    user: c.namedAs,
                    task,
                    metadata: {
                        "task.Cross_Validation_2nd.status": "started",
                        "task.Cross_Validation_2nd.collaborators": [collaborators.candidates.map(c => c.namedAs).concat([user.altname])],
                        "task.Cross_Validation_2nd.updatedAt": new Date(),
                        "actual_task": "Cross_Validation_2nd",
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
        
        for( let index in t.tasks){
            
            await b.branch({
                source: t.tasks[index].version,
                user: t.user,
                metadata: t.tasks[index].metadata
            })    
        
        }

    }

    return { version: [] }

}