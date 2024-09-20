const { isString, last } = require("lodash")

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

	    version.strategy = "Basic_Labeling_2nd"
	    
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
			"task.Basic_Labeling_2nd.status": "process",
			"task.Basic_Labeling_2nd.updatedAt": new Date(),
			"actual_status": "label changes have been saved"
		}
	})

}


const reject = async context => {

	let { data, source, user, recordId } = context
    context.dataId = [ recordId ]
    const controller = createTaskController(context)
	const brancher = await controller.getBrancher(context)	 
	
	// find 1st expert
	
	let expertVersion = brancher.getHistory({
		version: source,
		stopAt: v => v.user != user
	})

	console.log("expertVersion", expertVersion)
	expertVersion = last(expertVersion)
	let expert = (expertVersion) ? expertVersion.user : null 

	// submit rejection
	
	await brancher.submit({
		user,
		source,
		data,
		metadata:{
			"task.Basic_Labeling_2nd.status": "done",
			"task.Basic_Labeling_2nd.updatedAt": new Date(),
			"actual_status": `labeling is rejected by 2nd expert ${user}, the data must be clarified by a 1st expert ${expert}`,

			"task.Basic_Relabeling_1st.status": "open",
			"task.Basic_Relabeling_1st.expert": expert,
			"task.Basic_Relabeling_1st.initiator": user,
			"task.Basic_Relabeling_1st.updatedAt": new Date()
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
			"task.Basic_Labeling_2nd.status": "submit",
			"task.Basic_Labeling_2nd.updatedAt": new Date(),
			"actual_status": "changes to labels and segmentation have been submitted"
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
    reject,
    submit,
    rollback,
    getSegmentation
}