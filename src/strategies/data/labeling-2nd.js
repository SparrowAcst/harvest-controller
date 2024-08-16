const {

	resolveSegmentation,
	resolveAISegmentation,
	segmentationAnalysis

} = require("../utils")

const uuid = require("uuid").v4

const get = async context => {
    
		let { version, options, brancher, mongodb } = context
	    
	    version.data = await brancher.resolveData({ version })

	    let aiSegmentation = await resolveAISegmentation(options, version.data)
	    let segmentation = await resolveSegmentation(options, version.data)

	    if(!segmentation  && aiSegmentation && aiSegmentation.data){
	    	// console.log("Clone AI segmentation")
	    	segmentation = JSON.parse(JSON.stringify(aiSegmentation))
	    	segmentation.id = uuid()

	    	await mongodb.replaceOne({
	    		db: options.db,
	    		collection:`${options.db.name}.${options.segmentCollection}`,
	    		filter:{
	    			id: segmentation.id 
	    		},
	    		data: segmentation
	    	})

	    	version.data.segmentation = segmentation.id	    	
	    	version = await brancher.save({
	    		source: version,
	    		data: version.data
	    	})

	    	// console.log("VERSION", version)
	    	version.data = await brancher.resolveData({ version })
	    	// console.log("new record vresion", version.data)
	    	segmentation = await resolveSegmentation(options, version.data)

	    	// console.log("cloned segmentation", segmentation)

	    }

	  
	    // console.log("S", segmentation)

	   	let sa
	    
	    if (segmentation) {
	        sa = segmentationAnalysis.getSegmentationAnalysis(segmentation.data)
	    }

	    if(aiSegmentation && aiSegmentation.data) {
	    	aiSegmentation.data.id = version.data.aiSegmentation
		    version.data.aiSegmentation = aiSegmentation.data
		}    
	    
	    if(segmentation && segmentation.data){
		    version.data.segmentation = segmentation.data
		    version.data.segmentationAnalysis = sa
		}    
	
	    return version
}

const save = async context => {

}

const submit = async context => {

}

const rollback = async context => {

}


module.exports = {
    get,
    save,
    submit,
    rollback
}