const mongodb = require("./mongodb")
const { extend } = require("lodash")
const moment = require("moment")

const createTaskController = require("./utils/task-controller")

const getDatasetList = async (req, res) => {
    try {

        let options = req.body.options

        options = extend({}, options, {
            collection: `${options.db.name}.dataset`,
            pipeline: [{
                $project: { _id: 0 }
            }]
        })

        const result = await mongodb.aggregate(options)
        res.send(result)

    } catch (e) {
        res.send({
            error: e.toString(),
            requestBody: req.body
        })
    }

}

const getActiveTask = async (req, res) => {
    try {

        let { options } = req.body
        const controller = createTaskController(options)

        let taskList = await controller.selectEmployeeTask({

            matchEmployee: {
                namedAs: options.user.altname
            },

            matchVersion: {
                head: true,
                readonly: false
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
        const controller = createTaskController(options)

        let result = await controller.getEmployeeStat({

            employee: {
                namedAs: options.user.altname
            },

            version: {
                createdAt: {
                    $gte: moment(new Date()).subtract(...options.taskQuotePeriod).toDate()
                }
            }

        })

        if (result.length > 0) {
            res.send({
                totals: result[0].totals,
                quote: result[0].quote
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

const getGrants = async (req, res) => {
    try {

        let options = req.body.options

        options = extend({}, options, {
            collection: `${options.db.name}.${options.grantCollection}`,
            pipeline: [{
                $project: { _id: 0 }
            }]
        })


        const result = await mongodb.aggregate(options)
        res.send(result)

    } catch (e) {
        res.send({
            error: e.toString(),
            requestBody: req.body
        })
    }
}

const setQuote = async (req, res) => {
	    try {

        	let options = req.body
        	const controller = createTaskController(options)

        let result = await controller.addEmployeeQuote({
        	employee: options.user.altname,
        	quote: controller.context.employee[options.user.role].TASK_QUOTE,
        	period: controller.context.employee[options.user.role].TASK_QUOTE_PERIOD
        })

        res.send(result)
        
        } catch (e) {
        
	        res.send({
	            error: e.toString(),
	            requestBody: req.body
	        })
    	}
}

const cancelQuote = async (req, res) => {
	    try {

        	let options = req.body
        	const controller = createTaskController(options)

        let result = await controller.addEmployeeQuote({
        	employee: options.user.altname,
        	quote: Infinity,
        	period: controller.context.employee[options.user.role].TASK_QUOTE_PERIOD
        })

        res.send(result)
        
        } catch (e) {
        
	        res.send({
	            error: e.toString(),
	            requestBody: req.body
	        })
    	}
}


const getRecordData = async (req, res) => {
	try {

		let { options } = req.body
        console.log("recordId", options.recordId)
        options.dataId = [options.recordId]
        console.log(options)

        const controller = createTaskController(options)
		let brancher = await controller.getBrancher(options)

	    const userHead = (dataId, user) => version => version.dataId == dataId && version.user == user && version.head == true 
		const mainHead = (dataId, user) => version => version.dataId == dataId && version.type == "main" && version.head == true 
		const getDataHead = (brancher, dataId, user) => {
			let v1 = brancher.select(userHead(dataId, user))[0]
			let v2 = brancher.select(mainHead(dataId, user))[0]
			return (v1) ? v1 : v2
		}	
    
    	let head =  getDataHead( brancher, options.recordId, options.user.altname)
    
    	head.data = (await brancher.resolveData({ version: head }))

    	res.send(head)

	} catch (e) {
		res.send({
	            error: e.toString(),
	            requestBody: req.body
	        })
	}
}

module.exports = {
    getDatasetList,
    getActiveTask,
    getEmployeeStat,
    getGrants,
    setQuote,
    cancelQuote,
    getRecordData,
    
}