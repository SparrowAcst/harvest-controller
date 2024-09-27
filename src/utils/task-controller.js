const mongodb = require("../mongodb")
const uuid = require("uuid").v4

const {
    extend,
    isUndefined,
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
    flatten,
    sample,
    groupBy,
    orderBy
} = require("lodash")

const moment = require("moment")

const createBrancher = require("./data-brancher-5")

const SETTINGS = {

    "1st expert": {
        TASK_BUFFER_MAX: 84,
    },

    "2nd expert": {
        TASK_BUFFER_MAX: 84,
    },

    "CMO": {
        TASK_BUFFER_MAX: 84,
    },

    "admin": {
        TASK_BUFFER_MAX: 21,
    }

}


const TASK_BUFFER_MAX = 21
const LIMIT = 100


let EMPLOYEES = {}



const collaboratorHeads = (dataId, user) => version => version.dataId == dataId && version.type != "main" && version.user != user && version.head == true
const userHead = (dataId, user) => version =>
    version.dataId == dataId &&
    version.user == user &&
    version.head == true &&
    version.type != "main"

const mainHead = (dataId, user) => version =>
    version.dataId == dataId &&
    version.type == "main" &&
    version.head == true

const collaboration = (brancher, dataId, user) => brancher.select(collaboratorHeads(dataId, user))
const userDataHead = (brancher, dataId, user) => {
    let v1 = first(orderBy(brancher.select(userHead(dataId, user)), ["readonly", "createdAt"], ["asc", "desc"]))
    let v2 = brancher.select(mainHead(dataId, user))[0]
    return (v1) ? v1 : v2
}



const Worker = class {

    constructor(options) {
        this.context = extend({}, options)
        this.context.employee = this.context.employee || SETTINGS
        this.brancherDataId = null
    }


    async getBrancher(options) {

        // console.log("options.dataId", (options) ? options.dataId : "undefined")

        if (options && options.dataId != this.brancherDataId) {
            this.brancher = await createBrancher(options)
            return this.brancher
        }

        this.brancher = (this.brancher) ?
            this.brancher :
            await createBrancher(options || this.context)
        return this.brancher

    }


    async getActualVersion(options = {}) {
        let { user, dataId } = options
        // console.log("getActualVersion")
        const brancher = await this.getBrancher()
        let version = userDataHead(brancher, dataId, user.altname)
        version.data = await brancher.resolveData({ version })
        return version
    }


    async resolveData(options = {}) {

        try {

            let { db } = this.context
            let { version } = options

            // let dataId = version.dataId || this.context.dataId
            // dataId = (isArray(dataId)) ? dataId : [dataId]

            let brancher = await this.getBrancher() //extend({}, this.context, { dataId }))
            let result = await brancher.resolveData({ version })

            return result

        } catch (e) {
            console.log(e.toString(), e.stack)
            throw e
        }

    }

    // async selectTask(options = {}) {
    //     // console.log("selectTask")

    //     try {
    //         let { db } = this.context
    //         let { matchVersion } = options

    //         let pipeline = [{
    //                 $match: matchVersion || {}
    //             },
    //             {
    //                 $project: {
    //                     _id: 0,
    //                 },
    //             },
    //             {
    //                 $limit: LIMIT
    //             }
    //         ]

    //         let data = await mongodb.aggregate({
    //             comment: "selectTask",
    //             db,
    //             collection: `${db.name}.savepoints`,
    //             pipeline
    //         })

    //         return data

    //     } catch (e) {

    //         throw e
    //     }

    // }


    async selectTask(options = {}) {
        // console.log("selectTaskfromCache")

        try {

            let { matchVersion } = options
            matchVersion = matchVersion || (version => true)
            if (isFunction(matchVersion)) {
                let brancher = await this.getBrancher()

                let data = brancher.select(matchVersion)

                return data

            } else {

                let { db } = this.context

                let pipeline = [{
                        $match: matchVersion || {}
                    },
                    {
                        $sort: {
                            createdAt: 1
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                        },
                    },
                    {
                        $limit: LIMIT
                    }
                ]

                let data = await mongodb.aggregate({
                    comment: "selectTask",
                    db,
                    collection: `${db.name}.savepoints`,
                    pipeline
                })

                return data
            }

        } catch (e) {
            console.log(e.toString(), e.stack)
            throw e
        }

    }


    async selectMainTask(options = {}) {

        try {
            let { db } = this.context
            let { matchVersion } = options

            let pipeline = [{
                    $match: matchVersion || {}
                },
                {
                    $project: {
                        _id: 0,
                    },
                },
                {
                    $limit: LIMIT
                }
            ]

            let data = await mongodb.aggregate({
                db,
                collection: `${db.name}.savepoints`,
                pipeline
            })

            return data

        } catch (e) {
            console.log(e.toString(), e.stack)
            throw e
        }

    }

    async selectEmployeeTask(options = {}) {

        try {

            let { db } = this.context
            let { matchEmployee, matchVersion } = options

            matchEmployee = (matchEmployee) ? [
                { $match: matchEmployee },
                { $limit: LIMIT }
            ] : [{ $limit: LIMIT }]

            matchVersion = (matchVersion) ? [{ $match: matchVersion }] : []

            let employes = await mongodb.aggregate({
                db,
                collection: `settings.app-grant`,
                pipeline: matchEmployee
            })

            let versions = await mongodb.aggregate({
                db,
                collection: `${db.name}.savepoints`,
                pipeline: matchVersion
            })

            let data = []

            data = employes.map(e => {
                let v = versions.filter(d => d.user == e.namedAs)
                return v.map(d => extend({}, e, { version: d }))
            })

            data = flatten(data)

            return data

        } catch (e) {
            console.log(e.toString(), e.stack)
            throw e

        }

    }


    // async getEmployeeActivity(options = {}) {

    //     try {

    //         let { db } = this.context
    //         let { matchEmployee, matchVersion } = options

    //         matchEmployee = (matchEmployee) ? [{ $match: matchEmployee }, { $limit: LIMIT }] : [{ $limit: LIMIT }]
    //         matchVersion = (matchVersion) ? [{ $match: matchVersion }, { $limit: LIMIT }] : [{ $limit: LIMIT }]

    //         let employes = await mongodb.aggregate({
    //             db,
    //             collection: `settings.app-grant`,
    //             pipeline: matchEmployee
    //         })

    //         let versions = await mongodb.aggregate({
    //             db,
    //             collection: `${db.name}.savepoints`,
    //             pipeline: matchVersion
    //         })


    //         let data = []

    //         data = employes.map(e => {
    //             return extend({}, e, { activity: versions.filter(d => d.user == e.namedAs) })
    //         })

    //         return data

    //     } catch (e) {
    //         throw e
    //     }

    // }

    async getEmployeeActivity(options = {}) {

        try {

            let { db, userProfiles } = this.context
            let { matchEmployee, matchVersion } = options

            // console.log("userProfiles", userProfiles)
            // console.log("this.context", this.context)

            matchEmployee = matchEmployee || (u => true)

            let employes = userProfiles.filter(matchEmployee)

            matchVersion = (matchVersion) ? [{
                    $match: {
                        user: {
                            $in: employes.map(u => u.namedAs)
                        }
                    }
                },
                {
                    $match: matchVersion
                },
                {
                    $sort: { createdAt: 1 }
                },
                {
                    $limit: LIMIT
                }
            ] : [{
                    $match: {
                        user: {
                            $in: employes.map(u => u.namedAs)
                        }
                    }
                },
                {
                    $sort: {
                        createdAt: 1
                    }
                },
                {
                    $limit: LIMIT
                }
            ]

            let versions = await mongodb.aggregate({
                db,
                collection: `${db.name}.savepoints`,
                pipeline: matchVersion
            })


            let data = []

            data = employes.map(e => {
                return extend({}, e, { activity: versions.filter(d => d.user == e.namedAs) })
            })

            return data

        } catch (e) {
            console.log(e.toString(), e.stack)
            throw e
        }

    }


    async getEmployeeStat(options = {}) {
        try {

            const filters = {
                assigned: d => d.type == "branch",
                inProgress: d => d.type == "save" && d.head == true && d.readonly == false,
                started: d => d.type == "branch" && d.head == true && d.readonly == false,
                complete: d => d.type == "submit" && (!!d.branch || !!d.submit || !!d.merge)
            }

            let { db } = this.context
            let { matchEmployee, matchVersion } = options

            let taskList = await this.getEmployeeActivity({
                matchEmployee: matchEmployee || {},
                matchVersion: matchVersion || {}
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
                result.priority = TASK_BUFFER_MAX - result.totals.buffer
                result.free = result.priority
                result.priority = (result.priority < 0) ? 0 : result.priority
                return extend({}, t, result)
            })

            return r


        } catch (e) {
            console.log(e.toString(), e.stack)
            throw e

        }

    }


    async getEmploeePriorities(options = {}) {

        let { user } = options

        if (isUndefined(EMPLOYEES[user])) {
            console.log("LOAD priority for", user)
            let activity = await this.getEmployeeStat({
                matchEmployee: u => u.namedAs == user
            })
            activity = activity[0]
            if (activity) EMPLOYEES[user] = activity.priority

        }
        keys(EMPLOYEES).forEach(key => {
            EMPLOYEES[key] = (EMPLOYEES[key] < 0) ? 0 : EMPLOYEES[key]
        })

        return EMPLOYEES

    }

    async listEmploeePriorities() {
        return EMPLOYEES
    }

    async resetEmployeePriority(user) {
        if (!user) {

            EMPLOYEES = {}

        } else {

            delete EMPLOYEES[user]

        }
        console.log(EMPLOYEES)
        return EMPLOYEES

    }

    async changeEmployeePriority(user, delta, mode) {
        if (user) {
            delta = Number.parseInt(delta)
            if( !Number.isNaN(delta) ) {
                if(mode == "relative") {
                    EMPLOYEES[user] += delta
                } else {
                    //absolute mode
                    EMPLOYEES[user] = delta
                }    
            }                            
        }    
        console.log(EMPLOYEES)
        return EMPLOYEES
    }


    async getEmployeeStatByTaskType(options = {}) {
        try {

            const filters = {
                assigned: d => d.type == "branch",
                inProgress: d => d.type == "save" && d.head == true && d.readonly == false,
                started: d => d.type == "branch" && d.head == true && d.readonly == false,
                complete: d => {
                    return d.type == "submit" && d.head == true // && moment(new Date(d.expiredAt)).isAfter(moment(new Date()))
                }
            }

            let { db } = this.context
            let { matchEmployee, matchVersion } = options

            let taskList = await this.getEmployeeActivity({
                matchEmployee,
                matchVersion
            })

            // console.log("getEmployeeStatByTaskType", matchEmployee, matchVersion)
            // console.log(JSON.stringify(taskList, null, " "))



            taskList = taskList.map(u => {

                let list = groupBy(u.activity, t => t.metadata.actual_task)
                list = keys(list).map(key => ({ name: key, task: list[key] }))

                let r = list.map(t => {

                    let result = {
                        task: t.name,
                        activity: {},
                        totals: {}
                    }

                    keys(filters).forEach(key => {
                        result.activity[key] = t.task.filter(filters[key])
                        result.totals[key] = result.activity[key].length
                    })

                    // result.totals.buffer = result.totals.inProgress + result.totals.started
                    // result.priority = this.context.employee[u.role].TASK_BUFFER_MAX - result.totals.buffer
                    // result.free = result.priority
                    return { task: result.task, totals: result.totals }
                })

                return { user: u.namedAs, statistics: r }
            })

            return taskList

        } catch (e) {
            console.log(e.toString(), e.stack)
            throw new Error(`${e.toString()} : ${e.stack}`)

        }

    }


    async assignTasks(options = {}) {

        try {
            const { user, schedule } = options

            for (const s of schedule) {

                let tasks = await s(user, this)
                tasks = tasks || { version: [] }

                if (tasks.version.length == 0) continue

                let b = await this.getBrancher(extend({}, this.context, { dataId: tasks.version.map(t => t.dataId) }))

                await b.branch({
                    source: tasks.version,
                    user: user.altname,
                    metadata: tasks.metadata
                })

                tasks.version = tasks.version.map(v => {
                    v.lockRollback = true
                    return v
                })

                // console.log("tasks.version", tasks.version)

                await b.updateVersion({ version: tasks.version })

            }
        } catch (e) {
            console.log(e.toString(), e.stack)
        }

    }



    // async getTimeline(options = {}) {

    //     try {

    //         let { db, grantCollection, branchesCollection } = this.context
    //         let { employee, version, unit, binSize, groupBy } = options

    //         groupBy = groupBy || {}


    //         let p1 = ((employee) ? [{ $match: employee }] : [])

    //         let p2 = (version) ? [{
    //             $lookup: {
    //                 from: branchesCollection,
    //                 localField: "namedAs",
    //                 foreignField: "user",
    //                 pipeline: [{
    //                     $match: version
    //                 }, ],
    //                 as: "activity",
    //             }
    //         }] : []


    //         let setter = {
    //             $set: {
    //                 time: "$_id.time"
    //             }
    //         }

    //         if (groupBy.employee) {
    //             setter.$set[groupBy.employee.name || "employee"] = "$_id.employee"
    //         }

    //         if (groupBy.type) {
    //             setter.$set[groupBy.type.name || "type"] = "$_id.type"
    //         }


    //         let p3 = [{
    //                 $lookup: {
    //                     from: "branches",
    //                     localField: "namedAs",
    //                     foreignField: "user",
    //                     pipeline: [{
    //                         $project: {
    //                             _id: 0,
    //                         },
    //                     }, ],
    //                     as: "version",
    //                 },
    //             },
    //             {
    //                 $unwind: {
    //                     path: "$version",
    //                 },
    //             },
    //             {
    //                 $set: {
    //                     time: {
    //                         $dateTrunc: {
    //                             date: "$version.createdAt",
    //                             unit: unit || "day",
    //                             binSize: binSize || 1,
    //                         },
    //                     },
    //                 },
    //             },
    //             {
    //                 $group: {
    //                     _id: {
    //                         employee: (groupBy.employee) ? "$namedAs" : undefined,
    //                         time: "$time",
    //                         type: (groupBy.type) ? "$version.type" : undefined
    //                     },
    //                     versions: {
    //                         $push: "$version",
    //                     },
    //                 },
    //             },

    //             setter,
    //             // {
    //             //   $set:
    //             //     {
    //             //       employee: "$_id.employee",
    //             //       time: "$_id.time",
    //             //       type: "$_id.type"
    //             //     },
    //             // },
    //             {
    //                 $project: {
    //                     _id: 0,
    //                 },
    //             },
    //             {
    //                 $sort: {
    //                     time: 1
    //                 }
    //             }
    //         ]

    //         let pipeline = p1.concat(p2).concat(p3)

    //         let data = await mongodb.aggregate({
    //             db,
    //             collection: `${db.name}.${grantCollection}`,
    //             pipeline
    //         })


    //         data = data.map(d => {

    //             d.totals = {
    //                 assigned: d.versions.filter(v => v.type == 'branch').length,
    //                 complete: d.versions.filter(v => v.type == 'save' && (v.branch || v.commit || v.merge)).length,
    //                 inProgress: d.versions.filter(v => v.type == 'save' && v.head && !v.readonly).length,
    //                 started: d.versions.filter(v => v.type == 'branch' && v.head && !v.readonly).length,
    //             }

    //             d.totals.buffer = d.totals.inProgress + d.totals.started

    //             return d
    //         })

    //         return data

    //     } catch (e) {

    //         throw e

    //     }

    // }


    // async getExpiredSubmit(options = {}) {

    //     try {

    //         let { db } = this.context
    //         let { version } = options

    //         let p1 = (version) ? [{ $match: version }] : []
    //         let p2 = [{
    //             $match: {
    //                 type: "submit",
    //                 expiredAt: {
    //                     $lte: new Date(),
    //                 },
    //                 commit: {
    //                     $exists: false,
    //                 }
    //             }
    //         }]

    //         let pipeline = p1.concat(p2)

    //         let data = await mongodb.aggregate({
    //             db,
    //             collection: `${db.name}.${branchesCollection}`,
    //             pipeline
    //         })

    //         return data

    //     } catch (e) {

    //         throw e
    //     }

    // }


    // async commitExpiredSubmit(options = {}) {
    //     try {
    //         let list = await this.getExpiredFreeze(options)
    //         let result = []

    //         for (const version of list) {
    //             let b = await createBrancher(extend({}, this.context, { dataId: version.dataId }))
    //             let v = await b.commit({ source: version })
    //             result.push(v)
    //         }

    //         return result

    //     } catch (e) {

    //         throw e
    //     }

    // }

    async initData(options = {}) {

        let { db } = this.context
        let { dataId, metadata } = options

        dataId = dataId || []
        dataId = (isArray(dataId)) ? dataId : [dataId]

        // console.log(dataId, metadata)

        let w = await this.getBrancher(extend({}, this.context, { dataId, metadata }))
        let result = w.select(v => dataId.includes(v.dataId))

        return result

    }

    async updateVersion(options = {}) {
        try {
            let { version } = options

            version = version || []
            version = (isArray(version)) ? version : [version]

            let dataId = version.map(v => v.dataId)

            let w = await this.getBrancher(extend({}, this.context, { dataId }))

            await w.updateVersion({ version })
        } catch (e) {
            console.log(e.toString(), e.stack)

        }
    }

    async getMainVersionByPatient(options = {}) {

        try {
            let { db } = this.context
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
                { $limit: LIMIT }
            ]

            let data = await mongodb.aggregate({
                db,
                collection: `${db.name}.savepoints`,
                pipeline
            })

            return data

        } catch (e) {
            console.log(e.toString(), e.stack)

            throw e
        }

    }

    async startFromMain(options = {}) {

        try {

            let { db, taskQuotePeriod } = this.context
            let { matchVesion, matchEmployee, parallel, metadata } = options

            parallel = parallel || 1

            let taskGroups = await this.getMainVersionByPatient({ matchVesion: matchVesion || {} })

            for (let group of taskGroups) {

                let priority = (await this.getEmployeeStat({

                        employee: matchEmployee || {},
                        // version: {
                        //     createdAt: {
                        //         $gte: moment(new Date()).subtract(...taskQuotePeriod).toDate()
                        //     }
                        // }

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

                    let brancher = await this.getBrancher(extend({}, this.context, { dataId: group.task.map(d => d.dataId) }))

                    // console.log("Create task:", group.patientId, user.map(d => d.user), group.task)

                    let r = await brancher.branch({
                        user: user.map(d => d.user),
                        source: group.task,
                        metadata: extend({}, metadata, { patientId: group.patientId })
                    })

                }

            }

        } catch (e) {
            console.log(e.toString(), e.stack)

            throw e
        }
    }

}

const createWorker = (options = {}) => {

    let worker = new Worker(options)
    return worker
}

module.exports = createWorker