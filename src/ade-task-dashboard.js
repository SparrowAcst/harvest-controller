const mongodb = require("./mongodb")
const { extend } = require("lodash")
const moment = require("moment")

const createTaskController = require("./utils/task-controller")
const { getSegmentationAnalysis } = require("./utils/segment-analysis")


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

const getGrants = async (req, res) => {
    try {

        let options = req.body.options

        let { user, db, grantCollection, profileCollection } = options 

        options = extend({}, options, {
            collection: `${db.name}.${grantCollection}`,
            pipeline: [
              {
                $match:
                  {
                    email: user.email,
                  },
              },
              {
                $lookup:
                  {
                    from: profileCollection,
                    localField: "profile",
                    foreignField: "name",
                    as: "result",
                    pipeline: [
                      {
                        $project: {
                          _id: 0,
                        },
                      },
                    ],
                  },
              },
              {
                $addFields:
                  {
                    profile: {
                      $first: "$result",
                    },
                  },
              },
              {
                $project:
                  {
                    _id: 0,
                    result: 0,
                  },
              },
            ]
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



const getRecordData = async (req, res) => {
	try {

		let { options } = req.body
        options.dataId = [options.recordId]

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
        if( head.data.segmentation){
            head.data.segmentationAnalysis = getSegmentationAnalysis( head.data.segmentation )
        }

    	res.send(head)

	} catch (e) {
		res.send({
	            error: e.toString(),
	            requestBody: req.body
	        })
	}
}


const saveRecordData = async (req, res) => {
    try {

        let { options } = req.body
        
        options = extend({}, options, {dataView})

        const controller = createTaskController(options)
        let brancher = await controller.getBrancher(options)
        
        let result = await brancher.save(options)

        res.send(result)

    } catch (e) {
        res.send({
                error: e.toString(),
                requestBody: req.body
            })
    }
}

const submitRecordData = async (req, res) => {
    try {

        let { options } = req.body
        
        options = extend({}, options, {dataView})

        const controller = createTaskController(options)
        let brancher = await controller.getBrancher(options)
        
        options.source = await brancher.save(options)
        let result = await brancher.freeze(options)

        res.send(result)

    } catch (e) {
        res.send({
                error: e.toString(),
                requestBody: req.body
            })
    }
}


const rollbackRecordData = async (req, res) => {
    try {

        let { options } = req.body
        
        options = extend({}, options, {dataView, dataId: options.recordId})

        const controller = createTaskController(options)
        let brancher = await controller.getBrancher(options)
        
        let result = await brancher.rollback(options)

        res.send(result)

    } catch (e) {
        res.send({
                error: e.toString(),
                requestBody: req.body
            })
    }
}


const getVersionChart = async (req, res) => {
    try {

        let { options } = req.body
        
        options = extend({}, options, {dataView})

        const controller = createTaskController(options)
        let brancher = await controller.getBrancher(options)
        
        let result = await brancher.getChart(options)

        res.send(result)

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
    getRecordData,
    saveRecordData,
    submitRecordData,
    rollbackRecordData,
    getVersionChart
    
}