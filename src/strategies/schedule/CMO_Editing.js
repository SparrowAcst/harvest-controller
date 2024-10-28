const { groupBy, keys, first, uniqBy } = require("lodash")
const uuid = require("uuid").v4

const commitSubmitedTasks = async (user, taskController) => {


    let commitedTasks = await taskController.selectTask({

        matchVersion: {

            head: true,

            type: "submit",
            "metadata.actual_task": "CMO_Editing",
            "metadata.task.CMO_Editing.status": "submit",

            "user": user.altname,

            branch: {
                $exists: false
            },
            save: {
                $exists: false
            },
            commit: {
                $exists: false
            },
            submit: {
                $exists: false
            },

            expiredAt: {
                $lt: new Date()
            }

        }

    })

    if (commitedTasks.length > 0) {
        console.log(`>> CMO_Editing: Commit ${commitedTasks.length} tasks`)

    }

    priorities = await taskController.getEmploeePriorities({ user: user.altname })

    priorities[user.altname] += commitedTasks.length

    for (let version of commitedTasks) {

        let options = taskController.context
        options.dataId = [version.dataId]

        const brancher = await taskController.getBrancher(options)

        await brancher.commit({
            source: version,
            metadata: {
                // "task.Basic_Finalization.status": "done",
                // "task.Basic_Finalization.updatedAt": new Date(),
                "actual_task": "none",
                "actual_status": "none",
                "lock": false
            }
        })

    }

}


// module.exports = async (user, taskController) => {

//     console.log(`>> CMO_Editing for ${user.altname}`)

//     await commitSubmitedTasks(user, taskController)


//     let priorities = await taskController.getEmploeePriorities({ user: user.altname })
//     // console.log("fin priorities", priorities)

//     if (!priorities[user.altname] || priorities[user.altname] == 0) return

//     // select not assigned tasks


//     let tasks = await taskController.selectTask({
//         matchVersion: {

//             head: true,

//             type: "main",
//             "metadata.task.CMO_Editing.status": "open",

//             branch: {
//                 $exists: false
//             },
//             save: {
//                 $exists: false
//             },
//             commit: {
//                 $exists: false
//             },
//             submit: {
//                 $exists: false
//             }
//         }
//     })


//     tasks = tasks.slice(0, priorities[user.altname])

//     if (tasks.length > 0) {
//         console.log(`>> CMO_Editing for ${user.altname}: assign ${tasks.length} tasks`)
//     }

//     priorities[user.altname] -= tasks.length


//     return {
//         version: tasks,
//         metadata: {
//             "actual_task": "CMO_Editing",
//             "actual_status": "Waiting for the start.",
//             "task.CMO_Editing.user": user.altname,
//             "task.CMO_Editing.status": "start",
//             "task.CMO_Editing.updatedAt": new Date(),
//             permission: ["open", "rollback", "sync", "history", "save", "submit"]

//         }
//     }

// }


module.exports = async (user, taskController) => {
    try {

        await commitSubmitedTasks(user, taskController)

        let priorities = await taskController.getEmploeePriorities({ user: user.altname })
        console.log("CMO_Editing", priorities, priorities[user.altname])

        if (!priorities[user.altname] || priorities[user.altname] == 0) return

        let tasks = await taskController.selectTask({
            matchVersion: {
                "metadata.task.CMO_Editing.status": "open",
                "type": "main",
                "head": true,
                "branch": {
                    $exists: false
                }
            }
        })

        tasks = tasks.slice(0, priorities[user.altname])

        console.log(tasks, "tasks")

        if (tasks.length > 0) {
            console.log(`>> CMO_Editing for ${user.altname}: assign ${tasks.length} tasks`)
        }

        priorities[user.altname] -= tasks.length

        return {
            version: tasks,
            metadata: {
                "actual_task": "CMO_Editing",
                "actual_status": "Waiting for the start.",
                "task.CMO_Editing.user": user.altname,
                "task.CMO_Editing.status": "start",
                "task.CMO_Editing.updatedAt": new Date(),
                permission: ["open", "rollback", "sync", "history", "save", "submit"]

            }
        }

    } catch (e) {
        console.log("Schedule CMO_Editing: ", e.toString(), e.stack)
    }
}