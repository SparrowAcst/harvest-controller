const { groupBy, keys, first } = require("lodash")
const uuid = require("uuid").v4



module.exports = async (user, taskController) => {

    let priorities = await taskController.getEmploeePriorities({ user: user.altname })
    // console.log("relab 1st priorities", priorities)

    let tasks = await taskController.selectTask({
        matchVersion: {
            "metadata.task.Basic_Relabeling_1st.status": "open",
            "metadata.task.Basic_Relabeling_1st.expert": user.altname,
            "branch": {
                $exists: false
            },
            "expiredAt": {
                $lt: new Date()
            }
        }
    })

    // let tasks = await taskController.selectTask({
    //     matchVersion: {
    //         head: true,
    //         type: "submit",
    //         "metadata.actual_task": {
    //             $in: ["Basic_Labeling_2nd", "Basic_Relabeling_2nd"]
    //         },
    //         "metadata.task.Basic_Relabeling_1st.status": "open",
    //         "branch": {
    //             $exists: false
    //         },
    //         expiredAt: {
    //             $lt: new Date()
    //         }
    //     }
    // })


    if (tasks.length > 0) {
        console.log(`>> Basic_Relabeling_1st for ${user.altname}: assign ${tasks.length} tasks`)
    }

    priorities[user.altname] -= tasks.length


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