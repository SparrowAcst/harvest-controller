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


const { closeSegmentationRequest } = require("./long-term/close-segmentation-request")



const openRequest =  async (req, res) => {
	try {

		let options = req.body.options
        options = extend({}, options, req.body.cache.currentDataset)
        options.strategy = options.strategy || "test"
        
        if( requestStrategy[options.strategy] && requestStrategy[options.strategy].openRequest ){
        	let request 
        	request = await requestStrategy[options.strategy].openRequest(options)
        	res.status(200).send({
				id: request.id,
				user: request.user,
				opened: request.opened,
				updatedAt: request.updatedAt
			})
		} else {
			throw new Error(`No openRequest for ${options.strategy}`)
		}
	
	} catch (e) {
		
		delete req.body.cache
		res.status(503).send({ 
			error: `${e.toString()}\n${e.stack}`,
			requestBody: req.body
		})

	}
}

const closeRequest =  async (req, res) => {

		let requestId = req.query.requestId || req.params.requestId || (req.body && req.body.requestId)
		
		let options = {
			requestId,
			configDB: globalDB
		}	
		
		if (req.eventHub.listenerCount("close-segmentation-request") == 0) {
            req.eventHub.on("close-segmentation-request", closeSegmentationRequest)
        }

        req.eventHub.emit( "close-segmentation-request", options )

        res.status(200).send("ok")

}	


const getSegmentationData =  async (req, res) => {
	try {
		let requestId = req.query.requestId || req.params.requestId || (req.body && req.body.requestId)
		let result = await mongodb.aggregate({
			db: globalDB,
			collection: `settings.segmentation-requests`,
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

		// console.log(`${globalDB.name}.segmentation-requests`, result)

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
			collection: `settings.segmentation-requests`,
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
			collection: `settings.segmentation-requests`,
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