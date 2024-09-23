const { groupBy, keys, first } = require("lodash")
const uuid = require("uuid").v4

// const commitSubmitedTasks = async taskController => {
//     try {

//         console.log(">> Basic_Relabeling_1st: Commit submited tasks")

//         let commitedTasks = await taskController.selectTask({
//             matchVersion: {

//                 head: true,
//                 type: "submit",
//                 "metadata.actual_task": "Basic_Relabeling_1st",
//                 "metadata.task.Basic_Relabeling_1st.status": "submit",
//                 expiredAt: {
//                     $lt: new Date()
//                 }
//             }
//         })

//         for (let version of commitedTasks) {
//             console.log(">> create task for ",version.id)
//             let options = taskController.context
//             options.dataId = [version.dataId]

//             const brancher = await taskController.getBrancher(options)

//             version.lockRollback = true
            
//             // version.metadata.task.Basic_Labeling_2nd = {
//             //     id: uuid(),
//             //     status: "open",
//             //     reason: "The relabeling by the 1st expert is completed. Data verification from a 2nd expert is required.",
//             //     createdAt: new Date()
//             // }

//             await brancher.updateVersion({ version })
//         }

//     } catch (e) {
//         console.log(e.toString(), e.stack)
//     }
// }


module.exports = async (user, taskController) => {

    // console.log(`>> Basic_Relabeling_1st for ${user.altname}`)

    // await commitSubmitedTasks(taskController)

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
            "metadata.actual_task": {
                $in: ["Basic_Labeling_2nd","Basic_Relabeling_2nd"]
            },
            "metadata.task.Basic_Relabeling_1st.status": "open",
            "branch": {
                $exists: false
            },
            expiredAt: {
                $lt: new Date()
            }
        }
    })

    tasks = tasks.slice(0, activity.priority)

    if(tasks.length > 0){
        console.log(`>> Basic_Relabeling_1st for ${user.altname}: assign ${tasks.length} tasks`)
    }

    return {
        version: tasks,
        metadata: {
            "actual_task": "Basic_Relabeling_1st",
            "actual_status": "Waiting for the start.",
            "task.Basic_Relabeling_1st.user": user.altname,
            "task.Basic_Relabeling_1st.status": "start",
            "task.Basic_Relabeling_1st.updatedAt": new Date(),
            permission: ["open", "rollback", "sync", "history", "save", "submit"]
 
        }
    }

}