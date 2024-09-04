const createTaskController = require("../utils/task-controller")
const LongTerm = require("../utils/long-term-queue")
const strategy = require("../strategies/schedule")

const assignTasksOperation = async (options = {}) => {

    options.strategy = strategy

    let { user } = options

    let schedules = user.grants.schedule || ((user.grants.profile) ? user.grants.profile.schedule : undefined) || []
    
    options.schedule = schedules.map( s => strategy[s]).filter( s => s )
    
    if(options.schedule.length > 0){
    	const controller = createTaskController(options)
    	await controller.assignTasks(options)
	}
    
}

const assignTasks = (options = {}) => {
	console.log("CALL assignTasks")
	LongTerm.execute( async () => {
		await assignTasksOperation(options)		
	})
}

module.exports = assignTasks