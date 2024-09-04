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
		let version = await controller.getActualVersion({user, dataId: recordId})
	    let segmentation = await resolveSegmentation(context, version.data.segmentation)

	    if (segmentation) {
	        version.data.segmentationAnalysis = segmentationAnalysis.getSegmentationAnalysis(segmentation.data)
	    }

	    version.strategy = "Base_Labeling_1st"
	    return version
}


const getSegmentation = async context => {
	
	let result = await get(context)

	return {
		segmentation: result.data.segmentation,
		segmentationAnalysis: result.data.segmentationAnalysis
	}	
}


const save = async context => {

	let { data, source, user, recordId } = context
    context.dataId = [ recordId ]
    const controller = createTaskController(context)
	const brancher = await controller.getBrancher(context)	 
	await brancher.save({
		user,
		source,
		data,
		metadata:{
			"task.Base_Labeling_1st.status": "process",
			"task.Base_Labeling_1st.updatedAt": new Date()
		}
	})

}

const submit = async context => {

	let { data, source, user, recordId } = context
    context.dataId = [ recordId ]
    const controller = createTaskController(context)
	const brancher = await controller.getBrancher(context)	 
	await brancher.submit({
		user,
		source,
		data,
		metadata:{
			"task.Base_Labeling_1st.status": "submit",
			"task.Base_Labeling_1st.updatedAt": new Date()
		}
	})

}

const rollback = async context => {

	let { source, user, recordId } = context
    context.dataId = [ recordId ]
    const controller = createTaskController(context)
	const brancher = await controller.getBrancher(context)	 
	await brancher.rollback({
		source
	})

}


module.exports = {
    get,
    save,
    submit,
    rollback,
    getSegmentation
}