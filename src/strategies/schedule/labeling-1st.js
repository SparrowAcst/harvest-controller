const { groupBy, keys, first } = require("lodash")


module.exports = async ( user, taskController) => {
	
	console.log(`Strategy labeling_1st for ${user.altname}`)
	// select user activity
	let activity = await taskController.getEmployeeStat({ matchEmployee: { namedAs: user.altname } })
	activity = activity[0]
	if(!activity) return []

	// select not assigned tasks
	let tasks = await taskController.selectTask({
		matchVersion: {
		  "metadata.task_name": "Labeling",
		  "type": "main",
		  "head": true,
		  "branch":{
		  	$exists: false
		  }
		}
	})

	tasks = groupBy(tasks, t => t.metadata.patientId)
	console.log("Tasks:", keys(tasks))
	tasks = first( keys(tasks).map(k=> tasks[k]))
	

	// return tasks or []
	if(tasks && tasks.length <= activity.priority){
		console.log(`Strategy labeling_1st for ${user.altname}: assign ${tasks.length} tasks`)
		return tasks	
	
	} else {
	
		return []
	
	}

}

