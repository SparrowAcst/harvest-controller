const Queue = require("queue-promise")

let queue


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


module.exports = {
    execute: task => {
        console.log('EXECUTE LONG TERM')
        if (!queue) initiate()
        queue.enqueue(task)
    }
}