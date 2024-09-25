const Queue = require("queue-promise")
const uuid = require("uuid").v4
const moment = require("moment")
const { keys } = require("lodash")

let queue
let pool = {}

const EXPIRAION = [1, "hours"]


const initiate = () => {

    console.log("INITIATE LONG TERM")

    queue = new Queue({
        concurrent: 1,
        interval: 2
    })

    queue.on("start", () => {
        console.log(`LONG TERM QUEUE started at ${new Date()}`)
    })

    queue.on("stop", () => {
        console.log(`LONG TERM QUEUE stoped at ${new Date()}`)
    })

    queue.on("resolve", data => {})

    queue.on("reject", error => {})

    queue.start()
}


const removeExpiredTask = section => {
    if (!pool[section]) return
    let tasks = keys(pool[section])
    tasks.forEach(task => {
        if (
            pool[section][task].state == "done" &&
            pool[section][task].expiredAt &&
            moment(new Date()).isSameOrBefore(moment(pool[section][task].expiredAt))
        ) delete pool[section][task]
    })

}


const startTask = (section, id) => {
    try {
        removeExpiredTask(section)
        pool[section] = pool[section] || {}
        pool[section][id] = {
            id,
            status: "started"
        }
        console.log("LONG TERM TASK POOL", pool)
    } catch (e) {
        console.log(e.toString(), e.stack)
    }
}

const stopTask = (section, id) => {
    try {
        pool[section] = pool[section] || {}
        pool[section][id] = {
            id,
            status: "done",
            version: uuid(),
            expiredAt: moment(new Date()).add(...EXPIRAION).toDate()
        }
        console.log("LONG TERM TASK POOL", pool)
    } catch (e) {
        console.log(e.toString(), e.stack)
    }
}

const getTask = (section, id) => {
    if (!pool[section]) return {}
    if (!pool[section][id]) return {}
    return pool[section][id]
}


module.exports = {

    execute: task => {
        console.log('EXECUTE LONG TERM')
        if (!queue) initiate()
        queue.enqueue(task)
    },
    pool: {
        startTask,
        stopTask,
        getTask
    }
}