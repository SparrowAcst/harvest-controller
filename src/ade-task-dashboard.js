const mongodb = require("./mongodb")
const { extend, find } = require("lodash")
const moment = require("moment")

const createTaskController = require("./utils/task-controller")

const dataView = d => ({
        "Patient ID": d["Examination ID"],
        "Device": d.model,
        "Body Spot": d["Body Spot"],
        "S3": (d.segmentation && d.segmentation.S3 && d.segmentation.S3.length > 0) ? "present" : " ",
        "Murmurs": (
                (d["Systolic murmurs"].filter( d => d != "No systolic murmurs").length + 
                d["Diastolic murmurs"].filter( d => d != "No diastolic murmurs").length +
                d["Other murmurs"].filter( d => d != "No Other Murmurs").length) > 0
            ) ? "present" : " ",
        "Complete": d.complete
    })


const getActiveTask = async (req, res) => {
    try {

        let { options } = req.body

        options = extend( options, req.body.cache.currentDataset)


        const controller = createTaskController(options)

        let taskList = await controller.selectEmployeeTask({

            matchEmployee: {
                namedAs: options.user.altname
            },

            matchVersion: {
                head: true,
                // readonly: false
            }

        })

        res.send({
            query: req.body,
            result: taskList
        })

    } catch (e) {
        res.send({
            error: e.toString(),
            requestBody: req.body
        })
    }
}

const getEmployeeStat = async (req, res) => {
    try {

        let { options } = req.body

        options = extend( options, req.body.cache.currentDataset)

        const controller = createTaskController(options)

        let result = await controller.getEmployeeStat({

            employee: {
                namedAs: options.user.altname
            },

            // version: {
            //     createdAt: {
            //         $gte: moment(new Date()).subtract(...options.taskQuotePeriod).toDate()
            //     }
            // }

        })

        if (result.length > 0) {
            res.send({
                totals: result[0].totals,
                // quote: result[0].quote
            })
        } else {
            res.send({
                totals: {},
                quote: []
            })
        }

    } catch (e) {
        res.send({
            error: e.toString(),
            requestBody: req.body
        })
    }
}


module.exports = {
    getActiveTask,
    getEmployeeStat
}