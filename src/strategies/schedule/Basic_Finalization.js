const { groupBy, keys, first, uniqBy } = require("lodash")
const uuid = require("uuid").v4

const commitSubmitedTasks = async taskController => {

    
    let commitedTasks = await taskController.selectTask({
        matchVersion: {

            head: true,

            type: "submit",

            "metadata.actual_task": "Basic_Finalization",
            "metadata.task.Basic_Finalization.status": "submit",

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

    if(commitedTasks.length > 0){
        console.log(`>> Basic_Finalization: Commit ${commitedTasks.length} tasks`)

    }

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
                "actual_status": "none"
            }
        })

    }

}


module.exports = async (user, taskController) => {

    // console.log(`>> Basic_Finalization for ${user.altname}`)

    await commitSubmitedTasks(taskController)

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
            "metadata.actual_task": "Basic_Relabeling_2nd",
            "metadata.task.Basic_Relabeling_2nd.status": "submit",
            "metadata.task.Basic_Relabeling_2nd.initiator": user.altname,
            "metadata.task.Basic_Finalization.status": "open",

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
                "metadata.actual_task": "Basic_Labeling_2nd",
                "metadata.task.Basic_Labeling_2nd.status": "submit",
                "metadata.task.Basic_Finalization.status": "open",

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

    if(tasks.length > 0) {
        console.log(`>> Basic_Finalization for ${user.altname}: assign ${tasks.length} tasks`)
    }
    
    return {
        version: tasks,
        metadata: {
            "actual_task": "Basic_Finalization",
            "actual_status": "Waiting for the start.",
            "task.Basic_Finalization.user": user.altname,
            "task.Basic_Finalization.status": "start",
            "task.Basic_Finalization.updatedAt": new Date(),

        }
    }

}