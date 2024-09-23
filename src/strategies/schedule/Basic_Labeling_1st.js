const { groupBy, keys, first } = require("lodash")
const uuid = require("uuid").v4


module.exports = async (user, taskController) => {

    // console.log(`>> Basic_Labeling_1st for ${user.altname}`)

    // select user activity
    let activity = await taskController.getEmployeeStat({
        matchEmployee: u => u.namedAs == user.altname
    })

    activity = activity[0]
    console.log("activity", activity)

    if (!activity) return { version: [] }

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

    tasks = tasks.slice(0, activity.priority)
    
    if(tasks.length > 0){
        console.log(`>> Basic_Labeling_1st for ${user.altname}: assign ${tasks.length} tasks`)
    }
    
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

}