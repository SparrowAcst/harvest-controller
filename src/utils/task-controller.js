const mongodb = require("../mongodb")
const uuid = require("uuid").v4

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
    flattenDeep,
    sample
} = require("lodash")

const moment = require("moment")

const createBrancher = require("./data-brancher-5")

const SETTINGS = {

    "1st expert": {
        TASK_BUFFER_MIN: 5,
        TASK_BUFFER_MAX: 10,
        TASK_QUOTE: 42,
        "TASK_QUOTE_PERIOD": [24, "hours"]
    },

    "2nd expert": {
        TASK_BUFFER_MIN: 5,
        TASK_BUFFER_MAX: 10,
        TASK_QUOTE: 42,
        "TASK_QUOTE_PERIOD": [24, "hours"]
    },

    "CMO": {
        TASK_BUFFER_MIN: 5,
        TASK_BUFFER_MAX: 10,
        TASK_QUOTE: 42,
        "TASK_QUOTE_PERIOD": [24, "hours"]
    },

    "admin": {
        TASK_BUFFER_MIN: 5,
        TASK_BUFFER_MAX: 10,
        TASK_QUOTE: 42,
        "TASK_QUOTE_PERIOD": [24, "hours"]
    }

}


const Worker = class {

    constructor(options) {
        this.context = extend({}, options)
        this.context.employee = this.context.employee || SETTINGS
    }


    async getBrancher(options) {
        let res = await createBrancher(options)
        return res
    }


    async resolveData(options = {}) {

        try {

            let { db, branchesCollection } = this.context
            let { version } = options

            let w = await createBrancher(extend({}, this.context, { dataId: [version.dataId] }))
            let result = await w.resolveData({ version })

            return result

        } catch (e) {

            throw e
        }

    }

    async selectMainTask(options = {}) {

        try {
            let { db, branchesCollection } = this.context
            let { matchVersion } = options

            let pipeline = [{
                    $match: matchVersion || {}
                },
                {
                    $project: {
                        _id: 0,
                    },
                },
            ]

            let data = await mongodb.aggregate({
                db,
                collection: `${db.name}.${branchesCollection}`,
                pipeline
            })

            return data

        } catch (e) {

            throw e
        }

    }

    async selectEmployeeTask(options = {}) {

        try {

            let { db, grantCollection, branchesCollection } = this.context
            let { matchEmployee, matchVersion } = options

            let p1 = ((matchEmployee) ? [{ $match: matchEmployee }] : [])
            let p2 = (matchVersion) ? [{
                $lookup: {
                    from: branchesCollection,
                    localField: "namedAs",
                    foreignField: "user",
                    pipeline: [{
                        $match: matchVersion
                    }, ],
                    as: "version",
                }
            }] : []
            let p3 = [{
                    $unwind: {
                        path: "$version"
                    }
                },
                {
                    $project: {
                        _id: 0
                    }
                }
            ]

            let pipeline = p1.concat(p2).concat(p3)
            console.log(JSON.stringify(pipeline, null, " "))
            let data = await mongodb.aggregate({
                db,
                collection: `${db.name}.${grantCollection}`,
                pipeline
            })

            return data

        } catch (e) {

            throw e

        }

    }


    async addEmployeeQuote( options = {}) {
        try {

            let { db, quoteCollection } = this.context
            let { employee, quote, period } = options

            let newQuote = {
                id: uuid(),
                createdAt: new Date(),
                quote,
                period,
                user: employee
            }

            let res = await mongodb.replaceOne({
                db,
                collection: `${db.name}.${quoteCollection}`,
                filter: {
                    'id': newQuote.id
                },
                data: newQuote,
                upsert: true
            })

            return res

        } catch (e) {

            throw e

        }
    }

    async getEmployeeActivity(options = {}) {
        try {

            let { db, grantCollection, branchesCollection, quoteCollection } = this.context
            let { employee, version } = options

            let p1 = ((employee) ? [{ $match: employee }] : [])
            let p2 = (version) ? [{
                $lookup: {
                    from: branchesCollection,
                    localField: "namedAs",
                    foreignField: "user",
                    pipeline: [{
                        $match: version
                    }, ],
                    as: "activity",
                }
            }] : []

            let p3 = [

                {
                    $lookup: {
                        from: quoteCollection,
                        localField: "namedAs",
                        foreignField: "user",
                        pipeline: [{
                                $sort: {
                                    createdAt: -1,
                                },
                            },
                            {
                                $project: {
                                    _id: 0,
                                },
                            },
                        ],
                        as: "quote",
                    },
                }
            ]

            let pipeline = p1.concat(p2).concat(p3)

            let data = await mongodb.aggregate({
                db,
                collection: `${db.name}.${grantCollection}`,
                pipeline
            })

            return data

        } catch (e) {

            throw e

        }

    }


    async getEmployeeStat(options = {}) {
        try {

            const filters = {
                assigned: d => d.type == "branch",
                inProgress: d => d.type == "save" && d.head == true && d.readonly == false,
                started: d => d.type == "branch" && d.head == true && d.readonly == false,
                complete: d => d.type == "save" && (!!d.branch || !!d.freeze || !!d.merge)
            }



            let { db, grantCollection, branchesCollection } = this.context
            let { employee, version } = options

            let taskList = await this.getEmployeeActivity({
                employee,
                version: version || {}
            })

            let r = taskList.map(t => {

                let result = {
                    activity: {},
                    totals: {}
                }

                keys(filters).forEach(key => {
                    result.activity[key] = t.activity.filter(filters[key])
                    result.totals[key] = result.activity[key].length
                })

                result.totals.buffer = result.totals.inProgress + result.totals.started

                result.quote = (t.quote.length > 0) ? t.quote : [{
                    user: t.namedAs,
                    quote: this.context.employee[t.role].TASK_QUOTE,
                    period: this.context.employee[t.role].TASK_QUOTE_PERIOD,
                    createdAt: new Date()
                }]

                if (!result.quote[0].quote) {
                    result.quote = [{
                        user: t.namedAs,
                        quote: this.context.employee[t.role].TASK_QUOTE,
                        period: this.context.employee[t.role].TASK_QUOTE_PERIOD,
                        createdAt: new Date()
                    }]
                }

                result.priority = 0
                if (result.totals.assigned < (result.quote[0].quote || this.context.employee[t.role].TASK_QUOTE)) {
                    // result.priority = Math.max(result.totals.assigned, this.context.employee[t.role].TASK_BUFFER_MAX - result.totals.buffer)
                    result.priority = this.context.employee[t.role].TASK_BUFFER_MAX - result.totals.buffer
                }

                return extend({}, t, result)
            })

            return r


        } catch (e) {

            throw e

        }

    }



    async getTimeline(options = {}) {

        try {

            let { db, grantCollection, branchesCollection } = this.context
            let { employee, version, unit, binSize, groupBy } = options

            groupBy = groupBy || {}


            let p1 = ((employee) ? [{ $match: employee }] : [])

            let p2 = (version) ? [{
                $lookup: {
                    from: branchesCollection,
                    localField: "namedAs",
                    foreignField: "user",
                    pipeline: [{
                        $match: version
                    }, ],
                    as: "activity",
                }
            }] : []


            let setter = {
                $set: {
                    time: "$_id.time"
                }
            }

            if (groupBy.employee) {
                setter.$set[groupBy.employee.name || "employee"] = "$_id.employee"
            }

            if (groupBy.type) {
                setter.$set[groupBy.type.name || "type"] = "$_id.type"
            }


            let p3 = [{
                    $lookup: {
                        from: "branches",
                        localField: "namedAs",
                        foreignField: "user",
                        pipeline: [{
                            $project: {
                                _id: 0,
                            },
                        }, ],
                        as: "version",
                    },
                },
                {
                    $unwind: {
                        path: "$version",
                    },
                },
                {
                    $set: {
                        time: {
                            $dateTrunc: {
                                date: "$version.createdAt",
                                unit: unit || "day",
                                binSize: binSize || 1,
                            },
                        },
                    },
                },
                {
                    $group: {
                        _id: {
                            employee: (groupBy.employee) ? "$namedAs" : undefined,
                            time: "$time",
                            type: (groupBy.type) ? "$version.type" : undefined
                        },
                        versions: {
                            $push: "$version",
                        },
                    },
                },

                setter,
                // {
                //   $set:
                //     {
                //       employee: "$_id.employee",
                //       time: "$_id.time",
                //       type: "$_id.type"
                //     },
                // },
                {
                    $project: {
                        _id: 0,
                    },
                },
                {
                    $sort: {
                        time: 1
                    }
                }
            ]

            let pipeline = p1.concat(p2).concat(p3)

            let data = await mongodb.aggregate({
                db,
                collection: `${db.name}.${grantCollection}`,
                pipeline
            })


            data = data.map(d => {

                d.totals = {
                    assigned: d.versions.filter(v => v.type == 'branch').length,
                    complete: d.versions.filter(v => v.type == 'save' && (v.branch || v.commit || v.merge)).length,
                    inProgress: d.versions.filter(v => v.type == 'save' && v.head && !v.readonly).length,
                    started: d.versions.filter(v => v.type == 'branch' && v.head && !v.readonly).length,
                }

                d.totals.buffer = d.totals.inProgress + d.totals.started

                return d
            })

            return data

        } catch (e) {

            throw e

        }

    }


    async getExpiredFreeze(options = {}) {

        try {

            let { db, branchesCollection } = this.context
            let { version } = options

            let p1 = (version) ? [{ $match: version }] : []
            let p2 = [{
                $match: {
                    type: "freeze",
                    expiredAt: {
                        $lte: new Date(),
                    },
                    commit: {
                        $exists: false,
                    }
                }
            }]

            let pipeline = p1.concat(p2)

            let data = await mongodb.aggregate({
                db,
                collection: `${db.name}.${branchesCollection}`,
                pipeline
            })

            return data

        } catch (e) {

            throw e
        }

    }


    async commitExpiredFreeze(options = {}) {
        try {
            let list = await this.getExpiredFreeze(options)
            let result = []

            for (const version of list) {
                let b = await createBrancher(extend({}, this.context, { dataId: version.dataId }))
                let v = await b.commit({ source: version })
                result.push(v)
            }

            return result

        } catch (e) {

            throw e
        }

    }

    async initData(options = {}) {

        let { db, branchesCollection } = this.context
        let { dataId, metadata } = options

        dataId = dataId || []
        dataId = (isArray(dataId)) ? dataId : [dataId]

        let w = await createBrancher(extend({}, this.context, { dataId, metadata }))
        let result = w.select(v => dataId.includes(v.dataId))

        return result

    }

    async getMainVersionByPatient(options = {}) {

        try {
            let { db, branchesCollection } = this.context
            let { matchVersion } = options

            let pipeline = [{
                    $match: matchVersion || {}
                },
                {
                    $group: {
                        _id: "$metadata.patientId",
                        task: {
                            $push: "$$ROOT",
                        },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        patientId: "$_id",
                        task: 1,
                    },
                },
            ]

            let data = await mongodb.aggregate({
                db,
                collection: `${db.name}.${branchesCollection}`,
                pipeline
            })

            return data

        } catch (e) {

            throw e
        }

    }

    async startFromMain(options = {}) {

        try {

            let { db, branchesCollection, taskQuotePeriod } = this.context
            let { matchVesion, matchEmployee, parallel, metadata } = options

            parallel = parallel || 1

            let taskGroups = await this.getMainVersionByPatient({ matchVesion: matchVesion || {} })


            for (let group of taskGroups) {

                let priority = (await this.getEmployeeStat({

                        employee: matchEmployee || {},
                        version: {
                            createdAt: {
                                $gte: moment(new Date()).subtract(...taskQuotePeriod).toDate()
                            }
                        }

                    }))

                    .map(d => ({
                        user: d.namedAs,
                        buffer: d.totals.buffer,
                        priority: d.priority,
                        totals: d.totals
                    }))


                priority = priority.filter(d => d.priority >= group.task.length)


                let user = []

                if (priority.length >= parallel) {

                    while (user.length < parallel) {

                        let u = sample(priority)
                        remove(priority, d => d.user == u.user)
                        user.push(u)

                    }

                    let brancher = await createBrancher(extend({}, this.context, { dataId: group.task.map(d => d.dataId) }))

                    // console.log("Create task:", group.patientId, user.map(d => d.user), group.task)

                    let r = await brancher.branch({
                        user: user.map(d => d.user),
                        source: group.task,
                        metadata: extend({}, metadata, { patientId: group.patientId })
                    })

                }

            }

        } catch (e) {

            throw e
        }
    }

}

const createWorker = (options = {}) => {

    let worker = new Worker(options)
    return worker
}

module.exports = createWorker