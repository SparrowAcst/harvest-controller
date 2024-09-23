const { isString } = require("lodash")

const uuid = require("uuid").v4
const isValidUUID = require("uuid").validate
const isUUID = data => isString(data) && isValidUUID(data)

const { segmentationAnalysis } = require("../utils")
const createTaskController = require("../../utils/task-controller")
const mongodb = require("../../mongodb")


const resolveSegmentation = async ( options, segmentation )  => {

    let { db } = options

    if (!segmentation) return

    if (isUUID(segmentation)) {
        let d = await mongodb.aggregate({
            db,
            collection: `${db.name}.segmentations`,
            pipeline: [{
                $match: {
                    id: segmentation
                }
            }]
        })

        return d[0]

    }

}

const get = async context => {
    
		let { recordId, user } = context
	    context.dataId = [ recordId ]
	    const controller = createTaskController(context)
		let version = await controller.selectTask({
			matchVersion: v => v.type == "main" && v.head == true
		})
	    
	    version = version[0]
	    version.data = await controller.resolveData({ version})

	    let segmentation = await resolveSegmentation(context, version.data.segmentation || version.data.aiSegmentation)

	    if (segmentation) {
	        version.data.segmentationAnalysis = segmentationAnalysis.getSegmentationAnalysis(segmentation.data)
	    }

	    version.strategy = "Default"
	    return version
}


const getSegmentation = async context => {
	
	let result = await get(context)

	return {
		segmentation: result.data.segmentation,
		segmentationAnalysis: result.data.segmentationAnalysis
	}	
}



module.exports = {
    get,
    getSegmentation
}