const { groupBy, keys, first, uniqBy } = require("lodash")
const uuid = require("uuid").v4

const commitSubmitedTasks = async (user, taskController) => {


    let commitedTasks = await taskController.selectTask({

        matchVersion: {

            head: true,

            type: "submit",
            "metadata.actual_task": "Basic_Finalization",
            "metadata.task.Basic_Finalization.status": "submit",
            $or: [{
                    "metadata.task.Basic_Relabeling_2nd": {
                        $exists: false,
                    },
                },
                {
                    "metadata.task.Basic_Relabeling_2nd.status": "submit"
                }
            ],

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
        console.log(`>> Basic_Finalization: Commit ${commitedTasks.length} tasks`)

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
                "actual_status": "none"
            }
        })

    }

}


module.exports = async (user, taskController) => {

    // console.log(`>> Basic_Finalization for ${user.altname}`)

    await commitSubmitedTasks(user, taskController)


    let priorities = await taskController.getEmploeePriorities({ user: user.altname })
    // console.log("fin priorities", priorities)

    if (!priorities[user.altname] || priorities[user.altname] == 0) return

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

    tasks = tasks.slice(0, priorities[user.altname])

    if (tasks.length > 0) {
        console.log(`>> Basic_Finalization for ${user.altname}: assign ${tasks.length} tasks`)
    }

    priorities[user.altname] -= tasks.length


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