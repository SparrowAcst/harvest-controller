const { groupBy, keys, first, uniqBy } = require("lodash")
const uuid = require("uuid").v4

module.exports = async (user, taskController) => {


    let priorities = await taskController.getEmploeePriorities({user: user.altname})
    // console.log("lab 2nd priorities", priorities)

    if(!priorities[user.altname] || priorities[user.altname] == 0) return
    
    // select not assigned tasks

    let tasks = await taskController.selectTask({
        matchVersion: {

            head: true,

            type: "submit",
            "metadata.actual_task": "Basic_Relabeling_1st",
            "metadata.task.Basic_Relabeling_1st.initiator": user.altname,

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

    if (tasks.length > 0) {

        tasks = tasks.slice(0, priorities[user.altname])

        if(tasks.length > 0){
            console.log(`>> Basic_Labeling_2nd for ${user.altname}: assign ${tasks.length} tasks`)
        }

        priorities[user.altname] -= tasks.length

        return {
            version: tasks,
            metadata: {
                "actual_task": "Basic_Labeling_2nd",
                "actual_status": "Waiting for the start.",
                "task.Basic_Labeling_2nd.user": user.altname,
                "task.Basic_Labeling_2nd.status": "start",
                "task.Basic_Labeling_2nd.updatedAt": new Date(),
                permission: ["open", "rollback", "sync", "history", "save", "reject", "submit"]
 
            }
        }
    }


    tasks = await taskController.selectTask({
        matchVersion: {

            head: true,

            type: "submit",
            "metadata.actual_task": "Basic_Labeling_1st",
            "metadata.task.Basic_Labeling_1st.status": "submit",

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


    tasks = tasks.slice(0, priorities[user.altname])

    if(tasks.length > 0){
            console.log(`>> Basic_Labeling_2nd for ${user.altname}: assign ${tasks.length} tasks`)
        }
    
    priorities[user.altname] -= tasks.length
    
    return {
        version: tasks,
        metadata: {
            "actual_task": "Basic_Labeling_2nd",
            "actual_status": "Waiting for the start.",
            "task.Basic_Labeling_2nd.user": user.altname,
            "task.Basic_Labeling_2nd.status": "start",
            "task.Basic_Labeling_2nd.updatedAt": new Date(),
            permission: ["open", "rollback", "sync", "history", "save", "reject", "submit"]
 
        }
    }

}