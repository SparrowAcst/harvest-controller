const { loadYaml } = require("./utils/file-system")
const path = require("path")
const mongodb = require("./mongodb")
const { find, extend } = require("lodash")

const config = loadYaml(path.join(__dirname, "../../sync-data/.config/db/mongodb.conf.yml"))

const db = {
    url: config.db.url,
    name: config.db.name
}

let DATASET_CACHE



const init = async () => {
	
	console.log(`Init DB Cache:\n${JSON.stringify(db, null, " ")}`)

    DATASET_CACHE = await mongodb.aggregate({
        db,
        collection: `settings.dataset`,
        pipeline: [
            {
                $match:{
                    closed:{
                        $exists: false
                    }
                }
            },
            {
                $project: { _id: 0 }
            }
        ]
    })


    console.log(`load ${DATASET_CACHE.length} datasets setting`)

}




const handler = async (req, res, next) => {

    if (!DATASET_CACHE) {
        await init()
    }

    let currentDataset = (req.body && req.body.options && req.body.options.currentDataset) 
        ? req.body.options.currentDataset 
        : (req.body && req.body.currentDataset) 
	        ? req.body.currentDataset 
	        : "ADE-TEST"

    currentDataset = find(DATASET_CACHE, d => d.name == currentDataset)

    currentDataset = (currentDataset && currentDataset.settings) ? currentDataset.settings : undefined
    
    req.body = extend( req.body, {
        cache: {
            defaultDB: db,
            datasets: DATASET_CACHE.map( d => d ),
            currentDataset
        }
    })

    req.query = extend( req.query, {
        cache: {
            defaultDB: db,
            datasets: DATASET_CACHE.map( d => d ),
            currentDataset
        }
    })

    req.dbCache = {
            defaultDB: db,
            datasets: DATASET_CACHE.map( d => d ),
            currentDataset
        }


    next()

}


module.exports = handler