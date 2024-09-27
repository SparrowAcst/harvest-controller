const mongodb = require("./mongodb")
const { extend, find } = require("lodash")
const moment = require("moment")
const createTaskController = require("./utils/task-controller")
const settings = require("./strategies/settings")

const resetEmployeePriority = async (req, res) => {
    let controller = await createTaskController()
    console.log("reset priority for", req.params.user)
    let result = await controller.resetEmployeePriority(req.params.user)
    res.status(200).send(result)
}




const listEmployee = async (req, res) => {

    let { dbCache } = req
    let { userProfiles } = dbCache

    let { users } = req.params
    users = users || ""
    users = users.split(",").map(u => u.trim())

    
    let controller = await createTaskController()
    let priority = await controller.listEmploeePriorities()

    let result = userProfiles
        .filter( u => (users[0]) ? users.includes(u.namedAs) : true)
        .filter( u => u.schedule)
        .map(u => ({
            name: u.namedAs,
            schedule: u.schedule,
            priority: priority[u.namedAs]
        }))

    res.status(200).send(result)

}

const updateEmployeeSchedule = async (req, res) => {
    
    let { dbCache } = req
    let { userProfiles } = dbCache

    let { users, schedule } = req.body
    users = users || ""
    users = users.split(",").map(u => u.trim())
   
    if(!users[0]) {
        res.status(404).send("Need user list")
        return
    }     
   
    let result = await mongodb.updateMany({
        db: dbCache.defaultDB,
        collection: `settings.app-grant`,
        filter: {
            namedAs: {$in: users}
        },
        data: { schedule }        
    })

    await dbCache.update()

    res.status(200).send(result)

}

const changeEmployeePriority = async (req, res) => {
    let controller = await createTaskController()
    let { user, delta, mode } = req.params
    let result = await controller.changeEmployeePriority(user, delta, mode)
    res.status(200).send(result)
}

const getStrategiesSettings = async (req, res) => {
    res.status(200).send(settings())
}

const setStrategiesSettings = async (req, res) => {
    settings().setProperties(req.body || {})
    res.status(200).send(settings())
}



module.exports = {
    resetEmployeePriority,
    changeEmployeePriority,
    listEmployee,
    updateEmployeeSchedule,
    getStrategiesSettings,
    setStrategiesSettings
}