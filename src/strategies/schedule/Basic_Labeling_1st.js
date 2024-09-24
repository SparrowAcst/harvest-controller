const { groupBy, keys, first } = require("lodash")
const uuid = require("uuid").v4


module.exports = async (user, taskController) => {
    try {
    let priorities = await taskController.getEmploeePriorities({user: user.altname})
    console.log("lab 1st priorities", priorities, priorities[user.altname])

    if(!priorities[user.altname] || priorities[user.altname] == 0) return

    let tasks = await taskController.selectTask({
        matchVersion: {
            "metadata.task.Basic_Labeling_1st.status": "open",
            "type": "main",
            "head": true,
            "branch": {
                $exists: false
            }
        }
    })

    tasks = tasks.slice(0, priorities[user.altname])
    
    console.log(tasks,"tasks")

    if(tasks.length > 0){
        console.log(`>> Basic_Labeling_1st for ${user.altname}: assign ${tasks.length} tasks`)
    }

    priorities[user.altname] -= tasks.length
    
    return {
        version: tasks,
        metadata: {
            "actual_task": "Basic_Labeling_1st",
            "actual_status": "Waiting for the start.",
            "task.Basic_Labeling_1st.user": user.altname,
            "task.Basic_Labeling_1st.status": "start",
            "task.Basic_Labeling_1st.updatedAt": new Date(),
            permission: ["open", "rollback", "sync", "history", "save", "submit"]
 
        }
    }

} catch(e) {
    console.log("Schedule Basic_Labeling 1st: ",e.toString(), e.stack)
}

}