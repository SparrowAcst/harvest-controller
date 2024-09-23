const createTaskController = require("../utils/task-controller")
const LongTerm = require("../utils/long-term-queue")
const strategy = require("../strategies/schedule")
const { uniqBy } = require("lodash")


const POOL = {}

const assignTasksOperation = async (options = {}) => {
    try {
    
    let { user } = options
    
    console.log("ASSIGN TASKS PROCEDURE STARTS FOR", user.altname)
    
    options.strategy = strategy


    let schedules = uniqBy(
                        (user.grants.schedule || [])
                        .concat(
                            ((user.grants.profile) ? user.grants.profile.schedule : []) || []
                        )
                    )    
    
    console.log(user.altname, schedules)

    options.schedule = schedules.map( s => strategy[s]).filter( s => s )
    
    
    if(options.schedule.length > 0){
    	const controller = createTaskController(options)
    	await controller.assignTasks(options)
	}
    
    POOL[user.altname] = false
    console.log("ASSIGN TASKS PROCEDURE COMPLETE FOR", user.altname)
    console.log( "POOL", POOL)
    } catch (e) {
        console.log(e.toString(), e.stack)
    }    

}

const assignTasks = (options = {}) => {
	console.log("CALL assignTasks")
    
    let { user } = options
    
    if(POOL[user.altname]) {
        console.log("SKIP ASSIGN TASKS PROCEDURE FOR", user.altname)
        console.log( "POOL", POOL)
        return
    }    

    POOL[user.altname] = true    
    
	LongTerm.execute( async () => {
		await assignTasksOperation(options)		
	})

}

module.exports = assignTasks