const { groupBy, keys, first } = require("lodash")


const commitSubmitedTasks = async (user, taskController) => {
    try {
        console.log(">> Manual_merging: Commit submited tasks")

        let commitedTasks = await taskController.selectTask({
            matchVersion: {

                head: true,

                user: user.altname,

                type: "submit",

                "metadata.task.Manual_merging.status": "submit",

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

        priorities = await taskController.getEmploeePriorities({ user: user.altname })
        priorities[user.altname] += commitedTasks.length


        for (let version of commitedTasks) {

            let options = taskController.context
            options.dataId = [version.dataId]

            const brancher = await taskController.getBrancher(options)

            delete version.metadata.task.Manual_merging.versions

            await brancher.commit({
                source: version,
                metadata: {
                    // "task.Manual_merging.status": "done",
                    // "task.Manual_merging.updatedAt": new Date(),
                    "actual_task": "none",
                    "actual_status": "none",
                    lock: false
                }
            })

        }
    } catch (e) {
        console.error(e.toString(), e.stack)
    }
}


module.exports = async (user, taskController) => {

    // console.log(`>> Manual_merging for ${user.altname}`)

    await commitSubmitedTasks(user, taskController)

    let priorities = await taskController.getEmploeePriorities({user: user.altname})
    console.log("Manual Merging priorities", priorities, priorities[user.altname])

    if(!priorities[user.altname] || priorities[user.altname] == 0) return


    // select user activity
    // let activity = await taskController.getEmployeeStat({
    //     matchEmployee: u => u.namedAs == user.altname
    // })

    // activity = activity[0]
    // if (!activity) return { version: [] }

    let tasks = await taskController.selectTask({
        matchVersion: {

            head: true,

            type: "merge",

            "metadata.task.Manual_merging.state": "open",

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
            }

        }
    })

    tasks = tasks.slice(0, priorities[user.altname])

    // console.log(`>> Manual_merging for ${user.altname}: assign ${tasks.length} tasks`)
    return {
        version: tasks,
        metadata: {
            "actual_task": "Manual_merging",
            "actual_status": "Waiting for the start.",
            "task.Manual_merging.user": user.altname,
            "task.Manual_merging.status": "start",
            "task.Manual_merging.updatedAt": new Date(),
            "permission": ["rollback", "sync", "history", "save", "submit"]

        }
    }

}