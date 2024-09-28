const createTaskController = require("../utils/task-controller")
const LongTerm = require("../utils/long-term-queue")
const strategy = require("../strategies/schedule")
const { uniqBy, find } = require("lodash")
const uuid = require("uuid").v4()

const POOL = {}

const getUserSchedule = options => {
    let { userProfiles, user } = options
    
    let cachedUser = find(userProfiles, p => {
        return p.namedAs == user.altname
    })
    
    if (!cachedUser) return []
    return uniqBy(
        (cachedUser.schedule || [])
        // .concat(
        //     ((cachedUser.profile) ? cachedUser.profile.schedule : []) || []
        // )
    )
}

const assignTasksOperation = async (options = {}) => {
    try {

        let { initiator } = options
        let user = initiator
        options.user = initiator


        options.strategy = strategy

        let schedules = getUserSchedule(options)

        LongTerm.pool.startTask("assign-tasks", user.altname)

        console.log("ASSIGN TASKS PROCEDURE STARTS FOR", user.altname, schedules)

        

        options.schedule = schedules.map(s => strategy[s]).filter(s => s)

        

        if (options.schedule.length > 0) {
            const controller = createTaskController(options)
            await controller.assignTasks(options)
        }

        POOL[user.altname] = false
        console.log("ASSIGN TASKS PROCEDURE COMPLETE FOR", user.altname)
        console.log("POOL", POOL)

        LongTerm.pool.stopTask("assign-tasks", user.altname)

    
    } catch (e) {
        console.log(e.toString(), e.stack)
    }

}

const assignTasks = (options = {}) => {
    console.log("CALL assignTasks")

    let { user } = options

    if (POOL[user.altname]) {
        console.log("SKIP ASSIGN TASKS PROCEDURE FOR", user.altname)
        console.log("POOL", POOL)
        return
    }

    POOL[user.altname] = true

    LongTerm.execute(async () => {
        await assignTasksOperation(options)
    })

}

module.exports = assignTasks