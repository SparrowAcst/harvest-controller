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

const listEmployeePriority = async (req, res) => {
    let controller = await createTaskController()
    let result = await controller.listEmploeePriorities()
    res.status(200).send(result)
}

const getStrategiesSettings = async (req, res) => {
    res.status(200).send(settings())
}

const setStrategiesSettings = async (req, res) => {
    settings().setProperties( req.body || {})
    res.status(200).send(settings())
}



module.exports = {
    resetEmployeePriority,
    listEmployeePriority,
    getStrategiesSettings,
    setStrategiesSettings
}