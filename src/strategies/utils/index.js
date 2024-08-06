const mongodb = require("../../mongodb")
const getAISegmentation = require("./ai-segmentation")
const { extend } = require("lodash")

const resolveSegmentation = async (options, record) => {
        // console.log("\n\nresolveSegmentation\n\n", `${options.db.name}.${options.segmentCollection}`, record.segmentation)
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
            
            // record.segmentation = segmentation
            return segmentation
        }

        // return segmentation
        
}


const resolveAISegmentation = async (options, record) => {
    // console.log("\n\nresolveAISegmentation\n\n", record.aiSegmentation)
    
    let result
    
    if (!record.aiSegmentation) {

        let segmentation = await getAISegmentation({
            records: [record]
        })

        segmentation = (segmentation) ? segmentation[0] : undefined

        if (segmentation) {

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

            // record.aiSegmentation = segmentation.data
            // if(record.aiSegmentation){
            //     record.aiSegmentation.id = segmentation.id
            // }   

            result = segmentation//.data



            // if(result){
            //     result.id = segmentation.id
            // }   

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

        // segmentation = (segmentation[0]) ? segmentation[0].data.segmentation : undefined
        // segmentation.id = record.aiSegmentation

        // record.aiSegmentation = segmentation

        result = segmentation

    }

    return result
    

}


const collaboratorHeads = (dataId, user) => version => version.dataId == dataId && version.type != "main" && version.user != user && version.head == true
const userHead = (dataId, user) => version => version.dataId == dataId && version.user == user && version.head == true
const mainHead = (dataId, user) => version => version.dataId == dataId && version.type == "main" && version.head == true

const collaboration = (brancher, dataId, user) => brancher.select(collaboratorHeads(dataId, user))
const userDataHead = (brancher, dataId, user) => {
    let v1 = brancher.select(userHead(dataId, user))[0]
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