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
let USER_CACHE
let METADATA_CACHE

const init = async () => {

    console.log(`Init DB Cache:\n${JSON.stringify(db, null, " ")}`)

    DATASET_CACHE = await mongodb.aggregate({
        db,
        collection: `settings.dataset`,
        pipeline: [
            {
                $project: { _id: 0 }
            }
        ]
    })

    console.log(`load ${DATASET_CACHE} datasets setting`)

    USER_CACHE = await mongodb.aggregate({
        db,
        collection: `settings.app-grant`,
        pipeline: [{
                $lookup: {
                    from: "profile",
                    localField: "profile",
                    foreignField: "name",
                    as: "result",
                    pipeline: [{
                        $project: {
                            _id: 0,
                        },
                    }, ],
                },
            },
            {
                $addFields: {
                    profile: {
                        $first: "$result",
                    },
                },
            },
            {
                $project: {
                    _id: 0,
                    result: 0,
                },
            },
        ]
    })

    console.log(`load ${USER_CACHE.length} user profiles`)

    METADATA_CACHE = await mongodb.aggregate({
        db,
        collection: `settings.metadata`,
        pipeline: [{
                $project: { _id: 0 }
            }

        ]
    })

    console.log(`load ${METADATA_CACHE.length} metadata items`)

}




const handler = async (req, res, next) => {


    if(req.url == "/ade-admin/cache-update/"){
        await init()
        res.status(200).send(`Cache updated. Datasets: ${DATASET_CACHE.length}. Users: ${USER_CACHE.length}. Metadata: ${METADATA_CACHE.length} items.`)
        return
    }

    if (!DATASET_CACHE || !USER_CACHE || !METADATA_CACHE || req.body.forceUpdate) {
        await init()
    }

    let currentDatasetName = (req.body && req.body.options && (req.body.options.currentDataset || req.body.options.dataset)) ?
        (req.body.options.currentDataset || req.body.options.dataset) :
        (req.body && req.body.currentDataset || req.body.dataset) ?
        (req.body.currentDataset  || req.body.dataset):
        "ADE-TEST"

    let currentDataset = find(DATASET_CACHE.filter(d => !d.lock), d => d.name == currentDatasetName)

    if(!currentDataset){
        res.status(403).(`No access to dataset "${currentDatasetName}"`)
        return
    }

    currentDataset = (currentDataset && currentDataset.settings) ? currentDataset.settings : undefined
    currentDataset.name = currentDatasetName

    req.body = extend(req.body, {
        cache: {
            defaultDB: db,
            datasets: DATASET_CACHE.map(d => d),
            userProfiles: USER_CACHE.map(d => d),
            metadata: METADATA_CACHE.map(d => d),
            currentDataset,
            update: init
        }
    })

    req.query = extend(req.query, {
        cache: {
            defaultDB: db,
            datasets: DATASET_CACHE.map(d => d),
            userProfiles: USER_CACHE.map(d => d),
            metadata: METADATA_CACHE.map(d => d),
            currentDataset,
            update: init
        }
    })

    req.dbCache = {
        defaultDB: db,
        datasets: DATASET_CACHE.map(d => d),
        userProfiles: USER_CACHE.map(d => d),
        metadata: METADATA_CACHE.map(d => d),
        currentDataset,
        update: init
    }


    next()

}


module.exports = handler