const mongodb = require("../../mongodb")
const { getAISegmentation, transformAI2v2 } = require("../../long-term/ai-segmentation")
const { extend, sortBy, orderBy, first } = require("lodash")

const resolveSegmentation = async (options, record) => {
        if (record.segmentation) {

            options = extend({}, options, {
                collection: `${options.db.name}.${options.segmentCollection}`,
                pipeline: [{
                        $match: {
                            id: record.segmentation
                        }
                    },
                    {
                        $project: { _id: 0 }
                    }
                ]
            })

            let segmentation = await mongodb.aggregate(options)
            if(segmentation[0]){
                segmentation = segmentation[0]    
                segmentation.data.id = record.segmentation
            } else {
                segmentation = undefined
            }
            
            return segmentation
        }
        
}


const resolveAISegmentation = async (options, record) => {
    
    let result
    
    if (!record.aiSegmentation) {

        let segmentation = await getAISegmentation({
            records: [record]
        })

        segmentation = (segmentation) ? segmentation[0] : undefined
        // console.log("segmentation", segmentation)        
        if (segmentation && segmentation.data) {

            segmentation.data = transformAI2v2(segmentation.data)
            // console.log("segmentation", segmentation)        
        
            await mongodb.replaceOne({

                db: options.db,
                collection: `${options.db.name}.${options.segmentCollection}`,
                filter: {
                    id: segmentation.id
                },

                data: segmentation

            })


            record.aiSegmentation = segmentation.id

            await mongodb.updateOne({

                db: options.db,
                collection: `${options.db.name}.${options.dataCollection}`,
                filter: {
                    id: record.id
                },

                data: {
                    aiSegmentation: segmentation.id
                }

            })


            result = segmentation//.data

        }

    } else {

        options = extend({}, options, {
            collection: `${options.db.name}.${options.segmentCollection}`,
            pipeline: [{
                    $match: {
                        id: record.aiSegmentation
                    }
                },
                {
                    $project: { _id: 0 }
                }
            ]
        })

        let segmentation = await mongodb.aggregate(options)

        if(segmentation[0]){
            segmentation = segmentation[0] //.data    
            segmentation.id = record.aiSegmentation
        } else {
            segmentation = undefined
        }

        result = segmentation

    }

    return result

}


const collaboratorHeads = (dataId, user) => version => version.dataId == dataId && version.type != "main" && version.user != user && version.head == true
const userHead = (dataId, user) => version => 
    version.dataId == dataId 
    && version.user == user 
    && version.head == true 
    && version.type != "main"

const mainHead = (dataId, user) => version => 
    version.dataId == dataId 
    && version.type == "main" 
    && version.head == true

const collaboration = (brancher, dataId, user) => brancher.select(collaboratorHeads(dataId, user))
const userDataHead = (brancher, dataId, user) => {
    let v1 = first(orderBy(brancher.select(userHead(dataId, user)), ["readonly", "createdAt"], ["asc", "desc"]))
    let v2 = brancher.select(mainHead(dataId, user))[0]
    return (v1) ? v1 : v2
}




module.exports = {
    resolveSegmentation,
    resolveAISegmentation,
    segmentationAnalysis: require("./segment-analysis"),
    version:{
        select:{
            collaboration,
            userDataHead
        }
    }
}