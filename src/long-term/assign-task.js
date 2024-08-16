const createTaskController = require("../utils/task-controller")

const strategy = require("../strategies/schedule")

const assignTasks = async (options = {}) => {

    options.strategy = strategy
    const controller = createTaskController(options)
    await controller.assignTasks(options)

}


module.exports = assignTasks