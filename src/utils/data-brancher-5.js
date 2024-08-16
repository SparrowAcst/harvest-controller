const mongodb = require("../mongodb")
const {
    extend,
    isArray,
    isString,
    isObject,
    isFunction,
    find,
    remove,
    unionBy,
    keys,
    first,
    last,
    uniqBy,
    sortBy,
    findIndex,
    difference,
    values,
    flattenDeep
} = require("lodash")

const Diff = require('jsondiffpatch')
const uuid = require("uuid").v4
const moment = require("moment")

const resolveSelector = selector => {
    selector = selector || (d => true)
    if (isFunction(selector)) return selector
    if (isObject(selector)) return (
        d => keys(selector).map(key => d[key] === selector[key]).reduce((a, b) => a && b, true)
    )
    throw new Error(`brancher.resolveSelector: selector ${JSON.stringify(selector)} not resolved`)
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


const resolveData = async (options = {}) => {

    try {

        let { db, dataCollection, version } = options

        if (!version) throw new Error(`brancher.resolveData: version ${version.id} not found`)

        version = (isArray(version)) ? version : [version]

        let dataId = version.map(v => v.dataId)

        let data = await mongodb.aggregate({
            db,
            collection: `${db.name}.${dataCollection}`,
            pipeline: [{
                $match: {
                    id: {
                        $in: dataId
                    }
                }
            }]
        })

        data = version.map(v => {
            let d = find(data, d => v.dataId == d.id)
            v.patches.forEach(p => {
                Diff.patch(d, p)
            })
            return d
        })

        return data

    } catch (e) {
        throw e
    }

}

const init = async (options = {}) => {

    try {

        let { db, branchesCollection, dataId, metadata, dataView } = options

        dataView = dataView || (d => null)

        let branches = dataId.map(did => ({
            id: uuid(),
            dataId: did,
            patches: [],
            head: true,
            createdAt: new Date(),
            metadata,
            readonly: true,
            type: "main"
        }))

        console.log(branches)
        let data = await resolveData(extend({}, options, { version: branches }))
        console.log("data", data)
        
        let commands = branches.map((branch, index) => {

            branch.dataView = dataView(data[index])
            return {
                replaceOne: {
                    filter: {
                        id: branch.id,
                        dataId: data[index].id
                    },
                    replacement: branch,
                    upsert: true
                }
            }

        })

        if (commands.length > 0) {
            await mongodb.bulkWrite({
                db: db,
                collection: `${db.name}.${branchesCollection}`,
                commands
            })
        }

    } catch (e) {
        throw e
    }

}


const Worker = class {

    constructor(options, cache) {
        this.context = extend({}, options, { cache })
    }

    updateInCache(options = {}) {

        let { cache } = this.context
        let { version } = options

        if (!version) throw new Error(`brancher.updateInCache: undefined version`)

        let index = findIndex(cache[version.dataId], d => d.id == version.id)
        if (index >= 0) {
            cache[version.dataId][index] = version
        } else {
            cache[version.dataId] = cache[version.dataId] || []
            cache[version.dataId].push(version)
        }

    }

    select(selector) {

        let { cache } = this.context
        selector = resolveSelector(selector)
        return flattenDeep(values(cache)).filter(selector)

    }

    resolveVersion(options = {}) {

        try {

            let { cache } = this.context
            let { version } = options
            let result = (version.id) 
                ? version //find(flattenDeep(values(cache)), d => d.id == version.id) 
                : find(flattenDeep(values(cache)), d => d.id == version)

            if (result) {
                delete result._id
            }

            return result

        } catch (e) {
            throw e
        }

    }

    async resolveData(options = {}) {

        try {

            let { db, dataCollection } = this.context
            let { version } = options

            version = this.resolveVersion({ version })

            if (!version) throw new Error(`brancher.resolveData: version ${version.id} not found`)

            let dataId = version.dataId

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


    async branch(options = {}) {

        try {

            let { db, branchesCollection, cache } = this.context

            let { user, source, metadata, task } = options

            user = user || []
            user = (isArray(user)) ? user : [user]

            source = source || []
            source = (isArray(source)) ? source : [source]


            let commands = []
            let result = []

            source.forEach(s => {

                let parent = this.resolveVersion({ version: s })

                if (!parent) throw new Error(`brancher.initDataVersion: source ${source.id || source} not found`)

                let dataId = parent.dataId
                let branches = []

                user.forEach(u => {

                    let branch = {
                        id: uuid(),
                        dataId,
                        task,
                        user: u,
                        prev: [{
                            id: parent.id
                        }],
                        head: true,
                        patches: parent.patches,
                        createdAt: new Date(),
                        metadata: extend({}, parent.metadata, metadata),
                        readonly: false,
                        dataView: parent.dataView,
                        type: "branch"
                    }

                    console.log("Create branch", branch)

                    branches.push(branch)

                    commands.push({
                        replaceOne: {
                            filter: {
                                id: branch.id,
                                dataId: dataId
                            },
                            replacement: branch,
                            upsert: true
                        }
                    })


                    let prevUserHead = find(cache[parent.dataId], d => d.user == u && d.head == true)

                    if (prevUserHead) {

                        prevUserHead.head = false
                        this.updateInCache({ version: prevUserHead })

                        commands.push({
                            replaceOne: {
                                filter: {
                                    id: prevUserHead.id,
                                    dataId: dataId
                                },
                                replacement: prevUserHead,
                                upsert: true
                            }
                        })
                    }



                    this.updateInCache({ version: branch })

                })


                parent.branch = (parent.branch || []).concat(branches.map(b => b.id))
                parent.readonly = true
                commands.push({
                    replaceOne: {
                        filter: {
                            id: parent.id,
                            dataId: dataId
                        },
                        replacement: parent,
                        upsert: true
                    }
                })


                this.updateInCache({ version: parent })
                result = result.concat(branches)
            })

            await mongodb.bulkWrite({
                db: db,
                collection: `${db.name}.${branchesCollection}`,
                commands
            })

            return result

        } catch (e) {
            throw e
        }

    }

    async save(options = {}) {

        try {

            let { db, branchesCollection, cache, dataView } = this.context
            let { user, source, data, metadata } = options

            dataView = dataView || (d => null)

            let parent = this.resolveVersion({ version: source })

            if (!parent) throw new Error(`brancher.initDataVersion: source ${source.id || source} not found`)

            delete parent.data    
                
            let prevData = await this.resolveData({ version: parent })

            let difference = Diff.diff(prevData, data)

            if( !difference ) {
                return parent
            }

            user = user || parent.user
            data = data || prevData
            let dataId = parent.dataId

            let newVersion = {
                id: uuid(),
                dataId,
                task: parent.task,
                user,
                prev: [{
                    id: parent.id
                }],
                metadata: extend({}, parent.metadata, metadata),
                head: true,
                createdAt: new Date(),
                patches: parent.patches.concat([Diff.diff(prevData, data)]).filter(d => d),
                type: "save",
                dataView: dataView(data),
                readonly: false
            }

            parent.head = false
            parent.readonly = true
            parent.save = newVersion.id


            this.updateInCache({ version: newVersion })
            this.updateInCache({ version: parent })


            await mongodb.bulkWrite({
                db: db,
                collection: `${db.name}.${branchesCollection}`,
                commands: [{
                        insertOne: {
                            document: newVersion
                        }
                    },
                    {
                        replaceOne: {
                            filter: {
                                id: parent.id,
                                dataId: dataId
                            },
                            replacement: parent,
                            upsert: true
                        }
                    }

                ]
            })

            return newVersion

        } catch (e) {
            throw e
        }

    }

    async submit(options = {}) {

        try {

            let { db, branchesCollection, cache, freezePeriod, dataView } = this.context
            let { user, source, data, metadata } = options

            dataView = dataView || (d => null)

            freezePeriod = freezePeriod || options.freezePeriod || [1, "minutes"]

            let parent = this.resolveVersion({ version: source })

            if (!parent) throw new Error(`brancher.initDataVersion: source ${source.id || source} not found`)


            let prevData = await this.resolveData({ version: parent })

            user = user || parent.user
            data = data || prevData
            let dataId = parent.dataId

            let newVersion = {
                id: uuid(),
                dataId,
                task: parent.task,
                user,
                prev: [{
                    id: parent.id
                }],
                metadata: extend({}, parent.metadata, metadata),
                head: true,
                createdAt: new Date(),
                patches: parent.patches.concat([Diff.diff(prevData, data)]).filter(d => d),
                type: "submit",
                expiredAt: moment(new Date()).add(...freezePeriod).toDate(),
                dataView: dataView(data),
                readonly: true
            }

            parent.head = false
            parent.readonly = true
            parent.submit = newVersion.id


            this.updateInCache({ version: newVersion })
            this.updateInCache({ version: parent })


            await mongodb.bulkWrite({
                db: db,
                collection: `${db.name}.${branchesCollection}`,
                commands: [{
                        insertOne: {
                            document: newVersion
                        }
                    },
                    {
                        replaceOne: {
                            filter: {
                                id: parent.id,
                                dataId: dataId
                            },
                            replacement: parent,
                            upsert: true
                        }
                    }

                ]
            })

            return newVersion

        } catch (e) {
            throw e
        }

    }

    async rollback(options = {}) {

        try {

            let { db, branchesCollection, cache, freezePeriod } = this.context
            let { source } = options

            let self = this.resolveVersion({ version: source })
            let dataId = self.dataId

            if (!self) throw new Error(`brancher.initDataVersion: source ${source.id || source} not found`)
            if (self.type != "submit") throw new Error(`brancher.submit: source ${source.id || source} not submit`)

            
            let parent = this.resolveVersion({ version: first(self.prev).id })

            console.log(`ROLLBACK for ${self.id} to ${parent.id}`)


            parent.head = true
            parent.readonly = false
            delete parent.submit

            this.updateInCache({ version: parent })
            remove(cache[dataId], d => d.id == self.id)

            await mongodb.bulkWrite({
                db: db,
                collection: `${db.name}.${branchesCollection}`,
                commands: [{
                        replaceOne: {
                            filter: {
                                id: parent.id,
                                dataId
                            },
                            replacement: parent,
                            upsert: true
                        }
                    },
                    {
                        deleteOne: {
                            filter: {
                                id: self.id,
                                dataId
                            }
                        }
                    }

                ]
            })

            return parent

        } catch (e) {
            throw e
        }

    }

    async commit(options = {}) {

        try {

            let { db, branchesCollection, dataCollection, cache, dataView } = this.context

            let { user, source, data, metadata } = options

            dataView = dataView || (d => null)


            let parent = this.resolveVersion({ version: source })

            if (!parent) throw new Error(`brancher.createDataCommit: source ${source.id || source} not found`)

            data = (data) ? data : (await this.resolveData({ version: parent }))
            user = user || parent.user
            let dataId = parent.dataId


            let newMainHead = {
                id: uuid(),
                dataId,
                task: parent.task,
                prev: [{
                    id: parent.id
                }],
                metadata: extend({}, parent.metadata, metadata),
                patches: [],
                head: true,
                createdAt: new Date(),
                type: "main",
                readonly: true,
                dataView: dataView(data)
            }

            parent.commit = newMainHead.id



            let commands = []

            let headVersions = this.select(d => d.head == true).map(d => d.id)
            let mainVersions = this.select(d => !d.user).map(d => d.id)

            for (let c of cache[dataId]) {

                if (headVersions.includes(c.id)) {
                    c.head = false
                }

                if (mainVersions.includes(c.id)) {
                    let d = await this.resolveData({ version: c })
                    c.patches = [Diff.diff(data, d)].filter(d => d)
                    c.head = false
                }

                if (headVersions.includes(c.id) || mainVersions.includes(c.id)) {
                    commands.push({
                        replaceOne: {
                            filter: {
                                id: c.id,
                                dataId: dataId
                            },
                            replacement: c,
                            upsert: true
                        }
                    })
                }

            }

            parent.head = false
            parent.readonly = true


            this.updateInCache({ version: newMainHead })
            this.updateInCache({ version: parent })

            commands.push({
                replaceOne: {
                    filter: {
                        id: newMainHead.id,
                        dataId: dataId
                    },
                    replacement: newMainHead,
                    upsert: true
                }
            })
            commands.push({
                replaceOne: {
                    filter: {
                        id: parent.id,
                        dataId: dataId
                    },
                    replacement: parent,
                    upsert: true
                }
            })

            await mongodb.bulkWrite({
                db: db,
                collection: `${db.name}.${branchesCollection}`,
                commands
            })


            await mongodb.replaceOne({
                db: db,
                collection: `${db.name}.${dataCollection}`,
                filter: {
                    'id': dataId
                },
                data: data
            })


            return newMainHead


        } catch (e) {
            throw e
        }

    }

    async merge(options = {}) {

        try {

            let { db, branchesCollection, cache, dataView } = this.context

            let { user, sources, data, metadata } = options

            dataView = dataView || (d => null)

            let parents = sources.map(source => this.resolveVersion({ version: source }))

            if (!parents) throw new Error(`brancher.merge: source list is empty`)

            let prev = []
            for (let parent of parents) {

                let d = await this.resolveData({ version: parent })
                prev.push({
                    id: parent.id,
                    patch: parent.patches.concat([Diff.diff(d, data)]).filter(d => d)
                })

            }

            let dataId = parents[0].dataId

            let mergeHead = {
                id: uuid(),
                dataId,
                task: parents[0].task,
                user,
                prev,
                metadata,
                patches: [],
                head: true,
                createdAt: new Date(),
                type: "merge",
                dataView: dataView(data)
            }

            mergeHead.patches = mergeHead.prev[0].patch
            this.updateInCache({ version: mergeHead })

            let commands = [{
                replaceOne: {
                    filter: {
                        id: mergeHead.id,
                        dataId
                    },
                    replacement: mergeHead,
                    upsert: true
                }
            }]

            for (let parent of parents) {

                parent.head = false
                parent.merge = mergeHead.id
                parent.readonly = true
                this.updateInCache({ version: parent })
                commands.push({
                    replaceOne: {
                        filter: {
                            id: parent.id,
                            dataId
                        },
                        replacement: parent,
                        upsert: true
                    }
                })

            }

            await mongodb.bulkWrite({
                db: db,
                collection: `${db.name}.${branchesCollection}`,
                commands
            })

            return mergeHead

        } catch (e) {
            throw e
        }

    }


    async updateVersion(options = {}) {

        try {

            let context = contextPool[contextId]
            if (!context) throw new Error(`brancher.updateVersion: context ${contextId} not found`)

            let { db, branchesCollection, dataId } = this.context
            let { version } = options

            this.updateInCache({ version })

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

    async getDataDiff(options = {}) {
        try {

            let { dataId } = this.context
            let { source, target } = options

            source = this.resolveVersion({ version: source })
            target = this.resolveVersion({ version: target })

            let d1 = await this.resolveData({ version: source })
            let d2 = await this.resolveData({ version: target })

            if (!d1) throw new Error(`brancher: data ${dataId}.v ${v1} not found`)
            if (!d2) throw new Error(`brancher: data ${dataId}.v ${v2} not found`)

            let diff = Diff.diff(d1, d2)

            return {
                patch: diff,
                formatted: formatDiff(diff)
            }

        } catch (e) {
            throw e
        }

    }

    getHistory(options = {}) {

        let { cache } = this.context
        let { maxDepth, stopAtMain, version } = options

        if (!version) throw new Error((`brancher.getHistory: version undefined`))
        version = (isString(version)) ? this.resolveVersion({ version }) : version


        maxDepth = maxDepth || Infinity

        let res = [version]
        let current = version
        let f = find(cache[version.dataId], v => v.id == ((current.prev) ? current.prev[0].id : null))
        let step = 1
        while (f && (step < maxDepth) && ((stopAtMain) ? (current.type != "main") : true)) {
            res.push(f)
            current = f
            step++
            f = find(cache[version.dataId], v => v.id == ((current.prev) ? current.prev[0].id : null))
        }

        return res

    }

    getGraph(options = {}) {

        let { cache } = this.context
        let { dataId, version } = options

        dataId = dataId || version.dataId

        let versions = cache[dataId].map(d => {
            d.name = d.id
            d.x = moment(d.createdAt).format("YYYY-MM-DD HH:mm:ss")
            d.y = d.user || "main"
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


    getChart(options = {}) {

        const { dataId, version } = options

        let data = this.getGraph(options)

        let connectors = []

        let nodes = data.versions.filter(d => d.branch)

        nodes.forEach(n => {
            let node = find(data.versions, v => v.id == n.id)
            node.branch = n.branch.map(b => {
                let branch = find(data.versions, v => v.id == b)
                let connector = {
                    id: uuid(),
                    user: branch.user,
                    x: branch.x, //node.x,
                    y: node.user || "main", //branch.user,
                    value: 1,
                    prev: [{
                        id: node.id
                    }],
                    createdAt: node.createdAt,
                    type: "connector"
                }

                let index = findIndex(branch.prev, pr => pr.id == node.id)

                branch.prev[index] = { id: connector.id }
                connectors.push(connector)
                return connector.id
            })
        })

        nodes = data.versions.filter(d => d.merge)

        nodes.forEach(n => {
            let node = find(data.versions, v => v.id == n.id)
            let merge = find(data.versions, v => v.id == node.merge)

            let connector = {
                id: uuid(),
                user: node.user,
                x: node.x,
                y: merge.user,
                value: 1,
                prev: [{
                    id: node.id
                }],
                createdAt: merge.createdAt,
                type: "connector"
            }

            let index = findIndex(merge.prev, pr => pr.id == node.id)
            merge.prev[index] = { id: connector.id }

            node.merge = connector.id

            connectors.push(connector)


        })



        nodes = data.versions.filter(d => d.commit)

        nodes.forEach(n => {
            let node = find(data.versions, v => v.id == n.id)
            let commit = find(data.versions, v => v.id == node.commit)

            let connector = {
                id: uuid(),
                x: commit.x,
                y: node.y,
                value: 1,
                prev: [{
                    id: node.id
                }],
                createdAt: node.createdAt,
                type: "connector"
            }


            commit.prev = [{
                id: connector.id
            }]

            node.commit = connector.id
            connectors.push(connector)
        })

        //////////////////////////////////////////////////////////////////////////////////////////////////

        data.versions = sortBy(data.versions.concat(connectors), d => d.index)


        let dependencies = []

        data.versions.forEach(t => {
            if (t.prev && t.prev.length > 0) {
                t.prev.forEach(s => {

                    dependencies.push({
                        source: findIndex(data.versions, v => v.id == s.id),
                        target: findIndex(data.versions, v => v.id == t.id)
                    })
                })
            }

        })

        data.dependencies = dependencies.map(d => {
            if (data.versions[d.target].type == "connector") {
                d.symbol = "none"
            } else {
                d.symbol = ["none", "arrow"]
            }
            return d
        })

        data.timeline = sortBy(data.versions.map(d => d.x))


        return {
            toolbox: {
                feature: {
                    saveAsImage: {}
                }
            },
            tooltip: {
                formatter: "params => {\n\tif (params.dataType == \"edge\") return\n\treturn `<b>${params.data.category}</b><br/>User: ${(params.data.value[1] == \"main\") ? \"\" : params.data.value[1]}<br/>Created at: ${params.data.x}<br/>${(params.data.readonly) ? \"Read only\" : \"\"}`\n}",
                textStyle: {
                    fontSize: 10
                }

            },

            xAxis: {
                type: 'category',
                show: false
            },
            yAxis: {
                type: 'category',
                data: data.users,
                splitArea: {
                    show: true
                },
                splitLine: {
                    show: true
                }
            },
            series: [{
                type: 'graph',
                layout: 'none',
                coordinateSystem: 'cartesian2d',
                label: {
                    show: true,
                    position: "bottom",
                    fontSize: 8
                },
                edgeSymbol: ['none', 'arrow'],
                edgeSymbolSize: [0, 10],

                "categories": [{
                        "name": "main",
                        // "symbol": "path://M18 16V14H19V4H6V14.0354C6.1633 14.0121 6.33024 14 6.5 14H8V16H6.5C5.67157 16 5 16.6716 5 17.5C5 18.3284 5.67157 19 6.5 19H10V21H6.5C4.567 21 3 19.433 3 17.5V5C3 3.34315 4.34315 2 6 2H20C20.5523 2 21 2.44772 21 3V20C21 20.5523 20.5523 21 20 21H16V19H19V16H18ZM7 5H9V7H7V5ZM7 8H9V10H7V8ZM14 17V23H12V17H9L13 12L17 17H14Z",
                        "symbol": "path://M17.63,5.84 C17.27,5.33 16.67,5 16,5 L5,5.01 C3.9,5.01 3,5.9 3,7 L3,17 C3,18.1 3.9,18.99 5,18.99 L16,19 C16.67,19 17.27,18.67 17.63,18.16 L22,12 L17.63,5.84 Z M16,17 L5,17 L5,7 L16,7 L19.55,12 L16,17 Z",
                        "symbolSize": 20
                    },
                    {
                        "name": "merge",
                        "symbol": "path://M7.10508 8.78991C7.45179 10.0635 8.61653 11 10 11H14C16.4703 11 18.5222 12.7915 18.9274 15.1461C20.1303 15.5367 21 16.6668 21 18C21 19.6569 19.6569 21 18 21C16.3431 21 15 19.6569 15 18C15 16.7334 15.7849 15.6501 16.8949 15.2101C16.5482 13.9365 15.3835 13 14 13H10C8.87439 13 7.83566 12.6281 7 12.0004V15.1707C8.16519 15.5825 9 16.6938 9 18C9 19.6569 7.65685 21 6 21C4.34315 21 3 19.6569 3 18C3 16.6938 3.83481 15.5825 5 15.1707V8.82929C3.83481 8.41746 3 7.30622 3 6C3 4.34315 4.34315 3 6 3C7.65685 3 9 4.34315 9 6C9 7.26661 8.21506 8.34988 7.10508 8.78991ZM6 7C6.55228 7 7 6.55228 7 6C7 5.44772 6.55228 5 6 5C5.44772 5 5 5.44772 5 6C5 6.55228 5.44772 7 6 7ZM6 19C6.55228 19 7 18.5523 7 18C7 17.4477 6.55228 17 6 17C5.44772 17 5 17.4477 5 18C5 18.5523 5.44772 19 6 19ZM18 19C18.5523 19 19 18.5523 19 18C19 17.4477 18.5523 17 18 17C17.4477 17 17 17.4477 17 18C17 18.5523 17.4477 19 18 19Z",
                        "symbolSize": 20,
                    },
                    {
                        "name": "save",
                        "symbol": "path://M512 1536h768v-384h-768v384zm896 0h128v-896q0-14-10-38.5t-20-34.5l-281-281q-10-10-34-20t-39-10v416q0 40-28 68t-68 28h-576q-40 0-68-28t-28-68v-416h-128v1280h128v-416q0-40 28-68t68-28h832q40 0 68 28t28 68v416zm-384-928v-320q0-13-9.5-22.5t-22.5-9.5h-192q-13 0-22.5 9.5t-9.5 22.5v320q0 13 9.5 22.5t22.5 9.5h192q13 0 22.5-9.5t9.5-22.5zm640 32v928q0 40-28 68t-68 28h-1344q-40 0-68-28t-28-68v-1344q0-40 28-68t68-28h928q40 0 88 20t76 48l280 280q28 28 48 76t20 88z",
                        "symbolSize": 20
                    },
                    {
                        "name": "branch",
                        "symbol": "path://M7.10508 15.2101C8.21506 15.6501 9 16.7334 9 18C9 19.6569 7.65685 21 6 21C4.34315 21 3 19.6569 3 18C3 16.6938 3.83481 15.5825 5 15.1707V8.82929C3.83481 8.41746 3 7.30622 3 6C3 4.34315 4.34315 3 6 3C7.65685 3 9 4.34315 9 6C9 7.30622 8.16519 8.41746 7 8.82929V11.9996C7.83566 11.3719 8.87439 11 10 11H14C15.3835 11 16.5482 10.0635 16.8949 8.78991C15.7849 8.34988 15 7.26661 15 6C15 4.34315 16.3431 3 18 3C19.6569 3 21 4.34315 21 6C21 7.3332 20.1303 8.46329 18.9274 8.85392C18.5222 11.2085 16.4703 13 14 13H10C8.61653 13 7.45179 13.9365 7.10508 15.2101ZM6 17C5.44772 17 5 17.4477 5 18C5 18.5523 5.44772 19 6 19C6.55228 19 7 18.5523 7 18C7 17.4477 6.55228 17 6 17ZM6 5C5.44772 5 5 5.44772 5 6C5 6.55228 5.44772 7 6 7C6.55228 7 7 6.55228 7 6C7 5.44772 6.55228 5 6 5ZM18 5C17.4477 5 17 5.44772 17 6C17 6.55228 17.4477 7 18 7C18.5523 7 19 6.55228 19 6C19 5.44772 18.5523 5 18 5Z",
                        "symbolSize": 20
                    },
                    {
                        "name": "submit",
                        // "symbol": `path://M329.364,237.908l42.558-39.905c25.236-23.661,39.552-56.701,39.552-91.292V49.156c0.009-13.514-5.53-25.918-14.402-34.754C388.235,5.529,375.833-0.009,362.318,0H149.681c-13.514-0.009-25.926,5.529-34.763,14.401c-8.871,8.837-14.41,21.24-14.392,34.754v57.554c0,34.591,14.315,67.632,39.552,91.292l42.55,39.888c2.342,2.205,3.678,5.271,3.678,8.492v19.234c0,3.221-1.336,6.279-3.669,8.476l-42.558,39.905c-25.237,23.652-39.552,56.701-39.552,91.292v57.554c-0.018,13.515,5.522,25.918,14.392,34.755c8.838,8.871,21.249,14.41,34.763,14.401h212.636c13.515,0.009,25.918-5.53,34.755-14.401c8.871-8.838,14.41-21.24,14.402-34.755V405.29c0-34.591-14.316-67.64-39.552-91.292l-42.55-39.897c-2.352-2.205-3.678-5.263-3.678-8.484v-19.234C325.694,243.162,327.021,240.096,329.364,237.908z M373.946,462.844c-0.009,3.273-1.274,6.056-3.411,8.218c-2.162,2.136-4.944,3.402-8.218,3.41H149.681c-3.273-0.009-6.064-1.274-8.226-3.41c-2.136-2.162-3.393-4.945-3.402-8.218V405.29c0-24.212,10.026-47.356,27.691-63.91l42.55-39.906c9.914-9.285,15.539-22.273,15.539-35.857v-19.234c0-13.592-5.625-26.58-15.547-35.866l-42.542-39.896c-17.666-16.554-27.691-39.69-27.691-63.91V49.156c0.009-3.273,1.266-6.055,3.402-8.226c2.162-2.127,4.953-3.394,8.226-3.402h212.636c3.273,0.008,6.056,1.274,8.218,3.402c2.136,2.171,3.402,4.952,3.411,8.226v57.554c0,24.22-10.026,47.356-27.692,63.91l-42.55,39.896c-9.914,9.286-15.538,22.274-15.538,35.866v19.234c0,13.584,5.625,26.572,15.547,35.874l42.541,39.88c17.666,16.563,27.692,39.707,27.692,63.919V462.844z M237.261,378.95l-77.33,77.33h192.128l-77.33-77.33C264.385,368.614,247.615,368.614,237.261,378.95z`,
                        // "symbol": `path:/M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm-.997-4L6.76 11.757l1.414-1.414 2.829 2.829 5.656-5.657 1.415 1.414L11.003 16z`
                        "symbol": "path://M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm-.997-4L6.76 11.757l1.414-1.414 2.829 2.829 5.656-5.657 1.415 1.414L11.003 16z",
                        "symbolSize": 20
                    },

                    {
                        "name": "connector",
                        "symbol": "none",
                        "symbolSize": 0
                    }
                ],

                data: data.versions.map((d, index) => ({
                    name: (d.name) ? last(d.name.split("-")) : null,
                    x: d.x,
                    value: [d.x, d.y],
                    readonly: d.readonly, //!!d.branch || !!d.save || !!d.commit,
                    head: d.head,
                    category: d.type,
                    label: {
                        position: (index % 2 == 0) ? "top" : "bottom"
                    },
                    itemStyle: {
                        color: (d.head) ? (!d.readonly) ? "#1872a8" : "#ff9800" : "#333",
                        borderColor: (d.head) ? (!d.readonly) ? "#1872a8" : "#ff9800" : "#333",
                        borderWidth: (d.head) ? 0.3 : 0
                    }
                })),
                links: data.dependencies,
                lineStyle: {
                    color: '#333',
                    width: 1.5,
                    curveness: 0
                }
            }]
        }

    }


}


const createWorker = async options => {

    let { db, branchesCollection, dataId } = options

    dataId = dataId || []

    dataId = (isArray(dataId)) ? dataId : [dataId]

    options.dataId = dataId

    let data = await mongodb.aggregate({
        db,
        collection: `${db.name}.${branchesCollection}`,
        pipeline: [{
                $match: {
                    dataId: {
                        $in: dataId,
                    },
                },
            },
            {
                $project: {
                    _id: 0,
                    dataId: 1
                }
            }
        ]
    })

    data = data.map(d => d.dataId)

    let noVersioned = difference(dataId, data)

    await init(extend({}, options, { dataId: noVersioned }))

    data = await mongodb.aggregate({
        db,
        collection: `${db.name}.${branchesCollection}`,
        pipeline: [{
                $match: {
                    dataId: {
                        $in: dataId,
                    },
                },
            },
            {
                $group: {
                    _id: "$dataId",
                    pool: {
                        $push: "$$ROOT",
                    },
                },
            },
            {
                $set: {
                    id: "$_id"
                }
            },
            {
                $project: {
                    _id: 0
                }
            }
        ]
    })

    let cache = {}

    data.forEach(d => {
        cache[d.id] = d.pool.map(v => {
            delete v._id
            return v
        })
    })

    let worker = new Worker(options, cache)
    if (cache.length == 0) {
        await worker.init()
    }
    return worker
}


module.exports = createWorker