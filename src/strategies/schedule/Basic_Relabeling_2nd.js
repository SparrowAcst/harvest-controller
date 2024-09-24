const { groupBy, keys, first } = require("lodash")
const uuid = require("uuid").v4

module.exports = async (user, taskController) => {

    let priorities = await taskController.getEmploeePriorities({user: user.altname})
    console.log("relab 2nd priorities", priorities)

    // select not assigned tasks

    let tasks = await taskController.selectTask({
        matchVersion: {

            head: true,

            type: "submit",

            "metadata.task.Basic_Relabeling_2nd.status": "open",

            branch: {
                $exists: false
            },

            expiredAt: {
                $lt: new Date()
            }
        }
    })

    console.log("tasks", tasks)

    if(tasks.length > 0){
        console.log(`>> Basic_Relabeling_2nd for ${user.altname}: assign ${tasks.length} tasks`)
    }
    
    priorities[user.altname] -= tasks.length
    
    return {
        version: tasks,
        metadata: {
            "actual_task": "Basic_Relabeling_2nd",
            "actual_status": "Waiting for the start.",
            "task.Basic_Relabeling_2nd.user": user.altname,
            "task.Basic_Relabeling_2nd.status": "start",
            "task.Basic_Relabeling_2nd.updatedAt": new Date(),
            permission: ["open", "rollback", "sync", "history", "save", "reject", "submit"]
 
        }
    }

}