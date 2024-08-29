const mongodb = require("../../mongodb")


const openRequest = async options => {
	
	let { configDB } = options

	let res = await mongodb.aggregate({
		db: configDB,
		collection: `${configDB.name}.segmentation-requests`,
		pipeline: [
			{
				$match: {
					strategy: "test"
				}
			}
		]
	})

	return (res[0]) ? res[0] : undefined

}

const closeRequest = async options => {
	
	let { requestId, configDB } = options
	await mongodb.updateOne({
			db: configDB,
			collection: `${configDB.name}.segmentation-requests`,
			filter:{
				id: requestId
			},
			data:{
				closedAt: new Date()
			}
		})
}




module.exports = {
	openRequest,
	closeRequest
}