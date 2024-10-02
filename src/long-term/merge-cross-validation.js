const { extend, min, max, find, isString, keys } = require("lodash")
const LongTerm = require("../utils/long-term-queue")
const mongodb = require("../mongodb")
const segmentationAnalysis = require("../strategies/utils/segment-analysis")

const uuid = require("uuid").v4
const isValidUUID = require("uuid").validate
const isUUID = data => isString(data) && isValidUUID(data)

const SETTINGS = require("../strategies/settings")

const createTaskController = require("../utils/task-controller")

////////////////////////////////////////////////////////////////////////////

const resolveSegmentation = async (options, segmentation) => {

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

        return (d[0]) ? d[0].data : undefined

    }

}

const saveSegmentation = async (options, segmentation) => {

    let { db } = options

    if (!segmentation) return

    let id = uuid()

    let d = await mongodb.replaceOne({
        db,
        collection: `${db.name}.segmentations`,
        filter: {
            id: segmentation
        },
        data: {
            id,
            patientId: options.patientId,
            record: {
                id: options.dataId
            },
            user: {
                name: "cross-validation-2nd strategy"
            },
            data: segmentation
        }

    })

    return id

}

//////////////////////////////////////////////////////////////////////////////

const hasDataDiff = dataArray => {

    return segmentationAnalysis
        .getDataDiff(dataArray)
        .map(d => !!d.patch)
        .reduce((a, b) => a || b, false)

}

const hasSegmentationDiff = segmentationArray => {

    return segmentationAnalysis
        .getSegmentsDiff(segmentationArray)
        .map(d => keys(d).map(key => d[key].length > 0).reduce((a, b) => a || b, false))
        .reduce((a, b) => a || b, false)

}

const hasPolygonsDiff = polygonArray => {

    const {
        PARALLEL_BRANCHES, // expert count
        MAX_ITERATIONS, // max submit count for each stage
        MAX_STAGES // after MAX_STAGES  stages "manual merge task" will be generated
    } = SETTINGS().strategy.Cross_Validation_2nd

    console.log(SETTINGS())

    let result = []

    polygonArray[0].forEach(pa => {

        let polygonSet = []
        polygonArray.forEach(p => {
            let f = find(p, p => p.name == pa.name)
            if (f) {
                polygonSet.push(f.shapes)
            }

        })

        if (polygonSet.length < PARALLEL_BRANCHES) {
            result.push(true)
        } else {
            result.push(
                segmentationAnalysis
                .getPolygonsDiff(polygonSet)
                .map(d => !!d)
                .reduce((a, b) => a || b, false)
            )
        }

    })

    result = result.reduce((a, b) => a || b, false)

    return result

}

const hasDiff = versions => {

    if (hasDataDiff(versions.map(v => v.data))) return true
    if (hasSegmentationDiff(versions.map(v => v.data.segmentation.segments))) return true
    if (hasPolygonsDiff(versions.map(v => v.data.segmentation.polygons))) return true

    return false

}

////////////////////////////////////////////////////////////////////////////////////

const mergePolygons = polygonArray => {

    let res = polygonArray[0].map(pa => {

        let polygonSet = []
        polygonArray.forEach(p => {
            let f = find(p, p => p.name == pa.name)
            if (f) {
                polygonSet.push(f.shapes)
            }

        })

        return {
            name: pa.name,
            shapes: segmentationAnalysis.mergePolygons(polygonSet)
        }
    })

    return res
}


const mergeVersionsData = versions => {

    res = {
        data: segmentationAnalysis.mergeData(versions.map(v => v.data)),
        segmentation: segmentationAnalysis.mergeSegments(versions.map(v => v.data.segmentation.segments))
    }
    res.segmentation.Murmur = segmentationAnalysis.polygons2v2(mergePolygons(versions.map(v => v.data.segmentation.polygons)))

    return res

}

///////////////////////////////////////////////////////////////////////////////////////////

const getVersions = async settings => {

    const {
        PARALLEL_BRANCHES, // expert count
        MAX_ITERATIONS, // max submit count for each stage
        MAX_STAGES // after MAX_STAGES  stages "manual merge task" will be generated
    } = SETTINGS().strategy.Cross_Validation_2nd


    const { brancher } = settings

    let versions = brancher.select(
        version => version.head == true &&
        !version.branch &&
        !version.commit &&
        version.type == "submit"
    )

    if (versions.length < PARALLEL_BRANCHES) return

    let submitCounts = versions.map(v => {

        return brancher.getHistory({
            version: v,
            stopAt: version => version.type == "branch"
        }).filter(version => version.type == "submit").length

    })

    let count = (min(submitCounts) == max(submitCounts)) ? submitCounts[0] : 0

    if (count == 0) return

    for (let v of versions) {
        v.data = await brancher.resolveData({ version: v })
        v.data.$segmentationRef = v.data.segmentation
        v.data.segmentation = await resolveSegmentation(settings, v.data.segmentation)
        // console.log("v.data.segmentation", v.data.segmentation)
        if (v.data.segmentation) {
            v.data.segmentation = segmentationAnalysis.parse(v.data.segmentation)
        }
    }

    return {
        versions,
        iteration: count
    }
}

// const mergeVersions = async settings => {

//     let { brancher, sources, data } = settings

//     delete data.$segmentationRef


//     let version = await brancher.merge({
//         sources,
//         user: "cross-validation-2nd strategy",
//         data,
//         metadata: {
//             "task.Cross_Validation_2nd.status": "merged",
//             "task.Cross_Validation_2nd.reason": "Expert labelings successfully merged.",
//             "task.Cross_Validation_2nd.updatedAt": new Date(),
//             "actual_task": "Cross_Validation_2nd",
//             "actual_status": "successfully merged"
//         }
//     })

//     version = await brancher.commit({
//         source: version,
//         metadata: {
//             // "task.Cross_Validation_2nd.status": "done",
//             // "task.Cross_Validation_2nd.updatedAt": new Date(),
//             "actual_task": "none",
//             "actual_status": "none"
//         }
//     })
// }



const mergeVersions = async settings => {

    let { brancher, sources, data } = settings

    delete data.$segmentationRef


    let uid = uuid()

    sources.forEach(v => {
        v.lockRollback = true
        v.metadata.task.Cross_Validation_2nd.status = "successfully merged"
        v.metadata.task.Cross_Validation_2nd.updatedAt = new Date()
        v.metadata.task.Cross_Validation_2nd.reason = "Expert data successfully merged."
        v.metadata.actual_status = "Waiting for the start."
        v.metadata.task.Cross_Verification = {
            id: uid,
            status: "open",
            updatedAt: new Date()
        }

    })

    await settings.brancher.updateVersion({
        version: sources
    })

    let version = await brancher.merge({
        sources,
        user: "cross-validation-2nd strategy",
        data,
        metadata: {
            "task.Cross_Validation_2nd.status": "merged",
            "task.Cross_Validation_2nd.reason": "Expert data successfully merged.",
            "task.Cross_Validation_2nd.updatedAt": new Date(),
            "task.Cross_Verification.id": uid,
            "task.Cross_Verification.updatedAt": new Date(),
            "task.Cross_Verification.state": "open",
            "task.Cross_Verification.versions": sources.map(s => s.id),
            "task.Cross_Verification.reason": "Wait for data verification.",
            "actual_task": "Cross_Validation_2nd",
            "actual_status": "successfully merged"
        }
    })

    // version = await brancher.commit({
    //     source: version,
    //     metadata: {
    //         // "task.Cross_Validation_2nd.status": "done",
    //         // "task.Cross_Validation_2nd.updatedAt": new Date(),
    //         "actual_task": "none",
    //         "actual_status": "none"
    //     }
    // })
}




////////////////////////////////////////////////////////////////////////////////////


const mergeCrossValidationOperation = async settings => {

    try {

        const {
            PARALLEL_BRANCHES, // expert count
            MAX_ITERATIONS, // max submit count for each stage
            MAX_STAGES // after MAX_STAGES  stages "manual merge task" will be generated
        } = SETTINGS().strategy.Cross_Validation_2nd

        console.log(`LONG-TERM: mergeCrossValidation: started`)
        console.log(SETTINGS())

        let { dataId, db } = settings

        settings.controller = createTaskController(settings)
        settings.brancher = await settings.controller.getBrancher(settings)


        let resolved = await getVersions(settings)

        if (!resolved) {
            console.log(`LONG-TERM: mergeCrossValidation: ignored. No compared versions`)
            return
        }

        // console.log("resolved", resolved)

        let diffDetected = hasDiff(resolved.versions)

        if (diffDetected) {

            // restart task for current expert group

            if (resolved.iteration < MAX_ITERATIONS) {

                for (v of resolved.versions) {

                    v.data.segmentation = v.data.$segmentationRef

                    delete v.data.$segmentationRef

                    await settings.brancher.save({
                        source: v,
                        data: v.data,
                        user: v.user,
                        metadata: {
                            "task.Cross_Validation_2nd.iteration": v.metadata.task.Cross_Validation_2nd.iteration + 1,
                            "task.Cross_Validation_2nd.status": "restart",
                            "task.Cross_Validation_2nd.reason": "Differences in expert labelings were found. Restart the task for the current expert group.",
                            "task.Cross_Validation_2nd.updatedAt": new Date(),
                            "actual_status": "Waiting for the start."
                        },
                        ignoreChangeDetection: true
                    })
                }

                console.log(`LONG-TERM: mergeCrossValidation: restart. Difference detected`)
                return

            }

            // TODO assign task to next expert group
            if (resolved.versions[0].metadata.task.Cross_Validation_2nd.stage < MAX_STAGES) {
                resolved.versions.forEach(v => {
                    delete v.data
                    v.lockRollback = true
                    v.metadata.task.Cross_Validation_2nd.status = "reassign"
                    v.metadata.task.Cross_Validation_2nd.reason = "Differences in expert labelings were found. Start the task for the next expert group."
                    v.metadata.actual_status = "Waiting for the start."
                })

                await settings.brancher.updateVersion({
                    version: resolved.versions
                })

                console.log(`LONG-TERM: mergeCrossValidation: Lock submits. Wait next stage.`)
                return

            }

            // TODO generate manual merge task
            let manualMergeTaskId = uuid()
            resolved.versions.forEach(v => {
                v.lockRollback = true
                v.metadata.task.Cross_Validation_2nd.status = "need manual merge"
                v.metadata.task.Cross_Validation_2nd.updatedAt = new Date()
                v.metadata.task.Cross_Validation_2nd.reason = "Differences in expert labelings were found. Start the manual merging by CMO."
                v.metadata.actual_status = "Waiting for the start."
                v.metadata.task.Manual_merging = {
                    id: manualMergeTaskId,
                    status: "open",
                    updatedAt: new Date()
                }

            })

            await settings.brancher.updateVersion({
                version: resolved.versions
            })

            await settings.brancher.merge({
                sources: resolved.versions,
                user: "cross-validation-2nd strategy",
                data: resolved.versions[0].data,
                metadata: {
                    "task.Manual_merging.id": manualMergeTaskId,
                    "task.Manual_merging.updatedAt": new Date(),
                    "task.Manual_merging.state": "open",
                    "task.Manual_merging.versions": resolved.versions.map(s => s.id),
                    "task.Manual_merging.reason": "Wait for manual merging.",
                    "actual_task": "none",
                    "actual_status": "none"
                }
            })

            console.log(`LONG-TERM: mergeCrossValidation: Lock submits. Wait manual merge.`)
            return

        }

        let merged = mergeVersionsData(resolved.versions)

        merged.data.segmentation = await saveSegmentation(
            extend({}, settings, { patientId: merged.data["Examination ID"] }),
            merged.segmentation
        )

        await mergeVersions(
            extend({},
                settings, {
                    sources: resolved.versions,
                    data: merged.data
                }
            )
        )

        console.log(`LONG-TERM: mergeCrossValidation: merge > commit > done`)
    } catch (e) {
        console.log("LONG-TERM: mergeCrossValidation:", e.toString(), e.stack)
    }

}


const mergeCrossValidation = (settings = {}) => {
    console.log("CALL mergeCrossValidation")
    LongTerm.execute(async () => {
        await mergeCrossValidationOperation(settings)
    })
}



module.exports = {
    mergeCrossValidation
}