const mongodb = require("../mongodb")
const { isArray, isObject, isFunction, find, remove, unionBy, keys, first, last, uniqBy, sortBy, findIndex } = require("lodash")
const Diff = require('jsondiffpatch')
const uuid = require("uuid").v4
const moment = require("moment")



let contextPool = {}


const getContext = async options => {
    let { db, branchesCollection, dataId } = options
    let id = uuid()
    let cache = await mongodb.aggregate({
        db,
        collection: `${db.name}.${branchesCollection}`,
        pipeline: [{
            $match: {
                dataId: dataId
            }
        }]
    })

    context[id] = extend({}, options, { id, cache, dataId })
    return id
}


const closeContext = contextId => {
    delete contextPool[contextId]
}


const resolveSelector = selector => {
    selector = selector || (d => true)
    if (isFunction(selector)) return selector
    if (isObject(selector)) return (
        d => keys(selector).map(key => d[key] === selector[key]).reduce((a, b) => a && b, true)
    )
    throw new Error(`brancher.resolveSelector: selector ${JSON.stringify(selector)} not resolved`)
}


const select = (contextId, selector) => {

    let context = contextPool[contextId]

    if (!context) throw new Error(`brancher.select: context ${contextId} not found`)

    let { cache } = context
    selector = resolveSelector(selector)

    return cache.filter(selector)
}


const updateInCache = (contextId, options) => {

    let context = contextPool[contextId]

    if (!context) throw new Error(`brancher.updateInCache: context ${contextId} not found`)

    let { cache } = context
    let { version } = options

    if (!version) throw new Error(`brancher.updateInCache: undefined version`)

    let index = findIndex(cache, d => d.id == version.id)
    if (index >= 0) {
        cache[index] = version
    } else {
        cache.push(version)
    }

}


const resolveVersion = async (contextId, options) => {

    console.log("resolveVersion")

    try {

        let context = contextPool[contextId]

        if (!context) throw new Error(`brancher.resolveVersion: context ${contextId} not found`)

        let { cache } = context
        let { version } = options

        return (version.id) ? version : find(cache, d => d.id == version)[0]

    } catch (e) {
        throw e
    }

}

const resolveData = (contextId, options) => {
    console.log("resolveData")

    try {

        let context = contextPool[contextId]

        if (!context) throw new Error(`brancher.resolveData: context ${contextId} not found`)

        let { db, dataCollection, dataId } = context
        let { version } = options

        version = resolveVersion(contextId, { version })

        if (!version) throw new Error(`brancher.resolveData: version ${version.id} not found`)

        let data = await mongodb.aggregate({
            db,
            collection: `${db.name}.${dataCollection}`,
            pipeline: [{ $match: { id: dataId } }]
        })

        data = data[0]

        version.patches.forEach(p => {
            Diff.patch(data, p)
        })

        return data

    } catch (e) {
        throw e
    }

}

const initDataVersion = async contextId => {
    console.log("initDataVersion")

    try {

        let context = contextPool[contextId]

        if (!context) throw new Error(`brancher.initDataVersion: context ${contextId} not found`)

        let { db, branchesCollection, dataId, cache } = context

        if (cache.length > 0) throw new Error(`brancher.initDataVersion: data ${dataId} already connect to brancher`)


        const branch = {
            id: uuid(),
            dataId,
            patches: [],
            head: true,
            createdAt: new Date(),
            metadata,
            type: "main"
        }

        updateInCache(contextId, { version: branch })

        await mongodb.replaceOne({
            db,
            collection: `${db.name}.${branchesCollection}`,
            filter: {
                'id': branch.id
            },
            data: branch
        })

        return branch

    } catch (e) {
        throw e
    }

}

const createDataBranch = async (contextId, options) => {
    console.log("createDataBranch")

    try {

        let context = contextPool[contextId]

        if (!context) throw new Error(`brancher.initDataVersion: context ${contextId} not found`)

        let { db, branchesCollection, dataId, cache } = context
        let { user, source, metadata } = options

        parent = resolveVersion(contextId, { version: source })

        if (!parent) throw new Error(`brancher.initDataVersion: source ${source.id || source} not found`)

        parent.branch = parent.branch || []
        parent.branch.push(branchId)

        let branch = {
            id: branchId,
            dataId,
            user,
            prev: [{
                id: parent.id
            }],
            head: true,
            patches: parent.patches,
            createdAt: new Date(),
            metadata,
            type: "branch"
        }

        updateInCache(contextId, { version: branch })
        updateInCache(contextId, { version: parent })


        await mongodb.bulkWrite({
            db: db,
            collection: `${db.name}.${branchesCollection}`,
            commands: [{
                    replaceOne: {
                        filter: {
                            id: branch.id,
                            dataId: dataId
                        },
                        replacement: branch
                    }
                },
                {
                    replaceOne: {
                        filter: {
                            id: parent.id,
                            dataId: dataId
                        },
                        replacement: parent
                    }
                }

            ]
        })

        return branch

    } catch (e) {
        throw e
    }

}


const createDataSave = async (contextId, options) => {
    console.log("createDataBranch")

    try {

        let context = contextPool[contextId]

        if (!context) throw new Error(`brancher.initDataVersion: context ${contextId} not found`)

        let { db, branchesCollection, dataId, cache } = context
        let { user, source, data, metadata } = options

        parent = resolveVersion(contextId, { version: source })

        if (!parent) throw new Error(`brancher.initDataVersion: source ${source.id || source} not found`)

        parent.head = false

        let prevData = await resolveData(contextId, { version: parent })

        let newVersion = {
            id: uuid(),
            dataId,
            user,
            prev: [{
                id: parent.id
            }],
            metadata,
            head: true,
            createdAt: new Date(),
            patches: parent.patches.concat([Diff.diff(prevData, data)]).filter(d => d),
            type: "save"
        }

        parent.save = newVersion.id


        updateInCache(contextId, { version: newVersion })
        updateInCache(contextId, { version: parent })


        await mongodb.bulkWrite({
            db: db,
            collection: `${db.name}.${branchesCollection}`,
            commands: [{
                    replaceOne: {
                        filter: {
                            id: newVersion.id,
                            dataId: dataId
                        },
                        replacement: newVersion
                    }
                },
                {
                    replaceOne: {
                        filter: {
                            id: parent.id,
                            dataId: dataId
                        },
                        replacement: parent
                    }
                }

            ]
        })

        return newVersion

    } catch (e) {
        throw e
    }

}


const createDataCommit = async (contextId, options) => {
    console.log("createDataCommit")

    try {

        let context = contextPool[contextId]

        if (!context) throw new Error(`brancher.createDataCommit: context ${contextId} not found`)

        let { db, branchesCollection, dataId, cache } = context
        let { user, source, data, metadata } = options

        parent = resolveVersion(contextId, { version: source })

        if (!parent) throw new Error(`brancher.createDataCommit: source ${source.id || source} not found`)

        let commands = []

        let headVersions = select(contextId, d => d.head == true).map(d => d.id)
        let mainVersions = select(contextId, d => !d.user).map(d => d.id)

        cache.forEach(c => {

            if (headVersions.includes(c.id)) {
                c.head = false
            }

            if (mainVersions.includes(c.id)) {
                let d = await resolveData(contextId, { version: c })
                v.patches = [Diff.diff(data, d)].filter(d => d)
                v.head = false
            }

            if (headVersions.includes(c.id) || mainVersions.includes(c.id)) {
                commands.push({
                    replaceOne: {
                        filter: {
                            id: c.id,
                            dataId: dataId
                        },
                        replacement: c
                    }
                })
            }

        })

        let newMainHead = {
            id: uuid(),
            dataId,
            prev: [{
                id: parent.id
            }],
            metadata,
            patches: [],
            head: true,
            createdAt: new Date(),
            type: "main"
        }

        updateInCache(contextId, newMainHead)

        commands.push({
            replaceOne: {
                filter: {
                    id: newMainHead.id,
                    dataId: dataId
                },
                replacement: newMainHead
            }
        })

        await mongodb.bulkWrite({
            db: db,
            collection: `${db.name}.${branchesCollection}`,
            commands
        })

        return newMainHead


    } catch (e) {
        throw e
    }

}



const updateVersion = async (contextId, options) => {

    try {

        let context = contextPool[contextId]
        if (!context) throw new Error(`brancher.updateVersion: context ${contextId} not found`)

        let { db, branchesCollection, dataId } = context
        let { version } = options

        updateInCache(contextId, { version })

        await mongodb.replaceOne({
            db,
            collection: `${db.name}.${branchesCollection}`,
            filter: {
                'id': version.id
            },
            data: version
        })

    } catch (e) {
        throw e
    }

}




const formatDiff = (delta, parentKey) => {
    let res = []
    delta = Diff.clone(delta)

    keys(delta).forEach(key => {

        if (key == "_t") return

        let publicParentKey = parentKey || ""
        let publicSelfKey = (keys(delta).includes("_t")) ? "" : key

        let publicKey = [publicParentKey, publicSelfKey].filter(d => d).join(".")

        if (isArray(delta[key])) {
            let op
            if (delta[key].length == 1) op = "insert"
            if (delta[key].length == 2) op = "update"
            if (delta[key].length == 3 && last(delta[key]) == 0) op = "remove"

            let oldValue
            if (delta[key].length == 1) oldValue = undefined
            if (delta[key].length == 2) oldValue = first(delta[key])
            if (delta[key].length == 3 && last(delta[key]) == 0) oldValue = first(delta[key])

            let newValue
            if (delta[key].length == 1) newValue = last(delta[key])
            if (delta[key].length == 2) newValue = last(delta[key])
            if (delta[key].length == 3 && last(delta[key]) == 0) newValue = undefined

            res.push({
                key: publicKey,
                op,
                oldValue,
                newValue
            })

        } else {

            res = res.concat(formatDiff(delta[key], publicKey))

        }

    })

    return res
}

const getDataDiff = async (contextId, options) => {
    try {

        let context = contextPool[contextId]

        if (!context) throw new Error(`brancher.createDataCommit: context ${contextId} not found`)

        let { dataId } = context
        let { source, target } = options

        source = resolveVersion(contextId, { version: source })
        target = resolveVersion(contextId, { version: target })

        let d1 = await resolveData(contextId, { version: source })
        let d2 = await resolveData(contextId, { version: target })

        if (!d1) throw new Error(`DataBrancher: data ${dataId}.v ${v1} not found`)
        if (!d2) throw new Error(`DataBrancher: data ${dataId}.v ${v2} not found`)

        let diff = Diff.diff(d1, d2)

        return {
            patch: diff,
            formatted: formatDiff(diff)
        }

    } catch (e) {
        throw e
    }

}


const getGraph = async (contextId) => {

    let context = contextPool[contextId]

    if (!context) throw new Error(`brancher.createDataCommit: context ${contextId} not found`)

    let { cache } = context

    let versions = cache.map(d => {
        d.name = d.id
        d.x = moment(d.createdAt).format("YYYY-MM-DD HH:mm:ss")
        d.y = d.user || "main",
            d.value = 1
        return d
    })

    let dependencies = []
    versions.forEach(t => {
        if (t.prev && t.prev.length > 0) {
            t.prev.forEach(s => {
                dependencies.push({
                    source: findIndex(versions, v => v.id == s.id),
                    target: findIndex(versions, v => v.id == t.id)
                })
            })
        }

    })

    let users = uniqBy(versions.map(d => d.user || "main"))
    let timeline = sortBy(versions.map(d => d.x))

    return {
        dataId,
        users,
        versions,
        dependencies,
        timeline
    }

}



const createWorker = async options => {

    let { dataId } = options
    let contextId = await getContext(options)
    if (contextPool[contextId].cache.length == 0) {
        await initDataVersion(contextId)
    }

    return {
        contextId,
        select: options => select(contextId, options),
        resolveVersion: options => resolveVersion(contextId, options),
        resolveData: async options => (await resolveData(contextId, options)),
        createDataBranch: async options => (await createDataBranch(contextId, options)),
        createDataSave: async options => (await createDataSave(contextId, options)),
        createDataCommit: async options => (await createDataCommit(contextId, options)),
        updateVersion: async options => (await updateVersion(contextId, options)),
        getDataDiff: async options => (await getDataDiff(contextId, options)),
        getGraph: options => (await getGraph(contextId, options))
    }

}



module.exports = {
    resolveVersion,
    resolveData,
    initDataVersion,
    createDataBranch,
    createDataSave,
    createDataCommit,
    updateVersion,
    getDataDiff,
    getGraph,
    select
}




// option = {
//   toolbox: {
//     feature: {
//       saveAsImage: {}
//     }
//   },
//   tooltip: {
//     formatter: params => {
//       if(params.dataType == "edge") return
//       return `Type: ${params.data.category}<br/>User: ${(params.data.value == "main") ? "" : params.data.value}<br/>Created at: ${params.data.x}<br/>${(params.data.readonly) ? "Read only" : ""}`
//     },
//     textStyle:{
//       fontSize: 10
//     }

//   },
//   xAxis: {
//     type: 'category',
//     data: mdata.timeline
//   },
//   yAxis: {
//     type: 'category',
//     data: mdata.users,
//     splitArea: {
//       show: true
//     },
//     splitLine:{
//       show: true
//     }
//   },
//   series: [
//     {
//       type: 'graph',
//       layout: 'none',
//       coordinateSystem: 'cartesian2d',
//       symbolSize: 15,
//       symbol: "rest",
//       label: {
//         show: true,
//         position:"top",
//         fontSize: 8
//       },
//       edgeSymbol: ['circle', 'arrow'],
//       edgeSymbolSize: [4, 10],
//       categories:[
//         {
//           name: "main",
//           symbol: "diamond"
//         },
//         {
//           name: "branch",
//           symbol: "rect"
//         },
//         {
//           name: "save",
//           symbol: "circle"
//         },

//       ],
//       data: mdata.versions.map( d => ({
//         name: `${d.name.split("-")[4]}`,
//         x: d.x,
//         value: d.y,
//         readonly: d.branch || d.save || d.commit,
//         category: d.type,
//         itemStyle:{
//           symbol: (d.head) ? "circle" : "rect",
//           borderColor: (d.head) ? (!d.branch && !d.save && !d.commit) ? "#33691e": "#bf360c" :"#424242",
//           borderWidth:2,
//           color: (d.head) ? (!d.branch && !d.save && !d.commit) ? "#aed581": "#ffb300" : "#e0e0e0"
//         }
//       })),
//       links: mdata.dependencies,
//       lineStyle: {
//         color: '#37474f',
//         opacity: 0.5,
//         width:2,
//         curveness: 0
//       }
//     }
//   ]
// }