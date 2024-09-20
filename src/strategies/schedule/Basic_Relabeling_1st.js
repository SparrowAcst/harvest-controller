const { groupBy, keys, first } = require("lodash")


const commitSubmitedTasks = async taskController => {
    try {

        console.log(">> Basic_Labeling_1st: Commit submited tasks")

        let commitedTasks = await taskController.selectTask({
            matchVersion: {

                head: true,
                type: "submit",
                "metadata.task.Basic_Relabeling_1st.status": "submit",
                expiredAt: {
                    $lt: new Date()
                }

            }
        })

        for (let version of commitedTasks) {

            let options = taskController.context
            options.dataId = [version.dataId]

            const brancher = await taskController.getBrancher(options)

            version.lockRollback = true
            // version.metadata.actual_status = "done"

            await brancher.updateVersion({ version })
        }

    } catch (e) {
        console.log(e.toString(), e.stack)
    }
}


module.exports = async (user, taskController) => {

    console.log(`>> Basic_Relabeling_1st for ${user.altname}`)

    await commitSubmitedTasks(taskController)

    // select user activity
    let activity = await taskController.getEmployeeStat({
        matchEmployee: u => u.namedAs == user.altname
    })

    activity = activity[0]
    if (!activity) return { version: [] }

    let tasks = await taskController.selectTask({
        matchVersion: {
            head: true,
            type: "submit",
            "metadata.task.Basic_Relabeling_1st.status": "open",
            "branch": {
                $exists: false
            }
        }
    })

    tasks = tasks.slice(0, activity.priority)

    console.log(`>> Basic_Relabeling_1st for ${user.altname}: assign ${tasks.length} tasks`)
    return {
        version: tasks,
        metadata: {
            "actual_task": "Basic_Relabeling_1st",
            "actual_status": "waiting for the start",
            "task.Basic_Relabeling_1st.status": "start",
            "task.Basic_Relabeling_1st.updatedAt": new Date(),
        }
    }

}