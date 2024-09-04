const { groupBy, keys, first } = require("lodash")


const commitSubmitedTasks = async taskController => {

    console.log(">> Base_Labeling_2nd: Commit submited tasks")

    let commitedTasks = await taskController.selectTask({
        matchVersion: {
            
            head: true,

            type: "submit",

            "metadata.task.Base_Labeling_2nd.status" : "submit",

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

    
    for(let version of commitedTasks){
        
        let options = taskController.context
        options.dataId = [ version.dataId ]
        
        const brancher = await taskController.getBrancher(options)
        
        await brancher.commit({
            source: version,
            metadata:{
                "task.Base_Labeling_2nd.status":"done",
                "task.Base_Labeling_2nd.updatedAt": new Date(),
                "actual_task": null,
            }
        })
        
    }
    // console.log(commitedTasks)

}


module.exports = async (user, taskController) => {

    console.log(`>> Base_Labeling_2nd for ${user.altname}`)

    await commitSubmitedTasks(taskController)

    // select user activity
    let activity = await taskController.getEmployeeStat({ matchEmployee: { namedAs: user.altname } })
    activity = activity[0]
    if (!activity) return { version: [] }

    // select not assigned tasks
    let tasks = await taskController.selectTask({
        matchVersion: {
            "metadata.task.Base_Labeling_2nd.status": "open",
            "type": "main",
            "head": true,
            "branch": {
                $exists: false
            }
        }
    })

    tasks = tasks.slice(0, activity.priority)

    console.log(`>> Base_Labeling_2nd for ${user.altname}: assign ${tasks.length} tasks`)
    return {
        version: tasks,
        metadata: {
            "actual_task": "Base_Labeling_2nd",
            "task.Base_Labeling_2nd.status": "start",
            "task.Base_Labeling_2nd.updatedAt": new Date(),
        }
    }

}