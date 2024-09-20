const { groupBy, keys, first, uniqBy } = require("lodash")


// const commitSubmitedTasks = async taskController => {

//     console.log(">> Basic_Finalization: Commit submited tasks")

//     let commitedTasks = await taskController.selectTask({
//         matchVersion: {

//             head: true,

//             type: "submit",

//             "metadata.task.Basic_Finalization.status": "submit",

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
//             },

//             expiredAt: {
//                 $lt: new Date()
//             }
//         }
//     })

//     for (let version of commitedTasks) {

//         let options = taskController.context
//         options.dataId = [version.dataId]

//         const brancher = await taskController.getBrancher(options)

//         await brancher.commit({
//             source: version,
//             metadata: {
//                 "task.Basic_Finalization.status": "done",
//                 "task.Basic_Finalization.updatedAt": new Date(),
//                 "actual_task": "none",
//                 "actual_status": "none"
//             }
//         })

//     }

// }


module.exports = async (user, taskController) => {

    console.log(`>> Basic_Finalization for ${user.altname}`)

    // await commitSubmitedTasks(taskController)

    // select user activity
    let activity = await taskController.getEmployeeStat({
        matchEmployee: u => u.namedAs == user.altname
    })

    activity = activity[0]
    if (!activity) return { version: [] }

    // select not assigned tasks


    let tasks = await taskController.selectTask({
        matchVersion: {

            head: true,

            type: "submit",

            "metadata.task.Basic_Relabeling_2nd.status": "submit",
            "metadata.task.Basic_Relabeling_2nd.initiator": user.altname,

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

    if (tasks.length == 0) {
        tasks = await taskController.selectTask({
            matchVersion: {

                head: true,

                type: "submit",

                "metadata.task.Basic_Labeling_2nd.status": "submit",

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
    }

    tasks = tasks.slice(0, activity.priority)

    console.log(`>> Basic_Finalization for ${user.altname}: assign ${tasks.length} tasks`)
    return {
        version: tasks,
        metadata: {
            "actual_task": "Basic_Finalization",
            "actual_status": "waiting for the start",
            "task.Basic_Finalization.status": "start",
            "task.Basic_Finalization.updatedAt": new Date(),

        }
    }

}