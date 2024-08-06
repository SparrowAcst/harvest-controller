const {extend, sortBy, uniq, flattenDeep, find, last} = require("lodash")
const moment = require("moment")
const uuid = require("uuid").v4
const path = require("path")
const { loadYaml } = require("./utils/file-system")

const mongodb = require("./mongodb")
const requestStrategy = require("./strategies/segmentation-request")

const config = loadYaml(path.join(__dirname, "../../sync-data/.config/db/mongodb.conf.yml"))
const globalDB= {
    url: config.db.url,
    name: config.db.name
}


const openRequest =  async (req, res) => {
	try {

		let options = req.body.options
        options = extend({}, options, req.body.cache.currentDataset)

        let { db, segmentCollection, version, user } = options

        
		let existed = await mongodb.aggregate({
			db: globalDB,
			collection: `${globalDB.name}.segmentation-requests`,
			pipeline: [
				{
					$match: {
						version: version.id,
					}
				},   
	            {
	                $project:{ _id: 0 }
	            }
	        ] 
		})

		if( existed.length > 0) {
			res.send({
				id: null
			})
			return
		}

		let request = {
			id: uuid(),
			user: user.altname,
			version: version.id,
			dataId: version.data.id,
			db,
			collection: segmentCollection,
			createdAt: new Date(),
			updatedAt: new Date(),
			requestData: (await requestStrategy.task[version.metadata.task_name].openRequest(options)),
			responseData: null 
		}

		await mongodb.replaceOne({
			db: globalDB,
			collection: `${globalDB.name}.segmentation-requests`,
			filter: {
				id: request.id
			},
			data: request
		})

		res.send({
			id: request.id
		})

	
	} catch (e) {
		
		delete req.body.cache
		
		res.status(503).send({ 
			error: `${e.toString()}\n${e.stack}`,
			requestBody: req.body
		})

	}
}

const closeRequest =  async (req, res) => {
	try {
		
		let requestId = req.query.requestId || req.params.requestId || (req.body && req.body.requestId)
		
		console.log("Close", requestId)
		await mongodb.updateOne({
			db: globalDB,
			collection: `${globalDB.name}.segmentation-requests`,
			filter:{
				id: requestId
			},
			data:{
				closedAt: new Date()
			}
		})

		res.status(200).send()
	
	} catch (e) {
	
		delete req.body.cache
		
		res.status(503).send({ 
			error: `${e.toString()}\n${e.stack}`,
			requestBody: req.body
		})
	
	}
}


const getSegmentationData =  async (req, res) => {
	try {
		let requestId = req.query.requestId || req.params.requestId || (req.body && req.body.requestId)
		let result = await mongodb.aggregate({
			db: globalDB,
			collection: `${globalDB.name}.segmentation-requests`,
			pipeline:[
				{
					$match: {
						id: requestId
					}
				},
				{
					$project: {
						_id: 0
					}
				}
			]
		})

		if(result.length > 0){
			res.status(200).send(result[0].requestData)
		} else {
			res.status(404).send(`Request ${requestId} not found`)
		}
		
	} catch (e) {
	
		delete req.body.cache
	
		res.status(503).send({ 
			error: `${e.toString()}\n${e.stack}`,
			requestBody: req.body
		})
	
	}
}

const getSegmentationDataRaw =  async (req, res) => {
	try {
		let requestId = req.query.requestId || req.params.requestId || (req.body && req.body.requestId)
		let result = await mongodb.aggregate({
			db: globalDB,
			collection: `${globalDB.name}.segmentation-requests`,
			pipeline:[
				{
					$match: {
						id: requestId
					}
				},
				{
					$project: {
						_id: 0
					}
				}
			]
		})

		if(result.length > 0){
			delete result[0].db
			res.status(200).send(result[0])
		} else {
			res.status(404).send(`Request ${requestId} not found`)
		}
		
	} catch (e) {
	
		delete req.body.cache
	
		res.status(503).send({ 
			error: `${e.toString()}\n${e.stack}`,
			requestBody: req.body
		})
	
	}
}

const updateSegmentationData =  async (req, res) => {
	try {
		
		let requestId = req.query.requestId || req.params.requestId || (req.body && req.body.requestId)
		let data = req.body
		
		await mongodb.updateOne({
			db: globalDB,
			collection: `${globalDB.name}.segmentation-requests`,
			filter:{
				id: requestId
			},
			data:{
				responseData: data,
				updatedAt: new Date()
			}
		})

		res.status(200).send()
	
	} catch (e) {
	
		delete req.body.cache
		
		res.status(503).send({ 
			error: `${e.toString()}\n${e.stack}`,
			requestBody: req.body
		})
	
	}
}




	
module.exports = {
	openRequest,
	closeRequest,
	getSegmentationData,
	getSegmentationDataRaw,
	updateSegmentationData
}