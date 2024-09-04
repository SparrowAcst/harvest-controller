const { groupBy, keys, first } = require("lodash")


const commitSubmitedTasks = async taskController => {

    console.log(">> Check_S3_Segmentation: Commit submited tasks")

    let commitedTasks = await taskController.selectTask({
        matchVersion: {
            
            head: true,

            type: "submit",

            "metadata.task.Check_S3_Segmentation.status" : "submit",

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
                "task.Check_S3_Segmentation.status":"done",
                "task.Check_S3_Segmentation.updatedAt": new Date(),
                "actual_task": null,
                
            }
        })
        
    }
    // console.log(commitedTasks)

}


module.exports = async (user, taskController) => {

    console.log(`>> Check_S3_Segmentation for ${user.altname}`)

    // select user activity
    let activity = await taskController.getEmployeeStat({ matchEmployee: { namedAs: user.altname } })
    activity = activity[0]
    if (!activity) return { version: [] }

    // select not assigned tasks
    let tasks = await taskController.selectTask({
        matchVersion: {
            "metadata.task.Check_S3_Segmentation.status": "open",
            "type": "main",
            "head": true,
            "branch": {
                $exists: false
            }
        }
    })

    tasks = tasks.slice(0, activity.priority)

    console.log(`>> Check_S3_Segmentation for ${user.altname}: assign ${tasks.length} tasks`)
    return {
        version: tasks,
        metadata: {
            "actual_task": "Check_S3_Segmentation",
            "task.Check_S3_Segmentation.status": "start",
            "task.Check_S3_Segmentation.updatedAt": new Date(),
        }
    }

}