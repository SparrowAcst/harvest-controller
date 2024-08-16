const { groupBy, keys, first } = require("lodash")


module.exports = async ( user, taskController) => {

	console.log(`Strategy labeling_2nd for ${user.altname}`)
	
	// select user activity
	let activity = await taskController.getEmployeeStat({ matchEmployee: { namedAs: user.altname } })
	activity = activity[0]
	if(!activity) return []

	// select not assigned tasks
	let tasks = await taskController.selectTask({
		matchVersion: {
		  head: true,
		  type: "submit",
		  expiredAt:{
		    $lte: new Date()
		  },  
		  "metadata.task_name": "Labeling"
		}
	})

	tasks = tasks.slice(0, activity.priority)
	tasks = tasks.map( t => {
		t.metadata.task_name = "labeling_2nd"
		return t 
	})

	console.log(`Strategy labeling_2nd for ${user.altname}: assign ${tasks.length} tasks`)
	return tasks

	// // return tasks or []
	// if(tasks.length <= activity.priority){
	
	// 	return tasks	
	
	// } else {
	
	// 	return []
	
	// }

}

