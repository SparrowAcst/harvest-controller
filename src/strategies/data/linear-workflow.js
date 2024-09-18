const { isString, find } = require("lodash")
const uuid = require("uuid").v4
const isValidUUID = require("uuid").validate
const isUUID = data => isString(data) && isValidUUID(data)

const { segmentationAnalysis } = require("../utils")
const { Diff, SegmentationDiff } = require("../../utils/diff")

const createTaskController = require("../../utils/task-controller")
const mongodb = require("../../mongodb")


const resolveSegmentation = async options => {

    let { db, segmentCollection, data } = options

    let result = {}

    if (!data) return result

    let segmentation = data.segmentation

    if (isUUID(segmentation)) {
        let d = await mongodb.aggregate({
            db,
            collection: `${db.name}.${segmentCollection}`,
            pipeline: [{
                $match: {
                    id: {
                        $in: [segmentation]
                    }
                }
            }]
        })

        let s = find(d, v => !v.user || (v.user && v.user.name != "AI"))

        result = (s) ? s.data : undefined

    } else {
        result = segmentation
   }

    return result

}




const get = async context => {

    let { recordId, db, user, segmentCollection } = context

    let result = await mongodb.aggregate({
        db,
        collection: `${db.name}.${db.labelingCollection}`,
        pipeline: [{
                $match: {
                    id: recordId
                }
            },
            {
                $project: { _id: 0 }
            }
        ]
    })
   
    result = result[0]

    if(result){
    	
    	let options = {
    		data: result,
    		db,
    		segmentCollection
    	}	

    	result.segmentation = await resolveSegmentation(options)
    	if(result.segmentation){
    		result.segmentationAnalysis = segmentationAnalysis.getSegmentationAnalysis(result.segmentation)
    	}
    	return {
    		dataId: recordId,
    		data: result
    	}	
    } else {
    	return {data:{dataId: recordId}}
    }

}


const getSegmentation = async context => {
	
	let result = await get(context)

	return {
		segmentation: result.data.segmentation,
		segmentationAnalysis: result.data.segmentationAnalysis
	}	
}

const save = async context => {
    try {

        let { db, record, user, session, dataset } = context
        
        const prev = await mongodb.aggregate({
            db,
            collection: `${db.name}.${db.labelingCollection}`,
            pipeline: [   
                {
                    $match: { id: record.id }
                },
                {
                    $project:{ _id: 0 }
                }
                        
            ]
        })

        record.segmentation = prev[0].segmentation

        const result = await mongodb.replaceOne({
            db,
            collection: `${db.name}.${db.labelingCollection}`,
            filter:{
                id: record.id
            },
            data: record
        })

        const event = {
            id: uuid(),
            dataset: dataset,
            collection: db.labelingCollection, 
            recordingId: record.id,
            examinationId: record["Examination ID"],
            path: record.path,
            diff: Diff.diff(prev, record),
            formattedDiff: Diff.format(Diff.diff(prev[0], record)),
            user: user,
            session: session.id,
            startedAt: session.startedAt,
            stoppedAt: session.stoppedAt
        }

        await mongodb.replaceOne({
            db,
            collection: `${db.name}.changelog-recordings`,
            filter:{
                session: event.session
            },
            
            data: event
        })

        return result

    } catch (e) {
        return { 
            error: `linear_workflow data strategy error: ${e.toString()} ${e.stack}`
        }
    }
}

const submit = async context => {

}

const rollback = async context => {

}


module.exports = {
    get,
    save,
    submit,
    rollback,

    getSegmentation
}